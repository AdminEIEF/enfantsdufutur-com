
-- Fix 1: Restrict justificatifs uploads to authenticated users only
DROP POLICY IF EXISTS "Anyone can upload justificatifs" ON storage.objects;
CREATE POLICY "Authenticated uploads to justificatifs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'justificatifs' AND auth.role() = 'authenticated');

-- Fix 2: Replace overly permissive mandataires policies with role-based ones
DROP POLICY IF EXISTS "Authenticated users can insert mandataires" ON public.mandataires;
DROP POLICY IF EXISTS "Authenticated users can update mandataires" ON public.mandataires;
DROP POLICY IF EXISTS "Authenticated users can delete mandataires" ON public.mandataires;
DROP POLICY IF EXISTS "Authenticated users can view mandataires" ON public.mandataires;

CREATE POLICY "Admin/Secretaire can manage mandataires"
  ON public.mandataires FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role));

CREATE POLICY "Staff can read mandataires"
  ON public.mandataires FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role) OR has_role(auth.uid(), 'service_info'::app_role));
