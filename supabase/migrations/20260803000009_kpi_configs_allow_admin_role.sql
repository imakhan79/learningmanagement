/* Allow 'admin' as a valid kpi_configs.role so admin performance can be tracked in the Performance Hub. */
ALTER TABLE kpi_configs DROP CONSTRAINT kpi_configs_role_check;
ALTER TABLE kpi_configs ADD CONSTRAINT kpi_configs_role_check CHECK (role IN ('admin','professor','student'));
