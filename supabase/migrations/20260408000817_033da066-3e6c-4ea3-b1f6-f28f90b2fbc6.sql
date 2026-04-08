-- Allow superviseur to manage pointages_eleves
CREATE POLICY "Superviseur can manage pointages_eleves"
ON public.pointages_eleves
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'superviseur'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'superviseur'::app_role));