
-- Table des ventes à crédit
CREATE TABLE public.ventes_credit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  eleve_id UUID NOT NULL REFERENCES public.eleves(id),
  famille_id UUID REFERENCES public.familles(id),
  article_nom TEXT NOT NULL,
  description TEXT,
  prix_total NUMERIC NOT NULL,
  montant_verse NUMERIC NOT NULL DEFAULT 0,
  solde_restant NUMERIC NOT NULL,
  statut TEXT NOT NULL DEFAULT 'en_cours',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Table des versements
CREATE TABLE public.versements_credit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vente_credit_id UUID NOT NULL REFERENCES public.ventes_credit(id) ON DELETE CASCADE,
  montant NUMERIC NOT NULL,
  canal TEXT NOT NULL DEFAULT 'especes',
  reference TEXT,
  date_versement TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.ventes_credit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.versements_credit ENABLE ROW LEVEL SECURITY;

-- RLS policies for ventes_credit
CREATE POLICY "Admin/Boutique can manage ventes_credit" ON public.ventes_credit
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'boutique'::app_role));

CREATE POLICY "Staff can read ventes_credit" ON public.ventes_credit
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'boutique'::app_role) OR has_role(auth.uid(), 'comptable'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role));

-- RLS policies for versements_credit
CREATE POLICY "Admin/Boutique can manage versements_credit" ON public.versements_credit
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'boutique'::app_role));

CREATE POLICY "Staff can read versements_credit" ON public.versements_credit
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'boutique'::app_role) OR has_role(auth.uid(), 'comptable'::app_role) OR has_role(auth.uid(), 'secretaire'::app_role));

-- Trigger to update updated_at
CREATE TRIGGER update_ventes_credit_updated_at
  BEFORE UPDATE ON public.ventes_credit
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update vente_credit totals on versement insert
CREATE OR REPLACE FUNCTION public.update_vente_credit_on_versement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.ventes_credit
  SET montant_verse = montant_verse + NEW.montant,
      solde_restant = solde_restant - NEW.montant,
      statut = CASE WHEN (solde_restant - NEW.montant) <= 0 THEN 'solde' ELSE 'en_cours' END,
      updated_at = now()
  WHERE id = NEW.vente_credit_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_vente_credit_on_versement
  AFTER INSERT ON public.versements_credit
  FOR EACH ROW EXECUTE FUNCTION public.update_vente_credit_on_versement();
