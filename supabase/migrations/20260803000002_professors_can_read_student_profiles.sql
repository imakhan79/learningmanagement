-- Professors could not see student profiles at all (profiles RLS only allowed
-- self or admin), which silently broke "Assign Students" and any joined
-- student-name lookup (grading, submissions) for the professor role.
DROP POLICY IF EXISTS "profiles_select_students_by_professor" ON profiles;
CREATE POLICY "profiles_select_students_by_professor" ON profiles FOR SELECT
  TO authenticated USING (
    role = 'student' AND get_my_role() = 'professor'
  );
