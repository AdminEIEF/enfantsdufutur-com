
-- Allow coordinateur to read employes that are assigned to primary/maternelle classes
CREATE POLICY "Coordinateur can read primary employes"
ON public.employes
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coordinateur'::app_role)
  AND (
    -- Enseignants assigned to primary/maternelle classes
    EXISTS (
      SELECT 1 FROM enseignant_classes ec
      JOIN classes c ON c.id = ec.classe_id
      WHERE ec.employe_id = employes.id
      AND is_maternelle_or_primary_class(c.id)
    )
  )
);

-- Also allow coordinateur to insert employes
CREATE POLICY "Coordinateur can insert employes"
ON public.employes
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'coordinateur'::app_role));

-- Allow coordinateur to update employes assigned to primary
CREATE POLICY "Coordinateur can update primary employes"
ON public.employes
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'coordinateur'::app_role)
  AND EXISTS (
    SELECT 1 FROM enseignant_classes ec
    JOIN classes c ON c.id = ec.classe_id
    WHERE ec.employe_id = employes.id
    AND is_maternelle_or_primary_class(c.id)
  )
);

-- Allow coordinateur to manage enseignant_classes for primary classes
CREATE POLICY "Coordinateur can manage primary enseignant_classes"
ON public.enseignant_classes
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'coordinateur'::app_role)
  AND is_maternelle_or_primary_class(classe_id)
)
WITH CHECK (
  has_role(auth.uid(), 'coordinateur'::app_role)
  AND is_maternelle_or_primary_class(classe_id)
);
