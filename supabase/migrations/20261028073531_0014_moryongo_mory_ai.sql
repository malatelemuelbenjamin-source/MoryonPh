/*
# MoryonGo Feature #14 — Mory AI Commuter Assistant

1. New Tables
- `mory_ai_conversations` — conversation container for the AI assistant chat.
  Owner-scoped for authenticated users. No API secrets stored.
- `mory_ai_messages` — individual messages (user/assistant) within a
  conversation. Includes referenced_record_ids for linking to routes,
  fares, locations, etc. No hidden reasoning or credentials stored.

2. Security
- Both tables have RLS enabled.
- Owner-scoped CRUD: each authenticated user only sees their own
  conversations and messages. user_id defaults to auth.uid().
- service_role grant on both tables for the edge function to persist
  messages on behalf of users.
- No anon grants — conversations require authentication.

3. Indexes
- mory_ai_conversations: user_id, created_at.
- mory_ai_messages: conversation_id, created_at.
*/

-- =========================================================
-- MORY_AI_CONVERSATIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS mory_ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_archived boolean NOT NULL DEFAULT false
);

ALTER TABLE mory_ai_conversations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON mory_ai_conversations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON mory_ai_conversations TO service_role;

DROP POLICY IF EXISTS "select_own_conversations" ON mory_ai_conversations;
CREATE POLICY "select_own_conversations" ON mory_ai_conversations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_conversations" ON mory_ai_conversations;
CREATE POLICY "insert_own_conversations" ON mory_ai_conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_conversations" ON mory_ai_conversations;
CREATE POLICY "update_own_conversations" ON mory_ai_conversations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_conversations" ON mory_ai_conversations;
CREATE POLICY "delete_own_conversations" ON mory_ai_conversations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_mac_user ON mory_ai_conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_mac_created ON mory_ai_conversations (created_at DESC);

DROP TRIGGER IF EXISTS trg_mac_updated ON mory_ai_conversations;
CREATE TRIGGER trg_mac_updated BEFORE UPDATE ON mory_ai_conversations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- MORY_AI_MESSAGES
-- =========================================================
CREATE TABLE IF NOT EXISTS mory_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES mory_ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  referenced_record_ids jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE mory_ai_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON mory_ai_messages TO authenticated;
GRANT INSERT ON mory_ai_messages TO service_role;

DROP POLICY IF EXISTS "select_own_messages" ON mory_ai_messages;
CREATE POLICY "select_own_messages" ON mory_ai_messages FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM mory_ai_conversations c
      WHERE c.id = mory_ai_messages.conversation_id
      AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_messages" ON mory_ai_messages;
CREATE POLICY "insert_own_messages" ON mory_ai_messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM mory_ai_conversations c
      WHERE c.id = mory_ai_messages.conversation_id
      AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_messages" ON mory_ai_messages;
CREATE POLICY "delete_own_messages" ON mory_ai_messages FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM mory_ai_conversations c
      WHERE c.id = mory_ai_messages.conversation_id
      AND c.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_mam_conversation ON mory_ai_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_mam_created ON mory_ai_messages (created_at);
