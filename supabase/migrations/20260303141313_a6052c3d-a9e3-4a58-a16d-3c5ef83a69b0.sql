
-- Helper function: check if a class belongs to the primary cycle
CREATE OR REPLACE FUNCTION public.is_primary_class(_classe_id uuid)
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
    WHERE c.id = _classe_id AND cy.nom = 'Primaire'
  )
$$;

-- Helper function: check if a niveau belongs to primary cycle
CREATE OR REPLACE FUNCTION public.is_primary_niveau(_niveau_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.niveaux n
    JOIN public.cycles cy ON cy.id = n.cycle_id
    WHERE n.id = _niveau_id AND cy.nom = 'Primaire'
  )
$$;

-- COURS: coordinateur can read/manage primary courses
CREATE POLICY "Coordinateur can read primary cours"
ON public.cours FOR SELECT
USING (has_role(auth.uid(), 'coordinateur'::app_role) AND is_primary_class(classe_id));

CREATE POLICY "Coordinateur can manage primary cours"
ON public.cours FOR ALL
USING (has_role(auth.uid(), 'coordinateur'::app_role) AND is_primary_class(classe_id));

-- DEVOIRS: coordinateur can read/manage primary devoirs
CREATE POLICY "Coordinateur can read primary devoirs"
ON public.devoirs FOR SELECT
USING (has_role(auth.uid(), 'coordinateur'::app_role) AND is_primary_class(classe_id));

CREATE POLICY "Coordinateur can manage primary devoirs"
ON public.devoirs FOR ALL
USING (has_role(auth.uid(), 'coordinateur'::app_role) AND is_primary_class(classe_id));

-- EMPLOI DU TEMPS: coordinateur can read/manage primary
CREATE POLICY "Coordinateur can read primary emploi_du_temps"
ON public.emploi_du_temps FOR SELECT
USING (has_role(auth.uid(), 'coordinateur'::app_role) AND is_primary_class(classe_id));

CREATE POLICY "Coordinateur can manage primary emploi_du_temps"
ON public.emploi_du_temps FOR ALL
USING (has_role(auth.uid(), 'coordinateur'::app_role) AND is_primary_class(classe_id));

-- NOTES: coordinateur can read/manage primary notes (via eleve -> classe -> niveau -> cycle)
CREATE POLICY "Coordinateur can manage primary notes"
ON public.notes FOR ALL
USING (
  has_role(auth.uid(), 'coordinateur'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.eleves e 
    WHERE e.id = notes.eleve_id 
    AND e.classe_id IS NOT NULL 
    AND is_primary_class(e.classe_id)
  )
);

-- EVENEMENTS CALENDRIER: coordinateur can read/manage
CREATE POLICY "Coordinateur can read evenements_calendrier"
ON public.evenements_calendrier FOR SELECT
USING (has_role(auth.uid(), 'coordinateur'::app_role));

CREATE POLICY "Coordinateur can manage evenements_calendrier"
ON public.evenements_calendrier FOR ALL
USING (has_role(auth.uid(), 'coordinateur'::app_role));

-- BULLETIN PUBLICATIONS: coordinateur can read/manage primary
CREATE POLICY "Coordinateur can read primary bulletin_publications"
ON public.bulletin_publications FOR SELECT
USING (has_role(auth.uid(), 'coordinateur'::app_role) AND is_primary_class(classe_id));

CREATE POLICY "Coordinateur can manage primary bulletin_publications"
ON public.bulletin_publications FOR ALL
USING (has_role(auth.uid(), 'coordinateur'::app_role) AND is_primary_class(classe_id));

-- CLASSES: coordinateur can read primary classes
CREATE POLICY "Coordinateur can read primary classes"
ON public.classes FOR SELECT
USING (has_role(auth.uid(), 'coordinateur'::app_role) AND is_primary_class(id));

-- ELEVES: coordinateur can read primary eleves
CREATE POLICY "Coordinateur can read primary eleves"
ON public.eleves FOR SELECT
USING (has_role(auth.uid(), 'coordinateur'::app_role) AND classe_id IS NOT NULL AND is_primary_class(classe_id));

-- SOUMISSIONS DEVOIRS: coordinateur can manage primary soumissions
CREATE POLICY "Coordinateur can manage primary soumissions"
ON public.soumissions_devoirs FOR ALL
USING (
  has_role(auth.uid(), 'coordinateur'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.devoirs d
    WHERE d.id = soumissions_devoirs.devoir_id
    AND is_primary_class(d.classe_id)
  )
);

-- ENSEIGNANT_CLASSES: coordinateur can read primary
CREATE POLICY "Coordinateur can read primary enseignant_classes"
ON public.enseignant_classes FOR SELECT
USING (has_role(auth.uid(), 'coordinateur'::app_role) AND is_primary_class(classe_id));

-- EMPLOYES: coordinateur can read enseignants (needed for emploi du temps)
CREATE POLICY "Coordinateur can read employes"
ON public.employes FOR SELECT
USING (has_role(auth.uid(), 'coordinateur'::app_role));
