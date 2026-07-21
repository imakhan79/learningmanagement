/*
# Student Portal Extensions

Fills schema gaps required for a fully functional student portal. Several of
these tables (lecture_attendance, login_events) already existed in the live
database with a narrower shape than the app code expected, so this migration
uses defensive ALTERs rather than assuming a fresh CREATE.

1. lecture_attendance — add course_id + attendance_date, auto-populate via a
   trigger on lecture_progress when a student crosses the 90% completion mark.
2. bookmarks — allow bookmarking a course_material (PDF/note/book), not just a lecture.
3. lecture_ratings — new table for student like/rating on a lecture.
4. worksheet_submissions — add online answer content, draft status, score/feedback.
*/

-- ── lecture_attendance ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lecture_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  lecture_id uuid NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','late')),
  attended_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lecture_id, student_id)
);
ALTER TABLE lecture_attendance ENABLE ROW LEVEL SECURITY;

ALTER TABLE lecture_attendance ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES courses(id) ON DELETE CASCADE;
ALTER TABLE lecture_attendance ADD COLUMN IF NOT EXISTS attendance_date date NOT NULL DEFAULT CURRENT_DATE;
UPDATE lecture_attendance la SET course_id = l.course_id FROM lectures l WHERE la.lecture_id = l.id AND la.course_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_lecture_attendance_student ON lecture_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_lecture_attendance_course ON lecture_attendance(course_id);
CREATE INDEX IF NOT EXISTS idx_lecture_attendance_date ON lecture_attendance(attendance_date);

DROP POLICY IF EXISTS "lecture_attendance_select" ON lecture_attendance;
CREATE POLICY "lecture_attendance_select" ON lecture_attendance FOR SELECT
  TO authenticated USING (student_id = auth.uid() OR get_my_role() = 'admin');

DROP POLICY IF EXISTS "lecture_attendance_insert" ON lecture_attendance;
CREATE POLICY "lecture_attendance_insert" ON lecture_attendance FOR INSERT
  TO authenticated WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "lecture_attendance_select_professor" ON lecture_attendance;
CREATE POLICY "lecture_attendance_select_professor" ON lecture_attendance FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM lectures l JOIN courses c ON c.id = l.course_id WHERE l.id = lecture_attendance.lecture_id AND c.professor_id = auth.uid())
  );

-- Auto-record attendance the moment a student crosses the completion threshold
-- on a lecture (VOD attendance model — no separate "check in" action needed).
CREATE OR REPLACE FUNCTION record_lecture_attendance()
RETURNS trigger AS $$
DECLARE
  v_course_id uuid;
BEGIN
  IF NEW.completion_pct >= 90 AND (OLD IS NULL OR OLD.completion_pct < 90) THEN
    SELECT course_id INTO v_course_id FROM lectures WHERE id = NEW.lecture_id;
    IF v_course_id IS NOT NULL THEN
      INSERT INTO lecture_attendance (student_id, lecture_id, course_id, status, attendance_date)
      VALUES (NEW.student_id, NEW.lecture_id, v_course_id, 'present', CURRENT_DATE)
      ON CONFLICT (lecture_id, student_id) DO UPDATE SET status = 'present', course_id = EXCLUDED.course_id, attendance_date = EXCLUDED.attendance_date;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_lecture_progress_attendance ON lecture_progress;
CREATE TRIGGER trg_lecture_progress_attendance
  AFTER INSERT OR UPDATE OF completion_pct ON lecture_progress
  FOR EACH ROW EXECUTE FUNCTION record_lecture_attendance();

-- ── login_events (already existed; ensure it's present for fresh databases) ──
CREATE TABLE IF NOT EXISTS login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  ip_address text DEFAULT '',
  login_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE login_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_login_events_user ON login_events(user_id);
CREATE INDEX IF NOT EXISTS idx_login_events_at ON login_events(login_at);

DROP POLICY IF EXISTS "login_events_select" ON login_events;
CREATE POLICY "login_events_select" ON login_events FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR get_my_role() IN ('admin','professor'));

