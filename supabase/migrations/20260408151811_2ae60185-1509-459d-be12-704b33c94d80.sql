
DROP POLICY "Staff can view compositions" ON public.compositions;
CREATE POLICY "Staff can view compositions" ON public.compositions
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'superviseur'::app_role)
  OR (has_role(auth.uid(), 'coordinateur'::app_role) AND is_maternelle_or_primary_class(classe_id))
  OR (has_role(auth.uid(), 'coordinateur_secondaire'::app_role) AND is_secondary_class(classe_id))
);
