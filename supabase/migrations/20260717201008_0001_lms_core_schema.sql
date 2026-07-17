/*
# LMS Core Schema — Users, Roles, Courses, Lectures, Materials

1. Overview
This migration creates the foundational schema for a Learning Management System
with three roles (admin, professor, student). It establishes:
- A `profiles` table linked 1:1 to `auth.users` carrying role + status metadata.
- A `courses` table with categories, approval workflow, and archive support.
- A `lectures` table per course with publish dates and learning objectives.
- A `course_materials` table for video/PDF/book/note/worksheet attachments.
- An `enrollments` table linking students to courses.
- A `bookmarks` table for student lecture bookmarks.
- A `lecture_progress` table tracking per-student per-lecture watch state.
- A `watch_events` table capturing granular playback events.

2. New Tables
- `profiles` — extends auth.users with role (admin/professor/student), full_name, status, avatar_url, created_at, updated_at.
- `courses` — id, title, description, category, professor_id, status (draft/pending/approved/published/archived), created_at, updated_at.
- `lectures` — id, course_id, title, description, duration_seconds, learning_objectives, publish_date, order_index, created_at, updated_at.
- `course_materials` — id, lecture_id (nullable), course_id, type (video/pdf/book/note/worksheet), title, url, size_bytes, duration_seconds (for video), created_at.
- `enrollments` — id, course_id, student_id, enrolled_at, status (active/completed/withdrawn), progress_pct.
- `bookmarks` — id, student_id, lecture_id, created_at.
- `lecture_progress` — id, student_id, lecture_id, last_position_seconds, completion_pct, total_watch_seconds, pause_count, resume_count, started_at, last_viewed_at, completed_at.
- `watch_events` — id, student_id, lecture_id, event_type (start/pause/resume/complete/seek), position_seconds, created_at.

3. Security
- RLS enabled on every table.
- Profiles: users read/update own; admins read/update all (via service role in edge functions; RLS allows self-access).
- Courses: professors CRUD own; students read approved/published; admins read all.
- Lectures/materials: professors CRUD own course's; students read enrolled course's.
- Enrollments: students read own; professors read own course's; admins read all.
- Bookmarks/progress/watch_events: students CRUD own; professors read own course's students' data; admins read all.

4. Notes
- `profiles.role` defaults to 'student'. Role stored in profiles table (not JWT app metadata) for simplicity.
- Owner columns default to `auth.uid()` where the row owner is the authenticated user.
- `professor_id` on courses is the course owner (professor who created it).
- Indexes added for frequent query paths.
*/

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('admin','professor','student')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended','pending_activation')),
  avatar_url text DEFAULT '',
  phone text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
CREATE POLICY "profiles_select_own_or_admin" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
CREATE POLICY "profiles_insert_self" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'General',
  professor_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','published','archived')),
  thumbnail_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_courses_professor ON courses(professor_id);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);

DROP POLICY IF EXISTS "courses_select_role" ON courses;
CREATE POLICY "courses_select_role" ON courses FOR SELECT
  TO authenticated USING (
    professor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR status IN ('approved','published')
  );

DROP POLICY IF EXISTS "courses_insert_professor" ON courses;
CREATE POLICY "courses_insert_professor" ON courses FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('professor','admin'))
  );

DROP POLICY IF EXISTS "courses_update_owner_admin" ON courses;
CREATE POLICY "courses_update_owner_admin" ON courses FOR UPDATE
  TO authenticated USING (professor_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('professor','admin')));

DROP POLICY IF EXISTS "courses_delete_owner_admin" ON courses;
CREATE POLICY "courses_delete_owner_admin" ON courses FOR DELETE
  TO authenticated USING (professor_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Lectures table
CREATE TABLE IF NOT EXISTS lectures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  duration_seconds integer NOT NULL DEFAULT 0,
  learning_objectives text NOT NULL DEFAULT '',
  publish_date timestamptz DEFAULT now(),
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE lectures ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lectures_course ON lectures(course_id);
CREATE INDEX IF NOT EXISTS idx_lectures_publish_date ON lectures(publish_date);

DROP POLICY IF EXISTS "lectures_select_role" ON lectures;
CREATE POLICY "lectures_select_role" ON lectures FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = lectures.course_id AND c.professor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR EXISTS (SELECT 1 FROM courses c WHERE c.id = lectures.course_id AND c.status IN ('approved','published'))
  );

DROP POLICY IF EXISTS "lectures_insert_professor" ON lectures;
CREATE POLICY "lectures_insert_professor" ON lectures FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = lectures.course_id AND c.professor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "lectures_update_professor" ON lectures;
CREATE POLICY "lectures_update_professor" ON lectures FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = lectures.course_id AND c.professor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "lectures_delete_professor" ON lectures;
CREATE POLICY "lectures_delete_professor" ON lectures FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = lectures.course_id AND c.professor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Course materials table
CREATE TABLE IF NOT EXISTS course_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lecture_id uuid REFERENCES lectures(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('video','pdf','book','note','worksheet')),
  title text NOT NULL,
  url text NOT NULL,
  size_bytes bigint DEFAULT 0,
  duration_seconds integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE course_materials ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_materials_course ON course_materials(course_id);
CREATE INDEX IF NOT EXISTS idx_materials_lecture ON course_materials(lecture_id);
CREATE INDEX IF NOT EXISTS idx_materials_type ON course_materials(type);

