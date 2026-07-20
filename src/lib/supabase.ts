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

// Helper to get current user ID
const getCurrentUserId = async (): Promise<string | null> => {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error fetching user:', error);
    return null;
  }
  return data?.user?.id ?? null;
};

export type Role = 'admin' | 'professor' | 'student';

export interface NotificationPreferences {
  in_app: boolean;
  email: boolean;
  push: boolean;
}

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
  notification_preferences?: NotificationPreferences;
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
  professor?: Pick<Profile, 'id' | 'email' | 'full_name' | 'role'>;
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
  category: string | null;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'mcq' | 'true_false' | 'multiple_select' | 'short_answer' | 'essay';
  question_text: string;
  options: string[];
  correct_answer: any;
  explanation: string;
  marks: number;
  time_seconds: number;
  status: 'draft' | 'submitted' | 'approved' | 'archived';
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  submitted_at: string | null;
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

export interface LectureAttachment {
  id: string;
  lecture_id: string;
  type: 'video' | 'pdf' | 'book' | 'worksheet' | 'reference';
  url: string;
  title: string;
  size_bytes: number;
  duration_seconds: number;
  created_at: string;
}

export interface RubricCriterion {
  criterion: string;
  max_points: number;
  description?: string;
}

export interface Assignment {
  id: string;
  course_id: string;
  professor_id: string;
  title: string;
  description: string;
  instructions: string;
  due_date: string | null;
  max_score: number;
  rubric: RubricCriterion[];
  status: 'draft' | 'published' | 'closed';
  created_at: string;
  updated_at: string;
  course?: Pick<Course, 'id' | 'title'>;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  file_url: string;
  file_name: string;
  file_size_bytes: number;
  submitted_at: string;
  status: 'submitted' | 'graded' | 'late';
  score: number | null;
  feedback: string | null;
  graded_by: string | null;
  graded_at: string | null;
  student?: Pick<Profile, 'id' | 'full_name' | 'email'>;
}

const ASSIGNMENT_SUBMISSIONS_BUCKET = 'assignment-submissions';

/** Upload a student's submission file to Storage and return its storage path. */
export const uploadAssignmentSubmissionFile = async (assignmentId: string, studentId: string, file: File) => {
  const path = `${assignmentId}/${studentId}/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from(ASSIGNMENT_SUBMISSIONS_BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
};

/** Get a short-lived signed URL to view/download a submission file. */
export const getAssignmentSubmissionUrl = async (path: string) => {
  const { data, error } = await supabase.storage.from(ASSIGNMENT_SUBMISSIONS_BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
};

// Lecture API
export const createLecture = async (data: Lecture) => supabase.from('lectures').insert(data);
export const updateLecture = async (id: string, data: Partial<Lecture>) => supabase.from('lectures').update(data).eq('id', id);
export const uploadLectureAttachment = async (lectureId: string, attachment: LectureAttachment) =>
  supabase.from('lecture_attachments').insert({
    lecture_id: lectureId,
    type: attachment.type,
    url: attachment.url,
    title: attachment.title,
    size_bytes: attachment.size_bytes,
    duration_seconds: attachment.duration_seconds,
  });

export const getLecture = async (lectureId: string) => supabase.from('lectures').select('*').eq('id', lectureId).single();
export const getLectureAttachments = async (lectureId: string) => supabase.from('lecture_attachments').select('*').eq('lecture_id', lectureId);

export const bookmarkLecture = async (lectureId: string) => {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');
  return supabase.from('bookmarks').insert({ lecture_id: lectureId, student_id: userId });
};

export const resumeLecture = async (lectureId: string, position: number) => {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');
  return supabase.from('lecture_progress').upsert({
    lecture_id: lectureId,
    student_id: userId,
    last_position_seconds: position,
  }, { onConflict: 'student_id,lecture_id' });
};

// Lecture Activity Tracking
export interface StudentAnalytics {
  id: string;
  student_id: string;
  course_id: string;
  engagement_score: number;
  last_activity_at: string;
}

export interface LectureAttendance {
  id: string;
  lecture_id: string;
  student_id: string;
  attended_at: string;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  student_id: string;
  score: number;
  completed_at: string;
}

export interface ExamScore {
  id: string;
  exam_id: string;
  student_id: string;
  marks_obtained: number;
  total_marks: number;
}

export interface AssignmentProgress {
  id: string;
  assignment_id: string;
  student_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  updated_at: string;
}

export interface LoginEvent {
  id: string;
  user_id: string;
  ip_address: string;
  login_at: string;
}

export const logStudentLogin = async (userId: string, ip: string) => supabase.from('login_events').insert({ user_id: userId, ip_address: ip });
export const getStudentAnalytics = async (studentId: string) => supabase.from('student_analytics').select('*').eq('student_id', studentId);
export const recordLectureAttendance = async (data: LectureAttendance) => supabase.from('lecture_attendance').insert(data);
export const submitQuizAttempt = async (data: QuizAttempt) => supabase.from('quiz_attempts').insert(data);
export const updateAssignmentProgress = async (id: string, status: string) => supabase.from('assignment_progress').update({ status }).eq('id', id);

export interface LectureActivity {
  id: string;
  user_id: string;
  lecture_id: string;
  started_at: string;
  last_position: number; // seconds into the video
  total_watch_seconds: number;
  pause_count: number;
  resume_count: number;
  bookmark_count: number;
  completed_at: string | null;
  completion_percentage: number;
}

/** Start tracking a lecture for the current user */
export const startLectureActivity = async (lectureId: string): Promise<{ data: LectureActivity[] | null; error: any }> => {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');
  const { data, error } = await supabase.from('lecture_activity').insert({
    lecture_id: lectureId,
    user_id: userId,
  });
  return { data, error };
};

/** Update progress – can be called on pause, resume, bookmark, or periodic heartbeat */
export const updateLectureActivity = async (activityId: string, updates: Partial<LectureActivity>) => {
  const { data, error } = await supabase
    .from('lecture_activity')
    .update(updates)
    .eq('id', activityId);
  return { data, error };
};

/** Mark lecture as completed and compute percentage */
export const completeLectureActivity = async (activityId: string, totalDuration: number) => {
  const { data: existing } = await supabase
    .from('lecture_activity')
    .select('total_watch_seconds, completed_at')
    .eq('id', activityId)
    .single();
  const watch = existing?.total_watch_seconds ?? 0;
  const percentage = Math.min(100, (watch / totalDuration) * 100);
  const { data, error } = await supabase
    .from('lecture_activity')
    .update({
      completed_at: new Date().toISOString(),
      completion_percentage: percentage,
    })
    .eq('id', activityId);
  return { data, error };
};
