import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
    },

    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProjectRequest",
      index: true,
      required: true,
    },

    invoiceId: {
      type: String,
      index: true,
      required: true,
    },
    
    referenceId: {
      type: String,
      index: true,
      default: function() {
        return `TH-REF-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      }
    },

    accountNo: {
      type: String,
      required: true,
      trim: true,
    },
    
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    
    description: {
      type: String,
      default: "Project Payment",
    },

    status: {
      type: String,
      enum: ["pending", "success", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    
    paymentMethod: {
      type: String,
      enum: ["EVC", "EDahab"], 
      required: true,
    },
    
    retryCount: {
      type: Number,
      default: 0,
      max: 3,
    },
    
    lastRetryAt: Date,
    
    userIp: String,
    userAgent: String,
    
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    waafiResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
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
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ requestId: 1, status: 1 });
paymentSchema.index({ invoiceId: 1 }, { unique: true });
paymentSchema.index({ referenceId: 1 }, { unique: true });
paymentSchema.index({ createdAt: -1 });

// Virtual for formatted amount
paymentSchema.virtual('amountFormatted').get(function() {
  return `$${this.amount?.toFixed(2) || '0.00'}`;
});

// Virtual for readable date
paymentSchema.virtual('dateFormatted').get(function() {
  return this.createdAt?.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) || '';
});

// Pre-save hook to ensure referenceId
paymentSchema.pre('save', function () {
  if (!this.referenceId) {
    this.referenceId = `TH-REF-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  if (!this.description) {
    this.description = `Payment for project ${this.requestId}`;
  }
});


export default mongoose.model("Payment", paymentSchema);