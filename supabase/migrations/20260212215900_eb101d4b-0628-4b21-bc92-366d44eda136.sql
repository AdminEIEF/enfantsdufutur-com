
-- Create storage bucket for photos (eleves + mandataires)
INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true);

-- Storage policies
CREATE POLICY "Anyone can view photos" ON storage.objects FOR SELECT USING (bucket_id = 'photos');
CREATE POLICY "Authenticated users can upload photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'photos');
CREATE POLICY "Authenticated users can update photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'photos');
CREATE POLICY "Authenticated users can delete photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'photos');

-- Create mandataires table
CREATE TABLE public.mandataires (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  eleve_id UUID NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  lien_parente TEXT NOT NULL,
  photo_url TEXT,
  ordre INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mandataires ENABLE ROW LEVEL SECURITY;

-- RLS policies for mandataires
CREATE POLICY "Authenticated users can view mandataires" ON public.mandataires FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert mandataires" ON public.mandataires FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update mandataires" ON public.mandataires FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete mandataires" ON public.mandataires FOR DELETE TO authenticated USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_mandataires_updated_at
  BEFORE UPDATE ON public.mandataires
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
