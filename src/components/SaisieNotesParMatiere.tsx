import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Save, CheckCircle } from 'lucide-react';
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
  // notesMap: { [eleveId]: { [matiereId]: string } }
  const [notesMap, setNotesMap] = useState<Record<string, Record<string, string>>>({});
  const [isDirty, setIsDirty] = useState(false);
  const queryClient = useQueryClient();

  // Load all notes into the grid
  useEffect(() => {
    const map: Record<string, Record<string, string>> = {};
    eleves.forEach((e: any) => {
      map[e.id] = {};
      matieres.forEach((m: any) => {
        const note = allNotesForPeriod.find(
          (n: any) => n.eleve_id === e.id && n.matiere_id === m.id
        );
        map[e.id][m.id] = note?.note !== null && note?.note !== undefined ? String(note.note) : '';
      });
    });
    setNotesMap(map);
    setIsDirty(false);
  }, [eleves, matieres, allNotesForPeriod]);

  const handleNoteChange = (eleveId: string, matiereId: string, value: string) => {
    setNotesMap((prev) => ({
      ...prev,
      [eleveId]: { ...prev[eleveId], [matiereId]: value },
    }));
    setIsDirty(true);
  };

  // Progress stats
  const { totalNotes, filledNotes, completedMatieres } = useMemo(() => {
    const total = eleves.length * matieres.length;
    let filled = 0;
    const matiereComplete: Record<string, boolean> = {};

    matieres.forEach((m: any) => {
      let count = 0;
      eleves.forEach((e: any) => {
        if (notesMap[e.id]?.[m.id] !== undefined && notesMap[e.id]?.[m.id] !== '') {
          filled++;
          count++;
        }
      });
      matiereComplete[m.id] = count === eleves.length && eleves.length > 0;
    });

    return {
      totalNotes: total,
      filledNotes: filled,
      completedMatieres: Object.values(matiereComplete).filter(Boolean).length,
    };
  }, [notesMap, eleves, matieres]);

  const saveAllNotes = useMutation({
    mutationFn: async () => {
      if (!periodeId) throw new Error('Période manquante');
      const upserts: any[] = [];
      eleves.forEach((e: any) => {
        matieres.forEach((m: any) => {
          const val = notesMap[e.id]?.[m.id];
          upserts.push({
            eleve_id: e.id,
            matiere_id: m.id,
            periode_id: periodeId,
            note: val !== undefined && val !== '' ? parseFloat(val) : null,
          });
        });
      });
      const { error } = await supabase
        .from('notes')
        .upsert(upserts, { onConflict: 'eleve_id,matiere_id,periode_id', ignoreDuplicates: false });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-notes-period'] });
      setIsDirty(false);
      toast({ title: 'Notes enregistrées', description: `${filledNotes} note(s) sauvegardée(s).` });
    },
    onError: (err: Error) =>
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg">
            {eleves.length} élève(s) — {matieres.length} matière(s)
            <span className="text-sm font-normal text-muted-foreground ml-2">/{bareme}</span>
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Progress
                value={totalNotes > 0 ? (filledNotes / totalNotes) * 100 : 0}
                className="h-2 w-28"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {filledNotes}/{totalNotes} notes
              </span>
            </div>
            <Badge variant={completedMatieres === matieres.length ? 'default' : 'outline'}>
              <CheckCircle className="h-3 w-3 mr-1" />
              {completedMatieres}/{matieres.length} matières
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                <th className="sticky left-0 z-20 bg-muted px-2 py-2 text-left font-medium text-muted-foreground w-10 border-b border-r">
                  #
                </th>
                <th className="sticky left-10 z-20 bg-muted px-2 py-2 text-left font-medium text-muted-foreground min-w-[160px] border-b border-r">
                  Élève
                </th>
                {matieres.map((m: any) => {
                  const count = eleves.filter(
                    (e: any) => notesMap[e.id]?.[m.id] !== undefined && notesMap[e.id]?.[m.id] !== ''
                  ).length;
                  const isComplete = count === eleves.length && eleves.length > 0;
                  return (
                    <th
                      key={m.id}
                      className={`px-1 py-2 text-center font-medium border-b min-w-[72px] ${
                        isComplete ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'
                      }`}
                    >
                      <div className="text-xs leading-tight truncate max-w-[80px] mx-auto" title={m.nom}>
                        {m.nom}
                      </div>
                      <div className="text-[10px] opacity-60">
                        c.{m.coefficient} • {count}/{eleves.length}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {eleves.map((e: any, i: number) => {
                const eleveFilledCount = matieres.filter(
                  (m: any) => notesMap[e.id]?.[m.id] !== undefined && notesMap[e.id]?.[m.id] !== ''
                ).length;
                const isRowComplete = eleveFilledCount === matieres.length && matieres.length > 0;
                return (
                  <tr
                    key={e.id}
                    className={`border-b transition-colors hover:bg-muted/50 ${
                      isRowComplete ? 'bg-green-50/50 dark:bg-green-950/20' : ''
                    }`}
                  >
                    <td className="sticky left-0 bg-background px-2 py-1 text-muted-foreground text-xs border-r">
                      {i + 1}
                    </td>
                    <td className="sticky left-10 bg-background px-2 py-1 border-r">
                      <div className="font-medium text-xs whitespace-nowrap">
                        {e.nom} {e.prenom}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {e.matricule || '—'}
                      </div>
                    </td>
                    {matieres.map((m: any) => (
                      <td key={m.id} className="px-1 py-1 text-center">
                        <Input
                          type="number"
                          min="0"
                          max={bareme}
                          step="0.5"
                          className="w-16 h-8 text-center text-xs mx-auto px-1"
                          value={notesMap[e.id]?.[m.id] || ''}
                          onChange={(ev) => handleNoteChange(e.id, m.id, ev.target.value)}
                          placeholder="—"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t">
          <Button
            onClick={() => saveAllNotes.mutate()}
            disabled={saveAllNotes.isPending || !isDirty}
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            {isDirty ? 'Enregistrer toutes les notes' : 'Aucune modification'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
