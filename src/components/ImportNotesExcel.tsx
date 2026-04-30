import { useState, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, Download, FileSpreadsheet, AlertTriangle, CheckCircle, Info, UserPlus, Link2, Search, RefreshCw, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { exportToExcel, readExcelFile, readExcelFileAllSheets } from '@/lib/excelUtils';
import { sortClasses } from '@/lib/utils';

interface ImportNotesExcelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportDone: () => void;
}

interface PreviewRow {
  nom: string;
  prenom: string;
  eleve_id?: string;
  eleve_classe_id?: string;
  eleve_classe_nom?: string;
  match_score?: number; // 0..1, 1 = exact, 0 = aucun
  match_type?: 'exact' | 'reverse' | 'fuzzy' | 'manual' | 'none';
  notes: Record<string, number | null>;
  errors: string[];
  duplicate_matieres?: string[]; // matieres avec note déjà existante en BDD
  overwrite_duplicates?: boolean;
  // Multi-onglets : classe d'origine détectée depuis le nom de feuille
  source_sheet?: string;
  source_classe_id?: string;
  source_classe_nom?: string;
}

// Normalisation: minuscules, sans accents, sans ponctuation, espaces simplifiés
function normalize(str: string): string {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Synonymes courants des matières scolaires (clé canonique = forme normalisée)
const MATIERE_ALIASES: Record<string, string[]> = {
  'mathematiques': ['math', 'maths', 'mathematique', 'mathematiques', 'mathematics', 'calc'],
  'francais': ['francais', 'french', 'fr', 'lettres', 'francaise', 'franc'],
  'anglais': ['anglais', 'english', 'eng', 'angl'],
  'arabe': ['arabe', 'arabic', 'ar'],
  'histoire geographie': ['histoire geographie', 'hist geo', 'histgeo', 'h g', 'hg', 'histoire et geographie'],
  'histoire': ['histoire', 'history', 'hist', 'histo'],
  'geographie': ['geographie', 'geography', 'geo', 'geog'],
  'svt': ['svt', 'sciences de la vie et de la terre', 'sciences nat', 'sciences naturelles', 'biologie', 'bio', 'scienc'],
  'physique chimie': ['physique chimie', 'physique', 'chimie', 'pc', 'sciences physiques', 'phys'],
  'eps': ['eps', 'sport', 'education physique', 'education physique et sportive'],
  'eveil': ['eveil', 'eveil scientifique', 'evei'],
  'education civique et morale': ['education civique et morale', 'education civique', 'civisme', 'ecm', 'e c m', 'edu civ', 'eduction civique et morale', 'ec m'],
  'entrepreneuriat': ['entrepreneuriat', 'entrep', 'entreprenariat', 'entr', 'entreprise'],
  'activite scout': ['activite scout', 'scout', 'scoutisme', 'activites scout'],
  'religion': ['religion', 'education religieuse', 'er', 'reli'],
  'dessin': ['dessin', 'arts plastiques', 'arts', 'dess'],
  'musique': ['musique', 'chant', 'education musicale', 'musi'],
  'informatique': ['informatique', 'tic', 'info', 'computer'],
  'lecture': ['lecture', 'reading', 'lectu', 'lect'],
  'ecriture': ['ecriture', 'writing', 'ecri', 'ecrit'],
  'expression ecrite': ['expression ecrite', 'redaction', 'production ecrite', 'expr ecr', 'ee'],
  'expression orale': ['expression orale', 'oral', 'communication orale', 'expr or', 'eo'],
  'calcul': ['calcul', 'calcul mental', 'calc'],
  'philosophie': ['philosophie', 'philo'],
  'conduite': ['conduite', 'comportement', 'cond'],
};

// Variante "compactée" (sans espaces) pour gérer "E C M" -> "ecm", "H G" -> "hg"
function compact(str: string): string {
  return normalize(str).replace(/\s+/g, '');
}

// Cherche le meilleur matching matière pour un nom de colonne
function matchMatiere(colName: string, matieres: any[]): any | null {
  const normCol = normalize(colName);
  const compactCol = compact(colName);
  if (!normCol) return null;

  // Étape 1: match exact normalisé (avec ou sans espaces)
  for (const m of matieres) {
    if (normalize(m.nom) === normCol) return m;
    if (compact(m.nom) === compactCol) return m;
  }

  // Étape 2: alias / synonymes (prioritaire pour abréviations courtes type ECM, HG, SCOUT)
  for (const m of matieres) {
    const normM = normalize(m.nom);
    const compactM = compact(m.nom);
    for (const [canonical, aliases] of Object.entries(MATIERE_ALIASES)) {
      const matiereMatchesGroup =
        normM === canonical ||
        normM.includes(canonical) ||
        canonical.includes(normM) ||
        aliases.some(a => normM === a || normM.includes(a) || compactM === compact(a));
      if (!matiereMatchesGroup) continue;
      const colMatchesGroup =
        normCol === canonical ||
        compactCol === compact(canonical) ||
        aliases.some(a => normCol === a || compactCol === compact(a) || normCol.includes(a));
      if (colMatchesGroup) return m;
    }
  }

  // Étape 3: la colonne contient le nom de la matière OU vice-versa (fallback large)
  for (const m of matieres) {
    const normM = normalize(m.nom);
    if (normM.length >= 4 && (normCol.includes(normM) || normM.includes(normCol))) return m;
  }

  return null;
}

// Distance de Levenshtein pour le scoring de proximité
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1).fill(0).map((_, i) => i);
  const v1 = new Array(b.length + 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let k = 0; k <= b.length; k++) v0[k] = v1[k];
  }
  return v1[b.length];
}

