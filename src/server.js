
require("dotenv").config();

const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const app = require("./app");
const pool = require("./config/database");

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://192.168.1.88:3000",
    ],
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
});

// Make Socket.IO available to backend modules.
app.set("io", io);

// Authenticate every Socket.IO connection using the existing JWT secret.
io.use(async function authenticateSocket(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return next(new Error("Authentication token is required."));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Support common JWT user ID claim names.
    const userId =
      decoded.id ??
      decoded.userId ??
      decoded.user_id ??
      decoded.sub;

    const parsedUserId = Number(userId);

    if (
      !Number.isSafeInteger(parsedUserId) ||
      parsedUserId <= 0
    ) {
      return next(new Error("Invalid user ID in authentication token."));
    }

    socket.user = {
      id: parsedUserId,
      decoded,
    };

    next();
  } catch (error) {
    console.error("Socket authentication failed:", error.message);
    next(new Error("Invalid or expired authentication token."));
  }
});

// Handle authenticated socket connections.
io.on("connection", function handleConnection(socket) {
  console.log(
    `Authenticated socket connected: ${socket.id}, user: ${socket.user.id}`
  );

  // Allow users to join only conversations they belong to.
  socket.on("conversation:join", async function joinConversation(payload, callback) {
    const respond =
      typeof callback === "function" ? callback : function () {};

    try {
      const conversationId = Number(payload?.conversationId);

      if (
        !Number.isSafeInteger(conversationId) ||
        conversationId <= 0
      ) {
        return respond({
          success: false,
          message: "Invalid conversation ID.",
        });
      }

      const membership = await pool.query(
        `SELECT 1
         FROM chat_conversation_members
         WHERE conversation_id = $1
           AND user_id = $2`,
        [conversationId, socket.user.id]
      );

      if (!membership.rowCount) {
        return respond({
          success: false,
          message: "You cannot join this conversation.",
        });
      }

      const room = `conversation:${conversationId}`;

      await socket.join(room);

      return respond({
        success: true,
        message: "Joined conversation successfully.",
        conversation_id: conversationId,
      });
    } catch (error) {
      console.error("Conversation join failed:", error.message);

      return respond({
        success: false,
        message: "Failed to join conversation.",
      });
    }
  });

  socket.on("disconnect", function handleDisconnect(reason) {
    console.log(
      `Socket disconnected: ${socket.id}, reason: ${reason}`
    );
  });
});

server.listen(PORT, async function startServer() {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("Socket.IO server initialized");

  try {
    await pool.query("SELECT NOW()");
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection failed!");
    console.error(error.message);
  }
});
