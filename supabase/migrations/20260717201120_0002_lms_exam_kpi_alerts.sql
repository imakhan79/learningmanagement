/*
# LMS Exam, Question Bank, KPI, Alerts, Audit Schema

1. Overview
Adds the examination system (question bank, exams, questions, attempts, answers),
KPI configuration + monitoring, alerts/notifications, and audit logs.

2. New Tables
- `question_bank`, `exams`, `exam_questions`, `exam_attempts`, `attempt_answers`
- `kpi_configs`, `kpi_snapshots`
- `alerts`
- `audit_logs`

3. Security
- RLS enabled on every table with role-scoped policies.
*/

-- Question bank
CREATE TABLE IF NOT EXISTS question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL DEFAULT '',
  course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  topic text NOT NULL DEFAULT '',
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  type text NOT NULL CHECK (type IN ('mcq','true_false','multiple_select','short_answer','essay')),
  question_text text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text NOT NULL DEFAULT '',
  marks numeric(6,2) NOT NULL DEFAULT 1,
  time_seconds integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_qb_course ON question_bank(course_id);
CREATE INDEX IF NOT EXISTS idx_qb_subject ON question_bank(subject);
CREATE INDEX IF NOT EXISTS idx_qb_topic ON question_bank(topic);
CREATE INDEX IF NOT EXISTS idx_qb_difficulty ON question_bank(difficulty);
CREATE INDEX IF NOT EXISTS idx_qb_type ON question_bank(type);
CREATE INDEX IF NOT EXISTS idx_qb_status ON question_bank(status);

DROP POLICY IF EXISTS "qb_select_role" ON question_bank;
CREATE POLICY "qb_select_role" ON question_bank FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor'))
  );

DROP POLICY IF EXISTS "qb_insert_professor_admin" ON question_bank;
CREATE POLICY "qb_insert_professor_admin" ON question_bank FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor'))
  );

DROP POLICY IF EXISTS "qb_update_professor_admin" ON question_bank;
CREATE POLICY "qb_update_professor_admin" ON question_bank FOR UPDATE
  TO authenticated USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "qb_delete_admin" ON question_bank;
CREATE POLICY "qb_delete_admin" ON question_bank FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Exams
CREATE TABLE IF NOT EXISTS exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  duration_minutes integer NOT NULL DEFAULT 60,
  pass_marks numeric(6,2) NOT NULL DEFAULT 50,
  shuffle_questions boolean NOT NULL DEFAULT true,
  shuffle_options boolean NOT NULL DEFAULT true,
  allow_resume boolean NOT NULL DEFAULT true,
  auto_evaluate boolean NOT NULL DEFAULT true,
  publish_date timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_exams_course ON exams(course_id);
CREATE INDEX IF NOT EXISTS idx_exams_status ON exams(status);
CREATE INDEX IF NOT EXISTS idx_exams_publish_date ON exams(publish_date);

DROP POLICY IF EXISTS "exams_select_role" ON exams;
CREATE POLICY "exams_select_role" ON exams FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = exams.course_id AND c.professor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR (status = 'published' AND EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = exams.course_id AND e.student_id = auth.uid()))
  );

DROP POLICY IF EXISTS "exams_insert_professor_admin" ON exams;
CREATE POLICY "exams_insert_professor_admin" ON exams FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = exams.course_id AND c.professor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "exams_update_professor_admin" ON exams;
CREATE POLICY "exams_update_professor_admin" ON exams FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = exams.course_id AND c.professor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "exams_delete_professor_admin" ON exams;
CREATE POLICY "exams_delete_professor_admin" ON exams FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = exams.course_id AND c.professor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Exam questions junction
CREATE TABLE IF NOT EXISTS exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  marks numeric(6,2) NOT NULL DEFAULT 1,
  UNIQUE (exam_id, question_id)
);
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON exam_questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_question ON exam_questions(question_id);

