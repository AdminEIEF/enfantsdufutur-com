CREATE OR REPLACE FUNCTION public.get_landing_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'eleves', (SELECT count(*) FROM eleves WHERE statut = 'inscrit' AND deleted_at IS NULL),
    'enseignants', (SELECT count(*) FROM employes WHERE categorie = 'enseignant' AND statut = 'actif')
  );
$$;