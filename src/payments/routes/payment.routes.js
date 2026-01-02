import express from "express";
import { protect } from "../../middlewares/auth.middleware.js";
import { 
  payForRequest, 
  validatePaymentPhone 
} from "../controllers/payment.controller.js";

const router = express.Router();

// Apply authentication middleware to all payment routes
router.use(protect);

// Process payment
router.post("/request", payForRequest);

// Validate phone number
router.post("/validate-phone", validatePaymentPhone);

export default router;