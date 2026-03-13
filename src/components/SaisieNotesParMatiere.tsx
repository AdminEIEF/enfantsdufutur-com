import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Save, CheckCircle, Circle, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

interface SaisieNotesParMatiereProps {
  matieres: any[];
  eleves: any[];
  allNotesForPeriod: any[];
  periodeId: string;
  bareme: number;
}

export default function SaisieNotesParMatiere({
  matieres,
  eleves,
  allNotesForPeriod,
  periodeId,
  bareme,
}: SaisieNotesParMatiereProps) {
  const [selectedMatiereId, setSelectedMatiereId] = useState('');
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const queryClient = useQueryClient();

  const selectedMatiere = matieres.find((m) => m.id === selectedMatiereId);
  const currentMatiereIndex = matieres.findIndex((m) => m.id === selectedMatiereId);

  // Progress per matière
  const progressByMatiere = useMemo(() => {
    const map: Record<string, { done: number; total: number }> = {};
    matieres.forEach((m) => {
      const notesForMatiere = allNotesForPeriod.filter(
        (n: any) => n.matiere_id === m.id && n.note !== null
      );
      map[m.id] = { done: notesForMatiere.length, total: eleves.length };
    });
    return map;
  }, [matieres, allNotesForPeriod, eleves]);

  // Load notes for selected matière into notesMap
  const loadNotesForMatiere = useCallback(
    (matiereId: string) => {
      const map: Record<string, string> = {};
      eleves.forEach((e: any) => {
        const note = allNotesForPeriod.find(
          (n: any) => n.eleve_id === e.id && n.matiere_id === matiereId
        );
        map[e.id] = note?.note !== null && note?.note !== undefined ? String(note.note) : '';
      });
      setNotesMap(map);
      setIsDirty(false);
    },
    [eleves, allNotesForPeriod]
  );

  const handleSelectMatiere = (matiereId: string) => {
    if (isDirty) {
      const confirm = window.confirm('Vous avez des modifications non sauvegardées. Continuer sans sauvegarder ?');
      if (!confirm) return;
    }
    setSelectedMatiereId(matiereId);
    loadNotesForMatiere(matiereId);
  };

  const handleNoteChange = (eleveId: string, value: string) => {
    setNotesMap((prev) => ({ ...prev, [eleveId]: value }));
    setIsDirty(true);
  };

  const filledCount = useMemo(() => {
    return eleves.filter((e: any) => notesMap[e.id] !== undefined && notesMap[e.id] !== '').length;
  }, [notesMap, eleves]);

  const saveMatiereNotes = useMutation({
    mutationFn: async () => {
      if (!selectedMatiereId || !periodeId) throw new Error('Données manquantes');
      const upserts = eleves.map((e: any) => ({
        eleve_id: e.id,
        matiere_id: selectedMatiereId,
        periode_id: periodeId,
        note: notesMap[e.id] !== undefined && notesMap[e.id] !== '' ? parseFloat(notesMap[e.id]) : null,
      }));
      const { error } = await supabase
        .from('notes')
        .upsert(upserts, { onConflict: 'eleve_id,matiere_id,periode_id', ignoreDuplicates: false });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-notes-period'] });
      setIsDirty(false);
      toast({
        title: 'Notes enregistrées',
        description: `Notes de ${selectedMatiere?.nom} sauvegardées pour ${filledCount} élève(s).`,
      });
    },
    onError: (err: Error) =>
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  const goToMatiere = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'next' ? currentMatiereIndex + 1 : currentMatiereIndex - 1;
    if (newIndex >= 0 && newIndex < matieres.length) {
      handleSelectMatiere(matieres[newIndex].id);
    }
  };

  const saveAndNext = () => {
    saveMatiereNotes.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['all-notes-period'] });
        setIsDirty(false);
        const nextIndex = currentMatiereIndex + 1;
        if (nextIndex < matieres.length) {
          const nextM = matieres[nextIndex];
          setSelectedMatiereId(nextM.id);
          // We need to reload from fresh data - since invalidation is async, load from current map
          setTimeout(() => loadNotesForMatiere(nextM.id), 300);
          toast({
            title: 'Notes enregistrées',
            description: `${selectedMatiere?.nom} ✓ — Passage à ${nextM.nom}`,
          });
        } else {
          toast({
            title: '✅ Saisie terminée',
            description: 'Toutes les matières ont été traitées.',
          });
        }
      },
    });
  };

  // Overall progress
  const overallDone = useMemo(() => {
    return matieres.filter((m) => {
      const prog = progressByMatiere[m.id];
      return prog && prog.done === prog.total && prog.total > 0;
    }).length;
  }, [matieres, progressByMatiere]);

  return (
    <div className="space-y-4">
      {/* Matière selector with progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>
              Sélectionner une matière ({overallDone}/{matieres.length} complètes)
            </span>
            <Badge variant="outline">/{bareme}</Badge>
          </CardTitle>
          <Progress
            value={matieres.length > 0 ? (overallDone / matieres.length) * 100 : 0}
            className="h-2"
          />
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {matieres.map((m) => {
              const prog = progressByMatiere[m.id] || { done: 0, total: eleves.length };
              const isComplete = prog.done === prog.total && prog.total > 0;
              const isSelected = m.id === selectedMatiereId;
              return (
                <Button
                  key={m.id}
                  variant={isSelected ? 'default' : isComplete ? 'outline' : 'secondary'}
                  className={`justify-between h-auto py-2 px-3 ${isComplete && !isSelected ? 'border-green-500/50' : ''}`}
                  onClick={() => handleSelectMatiere(m.id)}
                >
                  <span className="text-left text-xs font-medium truncate flex-1">{m.nom}</span>
                  {isComplete ? (
                    <CheckCircle className="h-3.5 w-3.5 text-green-500 ml-1 shrink-0" />
                  ) : (
                    <span className="text-xs text-muted-foreground ml-1 shrink-0">
                      {prog.done}/{prog.total}
                    </span>
                  )}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Grade entry table for selected matière */}
      {selectedMatiereId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={currentMatiereIndex <= 0}
                  onClick={() => goToMatiere('prev')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div>
                  <CardTitle className="text-lg">{selectedMatiere?.nom}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Coef. {selectedMatiere?.coefficient} — Matière {currentMatiereIndex + 1}/{matieres.length}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={currentMatiereIndex >= matieres.length - 1}
                  onClick={() => goToMatiere('next')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Progress
                  value={eleves.length > 0 ? (filledCount / eleves.length) * 100 : 0}
                  className="h-2 w-24"
                />
                <Badge variant={filledCount === eleves.length ? 'default' : 'outline'}>
                  {filledCount}/{eleves.length}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[50vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 sticky top-0 bg-background">#</TableHead>
                    <TableHead className="sticky top-0 bg-background">Matricule</TableHead>
                    <TableHead className="sticky top-0 bg-background">Nom & Prénom</TableHead>
                    <TableHead className="w-32 text-center sticky top-0 bg-background">
                      Note /{bareme}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eleves.map((e: any, i: number) => {
                    const hasNote = notesMap[e.id] !== undefined && notesMap[e.id] !== '';
                    return (
                      <TableRow key={e.id} className={hasNote ? 'bg-accent/5' : ''}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-mono text-xs">{e.matricule || '—'}</TableCell>
                        <TableCell className="font-medium">
                          {e.nom} {e.prenom}
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min="0"
                            max={bareme}
                            step="0.5"
                            className="w-20 text-center mx-auto"
                            value={notesMap[e.id] || ''}
                            onChange={(ev) => handleNoteChange(e.id, ev.target.value)}
                            placeholder="—"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="p-4 border-t flex gap-2">
              <Button
                onClick={() => saveMatiereNotes.mutate()}
                disabled={saveMatiereNotes.isPending}
                variant="outline"
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                Enregistrer
              </Button>
              <Button
                onClick={saveAndNext}
                disabled={saveMatiereNotes.isPending || currentMatiereIndex >= matieres.length - 1}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                {currentMatiereIndex < matieres.length - 1
                  ? `Enregistrer & passer à ${matieres[currentMatiereIndex + 1]?.nom}`
                  : 'Enregistrer & terminer'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