DROP POLICY IF EXISTS "materials_select_role" ON course_materials;
CREATE POLICY "materials_select_role" ON course_materials FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = course_materials.course_id AND c.professor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR EXISTS (SELECT 1 FROM courses c WHERE c.id = course_materials.course_id AND c.status IN ('approved','published'))
  );

DROP POLICY IF EXISTS "materials_insert_professor" ON course_materials;
CREATE POLICY "materials_insert_professor" ON course_materials FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = course_materials.course_id AND c.professor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "materials_update_professor" ON course_materials;
CREATE POLICY "materials_update_professor" ON course_materials FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = course_materials.course_id AND c.professor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "materials_delete_professor" ON course_materials;
CREATE POLICY "materials_delete_professor" ON course_materials FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = course_materials.course_id AND c.professor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','withdrawn')),
  progress_pct numeric(5,2) DEFAULT 0,
  enrolled_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (course_id, student_id)
);
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);

DROP POLICY IF EXISTS "enrollments_select_role" ON enrollments;
CREATE POLICY "enrollments_select_role" ON enrollments FOR SELECT
  TO authenticated USING (
    student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM courses c WHERE c.id = enrollments.course_id AND c.professor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "enrollments_insert_professor_admin_self" ON enrollments;
CREATE POLICY "enrollments_insert_professor_admin_self" ON enrollments FOR INSERT
  TO authenticated WITH CHECK (
    student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM courses c WHERE c.id = enrollments.course_id AND c.professor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "enrollments_update_professor_admin_self" ON enrollments;
CREATE POLICY "enrollments_update_professor_admin_self" ON enrollments FOR UPDATE
  TO authenticated USING (
    student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM courses c WHERE c.id = enrollments.course_id AND c.professor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (true);

DROP POLICY IF EXISTS "enrollments_delete_admin_professor" ON enrollments;
CREATE POLICY "enrollments_delete_admin_professor" ON enrollments FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = enrollments.course_id AND c.professor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  lecture_id uuid NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (student_id, lecture_id)
);
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_bookmarks_student ON bookmarks(student_id);

DROP POLICY IF EXISTS "bookmarks_select_own" ON bookmarks;
CREATE POLICY "bookmarks_select_own" ON bookmarks FOR SELECT
  TO authenticated USING (student_id = auth.uid());

DROP POLICY IF EXISTS "bookmarks_insert_own" ON bookmarks;
CREATE POLICY "bookmarks_insert_own" ON bookmarks FOR INSERT
  TO authenticated WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "bookmarks_delete_own" ON bookmarks;
CREATE POLICY "bookmarks_delete_own" ON bookmarks FOR DELETE
  TO authenticated USING (student_id = auth.uid());

-- Lecture progress table
CREATE TABLE IF NOT EXISTS lecture_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  lecture_id uuid NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  last_position_seconds integer NOT NULL DEFAULT 0,
  completion_pct numeric(5,2) NOT NULL DEFAULT 0,
  total_watch_seconds integer NOT NULL DEFAULT 0,
  pause_count integer NOT NULL DEFAULT 0,
  resume_count integer NOT NULL DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  last_viewed_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (student_id, lecture_id)
);
ALTER TABLE lecture_progress ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_progress_student ON lecture_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_progress_lecture ON lecture_progress(lecture_id);
CREATE INDEX IF NOT EXISTS idx_progress_completed ON lecture_progress(completed_at);

DROP POLICY IF EXISTS "progress_select_role" ON lecture_progress;
CREATE POLICY "progress_select_role" ON lecture_progress FOR SELECT
  TO authenticated USING (
    student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM lectures l WHERE l.id = lecture_progress.lecture_id AND EXISTS (SELECT 1 FROM courses c WHERE c.id = l.course_id AND c.professor_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "progress_insert_own" ON lecture_progress;
CREATE POLICY "progress_insert_own" ON lecture_progress FOR INSERT
  TO authenticated WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "progress_update_own" ON lecture_progress;
CREATE POLICY "progress_update_own" ON lecture_progress FOR UPDATE
  TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "progress_delete_own" ON lecture_progress;
CREATE POLICY "progress_delete_own" ON lecture_progress FOR DELETE
  TO authenticated USING (student_id = auth.uid());

-- Watch events table
CREATE TABLE IF NOT EXISTS watch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  lecture_id uuid NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('start','pause','resume','complete','seek')),
  position_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE watch_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_watch_events_student ON watch_events(student_id);
CREATE INDEX IF NOT EXISTS idx_watch_events_lecture ON watch_events(lecture_id);
CREATE INDEX IF NOT EXISTS idx_watch_events_created ON watch_events(created_at);

DROP POLICY IF EXISTS "watch_events_select_role" ON watch_events;
CREATE POLICY "watch_events_select_role" ON watch_events FOR SELECT
  TO authenticated USING (
    student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM lectures l WHERE l.id = watch_events.lecture_id AND EXISTS (SELECT 1 FROM courses c WHERE c.id = l.course_id AND c.professor_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "watch_events_insert_own" ON watch_events;
CREATE POLICY "watch_events_insert_own" ON watch_events FOR INSERT
  TO authenticated WITH CHECK (student_id = auth.uid());

-- Helper: updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_courses_updated_at ON courses;
CREATE TRIGGER trg_courses_updated_at BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_lectures_updated_at ON lectures;
CREATE TRIGGER trg_lectures_updated_at BEFORE UPDATE ON lectures
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
