
CREATE OR REPLACE FUNCTION public.is_secondary_class(_classe_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes c
    JOIN public.niveaux n ON n.id = c.niveau_id
    JOIN public.cycles cy ON cy.id = n.cycle_id
    WHERE c.id = _classe_id AND cy.nom IN ('Collège', 'Lycée')
  )
$$;

CREATE POLICY "Coordinateur_secondaire can read secondary eleves"
ON public.eleves
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coordinateur_secondaire'::app_role)
  AND classe_id IS NOT NULL
  AND is_secondary_class(classe_id)
);
