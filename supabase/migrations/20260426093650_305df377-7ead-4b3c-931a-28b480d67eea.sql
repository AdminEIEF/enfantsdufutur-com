-- Permettre au superviseur et coordinateur_secondaire de gérer les notes
CREATE POLICY "Superviseur can manage notes"
ON public.notes
FOR ALL
USING (public.has_role(auth.uid(), 'superviseur'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'superviseur'::app_role));

CREATE POLICY "Coordinateur secondaire can manage secondary notes"
ON public.notes
FOR ALL
USING (
  public.has_role(auth.uid(), 'coordinateur_secondaire'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.eleves e
    WHERE e.id = notes.eleve_id
      AND e.classe_id IS NOT NULL
      AND NOT public.is_primary_class(e.classe_id)
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'coordinateur_secondaire'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.eleves e
    WHERE e.id = notes.eleve_id
      AND e.classe_id IS NOT NULL
      AND NOT public.is_primary_class(e.classe_id)
  )
);