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
import { Plus, Pencil, Trash2, Loader2, BookOpen, GraduationCap } from 'lucide-react';

export default function AffectationsEnseignants() {
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
    queryKey: ['affect-classes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('classes')
        .select('id, nom, niveaux:niveau_id(nom)')
        .order('nom');
      return data || [];
    },
  });

  // Fetch matieres
  const { data: matieres = [] } = useQuery({
    queryKey: ['affect-matieres'],
    queryFn: async () => {
      const { data } = await supabase.from('matieres').select('id, nom').order('nom');
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            Affectations enseignants — classes ({filtered.length})
          </CardTitle>
        </CardHeader>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Enseignant</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Matière</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Aucune affectation
                  </TableCell>
                </TableRow>
              ) : filtered.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    {a.employes?.prenom} {a.employes?.nom}
                    <span className="text-muted-foreground text-xs ml-1">({a.employes?.matricule})</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {(a.classes as any)?.niveaux?.nom} — {a.classes?.nom}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {a.matieres?.nom ? (
                      <Badge variant="outline" className="text-xs">
                        <BookOpen className="h-3 w-3 mr-1" /> {a.matieres.nom}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Toutes matières</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(a)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm('Supprimer cette affectation ?')) deleteMutation.mutate(a.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

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
