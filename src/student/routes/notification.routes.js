import express from "express";
import {
  getNotifications,
  markRead,
  markAllRead,
  deleteAll,
} from "../controllers/notification.controller.js";
import { protect } from "../../middlewares/auth.middleware.js";

const router = express.Router();

// GET /api/notifications
router.get("/", protect, getNotifications);

// PUT /api/notifications/:id/read
router.put("/:id/read", protect, markRead);

// PUT /api/notifications/read-all
router.put("/read-all", protect, markAllRead);

// DELETE /api/notifications
router.delete("/", protect, deleteAll);

export default router;
