
-- Allow coordinateur_secondaire to read employes (for secondary teachers)
CREATE POLICY "Coordinateur_secondaire can read employes"
ON public.employes FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'coordinateur_secondaire'::app_role));

-- Allow coordinateur_secondaire to read classes
CREATE POLICY "Coordinateur_secondaire can read classes"
ON public.classes FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'coordinateur_secondaire'::app_role));

-- Allow coordinateur_secondaire to read niveaux
CREATE POLICY "Coordinateur_secondaire can read niveaux"
ON public.niveaux FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'coordinateur_secondaire'::app_role));

-- Allow coordinateur_secondaire to read matieres
CREATE POLICY "Coordinateur_secondaire can read matieres"
ON public.matieres FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'coordinateur_secondaire'::app_role));

-- Allow coordinateur_secondaire to read enseignant_classes
CREATE POLICY "Coordinateur_secondaire can read enseignant_classes"
ON public.enseignant_classes FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'coordinateur_secondaire'::app_role));

-- Allow coordinateur_secondaire to read classe_matieres
CREATE POLICY "Coordinateur_secondaire can read classe_matieres"
ON public.classe_matieres FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'coordinateur_secondaire'::app_role));
