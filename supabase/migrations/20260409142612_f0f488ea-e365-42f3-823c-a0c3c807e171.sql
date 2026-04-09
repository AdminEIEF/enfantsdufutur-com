ALTER TABLE public.notifications DROP CONSTRAINT notifications_destinataire_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_destinataire_type_check CHECK (destinataire_type = ANY (ARRAY['parent'::text, 'staff'::text, 'admin'::text]));
