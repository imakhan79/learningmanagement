/*
# Assignments Module

1. Overview
Adds a first-class Assignments entity: professors create assignments on their
courses with a due date, max score, and optional rubric; students submit a
file (uploaded to Supabase Storage); professors grade submissions with a
score + feedback.

2. New Tables
- `assignments` — id, course_id, professor_id, title, description, instructions,
  due_date, max_score, rubric (jsonb), status (draft/published/closed).
- `assignment_submissions` — id, assignment_id, student_id, file_url, file_name,
  file_size_bytes, submitted_at, status (submitted/graded/late), score, feedback,
  graded_by, graded_at. One row per (assignment, student) — resubmission updates it.

3. Storage
- Private bucket `assignment-submissions`. Objects stored at
  `{assignment_id}/{student_id}/{filename}`. Students may only write to their
  own folder; reads are allowed for the owning student, the owning course's
  professor, or an admin.

4. Security
- RLS enabled on both tables, following the existing `get_my_role()` /
  course-ownership pattern used throughout the schema.
*/

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  professor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  due_date timestamptz,
  max_score numeric(6,2) NOT NULL DEFAULT 100,
  rubric jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_assignments_professor ON assignments(professor_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);

DROP POLICY IF EXISTS "assignments_select_role" ON assignments;
CREATE POLICY "assignments_select_role" ON assignments FOR SELECT
  TO authenticated USING (
    professor_id = auth.uid()
    OR get_my_role() = 'admin'
    OR (
      status = 'published'
      AND EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = assignments.course_id AND e.student_id = auth.uid() AND e.status = 'active')
    )
  );

DROP POLICY IF EXISTS "assignments_insert_professor" ON assignments;
CREATE POLICY "assignments_insert_professor" ON assignments FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = assignments.course_id AND c.professor_id = auth.uid())
    OR get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "assignments_update_professor" ON assignments;
CREATE POLICY "assignments_update_professor" ON assignments FOR UPDATE
  TO authenticated USING (
    professor_id = auth.uid() OR get_my_role() = 'admin'
  )
  WITH CHECK (
    professor_id = auth.uid() OR get_my_role() = 'admin'
  );

DROP POLICY IF EXISTS "assignments_delete_professor" ON assignments;
CREATE POLICY "assignments_delete_professor" ON assignments FOR DELETE
  TO authenticated USING (
    professor_id = auth.uid() OR get_my_role() = 'admin'
  );

-- Assignment submissions table
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_url text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT '',
  file_size_bytes integer NOT NULL DEFAULT 0,
  submitted_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','graded','late')),
  score numeric(6,2),
  feedback text,
  graded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  graded_at timestamptz,
  UNIQUE (assignment_id, student_id)
);
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON assignment_submissions(student_id);

DROP POLICY IF EXISTS "submissions_select_role" ON assignment_submissions;
CREATE POLICY "submissions_select_role" ON assignment_submissions FOR SELECT
  TO authenticated USING (
    student_id = auth.uid()
    OR get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM assignments a
      JOIN courses c ON c.id = a.course_id
      WHERE a.id = assignment_submissions.assignment_id AND c.professor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "submissions_insert_student" ON assignment_submissions;
CREATE POLICY "submissions_insert_student" ON assignment_submissions FOR INSERT
  TO authenticated WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM assignments a
      JOIN enrollments e ON e.course_id = a.course_id
      WHERE a.id = assignment_submissions.assignment_id AND e.student_id = auth.uid() AND e.status = 'active'
    )
  );

DROP POLICY IF EXISTS "submissions_update_role" ON assignment_submissions;
CREATE POLICY "submissions_update_role" ON assignment_submissions FOR UPDATE
  TO authenticated USING (
    student_id = auth.uid()
    OR get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM assignments a
      JOIN courses c ON c.id = a.course_id
      WHERE a.id = assignment_submissions.assignment_id AND c.professor_id = auth.uid()
    )
  )
  WITH CHECK (
    student_id = auth.uid()
    OR get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM assignments a
      JOIN courses c ON c.id = a.course_id
      WHERE a.id = assignment_submissions.assignment_id AND c.professor_id = auth.uid()
    )
  );

-- Storage bucket for assignment submissions (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('assignment-submissions', 'assignment-submissions', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "assignment_submissions_storage_insert" ON storage.objects;
CREATE POLICY "assignment_submissions_storage_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'assignment-submissions'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "assignment_submissions_storage_select" ON storage.objects;
CREATE POLICY "assignment_submissions_storage_select" ON storage.objects FOR SELECT
  TO authenticated USING (
    bucket_id = 'assignment-submissions'
    AND (
      (storage.foldername(name))[2] = auth.uid()::text
      OR get_my_role() = 'admin'
      OR EXISTS (
        SELECT 1 FROM assignments a
        JOIN courses c ON c.id = a.course_id
        WHERE a.id::text = (storage.foldername(name))[1] AND c.professor_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "assignment_submissions_storage_delete" ON storage.objects;
CREATE POLICY "assignment_submissions_storage_delete" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'assignment-submissions'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
