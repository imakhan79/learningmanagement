import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type Role = 'admin' | 'professor' | 'student';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  status: string;
  avatar_url: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  professor_id: string;
  status: 'draft' | 'pending' | 'approved' | 'published' | 'archived';
  thumbnail_url: string;
  created_at: string;
  updated_at: string;
}

export interface Lecture {
  id: string;
  course_id: string;
  title: string;
  description: string;
  duration_seconds: number;
  learning_objectives: string;
  publish_date: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface CourseMaterial {
  id: string;
  course_id: string;
  lecture_id: string | null;
  type: 'video' | 'pdf' | 'book' | 'note' | 'worksheet';
  title: string;
  url: string;
  size_bytes: number;
  duration_seconds: number;
  created_at: string;
}

export interface WorksheetSubmission {
  id: string;
  student_id: string;
  material_id: string;
  status: 'submitted' | 'graded';
  submitted_at: string;
}

export interface Enrollment {
  id: string;
  course_id: string;
  student_id: string;
  status: 'active' | 'completed' | 'withdrawn';
  progress_pct: number;
  enrolled_at: string;
  completed_at: string | null;
}

export interface Bookmark {
  id: string;
  student_id: string;
  lecture_id: string;
  created_at: string;
}

export interface LectureProgress {
  id: string;
  student_id: string;
  lecture_id: string;
  last_position_seconds: number;
  completion_pct: number;
  total_watch_seconds: number;
  pause_count: number;
  resume_count: number;
  started_at: string;
  last_viewed_at: string;
  completed_at: string | null;
}

export interface WatchEvent {
  id: string;
  student_id: string;
  lecture_id: string;
  event_type: 'start' | 'pause' | 'resume' | 'complete' | 'seek';
  position_seconds: number;
  created_at: string;
}

export interface QuestionBankItem {
  id: string;
  subject: string;
  course_id: string | null;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'mcq' | 'true_false' | 'multiple_select' | 'short_answer' | 'essay';
  question_text: string;
  options: string[];
  correct_answer: any;
  explanation: string;
  marks: number;
  time_seconds: number;
  status: 'active' | 'archived';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Exam {
  id: string;
  course_id: string;
  type: 'exam' | 'quiz';
  title: string;
  description: string;
  duration_minutes: number;
  pass_marks: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  allow_resume: boolean;
  auto_evaluate: boolean;
  publish_date: string;
  status: 'draft' | 'published' | 'closed';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExamAttempt {
  id: string;
  exam_id: string;
  student_id: string;
  started_at: string;
  submitted_at: string | null;
  status: 'in_progress' | 'submitted' | 'graded';
  score: number;
  total_marks: number;
  time_spent_seconds: number;
}

export interface KpiConfig {
  id: string;
  role: 'professor' | 'student';
  name: string;
  metric_key: string;
  target_value: number;
  comparison: 'gte' | 'lte' | 'eq';
  period: 'daily' | 'weekly' | 'monthly';
  unit: string;
  description: string;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface KpiSnapshot {
  id: string;
  user_id: string;
  kpi_config_id: string;
  period_start: string;
  period_end: string;
  actual_value: number;
  target_value: number;
  status: 'on_track' | 'below_target' | 'critical';
  computed_at: string;
}

export interface Alert {
  id: string;
  user_id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any>;
  created_at: string;
}
