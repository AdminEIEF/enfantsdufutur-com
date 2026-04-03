
-- Create storage bucket for pre-inscription documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('pre-inscriptions-docs', 'pre-inscriptions-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Allow anonymous uploads to this bucket (public pre-inscription form)
CREATE POLICY "Anyone can upload pre-inscription docs"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'pre-inscriptions-docs');

-- Allow authenticated users to read pre-inscription docs
CREATE POLICY "Authenticated can read pre-inscription docs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'pre-inscriptions-docs');
