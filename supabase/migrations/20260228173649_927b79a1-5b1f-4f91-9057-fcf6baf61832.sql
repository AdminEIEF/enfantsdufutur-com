DROP POLICY "Public can insert pre_inscriptions" ON public.pre_inscriptions;

CREATE POLICY "Public can insert pre_inscriptions"
  ON public.pre_inscriptions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    nom_eleve IS NOT NULL
    AND prenom_eleve IS NOT NULL
    AND nom_parent IS NOT NULL
    AND telephone_parent IS NOT NULL
  );