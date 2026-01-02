import User from "../../auth/auth.model.js";
import ProjectRequest from "../../student/models/projectRequest.model.js";
import Project from "../../student/models/project.model.js";
import Notification from "../../student/models/notification.model.js";
import Payment from "../../payments/models/payment.model.js"; 


export const getAdminDashboard = async (req, res) => {
  try {
    const [
      pendingRequests,
      activePaidProjects,
      totalStudents,
      unreadNotifications,
    ] = await Promise.all([
      ProjectRequest.countDocuments({ status: "submitted" }),
      Payment.countDocuments({ status: "success" }),
      User.countDocuments({ role: "student" }),
      Notification.countDocuments({ isRead: false }),
    ]);

    res.json({
      success: true,
      data: {
        pending: pendingRequests,
        active: activePaidProjects,
        students: totalStudents,
        inbox: unreadNotifications,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to load admin dashboard",
    });
  }
};

export const getAllRequests = async (req, res) => {
  const requests = await ProjectRequest.find()
    .populate("userId", "name email")
    .lean();

  res.json({
    success: true,
    data: requests.map(r => ({
      ...r,
      isPaid: r.paymentStatus === "paid",
      isPayable: r.status === "approved" && r.paymentStatus === "unpaid",
    })),
  });
};
