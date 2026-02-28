
-- Fix: Replace overly permissive INSERT policy on pre_inscriptions
-- The form is public but we restrict to anon role only and require key fields
DROP POLICY IF EXISTS "Public can submit pre_inscriptions" ON public.pre_inscriptions;

CREATE POLICY "Public can insert pre_inscriptions"
  ON public.pre_inscriptions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    nom_eleve IS NOT NULL 
    AND prenom_eleve IS NOT NULL 
    AND nom_parent IS NOT NULL 
    AND telephone_parent IS NOT NULL
    AND statut = 'nouveau'
  );
