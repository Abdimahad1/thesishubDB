import Payment from "../../payments/models/payment.model.js";
import ProjectRequest from "../../student/models/projectRequest.model.js";
import Project from "../../student/models/project.model.js";

export const markPaymentAsPaid = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    // 🛑 Idempotency: already processed
    if (payment.status === "success") {
      return res.status(400).json({
        success: false,
        message: "Payment already marked as paid",
      });
    }

    const request = await ProjectRequest.findById(payment.requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Related request not found",
      });
    }

    // 🛑 Prevent duplicate project creation
    const existingProject = await Project.findOne({ requestId: request._id });
    if (existingProject) {
      return res.status(400).json({
        success: false,
        message: "Project already exists for this request",
      });
    }

    // ✅ Mark payment
    payment.status = "success";
    await payment.save();

    // ✅ Update request
    request.paymentStatus = "paid";
    request.paidAt = new Date();
    await request.save();

    // ✅ Create project
    const project = await Project.create({
      student: request.userId,
      requestId: request._id,
      title: request.title,
      description: request.description,
      university: request.university,
      department: request.department,
      services: request.services,
      urgency: request.urgency?.type || "normal",
      totalPrice: payment.amount,
      status: "in_progress",
      paymentId: payment._id,
    });

    res.json({
      success: true,
      message: "Payment manually marked as paid",
      project,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to mark payment as paid",
    });
  }
};

