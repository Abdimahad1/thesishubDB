import express from "express";
import { protect } from "../../middlewares/auth.middleware.js";
import {
  createProject,
  getMyProjects,
  getProjectDetails,
  addProjectMessage,
  updateProjectStatus,
  getProjectStats,
} from "../controllers/project.controller.js";

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Project routes
router.get("/", getMyProjects);
router.get("/stats", getProjectStats);
router.get("/:id", getProjectDetails);
router.post("/:id/messages", addProjectMessage);
router.patch("/:id/status", updateProjectStatus);

// Note: createProject route is removed as projects are created automatically
// from the payment system

export default router;