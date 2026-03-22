
-- 1. Trigger: Notify students when a new devoir is created
CREATE OR REPLACE FUNCTION public.notify_student_new_devoir()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _matiere_nom text;
BEGIN
  SELECT nom INTO _matiere_nom FROM public.matieres WHERE id = NEW.matiere_id;
  
  INSERT INTO public.student_notifications (eleve_id, titre, message, type)
  SELECT e.id,
    '📝 Nouveau devoir',
    'Nouveau devoir en ' || COALESCE(_matiere_nom, 'matière') || ' : "' || NEW.titre || '". À rendre avant le ' || to_char(NEW.date_limite::date, 'DD/MM/YYYY') || '.',
    'info'
  FROM public.eleves e
  WHERE e.classe_id = NEW.classe_id AND e.statut = 'inscrit' AND e.deleted_at IS NULL;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_student_new_devoir ON public.devoirs;
CREATE TRIGGER trg_notify_student_new_devoir
AFTER INSERT ON public.devoirs
FOR EACH ROW EXECUTE FUNCTION public.notify_student_new_devoir();

-- 2. Trigger: Notify student when a note is recorded
CREATE OR REPLACE FUNCTION public.notify_student_note_recorded()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _matiere_nom text;
  _periode_nom text;
BEGIN
  SELECT nom INTO _matiere_nom FROM public.matieres WHERE id = NEW.matiere_id;
  SELECT p.nom INTO _periode_nom FROM public.periodes p WHERE p.id = NEW.periode_id;

  INSERT INTO public.student_notifications (eleve_id, titre, message, type)
  VALUES (
    NEW.eleve_id,
    '📊 Nouvelle note',
    'Vous avez obtenu ' || NEW.note::text || '/' || NEW.bareme::text || ' en ' || COALESCE(_matiere_nom, 'matière') || ' (' || COALESCE(_periode_nom, '') || ').',
    'info'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_student_note ON public.notes;
CREATE TRIGGER trg_notify_student_note
AFTER INSERT ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.notify_student_note_recorded();

-- 3. Trigger: Notify students when a new cours is published
CREATE OR REPLACE FUNCTION public.notify_student_new_cours()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _matiere_nom text;
BEGIN
  IF NEW.visible = true THEN
    SELECT nom INTO _matiere_nom FROM public.matieres WHERE id = NEW.matiere_id;
    
    INSERT INTO public.student_notifications (eleve_id, titre, message, type)
    SELECT e.id,
      '📚 Nouveau cours disponible',
      'Un nouveau cours en ' || COALESCE(_matiere_nom, 'matière') || ' : "' || NEW.titre || '" est disponible.',
      'info'
    FROM public.eleves e
    WHERE e.classe_id = NEW.classe_id AND e.statut = 'inscrit' AND e.deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_student_new_cours ON public.cours;
CREATE TRIGGER trg_notify_student_new_cours
AFTER INSERT ON public.cours
FOR EACH ROW EXECUTE FUNCTION public.notify_student_new_cours();

-- 4. Trigger: Notify students when bulletin is published
CREATE OR REPLACE FUNCTION public.notify_student_bulletin_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _periode_nom text;
BEGIN
  IF NEW.visible_parent = true THEN
    SELECT p.nom INTO _periode_nom FROM public.periodes p WHERE p.id = NEW.periode_id;
    
    INSERT INTO public.student_notifications (eleve_id, titre, message, type)
    SELECT e.id,
      '🎓 Bulletin publié',
      'Votre bulletin de la période "' || COALESCE(_periode_nom, '') || '" est maintenant disponible.',
      'info'
    FROM public.eleves e
    WHERE e.classe_id = NEW.classe_id AND e.statut = 'inscrit' AND e.deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_student_bulletin ON public.bulletin_publications;
CREATE TRIGGER trg_notify_student_bulletin
AFTER INSERT OR UPDATE ON public.bulletin_publications
FOR EACH ROW EXECUTE FUNCTION public.notify_student_bulletin_published();

-- 5. Trigger: Notify student when cantine balance is low
CREATE OR REPLACE FUNCTION public.notify_student_cantine_low()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.solde_cantine IS NOT NULL AND NEW.solde_cantine < 5000
    AND (OLD.solde_cantine IS NULL OR OLD.solde_cantine >= 5000) THEN
    INSERT INTO public.student_notifications (eleve_id, titre, message, type)
    VALUES (
      NEW.id,
      '🍽️ Solde cantine faible',
      'Votre solde cantine est de ' || NEW.solde_cantine::text || ' GNF. Pensez à recharger.',
      'alerte'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_student_cantine_low ON public.eleves;
CREATE TRIGGER trg_notify_student_cantine_low
AFTER UPDATE ON public.eleves
FOR EACH ROW EXECUTE FUNCTION public.notify_student_cantine_low();

-- 6. Trigger: Notify student on calendar event for their class
CREATE OR REPLACE FUNCTION public.notify_student_calendar_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.classe_id IS NOT NULL THEN
    INSERT INTO public.student_notifications (eleve_id, titre, message, type)
    SELECT e.id,
      '📅 ' || NEW.titre,
      COALESCE(NEW.description, 'Nouvel événement le ' || to_char(NEW.date_debut::date, 'DD/MM/YYYY')),
      'info'
    FROM public.eleves e
    WHERE e.classe_id = NEW.classe_id AND e.statut = 'inscrit' AND e.deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_student_calendar ON public.evenements_calendrier;
CREATE TRIGGER trg_notify_student_calendar
AFTER INSERT ON public.evenements_calendrier
FOR EACH ROW EXECUTE FUNCTION public.notify_student_calendar_event();
