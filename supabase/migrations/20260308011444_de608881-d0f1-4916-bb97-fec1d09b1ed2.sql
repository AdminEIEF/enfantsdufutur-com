-- RLS: Pointeur can read eleves
CREATE POLICY "Pointeur can read eleves"
ON public.eleves FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'pointeur'::app_role));

-- RLS: Pointeur can manage pointages_eleves
CREATE POLICY "Pointeur can manage pointages_eleves"
ON public.pointages_eleves FOR ALL TO authenticated
USING (has_role(auth.uid(), 'pointeur'::app_role))
WITH CHECK (has_role(auth.uid(), 'pointeur'::app_role));

-- RLS: Pointeur can insert parent_notifications
CREATE POLICY "Pointeur can insert parent_notifications"
ON public.parent_notifications FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'pointeur'::app_role));

-- RLS: Pointeur can read classes
CREATE POLICY "Pointeur can read classes"
ON public.classes FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'pointeur'::app_role));

-- RLS: Pointeur can read niveaux
CREATE POLICY "Pointeur can read niveaux"
ON public.niveaux FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'pointeur'::app_role));

-- RLS: Pointeur can read cycles
CREATE POLICY "Pointeur can read cycles"
ON public.cycles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'pointeur'::app_role));