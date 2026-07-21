-- Students could never actually take an exam: question_bank RLS only allowed
-- admin/professor to SELECT, so the nested question_bank join used when
-- fetching exam_questions (and question_bank(*) in exam_responses reviews)
-- always came back null for students, crashing TakeExam/ExamResult.
DROP POLICY IF EXISTS "qb_select_student_via_published_exam" ON question_bank;
CREATE POLICY "qb_select_student_via_published_exam" ON question_bank FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM exam_questions eq
      JOIN exams e ON e.id = eq.exam_id
      JOIN enrollments en ON en.course_id = e.course_id
      WHERE eq.question_id = question_bank.id
        AND e.status = 'published'
        AND en.student_id = auth.uid()
    )
  );
