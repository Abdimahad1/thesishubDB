import mongoose from "mongoose";
import Payment from "../models/payment.model.js";
import ProjectRequest from "../../student/models/projectRequest.model.js";
import Project from "../../student/models/project.model.js";
import Notification from "../../student/models/notification.model.js";
import { payByWaafiPay } from "../services/waafipay.service.js";
import User from "../../auth/auth.model.js";

/* =========================
   ENV-BASED LOGGING
========================= */
const isProduction = process.env.NODE_ENV === "production";

const log = (...args) => {
  if (!isProduction) console.log(...args);
};

const logError = (message) => {
  console.error(message);
};

/* =========================
   PHONE VALIDATION
========================= */
const validatePhoneNumber = (phone) => {
  if (!phone) {
    return { valid: false, error: "Phone number is required" };
  }

  let cleaned = phone.toString().replace(/\D/g, "");
  cleaned = cleaned.replace(/^0+/, "");

  if (!cleaned.startsWith("252")) {
    cleaned = `252${cleaned}`;
  }

  if (cleaned.length !== 12) {
    return {
      valid: false,
      error: "Invalid phone number. Use format 2526xxxxxxx",
    };
  }

  return {
    valid: true,
    normalized: cleaned,
    carrier: cleaned.startsWith("25261")
      ? "Telesom"
      : cleaned.startsWith("25262")
      ? "Somtel"
      : cleaned.startsWith("25263")
      ? "Hormuud"
      : cleaned.startsWith("25269")
      ? "Golis"
      : "Unknown",
  };
};

/* =========================
   WAAFIPAY RESPONSE PARSER
========================= */
const parsePaymentResponse = (waafiResult) => {
  if (!waafiResult) {
    return {
      success: false,
      pending: false,
      responseCode: "9999",
      responseMsg: "No response from payment gateway",
      userMessage: "Payment service unavailable. Please try again later.",
    };
  }

  const responseCode = String(waafiResult.responseCode || "");
  const responseMsg = String(waafiResult.responseMsg || "");
  const status = String(
    waafiResult.transactionInfo?.status || ""
  ).toUpperCase();

  const success =
    responseCode === "0" ||
    status === "SUCCESS" ||
    responseMsg.toUpperCase().includes("SUCCESS");

  const pending =
    responseCode === "1002" ||
    responseCode === "1003" ||
    responseMsg.toUpperCase().includes("PENDING");

  let userMessage = responseMsg;

  if (responseMsg.includes("Haraaga")) {
    userMessage = "Insufficient balance in your account.";
  }

  return {
    success,
    pending,
    responseCode,
    responseMsg,
    userMessage,
    referenceId:
      waafiResult.transactionInfo?.referenceId ||
      waafiResult.referenceId,
    rawResponse: waafiResult,
  };
};

