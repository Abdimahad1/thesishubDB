import DeviceToken from "./deviceToken.model.js";

/**
 * POST /api/firebase/device-token
 */
export const registerDeviceToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token, platform } = req.body;

    if (!token || !platform) {
      return res.status(400).json({
        success: false,
        message: "token and platform are required",
      });
    }

    await DeviceToken.findOneAndUpdate(
      { token },
      {
        user: userId,
        platform,
        lastSeenAt: new Date(),
      },
      { upsert: true }
    );

    res.json({
      success: true,
      message: "Device token saved",
    });
  } catch (err) {
    console.error("❌ Device token error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to save device token",
    });
  }
};
