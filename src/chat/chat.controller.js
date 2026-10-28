
const chatService = require("./chat.service");

// Get the authenticated user's ID from the existing JWT middleware.
function getUserId(req) {
  const userId = Number(req.user?.id);

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    const error = new Error("Invalid authenticated user.");
    error.statusCode = 401;
    throw error;
  }

  return userId;
}

// Validate the conversation ID from the URL.
function getConversationId(req) {
  const conversationId = Number(req.params.conversationId);

  if (!Number.isSafeInteger(conversationId) || conversationId <= 0) {
    const error = new Error("Invalid conversation ID.");
    error.statusCode = 400;
    throw error;
  }

  return conversationId;
}

// Keep API error responses consistent.
function handleError(res, error) {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    console.error("Chat API error:", error);
  }

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? "An unexpected error occurred."
        : error.message,
  });
}

// GET /api/chat/conversations
exports.getConversations = async (req, res) => {
  try {
    const userId = getUserId(req);
    const data = await chatService.getConversations(userId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /api/chat/conversations
exports.createConversation = async (req, res) => {
  try {
    const userId = getUserId(req);
    const data = await chatService.createConversation(userId, req.body);

    return res.status(data.existing ? 200 : 201).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET /api/chat/conversations/:conversationId/messages
exports.getMessages = async (req, res) => {
  try {
    const userId = getUserId(req);
    const conversationId = getConversationId(req);

    const requestedLimit = Number(req.query.limit ?? 50);
    const limit =
      Number.isInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 100)
        : 50;

    const data = await chatService.getMessages(
      userId,
      conversationId,
      limit
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// SEND MESSAGE 


exports.sendMessage = async (req, res) => {
  try {
    const userId = getUserId(req);
    const conversationId = getConversationId(req);

    const data = await chatService.sendMessage(
      userId,
      conversationId,
      req.body?.content
    );

    // Broadcast only after the message has been saved successfully.
    const io = req.app.get("io");

    if (io) {
      io.to(`conversation:${conversationId}`).emit(
        "message:new",
        data
      );
    }

    return res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};


// PATCH /api/chat/conversations/:conversationId/read
exports.markRead = async (req, res) => {
  try {
    const userId = getUserId(req);
    const conversationId = getConversationId(req);

    const data = await chatService.markConversationRead(
      userId,
      conversationId
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};


// EDIT MESSAGE

exports.editMessage = async (req, res) => {
  try {
    const userId = getUserId(req);
    const conversationId = getConversationId(req);
    const messageId = Number(req.params.messageId);

    if (!Number.isSafeInteger(messageId) || messageId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid message ID.",
      });
    }

    const data = await chatService.editMessage(
      userId,
      conversationId,
      messageId,
      req.body?.content
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// DELETE MESSAGE 


exports.deleteMessage = async (req, res) => {
  try {
    const userId = getUserId(req);
    const conversationId = getConversationId(req);
    const messageId = Number(req.params.messageId);

    if (!Number.isSafeInteger(messageId) || messageId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid message ID.",
      });
    }

    const data = await chatService.deleteMessage(
      userId,
      conversationId,
      messageId
    );

    return res.status(200).json({
      success: true,
      message: "Message deleted successfully.",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// ADD MEMBER TO GROUP CONVERSATION


exports.addGroupMembers = async (req, res) => {
  try {
    const userId = getUserId(req);
    const conversationId = getConversationId(req);

    const data = await chatService.addGroupMembers(
      userId,
      conversationId,
      req.body?.member_ids
    );

    return res.status(200).json({
      success: true,
      message: "Group members added successfully.",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// REMOVE GROUP MEMBER


exports.removeGroupMember = async (req, res) => {
  try {
    const userId = getUserId(req);
    const conversationId = getConversationId(req);
    const memberId = Number(req.params.memberId);

    if (!Number.isSafeInteger(memberId) || memberId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid member ID.",
      });
    }

    const data = await chatService.removeGroupMember(
      userId,
      conversationId,
      memberId
    );

    return res.status(200).json({
      success: true,
      message: "Group member removed successfully.",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// RENAME A GROUP 

exports.renameGroup = async (req, res) => {
  try {
    const userId = getUserId(req);
    const conversationId = getConversationId(req);

    const data = await chatService.renameGroup(
      userId,
      conversationId,
      req.body?.name
    );

    return res.status(200).json({
      success: true,
      message: "Group renamed successfully.",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};




