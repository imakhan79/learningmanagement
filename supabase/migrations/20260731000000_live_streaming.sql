-- Migration: Live Streaming tables
-- Create live_sessions table
create table live_sessions (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references courses(id) not null,
  instructor_id uuid references profiles(id) not null,
  title text not null,
  description text,
  start_at timestamp with time zone not null,
  end_at timestamp with time zone,
  provider text not null, -- 'paid' or 'free'
  provider_meeting_id text, -- external meeting identifier
  join_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create live_attendance table
create table live_attendance (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references live_sessions(id) on delete cascade not null,
  user_id uuid references profiles(id) not null,
  joined_at timestamp with time zone default now(),
  left_at timestamp with time zone,
  duration_seconds int,
  created_at timestamp with time zone default now()
);

-- Create live_session_recordings table
create table live_session_recordings (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references live_sessions(id) on delete cascade not null,
  recording_url text not null,
  duration_seconds int,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table live_sessions enable row level security;
alter table live_attendance enable row level security;
alter table live_session_recordings enable row level security;

-- Indexes
create index idx_live_sessions_course on live_sessions(course_id);
create index idx_live_sessions_instructor on live_sessions(instructor_id);
create index idx_live_attendance_session on live_attendance(session_id);
create index idx_live_attendance_user on live_attendance(user_id);
create index idx_live_recordings_session on live_session_recordings(session_id);

-- Triggers for updated_at (reuse existing set_updated_at function)
create trigger trg_live_sessions_updated_at
  before update on live_sessions
  for each row execute function set_updated_at();

create trigger trg_live_attendance_updated_at
  before update on live_attendance
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────
-- RLS: live_sessions
-- ─────────────────────────────────────────

-- Instructors can manage (insert/update/delete) their own sessions
create policy "live_sessions: instructor manage own" on live_sessions
  for all
  using (auth.uid() = instructor_id)
  with check (auth.uid() = instructor_id);

-- Students (enrolled in the course) and the course instructor can select sessions
create policy "live_sessions: enrolled or instructor select" on live_sessions
  for select
  using (
    exists (
      select 1 from enrollments e
      where e.course_id = live_sessions.course_id
        and e.student_id = auth.uid()
    )
    or exists (
      select 1 from courses c
      where c.id = live_sessions.course_id
        and c.professor_id = auth.uid()
    )
  );

-- Admins can select all sessions
create policy "live_sessions: admin select all" on live_sessions
  for select
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Admins can manage all sessions
create policy "live_sessions: admin manage all" on live_sessions
  for all
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ─────────────────────────────────────────
-- RLS: live_attendance
-- ─────────────────────────────────────────

-- Users can insert their own attendance row when they join
create policy "live_attendance: user insert own" on live_attendance
  for insert
  with check (auth.uid() = user_id);

-- Users can update their own attendance row (to record left_at)
create policy "live_attendance: user update own" on live_attendance
  for update
  using (auth.uid() = user_id);

-- Users can select their own attendance rows
create policy "live_attendance: user select own" on live_attendance
  for select
  using (auth.uid() = user_id);

-- Instructors can select attendance for sessions they own
create policy "live_attendance: instructor select for own sessions" on live_attendance
  for select
  using (
    exists (
      select 1 from live_sessions s
      where s.id = live_attendance.session_id
        and s.instructor_id = auth.uid()
    )
  );

-- Admins can select all attendance
create policy "live_attendance: admin select all" on live_attendance
  for select
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ─────────────────────────────────────────
-- RLS: live_session_recordings
-- ─────────────────────────────────────────

-- Instructors can insert/delete recordings for their own sessions
create policy "live_recordings: instructor manage own" on live_session_recordings
  for all
  using (
    exists (
      select 1 from live_sessions s
      where s.id = live_session_recordings.session_id
        and s.instructor_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from live_sessions s
      where s.id = live_session_recordings.session_id
        and s.instructor_id = auth.uid()
    )
  );

-- Admins can manage all recordings
create policy "live_recordings: admin manage all" on live_session_recordings
  for all
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Enrolled students and course instructors can select recordings
create policy "live_recordings: enrolled or instructor select" on live_session_recordings
  for select
  using (
    exists (
      select 1 from live_sessions s
      join enrollments e on e.course_id = s.course_id
      where s.id = live_session_recordings.session_id
        and e.student_id = auth.uid()
    )
    or exists (
      select 1 from live_sessions s
      where s.id = live_session_recordings.session_id
        and s.instructor_id = auth.uid()
    )
  );

