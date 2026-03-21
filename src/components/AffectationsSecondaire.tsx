import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { sortClasses } from '@/lib/utils';
import { Plus, Trash2, Loader2, GraduationCap, School, RotateCcw, Archive } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AffectationsSecondaire() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [formClasseId, setFormClasseId] = useState('');
  const [tab, setTab] = useState('actif');

  // Secondary teachers (ESC prefix)
  const { data: enseignants = [] } = useQuery({
    queryKey: ['affect-sec-enseignants'],
    queryFn: async () => {
      const { data } = await supabase
        .from('employes')
        .select('id, nom, prenom, matricule, poste')
        .eq('categorie', 'enseignant')
        .eq('statut', 'actif')
        .order('nom');
      return (data || []).filter((e: any) => e.matricule?.startsWith('ESC'));
    },
  });

  // Secondary classes only
  const { data: classes = [] } = useQuery({
    queryKey: ['affect-sec-classes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('classes')
        .select('id, nom, niveaux:niveau_id(nom, ordre, cycles:cycle_id(nom, ordre))');
      const result = (data || []).filter((c: any) => {
        const cycleName = c.niveaux?.cycles?.nom?.toLowerCase() || '';
        return cycleName.includes('secondaire') || cycleName.includes('lycée') || cycleName.includes('collège');
      });
      return sortClasses(result);
    },
  });

  // All matières
  const { data: allMatieres = [] } = useQuery({
    queryKey: ['affect-sec-matieres'],
    queryFn: async () => {
      const { data } = await supabase.from('matieres').select('id, nom').order('ordre');
      return data || [];
    },
  });

  // Active affectations
  const { data: affectations = [], isLoading } = useQuery({
    queryKey: ['enseignant-classes-sec'],
    queryFn: async () => {
      const { data } = await supabase
        .from('enseignant_classes')
        .select('id, employe_id, classe_id, matiere_id, deleted_at, employes:employe_id(nom, prenom, matricule, poste), classes:classe_id(nom, niveaux:niveau_id(nom)), matieres:matiere_id(nom)')
        .order('created_at', { ascending: false });
      return (data || []).filter((a: any) => a.employes?.matricule?.startsWith('ESC'));
    },
  });

  const activeAffects = affectations.filter((a: any) => !a.deleted_at);
  const trashedAffects = affectations.filter((a: any) => a.deleted_at);

  // Auto-detect teacher's matière from poste
  const getTeacherMatiere = (teacherId: string) => {
    const teacher = enseignants.find((e: any) => e.id === teacherId);
    if (!teacher?.poste) return null;
    const poste = teacher.poste.toLowerCase();
    const match = allMatieres.find((m: any) => poste.includes(m.nom.toLowerCase()));
    if (match) return match;
    // Also check existing affectations
    const existing = activeAffects.find((a: any) => a.employe_id === teacherId && a.matiere_id);
    if (existing) return allMatieres.find((m: any) => m.id === existing.matiere_id) || null;
    return null;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTeacher || !formClasseId) throw new Error('Enseignant et classe requis');
      const matiere = getTeacherMatiere(selectedTeacher);
      const payload = {
        employe_id: selectedTeacher,
        classe_id: formClasseId,
        matiere_id: matiere?.id || null,
      };
      const { error } = await supabase.from('enseignant_classes').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enseignant-classes-sec'] });
      toast.success('Classe assignée avec succès');
      setDialogOpen(false);
      setFormClasseId('');
    },
    onError: (e: any) => {
      toast.error(e.message?.includes('unique') || e.message?.includes('duplicate')
        ? 'Cette affectation existe déjà' : e.message);
    },
  });

  // Soft delete
  const softDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('enseignant_classes').update({ deleted_at: new Date().toISOString() } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enseignant-classes-sec'] });
      toast.success('Affectation mise en corbeille');
    },
  });

  // Restore
  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('enseignant_classes').update({ deleted_at: null } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enseignant-classes-sec'] });
      toast.success('Affectation restaurée');
    },
  });

  // Permanent delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('enseignant_classes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enseignant-classes-sec'] });
      toast.success('Affectation supprimée définitivement');
    },
  });

  // Group active affectations by teacher
  const grouped = useMemo(() => {
    const map: Record<string, { teacher: any; items: any[] }> = {};
    activeAffects.forEach((a: any) => {
      if (!map[a.employe_id]) map[a.employe_id] = { teacher: a.employes, items: [] };
      map[a.employe_id].items.push(a);
    });
    return map;
  }, [activeAffects]);

  const openAssign = (teacherId: string) => {
    setSelectedTeacher(teacherId);
    setFormClasseId('');
    setDialogOpen(true);
  };

  // Classes already assigned to this teacher (active only)
  const assignedClasseIds = useMemo(() => {
    if (!selectedTeacher) return new Set<string>();
    return new Set(
      activeAffects.filter((a: any) => a.employe_id === selectedTeacher).map((a: any) => a.classe_id)
    );
  }, [selectedTeacher, activeAffects]);

  const availableClasses = classes.filter((c: any) => !assignedClasseIds.has(c.id));
  const selectedTeacherData = enseignants.find((e: any) => e.id === selectedTeacher);
  const detectedMatiere = selectedTeacher ? getTeacherMatiere(selectedTeacher) : null;

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-2 w-64">
          <TabsTrigger value="actif">Affectations</TabsTrigger>
          <TabsTrigger value="corbeille" className="gap-1">
            <Archive className="h-3 w-3" /> Corbeille {trashedAffects.length > 0 && `(${trashedAffects.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actif" className="space-y-2 mt-3">
          <p className="text-sm text-muted-foreground">
            La matière de chaque professeur est détectée automatiquement. Cliquez sur « Assigner » pour ajouter des classes.
          </p>

          {enseignants.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              Aucun enseignant secondaire (ESC) trouvé
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {enseignants.map((ens: any) => {
                const teacherAffects = grouped[ens.id]?.items || [];
                const matiere = getTeacherMatiere(ens.id);
                return (
                  <Card key={ens.id} className="overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <GraduationCap className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{ens.prenom} {ens.nom}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{ens.matricule}</span>
                            {matiere && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5">{matiere.nom}</Badge>
                            )}
                            {!matiere && ens.poste && (
                              <span className="italic">{ens.poste}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {teacherAffects.length} classe{teacherAffects.length > 1 ? 's' : ''}
                        </Badge>
                        <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => openAssign(ens.id)}>
                          <Plus className="h-3 w-3" /> Assigner
                        </Button>
                      </div>
                    </div>

                    {teacherAffects.length > 0 && (
                      <div className="px-4 py-2 border-t">
                        <div className="flex flex-wrap gap-2">
                          {teacherAffects.map((a: any) => (
                            <div key={a.id} className="flex items-center gap-1.5 bg-accent/50 rounded-lg px-2.5 py-1.5 text-xs group">
                              <School className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium">{(a.classes as any)?.niveaux?.nom} — {a.classes?.nom}</span>
                              <button
                                className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (confirm('Mettre cette affectation en corbeille ?')) softDeleteMutation.mutate(a.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="corbeille" className="space-y-2 mt-3">
          {trashedAffects.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">
              La corbeille est vide
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {trashedAffects.map((a: any) => (
                <Card key={a.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 text-sm">
                        <span className="font-medium">{a.employes?.prenom} {a.employes?.nom}</span>
                        <span className="text-muted-foreground"> → </span>
                        <span>{(a.classes as any)?.niveaux?.nom} — {a.classes?.nom}</span>
                        {a.matieres && <Badge variant="outline" className="ml-2 text-[10px] h-4">{a.matieres.nom}</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => restoreMutation.mutate(a.id)}>
                        <RotateCcw className="h-3 w-3" /> Restaurer
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                        if (confirm('Supprimer définitivement ?')) deleteMutation.mutate(a.id);
                      }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog assign classe — simplified, matière auto-detected */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Assigner une classe</DialogTitle>
          </DialogHeader>
          {selectedTeacherData && (
            <div className="space-y-1">
              <p className="text-sm font-medium">{selectedTeacherData.prenom} {selectedTeacherData.nom}</p>
              {detectedMatiere ? (
                <Badge variant="secondary" className="text-xs">Matière : {detectedMatiere.nom}</Badge>
              ) : (
                <p className="text-xs text-muted-foreground italic">Matière non détectée — vérifiez le poste de l'enseignant</p>
              )}
            </div>
          )}
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); saveMutation.mutate(); }}>
            <div className="space-y-1">
              <Label className="text-xs">Classe *</Label>
              <Select value={formClasseId || '__none__'} onValueChange={v => setFormClasseId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Choisir —</SelectItem>
                  {availableClasses.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{(c as any).niveaux?.nom} — {c.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableClasses.length === 0 && classes.length > 0 && (
                <p className="text-[10px] text-muted-foreground">Toutes les classes sont déjà assignées</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" size="sm" disabled={saveMutation.isPending || !formClasseId}>
                {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Assigner
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
