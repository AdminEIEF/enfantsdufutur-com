
-- Table pour les zones de transport
CREATE TABLE public.zones_transport (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  prix_mensuel NUMERIC NOT NULL DEFAULT 0,
  chauffeur_bus TEXT,
  quartiers TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.zones_transport ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage zones_transport"
  ON public.zones_transport FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read zones_transport"
  ON public.zones_transport FOR SELECT
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_zones_transport_updated_at
  BEFORE UPDATE ON public.zones_transport
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Modify eleves table: change transport_zone to reference zone_transport_id
ALTER TABLE public.eleves ADD COLUMN zone_transport_id UUID REFERENCES public.zones_transport(id);
