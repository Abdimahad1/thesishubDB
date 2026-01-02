import express from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { registerDeviceToken } from "./deviceToken.controller.js";

const router = express.Router();

/**
 * Firebase / Push related routes
 */
router.post("/device-token", protect, registerDeviceToken);

export default router;
