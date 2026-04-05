CREATE POLICY "Superviseur can manage niveaux"
ON public.niveaux
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'superviseur'))
WITH CHECK (public.has_role(auth.uid(), 'superviseur'));