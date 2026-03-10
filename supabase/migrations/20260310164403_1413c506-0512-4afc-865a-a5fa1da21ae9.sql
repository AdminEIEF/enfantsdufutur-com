-- Add image_url column to support_messages
ALTER TABLE public.support_messages ADD COLUMN reply_image_url text;

-- Create storage bucket for support images
INSERT INTO storage.buckets (id, name, public) VALUES ('support-images', 'support-images', true);

-- RLS: authenticated users can upload
CREATE POLICY "Authenticated users can upload support images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'support-images');

-- RLS: anyone can view support images
CREATE POLICY "Anyone can view support images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'support-images');

-- RLS: authenticated can delete support images
CREATE POLICY "Authenticated can delete support images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'support-images');