-- Phase 5: indexes for Message inbox, sent, and unread queries
CREATE INDEX "messages_to_user_id_created_at_idx"  ON "messages"("to_user_id", "created_at" DESC);
CREATE INDEX "messages_from_user_id_created_at_idx" ON "messages"("from_user_id", "created_at" DESC);
CREATE INDEX "messages_to_user_id_is_read_idx"     ON "messages"("to_user_id", "is_read");
