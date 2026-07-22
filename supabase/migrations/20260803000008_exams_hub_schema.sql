/*
  Schema additions for the admin Exams Hub:
  - scheduled_start/scheduled_end on exams (publish_date only controls student
    visibility, not the actual sitting time, so a dedicated pair is needed).
  - 'archived' as a distinct exams.status value alongside draft/published/closed.
  - exam_registrations: which enrolled students are registered to sit a given exam.
  - certificates: persisted issuance gated by professor sign-off + finance clearance.
*/

ALTER TABLE exams ADD COLUMN IF NOT EXISTS scheduled_start timestamptz;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS scheduled_end timestamptz;

ALTER TABLE exams DROP CONSTRAINT exams_status_check;
ALTER TABLE exams ADD CONSTRAINT exams_status_check
  CHECK (status IN ('draft','published','closed','archived'));

CREATE TABLE IF NOT EXISTS exam_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  registered_at timestamptz DEFAULT now(),
  registered_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE (exam_id, student_id)
);
ALTER TABLE exam_registrations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_exam_registrations_exam ON exam_registrations(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_registrations_student ON exam_registrations(student_id);

CREATE POLICY "exam_registrations_manage_admin_professor" ON exam_registrations FOR ALL
  TO authenticated
  USING (
    get_my_role() = 'admin'
    OR EXISTS (SELECT 1 FROM exams e JOIN courses c ON c.id = e.course_id WHERE e.id = exam_registrations.exam_id AND c.professor_id = auth.uid())
  )
  WITH CHECK (
    get_my_role() = 'admin'
    OR EXISTS (SELECT 1 FROM exams e JOIN courses c ON c.id = e.course_id WHERE e.id = exam_registrations.exam_id AND c.professor_id = auth.uid())
  );
CREATE POLICY "exam_registrations_select_own" ON exam_registrations FOR SELECT
  TO authenticated USING (student_id = auth.uid());

CREATE TABLE IF NOT EXISTS certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  cert_number text,
  grade numeric(5,2),
  professor_cleared boolean NOT NULL DEFAULT false,
  professor_cleared_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  professor_cleared_at timestamptz,
  finance_cleared_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','issued','revoked')),
  issued_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  issued_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (student_id, course_id)
);
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_certificates_student ON certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_course ON certificates(course_id);

CREATE POLICY "certificates_admin_all" ON certificates FOR ALL
  TO authenticated USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');
CREATE POLICY "certificates_select_own" ON certificates FOR SELECT
  TO authenticated USING (student_id = auth.uid());
