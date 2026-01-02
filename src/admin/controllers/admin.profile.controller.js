import User from "../../auth/auth.model.js";
import bcrypt from "bcryptjs";

/* ======================
   GET ADMIN PROFILE
====================== */
export const getAdminProfile = async (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
};

/* ======================
   UPDATE ADMIN PROFILE
====================== */
export const updateAdminProfile = async (req, res) => {
  const { name, notificationsEnabled, darkModeEnabled } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user.id,
    {
      name,
      notificationsEnabled,
      darkModeEnabled,
    },
    { new: true }
  ).select("-password");

  res.json({
    success: true,
    user,
  });
};

/* ======================
   CHANGE PASSWORD
====================== */
export const changeAdminPassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id).select("+password");

  const match = await bcrypt.compare(oldPassword, user.password);
  if (!match) {
    return res.status(400).json({ message: "Wrong password" });
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.json({
    success: true,
    message: "Password updated successfully",
  });
};
