import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BookOpen, Save, CheckCircle, Circle, ChevronRight, AlertTriangle, Eye, EyeOff, FileSpreadsheet, GraduationCap, Users } from 'lucide-react';
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
  const queryClient = useQueryClient();

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
                            </div>
                          </div>
                          <div className="mt-4 flex items-center gap-3">
                            <Progress value={globalPct} className="h-2 flex-1" />
                            <span className="text-xs font-mono text-muted-foreground w-12 text-right">{globalPct}%</span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Grille moderne d'élèves */}
                      {visibleEleves.length === 0 ? (
                        <Card><CardContent className="py-10 text-center text-muted-foreground">
                          🎉 Tous les élèves ont leurs notes saisies !
                        </CardContent></Card>
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
