-- Add soft delete column to eleves
ALTER TABLE public.eleves ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;