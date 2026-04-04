
-- Create table for fiches de renseignements
CREATE TABLE public.fiches_renseignements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  fichier_nom TEXT NOT NULL,
  fichier_url TEXT NOT NULL,
  ordre INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fiches_renseignements ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can download)
CREATE POLICY "Fiches lisibles par tous" ON public.fiches_renseignements
  FOR SELECT USING (true);

-- Admin/superviseur can manage
CREATE POLICY "Admin gère les fiches" ON public.fiches_renseignements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur'));

-- Create public storage bucket for fiches
INSERT INTO storage.buckets (id, name, public) VALUES ('fiches-renseignements', 'fiches-renseignements', true);

-- Anyone can read files
CREATE POLICY "Fiches fichiers lisibles" ON storage.objects FOR SELECT USING (bucket_id = 'fiches-renseignements');

-- Authenticated admin can upload
CREATE POLICY "Admin upload fiches" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fiches-renseignements' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur')));

-- Admin can delete fiches
CREATE POLICY "Admin delete fiches" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fiches-renseignements' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur')));