/* =========================
   MAIN PAYMENT CONTROLLER
========================= */
export const payForRequest = async (req, res) => {
  const transactionId = `TXN-${Date.now()}-${Math.floor(
    Math.random() * 10000
  )}`;

  log(`🚀 [${transactionId}] Payment request started`);

  try {
    const { requestId, accountNo, paymentMethod = "EVC" } = req.body;
    const userId = req.user.id;

    /* ================= VALIDATION ================= */
    if (!requestId || !accountNo) {
      return res.status(400).json({
        success: false,
        message: "requestId and accountNo are required",
      });
    }

    if (!["EVC", "EDahab"].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    const phoneValidation = validatePhoneNumber(accountNo);
    if (!phoneValidation.valid) {
      return res.status(400).json({
        success: false,
        message: phoneValidation.error,
      });
    }

    /* ================= FETCH REQUEST ================= */
    const request = await ProjectRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Project request not found",
      });
    }

    if (
      !request.userId ||
      request.userId.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to pay for this request",
      });
    }

    if (request.status !== "approved") {
      return res.status(403).json({
        success: false,
        message: "Request must be approved before payment",
      });
    }

    /* ================= AMOUNT ================= */
    const amount = Number(request.grandTotal);
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount",
      });
    }

    /* ================= INVOICE ================= */
    if (!request.invoiceId) {
      request.invoiceId = `TH-INV-${Date.now()}-${Math.floor(
        Math.random() * 10000
      )}`;
      await request.save();
    }

    /* ================= IDEMPOTENCY ================= */
    const existingSuccess = await Payment.findOne({
      invoiceId: request.invoiceId,
      status: "success",
    });

    if (existingSuccess) {
      return res.status(409).json({
        success: false,
        message: "Payment already completed for this invoice",
        data: {
          paymentId: existingSuccess._id,
        },
      });
    }

    const existingPending = await Payment.findOne({
      invoiceId: request.invoiceId,
      status: "pending",
    });

    if (existingPending) {
      return res.status(409).json({
        success: false,
        message: "Payment already in progress for this invoice",
      });
    }

    /* ================= CREATE PAYMENT ================= */
    const payment = await Payment.create({
      userId,
      requestId,
      invoiceId: request.invoiceId,
      accountNo: phoneValidation.normalized,
      amount,
      description: `Payment for: ${request.title}`,
      paymentMethod,
      status: "pending",
      metadata: {
        transactionId,
        carrier: phoneValidation.carrier,
      },
    });

    /* ================= CALL WAAFIPAY ================= */
    const waafiResult = await payByWaafiPay({
      phone: phoneValidation.normalized,
      amount,
      invoiceId: request.invoiceId,
      description: payment.description,
    });

    const parsed = parsePaymentResponse(waafiResult);

    payment.waafiResponse = parsed.rawResponse;
    payment.referenceId =
      parsed.referenceId || payment.referenceId;
    payment.status = parsed.success
      ? "success"
      : parsed.pending
      ? "pending"
      : "failed";

    await payment.save();

    /* ================= FAILED ================= */
    if (!parsed.success && !parsed.pending) {
      request.paymentStatus = "failed";
      await request.save();

      await Notification.create({
        user: userId,
        title: "Payment Failed",
        message: parsed.userMessage,
        type: "payment",
      });

      const admins = await User.find({
        role: "admin",
        isActive: true,
      });

      for (const admin of admins) {
        await Notification.create({
          user: admin._id,
          title: "Payment Failed",
          message: `Payment failed for request "${request.title}"`,
          type: "payment",
          metadata: { requestId: request._id },
        });
      }

      return res.status(400).json({
        success: false,
        message: parsed.userMessage,
        transactionId,
      });
    }

    /* ================= PENDING ================= */
    if (parsed.pending) {
      request.paymentStatus = "pending";
      await request.save();

      return res.status(200).json({
        success: true,
        pending: true,
        message: "Payment pending confirmation",
        transactionId,
      });
    }

    /* ================= SUCCESS ================= */
    request.paymentStatus = "paid";
    request.paymentMethod = paymentMethod;
    request.paidAt = new Date();
    await request.save();

    const project = await Project.create({
      student: userId,
      requestId,
      title: request.title,
      description: request.description,
      university: request.university,
      department: request.department,
      services: request.services,
      urgency: request.urgency?.type || "normal",
      totalPrice: amount,
      status: "in_progress",
      paymentId: payment._id,
    });

    await Notification.create({
      user: userId,
      title: "Payment Successful 🎉",
      message: `Payment of $${amount} successful. Project started.`,
      type: "payment",
      metadata: { projectId: project._id },
    });

    const admins = await User.find({
      role: "admin",
      isActive: true,
    });

    for (const admin of admins) {
      await Notification.create({
        user: admin._id,
        title: "Payment Completed",
        message: `Payment received for "${request.title}" ($${amount})`,
        type: "payment",
        metadata: {
          requestId: request._id,
          projectId: project._id,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment successful",
      transactionId,
      data: {
        paymentId: payment._id,
        projectId: project._id,
        invoiceId: request.invoiceId,
      },
    });
  } catch (error) {
    logError(`💥 Payment error: ${error.message}`);

    return res.status(500).json({
      success: false,
      message: "Payment processing error",
      transactionId,
    });
  }
};

/* =========================
   PHONE VALIDATION ENDPOINT
========================= */
export const validatePaymentPhone = async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({
      success: false,
      message: "Phone number is required",
    });
  }

  const validation = validatePhoneNumber(phone);

  return res.status(200).json({
    success: true,
    data: validation,
  });
};
