
-- Add bareme (grading scale) to cycles table
ALTER TABLE public.cycles ADD COLUMN bareme integer NOT NULL DEFAULT 20;

-- Update baremes based on typical school structure
-- (User can adjust later in Configuration)

-- Add cycle_id to tarifs for linking scolarité to cycles
ALTER TABLE public.tarifs ADD COLUMN cycle_id uuid REFERENCES public.cycles(id) ON DELETE SET NULL;
