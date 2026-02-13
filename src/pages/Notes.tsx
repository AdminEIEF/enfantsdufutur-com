import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Save, CheckCircle, Circle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

export default function Notes() {
  const [cycleId, setCycleId] = useState('');
  const [classeId, setClasseId] = useState('');
  const [periodeId, setPeriodeId] = useState('');
  const [matiereId, setMatiereId] = useState('');
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
        .select('*, niveaux!inner(cycle_id, nom, id)')
        .eq('niveaux.cycle_id', cycleId)
        .order('nom');
      if (error) throw error;
      return data;
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

  // Get the niveau_id of the selected class for filtering matières
  const selectedClasse = classes.find((c: any) => c.id === classeId);
  const selectedNiveauId = selectedClasse?.niveaux?.id || null;

  // Fetch matières for the cycle, then filter by niveau
  const { data: allMatieresCycle = [] } = useQuery({
    queryKey: ['matieres', cycleId],
    enabled: !!cycleId,
    queryFn: async () => {
      const { data, error } = await supabase.from('matieres').select('*').eq('cycle_id', cycleId).order('nom');
      if (error) throw error;
      return data;
    },
  });

  // Filter: matières with niveau_id matching selected niveau OR niveau_id is null (applies to all)
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

  // Fetch ALL notes for this class + period (all matières) for progress tracking
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

  // Notes for the currently selected matière
  const existingNotes = useMemo(() => {
    if (!matiereId) return [];
    return allNotesForPeriod.filter((n: any) => n.matiere_id === matiereId);
  }, [allNotesForPeriod, matiereId]);

  useEffect(() => {
    const map: Record<string, string> = {};
    existingNotes.forEach((n: any) => {
      map[n.eleve_id] = n.note !== null ? String(n.note) : '';
    });
    setNotesMap(map);
  }, [existingNotes]);

  // Per-student progress: count of matières with notes entered
  const progressByEleve = useMemo(() => {
    const totalMatieres = matieres.length;
    const map: Record<string, { done: number; total: number }> = {};
    // Get valid matière IDs for this niveau
    const matiereIds = new Set(matieres.map((m: any) => m.id));
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

  const saveNotes = useMutation({
    mutationFn: async () => {
      const upserts = eleves.map((e: any) => ({
        eleve_id: e.id,
        matiere_id: matiereId,
        periode_id: periodeId,
        note: notesMap[e.id] !== undefined && notesMap[e.id] !== '' ? parseFloat(notesMap[e.id]) : null,
      }));
      const { error } = await supabase.from('notes').upsert(upserts, { onConflict: 'eleve_id,matiere_id,periode_id', ignoreDuplicates: false });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-notes-period'] });
      toast({ title: 'Notes enregistrées', description: `${eleves.length} notes sauvegardées.` });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  const canShowGrid = classeId && periodeId && matiereId && eleves.length > 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <BookOpen className="h-7 w-7 text-primary" /> Saisie des Notes
      </h1>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Cycle</label>
              <Select value={cycleId} onValueChange={v => { setCycleId(v); setClasseId(''); setMatiereId(''); }}>
                <SelectTrigger><SelectValue placeholder="Cycle" /></SelectTrigger>
                <SelectContent>{cycles.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom} (/{c.bareme})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Classe</label>
              <Select value={classeId} onValueChange={(v) => { setClasseId(v); setMatiereId(''); }} disabled={!cycleId}>
                <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
                <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom} ({c.niveaux?.nom})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Période</label>
              <Select value={periodeId} onValueChange={setPeriodeId}>
                <SelectTrigger><SelectValue placeholder="Période" /></SelectTrigger>
                <SelectContent>{periodes.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Matière ({matieres.length} disponible{matieres.length > 1 ? 's' : ''})</label>
              <Select value={matiereId} onValueChange={setMatiereId} disabled={!cycleId || !classeId}>
                <SelectTrigger><SelectValue placeholder="Matière" /></SelectTrigger>
                <SelectContent>{matieres.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.nom} (coef. {m.coefficient})</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid */}
      {canShowGrid ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              {eleves.length} élève(s) — {matieres.find((m: any) => m.id === matiereId)?.nom}
              <span className="text-sm font-normal text-muted-foreground ml-2">(/{bareme})</span>
            </CardTitle>
            <Button onClick={() => saveNotes.mutate()} disabled={saveNotes.isPending}>
              <Save className="h-4 w-4 mr-2" /> Enregistrer
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Nom & Prénom</TableHead>
                  <TableHead className="w-48 text-center">Progression</TableHead>
                  <TableHead className="w-32 text-center">Note /{bareme}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eleves.map((e: any, i: number) => {
                  const prog = progressByEleve[e.id] || { done: 0, total: matieres.length };
                  const pct = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
                  const isComplete = prog.done === prog.total && prog.total > 0;
                  return (
                    <TableRow key={e.id}>
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
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max={bareme}
                          step="0.5"
                          className="w-24 mx-auto text-center"
                          value={notesMap[e.id] || ''}
                          onChange={ev => setNotesMap(prev => ({ ...prev, [e.id]: ev.target.value }))}
                          placeholder="—"
                        />
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
             !matiereId ? 'Sélectionnez une matière' :
             'Aucun élève inscrit dans cette classe'}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
