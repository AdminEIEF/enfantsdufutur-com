
-- Table for daily menu items with stock management
CREATE TABLE public.plats_cantine (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom text NOT NULL,
  prix numeric NOT NULL DEFAULT 0,
  stock_journalier integer NOT NULL DEFAULT 100,
  stock_restant integer NOT NULL DEFAULT 100,
  date_stock date NOT NULL DEFAULT CURRENT_DATE,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.plats_cantine ENABLE ROW LEVEL SECURITY;

-- Cantine/Admin can manage plats
CREATE POLICY "Admin/Cantine can manage plats_cantine"
ON public.plats_cantine
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cantine'::app_role));

-- All staff can read plats
CREATE POLICY "Authenticated can read plats_cantine"
ON public.plats_cantine
FOR SELECT
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_plats_cantine_updated_at
BEFORE UPDATE ON public.plats_cantine
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add plat_id to repas_cantine for tracking which plat was consumed
ALTER TABLE public.repas_cantine ADD COLUMN plat_id uuid REFERENCES public.plats_cantine(id);
