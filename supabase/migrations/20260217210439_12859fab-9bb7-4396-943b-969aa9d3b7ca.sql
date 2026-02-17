
-- Create boutique_articles table with size management
CREATE TABLE public.boutique_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  categorie text NOT NULL,
  taille text NOT NULL DEFAULT 'unique',
  prix numeric NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.boutique_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Boutique can manage boutique_articles"
  ON public.boutique_articles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'boutique'::app_role));

CREATE POLICY "Authenticated can read boutique_articles"
  ON public.boutique_articles FOR SELECT
  USING (true);

-- Create boutique_ventes table
CREATE TABLE public.boutique_ventes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id uuid NOT NULL REFERENCES public.eleves(id),
  montant_total numeric NOT NULL DEFAULT 0,
  remise_pct numeric NOT NULL DEFAULT 0,
  montant_final numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.boutique_ventes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Boutique can manage boutique_ventes"
  ON public.boutique_ventes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'boutique'::app_role));

CREATE POLICY "Staff can read boutique_ventes"
  ON public.boutique_ventes FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'boutique'::app_role) OR has_role(auth.uid(), 'comptable'::app_role));

-- Create boutique_vente_items table
CREATE TABLE public.boutique_vente_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vente_id uuid NOT NULL REFERENCES public.boutique_ventes(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.boutique_articles(id),
  quantite integer NOT NULL DEFAULT 1,
  prix_unitaire numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.boutique_vente_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Boutique can manage boutique_vente_items"
  ON public.boutique_vente_items FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'boutique'::app_role));

CREATE POLICY "Staff can read boutique_vente_items"
  ON public.boutique_vente_items FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'boutique'::app_role) OR has_role(auth.uid(), 'comptable'::app_role));

-- Trigger to decrement boutique stock on sale
CREATE OR REPLACE FUNCTION public.decrement_boutique_stock()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.boutique_articles
  SET stock = stock - NEW.quantite, updated_at = now()
  WHERE id = NEW.article_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_decrement_boutique_stock
  AFTER INSERT ON public.boutique_vente_items
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_boutique_stock();

CREATE TRIGGER update_boutique_articles_updated_at
  BEFORE UPDATE ON public.boutique_articles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
