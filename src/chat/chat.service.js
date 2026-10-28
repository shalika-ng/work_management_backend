
const pool = require("../config/database");

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseId(value, label = "ID") {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw createError(`Invalid ${label}.`);
  }

  return id;
}

async function isActiveWorkspaceMember(client, workspaceId, userId) {
  const result = await client.query(
    `SELECT 1
     FROM workspace_members
     WHERE workspace_id = $1
       AND user_id = $2
       AND status = 'ACTIVE'`,
    [workspaceId, userId]
  );

  return result.rowCount > 0;
}

async function isConversationMember(client, conversationId, userId) {
  const result = await client.query(
    `SELECT 1
     FROM chat_conversation_members
     WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId]
  );

  return result.rowCount > 0;
}

// List conversations belonging to the authenticated user.
async function getConversations(userId) {
  const { rows } = await pool.query(
    `SELECT
       c.id,
       c.workspace_id,
       c.type,
       c.name,
       c.created_by,
       c.created_at,
       c.updated_at,
       cm.last_read_at,

       (
         SELECT json_build_object(
           'id', msg.id,
           'sender_id', msg.sender_id,
           'content', msg.content,
           'created_at', msg.created_at
         )
         FROM chat_messages msg
         WHERE msg.conversation_id = c.id
           AND msg.deleted_at IS NULL
         ORDER BY msg.id DESC
         LIMIT 1
       ) AS last_message,

       (
         SELECT COUNT(*)
         FROM chat_messages unread
         WHERE unread.conversation_id = c.id
           AND unread.deleted_at IS NULL
           AND unread.sender_id <> $1
           AND (
             cm.last_read_at IS NULL
             OR unread.created_at > cm.last_read_at
           )
       ) AS unread_count,

       (
         SELECT COALESCE(
           json_agg(
             json_build_object(
               'id', u.id,
               'name', u.name,
               'email', u.email
             )
             ORDER BY u.name
           ),
           '[]'::json
         )
         FROM chat_conversation_members other_cm
         JOIN users u ON u.id = other_cm.user_id
         WHERE other_cm.conversation_id = c.id
       ) AS members

     FROM chat_conversations c
     JOIN chat_conversation_members cm
       ON cm.conversation_id = c.id
     WHERE cm.user_id = $1
     ORDER BY c.updated_at DESC, c.id DESC`,
    [userId]
  );

  return rows;
}

// Create a direct or group conversation.
async function createConversation(userId, payload = {}) {
  const workspaceId = parseId(payload.workspace_id, "workspace ID");
  const type = payload.type;
  const name = payload.name == null ? null : String(payload.name).trim();

  if (!["direct", "group"].includes(type)) {
    throw createError("Conversation type must be direct or group.");
  }

  if (!Array.isArray(payload.member_ids) || payload.member_ids.length === 0) {
    throw createError("Provide at least one other member ID.");
  }

  const requestedIds = payload.member_ids.map((id) =>
    parseId(id, "member ID")
  );

  // Always include the authenticated user.
  const memberIds = [...new Set([userId, ...requestedIds])];

  if (type === "direct" && memberIds.length !== 2) {
    throw createError("A direct chat must have exactly two members.");
  }

  if (type === "group" && memberIds.length < 2) {
    throw createError("A group chat must have at least two members.");
  }

  if (memberIds.length > 100) {
    throw createError("A conversation can contain at most 100 members.");
  }

  if (type === "group" && (!name || name.length > 150)) {
    throw createError("Group name is required and limited to 150 characters.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const creatorIsMember = await isActiveWorkspaceMember(
      client,
      workspaceId,
      userId
    );

    if (!creatorIsMember) {
      throw createError(
        "You are not an active member of this workspace.",
        403
      );
    }

    const membershipResult = await client.query(
      `SELECT user_id
       FROM workspace_members
       WHERE workspace_id = $1
         AND user_id = ANY($2::integer[])
         AND status = 'ACTIVE'
       ORDER BY user_id
       FOR SHARE`,
      [workspaceId, memberIds]
    );

    const activeIds = new Set(
      membershipResult.rows.map((row) => Number(row.user_id))
    );

    if (memberIds.some((id) => !activeIds.has(id))) {
      throw createError(
        "All participants must be active members of the same workspace.",
        403
      );
    }

    // Reuse an existing direct chat between the same two users.
    if (type === "direct") {
      const existing = await client.query(
        `SELECT c.id
         FROM chat_conversations c
         JOIN chat_conversation_members cm
           ON cm.conversation_id = c.id
         WHERE c.workspace_id = $1
           AND c.type = 'direct'
         GROUP BY c.id
         HAVING COUNT(*) = 2
           AND COUNT(*) FILTER (
             WHERE cm.user_id = ANY($2::integer[])
           ) = 2
         LIMIT 1`,
        [workspaceId, memberIds]
      );

      if (existing.rowCount > 0) {
        await client.query("COMMIT");

        return {
          id: existing.rows[0].id,
          existing: true,
        };
      }
    }

    const conversationResult = await client.query(
      `INSERT INTO chat_conversations
         (workspace_id, type, name, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [workspaceId, type, type === "group" ? name : null, userId]
    );

    const conversation = conversationResult.rows[0];

    for (const memberId of memberIds) {
      await client.query(
        `INSERT INTO chat_conversation_members
           (conversation_id, user_id)
         VALUES ($1, $2)`,
        [conversation.id, memberId]
      );
    }

    await client.query("COMMIT");

    return {
      ...conversation,
      existing: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Retrieve recent messages from a conversation.
async function getMessages(userId, conversationId, limit = 50) {
  const client = await pool.connect();

  try {
    const isMember = await isConversationMember(
      client,
      conversationId,
      userId
    );

    if (!isMember) {
      throw createError("You cannot access this conversation.", 403);
    }

    const { rows } = await client.query(
      `SELECT
         m.id,
         m.conversation_id,
         m.sender_id,
         u.name AS sender_name,
         m.content,
         m.created_at,
         m.edited_at
       FROM chat_messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
         AND m.deleted_at IS NULL
       ORDER BY m.id DESC
       LIMIT $2`,
      [conversationId, limit]
    );

    return rows.reverse();
  } finally {
    client.release();
  }
}

// Save a message.
async function sendMessage(userId, conversationId, content) {
  const message = typeof content === "string" ? content.trim() : "";

  if (!message || message.length > 5000) {
    throw createError(
      "Message must contain between 1 and 5000 characters."
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const membership = await client.query(
      `SELECT 1
       FROM chat_conversation_members
       WHERE conversation_id = $1
         AND user_id = $2
       FOR UPDATE`,
      [conversationId, userId]
    );

    if (!membership.rowCount) {
      throw createError(
        "You cannot send messages to this conversation.",
        403
      );
    }

    const result = await client.query(
      `INSERT INTO chat_messages
         (conversation_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING
         id,
         conversation_id,
         sender_id,
         content,
         created_at,
         edited_at`,
      [conversationId, userId, message]
    );

    await client.query(
      `UPDATE chat_conversations
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [conversationId]
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Mark messages in a conversation as read.
async function markConversationRead(userId, conversationId) {
  const client = await pool.connect();

  try {
    const result = await client.query(
      `UPDATE chat_conversation_members
       SET last_read_at = CURRENT_TIMESTAMP
       WHERE conversation_id = $1
         AND user_id = $2
       RETURNING conversation_id, last_read_at`,
      [conversationId, userId]
    );

    if (!result.rowCount) {
      throw createError(
        "Conversation not found or access denied.",
        403
      );
    }

    return result.rows[0];
  } finally {
    client.release();
  }
}



// EDIT MESSAGE :

async function editMessage(userId, conversationId, messageId, content) {
  const message = typeof content === "string" ? content.trim() : "";

  if (!message || message.length > 5000) {
    throw createError(
      "Message must contain between 1 and 5000 characters."
    );
  }

  const client = await pool.connect();

  try {
    const membership = await client.query(
      `SELECT 1
       FROM chat_conversation_members
       WHERE conversation_id = $1
         AND user_id = $2`,
      [conversationId, userId]
    );

    if (!membership.rowCount) {
      throw createError(
        "You cannot edit messages in this conversation.",
        403
      );
    }

    const result = await client.query(
      `UPDATE chat_messages
       SET content = $1,
           edited_at = CURRENT_TIMESTAMP
       WHERE id = $2
         AND conversation_id = $3
         AND sender_id = $4
         AND deleted_at IS NULL
       RETURNING
         id,
         conversation_id,
         sender_id,
         content,
         created_at,
         edited_at`,
      [message, messageId, conversationId, userId]
    );

    if (!result.rowCount) {
      throw createError(
        "Message not found or you cannot edit this message.",
        404
      );
    }

    await client.query(
      `UPDATE chat_conversations
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [conversationId]
    );

    return result.rows[0];
  } finally {
    client.release();
  }
}

// DELETE MESSAGE 

async function deleteMessage(userId, conversationId, messageId) {
  const client = await pool.connect();

  try {
    const membership = await client.query(
      `SELECT 1
       FROM chat_conversation_members
       WHERE conversation_id = $1
         AND user_id = $2`,
      [conversationId, userId]
    );

    if (!membership.rowCount) {
      throw createError(
        "You cannot delete messages in this conversation.",
        403
      );
    }

    const result = await client.query(
      `UPDATE chat_messages
       SET deleted_at = CURRENT_TIMESTAMP
       WHERE id = $1
         AND conversation_id = $2
         AND sender_id = $3
         AND deleted_at IS NULL
       RETURNING
         id,
         conversation_id,
         sender_id,
         deleted_at`,
      [messageId, conversationId, userId]
    );

    if (!result.rowCount) {
      throw createError(
        "Message not found or you cannot delete this message.",
        404
      );
    }

    await client.query(
      `UPDATE chat_conversations
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [conversationId]
    );

    return result.rows[0];
  } finally {
    client.release();
  }
}

// ADD MEMBERS TO GROUP CHAT CONVERSATION

async function addGroupMembers(userId, conversationId, memberIds = []) {
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    throw createError("Provide at least one member ID.");
  }

  const requestedIds = memberIds.map((id) =>
    parseId(id, "member ID")
  );

  // Remove duplicate IDs from the request.
  const uniqueIds = [...new Set(requestedIds)];

  if (uniqueIds.length > 100) {
    throw createError("You can add at most 100 members at a time.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the conversation while checking permissions and adding members.
    const conversationResult = await client.query(
      `SELECT id, workspace_id, type, created_by
       FROM chat_conversations
       WHERE id = $1
       FOR UPDATE`,
      [conversationId]
    );

    if (!conversationResult.rowCount) {
      throw createError("Conversation not found.", 404);
    }

    const conversation = conversationResult.rows[0];

    if (conversation.type !== "group") {
      throw createError(
        "Members can only be added to group conversations."
      );
    }

    if (Number(conversation.created_by) !== Number(userId)) {
      throw createError(
        "Only the group creator can add members.",
        403
      );
    }

    // The creator must still belong to the conversation.
    const creatorMembership = await client.query(
      `SELECT 1
       FROM chat_conversation_members
       WHERE conversation_id = $1
         AND user_id = $2`,
      [conversationId, userId]
    );

    if (!creatorMembership.rowCount) {
      throw createError(
        "You are no longer a member of this conversation.",
        403
      );
    }

    // All requested users must be active members of this workspace.
    const activeMembersResult = await client.query(
      `SELECT user_id
       FROM workspace_members
       WHERE workspace_id = $1
         AND user_id = ANY($2::integer[])
         AND status = 'ACTIVE'`,
      [conversation.workspace_id, uniqueIds]
    );

    const activeIds = new Set(
      activeMembersResult.rows.map((row) => Number(row.user_id))
    );

    if (uniqueIds.some((id) => !activeIds.has(id))) {
      throw createError(
        "All added users must be active members of this workspace.",
        403
      );
    }

    // Find which requested users are not already in the group.
    const existingMembersResult = await client.query(
      `SELECT user_id
       FROM chat_conversation_members
       WHERE conversation_id = $1
         AND user_id = ANY($2::integer[])`,
      [conversationId, uniqueIds]
    );

    const existingIds = new Set(
      existingMembersResult.rows.map((row) => Number(row.user_id))
    );

    const newMemberIds = uniqueIds.filter(
      (id) => !existingIds.has(id)
    );

    // Check the final group size before inserting.
    const countResult = await client.query(
      `SELECT COUNT(*) AS total
       FROM chat_conversation_members
       WHERE conversation_id = $1`,
      [conversationId]
    );

    const currentCount = Number(countResult.rows[0].total);

    if (currentCount + newMemberIds.length > 100) {
      throw createError(
        "A group conversation can contain at most 100 members."
      );
    }

    const addedMembers = [];

    for (const memberId of newMemberIds) {
      const insertResult = await client.query(
        `INSERT INTO chat_conversation_members
           (conversation_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (conversation_id, user_id) DO NOTHING
         RETURNING conversation_id, user_id, joined_at`,
        [conversationId, memberId]
      );

      if (insertResult.rowCount) {
        addedMembers.push(insertResult.rows[0]);
      }
    }

    await client.query(
      `UPDATE chat_conversations
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [conversationId]
    );

    await client.query("COMMIT");

    return {
      conversation_id: conversationId,
      added_count: addedMembers.length,
      members: addedMembers,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// REMOVE GROUP MEMBER

async function removeGroupMember(userId, conversationId, memberId) {
  memberId = parseId(memberId, "member ID");

  if (Number(userId) === memberId) {
    throw createError(
      "The group creator cannot remove themselves."
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const conversationResult = await client.query(
      `SELECT id, type, created_by
       FROM chat_conversations
       WHERE id = $1
       FOR UPDATE`,
      [conversationId]
    );

    if (!conversationResult.rowCount) {
      throw createError("Conversation not found.", 404);
    }

    const conversation = conversationResult.rows[0];

    if (conversation.type !== "group") {
      throw createError(
        "Members can only be removed from group conversations."
      );
    }

    if (Number(conversation.created_by) !== Number(userId)) {
      throw createError(
        "Only the group creator can remove members.",
        403
      );
    }

    const creatorMembership = await client.query(
      `SELECT 1
       FROM chat_conversation_members
       WHERE conversation_id = $1
         AND user_id = $2`,
      [conversationId, userId]
    );

    if (!creatorMembership.rowCount) {
      throw createError(
        "You are no longer a member of this conversation.",
        403
      );
    }

    const result = await client.query(
      `DELETE FROM chat_conversation_members
       WHERE conversation_id = $1
         AND user_id = $2
       RETURNING conversation_id, user_id`,
      [conversationId, memberId]
    );

    if (!result.rowCount) {
      throw createError(
        "Member not found in this group.",
        404
      );
    }

    await client.query(
      `UPDATE chat_conversations
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [conversationId]
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}


// RENAME A GROUP 

async function renameGroup(userId, conversationId, name) {
  const groupName = typeof name === "string" ? name.trim() : "";

  if (!groupName || groupName.length > 150) {
    throw createError(
      "Group name is required and limited to 150 characters."
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const conversationResult = await client.query(
      `SELECT id, type, created_by
       FROM chat_conversations
       WHERE id = $1
       FOR UPDATE`,
      [conversationId]
    );

    if (!conversationResult.rowCount) {
      throw createError("Conversation not found.", 404);
    }

    const conversation = conversationResult.rows[0];

    if (conversation.type !== "group") {
      throw createError(
        "Only group conversations can be renamed."
      );
    }

    if (Number(conversation.created_by) !== Number(userId)) {
      throw createError(
        "Only the group creator can rename this group.",
        403
      );
    }

    const creatorMembership = await client.query(
      `SELECT 1
       FROM chat_conversation_members
       WHERE conversation_id = $1
         AND user_id = $2`,
      [conversationId, userId]
    );

    if (!creatorMembership.rowCount) {
      throw createError(
        "You are no longer a member of this conversation.",
        403
      );
    }

    const result = await client.query(
      `UPDATE chat_conversations
       SET name = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, workspace_id, type, name, created_by, updated_at`,
      [groupName, conversationId]
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}


module.exports = {
  getConversations,
  createConversation,
  getMessages,
  sendMessage,
  markConversationRead,
  editMessage,
  deleteMessage,
  addGroupMembers,
  removeGroupMember,
  renameGroup
};
