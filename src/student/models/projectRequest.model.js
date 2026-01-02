import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    key: String,
    price: Number,
  },
  { _id: false }
);

const urgencySchema = new mongoose.Schema(
  {
    type: String,
    days: Number,
    fee: Number,
  },
  { _id: false }
);

const projectRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: String,
    description: String,
    university: String,
    department: String,

    services: [serviceSchema],
    urgency: urgencySchema,

    baseTotal: Number,
    urgencyFee: Number,
    grandTotal: Number,

    /* =========================
       PAYMENT FIELDS
    ========================= */
    paymentMethod: {
      type: String,
      enum: ["EVC", "EDahab", "EVC_PLUS", "EDAHAB"],
    },

    invoiceId: {
      type: String,
      index: true,
      sparse: true,
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "pending", "paid", "failed"],
      default: "unpaid",
      index: true,
    },

    /* =========================
       REQUEST LIFECYCLE
    ========================= */
    status: {
      type: String,
      enum: ["submitted", "approved", "rejected", "cancelled"],
      default: "submitted",
      index: true,
    },

    /* =========================
       TIMESTAMPS
    ========================= */
    approvedAt: Date,
    paidAt: Date,
    rejectedAt: Date,
    cancelledAt: Date,

    /* =========================
       ADMIN FIELDS
    ========================= */
    adminNotes: String,
    rejectionReason: String,
  },
  { 
    timestamps: true,
    toJSON: { 
      virtuals: true,
      transform: function(doc, ret) {
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Add indexes
projectRequestSchema.index({ userId: 1, status: 1 });
projectRequestSchema.index({ status: 1, paymentStatus: 1 });
projectRequestSchema.index({ createdAt: -1 });

// Virtual for checking if payable
projectRequestSchema.virtual('isPayable').get(function() {
  return this.status === 'approved' && 
         this.paymentStatus === 'unpaid';
});

// Simple pre-save hook - REMOVE COMPLEX LOGIC FIRST
// projectRequestSchema.pre('save', function(next) {
//   // Comment out for now to debug
//   next();
// });

// Static method to generate invoice ID
projectRequestSchema.statics.generateInvoiceId = function() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `TH-INV-${timestamp}-${random}`;
};

// Instance method to mark as approved
projectRequestSchema.methods.approve = function(notes = '') {
  this.status = 'approved';
  this.adminNotes = notes;
  
  if (!this.invoiceId) {
    this.invoiceId = this.constructor.generateInvoiceId();
  }
  
  this.approvedAt = new Date();
  return this.save();
};

export default mongoose.model("ProjectRequest", projectRequestSchema);