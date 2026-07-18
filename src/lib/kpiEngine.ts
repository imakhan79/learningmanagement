import { supabase, KpiConfig } from './supabase';

/**
 * KPI Engine
 * Evaluates configured KPIs for the active user continuously.
 */
export async function evaluateUserKPIs(userId: string, role: string) {
  try {
    // 1. Fetch active configs for this role
    const { data: configs } = await supabase
      .from('kpi_configs')
      .select('*')
      .eq('active', true)
      .eq('role', role);

    if (!configs || configs.length === 0) return;

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    for (const cfg of configs) {
      let actual = 0;

      // 2. Compute Actuals based on metric_key
      if (cfg.metric_key === 'lectures_created' && role === 'professor') {
        const { data: courses } = await supabase.from('courses').select('id').eq('professor_id', userId);
        const courseIds = (courses || []).map(c => c.id);
        if (courseIds.length > 0) {
          const { count } = await supabase
            .from('lectures')
            .select('id', { count: 'exact', head: true })
            .in('course_id', courseIds)
            .gte('created_at', periodStart)
            .lt('created_at', periodEnd);
          actual = count || 0;
        }
      } 
      else if ((cfg.metric_key === 'watch_time_pct' || cfg.metric_key === 'avg_watch_time_pct') && role === 'student') {
        const { data: prog } = await supabase
          .from('lecture_progress')
          .select('completion_pct')
          .eq('student_id', userId);
        actual = prog && prog.length > 0 
          ? prog.reduce((s, p) => s + (p.completion_pct || 0), 0) / prog.length 
          : 0;
      } 
      else if (cfg.metric_key === 'course_completion_days' && role === 'student') {
        const { data: enr } = await supabase
          .from('enrollments')
          .select('enrolled_at, completed_at')
          .eq('student_id', userId)
          .eq('status', 'completed');
        
        if (enr && enr.length > 0) {
          const days = enr.map(e => e.completed_at ? (new Date(e.completed_at).getTime() - new Date(e.enrolled_at).getTime()) / 86400000 : 30);
          actual = days.reduce((s, d) => s + d, 0) / days.length;
        }
      }

      // 3. Evaluate Status
      const meetsTarget = cfg.comparison === 'gte' ? actual >= cfg.target_value 
                        : cfg.comparison === 'lte' ? actual <= cfg.target_value 
                        : actual === cfg.target_value;

      // For 'gte', below 50% is critical. For 'lte', taking double the target is critical.
      let isCritical = false;
      if (cfg.comparison === 'gte' && actual < (cfg.target_value * 0.5)) isCritical = true;
      if (cfg.comparison === 'lte' && actual > (cfg.target_value * 2)) isCritical = true;

      const status = meetsTarget ? 'on_track' : (isCritical ? 'critical' : 'below_target');

      // 4. Update or Insert Snapshot
      const { data: existingSnap } = await supabase
        .from('kpi_snapshots')
        .select('id, status')
        .eq('user_id', userId)
        .eq('kpi_config_id', cfg.id)
        .eq('period_start', periodStart)
        .maybeSingle();

      const payload = {
        user_id: userId,
        kpi_config_id: cfg.id,
        period_start: periodStart,
        period_end: periodEnd,
        actual_value: actual,
        target_value: cfg.target_value,
        status,
        computed_at: new Date().toISOString()
      };

      if (existingSnap) {
        await supabase.from('kpi_snapshots').update(payload).eq('id', existingSnap.id);
      } else {
        await supabase.from('kpi_snapshots').insert(payload);
      }

      // 5. Generate Alert if newly failing or state worsened to critical
      if (!meetsTarget) {
        // Prevent spam: only alert once per day per KPI, or if status worsened
        const alertType = `kpi_${cfg.metric_key}_${periodStart}`;
        
        const { data: existingAlert } = await supabase
          .from('alerts')
          .select('id, severity')
          .eq('user_id', userId)
          .eq('type', alertType)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const shouldAlert = !existingAlert || (isCritical && existingAlert.severity !== 'critical');

        if (shouldAlert) {
          await supabase.from('alerts').insert({
            user_id: userId,
            type: alertType,
            severity: isCritical ? 'critical' : 'warning',
            title: `KPI Alert: ${cfg.name}`,
            message: `Actual: ${Math.round(actual * 10) / 10}${cfg.unit}. Target: ${cfg.target_value}${cfg.unit}. Status: ${status.replace('_', ' ')}.`
          });
        }
      }
    }
  } catch (err) {
    console.error("KPI Engine Evaluation Failed:", err);
  }
}
