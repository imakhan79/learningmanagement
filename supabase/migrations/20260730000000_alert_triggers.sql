-- 1. Add Notification Preferences to Profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"in_app": true, "email": true, "push": false}'::jsonb;

-- 2. Trigger Function: New Student Enrollment (Notify Professor)
CREATE OR REPLACE FUNCTION trg_notify_new_enrollment()
RETURNS TRIGGER AS $$
DECLARE
  v_prof_id uuid;
  v_course_title text;
  v_student_name text;
BEGIN
  -- Get professor and course info
  SELECT professor_id, title INTO v_prof_id, v_course_title
  FROM courses WHERE id = NEW.course_id;
  
  -- Get student info
  SELECT full_name INTO v_student_name
  FROM profiles WHERE id = NEW.student_id;
  
  IF v_prof_id IS NOT NULL THEN
    INSERT INTO alerts (user_id, type, severity, title, message)
    VALUES (
      v_prof_id, 
      'new_enrollment', 
      'info', 
      'New Student Enrollment', 
      COALESCE(v_student_name, 'A student') || ' enrolled in your course: ' || COALESCE(v_course_title, 'Unknown Course')
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_enrollment ON enrollments;
CREATE TRIGGER on_new_enrollment
  AFTER INSERT ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION trg_notify_new_enrollment();


-- 3. Trigger Function: New Material Uploaded (Notify Enrolled Students)
CREATE OR REPLACE FUNCTION trg_notify_new_material()
RETURNS TRIGGER AS $$
DECLARE
  v_course_title text;
  v_student record;
BEGIN
  SELECT title INTO v_course_title FROM courses WHERE id = NEW.course_id;

  FOR v_student IN (SELECT student_id FROM enrollments WHERE course_id = NEW.course_id AND status = 'active')
  LOOP
    INSERT INTO alerts (user_id, type, severity, title, message)
    VALUES (
      v_student.student_id, 
      'new_material', 
      'info', 
      'New Material Uploaded', 
      'New material added to course: ' || COALESCE(v_course_title, 'Unknown Course')
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_material ON course_materials;
CREATE TRIGGER on_new_material
  AFTER INSERT ON course_materials
  FOR EACH ROW
  EXECUTE FUNCTION trg_notify_new_material();


-- 4. Trigger Function: Exam Published (Notify Enrolled Students)
CREATE OR REPLACE FUNCTION trg_notify_exam_published()
RETURNS TRIGGER AS $$
DECLARE
  v_course_title text;
  v_student record;
BEGIN
  -- Only trigger if status changed to published
  IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
    SELECT title INTO v_course_title FROM courses WHERE id = NEW.course_id;

    FOR v_student IN (SELECT student_id FROM enrollments WHERE course_id = NEW.course_id AND status = 'active')
    LOOP
      INSERT INTO alerts (user_id, type, severity, title, message)
      VALUES (
        v_student.student_id, 
        'exam_published', 
        'info', 
        'Exam Published', 
        'A new exam "' || COALESCE(NEW.title, 'Unknown Exam') || '" is available for course: ' || COALESCE(v_course_title, 'Unknown Course')
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_exam_published ON exams;
CREATE TRIGGER on_exam_published
  AFTER UPDATE ON exams
  FOR EACH ROW
  EXECUTE FUNCTION trg_notify_exam_published();


-- 5. Trigger Function: Course Pending (Notify Admins)
CREATE OR REPLACE FUNCTION trg_notify_course_pending()
RETURNS TRIGGER AS $$
DECLARE
  v_admin record;
BEGIN
  IF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status != 'pending') THEN
    FOR v_admin IN (SELECT id FROM profiles WHERE role = 'admin' AND status = 'active')
    LOOP
      INSERT INTO alerts (user_id, type, severity, title, message)
      VALUES (
        v_admin.id, 
        'course_pending', 
        'warning', 
        'Course Pending Approval', 
        'A new course "' || COALESCE(NEW.title, 'Unknown') || '" requires review and approval.'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_course_pending ON courses;
CREATE TRIGGER on_course_pending
  AFTER UPDATE ON courses
  FOR EACH ROW
  EXECUTE FUNCTION trg_notify_course_pending();
