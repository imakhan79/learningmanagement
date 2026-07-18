import { supabase, Profile } from './supabase';

/**
 * Mocks the dispatch of external notifications (Email, Push)
 * In a real app, this would call an Edge Function or third-party service.
 */
async function dispatchExternalNotification(user: Profile, title: string, message: string, channel: 'email' | 'push') {
  const prefs = user.notification_preferences as any || { in_app: true, email: true, push: false };
  if (!prefs[channel]) return;

  // Simulate dispatch
  console.log(`[NotificationEngine] Dispatched ${channel.toUpperCase()} to ${user.full_name || user.email}: ${title} - ${message}`);
  // Optionally, log to a table if needed for audit
}

/**
 * Helper to dispatch an alert considering user preferences
 */
export async function sendNotification(userId: string, type: string, severity: 'info'|'warning'|'critical', title: string, message: string) {
  try {
    const { data: user } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!user) return;

    const prefs = user.notification_preferences as any || { in_app: true, email: true, push: false };

    // 1. In-App Alert (Native)
    if (prefs.in_app !== false) { // Default true
      // Prevent spam: check if similar active alert exists in last 24h
      const { data: recent } = await supabase
        .from('alerts')
        .select('id')
        .eq('user_id', userId)
        .eq('type', type)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (!recent || recent.length === 0) {
        await supabase.from('alerts').insert({
          user_id: userId,
          type,
          severity,
          title,
          message
        });
      }
    }

    // 2. External Channels
    await dispatchExternalNotification(user, title, message, 'email');
    await dispatchExternalNotification(user, title, message, 'push');

  } catch (error) {
    console.error("Failed to send notification:", error);
  }
}

/**
 * Runs time-based checks for the active user
 * E.g., Course Behind Schedule, Upcoming Exams
 */
export async function evaluateTimeBasedAlerts(userId: string, role: string) {
  try {
    const now = new Date();

    if (role === 'student') {
      // 1. Course Behind Schedule & Deadlines
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('id, enrolled_at, progress_pct, status, course:courses(title)')
        .eq('student_id', userId)
        .eq('status', 'active');

      if (enrollments) {
        for (const enr of enrollments) {
          const daysElapsed = (now.getTime() - new Date(enr.enrolled_at).getTime()) / (1000 * 60 * 60 * 24);
          
          // Assuming 30-day course target (from KPI logic)
          const expectedProgress = Math.min(100, (daysElapsed / 30) * 100);
          
          // If they are more than 25% behind expected progress after 7 days
          if (daysElapsed > 7 && enr.progress_pct < (expectedProgress - 25)) {
            await sendNotification(
              userId,
              `course_behind_${enr.id}`,
              'warning',
              'Course Behind Schedule',
              `You are falling behind in "${(enr.course as any)?.title}". Try to catch up on your lectures!`
            );
          }

          // Due soon (e.g. 28 days elapsed out of 30)
          if (daysElapsed >= 28 && daysElapsed <= 30 && enr.progress_pct < 100) {
            await sendNotification(
              userId,
              `course_due_soon_${enr.id}`,
              'critical',
              'Course Deadline Approaching',
              `"${(enr.course as any)?.title}" is due in ${Math.ceil(30 - daysElapsed)} days!`
            );
          }
        }
      }

      // 2. Exam Reminders (Unattempted active exams published within last 7 days)
      const { data: unattemptedExams } = await supabase.from('exams').select('id, title, course:courses(title), publish_date').eq('status', 'published').gte('publish_date', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (unattemptedExams) {
        for (const exam of unattemptedExams) {
          await sendNotification(
            userId,
            `exam_reminder_${exam.id}`,
            'info',
            'Exam Reminder',
            `Don't forget to take the exam "${exam.title}" for ${exam.course?.[0]?.title}.`
          );
        }
      }
    }

    if (role === 'admin') {
      // Admin: System Health check (e.g. Check for failed uploads or stuck pending items)
      const { count: pendingCourses } = await supabase
        .from('courses')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (pendingCourses && pendingCourses > 0) {
        await sendNotification(
          userId,
          'admin_pending_courses',
          'warning',
          'Pending Courses',
          `There are ${pendingCourses} courses waiting for admin approval.`
        );
      }
    }

  } catch (error) {
    console.error("Time-based alerts evaluation failed:", error);
  }
}