DROP POLICY IF EXISTS "exam_questions_select_role" ON exam_questions;
CREATE POLICY "exam_questions_select_role" ON exam_questions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM exams e WHERE e.id = exam_questions.exam_id AND EXISTS (SELECT 1 FROM courses c WHERE c.id = e.course_id AND c.professor_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR EXISTS (SELECT 1 FROM exams e WHERE e.id = exam_questions.exam_id AND e.status = 'published' AND EXISTS (SELECT 1 FROM enrollments en WHERE en.course_id = e.course_id AND en.student_id = auth.uid()))
  );

DROP POLICY IF EXISTS "exam_questions_insert_professor_admin" ON exam_questions;
CREATE POLICY "exam_questions_insert_professor_admin" ON exam_questions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM exams e WHERE e.id = exam_questions.exam_id AND EXISTS (SELECT 1 FROM courses c WHERE c.id = e.course_id AND c.professor_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "exam_questions_delete_professor_admin" ON exam_questions;
CREATE POLICY "exam_questions_delete_professor_admin" ON exam_questions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM exams e WHERE e.id = exam_questions.exam_id AND EXISTS (SELECT 1 FROM courses c WHERE c.id = e.course_id AND c.professor_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Exam attempts
CREATE TABLE IF NOT EXISTS exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','graded')),
  score numeric(6,2) DEFAULT 0,
  total_marks numeric(6,2) DEFAULT 0,
  time_spent_seconds integer DEFAULT 0,
  UNIQUE (exam_id, student_id)
);
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_attempts_exam ON exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student ON exam_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON exam_attempts(status);

DROP POLICY IF EXISTS "attempts_select_role" ON exam_attempts;
CREATE POLICY "attempts_select_role" ON exam_attempts FOR SELECT
  TO authenticated USING (
    student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM exams e WHERE e.id = exam_attempts.exam_id AND EXISTS (SELECT 1 FROM courses c WHERE c.id = e.course_id AND c.professor_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "attempts_insert_own" ON exam_attempts;
CREATE POLICY "attempts_insert_own" ON exam_attempts FOR INSERT
  TO authenticated WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "attempts_update_own" ON exam_attempts;
CREATE POLICY "attempts_update_own" ON exam_attempts FOR UPDATE
  TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

-- Attempt answers
CREATE TABLE IF NOT EXISTS attempt_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  answer jsonb NOT NULL DEFAULT '[]'::jsonb,
  marks_awarded numeric(6,2) DEFAULT 0,
  is_correct boolean DEFAULT false,
  graded_at timestamptz,
  graded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE (attempt_id, question_id)
);
ALTER TABLE attempt_answers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_answers_attempt ON attempt_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON attempt_answers(question_id);

DROP POLICY IF EXISTS "answers_select_role" ON attempt_answers;
CREATE POLICY "answers_select_role" ON attempt_answers FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM exam_attempts a WHERE a.id = attempt_answers.attempt_id AND a.student_id = auth.uid())
    OR EXISTS (SELECT 1 FROM exam_attempts a WHERE a.id = attempt_answers.attempt_id AND EXISTS (SELECT 1 FROM exams e WHERE e.id = a.exam_id AND EXISTS (SELECT 1 FROM courses c WHERE c.id = e.course_id AND c.professor_id = auth.uid())))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "answers_insert_own" ON attempt_answers;
CREATE POLICY "answers_insert_own" ON attempt_answers FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM exam_attempts a WHERE a.id = attempt_answers.attempt_id AND a.student_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor'))
  );

