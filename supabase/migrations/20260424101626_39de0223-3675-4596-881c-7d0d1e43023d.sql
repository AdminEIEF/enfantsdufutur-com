
-- Drop existing restrictive policies on composition_reponses
DROP POLICY IF EXISTS "Staff can view reponses" ON public.composition_reponses;
DROP POLICY IF EXISTS "Staff can manage reponses" ON public.composition_reponses;

-- Recreate with coordinator support
CREATE POLICY "Staff and coords can view reponses"
ON public.composition_reponses FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'superviseur'::app_role)
  OR (has_role(auth.uid(), 'coordinateur'::app_role) AND EXISTS (
    SELECT 1 FROM public.compositions co
    WHERE co.id = composition_reponses.composition_id
      AND public.is_maternelle_or_primary_class(co.classe_id)
  ))
  OR (has_role(auth.uid(), 'coordinateur_secondaire'::app_role) AND EXISTS (
    SELECT 1 FROM public.compositions co
    WHERE co.id = composition_reponses.composition_id
      AND public.is_secondary_class(co.classe_id)
  ))
);

CREATE POLICY "Staff and coords can manage reponses"
ON public.composition_reponses FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'superviseur'::app_role)
  OR (has_role(auth.uid(), 'coordinateur'::app_role) AND EXISTS (
    SELECT 1 FROM public.compositions co
    WHERE co.id = composition_reponses.composition_id
      AND public.is_maternelle_or_primary_class(co.classe_id)
  ))
  OR (has_role(auth.uid(), 'coordinateur_secondaire'::app_role) AND EXISTS (
    SELECT 1 FROM public.compositions co
    WHERE co.id = composition_reponses.composition_id
      AND public.is_secondary_class(co.classe_id)
  ))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'superviseur'::app_role)
  OR (has_role(auth.uid(), 'coordinateur'::app_role) AND EXISTS (
    SELECT 1 FROM public.compositions co
    WHERE co.id = composition_reponses.composition_id
      AND public.is_maternelle_or_primary_class(co.classe_id)
  ))
  OR (has_role(auth.uid(), 'coordinateur_secondaire'::app_role) AND EXISTS (
    SELECT 1 FROM public.compositions co
    WHERE co.id = composition_reponses.composition_id
      AND public.is_secondary_class(co.classe_id)
  ))
);

-- Same for composition_questions (read access for rapport detail)
DROP POLICY IF EXISTS "Staff can manage questions" ON public.composition_questions;

CREATE POLICY "Staff and coords can view questions"
ON public.composition_questions FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'superviseur'::app_role)
  OR (has_role(auth.uid(), 'coordinateur'::app_role) AND EXISTS (
    SELECT 1 FROM public.compositions co
    WHERE co.id = composition_questions.composition_id
      AND public.is_maternelle_or_primary_class(co.classe_id)
  ))
  OR (has_role(auth.uid(), 'coordinateur_secondaire'::app_role) AND EXISTS (
    SELECT 1 FROM public.compositions co
    WHERE co.id = composition_questions.composition_id
      AND public.is_secondary_class(co.classe_id)
  ))
);

CREATE POLICY "Staff can manage questions"
ON public.composition_questions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superviseur'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superviseur'::app_role));
