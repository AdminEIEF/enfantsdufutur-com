
-- Create dedicated table for digital books, separate from articles
CREATE TABLE public.livres_numeriques (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  categorie TEXT NOT NULL CHECK (categorie IN ('roman', 'manuel')),
  prix NUMERIC NOT NULL DEFAULT 0,
  niveau_id UUID REFERENCES public.niveaux(id),
  fichier_url TEXT,
  fichier_nom TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.livres_numeriques ENABLE ROW LEVEL SECURITY;

-- Superviseur and admin full access
CREATE POLICY "admin_superviseur_full_access" ON public.livres_numeriques
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superviseur'));

-- Authenticated users can read
CREATE POLICY "authenticated_read" ON public.livres_numeriques
  FOR SELECT TO authenticated
  USING (true);

-- Migrate existing digital books from articles to livres_numeriques
INSERT INTO public.livres_numeriques (nom, categorie, prix, niveau_id, fichier_url, fichier_nom, created_at, updated_at)
SELECT nom, LOWER(categorie), prix, niveau_id, fichier_url, fichier_nom, created_at, updated_at
FROM public.articles
WHERE fichier_url IS NOT NULL
  AND LOWER(categorie) IN ('roman', 'manuel', 'romans', 'manuels');

-- Update categorie for migrated rows to normalize
UPDATE public.livres_numeriques SET categorie = 'roman' WHERE categorie = 'romans';
UPDATE public.livres_numeriques SET categorie = 'manuel' WHERE categorie = 'manuels';

-- Add updated_at trigger
CREATE TRIGGER update_livres_numeriques_updated_at
  BEFORE UPDATE ON public.livres_numeriques
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
