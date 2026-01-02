import jwt from "jsonwebtoken";
import User from "../auth/auth.model.js";

export const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) throw new Error("Not authorized");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id);
    if (!req.user) throw new Error("User not found");

    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
  }
};
