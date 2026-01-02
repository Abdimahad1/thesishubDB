import express from "express";
import { protect } from "../../middlewares/auth.middleware.js";
import { adminOnly } from "../../middlewares/adminOnly.middleware.js";
import {
  getAllRequests,
  approveRequest,
  rejectRequest,
} from "../controllers/admin.requests.controller.js";

const router = express.Router();
router.use(protect, adminOnly);

router.get("/", getAllRequests);
router.post("/:id/approve", approveRequest);
router.post("/:id/reject", rejectRequest);

export default router;
