import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Briefcase, Search, Loader2, Users, Download, CircleDot, Plus, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { exportToExcel } from '@/lib/excelUtils';
import AffectationsSecondaire from '@/components/AffectationsSecondaire';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export default function CoordinateurSecondairePersonnel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<any>(null);
  const [form, setForm] = useState({ nom: '', prenom: '', poste: '', telephone: '', email: '', salaire_base: 0, prix_heure: 0 });
  const [saving, setSaving] = useState(false);

  const { data: employes = [], isLoading } = useQuery({
    queryKey: ['coord-sec-employes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employes')
        .select('*, enseignant_classes(id, classe_id, matiere_id, classes(nom, niveaux(nom, cycles(nom))))')
        .eq('categorie', 'enseignant')
        .order('nom');
      if (error) throw error;
      return (data || []).filter((e: any) => e.matricule?.startsWith('ESC'));
    },
  });

  // Generate next ESC matricule
  const getNextMatricule = () => {
    const nums = employes.map((e: any) => {
      const m = e.matricule?.match(/ESC-?(\d+)/);
      return m ? parseInt(m[1]) : 0;
    });
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `ESC${String(max + 1).padStart(3, '0')}`;
  };

  const filtered = employes.filter((e: any) =>
    `${e.nom} ${e.prenom} ${e.matricule} ${e.poste}`.toLowerCase().includes(search.toLowerCase())
  );

  const actifs = filtered.filter((e: any) => e.statut === 'actif');
  const isAffecte = (emp: any) => emp.enseignant_classes && emp.enseignant_classes.length > 0;

  const handleExportExcel = async () => {
    const data = filtered.map((e: any) => ({
      'Matricule': e.matricule,
      'Nom': e.nom,
      'Prénom': e.prenom,
      'Poste': e.poste || '',
      'Téléphone': e.telephone || '',
      'Email': e.email || '',
      'Statut': e.statut,
    }));
    await exportToExcel(data, 'personnel_secondaire', 'Personnel Secondaire');
    toast({ title: '✅ Export Excel réussi' });
  };

  const handleAdd = async () => {
    if (!form.nom || !form.prenom || !form.poste) {
      toast({ title: 'Veuillez remplir les champs obligatoires', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const matricule = getNextMatricule();
    const { error } = await supabase.from('employes').insert({
      matricule,
      nom: form.nom,
      prenom: form.prenom,
      poste: form.poste,
      telephone: form.telephone || null,
      email: form.email || null,
      categorie: 'enseignant' as any,
      salaire_base: form.salaire_base || 0,
      prix_heure: form.prix_heure || 0,
      statut: 'actif',
      date_embauche: new Date().toISOString().split('T')[0],
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Erreur lors de l\'ajout', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: `✅ Enseignant ${matricule} ajouté avec succès` });
    setAddDialogOpen(false);
    setForm({ nom: '', prenom: '', poste: '', telephone: '', email: '', salaire_base: 0, prix_heure: 0 });
    qc.invalidateQueries({ queryKey: ['coord-sec-employes'] });
  };

  const handleEdit = async () => {
    if (!editingEmp) return;
    setSaving(true);
    const { error } = await supabase.from('employes').update({
      nom: form.nom,
      prenom: form.prenom,
      poste: form.poste,
      telephone: form.telephone || null,
      email: form.email || null,
      salaire_base: form.salaire_base || 0,
      prix_heure: form.prix_heure || 0,
    }).eq('id', editingEmp.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: '✅ Enseignant modifié avec succès' });
    setEditDialogOpen(false);
    setEditingEmp(null);
    qc.invalidateQueries({ queryKey: ['coord-sec-employes'] });
  };

  const openEdit = (emp: any) => {
    setEditingEmp(emp);
    setForm({
      nom: emp.nom,
      prenom: emp.prenom,
      poste: emp.poste || '',
      telephone: emp.telephone || '',
      email: emp.email || '',
      salaire_base: emp.salaire_base || 0,
      prix_heure: emp.prix_heure || 0,
    });
    setEditDialogOpen(true);
  };

  const renderEmpRow = (e: any) => {
    const affecte = isAffecte(e);
    return (
      <Collapsible key={e.id}>
        <CollapsibleTrigger asChild>
          <TableRow className={`cursor-pointer border-l-4 ${affecte ? 'border-l-emerald-500' : 'border-l-destructive'}`}>
            <TableCell className="font-mono text-xs">{e.matricule}</TableCell>
            <TableCell className="font-medium">{e.prenom} {e.nom}</TableCell>
            <TableCell className="text-sm">{e.poste || '—'}</TableCell>
            <TableCell>
              {e.statut === 'actif' ? (
                <Badge className="bg-emerald-100 text-emerald-700 border-0">Actif</Badge>
              ) : (
                <Badge variant="secondary">{e.statut}</Badge>
              )}
            </TableCell>
            <TableCell className="text-sm">{e.telephone || '—'}</TableCell>
            <TableCell>
              {affecte ? (
                <Badge className="bg-emerald-50 text-emerald-700 border-0 text-xs">
                  <CircleDot className="h-3 w-3 mr-1" /> Affecté
                </Badge>
              ) : (
                <Badge className="bg-red-50 text-red-600 border-0 text-xs">Non affecté</Badge>
              )}
            </TableCell>
            <TableCell>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(ev) => { ev.stopPropagation(); openEdit(e); }}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </TableCell>
          </TableRow>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <tr>
            <td colSpan={7} className="p-4 bg-muted/30">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Email :</span> {e.email || '—'}</div>
                <div><span className="text-muted-foreground">Salaire :</span> {e.prix_heure ? `${e.prix_heure} GNF/h` : `${e.salaire_base?.toLocaleString()} GNF`}</div>
                {e.enseignant_classes?.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Classes :</span>{' '}
                    {e.enseignant_classes.map((ec: any) => ec.classes?.nom).filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
            </td>
          </tr>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const formFields = (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Prénom *</Label>
          <Input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} />
        </div>
        <div>
          <Label>Nom *</Label>
          <Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
        </div>
      </div>
      <div>
        <Label>Poste / Matière(s) *</Label>
        <Input placeholder="Ex: Mathématiques / Physique" value={form.poste} onChange={e => setForm(f => ({ ...f, poste: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Téléphone</Label>
          <Input value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Salaire base (GNF)</Label>
          <Input type="number" value={form.salaire_base} onChange={e => setForm(f => ({ ...f, salaire_base: Number(e.target.value) }))} />
        </div>
        <div>
          <Label>Prix/heure (GNF)</Label>
          <Input type="number" value={form.prix_heure} onChange={e => setForm(f => ({ ...f, prix_heure: Number(e.target.value) }))} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-primary" />
          Enseignants — Secondaire
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Gestion du personnel enseignant du cycle secondaire</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold">{employes.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{actifs.length}</p>
          <p className="text-xs text-muted-foreground">Actifs</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{employes.filter(isAffecte).length}</p>
          <p className="text-xs text-muted-foreground">Affectés</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-destructive">{employes.filter((e: any) => !isAffecte(e)).length}</p>
          <p className="text-xs text-muted-foreground">Non affectés</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="liste">
        <TabsList>
          <TabsTrigger value="liste">Liste</TabsTrigger>
          <TabsTrigger value="affectations">Affectations</TabsTrigger>
        </TabsList>

        <TabsContent value="liste">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { setForm({ nom: '', prenom: '', poste: '', telephone: '', email: '', salaire_base: 0, prix_heure: 0 }); setAddDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-1" /> Ajouter
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportExcel}>
                    <Download className="h-4 w-4 mr-2" /> Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Aucun enseignant secondaire trouvé.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Matricule</TableHead>
                        <TableHead>Nom & Prénom</TableHead>
                        <TableHead>Poste</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Téléphone</TableHead>
                        <TableHead>Affectation</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(renderEmpRow)}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="affectations">
          <AffectationsSecondaire />
        </TabsContent>
      </Tabs>

      {/* Dialog Ajouter */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un enseignant secondaire</DialogTitle>
          </DialogHeader>
          {formFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Modifier */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'enseignant {editingEmp?.matricule}</DialogTitle>
          </DialogHeader>
          {formFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
