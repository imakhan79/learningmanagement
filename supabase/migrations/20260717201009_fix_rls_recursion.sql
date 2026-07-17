-- Fix infinite recursion in profiles RLS policy.
-- The old policy queried profiles to check if the user is admin,
-- which recursively triggered the same policy.
-- Solution: use auth.jwt() to read role from the JWT claims, or
-- use a security definer function to break the recursion.

-- Drop the recursive policy
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;

-- Create a SECURITY DEFINER function that reads role without triggering RLS
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Recreate the select policy using the function (no recursion)
CREATE POLICY "profiles_select_own_or_admin" ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR get_my_role() = 'admin');

-- Also fix the courses / other policies that have the same recursion pattern
DROP POLICY IF EXISTS "courses_select_role" ON courses;
CREATE POLICY "courses_select_role" ON courses FOR SELECT
  TO authenticated USING (
    professor_id = auth.uid()
    OR get_my_role() = 'admin'
    OR status IN ('approved','published')
  );

DROP POLICY IF EXISTS "courses_insert_professor" ON courses;
CREATE POLICY "courses_insert_professor" ON courses FOR INSERT
  TO authenticated WITH CHECK (
    get_my_role() IN ('professor','admin')
  );

DROP POLICY IF EXISTS "courses_update_owner_admin" ON courses;
CREATE POLICY "courses_update_owner_admin" ON courses FOR UPDATE
  TO authenticated
  USING (professor_id = auth.uid() OR get_my_role() = 'admin')
  WITH CHECK (get_my_role() IN ('professor','admin'));

DROP POLICY IF EXISTS "courses_delete_owner_admin" ON courses;
CREATE POLICY "courses_delete_owner_admin" ON courses FOR DELETE
  TO authenticated USING (professor_id = auth.uid() OR get_my_role() = 'admin');

-- lectures
DROP POLICY IF EXISTS "lectures_select_role" ON lectures;
CREATE POLICY "lectures_select_role" ON lectures FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = lectures.course_id AND c.professor_id = auth.uid())
    OR get_my_role() = 'admin'
    OR EXISTS (SELECT 1 FROM courses c WHERE c.id = lectures.course_id AND c.status IN ('approved','published'))
  );

DROP POLICY IF EXISTS "lectures_insert_professor" ON lectures;
CREATE POLICY "lectures_insert_professor" ON lectures FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = lectures.course_id AND c.professor_id = auth.uid())
    OR get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "lectures_update_professor" ON lectures;
CREATE POLICY "lectures_update_professor" ON lectures FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = lectures.course_id AND c.professor_id = auth.uid())
    OR get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "lectures_delete_professor" ON lectures;
CREATE POLICY "lectures_delete_professor" ON lectures FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = lectures.course_id AND c.professor_id = auth.uid())
    OR get_my_role() = 'admin'
  );

-- course_materials
DROP POLICY IF EXISTS "materials_select_role" ON course_materials;
CREATE POLICY "materials_select_role" ON course_materials FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = course_materials.course_id AND c.professor_id = auth.uid())
    OR get_my_role() = 'admin'
    OR EXISTS (SELECT 1 FROM courses c WHERE c.id = course_materials.course_id AND c.status IN ('approved','published'))
  );

DROP POLICY IF EXISTS "materials_insert_professor" ON course_materials;
CREATE POLICY "materials_insert_professor" ON course_materials FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = course_materials.course_id AND c.professor_id = auth.uid())
    OR get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "materials_update_professor" ON course_materials;
CREATE POLICY "materials_update_professor" ON course_materials FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = course_materials.course_id AND c.professor_id = auth.uid())
    OR get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "materials_delete_professor" ON course_materials;
CREATE POLICY "materials_delete_professor" ON course_materials FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = course_materials.course_id AND c.professor_id = auth.uid())
    OR get_my_role() = 'admin'
  );

-- enrollments
DROP POLICY IF EXISTS "enrollments_select_role" ON enrollments;
CREATE POLICY "enrollments_select_role" ON enrollments FOR SELECT
  TO authenticated USING (
    student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM courses c WHERE c.id = enrollments.course_id AND c.professor_id = auth.uid())
    OR get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "enrollments_insert_professor_admin_self" ON enrollments;
CREATE POLICY "enrollments_insert_professor_admin_self" ON enrollments FOR INSERT
  TO authenticated WITH CHECK (
    student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM courses c WHERE c.id = enrollments.course_id AND c.professor_id = auth.uid())
    OR get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "enrollments_update_professor_admin_self" ON enrollments;
CREATE POLICY "enrollments_update_professor_admin_self" ON enrollments FOR UPDATE
  TO authenticated USING (
    student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM courses c WHERE c.id = enrollments.course_id AND c.professor_id = auth.uid())
    OR get_my_role() = 'admin'
  ) WITH CHECK (true);

DROP POLICY IF EXISTS "enrollments_delete_admin_professor" ON enrollments;
CREATE POLICY "enrollments_delete_admin_professor" ON enrollments FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = enrollments.course_id AND c.professor_id = auth.uid())
    OR get_my_role() = 'admin'
  );

-- lecture_progress
DROP POLICY IF EXISTS "progress_select_role" ON lecture_progress;
CREATE POLICY "progress_select_role" ON lecture_progress FOR SELECT
  TO authenticated USING (
    student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM lectures l WHERE l.id = lecture_progress.lecture_id AND EXISTS (SELECT 1 FROM courses c WHERE c.id = l.course_id AND c.professor_id = auth.uid()))
    OR get_my_role() = 'admin'
  );

-- watch_events
DROP POLICY IF EXISTS "watch_events_select_role" ON watch_events;
CREATE POLICY "watch_events_select_role" ON watch_events FOR SELECT
  TO authenticated USING (
    student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM lectures l WHERE l.id = watch_events.lecture_id AND EXISTS (SELECT 1 FROM courses c WHERE c.id = l.course_id AND c.professor_id = auth.uid()))
    OR get_my_role() = 'admin'
  );
