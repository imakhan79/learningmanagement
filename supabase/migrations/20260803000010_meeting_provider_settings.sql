/*
  Admin-managed API keys for meeting providers (Zoom/Google Meet/Teams).
  Sessions still use a manually-pasted join URL — this only lets admins store
  credentials and marks a provider "Connected" for professors picking a provider,
  via a secret-free view (meeting_provider_status) readable by all authenticated users.
*/
CREATE TABLE IF NOT EXISTS meeting_provider_settings (
  provider text PRIMARY KEY CHECK (provider IN ('zoom','google_meet','teams')),
  api_key text,
  api_secret text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);
ALTER TABLE meeting_provider_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meeting_provider_settings_admin_all" ON meeting_provider_settings FOR ALL
  TO authenticated USING (get_my_role() = 'admin') WITH CHECK (get_my_role() = 'admin');

CREATE VIEW meeting_provider_status AS
  SELECT provider, (api_key IS NOT NULL AND api_key <> '') AS is_configured, updated_at
  FROM meeting_provider_settings;
GRANT SELECT ON meeting_provider_status TO authenticated;
