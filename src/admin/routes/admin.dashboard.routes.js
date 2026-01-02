import express from "express";
import { protect } from "../../middlewares/auth.middleware.js";
import { adminOnly } from "../../middlewares/adminOnly.middleware.js";
import { getAdminDashboard } from "../controllers/admin.dashboard.controller.js";

const router = express.Router();

router.use(protect, adminOnly);

router.get("/", getAdminDashboard);

export default router;
