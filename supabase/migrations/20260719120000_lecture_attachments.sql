-- Lecture Attachments
CREATE TABLE IF NOT EXISTS lecture_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lecture_id uuid NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('video','pdf','book','worksheet','reference')),
  url text NOT NULL,
  title text NOT NULL,
  size_bytes bigint DEFAULT 0,
  duration_seconds integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lecture_attachments ENABLE ROW LEVEL SECURITY;

-- Policies for lecture_attachments
DROP POLICY IF EXISTS "lecture_attachments_select" ON lecture_attachments;
CREATE POLICY "lecture_attachments_select" ON lecture_attachments FOR SELECT
    TO authenticated USING (
      EXISTS (
        SELECT 1 FROM lectures l
        JOIN courses c ON l.course_id = c.id
        WHERE l.id = lecture_attachments.lecture_id
          AND c.professor_id = auth.uid()
      )
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      OR EXISTS (
        SELECT 1 FROM enrollments e
        JOIN courses c ON e.course_id = c.id
        JOIN lectures l ON l.course_id = c.id
        WHERE l.id = lecture_attachments.lecture_id
          AND e.student_id = auth.uid()
      )
    );

DROP POLICY IF EXISTS "lecture_attachments_insert" ON lecture_attachments;
CREATE POLICY "lecture_attachments_insert" ON lecture_attachments FOR INSERT
    TO authenticated WITH CHECK (
      EXISTS (
        SELECT 1 FROM lectures l
        JOIN courses c ON l.course_id = c.id
        WHERE l.id = lecture_attachments.lecture_id
          AND c.professor_id = auth.uid()
      )
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

DROP POLICY IF EXISTS "lecture_attachments_update" ON lecture_attachments;
CREATE POLICY "lecture_attachments_update" ON lecture_attachments FOR UPDATE
    TO authenticated USING (
      EXISTS (
        SELECT 1 FROM lectures l
        JOIN courses c ON l.course_id = c.id
        WHERE l.id = lecture_attachments.lecture_id
          AND c.professor_id = auth.uid()
      )
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    ) WITH CHECK (
      EXISTS (
        SELECT 1 FROM lectures l
        JOIN courses c ON l.course_id = c.id
        WHERE l.id = lecture_attachments.lecture_id
          AND c.professor_id = auth.uid()
      )
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

DROP POLICY IF EXISTS "lecture_attachments_delete" ON lecture_attachments;
CREATE POLICY "lecture_attachments_delete" ON lecture_attachments FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM lectures l
      JOIN courses c ON l.course_id = c.id
      WHERE l.id = lecture_attachments.lecture_id
        AND c.professor_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lecture_attachments_lecture ON lecture_attachments(lecture_id);
CREATE INDEX IF NOT EXISTS idx_lecture_attachments_type ON lecture_attachments(type);
