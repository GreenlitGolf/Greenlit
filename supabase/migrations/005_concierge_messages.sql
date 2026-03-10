-- ─── Concierge Messages ───────────────────────────────────────────────────────
-- Persists the concierge chat history so it survives navigation and page reloads.

CREATE TABLE IF NOT EXISTS concierge_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS concierge_messages_trip_created_idx
  ON concierge_messages(trip_id, created_at ASC);

-- RLS: trip members can read and write their own trip's messages
ALTER TABLE concierge_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view concierge messages"
  ON concierge_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = concierge_messages.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can insert concierge messages"
  ON concierge_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = concierge_messages.trip_id
        AND trip_members.user_id = auth.uid()
    )
  );
