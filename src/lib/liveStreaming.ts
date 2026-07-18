import { supabase } from './supabase';

export interface LiveSession {
  id: string;
  course_id: string;
  instructor_id: string;
  title: string;
  description?: string;
  start_at: string;
  end_at?: string;
  provider: 'paid' | 'free';
  provider_meeting_id?: string;
  join_url?: string;
  created_at: string;
  updated_at: string;
}

export interface LiveAttendance {
  id: string;
  session_id: string;
  user_id: string;
  joined_at: string;
  left_at?: string;
  duration_seconds?: number;
  created_at: string;
}

export interface LiveSessionRecording {
  id: string;
  session_id: string;
  recording_url: string;
  duration_seconds?: number;
  created_at: string;
}

/**
 * Generate a Jitsi Meet room URL (free provider).
 * Room name is derived from the session ID to ensure uniqueness.
 */
function jitsiRoomUrl(sessionId: string): string {
  return `https://meet.jit.si/lms-session-${sessionId}`;
}

/**
 * Create a new live session in the database.
 * For 'free' provider: auto-generates a Jitsi join URL.
 * For 'paid' provider: expects join_url to be provided externally.
 */
export async function createLiveSession(params: {
  course_id: string;
  instructor_id: string;
  title: string;
  description?: string;
  start_at: string;
  end_at?: string;
  provider: 'paid' | 'free';
  join_url?: string;
}) {
  // Insert first to get the ID
  const { data, error } = await supabase
    .from('live_sessions')
    .insert({
      course_id: params.course_id,
      instructor_id: params.instructor_id,
      title: params.title,
      description: params.description,
      start_at: params.start_at,
      end_at: params.end_at,
      provider: params.provider,
      join_url: params.join_url ?? null,
    })
    .select()
    .single();

  if (error || !data) return { data: null, error };

  // Auto-set free provider URL
  if (params.provider === 'free' && !params.join_url) {
    const roomUrl = jitsiRoomUrl(data.id);
    await supabase
      .from('live_sessions')
      .update({ join_url: roomUrl, provider_meeting_id: `lms-session-${data.id}` })
      .eq('id', data.id);
    data.join_url = roomUrl;
  }

  return { data, error: null };
}

/** Fetch a single live session by ID */
export async function getLiveSessionById(sessionId: string) {
  return supabase
    .from('live_sessions')
    .select('*, course:courses(title), instructor:profiles(full_name)')
    .eq('id', sessionId)
    .single();
}

/** Fetch all live sessions for a course */
export async function getLiveSessionsByCourse(courseId: string) {
  return supabase
    .from('live_sessions')
    .select('*')
    .eq('course_id', courseId)
    .order('start_at', { ascending: true });
}

/** Fetch upcoming sessions across all courses the current user is involved with */
export async function getUpcomingLiveSessions(userId: string, role: string) {
  const now = new Date().toISOString();
  if (role === 'professor') {
    return supabase
      .from('live_sessions')
      .select('*, course:courses(title)')
      .eq('instructor_id', userId)
      .gte('start_at', now)
      .order('start_at', { ascending: true });
  } else if (role === 'student') {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('student_id', userId);
    const courseIds = (enrollments || []).map((e: any) => e.course_id);
    if (!courseIds.length) return { data: [], error: null };
    return supabase
      .from('live_sessions')
      .select('*, course:courses(title)')
      .in('course_id', courseIds)
      .gte('start_at', now)
      .order('start_at', { ascending: true });
  } else {
    // Admin: all upcoming sessions
    return supabase
      .from('live_sessions')
      .select('*, course:courses(title), instructor:profiles(full_name)')
      .gte('start_at', now)
      .order('start_at', { ascending: true });
  }
}

