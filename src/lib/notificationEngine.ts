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

    if (role === 'professor') {
      const { data: courses } = await supabase.from('courses').select('id').eq('professor_id', userId);
      const courseIds = (courses || []).map((c: any) => c.id);

      if (courseIds.length > 0) {
        const { data: exams } = await supabase.from('exams').select('id').in('course_id', courseIds);
        const examIds = (exams || []).map((e: any) => e.id);

        const { data: assignments } = await supabase.from('assignments').select('id, title, due_date').eq('professor_id', userId);
        const assignmentIds = (assignments || []).map((a: any) => a.id);

        // 1. Pending grading — ungraded essay responses + ungraded assignment submissions
        let pendingEssays = 0;
        if (examIds.length > 0) {
          const { data: examQs } = await supabase
            .from('exam_questions')
            .select('question_id, question:question_bank(type)')
            .in('exam_id', examIds);
          const essayQIds = (examQs || []).filter((x: any) => x.question?.type === 'essay').map((x: any) => x.question_id);

          if (essayQIds.length > 0) {
            const { data: attempts } = await supabase
              .from('exam_attempts')
              .select('id')
              .in('exam_id', examIds)
              .in('status', ['submitted', 'graded']);
            const attemptIds = (attempts || []).map((a: any) => a.id);

            if (attemptIds.length > 0) {
              const { count } = await supabase
                .from('exam_responses')
                .select('question_id', { count: 'exact', head: true })
                .in('attempt_id', attemptIds)
                .in('question_id', essayQIds)
                .is('graded_at', null);
              pendingEssays = count || 0;
            }
          }
        }

        let pendingAssignments = 0;
        if (assignmentIds.length > 0) {
          const { count } = await supabase
            .from('assignment_submissions')
            .select('id', { count: 'exact', head: true })
            .in('assignment_id', assignmentIds)
            .eq('status', 'submitted');
          pendingAssignments = count || 0;
        }

        const totalPending = pendingEssays + pendingAssignments;
        if (totalPending > 0) {
          await sendNotification(
            userId,
            'professor_pending_grading',
            'warning',
            'Grading Pending',
            `You have ${totalPending} submission${totalPending === 1 ? '' : 's'} awaiting grading (${pendingEssays} essay response${pendingEssays === 1 ? '' : 's'}, ${pendingAssignments} assignment${pendingAssignments === 1 ? '' : 's'}).`
          );
        }

        // 2. Low-performing students — 2+ graded attempts below 50% across the professor's courses
        if (examIds.length > 0) {
          const { data: gradedAttempts } = await supabase
            .from('exam_attempts')
            .select('student_id, score, total_marks, student:profiles(full_name)')
            .in('exam_id', examIds)
            .in('status', ['submitted', 'graded']);

          const lowByStudent = new Map<string, { count: number; name: string }>();
          (gradedAttempts || []).forEach((a: any) => {
            if (!a.total_marks) return;
            const pct = (a.score || 0) / a.total_marks;
            if (pct < 0.5) {
              const entry = lowByStudent.get(a.student_id) || { count: 0, name: a.student?.full_name || 'A student' };
              entry.count += 1;
              lowByStudent.set(a.student_id, entry);
            }
          });

          for (const [studentId, info] of lowByStudent) {
            if (info.count >= 2) {
              await sendNotification(
                userId,
                `professor_low_performer_${studentId}`,
                'warning',
                'Student Needs Attention',
                `${info.name} has scored below 50% on ${info.count} recent assessments in your courses.`
              );
            }
          }
        }

        // 3. Attendance — recent live sessions with low turnout
        const { data: sessions } = await supabase
          .from('live_sessions')
          .select('id, title, course_id, start_at')
          .in('course_id', courseIds)
          .lt('start_at', now.toISOString())
          .gte('start_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());

        for (const session of sessions || []) {
          const [{ count: attendedCount }, { count: enrolledCount }] = await Promise.all([
            supabase.from('live_attendance').select('id', { count: 'exact', head: true }).eq('session_id', session.id),
            supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('course_id', session.course_id).eq('status', 'active'),
          ]);
          if (enrolledCount && enrolledCount > 0) {
            const rate = (attendedCount || 0) / enrolledCount;
            if (rate < 0.5) {
              await sendNotification(
                userId,
                `professor_low_attendance_${session.id}`,
                'warning',
                'Low Attendance Alert',
                `Only ${Math.round(rate * 100)}% of enrolled students attended "${session.title}".`
              );
            }
          }
        }

        // 4. Upcoming deadlines — assignments due within the next 3 days
        const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        for (const a of assignments || []) {
          if (!a.due_date) continue;
          const due = new Date(a.due_date);
          if (due >= now && due <= soon) {
            const { count: submittedCount } = await supabase
              .from('assignment_submissions')
              .select('id', { count: 'exact', head: true })
              .eq('assignment_id', a.id);
            await sendNotification(
              userId,
              `professor_assignment_deadline_${a.id}`,
              'info',
              'Assignment Deadline Approaching',
              `"${a.title}" is due ${due.toLocaleDateString()}. ${submittedCount || 0} submission${submittedCount === 1 ? '' : 's'} received so far.`
            );
          }
        }
      }
    }

  } catch (error) {
    console.error("Time-based alerts evaluation failed:", error);
  }
}
