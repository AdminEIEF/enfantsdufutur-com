
-- Table to track article orders from inscription through delivery
CREATE TABLE public.commandes_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  eleve_id UUID NOT NULL REFERENCES public.eleves(id),
  article_type TEXT NOT NULL DEFAULT 'boutique', -- 'boutique' or 'librairie'
  article_nom TEXT NOT NULL,
  article_taille TEXT,
  quantite INTEGER NOT NULL DEFAULT 1,
  prix_unitaire NUMERIC NOT NULL DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'paye', -- 'paye' (paid, awaiting pickup) | 'livre' (delivered)
  source TEXT NOT NULL DEFAULT 'inscription', -- 'inscription' | 'vente_directe'
  livre_par UUID,
  livre_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commandes_articles ENABLE ROW LEVEL SECURITY;

-- Staff can read all orders
CREATE POLICY "Staff can read commandes_articles"
  ON public.commandes_articles FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'secretaire'::app_role) OR 
    has_role(auth.uid(), 'boutique'::app_role) OR 
    has_role(auth.uid(), 'librairie'::app_role) OR 
    has_role(auth.uid(), 'comptable'::app_role)
  );

-- Admin/Secretaire can create orders (from inscriptions)
CREATE POLICY "Admin/Secretaire can create commandes_articles"
  ON public.commandes_articles FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'secretaire'::app_role)
  );

-- Boutique/Librairie/Admin can update orders (validate delivery)
CREATE POLICY "Staff can update commandes_articles"
  ON public.commandes_articles FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'boutique'::app_role) OR 
    has_role(auth.uid(), 'librairie'::app_role)
  );

-- Admin can delete orders
CREATE POLICY "Admin can delete commandes_articles"
  ON public.commandes_articles FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Update timestamp trigger
CREATE TRIGGER update_commandes_articles_updated_at
  BEFORE UPDATE ON public.commandes_articles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
