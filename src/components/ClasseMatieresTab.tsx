import { useState, useEffect, useMemo } from 'react';
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
    const map: Record<string, { coef: number; ordre: number }> = {};
    assignments.forEach(a => { map[a.matiere_id] = { coef: a.coefficient, ordre: a.ordre }; });
    setLocal(map);
  }, [assignments, selectedClasseId]);

  const handleClasseChange = (v: string) => {
    setSelectedClasseId(v);
    setLocal({});
  };

  const nextOrdre = (map: Record<string, { coef: number; ordre: number } | undefined>) => {
    const vals = Object.values(map).filter(Boolean) as { coef: number; ordre: number }[];
    return vals.length ? Math.max(...vals.map(v => v.ordre)) + 1 : 1;
  };

  const toggleMatiere = (matiereId: string) => {
    setLocal(prev => {
      const next = { ...prev };
      if (next[matiereId]) delete next[matiereId];
      else next[matiereId] = { coef: 1, ordre: nextOrdre(next) };
      return next;
    });
  };

  const setCoef = (matiereId: string, value: string) => {
    const num = parseFloat(value.replace(',', '.'));
    setLocal(prev => {
      const cur = prev[matiereId];
      if (!cur) return prev;
      return { ...prev, [matiereId]: { ...cur, coef: isNaN(num) ? 1 : Math.max(0.1, num) } };
    });
  };

  const selectAll = () => {
    setLocal(prev => {
      const next: Record<string, { coef: number; ordre: number }> = {};
      let n = 1;
      // Garder l'ordre existant en premier
      const existing = Object.entries(prev).filter(([, v]) => v).sort((a, b) => a[1]!.ordre - b[1]!.ordre);
      existing.forEach(([id, v]) => { next[id] = { coef: v!.coef, ordre: n++ }; });
      matieres.forEach((m: any) => {
        if (!next[m.id]) next[m.id] = { coef: 1, ordre: n++ };
      });
      return next;
    });
  };
  const deselectAll = () => setLocal({});

  const move = (matiereId: string, direction: -1 | 1) => {
    setLocal(prev => {
      const sorted = (Object.entries(prev).filter(([, v]) => v) as [string, { coef: number; ordre: number }][])
        .sort((a, b) => a[1].ordre - b[1].ordre);
      const idx = sorted.findIndex(([id]) => id === matiereId);
      const swap = idx + direction;
      if (idx < 0 || swap < 0 || swap >= sorted.length) return prev;
      [sorted[idx], sorted[swap]] = [sorted[swap], sorted[idx]];
      const next: Record<string, { coef: number; ordre: number }> = { ...prev };
      sorted.forEach(([id, v], i) => { next[id] = { ...v, ordre: i + 1 }; });
      return next;
    });
  };

  const checkedIds = Object.keys(local).filter(id => local[id]);
  const orderedChecked = checkedIds
    .map(id => ({ id, ...(local[id] as { coef: number; ordre: number }) }))
    .sort((a, b) => a.ordre - b.ordre);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClasseId) throw new Error('Choisir une classe');
      await supabase.from('classe_matieres').delete().eq('classe_id', selectedClasseId);
      if (orderedChecked.length > 0) {
        const rows = orderedChecked.map((o, i) => ({
          classe_id: selectedClasseId,
          matiere_id: o.id,
          coefficient: o.coef,
          ordre: i + 1,
        }));
        const { error } = await supabase.from('classe_matieres').insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classe-matieres', selectedClasseId] });
      toast.success(`${orderedChecked.length} matière(s) enregistrée(s) dans l'ordre choisi`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const grouped = matieres.reduce((acc: Record<string, any[]>, m: any) => {
    const pole = m.pole || 'Autres';
    if (!acc[pole]) acc[pole] = [];
    acc[pole].push(m);
    return acc;
  }, {});

  const matiereById = useMemo(() => {
    const m: Record<string, any> = {};
    matieres.forEach((x: any) => { m[x.id] = x; });
    return m;
  }, [matieres]);

  const hasChanges = (() => {
    const initial = assignments.slice().sort((a, b) => a.ordre - b.ordre);
    if (initial.length !== orderedChecked.length) return true;
    for (let i = 0; i < initial.length; i++) {
      if (initial[i].matiere_id !== orderedChecked[i].id) return true;
      if (Number(initial[i].coefficient) !== Number(orderedChecked[i].coef)) return true;
    }
    return false;
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
                      const isChecked = !!local[m.id];
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
                                value={local[m.id]?.coef ?? 1}
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

            {orderedChecked.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Ordre des matières (utilisé partout : saisie, Excel, bulletins)
                </h4>
                <div className="space-y-1">
                  {orderedChecked.map((o, i) => (
                    <div key={o.id} className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                      <span className="text-xs font-mono w-6 text-muted-foreground">{i + 1}.</span>
                      <span className="text-sm flex-1 truncate">{matiereById[o.id]?.nom || '—'}</span>
                      <Badge variant="outline" className="text-xs">Coef {o.coef}</Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => move(o.id, -1)}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === orderedChecked.length - 1} onClick={() => move(o.id, 1)}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
