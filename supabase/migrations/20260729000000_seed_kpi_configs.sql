-- Seed default KPI Configurations

INSERT INTO kpi_configs (name, description, role, metric_key, target_value, comparison, period, unit, active, created_by)
SELECT 'Professor Lecture Target', 'Target: 20 lectures/month', 'professor', 'lectures_created', 20, 'gte', 'monthly', ' lectures', true, id FROM profiles WHERE role = 'admin' LIMIT 1;

INSERT INTO kpi_configs (name, description, role, metric_key, target_value, comparison, period, unit, active, created_by)
SELECT 'Student Course Completion', 'Target: Complete course in 30 days', 'student', 'course_completion_days', 30, 'lte', 'monthly', ' days', true, id FROM profiles WHERE role = 'admin' LIMIT 1;

INSERT INTO kpi_configs (name, description, role, metric_key, target_value, comparison, period, unit, active, created_by)
SELECT 'Engagement KPI', 'Minimum watch time: 80%', 'student', 'watch_time_pct', 80, 'gte', 'monthly', '%', true, id FROM profiles WHERE role = 'admin' LIMIT 1;
ON CONFLICT DO NOTHING;
