import Notification from "../models/notification.model.js";

/* =======================
   GET USER NOTIFICATIONS
======================= */
export const getNotifications = async (req, res) => {
  const list = await Notification.find({
    user: req.user.id,
  }).sort({ createdAt: -1 });

  res.json(list);
};

/* =======================
   MARK SINGLE AS READ (SECURE)
======================= */
export const markRead = async (req, res) => {
  const updated = await Notification.findOneAndUpdate(
    {
      _id: req.params.id,
      user: req.user.id, // 🔐 ownership check
    },
    { isRead: true },
    { new: true }
  );

  if (!updated) {
    return res.status(404).json({
      message: "Notification not found",
    });
  }

  res.json({
    success: true,
    message: "Marked as read",
  });
};

/* =======================
   MARK ALL AS READ (USER ONLY)
======================= */
export const markAllRead = async (req, res) => {
  await Notification.updateMany(
    {
      user: req.user.id,
      isRead: false,
    },
    { isRead: true }
  );

  res.json({
    success: true,
    message: "All marked as read",
  });
};

/* =======================
   DELETE ALL (USER ONLY)
======================= */
export const deleteAll = async (req, res) => {
  await Notification.deleteMany({
    user: req.user.id,
  });

  res.json({
    success: true,
    message: "All notifications deleted",
  });
};
