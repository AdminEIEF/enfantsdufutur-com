
-- Add chauffeur phone number to zones_transport
ALTER TABLE public.zones_transport ADD COLUMN telephone_chauffeur text DEFAULT NULL;