// Similarité 0..1 entre deux chaînes normalisées
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  const dist = levenshtein(na, nb);
  return Math.max(0, 1 - dist / maxLen);
}

// Calcule le score de confiance entre une ligne (nom/prenom/matricule) et un élève
function computeMatchScore(row: { nom: string; prenom: string; matricule?: string }, eleve: any): number {
  // Match matricule = score parfait
  if (row.matricule && eleve.matricule) {
    if (normalize(row.matricule) === normalize(eleve.matricule)) return 1;
  }
  const rowNom = normalize(row.nom);
  const rowPrenom = normalize(row.prenom);
  const eNom = normalize(eleve.nom);
  const ePrenom = normalize(eleve.prenom);

  // Score combiné nom + prénom
  const simNom = similarity(rowNom, eNom);
  const simPrenom = rowPrenom && ePrenom ? similarity(rowPrenom, ePrenom) : 0;
  const simCross = similarity(rowNom, ePrenom) * 0.9 + similarity(rowPrenom, eNom) * 0.9;

  // Match plein nom (concat)
  const simFull = similarity(`${rowNom} ${rowPrenom}`, `${eNom} ${ePrenom}`);
  const simReverse = similarity(`${rowNom} ${rowPrenom}`, `${ePrenom} ${eNom}`);

  if (rowNom && rowPrenom) {
    return Math.max(simFull, simReverse, (simNom * 0.6 + simPrenom * 0.4), simCross / 2);
  }
  // Nom seul
  return Math.max(simNom, simReverse * 0.8, simFull * 0.8);
}

