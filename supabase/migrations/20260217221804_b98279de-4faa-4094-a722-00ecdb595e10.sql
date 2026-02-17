
ALTER TABLE public.depenses DROP CONSTRAINT IF EXISTS depenses_service_check;
ALTER TABLE public.depenses ADD CONSTRAINT depenses_service_check CHECK (service IN ('Scolarité', 'Transport', 'Boutique', 'Cantine', 'Librairie', 'Fonctionnement', 'Autre'));
