-- Student Analytics Table
CREATE TABLE IF NOT EXISTS student_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  attendance_count integer DEFAULT 0,
  total_lectures integer DEFAULT 0,
  lecture_completion_pct numeric(5,2) DEFAULT 0,
  total_watch_seconds bigint DEFAULT 0,
  quiz_attempts integer DEFAULT 0,
  avg_quiz_score numeric(5,2) DEFAULT 0,
  exam_score numeric(5,2) DEFAULT 0,
  assignment_completion_pct numeric(5,2) DEFAULT 0,
  login_count_daily integer DEFAULT 0,
  login_count_weekly integer DEFAULT 0,
  last_active timestamptz,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE student_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_analytics_select" ON student_analytics;
CREATE POLICY "student_analytics_select" ON student_analytics FOR SELECT
  USING (auth.uid() = student_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor')));

DROP POLICY IF EXISTS "student_analytics_insert" ON student_analytics;
CREATE POLICY "student_analytics_insert" ON student_analytics FOR INSERT
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "student_analytics_update" ON student_analytics;
CREATE POLICY "student_analytics_update" ON student_analytics FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE INDEX IF NOT EXISTS idx_student_analytics_student ON student_analytics(student_id);
CREATE INDEX IF NOT EXISTS idx_student_analytics_course ON student_analytics(course_id);
