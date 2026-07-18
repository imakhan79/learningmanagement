-- Lecture Activity Tracking Table and RLS Policies
CREATE TABLE IF NOT EXISTS lecture_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lecture_id uuid NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now(),
  last_position integer DEFAULT 0,           -- seconds into the video
  total_watch_seconds integer DEFAULT 0,
  pause_count integer DEFAULT 0,
  resume_count integer DEFAULT 0,
  bookmark_count integer DEFAULT 0,
  completed_at timestamptz,
  completion_percentage numeric(5,2) DEFAULT 0,
  CONSTRAINT uq_user_lecture UNIQUE (user_id, lecture_id)
);

ALTER TABLE lecture_activity ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "lecture_activity_select" ON lecture_activity;
CREATE POLICY "lecture_activity_select" ON lecture_activity FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor')));

DROP POLICY IF EXISTS "lecture_activity_insert" ON lecture_activity;
CREATE POLICY "lecture_activity_insert" ON lecture_activity FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "lecture_activity_update" ON lecture_activity;
CREATE POLICY "lecture_activity_update" ON lecture_activity FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for fast look‑ups
CREATE INDEX IF NOT EXISTS idx_lecture_activity_user ON lecture_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_lecture_activity_lecture ON lecture_activity(lecture_id);
