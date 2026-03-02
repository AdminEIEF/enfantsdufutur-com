-- Remove overly permissive upload policies on justificatifs and devoirs buckets
DROP POLICY IF EXISTS "Anyone can upload justificatifs" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload devoirs files" ON storage.objects;

-- Replace with authenticated-only policies
CREATE POLICY "Authenticated can upload justificatifs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'justificatifs');

CREATE POLICY "Authenticated can upload devoirs files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'devoirs');
