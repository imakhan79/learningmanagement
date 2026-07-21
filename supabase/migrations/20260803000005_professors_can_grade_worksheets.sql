/*
Professors could already SELECT worksheet_submissions for their own courses
("Professors can view submissions for their courses"), but there was no
UPDATE policy for them — so the worksheet grading UI would silently fail to
persist score/feedback. Mirrors the equivalent assignment_submissions
"submissions_update_role" professor-scoped UPDATE policy.
*/
DROP POLICY IF EXISTS "worksheet_submissions_update_professor" ON worksheet_submissions;
CREATE POLICY "worksheet_submissions_update_professor" ON worksheet_submissions FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM course_materials cm
      JOIN courses c ON c.id = cm.course_id
      WHERE cm.id = worksheet_submissions.material_id AND c.professor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM course_materials cm
      JOIN courses c ON c.id = cm.course_id
      WHERE cm.id = worksheet_submissions.material_id AND c.professor_id = auth.uid()
    )
  );
