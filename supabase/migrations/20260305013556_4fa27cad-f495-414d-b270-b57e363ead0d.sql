
-- Allow chauffeur to insert validations_transport
CREATE POLICY "Chauffeur can insert validations_transport"
ON public.validations_transport
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'chauffeur'::app_role));

-- Allow chauffeur to read validations_transport
CREATE POLICY "Chauffeur can read validations_transport"
ON public.validations_transport
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'chauffeur'::app_role));

-- Allow chauffeur to read eleves (needed for scan/validation)
CREATE POLICY "Chauffeur can read eleves"
ON public.eleves
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'chauffeur'::app_role));

-- Allow chauffeur to read recharges_transport
CREATE POLICY "Chauffeur can read recharges_transport"
ON public.recharges_transport
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'chauffeur'::app_role));