DROP POLICY IF EXISTS "login_events_insert" ON login_events;
CREATE POLICY "login_events_insert" ON login_events FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

-- ── bookmarks: allow bookmarking a course_material (PDF/note/book), not just a lecture ──
ALTER TABLE bookmarks ALTER COLUMN lecture_id DROP NOT NULL;
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES course_materials(id) ON DELETE CASCADE;

ALTER TABLE bookmarks DROP CONSTRAINT IF EXISTS bookmarks_student_id_lecture_id_key;
DROP INDEX IF EXISTS bookmarks_student_id_lecture_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bookmarks_student_lecture ON bookmarks(student_id, lecture_id) WHERE lecture_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bookmarks_student_material ON bookmarks(student_id, material_id) WHERE material_id IS NOT NULL;

ALTER TABLE bookmarks DROP CONSTRAINT IF EXISTS bookmarks_target_check;
ALTER TABLE bookmarks ADD CONSTRAINT bookmarks_target_check CHECK (lecture_id IS NOT NULL OR material_id IS NOT NULL);

DROP POLICY IF EXISTS "bookmarks_select_own" ON bookmarks;
CREATE POLICY "bookmarks_select_own" ON bookmarks FOR SELECT
  TO authenticated USING (student_id = auth.uid());

DROP POLICY IF EXISTS "bookmarks_insert_own" ON bookmarks;
CREATE POLICY "bookmarks_insert_own" ON bookmarks FOR INSERT
  TO authenticated WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "bookmarks_delete_own" ON bookmarks;
CREATE POLICY "bookmarks_delete_own" ON bookmarks FOR DELETE
  TO authenticated USING (student_id = auth.uid());

-- ── lecture_ratings ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lecture_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  lecture_id uuid NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (student_id, lecture_id)
);
ALTER TABLE lecture_ratings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lecture_ratings_lecture ON lecture_ratings(lecture_id);

DROP POLICY IF EXISTS "lecture_ratings_select_role" ON lecture_ratings;
CREATE POLICY "lecture_ratings_select_role" ON lecture_ratings FOR SELECT
  TO authenticated USING (
    student_id = auth.uid()
    OR get_my_role() = 'admin'
    OR EXISTS (SELECT 1 FROM lectures l JOIN courses c ON c.id = l.course_id WHERE l.id = lecture_ratings.lecture_id AND c.professor_id = auth.uid())
  );

DROP POLICY IF EXISTS "lecture_ratings_insert_own" ON lecture_ratings;
CREATE POLICY "lecture_ratings_insert_own" ON lecture_ratings FOR INSERT
  TO authenticated WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "lecture_ratings_update_own" ON lecture_ratings;
CREATE POLICY "lecture_ratings_update_own" ON lecture_ratings FOR UPDATE
  TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

DROP TRIGGER IF EXISTS trg_lecture_ratings_updated_at ON lecture_ratings;
CREATE TRIGGER trg_lecture_ratings_updated_at BEFORE UPDATE ON lecture_ratings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── worksheet_submissions: online completion + save-progress ──────────────────
ALTER TABLE worksheet_submissions ADD COLUMN IF NOT EXISTS answer_text text NOT NULL DEFAULT '';
ALTER TABLE worksheet_submissions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE worksheet_submissions ADD COLUMN IF NOT EXISTS score numeric(6,2);
ALTER TABLE worksheet_submissions ADD COLUMN IF NOT EXISTS feedback text;

ALTER TABLE worksheet_submissions DROP CONSTRAINT IF EXISTS worksheet_submissions_status_check;
ALTER TABLE worksheet_submissions ADD CONSTRAINT worksheet_submissions_status_check
  CHECK (status IN ('in_progress','submitted','graded'));

DROP POLICY IF EXISTS "Students can update their own submissions" ON worksheet_submissions;
CREATE POLICY "Students can update their own submissions"
  ON worksheet_submissions FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

DROP TRIGGER IF EXISTS trg_worksheet_submissions_updated_at ON worksheet_submissions;
CREATE TRIGGER trg_worksheet_submissions_updated_at BEFORE UPDATE ON worksheet_submissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
