
-- 1. Fix is_maternelle_or_primary_class to include Crèche
CREATE OR REPLACE FUNCTION public.is_maternelle_or_primary_class(_classe_id uuid)
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
    WHERE c.id = _classe_id AND cy.nom IN ('Crèche', 'Maternelle', 'Primaire')
  )
$$;

-- 2. Fix the SELECT policy to use is_maternelle_or_primary_class instead of is_primary_class
DROP POLICY IF EXISTS "Coordinateur can read primary enseignant_classes" ON public.enseignant_classes;
CREATE POLICY "Coordinateur can read enseignant_classes"
  ON public.enseignant_classes
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'coordinateur'::app_role) AND is_maternelle_or_primary_class(classe_id));
