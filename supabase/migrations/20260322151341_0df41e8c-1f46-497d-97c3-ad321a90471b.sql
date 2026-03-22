
-- Trigger: auto-create a depense when a bulletin_paie is inserted
CREATE OR REPLACE FUNCTION public.auto_depense_salaire()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _emp RECORD;
  _sous_cat text;
BEGIN
  SELECT nom, prenom, categorie, matricule INTO _emp
  FROM public.employes WHERE id = NEW.employe_id;

  -- Determine sous_categorie based on employee category
  IF _emp.categorie = 'enseignant' THEN
    IF _emp.matricule LIKE 'ESC%' THEN
      _sous_cat := 'Enseignant Secondaire';
    ELSE
      _sous_cat := 'Enseignant Primaire';
    END IF;
  ELSIF _emp.categorie IN ('administration', 'direction', 'service') THEN
    _sous_cat := 'Administration & Direction';
  ELSE
    _sous_cat := 'Personnel de soutien';
  END IF;

  INSERT INTO public.depenses (
    libelle, montant, service, sous_categorie, date_depense, statut, created_by
  ) VALUES (
    'Salaire ' || _emp.prenom || ' ' || _emp.nom || ' — ' || 
    CASE NEW.mois
      WHEN 1 THEN 'Janvier' WHEN 2 THEN 'Février' WHEN 3 THEN 'Mars'
      WHEN 4 THEN 'Avril' WHEN 5 THEN 'Mai' WHEN 6 THEN 'Juin'
      WHEN 7 THEN 'Juillet' WHEN 8 THEN 'Août' WHEN 9 THEN 'Septembre'
      WHEN 10 THEN 'Octobre' WHEN 11 THEN 'Novembre' WHEN 12 THEN 'Décembre'
    END || ' ' || NEW.annee,
    NEW.salaire_net,
    'Salaires',
    _sous_cat,
    now()::date,
    'validee',
    NEW.genere_par
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bulletin_paie_to_depense
AFTER INSERT ON public.bulletins_paie
FOR EACH ROW
EXECUTE FUNCTION public.auto_depense_salaire();
