-- Question Bank Table
CREATE TABLE IF NOT EXISTS question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  difficulty text CHECK (difficulty IN ('easy','medium','hard')),
  topic text,
  marks integer NOT NULL,
  time_seconds integer NOT NULL,
  type text CHECK (type IN ('mcq','true_false','multiple_select','short_answer','essay')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;

-- Policies for access control
CREATE POLICY "question_bank_select" ON question_bank FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor','student')));

CREATE POLICY "question_bank_insert" ON question_bank FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor')));

CREATE POLICY "question_bank_update" ON question_bank FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor')));

CREATE POLICY "question_bank_delete" ON question_bank FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor')));
