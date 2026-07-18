
CREATE TABLE IF NOT EXISTS exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid REFERENCES exams(id) ON DELETE CASCADE,
  student_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  status text CHECK (status IN ('in_progress','submitted','graded')) DEFAULT 'in_progress',
  score numeric(5,2),
  total_marks integer,
  time_spent_seconds integer DEFAULT 0,
  auto_evaluated boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attempts_select" ON exam_attempts;
CREATE POLICY "attempts_select" ON exam_attempts FOR SELECT
  USING (
    auth.uid() = student_id OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor'))
  );

DROP POLICY IF EXISTS "attempts_insert" ON exam_attempts;
CREATE POLICY "attempts_insert" ON exam_attempts FOR INSERT
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "attempts_update" ON exam_attempts;
CREATE POLICY "attempts_update" ON exam_attempts FOR UPDATE
  USING (
    auth.uid() = student_id OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor'))
  )
  WITH CHECK (
    auth.uid() = student_id OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor'))
  );

CREATE INDEX IF NOT EXISTS idx_attempts_student ON exam_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_exam ON exam_attempts(exam_id);


CREATE TABLE IF NOT EXISTS exam_responses (
  attempt_id uuid REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id uuid REFERENCES question_bank(id) ON DELETE RESTRICT,
  answer_text text,
  selected_option_ids uuid[],
  is_correct boolean,
  marks_awarded numeric(5,2),
  graded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  graded_at timestamptz,
  PRIMARY KEY (attempt_id, question_id)
);

ALTER TABLE exam_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "responses_select" ON exam_responses;
CREATE POLICY "responses_select" ON exam_responses FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM exam_attempts ea WHERE ea.id = attempt_id AND ea.student_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor'))
  );

DROP POLICY IF EXISTS "responses_insert" ON exam_responses;
CREATE POLICY "responses_insert" ON exam_responses FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM exam_attempts ea WHERE ea.id = attempt_id AND ea.student_id = auth.uid())
  );

DROP POLICY IF EXISTS "responses_update" ON exam_responses;
CREATE POLICY "responses_update" ON exam_responses FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM exam_attempts ea WHERE ea.id = attempt_id AND ea.student_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM exam_attempts ea WHERE ea.id = attempt_id AND ea.student_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor'))
  );

CREATE INDEX IF NOT EXISTS idx_responses_attempt ON exam_responses(attempt_id);
