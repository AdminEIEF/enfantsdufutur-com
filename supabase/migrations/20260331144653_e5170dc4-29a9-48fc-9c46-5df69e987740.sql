-- Only add the missing ones - skip classes (already exists)
-- Re-add evenement_classes and evenements_calendrier with IF NOT EXISTS pattern
DO $$
BEGIN
  -- Check and create policy for evenement_classes
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'evenement_classes' AND policyname = 'Coordinateur_secondaire can manage evenement_classes') THEN
    CREATE POLICY "Coordinateur_secondaire can manage evenement_classes"
    ON public.evenement_classes FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'coordinateur_secondaire'::app_role))
    WITH CHECK (has_role(auth.uid(), 'coordinateur_secondaire'::app_role));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'evenements_calendrier' AND policyname = 'Coordinateur_secondaire can manage evenements_calendrier') THEN
    CREATE POLICY "Coordinateur_secondaire can manage evenements_calendrier"
    ON public.evenements_calendrier FOR ALL TO authenticated
    USING (has_role(auth.uid(), 'coordinateur_secondaire'::app_role))
    WITH CHECK (has_role(auth.uid(), 'coordinateur_secondaire'::app_role));
  END IF;
END $$;