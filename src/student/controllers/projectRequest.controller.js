import ProjectRequest from "../models/projectRequest.model.js";
import { SERVICES, URGENCY } from "../../config/pricing.config.js";
import Notification from "../../student/models/notification.model.js";
import User from "../../auth/auth.model.js";
import { sendPushBroadcast } from "../../firebase/push.service.js";

/* ================= CREATE REQUEST ================= */
export const createRequest = async (req, res) => {
  try {
    const {
      title,
      description,
      university,
      department,
      selectedServices,
      selectedUrgency,
    } = req.body;

    /* ================= VALIDATION ================= */
    if (!title || !selectedServices?.length || !selectedUrgency) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: title, services, and urgency are required",
      });
    }

    /* ================= PRICE CALCULATION ================= */
    const services = selectedServices.map((key) => {
      if (!SERVICES[key]) {
        throw new Error(`Invalid service: ${key}`);
      }

      return {
        key,
        price: SERVICES[key],
      };
    });

    const baseTotal = services.reduce(
      (sum, service) => sum + service.price,
      0
    );

    const urgencyConfig = URGENCY[selectedUrgency];
    if (!urgencyConfig) {
      throw new Error(`Invalid urgency: ${selectedUrgency}`);
    }

    /* ================= CREATE REQUEST ================= */
    const request = await ProjectRequest.create({
      userId: req.user.id,
      title: title.trim(),
      description: description?.trim() || "",
      university: university?.trim() || "",
      department: department?.trim() || "",
      services,
      urgency: {
        type: selectedUrgency,
        days: urgencyConfig.days,
        fee: urgencyConfig.fee,
      },
      baseTotal,
      urgencyFee: urgencyConfig.fee,
      grandTotal: baseTotal + urgencyConfig.fee,
      status: "submitted",
      paymentStatus: "unpaid",
    });

    /* ================= ADMIN NOTIFICATIONS ================= */

    // 1️⃣ Get active admins
    const admins = await User.find({
      role: "admin",
      isActive: true,
    }).select("_id");

    const adminIds = admins.map((a) => a._id);

if (adminIds.length > 0) {
  // 1️⃣ In-app notifications
  await Notification.insertMany(
    adminIds.map((adminId) => ({
      user: adminId,
      title: "New Project Request",
      message: `${req.user.name} submitted a new project request.`,
      type: "project",
      isRead: false,
      metadata: {
        requestId: request._id.toString(),
        studentId: req.user.id,
      },
    }))
  );

  // 2️⃣ 🔔 PUSH notification (this triggers top-of-screen alert)
  await sendPushBroadcast({
    userIds: adminIds,
    title: "📄 New Project Request",
    body: `${req.user.name} submitted a new project request`,
    data: {
      type: "project",
      requestId: request._id.toString(),
    },
  });
}


    /* ================= RESPONSE ================= */
    return res.status(201).json({
      success: true,
      message: "Project request created successfully",
      data: {
        request: {
          id: request._id,
          title: request.title,
          status: request.status,
          paymentStatus: request.paymentStatus,
          grandTotal: request.grandTotal,
          createdAt: request.createdAt,
        },
        paymentInfo: {
          isPayable: false,
          message: "Waiting for admin approval",
        },
      },
    });
  } catch (error) {
    console.error("❌ Create request error:", error);

    if (error.message?.includes("Invalid")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create project request",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};


/* ================= GET MY REQUESTS ================= */
export const getMyRequests = async (req, res) => {
  try {
    const { 
      status, 
      paymentStatus, 
      sort = '-createdAt',
      limit = 50,
      page = 1 
    } = req.query;
    
    const skip = (page - 1) * limit;
    
    // Build query
    const query = { userId: req.user.id };
    
    if (status) {
      query.status = status;
    }
    
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }
    
    // Get requests
    const requests = await ProjectRequest.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v')
      .lean();
    
    // Get total count for pagination
    const total = await ProjectRequest.countDocuments(query);
    
    // Transform data for frontend
    const transformedRequests = requests.map(request => ({
      ...request,
      isPayable: request.status === 'approved' && request.paymentStatus === 'unpaid',
      canRetry: request.paymentStatus === 'failed',
      daysSinceCreation: Math.floor((Date.now() - new Date(request.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
    }));
    
    res.json({ 
      success: true, 
      data: transformedRequests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("❌ Get my requests error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch requests" 
    });
  }
};

/* ================= GET SINGLE REQUEST ================= */
export const getRequestById = async (req, res) => {
  try {
    const request = await ProjectRequest.findOne({
      _id: req.params.id,
      userId: req.user.id,
    }).select('-__v').lean();

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: "Request not found" 
      });
    }

    // Add payment info
    const enhancedRequest = {
      ...request,
      isPayable: request.status === 'approved' && request.paymentStatus === 'unpaid',
      canRetry: request.paymentStatus === 'failed',
      requiresApproval: request.status === 'submitted',
      requiresPayment: request.status === 'approved' && request.paymentStatus === 'unpaid',
      isCompleted: request.status === 'approved' && request.paymentStatus === 'paid',
      paymentDetails: {
        invoiceId: request.invoiceId,
        amount: request.grandTotal,
        status: request.paymentStatus,
        method: request.paymentMethod,
        paidAt: request.paidAt,
      },
    };

    res.json({ 
      success: true, 
      data: enhancedRequest 
    });
  } catch (error) {
    console.error("❌ Get request by ID error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch request" 
    });
  }
};

/* ================= UPDATE REQUEST (if needed) ================= */
export const updateRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Remove fields that shouldn't be updated
    delete updates._id;
    delete updates.userId;
    delete updates.status;
    delete updates.paymentStatus;
    delete updates.invoiceId;
    delete updates.grandTotal;
    delete updates.baseTotal;
    delete updates.urgencyFee;
    
    const request = await ProjectRequest.findOneAndUpdate(
      { _id: id, userId: req.user.id, status: 'submitted' },
      updates,
      { new: true, runValidators: true }
    ).select('-__v');
    
    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: "Request not found or cannot be updated" 
      });
    }
    
    res.json({ 
      success: true, 
      message: "Request updated successfully",
      data: request 
    });
  } catch (error) {
    console.error("❌ Update request error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update request" 
    });
  }
};

/* ================= CANCEL REQUEST ================= */
export const cancelRequest = async (req, res) => {
  try {
    const { id } = req.params;
    
    const request = await ProjectRequest.findOneAndUpdate(
      { 
        _id: id, 
        userId: req.user.id,
        status: { $in: ['submitted', 'approved'] },
        paymentStatus: { $ne: 'paid' }
      },
      { 
        status: 'cancelled',
        cancelledAt: new Date()
      },
      { new: true }
    ).select('-__v');
    
    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: "Request not found or cannot be cancelled" 
      });
    }
    
    res.json({ 
      success: true, 
      message: "Request cancelled successfully",
      data: request 
    });
  } catch (error) {
    console.error("❌ Cancel request error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to cancel request" 
    });
  }
};

/* ================= GET REQUEST STATS ================= */
export const getRequestStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const stats = await ProjectRequest.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          submitted: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          paid: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          totalAmount: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$grandTotal', 0] } },
        },
      },
    ]);
    
    const result = stats[0] || {
      total: 0,
      submitted: 0,
      approved: 0,
      paid: 0,
      rejected: 0,
      cancelled: 0,
      totalAmount: 0,
    };
    
    res.json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    console.error("❌ Get request stats error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch stats" 
    });
  }
};