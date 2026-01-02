import express from "express";
import { protect } from "../../middlewares/auth.middleware.js";
import {
  createRequest,
  getMyRequests,
  getRequestById,
  updateRequest,
  cancelRequest,
  getRequestStats,
} from "../controllers/projectRequest.controller.js";

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Request routes
router.post("/", createRequest);
router.get("/", getMyRequests);
router.get("/stats", getRequestStats);
router.get("/:id", getRequestById);
router.put("/:id", updateRequest);
router.delete("/:id", cancelRequest);

export default router;