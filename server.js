/**
 * ============================================================
 *  MAIN SERVER ENTRY POINT – ThesisHub Backend
 * ============================================================
 * - Loads environment variables FIRST (dev only)
 * - Initializes Express app
 * - Applies security & performance middlewares
 * - Registers all API routes
 * - Health check for Render
 * - Global error handling
 * - MongoDB connection + graceful shutdown
 * - SAFE for Render (Free & Paid)
 * ============================================================
 */

/* =========================
   ENV CONFIG (🔥 MUST BE FIRST)
========================= */
import dotenv from "dotenv";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

/* =========================
   CORE IMPORTS
========================= */
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

/* =========================
   ROUTE IMPORTS
========================= */

// 🔐 Authentication
import authRoutes from "./src/auth/auth.routes.js";

// 👤 Student profile
import studentProfileRoutes from "./src/student/routes/profile.routes.js";

// 📄 Student project requests
import projectRequestRoutes from "./src/student/routes/projectRequest.routes.js";

// 💳 Payments (WaafiPay)
import paymentRoutes from "./src/payments/routes/payment.routes.js";

// 🔔 Notifications
import notificationRoutes from "./src/student/routes/notification.routes.js";

// 🛠 Admin routes
import adminDashboardRoutes from "./src/admin/routes/admin.dashboard.routes.js";
import adminRequestsRoutes from "./src/admin/routes/admin.requests.routes.js";
import adminPaymentsRoutes from "./src/admin/routes/admin.payments.routes.js";
import adminUsersRoutes from "./src/admin/routes/admin.users.routes.js";
import adminProfileRoutes from "./src/admin/routes/admin.profile.routes.js";
import adminNotificationRoutes from "./src/admin/routes/adminNotification.routes.js";

// 🔥 Firebase / Push Notifications
import firebaseRoutes from "./src/firebase/firebase.routes.js";

// ⚠️ Global error handler (MUST be last)
import { errorHandler } from "./src/middlewares/error.middleware.js";

/* =========================
   APP INIT
========================= */
const app = express();
const isProduction = process.env.NODE_ENV === "production";

/* =========================
   TRUST PROXY (REQUIRED FOR RENDER)
========================= */
app.set("trust proxy", 1);

/* =========================
   SECURITY MIDDLEWARES
========================= */

// 🛡 Security headers
app.use(helmet());

// 🌍 Secure CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["*"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// 🚦 Global rate limiting (SAFE for Render Free)
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300, // per IP
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// 🔐 Stricter rate limit for auth routes
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
  })
);

/* =========================
   PERFORMANCE MIDDLEWARES
========================= */

// 📦 Parse JSON bodies
app.use(express.json({ limit: "10mb" }));

// 🧾 Request logging (Render-friendly)
if (!isProduction) {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

/* =========================
   API ROUTES
========================= */

// 🔐 Auth
app.use("/api/auth", authRoutes);

// 👤 Student
app.use("/api/student/profile", studentProfileRoutes);
app.use("/api/student/requests", projectRequestRoutes);

// 💳 Payments
app.use("/api/payments", paymentRoutes);

// 🔔 Notifications
app.use("/api/notifications", notificationRoutes);

// 🛠 Admin
app.use("/api/admin/profile", adminProfileRoutes);
app.use("/api/admin/notifications", adminNotificationRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/admin/requests", adminRequestsRoutes);
app.use("/api/admin/payments", adminPaymentsRoutes);
app.use("/api/admin/users", adminUsersRoutes);

// 🔥 Firebase
app.use("/api/firebase", firebaseRoutes);

/* =========================
   HEALTH CHECK (RENDER)
========================= */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    uptime: process.uptime(),
    environment: isProduction ? "production" : "development",
    timestamp: new Date().toISOString(),
  });
});

/* =========================
   ERROR HANDLING (🔥 LAST)
========================= */
app.use(errorHandler);

/* =========================
   DATABASE + SERVER START
========================= */
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ Startup failed: MONGO_URI is missing");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");

    const server = app.listen(PORT, () => {
      console.log(
        `🚀 ThesisHub Backend running on ${
          isProduction ? "Render" : "localhost"
        } port ${PORT}`
      );
    });

    /* =========================
       GRACEFUL SHUTDOWN (RENDER)
    ========================= */
    process.on("SIGTERM", () => {
      console.log("🛑 SIGTERM received. Shutting down...");
      server.close(() => {
        mongoose.connection.close(false, () => {
          console.log("🧠 MongoDB disconnected");
          process.exit(0);
        });
      });
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });
