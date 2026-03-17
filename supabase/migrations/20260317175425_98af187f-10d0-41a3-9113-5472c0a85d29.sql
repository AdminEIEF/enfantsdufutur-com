
-- Add coordinateur_secondaire to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordinateur_secondaire';
