import express from "express";
import { protect } from "../../middlewares/auth.middleware.js";
import { broadcastToStudents } from "../controllers/adminNotification.controller.js";

const router = express.Router();

// POST /api/admin/notifications/broadcast
import { adminOnly } from "../../middlewares/admin.middleware.js";

router.post(
  "/broadcast",
  protect,
  adminOnly,
  broadcastToStudents
);

export default router;
