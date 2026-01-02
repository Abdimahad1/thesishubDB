import Project from "../models/project.model.js";
import Notification from "../models/notification.model.js";
import ProjectRequest from "./models/projectRequest.model.js";
import Payment from "../../payments/models/payment.model.js";

/* ================= CREATE PROJECT (From Payment) ================= */
export const createProject = async (req, res) => {
  try {
    // This should only be called internally from payment controller
    // For direct project creation, use the request system
    
    return res.status(400).json({
      success: false,
      message: "Projects are created automatically after payment. Please use the request system.",
    });
  } catch (error) {
    console.error("❌ Create project error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to create project" 
    });
  }
};

/* ================= GET MY PROJECTS ================= */
export const getMyProjects = async (req, res) => {
  try {
    const { 
      status, 
      sort = '-createdAt',
      limit = 50,
      page = 1 
    } = req.query;
    
    const skip = (page - 1) * limit;
    
    // Build query
    const query = { student: req.user.id };
    
    if (status) {
      query.status = status;
    }
    
    // Get projects with populated request info
    const projects = await Project.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('requestId', 'title status paymentStatus')
      .populate('assignedTo', 'name email')
      .select('-__v -messages')
      .lean();
    
    // Get total count for pagination
    const total = await Project.countDocuments(query);
    
    // Transform data for frontend
    const transformedProjects = projects.map(project => {
      const request = project.requestId || {};
      
      return {
        ...project,
        requestId: request._id,
        requestTitle: request.title,
        requestStatus: request.status,
        paymentStatus: request.paymentStatus,
        assignedTeam: project.assignedTo?.map(user => ({
          id: user._id,
          name: user.name,
          email: user.email,
        })) || [],
        // Calculate stats
        unreadMessages: project.messages?.filter(m => !m.isRead && m.sender.toString() !== req.user.id.toString()).length || 0,
        completedMilestones: project.milestones?.filter(m => m.completed).length || 0,
        totalMilestones: project.milestones?.length || 0,
      };
    });
    
    // Get project statistics
    const stats = await Project.aggregate([
      { $match: { student: req.user.id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalPrice' },
        },
      },
    ]);
    
    const statistics = stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      acc.totalSpent = (acc.totalSpent || 0) + (stat._id === 'completed' ? stat.totalAmount : 0);
      return acc;
    }, { total: total });
    
    res.json({ 
      success: true, 
      data: transformedProjects,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
      statistics,
    });
  } catch (error) {
    console.error("❌ Get my projects error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch projects" 
    });
  }
};

/* ================= GET PROJECT DETAILS ================= */
export const getProjectDetails = async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      student: req.user.id,
    })
      .populate('requestId', 'title status paymentStatus paymentMethod paidAt')
      .populate('assignedTo', 'name email avatar role')
      .populate('deliverables.uploadedBy', 'name email')
      .populate('messages.sender', 'name email avatar')
      .select('-__v')
      .lean();

    if (!project) {
      return res.status(404).json({ 
        success: false, 
        message: "Project not found" 
      });
    }

    // Get payment info
    const payment = await Payment.findOne({ requestId: project.requestId?._id })
      .select('status referenceId invoiceId amount waafiResponse')
      .lean();

    // Get related request
    const request = project.requestId || {};
    
    // Calculate project stats
    const unreadMessages = project.messages?.filter(m => 
      !m.isRead && m.sender._id.toString() !== req.user.id.toString()
    ).length || 0;
    
    const completedMilestones = project.milestones?.filter(m => m.completed).length || 0;
    const totalMilestones = project.milestones?.length || 0;
    
    // Format data for frontend
    const enhancedProject = {
      ...project,
      paymentInfo: payment ? {
        status: payment.status,
        referenceId: payment.referenceId,
        invoiceId: payment.invoiceId,
        amount: payment.amount,
        paid: payment.status === 'success',
        response: payment.waafiResponse,
      } : null,
      requestInfo: {
        id: request._id,
        title: request.title,
        status: request.status,
        paymentStatus: request.paymentStatus,
        paymentMethod: request.paymentMethod,
        paidAt: request.paidAt,
      },
      teamInfo: project.assignedTo?.map(member => ({
        id: member._id,
        name: member.name,
        email: member.email,
        avatar: member.avatar,
        role: member.role,
      })) || [],
      deliverablesInfo: project.deliverables?.map(deliverable => ({
        ...deliverable,
        uploadedByName: deliverable.uploadedBy?.name || 'Unknown',
      })) || [],
      messagesInfo: project.messages?.map(message => ({
        ...message,
        senderName: message.sender?.name || 'Unknown',
        senderAvatar: message.sender?.avatar,
        isOwnMessage: message.sender?._id.toString() === req.user.id.toString(),
        timeAgo: getTimeAgo(message.createdAt),
      })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) || [],
      stats: {
        unreadMessages,
        completedMilestones,
        totalMilestones,
        progress: project.progress || 0,
        daysRemaining: project.daysRemaining,
        isOverdue: project.deadline && new Date(project.deadline) < new Date() && project.status !== 'completed',
      },
      timeline: {
        createdAt: project.createdAt,
        startedAt: project.startedAt,
        deadline: project.deadline,
        completedAt: project.completedAt,
      },
    };

    // Mark messages as read for this user
    await Project.updateOne(
      { _id: req.params.id },
      {
        $set: {
          "messages.$[msg].isRead": true
        }
      },
      {
        arrayFilters: [{ "msg.sender": { $ne: req.user.id } }]
      }
    );


    res.json({ 
      success: true, 
      data: enhancedProject 
    });
  } catch (error) {
    console.error("❌ Get project details error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch project details" 
    });
  }
};

