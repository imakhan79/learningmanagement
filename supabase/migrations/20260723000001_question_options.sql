-- Question Options Table
CREATE TABLE IF NOT EXISTS question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES question_bank(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  is_correct boolean NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE question_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "question_options_select" ON question_options FOR SELECT
  USING (auth.uid() = ANY (SELECT professor_id FROM profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor')));

CREATE POLICY "question_options_insert" ON question_options FOR INSERT
  WITH CHECK (auth.uid() = ANY (SELECT professor_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "question_options_update" ON question_options FOR UPDATE
  USING (auth.uid() = ANY (SELECT professor_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (auth.uid() = ANY (SELECT professor_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "question_options_delete" ON question_options FOR DELETE
  USING (auth.uid() = ANY (SELECT professor_id FROM profiles WHERE id = auth.uid()));
