import express from "express";
import { protect } from "../../middlewares/auth.middleware.js";
import {
  getMyProfile,
  updateProfile,
  changePassword,
} from "../controllers/profile.controller.js";

const router = express.Router();

router.get("/me", protect, getMyProfile);
router.put("/me", protect, updateProfile);
router.put("/change-password", protect, changePassword);

export default router;
