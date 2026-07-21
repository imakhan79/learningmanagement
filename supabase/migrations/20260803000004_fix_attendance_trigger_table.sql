-- The attendance trigger was attached to lecture_progress, but the actual
-- lecture watch UI (WatchModal) writes progress to lecture_activity instead —
-- a different table with different column names (user_id, completion_percentage).
-- Attendance was silently never recording. Move the trigger to the right table.
DROP TRIGGER IF EXISTS trg_lecture_progress_attendance ON lecture_progress;

CREATE OR REPLACE FUNCTION record_lecture_attendance_from_activity()
RETURNS trigger AS $$
DECLARE
  v_course_id uuid;
BEGIN
  IF NEW.completion_percentage >= 90 AND (OLD IS NULL OR OLD.completion_percentage < 90) THEN
    SELECT course_id INTO v_course_id FROM lectures WHERE id = NEW.lecture_id;
    IF v_course_id IS NOT NULL THEN
      INSERT INTO lecture_attendance (student_id, lecture_id, course_id, status, attendance_date)
      VALUES (NEW.user_id, NEW.lecture_id, v_course_id, 'present', CURRENT_DATE)
      ON CONFLICT (lecture_id, student_id) DO UPDATE SET status = 'present', course_id = EXCLUDED.course_id, attendance_date = EXCLUDED.attendance_date;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_lecture_activity_attendance ON lecture_activity;
CREATE TRIGGER trg_lecture_activity_attendance
  AFTER INSERT OR UPDATE OF completion_percentage ON lecture_activity
  FOR EACH ROW EXECUTE FUNCTION record_lecture_attendance_from_activity();

-- Keep the lecture_progress trigger too (some older code paths still use it).
DROP TRIGGER IF EXISTS trg_lecture_progress_attendance ON lecture_progress;
CREATE TRIGGER trg_lecture_progress_attendance
  AFTER INSERT OR UPDATE OF completion_pct ON lecture_progress
  FOR EACH ROW EXECUTE FUNCTION record_lecture_attendance();

-- Backfill: retroactively record attendance for activity that already crossed the threshold.
INSERT INTO lecture_attendance (student_id, lecture_id, course_id, status, attendance_date)
SELECT la.user_id, la.lecture_id, l.course_id, 'present', CURRENT_DATE
FROM lecture_activity la
JOIN lectures l ON l.id = la.lecture_id
WHERE la.completion_percentage >= 90
ON CONFLICT (lecture_id, student_id) DO UPDATE SET status = 'present';
