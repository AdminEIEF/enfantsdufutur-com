-- Drop overly permissive policies
DROP POLICY "Anon can count eleves" ON public.eleves;
DROP POLICY "Anon can count employes" ON public.employes;

-- Create a secure function that only returns counts
CREATE OR REPLACE FUNCTION public.get_landing_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'eleves', (SELECT count(*) FROM eleves WHERE statut = 'actif' AND deleted_at IS NULL),
    'enseignants', (SELECT count(*) FROM employes WHERE categorie = 'enseignant' AND statut = 'actif')
  );
$$;

-- Allow anonymous access to this function
GRANT EXECUTE ON FUNCTION public.get_landing_stats() TO anon;