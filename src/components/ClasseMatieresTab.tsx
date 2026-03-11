import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { sortClasses } from '@/lib/utils';
import { BookOpen, Loader2, Save, CheckCircle2 } from 'lucide-react';

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

  // Get matières matching the classe's niveau or cycle
  const { data: matieres = [] } = useQuery({
    queryKey: ['config-matieres-for-classe', selectedNiveauId, selectedCycleId],
    queryFn: async () => {
      if (!selectedNiveauId && !selectedCycleId) return [];
      let query = supabase.from('matieres').select('id, nom, pole, ordre, niveau_id, cycle_id').order('ordre');
      // Get matières that match the niveau OR cycle (when niveau_id is null)
      const { data } = await query;
      return (data || []).filter((m: any) => {
        if (m.niveau_id === selectedNiveauId) return true;
        if (!m.niveau_id && m.cycle_id === selectedCycleId) return true;
        return false;
      });
    },
    enabled: !!selectedNiveauId,
  });

  // Get current assignments for selected classe
  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ['classe-matieres', selectedClasseId],
    queryFn: async () => {
      if (!selectedClasseId) return [];
      const { data } = await supabase
        .from('classe_matieres')
        .select('matiere_id')
        .eq('classe_id', selectedClasseId);
      return (data || []).map((d: any) => d.matiere_id);
    },
    enabled: !!selectedClasseId,
  });

  const [localChecked, setLocalChecked] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Sync when assignments load
  if (assignments.length > 0 && !initialized) {
    setLocalChecked(assignments);
    setInitialized(true);
  }

  const handleClasseChange = (v: string) => {
    setSelectedClasseId(v);
    setLocalChecked([]);
    setInitialized(false);
  };

  const toggleMatiere = (matiereId: string) => {
    setLocalChecked(prev =>
      prev.includes(matiereId) ? prev.filter(id => id !== matiereId) : [...prev, matiereId]
    );
  };

  const selectAll = () => setLocalChecked(matieres.map((m: any) => m.id));
  const deselectAll = () => setLocalChecked([]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClasseId) throw new Error('Choisir une classe');
      // Delete existing then insert new
      await supabase.from('classe_matieres').delete().eq('classe_id', selectedClasseId);
      if (localChecked.length > 0) {
        const rows = localChecked.map(matiere_id => ({ classe_id: selectedClasseId, matiere_id }));
        const { error } = await supabase.from('classe_matieres').insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classe-matieres', selectedClasseId] });
      toast.success(`${localChecked.length} matière(s) affectée(s) à la classe`);
      setInitialized(true);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Group matières by pole
  const grouped = matieres.reduce((acc: Record<string, any[]>, m: any) => {
    const pole = m.pole || 'Autres';
    if (!acc[pole]) acc[pole] = [];
    acc[pole].push(m);
    return acc;
  }, {});

  const hasChanges = JSON.stringify([...localChecked].sort()) !== JSON.stringify([...assignments].sort());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" /> Matières par classe
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Sélectionnez une classe puis cochez les matières enseignées dans cette classe.
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
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>Tout cocher</Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>Tout décocher</Button>
              <Badge variant="secondary">{localChecked.length}/{matieres.length} sélectionnée(s)</Badge>
            </div>

            <div className="space-y-4">
              {Object.entries(grouped).map(([pole, items]) => (
                <div key={pole} className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{pole}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {(items as any[]).map((m: any) => (
                      <label
                        key={m.id}
                        className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                          localChecked.includes(m.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <Checkbox
                          checked={localChecked.includes(m.id)}
                          onCheckedChange={() => toggleMatiere(m.id)}
                        />
                        <span className="text-sm">{m.nom}</span>
                      </label>
                    ))}
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
