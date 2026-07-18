-- Exam Templates Table
CREATE TABLE IF NOT EXISTS exam_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  total_marks integer NOT NULL,
  duration_seconds integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE exam_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exam_templates_select" ON exam_templates FOR SELECT
  USING (auth.uid() = ANY (SELECT professor_id FROM profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor')));

CREATE POLICY "exam_templates_insert" ON exam_templates FOR INSERT
  WITH CHECK (auth.uid() = ANY (SELECT professor_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "exam_templates_update" ON exam_templates FOR UPDATE
  USING (auth.uid() = ANY (SELECT professor_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (auth.uid() = ANY (SELECT professor_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "exam_templates_delete" ON exam_templates FOR DELETE
  USING (auth.uid() = ANY (SELECT professor_id FROM profiles WHERE id = auth.uid()));