DROP POLICY IF EXISTS "answers_update_professor_admin" ON attempt_answers;
CREATE POLICY "answers_update_professor_admin" ON attempt_answers FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM exam_attempts a WHERE a.id = attempt_answers.attempt_id AND a.student_id = auth.uid())
    OR EXISTS (SELECT 1 FROM exam_attempts a WHERE a.id = attempt_answers.attempt_id AND EXISTS (SELECT 1 FROM exams e WHERE e.id = a.exam_id AND EXISTS (SELECT 1 FROM courses c WHERE c.id = e.course_id AND c.professor_id = auth.uid())))
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- KPI configs
CREATE TABLE IF NOT EXISTS kpi_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('professor','student')),
  name text NOT NULL,
  metric_key text NOT NULL,
  target_value numeric(10,2) NOT NULL,
  comparison text NOT NULL DEFAULT 'gte' CHECK (comparison IN ('gte','lte','eq')),
  period text NOT NULL DEFAULT 'monthly' CHECK (period IN ('daily','weekly','monthly')),
  unit text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE kpi_configs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_kpi_configs_role ON kpi_configs(role);
CREATE INDEX IF NOT EXISTS idx_kpi_configs_metric ON kpi_configs(metric_key);
CREATE INDEX IF NOT EXISTS idx_kpi_configs_active ON kpi_configs(active);

DROP POLICY IF EXISTS "kpi_configs_select_all" ON kpi_configs;
CREATE POLICY "kpi_configs_select_all" ON kpi_configs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "kpi_configs_insert_admin" ON kpi_configs;
CREATE POLICY "kpi_configs_insert_admin" ON kpi_configs FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "kpi_configs_update_admin" ON kpi_configs;
CREATE POLICY "kpi_configs_update_admin" ON kpi_configs FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "kpi_configs_delete_admin" ON kpi_configs;
CREATE POLICY "kpi_configs_delete_admin" ON kpi_configs FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- KPI snapshots
CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kpi_config_id uuid NOT NULL REFERENCES kpi_configs(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  actual_value numeric(10,2) NOT NULL DEFAULT 0,
  target_value numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track','below_target','critical')),
  computed_at timestamptz DEFAULT now()
);
ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_user ON kpi_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_config ON kpi_snapshots(kpi_config_id);
CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_period ON kpi_snapshots(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_status ON kpi_snapshots(status);

DROP POLICY IF EXISTS "kpi_snapshots_select_role" ON kpi_snapshots;
CREATE POLICY "kpi_snapshots_select_role" ON kpi_snapshots FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "kpi_snapshots_insert_admin" ON kpi_snapshots;
CREATE POLICY "kpi_snapshots_insert_admin" ON kpi_snapshots FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "kpi_snapshots_update_admin" ON kpi_snapshots;
CREATE POLICY "kpi_snapshots_update_admin" ON kpi_snapshots FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "kpi_snapshots_delete_admin" ON kpi_snapshots;
CREATE POLICY "kpi_snapshots_delete_admin" ON kpi_snapshots FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(read_at);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);

DROP POLICY IF EXISTS "alerts_select_own" ON alerts;
CREATE POLICY "alerts_select_own" ON alerts FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "alerts_insert_admin_self" ON alerts;
CREATE POLICY "alerts_insert_admin_self" ON alerts FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "alerts_update_own" ON alerts;
CREATE POLICY "alerts_update_own" ON alerts FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "alerts_delete_admin" ON alerts;
CREATE POLICY "alerts_delete_admin" ON alerts FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL DEFAULT '',
  entity_type text NOT NULL DEFAULT '',
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

DROP POLICY IF EXISTS "audit_select_admin" ON audit_logs;
CREATE POLICY "audit_select_admin" ON audit_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "audit_insert_any" ON audit_logs;
CREATE POLICY "audit_insert_any" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trg_qb_updated_at ON question_bank;
CREATE TRIGGER trg_qb_updated_at BEFORE UPDATE ON question_bank
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_exams_updated_at ON exams;
CREATE TRIGGER trg_exams_updated_at BEFORE UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_kpi_configs_updated_at ON kpi_configs;
CREATE TRIGGER trg_kpi_configs_updated_at BEFORE UPDATE ON kpi_configs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
