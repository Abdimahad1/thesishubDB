import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    student: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      required: true,
      index: true,
    },
    
    requestId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "ProjectRequest",
      required: true,
      index: true,
    },
    
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },
    
    description: {
      type: String,
      required: true,
    },
    
    university: String,
    department: String,

    services: [{
      name: String,
      price: Number,
    }],
    
    urgency: {
      type: String,
      enum: ["Standard", "Fast", "Urgent", "standard", "fast", "urgent"],
      default: "Standard",
    },

    totalPrice: {
      type: Number,
      required: true,
      min: 0.01,
    },

    status: {
      type: String,
      enum: ["pending", "in_progress", "review", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    
    // Team assignment
    assignedTo: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    
    // Timelines
    deadline: Date,
    startedAt: Date,
    completedAt: Date,
    
    // Progress tracking
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    
    milestones: [{
      title: String,
      description: String,
      dueDate: Date,
      completed: {
        type: Boolean,
        default: false,
      },
      completedAt: Date,
    }],
    
    // Communication
    messages: [{
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      message: String,
      attachments: [String],
      isRead: {
        type: Boolean,
        default: false,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    }],
    
    // Files and deliverables
    deliverables: [{
      name: String,
      url: String,
      type: String,
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      description: String,
    }],
    
    // Metadata
    metadata: {
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
projectSchema.index({ student: 1, status: 1 });
projectSchema.index({ status: 1, deadline: 1 });
projectSchema.index({ createdAt: -1 });

// Virtual for days remaining
projectSchema.virtual('daysRemaining').get(function() {
  if (!this.deadline) return null;
  const now = new Date();
  const deadline = new Date(this.deadline);
  const diffTime = deadline - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for progress label
projectSchema.virtual('progressLabel').get(function() {
  if (this.status === 'completed') return 'Completed';
  if (this.status === 'cancelled') return 'Cancelled';
  if (this.progress === 0) return 'Not Started';
  if (this.progress < 25) return 'Just Started';
  if (this.progress < 50) return 'In Progress';
  if (this.progress < 75) return 'Halfway There';
  if (this.progress < 100) return 'Almost Done';
  return 'Completed';
});

// Virtual for formatted dates
projectSchema.virtual('createdAtFormatted').get(function() {
  return this.createdAt?.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }) || '';
});

projectSchema.virtual('deadlineFormatted').get(function() {
  if (!this.deadline) return 'Not Set';
  return this.deadline.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
});

// Pre-save hook
projectSchema.pre('save', function(next) {
  // Set startedAt when progress becomes > 0
  if (this.isModified('progress') && this.progress > 0 && !this.startedAt) {
    this.startedAt = new Date();
  }
  
  // Set completedAt when status becomes completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
    this.progress = 100;
  }
  
  next();
});

// Instance method to add milestone
projectSchema.methods.addMilestone = function(milestone) {
  this.milestones.push({
    ...milestone,
    completed: false,
  });
  return this.save();
};

// Instance method to complete milestone
projectSchema.methods.completeMilestone = function(milestoneIndex) {
  if (this.milestones[milestoneIndex]) {
    this.milestones[milestoneIndex].completed = true;
    this.milestones[milestoneIndex].completedAt = new Date();
    
    // Update progress based on completed milestones
    const completedCount = this.milestones.filter(m => m.completed).length;
    const totalCount = this.milestones.length;
    
    if (totalCount > 0) {
      this.progress = Math.round((completedCount / totalCount) * 100);
    }
    
    return this.save();
  }
  throw new Error('Milestone not found');
};

// Instance method to add message
projectSchema.methods.addMessage = function(senderId, message, attachments = []) {
  this.messages.push({
    sender: senderId,
    message,
    attachments,
    isRead: false,
    createdAt: new Date(),
  });
  return this.save();
};

// Instance method to mark messages as read
projectSchema.methods.markMessagesAsRead = function(userId) {
  this.messages.forEach(message => {
    if (message.sender.toString() !== userId.toString() && !message.isRead) {
      message.isRead = true;
    }
  });
  return this.save();
};

export default mongoose.model("Project", projectSchema);