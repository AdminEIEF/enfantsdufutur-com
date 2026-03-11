import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MajorEleve {
  id: string;
  nom: string;
  prenom: string;
  photo_url: string | null;
  qr_code: string | null;
  classe_nom: string;
  niveau_nom: string;
  cycle_nom: string;
  moyenne: number;
}

export interface NiveauPerformance {
  niveau_id: string;
  niveau_nom: string;
  cycle_nom: string;
  moyenne_niveau: number;
  effectif: number;
  nb_reussite: number;
  taux_reussite: number;
}

export function usePerformanceData(periodeId?: string) {
  // Fetch all periodes
  const { data: periodes = [] } = useQuery({
    queryKey: ['perf-periodes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('periodes')
        .select('id, nom, ordre, annee_scolaire')
        .order('ordre');
      if (error) throw error;
      return data;
    },
  });

  // Fetch notes with eleve + matiere info
  const { data: rawData, isLoading } = useQuery({
    queryKey: ['perf-notes', periodeId],
    queryFn: async () => {
      let query = supabase
        .from('notes')
        .select('eleve_id, note, matiere_id, periode_id, matieres(coefficient, niveau_id)');

      if (periodeId) {
        query = query.eq('periode_id', periodeId);
      }

      const { data: notes, error: notesErr } = await query;
      if (notesErr) throw notesErr;

      const { data: eleves, error: elevesErr } = await supabase
        .from('eleves')
        .select('id, nom, prenom, photo_url, sexe, qr_code, classe_id, classes(nom, niveau_id, niveaux:niveau_id(id, nom, cycle_id, cycles:cycle_id(nom)))')
        .is('deleted_at', null)
        .eq('statut', 'inscrit');
      if (elevesErr) throw elevesErr;

      const { data: niveaux, error: nivErr } = await supabase
        .from('niveaux')
        .select('id, nom, ordre, cycle_id, cycles:cycle_id(nom)')
        .order('ordre');
      if (nivErr) throw nivErr;

      return { notes: notes || [], eleves: eleves || [], niveaux: niveaux || [] };
    },
  });

  const notes = rawData?.notes || [];
  const eleves = rawData?.eleves || [];
  const niveaux = rawData?.niveaux || [];

  // Compute weighted average per student
  const eleveMoyennes = new Map<string, { total: number; coefTotal: number }>();

  for (const n of notes) {
    if (n.note == null) continue;
    const coef = (n.matieres as any)?.coefficient || 1;
    const prev = eleveMoyennes.get(n.eleve_id) || { total: 0, coefTotal: 0 };
    prev.total += n.note * coef;
    prev.coefTotal += coef;
    eleveMoyennes.set(n.eleve_id, prev);
  }

  // Build eleve map
  const eleveMap = new Map(eleves.map((e: any) => [e.id, e]));

  // Build performance per niveau
  const niveauMap = new Map<string, { sum: number; count: number; reussite: number }>();

  for (const [eleveId, { total, coefTotal }] of eleveMoyennes) {
    if (coefTotal === 0) continue;
    const moy = total / coefTotal;
    const eleve = eleveMap.get(eleveId) as any;
    if (!eleve?.classes?.niveaux) continue;
    const niveauId = eleve.classes.niveaux.id;
    const prev = niveauMap.get(niveauId) || { sum: 0, count: 0, reussite: 0 };
    prev.sum += moy;
    prev.count += 1;
    if (moy >= 10) prev.reussite += 1;
    niveauMap.set(niveauId, prev);
  }

  const niveauPerformances: NiveauPerformance[] = niveaux
    .filter((n: any) => niveauMap.has(n.id))
    .map((n: any) => {
      const stats = niveauMap.get(n.id)!;
      return {
        niveau_id: n.id,
        niveau_nom: n.nom,
        cycle_nom: (n.cycles as any)?.nom || '',
        moyenne_niveau: stats.count > 0 ? Math.round((stats.sum / stats.count) * 100) / 100 : 0,
        effectif: stats.count,
        nb_reussite: stats.reussite,
        taux_reussite: stats.count > 0 ? Math.round((stats.reussite / stats.count) * 100) : 0,
      };
    });

  // Moyenne générale école
  let totalMoy = 0;
  let totalCount = 0;
  for (const [, { total, coefTotal }] of eleveMoyennes) {
    if (coefTotal > 0) {
      totalMoy += total / coefTotal;
      totalCount += 1;
    }
  }
  const moyenneGenerale = totalCount > 0 ? Math.round((totalMoy / totalCount) * 100) / 100 : 0;

  // Hall of Fame: best student per niveau
  const bestPerNiveau = new Map<string, { eleveId: string; moy: number }>();
  for (const [eleveId, { total, coefTotal }] of eleveMoyennes) {
    if (coefTotal === 0) continue;
    const moy = total / coefTotal;
    const eleve = eleveMap.get(eleveId) as any;
    if (!eleve?.classes?.niveaux) continue;
    const niveauId = eleve.classes.niveaux.id;
    const current = bestPerNiveau.get(niveauId);
    if (!current || moy > current.moy) {
      bestPerNiveau.set(niveauId, { eleveId, moy });
    }
  }

  const majors: MajorEleve[] = niveaux
    .filter((n: any) => bestPerNiveau.has(n.id))
    .map((n: any) => {
      const best = bestPerNiveau.get(n.id)!;
      const eleve = eleveMap.get(best.eleveId) as any;
      return {
        id: eleve.id,
        nom: eleve.nom,
        prenom: eleve.prenom,
        photo_url: eleve.photo_url,
        classe_nom: eleve.classes?.nom || '',
        niveau_nom: n.nom,
        cycle_nom: (n.cycles as any)?.nom || '',
        moyenne: Math.round(best.moy * 100) / 100,
      };
    });

  return {
    periodes,
    niveauPerformances,
    moyenneGenerale,
    majors,
    isLoading,
    totalElevesNotes: totalCount,
  };
}
