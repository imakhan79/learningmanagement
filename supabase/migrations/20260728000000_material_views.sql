CREATE TABLE IF NOT EXISTS material_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES course_materials(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  duration_seconds integer DEFAULT 0
);

ALTER TABLE material_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "material_views_select" ON material_views;
CREATE POLICY "material_views_select" ON material_views FOR SELECT
  USING (
    auth.uid() = student_id OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin','professor'))
  );

DROP POLICY IF EXISTS "material_views_insert" ON material_views;
CREATE POLICY "material_views_insert" ON material_views FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE INDEX IF NOT EXISTS idx_material_views_material ON material_views(material_id);
CREATE INDEX IF NOT EXISTS idx_material_views_student ON material_views(student_id);
