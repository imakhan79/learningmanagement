
CREATE TABLE IF NOT EXISTS exam_template_questions (
  template_id uuid REFERENCES exam_templates(id) ON DELETE CASCADE,
  question_id uuid REFERENCES question_bank(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1,
  PRIMARY KEY (template_id, question_id)
);

ALTER TABLE exam_template_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "etq_select" ON exam_template_questions;
CREATE POLICY "etq_select" ON exam_template_questions FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor')));

DROP POLICY IF EXISTS "etq_insert" ON exam_template_questions;
CREATE POLICY "etq_insert" ON exam_template_questions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor')));

DROP POLICY IF EXISTS "etq_delete" ON exam_template_questions;
CREATE POLICY "etq_delete" ON exam_template_questions FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor')));


CREATE TABLE IF NOT EXISTS exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES exam_templates(id) ON DELETE SET NULL,
  professor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  duration_seconds integer NOT NULL,
  pass_marks integer DEFAULT 0,
  shuffle_questions boolean DEFAULT true,
  shuffle_options boolean DEFAULT true,
  allow_resume boolean DEFAULT false,
  auto_evaluate boolean DEFAULT true,
  start_time timestamptz,
  end_time timestamptz,
  status text CHECK (status IN ('draft','published','closed')) DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exams_select_all" ON exams;
CREATE POLICY "exams_select_all" ON exams FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor','student')));

DROP POLICY IF EXISTS "exams_insert" ON exams;
CREATE POLICY "exams_insert" ON exams FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor')));

DROP POLICY IF EXISTS "exams_update" ON exams;
CREATE POLICY "exams_update" ON exams FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor')));

DROP POLICY IF EXISTS "exams_delete" ON exams;
CREATE POLICY "exams_delete" ON exams FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor')));


CREATE TABLE IF NOT EXISTS exam_questions (
  exam_id uuid REFERENCES exams(id) ON DELETE CASCADE,
  question_id uuid REFERENCES question_bank(id) ON DELETE RESTRICT,
  order_index integer NOT NULL,
  PRIMARY KEY (exam_id, question_id)
);

ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exam_questions_select" ON exam_questions;
CREATE POLICY "exam_questions_select" ON exam_questions FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor','student')));

DROP POLICY IF EXISTS "exam_questions_insert" ON exam_questions;
CREATE POLICY "exam_questions_insert" ON exam_questions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor')));

CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON exam_questions(exam_id);
