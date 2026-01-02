import express from "express";
import { protect } from "../../middlewares/auth.middleware.js";
import { adminOnly } from "../../middlewares/admin.middleware.js";

import {
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
} from "../controllers/admin.profile.controller.js";

const router = express.Router();

router.get("/me", protect, adminOnly, getAdminProfile);
router.put("/me", protect, adminOnly, updateAdminProfile);
router.put("/change-password", protect, adminOnly, changeAdminPassword);

export default router;
