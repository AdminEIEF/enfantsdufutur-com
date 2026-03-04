import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BookOpen, Save, CheckCircle, Circle, ChevronRight, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { sortClasses } from '@/lib/utils';

export default function Notes() {
  const [cycleId, setCycleId] = useState('');
  const [classeId, setClasseId] = useState('');
  const [periodeId, setPeriodeId] = useState('');
  const [selectedEleveId, setSelectedEleveId] = useState<string | null>(null);
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data: cycles = [] } = useQuery({
    queryKey: ['cycles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cycles').select('*').order('ordre');
      if (error) throw error;
      return data;
    },
  });

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

  const { data: allMatieresCycle = [] } = useQuery({
    queryKey: ['matieres', cycleId],
    enabled: !!cycleId,
    queryFn: async () => {
      const { data, error } = await supabase.from('matieres').select('*').eq('cycle_id', cycleId).order('nom');
      if (error) throw error;
      return data;
    },
  });

  const matieres = useMemo(() => {
    if (!selectedNiveauId) return allMatieresCycle;
    return allMatieresCycle.filter((m: any) => !m.niveau_id || m.niveau_id === selectedNiveauId);
  }, [allMatieresCycle, selectedNiveauId]);

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

  // Fetch ALL notes for this class + period
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

  // Per-student progress
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

  const selectedCycle = cycles.find((c: any) => c.id === cycleId);
  const bareme = selectedCycle?.bareme ?? 20;

  // When opening student dialog, load their notes into notesMap
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

  // Count how many notes are filled for current student
  const filledCount = useMemo(() => {
    return matieres.filter((m: any) => notesMap[m.id] !== undefined && notesMap[m.id] !== '').length;
  }, [notesMap, matieres]);

  const allFilled = filledCount === matieres.length && matieres.length > 0;

  // Find current index and next student
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
      // Go to next student or close
      if (nextEleve) {
        setSelectedEleveId(nextEleve.id);
      } else {
        setSelectedEleveId(null);
        toast({ title: '✅ Saisie terminée', description: 'Tous les élèves ont été traités.' });
      }
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  const canShowList = classeId && periodeId && eleves.length > 0 && matieres.length > 0;

  // Bulletin publication toggle
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <BookOpen className="h-7 w-7 text-primary" /> Saisie des Notes
      </h1>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Cycle</label>
              <Select value={cycleId} onValueChange={v => { setCycleId(v); setClasseId(''); setSelectedEleveId(null); }}>
                <SelectTrigger><SelectValue placeholder="Cycle" /></SelectTrigger>
                <SelectContent>{cycles.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom} (/{c.bareme})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Classe</label>
              <Select value={classeId} onValueChange={(v) => { setClasseId(v); setSelectedEleveId(null); }} disabled={!cycleId}>
                <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
                <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom} ({c.niveaux?.nom})</SelectItem>)}</SelectContent>
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

          {/* Publication toggle */}
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {eleves.length} élève(s) — {matieres.length} matière(s)
              <span className="text-sm font-normal text-muted-foreground ml-2">(/{bareme})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Nom & Prénom</TableHead>
                  <TableHead className="w-48 text-center">Progression</TableHead>
                  <TableHead className="w-32 text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eleves.map((e: any, i: number) => {
                  const prog = progressByEleve[e.id] || { done: 0, total: matieres.length };
                  const pct = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
                  const isComplete = prog.done === prog.total && prog.total > 0;
                  return (
                    <TableRow key={e.id} className={isComplete ? 'bg-accent/5' : ''}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{e.matricule || '—'}</TableCell>
                      <TableCell className="font-medium">{e.nom} {e.prenom}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-2 flex-1" />
                          <span className="text-xs whitespace-nowrap">
                            {isComplete ? (
                              <Badge variant="default" className="text-xs gap-1"><CheckCircle className="h-3 w-3" /> {prog.done}/{prog.total}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs gap-1"><Circle className="h-3 w-3" /> {prog.done}/{prog.total}</Badge>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button size="sm" variant={isComplete ? 'outline' : 'default'} onClick={() => setSelectedEleveId(e.id)}>
                          {isComplete ? 'Modifier' : 'Saisir'} <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {!cycleId ? 'Sélectionnez un cycle pour commencer' :
             !classeId ? 'Sélectionnez une classe' :
             !periodeId ? 'Sélectionnez une période' :
             matieres.length === 0 ? 'Aucune matière configurée pour ce niveau' :
             'Aucun élève inscrit dans cette classe'}
          </CardContent>
        </Card>
      )}

      {/* Student Notes Dialog — all subjects at once */}
      <Dialog open={!!selectedEleveId} onOpenChange={(open) => {
        if (!open && !allFilled && matieres.length > 0) {
          toast({ title: 'Saisie incomplète', description: `Il reste ${matieres.length - filledCount} matière(s) à saisir.`, variant: 'destructive' });
          return; // Prevent closing
        }
        if (!open) setSelectedEleveId(null);
      }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" onPointerDownOutside={(e) => {
          if (!allFilled && matieres.length > 0) e.preventDefault();
        }} onEscapeKeyDown={(e) => {
          if (!allFilled && matieres.length > 0) e.preventDefault();
        }}>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedEleve?.prenom} {selectedEleve?.nom}</span>
              <Badge variant="outline" className="text-xs font-mono">{selectedEleve?.matricule}</Badge>
            </DialogTitle>
            <div className="flex items-center gap-2 mt-2">
              <Progress value={matieres.length > 0 ? (filledCount / matieres.length) * 100 : 0} className="h-2 flex-1" />
              <span className="text-xs text-muted-foreground">{filledCount}/{matieres.length}</span>
            </div>
            {!allFilled && (
              <p className="text-xs text-warning flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3 w-3" /> Toutes les notes doivent être saisies avant de valider
              </p>
            )}
            {currentIndex >= 0 && (
              <p className="text-xs text-muted-foreground">Élève {currentIndex + 1}/{eleves.length}</p>
            )}
          </DialogHeader>

          <div className="space-y-2 mt-2">
            {matieres.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between gap-3 p-2 rounded border">
                <div className="flex-1">
                  <p className="text-sm font-medium">{m.nom}</p>
                  <p className="text-xs text-muted-foreground">Coef. {m.coefficient}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max={bareme}
                    step="0.5"
                    className="w-20 text-center"
                    value={notesMap[m.id] || ''}
                    onChange={ev => setNotesMap(prev => ({ ...prev, [m.id]: ev.target.value }))}
                    placeholder="—"
                  />
                  <span className="text-xs text-muted-foreground">/{bareme}</span>
                </div>
              </div>
            ))}
          </div>

          <Button
            onClick={() => saveStudentNotes.mutate()}
            disabled={!allFilled || saveStudentNotes.isPending}
            className="w-full mt-4"
          >
            <Save className="h-4 w-4 mr-2" />
            {allFilled
              ? nextEleve
                ? `Enregistrer & passer à ${nextEleve.prenom} ${nextEleve.nom}`
                : 'Enregistrer & terminer'
              : `Il reste ${matieres.length - filledCount} note(s) à saisir`
            }
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
