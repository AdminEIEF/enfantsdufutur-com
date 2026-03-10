-- Add target_user_id so supervisor can initiate messages to specific users
ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS target_user_id uuid;

-- Add index for quick lookup
CREATE INDEX IF NOT EXISTS idx_support_messages_target_user ON public.support_messages(target_user_id);