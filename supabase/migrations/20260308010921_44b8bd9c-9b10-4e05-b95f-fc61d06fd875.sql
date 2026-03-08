
-- Allow surveillant to read eleves
CREATE POLICY "Surveillant can read eleves"
ON public.eleves
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'surveillant'::app_role));

-- Allow surveillant to manage pointages_eleves
CREATE POLICY "Surveillant can manage pointages_eleves"
ON public.pointages_eleves
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'surveillant'::app_role))
WITH CHECK (has_role(auth.uid(), 'surveillant'::app_role));

-- Allow surveillant to read classes
CREATE POLICY "Surveillant can read classes"
ON public.classes
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'surveillant'::app_role));

-- Allow surveillant to read niveaux (already has public read, but explicit)
CREATE POLICY "Surveillant can read niveaux"
ON public.niveaux
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'surveillant'::app_role));

-- Allow surveillant to insert parent_notifications
CREATE POLICY "Surveillant can insert parent_notifications"
ON public.parent_notifications
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'surveillant'::app_role));

-- Allow surveillant to read cycles for grouping by niveau
CREATE POLICY "Surveillant can read cycles"
ON public.cycles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'surveillant'::app_role));
