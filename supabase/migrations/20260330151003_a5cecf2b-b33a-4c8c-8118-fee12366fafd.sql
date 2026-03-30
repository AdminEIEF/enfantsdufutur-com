-- Add classe_id to pre_inscriptions
ALTER TABLE public.pre_inscriptions ADD COLUMN classe_id uuid REFERENCES public.classes(id);

-- Allow anon to read classes for public forms
CREATE POLICY "Public can read classes" ON public.classes FOR SELECT TO anon USING (true);