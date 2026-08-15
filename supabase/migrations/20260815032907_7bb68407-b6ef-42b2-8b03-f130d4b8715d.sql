UPDATE public.parametres
SET valeur = jsonb_build_object(
  'nom', 'Ecole Internationale Les Enfants du Futur',
  'soustitre', 'Enseignement Général et Technique',
  'ville', 'Sanoyah Rails, Commune de Sanoyah',
  'telephone', '(+224) 625 54 95 79 / 664 03 98 41',
  'logo_url', ''
)
WHERE cle = 'school_config';