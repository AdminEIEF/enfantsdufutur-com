import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BookOpen, Save, CheckCircle, Circle, ChevronRight, AlertTriangle, Eye, EyeOff, FileSpreadsheet, GraduationCap, Users, ChevronLeft, Upload, Download } from 'lucide-react';
import { exportToExcel, readExcelFile } from '@/lib/excelUtils';
import ImportNotesExcel from '@/components/ImportNotesExcel';
import SaisieNotesParMatiere from '@/components/SaisieNotesParMatiere';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { sortClasses } from '@/lib/utils';

const SECONDAIRE_CYCLES = ['collège', 'lycée', 'college', 'lycee'];
const isSecondaireCycle = (cycleName: string) => SECONDAIRE_CYCLES.some(c => (cycleName || '').toLowerCase().includes(c));

export default function Notes() {
  const { hasRole } = useAuth();
  const isCoordSecondaire = hasRole('coordinateur_secondaire' as any);
  const [selectedTab, setSelectedTab] = useState(hasRole('coordinateur_secondaire' as any) ? 'secondaire' : 'autres');
  const [cycleId, setCycleId] = useState('');
  const [classeId, setClasseId] = useState('');
  const [periodeId, setPeriodeId] = useState('');
  const [selectedEleveId, setSelectedEleveId] = useState<string | null>(null);
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [importOpen, setImportOpen] = useState(false);
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [gridCells, setGridCells] = useState<Record<string, string>>({});
  const [anchorCell, setAnchorCell] = useState<{ r: number; c: number } | null>(null);
  const [focusCell, setFocusCell] = useState<{ r: number; c: number } | null>(null);
  const queryClient = useQueryClient();

  // Abréviation intelligente d'un nom de matière (max 6 chars)
  const abbrev = useCallback((name: string) => {
    if (!name) return '—';
    const clean = name.trim();
    if (clean.length <= 6) return clean;
    const words = clean.split(/[\s\-']+/).filter(Boolean);
    if (words.length >= 2) {
      return words.map(w => w[0]).join('').toUpperCase().slice(0, 5);
    }
    return clean.slice(0, 5) + '.';
  }, []);

  const { data: cycles = [] } = useQuery({
    queryKey: ['cycles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cycles').select('*').order('ordre');
      if (error) throw error;
      return data;
    },
  });

  // Filter cycles by selected tab
  const filteredCycles = useMemo(() => {
    return cycles.filter((c: any) => {
      return selectedTab === 'secondaire' ? isSecondaireCycle(c.nom) : !isSecondaireCycle(c.nom);
    });
  }, [cycles, selectedTab]);

  // Reset cycle when tab changes
  useEffect(() => {
    setCycleId('');
    setClasseId('');
    setSelectedEleveId(null);
  }, [selectedTab]);

  // Auto-select first cycle
  useEffect(() => {
    if (filteredCycles.length > 0 && !cycleId) {
      setCycleId(filteredCycles[0].id);
    }
  }, [filteredCycles, cycleId]);

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-by-cycle', cycleId],
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

  const { data: classeMatieres = [] } = useQuery({
    queryKey: ['classe-matieres', classeId],
    enabled: !!classeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classe_matieres')
        .select('matiere_id, ordre, coefficient')
        .eq('classe_id', classeId)
        .order('ordre');
      if (error) throw error;
      return data;
    },
  });

  const { data: allMatieresCycle = [] } = useQuery({
    queryKey: ['matieres', cycleId],
    enabled: !!cycleId,
    queryFn: async () => {
      const { data, error } = await supabase.from('matieres').select('*').eq('cycle_id', cycleId).order('ordre');
      if (error) throw error;
      return data;
    },
  });

  const selectedCycle = cycles.find((c: any) => c.id === cycleId);
  const bareme = selectedCycle?.bareme ?? 20;
  const isSecondaire = selectedTab === 'secondaire';

  const matieres = useMemo(() => {
    if (classeId && classeMatieres.length > 0) {
      const byId = new Map(allMatieresCycle.map((m: any) => [m.id, m]));
      // Trier strictement selon classe_matieres.ordre
      return classeMatieres
        .map((cm: any) => byId.get(cm.matiere_id))
        .filter(Boolean);
    }
    if (classeId && !isSecondaire) {
      return [];
    }
    if (!selectedNiveauId) return allMatieresCycle;
    return allMatieresCycle.filter((m: any) => !m.niveau_id || m.niveau_id === selectedNiveauId);
  }, [allMatieresCycle, selectedNiveauId, classeId, classeMatieres, isSecondaire]);

  const { data: eleves = [] } = useQuery({
    queryKey: ['eleves-classe', classeId],
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

  const { data: allNotesForPeriod = [] } = useQuery({
    queryKey: ['all-notes-period', classeId, periodeId],
    enabled: !!classeId && !!periodeId && eleves.length > 0,
    queryFn: async () => {
      const eleveIds = eleves.map((e: any) => e.id);
      if (eleveIds.length === 0) return [];
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('periode_id', periodeId)
        .in('eleve_id', eleveIds);
      if (error) throw error;
      return data;
    },
  });

  const progressByEleve = useMemo(() => {
    const totalMatieres = matieres.length;
    const matiereIds = new Set(matieres.map((m: any) => m.id));
    const map: Record<string, { done: number; total: number }> = {};
    eleves.forEach((e: any) => {
      const notesForEleve = allNotesForPeriod.filter(
        (n: any) => n.eleve_id === e.id && matiereIds.has(n.matiere_id) && n.note !== null
      );
      map[e.id] = { done: notesForEleve.length, total: totalMatieres };
    });
    return map;
  }, [eleves, allNotesForPeriod, matieres]);

  const selectedEleve = eleves.find((e: any) => e.id === selectedEleveId);

  useEffect(() => {
    if (!selectedEleveId) return;
    const map: Record<string, string> = {};
    matieres.forEach((m: any) => {
      const note = allNotesForPeriod.find((n: any) => n.eleve_id === selectedEleveId && n.matiere_id === m.id);
      map[m.id] = note?.note !== null && note?.note !== undefined ? String(note.note) : '';
    });
    setNotesMap(map);
  }, [selectedEleveId, allNotesForPeriod, matieres]);

  const filledCount = useMemo(() => {
    return matieres.filter((m: any) => notesMap[m.id] !== undefined && notesMap[m.id] !== '').length;
  }, [notesMap, matieres]);

  const allFilled = filledCount === matieres.length && matieres.length > 0;
  const currentIndex = eleves.findIndex((e: any) => e.id === selectedEleveId);
  const nextEleve = currentIndex >= 0 && currentIndex < eleves.length - 1 ? eleves[currentIndex + 1] : null;

  const saveStudentNotes = useMutation({
    mutationFn: async () => {
      if (!selectedEleveId || !periodeId) throw new Error('Données manquantes');
      const upserts = matieres.map((m: any) => ({
        eleve_id: selectedEleveId,
        matiere_id: m.id,
        periode_id: periodeId,
        note: notesMap[m.id] !== undefined && notesMap[m.id] !== '' ? parseFloat(notesMap[m.id]) : null,
      }));
      const { error } = await supabase.from('notes').upsert(upserts, { onConflict: 'eleve_id,matiere_id,periode_id', ignoreDuplicates: false });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-notes-period'] });
      toast({ title: 'Notes enregistrées', description: `Notes de ${selectedEleve?.prenom} ${selectedEleve?.nom} sauvegardées.` });
      if (nextEleve) {
        setSelectedEleveId(nextEleve.id);
      } else {
        setSelectedEleveId(null);
        toast({ title: '✅ Saisie terminée', description: 'Tous les élèves ont été traités.' });
      }
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  // Initialiser la grille à partir des notes existantes
  useEffect(() => {
    const map: Record<string, string> = {};
    allNotesForPeriod.forEach((n: any) => {
      map[`${n.eleve_id}|${n.matiere_id}`] = n.note !== null && n.note !== undefined ? String(n.note) : '';
    });
    setGridCells(map);
  }, [allNotesForPeriod]);

  const saveOneNote = useMutation({
    mutationFn: async ({ eleve_id, matiere_id, value }: { eleve_id: string; matiere_id: string; value: string }) => {
      const note = value === '' ? null : parseFloat(value);
      if (value !== '' && (isNaN(note as number) || (note as number) < 0 || (note as number) > bareme)) {
        throw new Error(`Note invalide (0-${bareme})`);
      }
      const { error } = await supabase.from('notes').upsert(
        { eleve_id, matiere_id, periode_id: periodeId, note },
        { onConflict: 'eleve_id,matiere_id,periode_id' }
      );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['all-notes-period'] }),
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  // Réordonnancement des colonnes matières (swap des ordres dans classe_matieres)
  const reorderMatiere = useMutation({
    mutationFn: async ({ from, to }: { from: number; to: number }) => {
      if (from === to || from < 0 || to < 0 || from >= matieres.length || to >= matieres.length) return;
      const a = matieres[from] as any;
      const b = matieres[to] as any;
      const cmA = (classeMatieres as any[]).find((c: any) => c.matiere_id === a.id);
      const cmB = (classeMatieres as any[]).find((c: any) => c.matiere_id === b.id);
      if (!cmA || !cmB) throw new Error('Réordonnancement disponible uniquement quand les matières sont assignées via Configuration > Classes.');
      const ordreA = cmA.ordre, ordreB = cmB.ordre;
      const { error: e1 } = await supabase.from('classe_matieres').update({ ordre: ordreB }).eq('classe_id', classeId).eq('matiere_id', a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('classe_matieres').update({ ordre: ordreA }).eq('classe_id', classeId).eq('matiere_id', b.id);
      if (e2) throw e2;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['classe-matieres', classeId] }),
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  // Export direct du tableau en Excel
  const handleExportTable = async () => {
    if (matieres.length === 0 || eleves.length === 0) return;
    const rows = (eleves as any[]).map((e: any, i: number) => {
      const row: Record<string, any> = { 'N°': i + 1, 'Nom': e.nom, 'Prénom': e.prenom, 'Matricule': e.matricule || '' };
      (matieres as any[]).forEach((m: any) => {
        const v = gridCells[`${e.id}|${m.id}`];
        row[m.nom] = v !== undefined && v !== '' ? parseFloat(v) : '';
      });
      return row;
    });
    const cls = (selectedClasse as any)?.nom || 'classe';
    const per = (periodes as any[]).find((p: any) => p.id === periodeId)?.nom || 'periode';
    await exportToExcel(rows, `Notes_${cls}_${per}`, 'Notes');
    toast({ title: '📤 Export généré', description: `${rows.length} élève(s) × ${matieres.length} matière(s).` });
  };

  // Import direct depuis le tableau
  const tableImportRef = useRef<HTMLInputElement>(null);
  const handleTableImport = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    ev.target.value = '';
    if (!periodeId) { toast({ title: 'Sélectionnez d\'abord une période', variant: 'destructive' }); return; }
    try {
      const rows = await readExcelFile(file);
      if (rows.length === 0) { toast({ title: 'Fichier vide', variant: 'destructive' }); return; }
      const norm = (s: any) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
      const cols = Object.keys(rows[0]);
      const colToMat: Record<string, any> = {};
      cols.forEach(col => {
        const nc = norm(col);
        if (!nc) return;
        const m = (matieres as any[]).find((x: any) => {
          const nm = norm(x.nom);
          return nm === nc || nm.startsWith(nc) || nc.startsWith(nm);
        });
        if (m) colToMat[col] = m;
      });
      if (Object.keys(colToMat).length === 0) { toast({ title: 'Aucune matière reconnue', description: 'Les en-têtes de colonnes doivent correspondre aux noms des matières.', variant: 'destructive' }); return; }
      let count = 0, errors = 0, unmatched = 0;
      const updates: Record<string, string> = {};
      for (const r of rows) {
        const nom = norm(r['Nom'] ?? r['nom'] ?? r['NOMS'] ?? r['Noms']);
        const prenom = norm(r['Prénom'] ?? r['prenom'] ?? r['Prenom'] ?? r['PRENOMS'] ?? r['Prenoms']);
        const mat = norm(r['Matricule'] ?? r['matricule']);
        const eleve = (eleves as any[]).find((e: any) =>
          (mat && norm(e.matricule) === mat) ||
          (nom && norm(e.nom) === nom && (!prenom || norm(e.prenom) === prenom))
        );
        if (!eleve) { unmatched++; continue; }
        for (const [col, m] of Object.entries(colToMat)) {
          const raw = r[col];
          if (raw === '' || raw === null || raw === undefined) continue;
          const v = String(raw).replace(',', '.').trim();
          const n = parseFloat(v);
          if (isNaN(n) || n < 0 || n > bareme) { errors++; continue; }
          updates[`${eleve.id}|${(m as any).id}`] = String(n);
          saveOneNote.mutate({ eleve_id: eleve.id, matiere_id: (m as any).id, value: String(n) });
          count++;
        }
      }
      setGridCells((s) => ({ ...s, ...updates }));
      toast({
        title: '📥 Import effectué',
        description: `${count} note(s) importée(s)${unmatched ? ` • ${unmatched} élève(s) introuvable(s)` : ''}${errors ? ` • ${errors} valeur(s) invalides` : ''}.`,
        variant: (errors || unmatched) ? 'destructive' : 'default',
      });
    } catch (err: any) {
      toast({ title: 'Erreur import', description: err.message, variant: 'destructive' });
    }
  };

  const canShowList = classeId && periodeId && eleves.length > 0 && matieres.length > 0;

  const { data: bulletinPub } = useQuery({
    queryKey: ['bulletin-publication', classeId, periodeId],
    queryFn: async () => {
      if (!classeId || !periodeId) return null;
      const { data } = await supabase
        .from('bulletin_publications')
        .select('*')
        .eq('classe_id', classeId)
        .eq('periode_id', periodeId)
        .maybeSingle();
      return data;
    },
    enabled: !!classeId && !!periodeId,
  });

  const toggleVisibility = useMutation({
    mutationFn: async (visible: boolean) => {
      const { error } = await supabase
        .from('bulletin_publications')
        .upsert({
          classe_id: classeId,
          periode_id: periodeId,
          visible_parent: visible,
          published_at: visible ? new Date().toISOString() : null,
        }, { onConflict: 'classe_id,periode_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulletin-publication'] });
      toast({ title: bulletinPub?.visible_parent ? 'Bulletins masqués' : 'Bulletins publiés', description: 'Visibilité mise à jour pour les parents.' });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  const publishAll = useMutation({
    mutationFn: async () => {
      const { data: allClasses, error: e1 } = await supabase.from('classes').select('id');
      if (e1) throw e1;
      const { data: allPeriodes, error: e2 } = await supabase.from('periodes').select('id');
      if (e2) throw e2;
      const now = new Date().toISOString();
      const rows = (allClasses || []).flatMap((c: any) =>
        (allPeriodes || []).map((p: any) => ({
          classe_id: c.id,
          periode_id: p.id,
          visible_parent: true,
          published_at: now,
        }))
      );
      // Upsert par batches de 500 pour éviter les payloads trop gros
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        const { error } = await supabase
          .from('bulletin_publications')
          .upsert(batch, { onConflict: 'classe_id,periode_id' });
        if (error) throw error;
      }
      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['bulletin-publication'] });
      toast({ title: '🎉 Tous les bulletins sont visibles', description: `${count} combinaisons classe/période publiées.` });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-7 w-7 text-primary" /> Saisie des Notes
        </h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="default" onClick={() => publishAll.mutate()} disabled={publishAll.isPending}>
            <Eye className="h-4 w-4 mr-2" /> {publishAll.isPending ? 'Publication...' : 'Tout publier (parents)'}
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Importer Excel
          </Button>
        </div>
      </div>

      {/* Tabs Secondaire vs Préscolaire & Primaire */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        {!isCoordSecondaire && (
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="autres" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4">
            <Users className="h-4 w-4 mr-1.5" />
            Préscolaire & Primaire
          </TabsTrigger>
          <TabsTrigger value="secondaire" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4">
            <GraduationCap className="h-4 w-4 mr-1.5" />
            Secondaire
          </TabsTrigger>
        </TabsList>
        )}

        {['secondaire', 'autres'].map(tabValue => (
          <TabsContent key={tabValue} value={tabValue} className="mt-4 space-y-4">
            {/* Filters */}
            <Card className="border-l-4 border-l-primary">
              <CardContent className="pt-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Cycle</label>
                    <Select value={cycleId} onValueChange={v => { setCycleId(v); setClasseId(''); setSelectedEleveId(null); }}>
                      <SelectTrigger><SelectValue placeholder="Cycle" /></SelectTrigger>
                      <SelectContent>{filteredCycles.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom} (/{c.bareme})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Classe</label>
                    <Select value={classeId} onValueChange={(v) => { setClasseId(v); setSelectedEleveId(null); }} disabled={!cycleId}>
                      <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
                      <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Période</label>
                    <Select value={periodeId} onValueChange={v => { setPeriodeId(v); setSelectedEleveId(null); }}>
                      <SelectTrigger><SelectValue placeholder="Période" /></SelectTrigger>
                      <SelectContent>{periodes.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                {canShowList && (
                  <div className="mt-4 pt-4 border-t flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {bulletinPub?.visible_parent ? (
                        <Eye className="h-4 w-4 text-green-600" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm font-medium">Rendre visible par les parents</p>
                        <p className="text-xs text-muted-foreground">
                          {bulletinPub?.visible_parent
                            ? `Publié le ${new Date(bulletinPub.published_at!).toLocaleDateString('fr-FR')}`
                            : 'Les parents ne peuvent pas encore voir les bulletins'}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={bulletinPub?.visible_parent ?? false}
                      onCheckedChange={(checked) => toggleVisibility.mutate(checked)}
                      disabled={toggleVisibility.isPending}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Student List */}
            {canShowList ? (
              isSecondaire ? (
                <SaisieNotesParMatiere
                  matieres={matieres}
                  eleves={eleves}
                  allNotesForPeriod={allNotesForPeriod}
                  periodeId={periodeId}
                  bareme={bareme}
                />
              ) : (
              <>
                {(() => {
                  const missingCount = eleves.filter((e: any) => {
                    const p = progressByEleve[e.id];
                    return !p || p.done < p.total;
                  }).length;
                  const completeCount = eleves.length - missingCount;
                  const globalPct = eleves.length > 0 ? Math.round((completeCount / eleves.length) * 100) : 0;
                  const visibleEleves = eleves.filter((e: any) => {
                    if (!showOnlyMissing) return true;
                    const p = progressByEleve[e.id];
                    return !p || p.done < p.total;
                  });
                  return (
                    <>
                      {/* Synthèse globale */}
                      <Card className="bg-gradient-to-br from-primary/5 via-background to-accent/5 border-l-4 border-l-primary">
                        <CardContent className="pt-6">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <Users className="h-7 w-7 text-primary" />
                              </div>
                              <div>
                                <p className="text-2xl font-bold">{completeCount}<span className="text-base font-normal text-muted-foreground">/{eleves.length}</span></p>
                                <p className="text-xs text-muted-foreground">élèves complets — {matieres.length} matière(s) /{bareme}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="inline-flex rounded-lg border bg-background p-0.5">
                                <Button
                                  size="sm"
                                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                                  className="h-8 px-3"
                                  onClick={() => setViewMode('table')}
                                >
                                  📊 Tableau
                                </Button>
                                <Button
                                  size="sm"
                                  variant={viewMode === 'cards' ? 'default' : 'ghost'}
                                  className="h-8 px-3"
                                  onClick={() => setViewMode('cards')}
                                >
                                  🗂 Cartes
                                </Button>
                              </div>
                              <Badge variant={missingCount > 0 ? 'destructive' : 'default'} className="gap-1 px-3 py-1.5 text-sm">
                                <AlertTriangle className="h-3.5 w-3.5" /> {missingCount} sans notes
                              </Badge>
                              <Button
                                size="sm"
                                variant={showOnlyMissing ? 'default' : 'outline'}
                                onClick={() => setShowOnlyMissing((v) => !v)}
                              >
                                {showOnlyMissing ? '👁 Voir tous' : '🔍 Sans notes uniquement'}
                              </Button>
                              <div className="inline-flex rounded-lg border bg-background p-0.5">
                                <Button size="sm" variant="ghost" className="h-8 px-3 gap-1.5" onClick={handleExportTable} disabled={!canShowList}>
                                  <Download className="h-3.5 w-3.5" /> Exporter
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 px-3 gap-1.5" onClick={() => tableImportRef.current?.click()} disabled={!canShowList}>
                                  <Upload className="h-3.5 w-3.5" /> Importer
                                </Button>
                                <input ref={tableImportRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleTableImport} />
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 flex items-center gap-3">
                            <Progress value={globalPct} className="h-2 flex-1" />
                            <span className="text-xs font-mono text-muted-foreground w-12 text-right">{globalPct}%</span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Vue : Tableau Excel ou Cartes */}
                      {visibleEleves.length === 0 ? (
                        <Card><CardContent className="py-10 text-center text-muted-foreground">
                          🎉 Tous les élèves ont leurs notes saisies !
                        </CardContent></Card>
                      ) : viewMode === 'table' ? (
                        <Card className="overflow-hidden border-2 shadow-xl rounded-2xl">
                          <CardContent className="p-0">
                            <div className="overflow-auto max-h-[72vh] rounded-t-2xl">
                              <table className="w-full border-collapse text-sm select-none">
                                <thead className="sticky top-0 z-20">
                                  <tr className="bg-gradient-to-r from-primary via-primary to-primary/90 text-primary-foreground shadow-md">
                                    <th className="sticky left-0 z-30 bg-primary border-r border-primary-foreground/30 px-2 py-3 text-center w-12 text-xs uppercase tracking-wider">#</th>
                                    <th className="sticky left-12 z-30 bg-primary border-r border-primary-foreground/30 px-3 py-3 text-left min-w-[200px] text-xs uppercase tracking-wider">Élève</th>
                                    <TooltipProvider delayDuration={150}>
                                      {matieres.map((m: any) => (
                                        <Tooltip key={m.id}>
                                          <TooltipTrigger asChild>
                                            <th className="border-r border-primary-foreground/20 px-1 py-3 text-center w-[68px] min-w-[68px] font-bold cursor-help hover:bg-primary-foreground/10 transition-colors">
                                              <span className="block text-xs uppercase tracking-tight truncate" title={m.nom}>
                                                {abbrev(m.nom)}
                                              </span>
                                            </th>
                                          </TooltipTrigger>
                                          <TooltipContent side="bottom" className="font-semibold">
                                            {m.nom}
                                          </TooltipContent>
                                        </Tooltip>
                                      ))}
                                    </TooltipProvider>
                                    <th className="sticky right-0 z-30 bg-primary border-l border-primary-foreground/30 px-2 py-3 text-center w-[80px] text-xs uppercase tracking-wider">Moy /{bareme}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {visibleEleves.map((e: any, ri: number) => {
                                    const notes = matieres.map((m: any) => {
                                      const v = gridCells[`${e.id}|${m.id}`];
                                      return v && v !== '' ? parseFloat(v) : null;
                                    }).filter((v) => v !== null && !isNaN(v as number)) as number[];
                                    const moy = notes.length > 0 ? (notes.reduce((a, b) => a + b, 0) / notes.length).toFixed(2) : '—';
                                    const prog = progressByEleve[e.id] || { done: 0, total: matieres.length };
                                    const isComplete = prog.done === prog.total && prog.total > 0;
                                    const isEmpty = prog.done === 0;
                                    const rowBg = isComplete ? 'bg-green-500/[0.04]' : isEmpty ? 'bg-destructive/[0.04]' : 'bg-amber-500/[0.04]';
                                    const stripe = ri % 2 === 0 ? '' : 'bg-muted/20';
                                    return (
                                      <tr key={e.id} className={`${rowBg} ${stripe} hover:bg-accent/40 transition-colors group`}>
                                        <td className="sticky left-0 z-10 bg-inherit border-r border-border px-2 py-1 text-xs font-semibold text-muted-foreground tabular-nums text-center">
                                          {ri + 1}
                                        </td>
                                        <td className="sticky left-12 z-10 bg-inherit border-r border-border px-3 py-1.5">
                                          <p className="font-semibold text-sm leading-tight truncate max-w-[200px]">{e.nom} {e.prenom}</p>
                                          <p className="font-mono text-[10px] text-muted-foreground">{e.matricule || '—'}</p>
                                        </td>
                                        {matieres.map((m: any, ci: number) => {
                                          const key = `${e.id}|${m.id}`;
                                          const val = gridCells[key] ?? '';
                                          const inRange = anchorCell && focusCell && (() => {
                                            const r1 = Math.min(anchorCell.r, focusCell.r), r2 = Math.max(anchorCell.r, focusCell.r);
                                            const c1 = Math.min(anchorCell.c, focusCell.c), c2 = Math.max(anchorCell.c, focusCell.c);
                                            return ri >= r1 && ri <= r2 && ci >= c1 && ci <= c2;
                                          })();
                                          const numVal = val !== '' ? parseFloat(val) : NaN;
                                          const isPass = !isNaN(numVal) && numVal >= bareme / 2;
                                          const isFail = !isNaN(numVal) && numVal < bareme / 2;
                                          return (
                                            <td
                                              key={m.id}
                                              className={`border-r border-border p-0 transition-all ${inRange ? 'bg-primary/15 ring-1 ring-primary/40 ring-inset' : ''}`}
                                              onClick={(ev) => {
                                                if (ev.shiftKey && anchorCell) {
                                                  setFocusCell({ r: ri, c: ci });
                                                  ev.preventDefault();
                                                }
                                              }}
                                            >
                                              <input
                                                type="number"
                                                min={0}
                                                max={bareme}
                                                step="0.25"
                                                value={val}
                                                data-row={ri}
                                                data-col={ci}
                                                onFocus={() => { setAnchorCell({ r: ri, c: ci }); setFocusCell({ r: ri, c: ci }); }}
                                                onChange={(ev) => setGridCells((s) => ({ ...s, [key]: ev.target.value }))}
                                                onBlur={(ev) => {
                                                  const original = allNotesForPeriod.find((n: any) => n.eleve_id === e.id && n.matiere_id === m.id);
                                                  const orig = original?.note !== null && original?.note !== undefined ? String(original.note) : '';
                                                  if (ev.target.value !== orig) {
                                                    saveOneNote.mutate({ eleve_id: e.id, matiere_id: m.id, value: ev.target.value });
                                                  }
                                                }}
                                                onCopy={(ev) => {
                                                  if (!anchorCell || !focusCell) return;
                                                  const r1 = Math.min(anchorCell.r, focusCell.r), r2 = Math.max(anchorCell.r, focusCell.r);
                                                  const c1 = Math.min(anchorCell.c, focusCell.c), c2 = Math.max(anchorCell.c, focusCell.c);
                                                  if (r1 === r2 && c1 === c2) return;
                                                  const lines: string[] = [];
                                                  for (let r = r1; r <= r2; r++) {
                                                    const row: string[] = [];
                                                    for (let c = c1; c <= c2; c++) {
                                                      const el = visibleEleves[r];
                                                      const mt = matieres[c];
                                                      row.push(el && mt ? (gridCells[`${el.id}|${mt.id}`] ?? '') : '');
                                                    }
                                                    lines.push(row.join('\t'));
                                                  }
                                                  ev.preventDefault();
                                                  ev.clipboardData.setData('text/plain', lines.join('\n'));
                                                  toast({ title: '📋 Copié', description: `${(r2 - r1 + 1)} × ${(c2 - c1 + 1)} cellule(s).` });
                                                }}
                                                 onPaste={(ev) => {
                                                   const text = ev.clipboardData.getData('text/plain');
                                                   if (!text) return;
                                                   const isMulti = text.includes('\t') || /\r?\n/.test(text.trim());
                                                   if (!isMulti) return;
                                                   ev.preventDefault();
                                                   const rawRows = text.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
                                                   const srcRows = rawRows.length;
                                                   const srcCols = Math.max(...rawRows.map(r => r.length));
                                                   // Normalize ragged rows (auto-align: pad short rows with empty cells)
                                                   const ragged = rawRows.some(r => r.length !== srcCols);
                                                   const rows = rawRows.map(r => r.length === srcCols ? r : [...r, ...Array(srcCols - r.length).fill('')]);

                                                   // Selection target range (if any)
                                                   const hasSelection = !!(anchorCell && focusCell && (anchorCell.r !== focusCell.r || anchorCell.c !== focusCell.c));
                                                   let startR = ri, startC = ci;
                                                   let dstRows = srcRows, dstCols = srcCols;
                                                   if (hasSelection) {
                                                     const r1 = Math.min(anchorCell!.r, focusCell!.r), r2 = Math.max(anchorCell!.r, focusCell!.r);
                                                     const c1 = Math.min(anchorCell!.c, focusCell!.c), c2 = Math.max(anchorCell!.c, focusCell!.c);
                                                     startR = r1; startC = c1;
                                                     dstRows = r2 - r1 + 1; dstCols = c2 - c1 + 1;
                                                   }

                                                   // Tiling logic (Excel-style): broadcast 1×N or N×1 or 1×1 over selection
                                                   const tile = hasSelection && (
                                                     (srcRows === 1 && srcCols === 1) ||
                                                     (srcRows === 1 && dstCols === srcCols) ||
                                                     (srcCols === 1 && dstRows === srcRows) ||
                                                     (dstRows % srcRows === 0 && dstCols % srcCols === 0)
                                                   );
                                                   const effRows = tile ? dstRows : srcRows;
                                                   const effCols = tile ? dstCols : srcCols;

                                                   // Bounds available
                                                   const availRows = visibleEleves.length - startR;
                                                   const availCols = matieres.length - startC;
                                                   const truncRows = Math.max(0, effRows - availRows);
                                                   const truncCols = Math.max(0, effCols - availCols);

                                                   // Mismatch with selection (when not tiling)
                                                   const mismatch = hasSelection && !tile && (srcRows !== dstRows || srcCols !== dstCols);

                                                   let pasted = 0, errors = 0, skipped = 0;
                                                   const updates: Record<string, string> = {};
                                                   const useRows = Math.min(effRows, availRows);
                                                   const useCols = Math.min(effCols, availCols);
                                                   for (let dr = 0; dr < useRows; dr++) {
                                                     for (let dc = 0; dc < useCols; dc++) {
                                                       const tEleve = visibleEleves[startR + dr];
                                                       const tMat = matieres[startC + dc];
                                                       if (!tEleve || !tMat) { skipped++; continue; }
                                                       const raw = rows[dr % srcRows]?.[dc % srcCols] ?? '';
                                                       const v = String(raw).trim().replace(',', '.');
                                                       if (v === '') {
                                                         updates[`${tEleve.id}|${tMat.id}`] = '';
                                                         saveOneNote.mutate({ eleve_id: tEleve.id, matiere_id: tMat.id, value: '' });
                                                         pasted++;
                                                         continue;
                                                       }
                                                       const n = parseFloat(v);
                                                       if (isNaN(n) || n < 0 || n > bareme) { errors++; continue; }
                                                       updates[`${tEleve.id}|${tMat.id}`] = String(n);
                                                       saveOneNote.mutate({ eleve_id: tEleve.id, matiere_id: tMat.id, value: String(n) });
                                                       pasted++;
                                                     }
                                                   }
                                                   setGridCells((s) => ({ ...s, ...updates }));

                                                   // Build alert
                                                   const warns: string[] = [];
                                                   if (ragged) warns.push('lignes de tailles inégales auto-complétées');
                                                   if (tile && (srcRows !== dstRows || srcCols !== dstCols)) warns.push(`source ${srcRows}×${srcCols} étendue à ${dstRows}×${dstCols}`);
                                                   if (mismatch) warns.push(`sélection ${dstRows}×${dstCols} ≠ source ${srcRows}×${srcCols} — alignée depuis le coin haut-gauche`);
                                                   if (truncRows > 0 || truncCols > 0) warns.push(`débordement tronqué (${truncRows} ligne(s), ${truncCols} colonne(s))`);
                                                   if (errors > 0) warns.push(`${errors} valeur(s) hors barème /${bareme} ignorée(s)`);

                                                   toast({
                                                     title: warns.length > 0 ? '⚠️ Collage avec ajustements' : '📋 Collage effectué',
                                                     description: `${pasted} note(s) collée(s)${warns.length ? ' — ' + warns.join(' ; ') : ''}.`,
                                                     variant: (truncRows > 0 || truncCols > 0 || errors > 0 || mismatch) ? 'destructive' : 'default',
                                                   });
                                                 }}
                                                onKeyDown={(ev) => {
                                                  const target = ev.currentTarget;
                                                  const move = (dr: number, dc: number, extend = false) => {
                                                    const nr = ri + dr, nc = ci + dc;
                                                    const next = document.querySelector<HTMLInputElement>(
                                                      `input[data-row="${nr}"][data-col="${nc}"]`
                                                    );
                                                    if (next) {
                                                      ev.preventDefault();
                                                      if (extend && anchorCell) setFocusCell({ r: nr, c: nc });
                                                      else { next.focus(); next.select(); }
                                                    }
                                                  };
                                                  if (ev.shiftKey && ev.key.startsWith('Arrow')) {
                                                    if (ev.key === 'ArrowDown') move(1, 0, true);
                                                    else if (ev.key === 'ArrowUp') move(-1, 0, true);
                                                    else if (ev.key === 'ArrowRight') move(0, 1, true);
                                                    else if (ev.key === 'ArrowLeft') move(0, -1, true);
                                                    return;
                                                  }
                                                  if (ev.key === 'Enter' || ev.key === 'ArrowDown') move(1, 0);
                                                  else if (ev.key === 'ArrowUp') move(-1, 0);
                                                  else if (ev.key === 'ArrowRight' && (target.selectionStart === target.value.length)) move(0, 1);
                                                  else if (ev.key === 'ArrowLeft' && (target.selectionStart === 0)) move(0, -1);
                                                  else if (ev.key === 'Tab' && !ev.shiftKey) {
                                                    if (ci === matieres.length - 1) { ev.preventDefault(); move(1, -(matieres.length - 1)); }
                                                  } else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'a') {
                                                    ev.preventDefault();
                                                    setAnchorCell({ r: 0, c: 0 });
                                                    setFocusCell({ r: visibleEleves.length - 1, c: matieres.length - 1 });
                                                  } else if (ev.key === 'Delete' && anchorCell && focusCell) {
                                                    const r1 = Math.min(anchorCell.r, focusCell.r), r2 = Math.max(anchorCell.r, focusCell.r);
                                                    const c1 = Math.min(anchorCell.c, focusCell.c), c2 = Math.max(anchorCell.c, focusCell.c);
                                                    if (r1 !== r2 || c1 !== c2) {
                                                      ev.preventDefault();
                                                      const updates: Record<string, string> = {};
                                                      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
                                                        const tE = visibleEleves[r], tM = matieres[c];
                                                        if (!tE || !tM) continue;
                                                        updates[`${tE.id}|${tM.id}`] = '';
                                                        saveOneNote.mutate({ eleve_id: tE.id, matiere_id: tM.id, value: '' });
                                                      }
                                                      setGridCells((s) => ({ ...s, ...updates }));
                                                    }
                                                  }
                                                }}
                                                className={`w-full h-10 px-1 text-center text-sm font-semibold bg-transparent outline-none focus:bg-primary/15 focus:ring-2 focus:ring-primary focus:z-10 relative tabular-nums transition-colors ${
                                                  isPass ? 'text-green-700 dark:text-green-400' : isFail ? 'text-destructive' : ''
                                                }`}
                                                placeholder="·"
                                              />
                                            </td>
                                          );
                                        })}
                                        <td className="sticky right-0 z-10 bg-muted/40 group-hover:bg-accent/60 border-l border-border px-2 py-1 text-center font-extrabold tabular-nums">
                                          <span className={moy === '—' ? 'text-muted-foreground' : parseFloat(moy) >= bareme / 2 ? 'text-green-700 dark:text-green-400' : 'text-destructive'}>
                                            {moy}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            <div className="px-4 py-2.5 text-xs text-muted-foreground border-t bg-muted/30 flex flex-wrap gap-x-4 gap-y-1 items-center">
                              <span className="font-semibold text-foreground">💡 Astuces :</span>
                              <span>↩ Entrée / ⇥ Tab / ↑↓←→ naviguer</span>
                              <span>⇧ Maj+clic ou ⇧+flèches pour sélectionner</span>
                              <span><kbd className="px-1.5 py-0.5 rounded bg-background border text-[10px] font-mono">Ctrl+C</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-background border text-[10px] font-mono">Ctrl+V</kbd> copier-coller</span>
                              <span><kbd className="px-1.5 py-0.5 rounded bg-background border text-[10px] font-mono">Suppr</kbd> effacer la sélection</span>
                              <span className="ml-auto opacity-70">Survolez l'en-tête d'une matière pour son nom complet</span>
                            </div>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {visibleEleves.map((e: any, i: number) => {
                            const prog = progressByEleve[e.id] || { done: 0, total: matieres.length };
                            const pct = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
                            const isComplete = prog.done === prog.total && prog.total > 0;
                            const isEmpty = prog.done === 0;
                            return (
                              <button
                                key={e.id}
                                onClick={() => setSelectedEleveId(e.id)}
                                className={`group text-left rounded-2xl border-2 p-4 transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] ${
                                  isComplete
                                    ? 'border-green-500/40 bg-green-500/5 hover:border-green-500'
                                    : isEmpty
                                      ? 'border-destructive/40 bg-destructive/5 hover:border-destructive'
                                      : 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500'
                                }`}
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="h-10 w-10 rounded-xl bg-background border flex items-center justify-center font-bold text-sm">
                                    {(e.prenom?.[0] || '') + (e.nom?.[0] || '')}
                                  </div>
                                  {isComplete ? (
                                    <Badge className="bg-green-600 hover:bg-green-700 gap-1"><CheckCircle className="h-3 w-3" /> Complet</Badge>
                                  ) : isEmpty ? (
                                    <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Vide</Badge>
                                  ) : (
                                    <Badge variant="outline" className="gap-1 border-amber-500 text-amber-700 dark:text-amber-400"><Circle className="h-3 w-3" /> Partiel</Badge>
                                  )}
                                </div>
                                <p className="font-semibold text-sm leading-tight truncate">{e.nom} {e.prenom}</p>
                                <p className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate">{e.matricule || '—'}</p>
                                <div className="mt-3 flex items-center gap-2">
                                  <Progress value={pct} className="h-1.5 flex-1" />
                                  <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{prog.done}/{prog.total}</span>
                                </div>
                                <div className="mt-3 flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">#{i + 1}</span>
                                  <span className="text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                    {isComplete ? 'Modifier' : 'Saisir'} <ChevronRight className="h-3 w-3" />
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
              )
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  {!cycleId ? 'Sélectionnez un cycle pour commencer' :
                   !classeId ? 'Sélectionnez une classe' :
                   !periodeId ? 'Sélectionnez une période' :
                   matieres.length === 0 ? 'Aucune matière assignée à cette classe. Configurez les matières dans Configuration > Classes.' :
                   'Aucun élève inscrit dans cette classe'}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Student Notes Dialog */}
      <Dialog open={!!selectedEleveId} onOpenChange={(open) => { if (!open) setSelectedEleveId(null); }}>
        <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedEleve?.prenom} {selectedEleve?.nom}</span>
              <Badge variant="outline" className="text-xs font-mono">{selectedEleve?.matricule}</Badge>
            </DialogTitle>
            <div className="flex items-center gap-2 mt-2">
              <Progress value={matieres.length > 0 ? (filledCount / matieres.length) * 100 : 0} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground tabular-nums">{filledCount}/{matieres.length}</span>
            </div>
            {currentIndex >= 0 && (
              <p className="text-xs text-muted-foreground">Élève {currentIndex + 1}/{eleves.length} • /{bareme}</p>
            )}
          </DialogHeader>

          <div className="space-y-2 mt-2">
            {matieres.map((m: any, idx: number) => {
              const hasNote = notesMap[m.id] !== undefined && notesMap[m.id] !== '';
              return (
                <div key={m.id} className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border-2 transition-colors ${hasNote ? 'border-green-500/30 bg-green-500/5' : 'border-border'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.nom}</p>
                    <p className="text-xs text-muted-foreground">Coef. {m.coefficient}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max={bareme}
                      step="0.5"
                      autoFocus={idx === 0 && !hasNote}
                      className="w-20 text-center font-semibold"
                      value={notesMap[m.id] || ''}
                      onChange={ev => setNotesMap(prev => ({ ...prev, [m.id]: ev.target.value }))}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter') {
                          ev.preventDefault();
                          const inputs = (ev.currentTarget.closest('.space-y-2') as HTMLElement)?.querySelectorAll('input');
                          const next = inputs?.[idx + 1] as HTMLInputElement | undefined;
                          if (next) next.focus();
                          else saveStudentNotes.mutate();
                        }
                      }}
                      placeholder="—"
                    />
                    <span className="text-xs text-muted-foreground">/{bareme}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            onClick={() => saveStudentNotes.mutate()}
            disabled={saveStudentNotes.isPending}
            className="w-full mt-4"
          >
            <Save className="h-4 w-4 mr-2" />
            {nextEleve
              ? `Enregistrer & passer à ${nextEleve.prenom} ${nextEleve.nom}`
              : 'Enregistrer & terminer'}
          </Button>
        </DialogContent>
      </Dialog>
      <ImportNotesExcel
        open={importOpen}
        onOpenChange={setImportOpen}
        onImportDone={() => queryClient.invalidateQueries({ queryKey: ['all-notes-period'] })}
      />
    </div>
  );
}
