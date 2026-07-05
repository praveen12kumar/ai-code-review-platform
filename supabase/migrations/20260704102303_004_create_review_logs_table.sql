CREATE TABLE IF NOT EXISTS review_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_logs_review ON review_logs(review_id);
CREATE INDEX IF NOT EXISTS idx_review_logs_created ON review_logs(review_id, created_at);

ALTER TABLE review_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_review_logs" ON review_logs;
CREATE POLICY "users_read_own_review_logs" ON review_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM reviews
      JOIN projects ON projects.id = reviews.project_id
      WHERE reviews.id = review_logs.review_id AND projects.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "users_insert_own_review_logs" ON review_logs;
CREATE POLICY "users_insert_own_review_logs" ON review_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reviews
      JOIN projects ON projects.id = reviews.project_id
      WHERE reviews.id = review_logs.review_id AND projects.owner_id = auth.uid()
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE review_logs;
