import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { sortClasses } from '@/lib/utils';
import { Plus, Pencil, Trash2, Loader2, BookOpen, GraduationCap } from 'lucide-react';

interface Props {
  primaryOnly?: boolean;
}

export default function AffectationsEnseignants({ primaryOnly = false }: Props) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ employe_id: '', classe_id: '', matiere_id: '' });
  const [filterEnseignant, setFilterEnseignant] = useState('');

  // Fetch enseignants
  const { data: enseignants = [] } = useQuery({
    queryKey: ['affect-enseignants'],
    queryFn: async () => {
      const { data } = await supabase
        .from('employes')
        .select('id, nom, prenom, matricule')
        .eq('categorie', 'enseignant')
        .eq('statut', 'actif')
        .order('nom');
      return data || [];
    },
  });

  // Fetch classes
  const { data: classes = [] } = useQuery({
    queryKey: ['affect-classes', primaryOnly],
    queryFn: async () => {
      const { data } = await supabase
        .from('classes')
        .select('id, nom, niveaux:niveau_id(nom, ordre, cycles:cycle_id(nom, ordre))');
      let result = data || [];
      if (primaryOnly) {
        result = result.filter((c: any) => {
          const cycleName = c.niveaux?.cycles?.nom?.toLowerCase() || '';
          return cycleName.includes('maternelle') || cycleName.includes('primaire') || cycleName.includes('crèche');
        });
      }
      return sortClasses(result);
    },
  });

  // Fetch matieres
  const { data: matieres = [] } = useQuery({
    queryKey: ['affect-matieres'],
    queryFn: async () => {
      const { data } = await supabase.from('matieres').select('id, nom').order('ordre');
      return data || [];
    },
  });

  // Fetch all assignments
  const { data: affectations = [], isLoading } = useQuery({
    queryKey: ['enseignant-classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enseignant_classes')
        .select('id, employe_id, classe_id, matiere_id, employes:employe_id(nom, prenom, matricule), classes:classe_id(nom, niveaux:niveau_id(nom)), matieres:matiere_id(nom)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.employe_id || !form.classe_id) throw new Error('Enseignant et classe sont requis');
      const payload = {
        employe_id: form.employe_id,
        classe_id: form.classe_id,
        matiere_id: form.matiere_id || null,
      };
      if (editingId) {
        const { error } = await supabase.from('enseignant_classes').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('enseignant_classes').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enseignant-classes'] });
      toast.success(editingId ? 'Affectation modifiée' : 'Affectation ajoutée');
      setDialogOpen(false);
      setEditingId(null);
      setForm({ employe_id: '', classe_id: '', matiere_id: '' });
    },
    onError: (e: any) => {
      const msg = e.message?.includes('duplicate') || e.message?.includes('unique')
        ? 'Cette affectation existe déjà'
        : e.message;
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('enseignant_classes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enseignant-classes'] });
      toast.success('Affectation supprimée');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => {
    setEditingId(null);
    setForm({ employe_id: '', classe_id: '', matiere_id: '' });
    setDialogOpen(true);
  };

  const openEdit = (a: any) => {
    setEditingId(a.id);
    setForm({
      employe_id: a.employe_id,
      classe_id: a.classe_id,
      matiere_id: a.matiere_id || '',
    });
    setDialogOpen(true);
  };

  const filtered = filterEnseignant
    ? affectations.filter((a: any) => a.employe_id === filterEnseignant)
    : affectations;

  // Group by teacher, then by class
  const grouped = filtered.reduce((acc: Record<string, { teacher: any; items: any[] }>, a: any) => {
    const key = a.employe_id;
    if (!acc[key]) {
      acc[key] = { teacher: a.employes, items: [] };
    }
    acc[key].items.push(a);
    return acc;
  }, {});

  // Sub-group items by classe_id
  const groupByClasse = (items: any[]) => {
    const map: Record<string, { classe: any; affectations: any[] }> = {};
    items.forEach(a => {
      const cid = a.classe_id;
      if (!map[cid]) {
        map[cid] = { classe: a.classes, affectations: [] };
      }
      map[cid].affectations.push(a);
    });
    return Object.entries(map);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Select value={filterEnseignant || '__all__'} onValueChange={v => setFilterEnseignant(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Filtrer par enseignant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">— Tous les enseignants —</SelectItem>
              {enseignants.map((e: any) => (
                <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.matricule})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Nouvelle affectation
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Aucune affectation</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {Object.entries(grouped).map(([empId, { teacher, items }]: [string, any]) => {
            const classeGroups = groupByClasse(items);
            const totalClasses = classeGroups.length;
            const totalMatieres = items.length;
            return (
              <details key={empId} open className="group">
                <summary className="cursor-pointer list-none flex items-center gap-2 py-2 px-2 hover:bg-accent/50 rounded-md transition-colors">
                  <span className="transition-transform group-open:rotate-90 text-muted-foreground">▶</span>
                  <GraduationCap className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">{teacher?.prenom} {teacher?.nom}</span>
                  <span className="text-xs text-muted-foreground">({teacher?.matricule})</span>
                  <div className="flex gap-1.5 ml-auto">
                    <Badge variant="secondary" className="text-xs">
                      {totalClasses} classe{totalClasses > 1 ? 's' : ''}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {totalMatieres} matière{totalMatieres > 1 ? 's' : ''}
                    </Badge>
                  </div>
                </summary>
                <Card className="mt-1 mb-3">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Classe</TableHead>
                          <TableHead>Matière(s)</TableHead>
                          <TableHead className="w-24">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {classeGroups.map(([classeId, { classe, affectations }]) => (
                          <TableRow key={classeId}>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {(classe as any)?.niveaux?.nom} — {classe?.nom}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {affectations.some((a: any) => !a.matiere_id) ? (
                                  <span className="text-xs text-muted-foreground">Toutes matières</span>
                                ) : (
                                  affectations.map((a: any) => (
                                    <Badge key={a.id} variant="outline" className="text-xs">
                                      <BookOpen className="h-3 w-3 mr-1" /> {a.matieres?.nom}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {affectations.length === 1 ? (
                                  <>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(affectations[0])}>
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                      onClick={() => {
                                        if (confirm('Supprimer cette affectation ?')) deleteMutation.mutate(affectations[0].id);
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 p-1 text-destructive hover:text-destructive text-xs"
                                    onClick={() => {
                                      if (confirm(`Supprimer les ${affectations.length} affectations pour cette classe ?`)) {
                                        affectations.forEach((a: any) => deleteMutation.mutate(a.id));
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Tout
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </details>
            );
          })}
        </div>
      )}

      {/* Dialog add/edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier l\'affectation' : 'Nouvelle affectation'}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={e => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div className="space-y-1">
              <Label>Enseignant *</Label>
              <Select value={form.employe_id || '__none__'} onValueChange={v => setForm(f => ({ ...f, employe_id: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Choisir un enseignant" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Choisir —</SelectItem>
                  {enseignants.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.matricule})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Classe *</Label>
              <Select value={form.classe_id || '__none__'} onValueChange={v => setForm(f => ({ ...f, classe_id: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Choisir —</SelectItem>
                  {classes.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{(c as any).niveaux?.nom} — {c.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Matière <span className="text-muted-foreground text-xs">(optionnel)</span></Label>
              <Select value={form.matiere_id || '__none__'} onValueChange={v => setForm(f => ({ ...f, matiere_id: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Toutes matières" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Toutes matières —</SelectItem>
                  {matieres.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {editingId ? 'Modifier' : 'Affecter'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
