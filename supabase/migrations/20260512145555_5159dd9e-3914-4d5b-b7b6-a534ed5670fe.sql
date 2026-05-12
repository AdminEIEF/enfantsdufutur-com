
CREATE POLICY "Superviseur can update classe_matieres"
ON public.classe_matieres FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'superviseur'::app_role))
WITH CHECK (has_role(auth.uid(), 'superviseur'::app_role));

CREATE POLICY "Coordinateur can update classe_matieres"
ON public.classe_matieres FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'coordinateur'::app_role))
WITH CHECK (has_role(auth.uid(), 'coordinateur'::app_role));

CREATE POLICY "Coordinateur_secondaire can update classe_matieres"
ON public.classe_matieres FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'coordinateur_secondaire'::app_role))
WITH CHECK (has_role(auth.uid(), 'coordinateur_secondaire'::app_role));
