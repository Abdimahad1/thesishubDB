import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    /* =====================
       BASIC IDENTITY
    ====================== */
    name: {
      type: String,
      trim: true,
      required: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true
    },

    password: {
      type: String,
      select: false // 🔐 never return password
    },

    /* =====================
       AUTH PROVIDER
    ====================== */
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local"
    },

    googleId: {
      type: String,
      default: null
    },

    /* =====================
       ROLE & ACCESS
    ====================== */
    role: {
      type: String,
      enum: ["student", "admin"],
      default: "student", // 🔒 SAFE DEFAULT
      index: true
    },

    isActive: {
      type: Boolean,
      default: true
    },

    /* =====================
       STUDENT PROFILE
       (optional, future-proof)
    ====================== */
    university: {
      type: String,
      default: ""
    },

    department: {
      type: String,
      default: ""
    },

    /* =====================
       USER SETTINGS
    ====================== */
    notificationsEnabled: {
      type: Boolean,
      default: true
    },

    darkModeEnabled: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("User", userSchema);
