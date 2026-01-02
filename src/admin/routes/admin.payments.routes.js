import express from "express";
import { protect } from "../../middlewares/auth.middleware.js";
import { adminOnly } from "../../middlewares/adminOnly.middleware.js";
import { markPaymentAsPaid } from "../controllers/admin.payments.controller.js";

const router = express.Router();
router.use(protect, adminOnly);

router.post("/:id/force-paid", markPaymentAsPaid);

export default router;
