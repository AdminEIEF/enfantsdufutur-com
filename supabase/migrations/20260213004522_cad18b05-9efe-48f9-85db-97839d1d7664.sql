-- Add niveau_id to matieres to allow assigning subjects per class level
ALTER TABLE public.matieres ADD COLUMN niveau_id uuid REFERENCES public.niveaux(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_matieres_niveau_id ON public.matieres(niveau_id);
