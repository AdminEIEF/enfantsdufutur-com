
-- Allow coordinateur and coordinateur_secondaire to read compositions
DROP POLICY "Staff can view compositions" ON public.compositions;
CREATE POLICY "Staff can view compositions" ON public.compositions
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'superviseur'::app_role)
  OR has_role(auth.uid(), 'coordinateur'::app_role)
  OR has_role(auth.uid(), 'coordinateur_secondaire'::app_role)
);