export default function ImportNotesExcel({ open, onOpenChange, onImportDone }: ImportNotesExcelProps) {
  const [cycleId, setCycleId] = useState('');
  const [classeId, setClasseId] = useState('');
  const [periodeId, setPeriodeId] = useState('');
  const [multiMode, setMultiMode] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [matchedMatieres, setMatchedMatieres] = useState<{ col: string; matiere: any | null }[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [globalSearchOpen, setGlobalSearchOpen] = useState<number | null>(null);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [sheetsReport, setSheetsReport] = useState<{ sheet: string; classe?: string; rows: number; matched: number }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: cycles = [] } = useQuery({
    queryKey: ['cycles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cycles').select('*').order('ordre');
      if (error) throw error;
      return data;
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-import', cycleId],
    enabled: !!cycleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*, niveaux!inner(cycle_id, nom, id, ordre)')
        .eq('niveaux.cycle_id', cycleId);
      if (error) throw error;
      return sortClasses(data || []);
    },
  });

  const { data: periodes = [] } = useQuery({
    queryKey: ['periodes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('periodes').select('*').order('ordre');
      if (error) throw error;
      return data;
    },
  });

  const selectedClasse = classes.find((c: any) => c.id === classeId);
  const selectedNiveauId = selectedClasse?.niveaux?.id || null;
  const selectedCycle = cycles.find((c: any) => c.id === cycleId);
  const bareme = selectedCycle?.bareme ?? 20;

  // Matières filtrées par celles COCHÉES pour la classe (classe_matieres).
  // Fallback : si aucune affectation explicite, on prend toutes les matières du cycle/niveau.
  const { data: matieres = [] } = useQuery({
    queryKey: ['matieres-import', cycleId, selectedNiveauId, classeId],
    enabled: !!cycleId,
    queryFn: async () => {
      const { data: all, error } = await supabase.from('matieres').select('*').eq('cycle_id', cycleId).order('ordre');
      if (error) throw error;
      const allMatieres = all || [];

      if (classeId) {
        const { data: cm } = await supabase
          .from('classe_matieres')
          .select('matiere_id, ordre')
          .eq('classe_id', classeId)
          .order('ordre');
        if (cm && cm.length > 0) {
          const byId = new Map(allMatieres.map((m: any) => [m.id, m]));
          // Respecter strictement l'ordre défini dans classe_matieres
          return cm.map((c: any) => byId.get(c.matiere_id)).filter(Boolean);
        }
      }
      // Fallback : matières du niveau ou du cycle
      if (selectedNiveauId) return allMatieres.filter((m: any) => !m.niveau_id || m.niveau_id === selectedNiveauId);
      return allMatieres;
    },
  });

  const { data: eleves = [] } = useQuery({
    queryKey: ['eleves-import', classeId],
    enabled: !!classeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule')
        .eq('classe_id', classeId)
        .eq('statut', 'inscrit')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  // Tous les élèves (toutes classes) pour la recherche globale
  const { data: allEleves = [] } = useQuery({
    queryKey: ['eleves-all-import'],
    enabled: !!preview,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, classe_id, classes(nom)')
        .eq('statut', 'inscrit')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  const canAct = !!cycleId && !!classeId && !!periodeId && matieres.length > 0 && eleves.length > 0;

  const handleDownloadTemplate = async () => {
    if (!canAct) return;
    // Modèle simplifié trié alphabétiquement (cohérent avec le mode position à l'import)
    const elevesSorted = [...eleves].sort((a: any, b: any) =>
      `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr', { sensitivity: 'base' })
    );
    const rows = elevesSorted.map((e: any) => {
      const row: Record<string, any> = {
        'Nom': e.nom,
        'Prénom': e.prenom,
      };
      matieres.forEach((m: any) => {
        row[m.nom] = '';
      });
      return row;
    });

    const className = selectedClasse?.nom || 'classe';
    const periodeName = periodes.find((p: any) => p.id === periodeId)?.nom || 'periode';
    await exportToExcel(rows, `Notes_${className}_${periodeName}`, 'Notes');
    toast({
      title: 'Modèle téléchargé',
      description: `Liste triée par ordre alphabétique. Remplissez les notes (sur /${bareme}) et réimportez.`,
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rows = await readExcelFile(file);
      if (rows.length === 0) {
        toast({ title: 'Fichier vide', variant: 'destructive' });
        return;
      }

      // Identifier les colonnes élève (Nom, Prénom ou Nom complet)
      const colKeys = Object.keys(rows[0]);
      const isNomCol = (k: string) => ['nom', 'noms', 'name', 'names', 'lastname', 'last name', 'nom eleve', 'nom de famille', 'nom famille'].includes(normalize(k));
      const isPrenomCol = (k: string) => ['prenom', 'prenoms', 'firstname', 'first name', 'prenom eleve', 'prenoms eleve'].includes(normalize(k));
      const isFullNameCol = (k: string) => [
        'nom prenom',
        'nom et prenom',
        'nom prenoms',
        'nom et prenoms',
        'nom complet',
        'eleve',
        'eleves',
        'student',
        'full name',
      ].includes(normalize(k));
      const nomKey = colKeys.find(isNomCol);
      const prenomKey = colKeys.find(isPrenomCol);
      const fullNameKey = colKeys.find(isFullNameCol);

      // Mapping colonnes -> matières (intelligent, sans modifier les notes)
      const matiereColMap: Record<string, any> = {};
      const matchInfo: { col: string; matiere: any | null }[] = [];
      colKeys.forEach((col) => {
        // Ignorer les colonnes d'identification élève
        const norm = normalize(col);
        if (isNomCol(col) || isPrenomCol(col) || isFullNameCol(col) || ['matricule', 'id'].includes(norm)) return;
        const matched = matchMatiere(col, matieres);
        if (matched) {
          matiereColMap[col] = matched;
          matchInfo.push({ col, matiere: matched });
        } else {
          matchInfo.push({ col, matiere: null });
        }
      });
      setMatchedMatieres(matchInfo);

      // Mode "position" : si le fichier a exactement le même nombre de lignes que d'élèves
      // dans la classe ET que les noms correspondent globalement, on associe par ordre.
      // Cela résout le cas des fichiers avec uniquement le nom de famille (BARRY, CAMARA…).
      const elevesSorted = [...eleves].sort((a: any, b: any) =>
        `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr', { sensitivity: 'base' })
      );
      const sameRowCount = rows.length === elevesSorted.length;

      const previewRows: PreviewRow[] = rows.map((row, idx) => {
        const fullName = fullNameKey ? String(row[fullNameKey] || '').trim() : '';
        const nom = nomKey ? String(row[nomKey] || '').trim() : fullName;
        const prenom = prenomKey ? String(row[prenomKey] || '').trim() : '';
        const displayName = fullName || `${nom} ${prenom}`.trim();
        const errors: string[] = [];

        let eleve: any = null;
        let matchType: PreviewRow['match_type'] = 'none';
        let matchScore = 0;

        // Priorité 1 : correspondance EXACTE (Nom=Nom, Prénom=Prénom)
        if (nom && prenom) {
          eleve = eleves.find((e: any) =>
            normalize(e.nom) === normalize(nom) && normalize(e.prenom) === normalize(prenom)
          );
          if (eleve) { matchType = 'exact'; matchScore = 1; }
        }

        // Priorité 2 : INVERSION (Nom↔Prénom)
        if (!eleve && nom && prenom) {
          eleve = eleves.find((e: any) =>
            normalize(e.nom) === normalize(prenom) && normalize(e.prenom) === normalize(nom)
          );
          if (eleve) { matchType = 'reverse'; matchScore = 0.95; }
        }

        // Match plein nom (un seul champ)
        if (!eleve && displayName) {
          const normFull = normalize(displayName);
          eleve = eleves.find((e: any) => {
            const c1 = normalize(`${e.nom} ${e.prenom}`);
            const c2 = normalize(`${e.prenom} ${e.nom}`);
            return c1 === normFull || c2 === normFull;
          });
          if (eleve) { matchType = 'exact'; matchScore = 1; }
        }

        // Nom seul unique dans la classe
        if (!eleve && nom && !prenom) {
          const sameName = eleves.filter((e: any) => normalize(e.nom) === normalize(nom));
          if (sameName.length === 1) {
            eleve = sameName[0]; matchType = 'exact'; matchScore = 1;
          } else if (sameName.length > 1 && sameRowCount) {
            const candidate = elevesSorted[idx];
            if (candidate && normalize(candidate.nom) === normalize(nom)) {
              eleve = candidate; matchType = 'exact'; matchScore = 0.9;
            }
          }
        }

        // Priorité 3 : FUZZY MATCHING
        if (!eleve && displayName) {
          const candidates = (eleves as any[])
            .map((e: any) => ({ e, score: computeMatchScore({ nom, prenom }, e) }))
            .sort((a, b) => b.score - a.score);
          const best = candidates[0];
          if (best && best.score >= 0.75) {
            eleve = best.e;
            matchType = 'fuzzy';
            matchScore = best.score;
          }
        }

        // Fallback : position
        if (!eleve && sameRowCount && !displayName) {
          eleve = elevesSorted[idx];
          matchType = 'fuzzy';
          matchScore = 0.6;
        }

        if (!eleve && !errors.length) errors.push('Élève non trouvé');

        // Conversion notes (virgule → point)
        const notes: Record<string, number | null> = {};
        Object.entries(matiereColMap).forEach(([colName, matiere]) => {
          const val = row[colName];
          if (val === null || val === undefined || val === '') {
            notes[matiere.id] = null;
          } else {
            const raw = String(val).replace(',', '.').trim();
            const num = parseFloat(raw);
            if (isNaN(num)) {
              errors.push(`${matiere.nom}: valeur invalide`);
              notes[matiere.id] = null;
            } else if (num < 0 || num > bareme) {
              errors.push(`${matiere.nom}: hors barème (0-${bareme})`);
              notes[matiere.id] = null;
            } else {
              notes[matiere.id] = num;
            }
          }
        });

        const filledCount = Object.values(notes).filter(v => v !== null).length;
        if (filledCount === 0 && eleve) errors.push('Aucune note');

        return {
          nom: eleve?.nom || nom,
          prenom: eleve?.prenom || prenom,
          eleve_id: eleve?.id,
          match_score: matchScore,
          match_type: matchType,
          notes,
          errors,
        };
      });

      // Détection de doublons existants en BDD pour les lignes valides
      const eleveIds = previewRows.map(r => r.eleve_id).filter(Boolean) as string[];
      const matiereIds = Array.from(new Set(Object.values(matiereColMap).map((m: any) => m.id)));
      if (eleveIds.length > 0 && matiereIds.length > 0 && periodeId) {
        const { data: existing } = await supabase
          .from('notes')
          .select('eleve_id, matiere_id')
          .in('eleve_id', eleveIds)
          .in('matiere_id', matiereIds)
          .eq('periode_id', periodeId);
        if (existing && existing.length > 0) {
          const dupMap = new Map<string, Set<string>>();
          existing.forEach((n: any) => {
            if (!dupMap.has(n.eleve_id)) dupMap.set(n.eleve_id, new Set());
            dupMap.get(n.eleve_id)!.add(n.matiere_id);
          });
          previewRows.forEach(r => {
            if (!r.eleve_id) return;
            const dups = dupMap.get(r.eleve_id);
            if (!dups) return;
            const dupNames: string[] = [];
            Object.entries(r.notes).forEach(([mid, val]) => {
              if (val !== null && dups.has(mid)) {
                const m = matieres.find((x: any) => x.id === mid);
                if (m) dupNames.push(m.nom);
              }
            });
            if (dupNames.length > 0) {
              r.duplicate_matieres = dupNames;
              r.overwrite_duplicates = true; // par défaut on écrase
            }
          });
        }
      }

      setPreview(previewRows);

      setPreview(previewRows);
    } catch (err) {
      toast({ title: 'Erreur de lecture', description: String(err), variant: 'destructive' });
    }

    if (fileRef.current) fileRef.current.value = '';
  };

  const validRows = preview?.filter(r => r.eleve_id && r.errors.length === 0) || [];
  const unmatchedCols = matchedMatieres.filter(m => !m.matiere);
  const matchedCount = matchedMatieres.filter(m => m.matiere).length;
  const unmatchedRows = preview?.map((r, i) => ({ row: r, idx: i })).filter(x => !x.row.eleve_id) || [];

  // Élèves de la classe non encore associés à une ligne du fichier
  const usedEleveIds = new Set((preview || []).map(r => r.eleve_id).filter(Boolean));
  const availableEleves = (eleves as any[]).filter(e => !usedEleveIds.has(e.id));

  // Associer une ligne à un élève existant (de la classe OU de toute la base)
  const assignEleveToRow = (rowIdx: number, eleveId: string, fromGlobal = false) => {
    const pool = fromGlobal ? (allEleves as any[]) : (eleves as any[]);
    const e = pool.find(x => x.id === eleveId);
    if (!e || !preview) return;
    const next = [...preview];
    next[rowIdx] = {
      ...next[rowIdx],
      eleve_id: e.id,
      nom: e.nom,
      prenom: e.prenom,
      eleve_classe_id: e.classe_id,
      eleve_classe_nom: e.classes?.nom,
      match_type: 'manual',
      match_score: 1,
      errors: next[rowIdx].errors.filter(er =>
        !er.toLowerCase().includes('élève') &&
        !er.toLowerCase().includes('eleve') &&
        !er.toLowerCase().includes('doublon') &&
        !er.toLowerCase().includes('ordre')
      ),
    };
    setPreview(next);
    setGlobalSearchOpen(null);
    setGlobalSearchTerm('');
    toast({ title: '✅ Élève associé', description: `${e.nom} ${e.prenom}${fromGlobal && e.classes?.nom ? ` (${e.classes.nom})` : ''}` });
  };

  // Désassocier une ligne (pour pouvoir rechoisir)
  const unassignRow = (rowIdx: number) => {
    if (!preview) return;
    const next = [...preview];
    next[rowIdx] = {
      ...next[rowIdx],
      eleve_id: undefined,
      match_type: 'none',
      match_score: 0,
      errors: ['Élève non trouvé'],
      duplicate_matieres: undefined,
    };
    setPreview(next);
  };

  // Toggle écrasement doublons
  const toggleOverwrite = (rowIdx: number) => {
    if (!preview) return;
    const next = [...preview];
    next[rowIdx] = { ...next[rowIdx], overwrite_duplicates: !next[rowIdx].overwrite_duplicates };
    setPreview(next);
  };

  // Créer un nouvel élève dans la classe et l'associer à la ligne
  const createEleveForRow = async (rowIdx: number) => {
    if (!preview || !classeId) return;
    const r = preview[rowIdx];
    const nom = (r.nom || '').trim();
    const prenom = (r.prenom || '').trim();
    if (!nom) {
      toast({ title: 'Nom manquant', description: 'Impossible de créer un élève sans nom.', variant: 'destructive' });
      return;
    }
    try {
      const { data, error } = await supabase
        .from('eleves')
        .insert({ nom, prenom: prenom || '—', classe_id: classeId, statut: 'inscrit' })
        .select('id, nom, prenom, matricule')
        .single();
      if (error) throw error;
      const next = [...preview];
      next[rowIdx] = { ...next[rowIdx], eleve_id: data.id, nom: data.nom, prenom: data.prenom, match_type: 'manual', match_score: 1, errors: [] };
      setPreview(next);
      toast({ title: '✅ Élève créé', description: `${data.nom} ${data.prenom} (${data.matricule || 'sans matricule'})` });
    } catch (err: any) {
      toast({ title: 'Erreur création', description: err.message, variant: 'destructive' });
    }
  };

  // Filtre recherche globale
  const globalSearchResults = useMemo(() => {
    if (globalSearchOpen === null || !globalSearchTerm.trim()) return [];
    const term = normalize(globalSearchTerm);
    return (allEleves as any[])
      .filter(e =>
        normalize(e.nom).includes(term) ||
        normalize(e.prenom).includes(term) ||
        normalize(e.matricule || '').includes(term)
      )
      .slice(0, 20);
  }, [globalSearchOpen, globalSearchTerm, allEleves]);

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setImportProgress(0);

    try {
      const upserts: any[] = [];
      validRows.forEach(row => {
        const skipMatieres = new Set<string>();
        // Si l'utilisateur a refusé l'écrasement, on ignore les matières en doublon
        if (row.duplicate_matieres && !row.overwrite_duplicates) {
          row.duplicate_matieres.forEach(name => {
            const m = matieres.find((x: any) => x.nom === name);
            if (m) skipMatieres.add(m.id);
          });
        }
        Object.entries(row.notes).forEach(([matiere_id, note]) => {
          if (note !== null && !skipMatieres.has(matiere_id)) {
            upserts.push({
              eleve_id: row.eleve_id,
              matiere_id,
              periode_id: periodeId,
              note,
            });
          }
        });
      });

      const total = upserts.length;
      let done = 0;
      for (let i = 0; i < upserts.length; i += 500) {
        const batch = upserts.slice(i, i + 500);
        const { error } = await supabase
          .from('notes')
          .upsert(batch, { onConflict: 'eleve_id,matiere_id,periode_id', ignoreDuplicates: false });
        if (error) throw error;
        done += batch.length;
        setImportProgress(Math.round((done / total) * 100));
      }

      toast({
        title: '✅ Import réussi',
        description: `${validRows.length} élève(s) — ${upserts.length} note(s) importées.`,
      });
      setPreview(null);
      setMatchedMatieres([]);
      onImportDone();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erreur d'import", description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  const resetState = () => {
    setPreview(null);
    setMatchedMatieres([]);
    setCycleId('');
    setClasseId('');
    setPeriodeId('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetState(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importer les notes depuis Excel
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Cycle</label>
            <Select value={cycleId} onValueChange={v => { setCycleId(v); setClasseId(''); setPreview(null); }}>
              <SelectTrigger><SelectValue placeholder="Cycle" /></SelectTrigger>
              <SelectContent>{cycles.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom} (/{c.bareme})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Classe</label>
            <Select value={classeId} onValueChange={v => { setClasseId(v); setPreview(null); }} disabled={!cycleId}>
              <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
              <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom} ({(c as any).niveaux?.nom})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Période</label>
            <Select value={periodeId} onValueChange={v => { setPeriodeId(v); setPreview(null); }}>
              <SelectTrigger><SelectValue placeholder="Période" /></SelectTrigger>
              <SelectContent>{periodes.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {canAct && (
          <div className="flex items-start gap-2 text-sm border rounded-md p-3 bg-muted/30">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">{eleves.length} élève(s) — {matieres.length} matière(s) — Barème /{bareme}</p>
              <p className="text-xs text-muted-foreground">
                Téléchargez le <strong>modèle officiel</strong> (recommandé) : la liste est pré-remplie et triée. Vous pouvez aussi importer un fichier libre avec les colonnes <strong>Nom</strong> et <strong>Prénom</strong>. Si seul le nom est fourni et que la liste est complète et triée alphabétiquement, l'association se fait automatiquement par ordre.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        {canAct && !preview && (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={handleDownloadTemplate} className="flex-1">
              <Download className="h-4 w-4 mr-2" /> Télécharger le modèle Excel
            </Button>
            <Button onClick={() => fileRef.current?.click()} className="flex-1">
              <Upload className="h-4 w-4 mr-2" /> Importer un fichier
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
          </div>
        )}

        {/* Mapping info */}
        {preview && matchedMatieres.length > 0 && (
          <div className="border rounded-md p-3 bg-muted/20 space-y-2">
            <p className="text-sm font-medium">
              Correspondance des matières : {matchedCount}/{matieres.length} reconnues
            </p>
            <div className="flex flex-wrap gap-1.5">
              {matchedMatieres.map((mm, i) => (
                <Badge
                  key={i}
                  variant={mm.matiere ? 'outline' : 'destructive'}
                  className="text-xs"
                  title={mm.matiere ? `→ ${mm.matiere.nom}` : 'Matière non reconnue (ignorée)'}
                >
                  {mm.col}
                  {mm.matiere && <span className="ml-1 opacity-70">→ {mm.matiere.nom}</span>}
                </Badge>
              ))}
            </div>
            {unmatchedCols.length > 0 && (
              <p className="text-xs text-destructive">
                ⚠️ {unmatchedCols.length} colonne(s) ignorée(s). Vérifiez les noms ou utilisez le modèle officiel.
              </p>
            )}
          </div>
        )}

        {/* Revue des lignes "élève non trouvé" */}
        {preview && unmatchedRows.length > 0 && (
          <div className="border-2 border-orange-300 dark:border-orange-700 rounded-md p-3 bg-orange-50/50 dark:bg-orange-950/20 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">
                Revue : {unmatchedRows.length} ligne(s) à corriger
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Associez chaque ligne à un élève existant de la classe, ou créez la fiche manquante en 1 clic.
            </p>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {unmatchedRows.map(({ row, idx }) => {
                const filledNotes = Object.values(row.notes).filter(v => v !== null).length;
                // Suggestions Top 3 (élèves disponibles, score ≥ 0.4)
                const suggestions = availableEleves
                  .map((e: any) => ({ e, score: computeMatchScore({ nom: row.nom, prenom: row.prenom, matricule: (row as any).matricule }, e) }))
                  .filter(s => s.score >= 0.4)
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 3);
                return (
                  <div key={idx} className="p-2 bg-background rounded border space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          Ligne {idx + 1} — <span className="text-foreground">{row.nom || '(vide)'} {row.prenom}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {filledNotes} note(s) — {row.errors.join(', ')}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 shrink-0"
                        onClick={() => createEleveForRow(idx)}
                        disabled={!row.nom?.trim()}
                        title="Créer la fiche élève dans cette classe"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Créer
                      </Button>
                    </div>

                    {/* Suggestions automatiques avec score */}
                    {suggestions.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Search className="h-3 w-3" /> Suggestions :
                        </span>
                        {suggestions.map(({ e, score }) => {
                          const pct = Math.round(score * 100);
                          const color = pct >= 85 ? 'bg-green-100 text-green-800 hover:bg-green-200 border-green-300 dark:bg-green-950 dark:text-green-200'
                            : pct >= 65 ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300 dark:bg-blue-950 dark:text-blue-200'
                            : 'bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-300 dark:bg-orange-950 dark:text-orange-200';
                          return (
                            <button
                              key={e.id}
                              type="button"
                              onClick={() => assignEleveToRow(idx, e.id)}
                              className={`text-xs px-2 py-1 rounded border transition-colors ${color}`}
                              title={`Associer à ${e.nom} ${e.prenom} (confiance ${pct}%)`}
                            >
                              <Link2 className="h-3 w-3 inline mr-1" />
                              {e.nom} {e.prenom} <span className="font-bold ml-1">{pct}%</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Sélection manuelle dans la classe */}
                    <div className="flex gap-2">
                      <Select onValueChange={(v) => assignEleveToRow(idx, v)}>
                        <SelectTrigger className="h-8 text-xs flex-1">
                          <SelectValue placeholder="🔗 Choisir dans la classe…" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableEleves.length === 0 ? (
                            <SelectItem value="__none__" disabled>Aucun élève disponible</SelectItem>
                          ) : (
                            availableEleves.map((e: any) => (
                              <SelectItem key={e.id} value={e.id} className="text-xs">
                                {e.nom} {e.prenom} {e.matricule ? `(${e.matricule})` : ''}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 shrink-0"
                        onClick={() => { setGlobalSearchOpen(idx); setGlobalSearchTerm(''); }}
                        title="Chercher dans toutes les classes"
                      >
                        <Search className="h-3.5 w-3.5" />
                        Toute la base
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Aperçu : {validRows.length}/{preview.length} ligne(s) valides
              </p>
              <Button variant="ghost" size="sm" onClick={() => { setPreview(null); setMatchedMatieres([]); }}>Annuler</Button>
            </div>

            <div className="border rounded-md overflow-auto max-h-[40vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead className="text-center">Notes</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, i) => {
                    const filledNotes = Object.values(row.notes).filter(v => v !== null).length;
                    const hasErrors = row.errors.length > 0;
                    const score = row.match_score ?? 0;
                    const pct = Math.round(score * 100);
                    // Couleur statut : Vert (exact/manual), Orange (fuzzy/reverse), Rouge (none)
                    let statusColor = 'bg-red-50 dark:bg-red-950/30';
                    let statusBadge: { label: string; cls: string; icon: any } = {
                      label: 'Non trouvé', cls: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-100', icon: AlertTriangle,
                    };
                    if (row.eleve_id) {
                      if (row.match_type === 'exact' || row.match_type === 'manual') {
                        statusColor = '';
                        statusBadge = { label: 'Exact', cls: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-100', icon: CheckCircle };
                      } else {
                        statusColor = 'bg-orange-50 dark:bg-orange-950/20';
                        statusBadge = { label: `${pct}%`, cls: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900 dark:text-orange-100', icon: AlertTriangle };
                      }
                    }
                    const Icon = statusBadge.icon;
                    return (
                      <TableRow key={i} className={statusColor}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">
                          <div>{row.nom} {row.prenom}</div>
                          {row.eleve_classe_nom && (
                            <div className="text-xs text-muted-foreground">📚 {row.eleve_classe_nom}</div>
                          )}
                          {row.duplicate_matieres && row.duplicate_matieres.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleOverwrite(i)}
                              className={`mt-1 text-xs px-1.5 py-0.5 rounded border ${row.overwrite_duplicates ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200' : 'bg-muted text-muted-foreground'}`}
                              title={row.overwrite_duplicates ? 'Cliquer pour conserver les notes existantes' : 'Cliquer pour écraser les notes existantes'}
                            >
                              ⚠️ Doublon: {row.duplicate_matieres.length} note(s) — {row.overwrite_duplicates ? 'écraser' : 'ignorer'}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{filledNotes}/{matchedCount}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${statusBadge.cls}`}>
                              <Icon className="h-3 w-3" />
                              {statusBadge.label}
                            </span>
                            {hasErrors && (
                              <span className="text-xs text-destructive truncate max-w-[180px]" title={row.errors.join(', ')}>
                                {row.errors.join(', ')}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {row.eleve_id ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => unassignRow(i)}
                              title="Réassigner cette note à un autre élève"
                            >
                              <RefreshCw className="h-3 w-3 mr-1" /> Changer
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => { setGlobalSearchOpen(i); setGlobalSearchTerm(''); }}
                            >
                              <Search className="h-3 w-3 mr-1" /> Chercher
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {importing && (
              <div className="space-y-1">
                <Progress value={importProgress} />
                <p className="text-xs text-muted-foreground text-center">{importProgress}% — Insertion en base…</p>
              </div>
            )}

            <Button onClick={handleImport} disabled={validRows.length === 0 || importing} className="w-full">
              {importing ? `Import en cours… ${importProgress}%` : `✅ Confirmer l'importation totale (${validRows.length} élève(s))`}
            </Button>
          </div>
        )}

        {/* Dialog recherche globale (toutes classes) */}
        <Dialog open={globalSearchOpen !== null} onOpenChange={(o) => { if (!o) { setGlobalSearchOpen(null); setGlobalSearchTerm(''); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                Rechercher un élève (toutes classes)
              </DialogTitle>
            </DialogHeader>
            <Input
              autoFocus
              placeholder="Nom, prénom ou matricule…"
              value={globalSearchTerm}
              onChange={(e) => setGlobalSearchTerm(e.target.value)}
            />
            <div className="max-h-[50vh] overflow-y-auto border rounded-md divide-y">
              {globalSearchTerm.trim() === '' ? (
                <p className="text-sm text-muted-foreground p-4 text-center">Tapez au moins 1 caractère…</p>
              ) : globalSearchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">Aucun résultat</p>
              ) : (
                globalSearchResults.map((e: any) => (
                  <button
                    key={e.id}
                    type="button"
                    className="w-full text-left p-2 hover:bg-accent text-sm flex items-center justify-between gap-2"
                    onClick={() => globalSearchOpen !== null && assignEleveToRow(globalSearchOpen, e.id, true)}
                  >
                    <span>
                      <strong>{e.nom}</strong> {e.prenom}
                      {e.matricule && <span className="text-xs text-muted-foreground ml-1">({e.matricule})</span>}
                    </span>
                    {e.classes?.nom && <Badge variant="outline" className="text-xs">{e.classes.nom}</Badge>}
                  </button>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {!canAct && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Sélectionnez un cycle, une classe et une période pour commencer.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
