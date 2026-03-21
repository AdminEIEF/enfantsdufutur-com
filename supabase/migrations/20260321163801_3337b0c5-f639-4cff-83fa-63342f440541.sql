
-- Table pour stocker les positions GPS des bus en temps réel
CREATE TABLE public.bus_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicule_id UUID REFERENCES public.vehicules_transport(id) ON DELETE CASCADE NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  vitesse DOUBLE PRECISION DEFAULT 0,
  cap DOUBLE PRECISION DEFAULT 0,
  statut TEXT NOT NULL DEFAULT 'en_route',
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour requêtes rapides par véhicule
CREATE INDEX idx_bus_positions_vehicule ON public.bus_positions(vehicule_id, created_at DESC);

-- Activer RLS
ALTER TABLE public.bus_positions ENABLE ROW LEVEL SECURITY;

-- Politique: staff authentifié peut tout lire
CREATE POLICY "Staff can read bus positions" ON public.bus_positions
  FOR SELECT TO authenticated USING (true);

-- Politique: staff authentifié peut insérer
CREATE POLICY "Staff can insert bus positions" ON public.bus_positions
  FOR INSERT TO authenticated WITH CHECK (true);

-- Activer le realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bus_positions;
