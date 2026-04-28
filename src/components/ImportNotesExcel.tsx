import { useState, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, FileSpreadsheet, AlertTriangle, CheckCircle, Info, UserPlus, Link2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { exportToExcel, readExcelFile } from '@/lib/excelUtils';
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
  notes: Record<string, number | null>;
  errors: string[];
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
  'mathematiques': ['math', 'maths', 'mathematique', 'mathematiques', 'mathematics'],
  'francais': ['francais', 'french', 'fr', 'lettres', 'francaise'],
  'anglais': ['anglais', 'english', 'eng', 'angl'],
  'arabe': ['arabe', 'arabic', 'ar'],
  'histoire geographie': ['histoire geographie', 'hist geo', 'histgeo', 'h g', 'hg', 'histoire et geographie'],
  'histoire': ['histoire', 'history', 'hist'],
  'geographie': ['geographie', 'geography', 'geo'],
  'svt': ['svt', 'sciences de la vie et de la terre', 'sciences nat', 'sciences naturelles', 'biologie', 'bio'],
  'physique chimie': ['physique chimie', 'physique', 'chimie', 'pc', 'sciences physiques'],
  'eps': ['eps', 'sport', 'education physique', 'education physique et sportive'],
  'eveil': ['eveil', 'eveil scientifique'],
  'education civique et morale': ['education civique et morale', 'education civique', 'civisme', 'ecm', 'e c m', 'edu civ', 'eduction civique et morale'],
  'entrepreneuriat': ['entrepreneuriat', 'entrep', 'entreprenariat', 'entr', 'entreprise'],
  'activite scout': ['activite scout', 'scout', 'scoutisme', 'activites scout'],
  'religion': ['religion', 'education religieuse', 'er'],
  'dessin': ['dessin', 'arts plastiques', 'arts'],
  'musique': ['musique', 'chant', 'education musicale'],
  'informatique': ['informatique', 'tic', 'info', 'computer'],
  'lecture': ['lecture', 'reading'],
  'ecriture': ['ecriture', 'writing'],
  'expression ecrite': ['expression ecrite', 'redaction', 'production ecrite'],
  'expression orale': ['expression orale', 'oral', 'communication orale'],
  'calcul': ['calcul', 'calcul mental'],
  'philosophie': ['philosophie', 'philo'],
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

export default function ImportNotesExcel({ open, onOpenChange, onImportDone }: ImportNotesExcelProps) {
  const [cycleId, setCycleId] = useState('');
  const [classeId, setClasseId] = useState('');
  const [periodeId, setPeriodeId] = useState('');
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [matchedMatieres, setMatchedMatieres] = useState<{ col: string; matiere: any | null }[]>([]);
  const [importing, setImporting] = useState(false);
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

  const { data: matieres = [] } = useQuery({
    queryKey: ['matieres-import', cycleId, selectedNiveauId],
    enabled: !!cycleId,
    queryFn: async () => {
      const { data, error } = await supabase.from('matieres').select('*').eq('cycle_id', cycleId).order('ordre');
      if (error) throw error;
      const all = data || [];
      if (selectedNiveauId) return all.filter((m: any) => !m.niveau_id || m.niveau_id === selectedNiveauId);
      return all;
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

        // Trouver l'élève par nom + prénom, nom complet, ou nom unique dans la classe
        let eleve: any = null;
        if (displayName) {
          const normFull = normalize(`${nom} ${prenom}`);
          const normReverse = normalize(`${prenom} ${nom}`);
          const normDisplay = normalize(displayName);
          eleve = eleves.find((e: any) => {
            const candidate = normalize(`${e.nom} ${e.prenom}`);
            const reverseCandidate = normalize(`${e.prenom} ${e.nom}`);
            return candidate === normFull || reverseCandidate === normFull || candidate === normReverse || candidate === normDisplay || reverseCandidate === normDisplay;
          });

          if (!eleve && nom && prenom) {
            eleve = eleves.find((e: any) =>
              normalize(e.nom) === normalize(nom) && normalize(e.prenom) === normalize(prenom)
            );
          }

          if (!eleve && nom && !prenom) {
            const sameName = eleves.filter((e: any) => normalize(e.nom) === normalize(nom));
            if (sameName.length === 1) {
              eleve = sameName[0];
            } else if (sameName.length > 1 && sameRowCount) {
              // Mode position : on prend l'élève à la même ligne (tri alpha)
              const candidate = elevesSorted[idx];
              if (candidate && normalize(candidate.nom) === normalize(nom)) {
                eleve = candidate;
              } else {
                errors.push(`Ordre incohérent (attendu: ${candidate?.nom || '?'})`);
              }
            } else if (sameName.length > 1) {
              errors.push(`Doublon "${nom}" : ajoutez le prénom ou utilisez le modèle officiel`);
            }
          }
        }

        // Fallback ultime : matching strict par position si tout le reste a échoué
        if (!eleve && sameRowCount && !displayName) {
          eleve = elevesSorted[idx];
        }

        if (!eleve && !errors.length) errors.push('Élève non trouvé');

        // Conserver les notes EXACTEMENT telles que saisies (pas d'arrondi, pas de modification)
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
          notes,
          errors,
        };
      });

      setPreview(previewRows);
    } catch (err) {
      toast({ title: 'Erreur de lecture', description: String(err), variant: 'destructive' });
    }

    if (fileRef.current) fileRef.current.value = '';
  };

  const validRows = preview?.filter(r => r.eleve_id && r.errors.length === 0) || [];
  const unmatchedCols = matchedMatieres.filter(m => !m.matiere);
  const matchedCount = matchedMatieres.filter(m => m.matiere).length;

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);

    try {
      const upserts: any[] = [];
      validRows.forEach(row => {
        Object.entries(row.notes).forEach(([matiere_id, note]) => {
          if (note !== null) {
            upserts.push({
              eleve_id: row.eleve_id,
              matiere_id,
              periode_id: periodeId,
              note,
            });
          }
        });
      });

      for (let i = 0; i < upserts.length; i += 500) {
        const batch = upserts.slice(i, i + 500);
        const { error } = await supabase
          .from('notes')
          .upsert(batch, { onConflict: 'eleve_id,matiere_id,periode_id', ignoreDuplicates: false });
        if (error) throw error;
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
                    <TableHead>Nom & Prénom</TableHead>
                    <TableHead className="text-center">Notes</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, i) => {
                    const filledNotes = Object.values(row.notes).filter(v => v !== null).length;
                    const hasErrors = row.errors.length > 0;
                    return (
                      <TableRow key={i} className={hasErrors ? 'bg-destructive/5' : ''}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{row.nom} {row.prenom}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{filledNotes}/{matchedCount}</Badge>
                        </TableCell>
                        <TableCell>
                          {hasErrors ? (
                            <div className="flex items-start gap-1">
                              <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                              <span className="text-xs text-destructive">{row.errors.join(', ')}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="h-3.5 w-3.5" />
                              <span className="text-xs">OK</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <Button onClick={handleImport} disabled={validRows.length === 0 || importing} className="w-full">
              {importing ? 'Import en cours...' : `Importer ${validRows.length} élève(s)`}
            </Button>
          </div>
        )}

        {!canAct && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Sélectionnez un cycle, une classe et une période pour commencer.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
