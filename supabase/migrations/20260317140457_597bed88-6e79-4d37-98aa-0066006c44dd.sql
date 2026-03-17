
-- Add chauffeur assignment to vehicules_transport
ALTER TABLE public.vehicules_transport
ADD COLUMN chauffeur_id UUID REFERENCES public.employes(id) ON DELETE SET NULL;

-- Create index for quick lookups
CREATE INDEX idx_vehicules_transport_chauffeur ON public.vehicules_transport(chauffeur_id);
