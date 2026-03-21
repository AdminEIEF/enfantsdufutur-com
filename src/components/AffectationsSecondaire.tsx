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
import { Plus, Trash2, Loader2, GraduationCap, BookOpen, School } from 'lucide-react';

export default function AffectationsSecondaire() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [formClasseId, setFormClasseId] = useState('');

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

  // All affectations with relations
  const { data: affectations = [], isLoading } = useQuery({
    queryKey: ['enseignant-classes-sec'],
    queryFn: async () => {
      const { data } = await supabase
        .from('enseignant_classes')
        .select('id, employe_id, classe_id, matiere_id, employes:employe_id(nom, prenom, matricule, poste), classes:classe_id(nom, niveaux:niveau_id(nom)), matieres:matiere_id(nom)')
        .order('created_at', { ascending: false });
      // Filter to secondary teachers only
      return (data || []).filter((a: any) => a.employes?.matricule?.startsWith('ESC'));
    },
  });

  // Matières for the selected teacher (from their poste or all matieres)
  const { data: allMatieres = [] } = useQuery({
    queryKey: ['affect-sec-matieres'],
    queryFn: async () => {
      const { data } = await supabase.from('matieres').select('id, nom').order('ordre');
      return data || [];
    },
  });

  // Classe_matieres to filter
  const { data: classeMatieres = [] } = useQuery({
    queryKey: ['affect-sec-classe-matieres'],
    queryFn: async () => {
      const { data } = await supabase.from('classe_matieres').select('classe_id, matiere_id');
      return data || [];
    },
  });

  // Get matières available for selected class
  const matieresForClasse = useMemo(() => {
    if (!formClasseId) return allMatieres;
    const ids = classeMatieres.filter((cm: any) => cm.classe_id === formClasseId).map((cm: any) => cm.matiere_id);
    return ids.length > 0 ? allMatieres.filter((m: any) => ids.includes(m.id)) : allMatieres;
  }, [formClasseId, classeMatieres, allMatieres]);

  // Find which matière this teacher teaches (from their existing affectations or poste)
  const getTeacherMatiere = (teacherId: string) => {
    const existing = affectations.find((a: any) => a.employe_id === teacherId && a.matiere_id);
    return existing?.matiere_id || '';
  };

  const [formMatiereId, setFormMatiereId] = useState('');

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTeacher || !formClasseId) throw new Error('Enseignant et classe requis');
      const payload = {
        employe_id: selectedTeacher,
        classe_id: formClasseId,
        matiere_id: formMatiereId || null,
      };
      const { error } = await supabase.from('enseignant_classes').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enseignant-classes-sec'] });
      toast.success('Classe assignée avec succès');
      setDialogOpen(false);
      setFormClasseId('');
      setFormMatiereId('');
    },
    onError: (e: any) => {
      toast.error(e.message?.includes('unique') || e.message?.includes('duplicate')
        ? 'Cette affectation existe déjà' : e.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('enseignant_classes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enseignant-classes-sec'] });
      toast.success('Affectation supprimée');
    },
  });

  // Group affectations by teacher
  const grouped = useMemo(() => {
    const map: Record<string, { teacher: any; items: any[] }> = {};
    affectations.forEach((a: any) => {
      if (!map[a.employe_id]) map[a.employe_id] = { teacher: a.employes, items: [] };
      map[a.employe_id].items.push(a);
    });
    return map;
  }, [affectations]);

  const openAssign = (teacherId: string) => {
    setSelectedTeacher(teacherId);
    const existingMatiere = getTeacherMatiere(teacherId);
    setFormMatiereId(existingMatiere);
    setFormClasseId('');
    setDialogOpen(true);
  };

  // Classes already assigned to this teacher
  const assignedClasseIds = useMemo(() => {
    if (!selectedTeacher) return new Set<string>();
    return new Set(
      affectations.filter((a: any) => a.employe_id === selectedTeacher).map((a: any) => a.classe_id)
    );
  }, [selectedTeacher, affectations]);

  const availableClasses = classes.filter((c: any) => !assignedClasseIds.has(c.id));

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Assignez chaque professeur du secondaire à ses classes. Un même professeur peut enseigner dans plusieurs classes.
      </p>

      {enseignants.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          Aucun enseignant secondaire (ESC) trouvé
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {enseignants.map((ens: any) => {
            const teacherAffects = grouped[ens.id]?.items || [];
            return (
              <Card key={ens.id} className="overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <GraduationCap className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{ens.prenom} {ens.nom}</p>
                      <p className="text-xs text-muted-foreground">{ens.matricule} — {ens.poste || 'Enseignant'}</p>
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
                          {a.matieres && (
                            <>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-muted-foreground flex items-center gap-0.5">
                                <BookOpen className="h-3 w-3" /> {a.matieres.nom}
                              </span>
                            </>
                          )}
                          <button
                            className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm('Retirer cette classe ?')) deleteMutation.mutate(a.id);
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

      {/* Dialog assign classe */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Assigner une classe</DialogTitle>
          </DialogHeader>
          {selectedTeacher && (
            <p className="text-sm text-muted-foreground">
              {enseignants.find((e: any) => e.id === selectedTeacher)?.prenom}{' '}
              {enseignants.find((e: any) => e.id === selectedTeacher)?.nom}
            </p>
          )}
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); saveMutation.mutate(); }}>
            <div className="space-y-1">
              <Label className="text-xs">Matière *</Label>
              <Select value={formMatiereId || '__none__'} onValueChange={v => setFormMatiereId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Choisir la matière" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Choisir —</SelectItem>
                  {matieresForClasse.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
