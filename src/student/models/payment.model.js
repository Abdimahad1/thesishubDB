import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    method: String,
    amount: Number,
    status: { type: String, default: "PAID" },
  },
  { timestamps: true }
);

export default mongoose.model("Payment", paymentSchema);
