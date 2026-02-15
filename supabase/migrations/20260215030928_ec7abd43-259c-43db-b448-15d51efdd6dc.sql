
-- Table articles (fournitures, manuels, romans) with stock management
CREATE TABLE public.articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  categorie TEXT NOT NULL CHECK (categorie IN ('fourniture', 'manuel', 'roman')),
  prix NUMERIC NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  niveau_id UUID REFERENCES public.niveaux(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage articles" ON public.articles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can read articles" ON public.articles FOR SELECT USING (true);

-- Table ventes_articles: track article sales per student, decrement stock
CREATE TABLE public.ventes_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  eleve_id UUID NOT NULL REFERENCES public.eleves(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  quantite INTEGER NOT NULL DEFAULT 1,
  prix_unitaire NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ventes_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Comptable can manage ventes_articles" ON public.ventes_articles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comptable'::app_role));
CREATE POLICY "Staff can read ventes_articles" ON public.ventes_articles FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'comptable'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role));

-- Trigger to auto-decrement stock on sale
CREATE OR REPLACE FUNCTION public.decrement_article_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.articles SET stock = stock - NEW.quantite, updated_at = now() WHERE id = NEW.article_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_decrement_stock
AFTER INSERT ON public.ventes_articles
FOR EACH ROW EXECUTE FUNCTION public.decrement_article_stock();

-- Trigger to increment stock on sale deletion
CREATE OR REPLACE FUNCTION public.increment_article_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.articles SET stock = stock + OLD.quantite, updated_at = now() WHERE id = OLD.article_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_increment_stock
AFTER DELETE ON public.ventes_articles
FOR EACH ROW EXECUTE FUNCTION public.increment_article_stock();
