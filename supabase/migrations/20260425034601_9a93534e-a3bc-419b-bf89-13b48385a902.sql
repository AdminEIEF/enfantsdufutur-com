CREATE OR REPLACE FUNCTION public.notify_student_note_recorded()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _matiere_nom text;
  _periode_nom text;
  _bareme numeric;
BEGIN
  IF NEW.note IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT nom INTO _matiere_nom FROM public.matieres WHERE id = NEW.matiere_id;
  SELECT p.nom INTO _periode_nom FROM public.periodes p WHERE p.id = NEW.periode_id;

  SELECT c.bareme INTO _bareme
  FROM public.eleves e
  JOIN public.classes cl ON cl.id = e.classe_id
  JOIN public.niveaux n ON n.id = cl.niveau_id
  JOIN public.cycles c ON c.id = n.cycle_id
  WHERE e.id = NEW.eleve_id;

  INSERT INTO public.student_notifications (eleve_id, titre, message, type)
  VALUES (
    NEW.eleve_id,
    '📊 Nouvelle note',
    'Vous avez obtenu ' || NEW.note::text || '/' || COALESCE(_bareme, 20)::text || ' en ' || COALESCE(_matiere_nom, 'matière') || ' (' || COALESCE(_periode_nom, '') || ').',
    'info'
  );
  RETURN NEW;
END;
$function$;