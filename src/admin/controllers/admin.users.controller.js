import User from "../../auth/auth.model.js";

export const getAllStudents = async (req, res) => {
  const students = await User.find({ role: "student" })
    .select("name email createdAt isActive");

  res.json({ success: true, data: students });
};
