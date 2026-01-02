import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    /* =========================
       RECEIVER
    ========================= */
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /* =========================
       CONTENT
    ========================= */
    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    /* =========================
       TYPE / CATEGORY
    ========================= */
      type: {
        type: String,
        enum: ["project", "payment", "admin", "system", "user"],
        set: v => v?.toLowerCase(),
        default: "system",
      },

    /* =========================
       READ STATE
    ========================= */
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    /* =========================
       SENDER (ADMIN / SYSTEM)
    ========================= */
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null = system generated
    },

    /* =========================
       BROADCAST FLAG
    ========================= */
    broadcast: {
      type: Boolean,
      default: false,
      index: true,
    },

    /* =========================
       EXTRA DATA (OPTIONAL)
    ========================= */
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

/* =========================
   INDEXES (PERFORMANCE)
========================= */
notificationSchema.index({ user: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
