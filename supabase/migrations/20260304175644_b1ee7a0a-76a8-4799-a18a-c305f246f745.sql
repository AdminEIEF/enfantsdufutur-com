
-- Function to check if a class belongs to Maternelle or Primaire cycle
CREATE OR REPLACE FUNCTION public.is_maternelle_or_primary_class(_classe_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes c
    JOIN public.niveaux n ON n.id = c.niveau_id
    JOIN public.cycles cy ON cy.id = n.cycle_id
    WHERE c.id = _classe_id AND cy.nom IN ('Maternelle', 'Primaire')
  )
$$;

-- Drop old coordinator policy on eleves
DROP POLICY IF EXISTS "Coordinateur can read primary eleves" ON public.eleves;

-- Create new policy for Maternelle + Primaire
CREATE POLICY "Coordinateur can read maternelle_primary eleves"
ON public.eleves FOR SELECT
USING (
  has_role(auth.uid(), 'coordinateur'::app_role)
  AND classe_id IS NOT NULL
  AND is_maternelle_or_primary_class(classe_id)
);
