import ProjectRequest from "../../student/models/projectRequest.model.js";
import Notification from "../../student/models/notification.model.js";

export const getAllRequests = async (req, res) => {
  const requests = await ProjectRequest.find()
    .populate("userId", "name email")
    .sort({ createdAt: -1 });

  res.json({ success: true, data: requests });
};

export const approveRequest = async (req, res) => {
  const request = await ProjectRequest.findById(req.params.id);
  if (!request) {
    return res.status(404).json({ success: false, message: "Not found" });
  }

  await request.approve("Approved by admin");

  await Notification.create({
    user: request.userId,
    title: "Project Approved",
    message: `Your project "${request.title}" has been approved.`,
    type: "project",
  });

  res.json({ success: true, message: "Request approved" });
};

export const rejectRequest = async (req, res) => {
  const { reason } = req.body;

  const request = await ProjectRequest.findById(req.params.id);
  if (!request) {
    return res.status(404).json({ success: false, message: "Not found" });
  }

  request.status = "rejected";
  request.rejectionReason = reason;
  request.rejectedAt = new Date();
  await request.save();

  await Notification.create({
    user: request.userId,
    title: "Project Rejected",
    message: reason || "Your project request was rejected.",
    type: "project",
  });

  res.json({ success: true, message: "Request rejected" });
};
