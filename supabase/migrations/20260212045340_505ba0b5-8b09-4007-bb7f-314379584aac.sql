-- Add unique constraint for notes upsert (eleve_id, matiere_id, periode_id)
ALTER TABLE public.notes ADD CONSTRAINT notes_eleve_matiere_periode_unique UNIQUE (eleve_id, matiere_id, periode_id);