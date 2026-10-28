
const { io } = require("socket.io-client");
const readline = require("readline/promises");

const API_URL = "http://localhost:4000";
const CONVERSATION_ID = 3;

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const tokenA = await rl.question("Token for user A: ");
  const tokenB = await rl.question("Token for user B: ");
  rl.close();

  if (!tokenA.trim() || !tokenB.trim()) {
    throw new Error("Both login tokens are required.");
  }

  const socketA = io(API_URL, {
    auth: { token: tokenA.trim() },
    transports: ["websocket"],
    reconnection: false,
  });

  const socketB = io(API_URL, {
    auth: { token: tokenB.trim() },
    transports: ["websocket"],
    reconnection: false,
  });

  let joined = 0;
  let receivedByA = false;
  let receivedByB = false;
  let messageSent = false;
  let finished = false;

  function finish(success, message) {
    if (finished) return;
    finished = true;

    console.log(message);
    socketA.disconnect();
    socketB.disconnect();
    process.exitCode = success ? 0 : 1;
  }

  function maybeFinish() {
    if (receivedByA && receivedByB) {
      finish(true, "SUCCESS: Both clients received the new message.");
    }
  }

  function joinConversation(socket, label) {
    socket.emit(
      "conversation:join",
      { conversationId: CONVERSATION_ID },
      async function onJoin(response) {
        console.log(`${label} join result:`, response);

        if (!response?.success) {
          return finish(false, `${label} could not join the conversation.`);
        }

        joined += 1;

        if (joined === 2 && !messageSent) {
          messageSent = true;

          try {
            const response = await fetch(
              `${API_URL}/api/chat/conversations/${CONVERSATION_ID}/messages`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${tokenA.trim()}`,
                },
                body: JSON.stringify({
                  content: `Realtime test ${new Date().toISOString()}`,
                }),
              }
            );

            const result = await response.json();
            console.log("REST send status:", response.status);

            if (!response.ok) {
              return finish(
                false,
                `REST send failed: ${result.message || "Unknown error"}`
              );
            }

            console.log("Message saved:", result.data);
          } catch (error) {
            finish(false, `REST request failed: ${error.message}`);
          }
        }
      }
    );
  }

  socketA.on("connect", () => {
    console.log("User A connected:", socketA.id);
    joinConversation(socketA, "User A");
  });

  socketB.on("connect", () => {
    console.log("User B connected:", socketB.id);
    joinConversation(socketB, "User B");
  });

  socketA.on("message:new", (message) => {
    console.log("User A received message:", message.id);
    receivedByA = true;
    maybeFinish();
  });

  socketB.on("message:new", (message) => {
    console.log("User B received message:", message.id);
    receivedByB = true;
    maybeFinish();
  });

  socketA.on("connect_error", (error) => {
    finish(false, `User A connection failed: ${error.message}`);
  });

  socketB.on("connect_error", (error) => {
    finish(false, `User B connection failed: ${error.message}`);
  });

  setTimeout(() => {
    if (!finished) {
      finish(
        false,
        `Timed out. User A received: ${receivedByA}; User B received: ${receivedByB}.`
      );
    }
  }, 15000);
}

main().catch((error) => {
  console.error("Test failed:", error.message);
  process.exitCode = 1;
});
