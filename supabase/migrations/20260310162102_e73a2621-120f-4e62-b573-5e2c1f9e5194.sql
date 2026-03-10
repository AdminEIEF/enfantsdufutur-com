
-- Table for support/assistance messages between users and supervisor
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  sender_type text NOT NULL DEFAULT 'admin', -- 'admin', 'parent', 'employe', 'eleve'
  sender_name text NOT NULL,
  sender_email text,
  message text NOT NULL,
  reply text,
  replied_by uuid,
  replied_at timestamptz,
  lu boolean NOT NULL DEFAULT false,
  statut text NOT NULL DEFAULT 'ouvert', -- 'ouvert', 'en_cours', 'resolu'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Superviseur can do everything
CREATE POLICY "Superviseur can manage all support_messages"
ON public.support_messages FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'superviseur'::app_role))
WITH CHECK (has_role(auth.uid(), 'superviseur'::app_role));

-- Admin can manage all support_messages
CREATE POLICY "Admin can manage all support_messages"
ON public.support_messages FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can insert their own messages
CREATE POLICY "Users can insert own support_messages"
ON public.support_messages FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid());

-- Authenticated users can read their own messages
CREATE POLICY "Users can read own support_messages"
ON public.support_messages FOR SELECT
TO authenticated
USING (sender_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
