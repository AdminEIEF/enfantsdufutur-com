import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { sortClasses } from '@/lib/utils';
import { BookOpen, Loader2, Save, CheckCircle2, ArrowUp, ArrowDown } from 'lucide-react';

type Assignment = { matiere_id: string; coefficient: number; ordre: number };

export default function ClasseMatieresTab() {
  const qc = useQueryClient();
  const [selectedClasseId, setSelectedClasseId] = useState('');

  const { data: classes = [] } = useQuery({
    queryKey: ['config-classes-for-matieres'],
    queryFn: async () => {
      const { data } = await supabase
        .from('classes')
        .select('id, nom, niveau_id, niveaux:niveau_id(id, nom, ordre, cycle_id, cycles:cycle_id(id, nom, ordre))');
      return sortClasses(data || []);
    },
  });

  const selectedClasse = classes.find((c: any) => c.id === selectedClasseId);
  const selectedNiveauId = (selectedClasse as any)?.niveau_id;
  const selectedCycleId = (selectedClasse as any)?.niveaux?.cycle_id;

  const { data: matieres = [] } = useQuery({
    queryKey: ['config-matieres-for-classe', selectedNiveauId, selectedCycleId],
    queryFn: async () => {
      if (!selectedNiveauId && !selectedCycleId) return [];
      const { data } = await supabase.from('matieres').select('id, nom, pole, ordre, niveau_id, cycle_id').order('ordre');
      return (data || []).filter((m: any) => {
        if (m.niveau_id === selectedNiveauId) return true;
        if (!m.niveau_id && m.cycle_id === selectedCycleId) return true;
        return false;
      });
    },
    enabled: !!selectedNiveauId,
  });

  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ['classe-matieres', selectedClasseId],
    queryFn: async () => {
      if (!selectedClasseId) return [] as Assignment[];
      const { data } = await supabase
        .from('classe_matieres')
        .select('matiere_id, coefficient, ordre')
        .eq('classe_id', selectedClasseId)
        .order('ordre');
      return (data || []).map((d: any, i: number) => ({
        matiere_id: d.matiere_id,
        coefficient: Number(d.coefficient ?? 1),
        ordre: Number(d.ordre ?? i + 1),
      })) as Assignment[];
    },
    enabled: !!selectedClasseId,
  });

  // local: matiere_id -> { coef, ordre } (absent = non sélectionné)
  const [local, setLocal] = useState<Record<string, { coef: number; ordre: number } | undefined>>({});

  useEffect(() => {
    const map: Record<string, { coef: number; ordre: number }> = {};
    assignments.forEach(a => { map[a.matiere_id] = { coef: a.coefficient, ordre: a.ordre }; });
    setLocal(map);
  }, [assignments, selectedClasseId]);

  useEffect(() => {
    const map: Record<string, number | null> = {};
    assignments.forEach(a => { map[a.matiere_id] = a.coefficient; });
    setLocal(map);
  }, [assignments, selectedClasseId]);

  const handleClasseChange = (v: string) => {
    setSelectedClasseId(v);
    setLocal({});
  };

  const toggleMatiere = (matiereId: string) => {
    setLocal(prev => {
      const next = { ...prev };
      if (next[matiereId] != null) delete next[matiereId];
      else next[matiereId] = 1;
      return next;
    });
  };

  const setCoef = (matiereId: string, value: string) => {
    const num = parseFloat(value.replace(',', '.'));
    setLocal(prev => ({ ...prev, [matiereId]: isNaN(num) ? 1 : Math.max(0.1, num) }));
  };

  const selectAll = () => {
    const map: Record<string, number> = {};
    matieres.forEach((m: any) => { map[m.id] = local[m.id] ?? 1; });
    setLocal(map);
  };
  const deselectAll = () => setLocal({});

  const checkedIds = Object.keys(local).filter(id => local[id] != null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClasseId) throw new Error('Choisir une classe');
      await supabase.from('classe_matieres').delete().eq('classe_id', selectedClasseId);
      if (checkedIds.length > 0) {
        const rows = checkedIds.map(matiere_id => ({
          classe_id: selectedClasseId,
          matiere_id,
          coefficient: local[matiere_id] ?? 1,
        }));
        const { error } = await supabase.from('classe_matieres').insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classe-matieres', selectedClasseId] });
      toast.success(`${checkedIds.length} matière(s) affectée(s) avec coefficients`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const grouped = matieres.reduce((acc: Record<string, any[]>, m: any) => {
    const pole = m.pole || 'Autres';
    if (!acc[pole]) acc[pole] = [];
    acc[pole].push(m);
    return acc;
  }, {});

  // Détection de changements (matière sélectionnée OU coefficient modifié)
  const hasChanges = (() => {
    const initialMap: Record<string, number> = {};
    assignments.forEach(a => { initialMap[a.matiere_id] = a.coefficient; });
    const initialKeys = Object.keys(initialMap).sort().join(',');
    const currentKeys = checkedIds.slice().sort().join(',');
    if (initialKeys !== currentKeys) return true;
    return checkedIds.some(id => Number(initialMap[id]) !== Number(local[id]));
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" /> Matières par classe
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Sélectionnez une classe puis cochez les matières et ajustez le coefficient (par défaut 1).
        </p>

        <div className="max-w-sm">
          <Label>Classe</Label>
          <Select value={selectedClasseId || '__none__'} onValueChange={v => handleClasseChange(v === '__none__' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir une classe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Choisir une classe —</SelectItem>
              {classes.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.niveaux?.nom} — {c.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedClasseId && loadingAssignments && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {selectedClasseId && !loadingAssignments && matieres.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">
            Aucune matière trouvée pour le niveau/cycle de cette classe. Créez d'abord des matières dans l'onglet "Matières".
          </p>
        )}

        {selectedClasseId && !loadingAssignments && matieres.length > 0 && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={selectAll}>Tout cocher</Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>Tout décocher</Button>
              <Badge variant="secondary">{checkedIds.length}/{matieres.length} sélectionnée(s)</Badge>
            </div>

            <div className="space-y-4">
              {Object.entries(grouped).map(([pole, items]) => (
                <div key={pole} className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{pole}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {(items as any[]).map((m: any) => {
                      const isChecked = local[m.id] != null;
                      return (
                        <div
                          key={m.id}
                          className={`flex items-center gap-2 p-2 rounded-md border transition-colors ${
                            isChecked ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                          }`}
                        >
                          <div
                            onClick={() => toggleMatiere(m.id)}
                            className="flex items-center gap-2 flex-1 cursor-pointer min-w-0"
                          >
                            <Checkbox checked={isChecked} onCheckedChange={() => toggleMatiere(m.id)} />
                            <span className="text-sm truncate">{m.nom}</span>
                          </div>
                          {isChecked && (
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-xs text-muted-foreground">Coef</span>
                              <Input
                                type="number"
                                min={0.1}
                                step={0.5}
                                value={local[m.id] ?? 1}
                                onChange={e => setCoef(m.id, e.target.value)}
                                className="h-7 w-14 text-center px-1"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !hasChanges}
                className="gap-2"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Enregistrer
              </Button>
              {!hasChanges && assignments.length > 0 && (
                <span className="text-sm text-primary flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> À jour
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
