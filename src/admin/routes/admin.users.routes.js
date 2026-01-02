import express from "express";
import { protect } from "../../middlewares/auth.middleware.js";
import { adminOnly } from "../../middlewares/adminOnly.middleware.js";
import { getAllStudents } from "../controllers/admin.users.controller.js";

const router = express.Router();
router.use(protect, adminOnly);

router.get("/", getAllStudents);

export default router;
