import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "./auth.model.js";
import { OAuth2Client } from "google-auth-library";

/* ======================
   HELPERS
====================== */
const signToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT configuration missing");
  }

  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

/* ======================
   LOCAL REGISTER
   🔒 FORCE STUDENT ROLE
====================== */
export const registerUser = async ({ name, email, password }) => {
  if (!name || !email || !password) {
    throw new Error("Name, email, and password are required");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const exists = await User.findOne({ email });
  if (exists) {
    throw new Error("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase(),
    password: hashedPassword,
    role: "student",        // 🔒 ALWAYS STUDENT
    authProvider: "local",
  });

  return user;
};

/* ======================
   LOCAL LOGIN
====================== */
export const loginUser = async ({ email, password }) => {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const user = await User.findOne({ email: email.toLowerCase() })
    .select("+password authProvider role");

  if (!user) {
    throw new Error("Invalid email or password");
  }

  // 🔐 Prevent password login for Google users
  if (user.authProvider === "google") {
    throw new Error("Please login using Google");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error("Invalid email or password");
  }

  const token = signToken(user);

  return { user, token };
};

/* ======================
   GOOGLE LOGIN / REGISTER
====================== */
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const googleAuthUser = async (tokenId) => {
  if (!tokenId) {
    throw new Error("Google token is required");
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error("Google auth not configured");
  }

  const ticket = await client.verifyIdToken({
    idToken: tokenId,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.email) {
    throw new Error("Invalid Google token");
  }

  if (!payload.email_verified) {
    throw new Error("Google email not verified");
  }

  const { sub, email, name } = payload;

  let user = await User.findOne({ email });

  // ✅ Auto-register ONLY if user does not exist
  if (!user) {
    user = await User.create({
      name,
      email,
      googleId: sub,
      authProvider: "google",
      // role defaults from schema
    });
  }

  // ✅ KEEP EXISTING ROLE (admin stays admin)
  const token = signToken(user);

  return { user, token };
};
