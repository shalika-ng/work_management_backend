const authMiddleware = require("../middleware/auth.middleware")
const express = require("express");
const router = express.Router();
const chatController = require("./chat.controller");

// All chat endpoints require authentication.
router.use(authMiddleware);

// Conversation endpoints
router.get("/conversations", chatController.getConversations);
router.post("/conversations", chatController.createConversation);

// Message endpoints
router.get(
  "/conversations/:conversationId/messages",
  chatController.getMessages
);

router.post(
  "/conversations/:conversationId/messages",
  chatController.sendMessage
);

// Read status
router.patch(
  "/conversations/:conversationId/read",
  chatController.markRead
);

// EDIT MESSAGE


router.patch(
  "/conversations/:conversationId/messages/:messageId",
  chatController.editMessage
);

// DELETE  MESSAGE 
router.delete(
  "/conversations/:conversationId/messages/:messageId",
  chatController.deleteMessage
);

// ADD MEMBER TO GROUP CHAT CONVERSATION


router.post(
  "/conversations/:conversationId/members",
  chatController.addGroupMembers
);

// REMOVE GROUP MEMBER


router.delete(
  "/conversations/:conversationId/members/:memberId",
  chatController.removeGroupMember
);

// RENAME A GROUP 

router.patch(
  "/conversations/:conversationId",
  chatController.renameGroup
);



module.exports = router;
