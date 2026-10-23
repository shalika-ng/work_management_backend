
exports.up = (pgm) => {
  // 1. Store direct and group conversations
  pgm.createTable("chat_conversations", {
    id: {
      type: "serial",
      primaryKey: true,
    },
    workspace_id: {
      type: "integer",
      notNull: true,
      references: "workspaces",
      onDelete: "CASCADE",
    },
    type: {
      type: "varchar(10)",
      notNull: true,
      check: "type IN ('direct', 'group')",
    },
    name: {
      type: "varchar(150)",
    },
    created_by: {
      type: "integer",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },
    created_at: {
      type: "timestamp with time zone",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
    updated_at: {
      type: "timestamp with time zone",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });

  // 2. Track the users participating in each conversation
  pgm.createTable("chat_conversation_members", {
    id: {
      type: "serial",
      primaryKey: true,
    },
    conversation_id: {
      type: "integer",
      notNull: true,
      references: "chat_conversations",
      onDelete: "CASCADE",
    },
    user_id: {
      type: "integer",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },
    joined_at: {
      type: "timestamp with time zone",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
    last_read_at: {
      type: "timestamp with time zone",
    },
  });

  pgm.addConstraint(
    "chat_conversation_members",
    "chat_conversation_members_conversation_user_unique",
    {
      unique: ["conversation_id", "user_id"],
    }
  );

  // 3. Store messages
  pgm.createTable("chat_messages", {
    id: {
      type: "bigserial",
      primaryKey: true,
    },
    conversation_id: {
      type: "integer",
      notNull: true,
      references: "chat_conversations",
      onDelete: "CASCADE",
    },
    sender_id: {
      type: "integer",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },
    content: {
      type: "text",
      notNull: true,
      check: "length(trim(content)) > 0",
    },
    created_at: {
      type: "timestamp with time zone",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
    edited_at: {
      type: "timestamp with time zone",
    },
    deleted_at: {
      type: "timestamp with time zone",
    },
  });

  // Indexes for conversation and message lookups
  pgm.createIndex(
    "chat_conversation_members",
    ["user_id", "conversation_id"]
  );

  pgm.createIndex(
    "chat_messages",
    ["conversation_id", "id"]
  );

  pgm.createIndex(
    "workspace_members",
    ["workspace_id", "user_id", "status"]
  );
};

exports.down = (pgm) => {
  // Drop chat tables in dependency order
  pgm.dropTable("chat_messages");
  pgm.dropTable("chat_conversation_members");
  pgm.dropTable("chat_conversations");

  // Remove only the index created by this migration
  pgm.dropIndex(
    "workspace_members",
    ["workspace_id", "user_id", "status"]
  );
};