/** Fetch past sessions the current user is involved with */
export async function getPastLiveSessions(userId: string, role: string) {
  const now = new Date().toISOString();
  if (role === 'professor') {
    return supabase
      .from('live_sessions')
      .select('*, course:courses(title)')
      .eq('instructor_id', userId)
      .lt('start_at', now)
      .order('start_at', { ascending: false });
  } else if (role === 'student') {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('student_id', userId);
    const courseIds = (enrollments || []).map((e: any) => e.course_id);
    if (!courseIds.length) return { data: [], error: null };
    return supabase
      .from('live_sessions')
      .select('*, course:courses(title)')
      .in('course_id', courseIds)
      .lt('start_at', now)
      .order('start_at', { ascending: false });
  } else {
    // Admin: all past sessions
    return supabase
      .from('live_sessions')
      .select('*, course:courses(title), instructor:profiles(full_name)')
      .lt('start_at', now)
      .order('start_at', { ascending: false });
  }
}

/** Record that a user has joined a session */
export async function joinLiveSession(sessionId: string, userId: string) {
  return supabase.from('live_attendance').insert({
    session_id: sessionId,
    user_id: userId,
    joined_at: new Date().toISOString(),
  }).select().single();
}

/** Record that a user left a session and compute duration */
export async function leaveLiveSession(attendanceId: string) {
  const { data: row } = await supabase
    .from('live_attendance')
    .select('joined_at')
    .eq('id', attendanceId)
    .single();

  const durationSeconds = row
    ? Math.floor((Date.now() - new Date(row.joined_at).getTime()) / 1000)
    : null;

  return supabase.from('live_attendance').update({
    left_at: new Date().toISOString(),
    duration_seconds: durationSeconds,
  }).eq('id', attendanceId);
}

/** Get attendance list for a session */
export async function getSessionAttendance(sessionId: string) {
  return supabase
    .from('live_attendance')
    .select('*, user:profiles(full_name, email)')
    .eq('session_id', sessionId)
    .order('joined_at', { ascending: true });
}

/** Delete a live session (instructor-only, enforced by RLS) */
export async function deleteLiveSession(sessionId: string) {
  return supabase.from('live_sessions').delete().eq('id', sessionId);
}

/** Update a live session */
export async function updateLiveSession(sessionId: string, params: Partial<LiveSession>) {
  return supabase.from('live_sessions').update(params).eq('id', sessionId).select().single();
}

// ─────────────────────────────────────────
// Recordings
// ─────────────────────────────────────────

/** Get all recordings for a session */
export async function getSessionRecordings(sessionId: string) {
  return supabase
    .from('live_session_recordings')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
}

/** Add a recording URL to a session (instructor/admin only, enforced by RLS) */
export async function addSessionRecording(
  sessionId: string,
  recordingUrl: string,
  durationSeconds?: number
) {
  return supabase
    .from('live_session_recordings')
    .insert({ session_id: sessionId, recording_url: recordingUrl, duration_seconds: durationSeconds ?? null })
    .select()
    .single();
}

/** Delete a recording (instructor/admin only, enforced by RLS) */
export async function deleteSessionRecording(id: string) {
  return supabase.from('live_session_recordings').delete().eq('id', id);
}

// ─────────────────────────────────────────
// Enrollment helpers
// ─────────────────────────────────────────

/** Get all enrolled student user IDs for a course */
export async function getEnrolledUsersForCourse(courseId: string): Promise<string[]> {
  const { data } = await supabase
    .from('enrollments')
    .select('student_id')
    .eq('course_id', courseId)
    .eq('status', 'active');
  return (data || []).map((e: any) => e.student_id);
}

// ─────────────────────────────────────────
// Notifications / Reminders
// ─────────────────────────────────────────

/** Schedule a reminder alert 15 minutes before session start */
export async function scheduleSessionReminders(session: LiveSession, enrolledUserIds: string[]) {
  const reminders = enrolledUserIds.map((userId) => ({
    user_id: userId,
    type: 'live_session_reminder',
    severity: 'info' as const,
    title: `Live Session Starting Soon`,
    message: `"${session.title}" begins at ${new Date(session.start_at).toLocaleTimeString()}. Join URL: ${session.join_url}`,
  }));
  return supabase.from('alerts').insert(reminders);
}

