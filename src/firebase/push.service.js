import admin from "./firebaseAdmin.js";
import DeviceToken from "./deviceToken.model.js";

/**
 * Send push to a single user
 */
export const sendPushToUser = async ({
  userId,
  title,
  body,
  data = {},
}) => {
  const tokens = await DeviceToken.find({ user: userId }).select("token");

  if (!tokens.length) return;

  const message = {
    notification: { title, body },
    data,
    tokens: tokens.map(t => t.token),
  };

  try {
    const response = await admin
      .messaging()
      .sendEachForMulticast(message);

    console.log("✅ Push sent to user:", {
      success: response.successCount,
      failure: response.failureCount,
    });
  } catch (err) {
    console.error("❌ Push error:", err);
  }
};

/**
 * Broadcast push to many users
 */
export const sendPushBroadcast = async ({
  userIds,
  title,
  body,
  data = {},
}) => {
  const tokens = await DeviceToken.find({
    user: { $in: userIds },
  }).select("token");

  if (!tokens.length) {
    console.warn("⚠️ No device tokens found for broadcast");
    return;
  }

  const message = {
    notification: { title, body },
    data,
    tokens: tokens.map(t => t.token),
  };

  try {
    const response = await admin
      .messaging()
      .sendEachForMulticast(message);

    console.log("✅ Broadcast push result:", {
      success: response.successCount,
      failure: response.failureCount,
    });

    // Optional: log failed tokens
    if (response.failureCount > 0) {
      response.responses.forEach((r, idx) => {
        if (!r.success) {
          console.error(
            "❌ Failed token:",
            tokens[idx].token,
            r.error?.message
          );
        }
      });
    }
  } catch (err) {
    console.error("❌ Broadcast push error:", err);
    throw err;
  }
};
