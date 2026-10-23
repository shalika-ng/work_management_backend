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

module.exports = router;
