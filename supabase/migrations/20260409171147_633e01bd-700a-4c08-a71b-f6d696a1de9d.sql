CREATE POLICY "Chauffeur can read own employe record"
ON public.employes
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'chauffeur'::app_role)
  AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

CREATE POLICY "Superviseur can manage vehicules"
ON public.vehicules_transport
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'superviseur'::app_role))
WITH CHECK (has_role(auth.uid(), 'superviseur'::app_role));