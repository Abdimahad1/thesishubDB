import Notification from "../../student/models/notification.model.js";
import User from "../../auth/auth.model.js";
import { sendPushBroadcast } from "../../firebase/push.service.js";

export const broadcastToStudents = async (req, res) => {
  try {
    const { title, message } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required",
      });
    }

    // 🔐 Admin only
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // 1️⃣ Get all active students
    const students = await User.find({
      role: "student",
      isActive: true,
    }).select("_id");

    if (!students.length) {
      return res.status(404).json({
        success: false,
        message: "No students found",
      });
    }

    const studentIds = students.map(s => s._id);

    // 2️⃣ Save IN-APP notifications
    await Notification.insertMany(
      studentIds.map(studentId => ({
        user: studentId,
        sender: req.user.id,
        title,
        message,
        type: "admin",
        broadcast: true,
        isRead: false,
      }))
    );

    // 3️⃣ 🔥 SEND PUSH NOTIFICATIONS (THIS WAS MISSING)
    await sendPushBroadcast({
      userIds: studentIds,
      title,
      body: message,
      data: {
        type: "broadcast",
      },
    });

    return res.json({
      success: true,
      message: "Message sent to all students",
      count: studentIds.length,
    });
  } catch (error) {
    console.error("❌ Broadcast error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send broadcast",
    });
  }
};