/* ================= ADD PROJECT MESSAGE ================= */
export const addProjectMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, attachments = [] } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Message is required" 
      });
    }

    const project = await Project.findOneAndUpdate(
      { 
        _id: id, 
        $or: [
          { student: req.user.id },
          { assignedTo: req.user.id }
        ]
      },
      {
        $push: {
          messages: {
            sender: req.user.id,
            message: message.trim(),
            attachments,
            isRead: false,
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    ).select('messages');

    if (!project) {
      return res.status(404).json({ 
        success: false, 
        message: "Project not found or access denied" 
      });
    }

    // Get the last added message
    const lastMessage = project.messages[project.messages.length - 1];

    // Create notification for other participants
    await Notification.create({
      user: req.user.id, // For tracking
      title: "New Project Message",
      message: `New message in project: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
      type: "PROJECT_MESSAGE",
      relatedId: id,
      metadata: {
        projectId: id,
        senderId: req.user.id,
        messageId: lastMessage._id,
      },
    });

    res.json({ 
      success: true, 
      message: "Message sent successfully",
      data: {
        message: {
          id: lastMessage._id,
          sender: req.user.id,
          message: lastMessage.message,
          attachments: lastMessage.attachments,
          createdAt: lastMessage.createdAt,
          isOwnMessage: true,
        },
      },
    });
  } catch (error) {
    console.error("❌ Add project message error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to send message" 
    });
  }
};

/* ================= UPDATE PROJECT STATUS ================= */
export const updateProjectStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, progress, milestoneIndex } = req.body;

    const updateData = {};
    
    if (status) {
      if (!['pending', 'in_progress', 'review', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid status" 
        });
      }
      updateData.status = status;
    }
    
    if (progress !== undefined) {
      if (progress < 0 || progress > 100) {
        return res.status(400).json({ 
          success: false, 
          message: "Progress must be between 0 and 100" 
        });
      }
      updateData.progress = progress;
    }

    const project = await Project.findOneAndUpdate(
      { 
        _id: id, 
        student: req.user.id, // Only student can update their own project
      },
      updateData,
      { new: true }
    ).select('title status progress');

    if (!project) {
      return res.status(404).json({ 
        success: false, 
        message: "Project not found or access denied" 
      });
    }

    // If completing a milestone
    if (milestoneIndex !== undefined) {
      if (project.milestones && project.milestones[milestoneIndex]) {
        project.milestones[milestoneIndex].completed = true;
        project.milestones[milestoneIndex].completedAt = new Date();
        await project.save();
      }
    }

    res.json({ 
      success: true, 
      message: "Project updated successfully",
      data: project,
    });
  } catch (error) {
    console.error("❌ Update project status error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update project" 
    });
  }
};

/* ================= GET PROJECT STATS ================= */
export const getProjectStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const stats = await Project.aggregate([
      { $match: { student: userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          in_progress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          review: { $sum: { $cond: [{ $eq: ['$status', 'review'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          totalSpent: { $sum: '$totalPrice' },
          avgProgress: { $avg: '$progress' },
        },
      },
    ]);
    
    const result = stats[0] || {
      total: 0,
      pending: 0,
      in_progress: 0,
      review: 0,
      completed: 0,
      cancelled: 0,
      totalSpent: 0,
      avgProgress: 0,
    };
    
    // Get active projects (not completed or cancelled)
    const activeProjects = await Project.countDocuments({
      student: userId,
      status: { $nin: ['completed', 'cancelled'] },
    });
    
    // Get overdue projects
    const overdueProjects = await Project.countDocuments({
      student: userId,
      deadline: { $lt: new Date() },
      status: { $nin: ['completed', 'cancelled'] },
    });
    
    result.activeProjects = activeProjects;
    result.overdueProjects = overdueProjects;
    result.completionRate = result.total > 0 ? Math.round((result.completed / result.total) * 100) : 0;
    
    res.json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    console.error("❌ Get project stats error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch project stats" 
    });
  }
};

// Helper function
function getTimeAgo(date) {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHour > 0) return `${diffHour}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return 'Just now';
}