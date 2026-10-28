
const { io } = require("socket.io-client");
const readline = require("readline/promises");

async function testSocketConnection() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const token = await rl.question("Paste a NEW login token: ");
  rl.close();

  if (!token.trim()) {
    console.error("JWT token is required.");
    process.exitCode = 1;
    return;
  }

  const socket = io("http://localhost:4000", {
    auth: { token: token.trim() },
    transports: ["websocket"],
    reconnection: false,
    timeout: 10000,
  });

  socket.on("connect", function handleConnect() {
    console.log("Socket connected:", socket.id);

    socket.emit(
      "conversation:join",
      { conversationId: 3 },
      function handleJoinResponse(response) {
        console.log("Join response:", response);
        socket.disconnect();
        process.exitCode = response?.success ? 0 : 1;
      }
    );
  });

  socket.on("connect_error", function handleConnectError(error) {
    console.error("Message:", error.message);
    console.error("Description:", error.description);
    console.error("Context:", error.context);
    socket.disconnect();
    process.exitCode = 1;
  });
}

testSocketConnection().catch(function handleError(error) {
  console.error("Test failed:", error.message);
  process.exitCode = 1;
});
