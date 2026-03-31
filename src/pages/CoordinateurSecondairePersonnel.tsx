import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Briefcase, Search, Loader2, Download, CircleDot, Plus, Pencil, Phone, Mail, Users, TrendingUp, UserX, UserCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { exportToExcel } from '@/lib/excelUtils';
import AffectationsSecondaire from '@/components/AffectationsSecondaire';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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

  const isAffecte = (emp: any) => emp.enseignant_classes && emp.enseignant_classes.length > 0;
  const totalActifs = employes.filter((e: any) => e.statut === 'actif').length;
  const totalAffectes = employes.filter(isAffecte).length;
  const totalNonAffectes = employes.length - totalAffectes;

  const handleExportExcel = async () => {
    const data = filtered.map((e: any) => ({
      Matricule: e.matricule, Nom: e.nom, Prénom: e.prenom,
      Poste: e.poste || '', Téléphone: e.telephone || '',
      Email: e.email || '', Statut: e.statut,
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
      matricule, nom: form.nom, prenom: form.prenom, poste: form.poste,
      telephone: form.telephone || null, email: form.email || null,
      categorie: 'enseignant' as any, salaire_base: form.salaire_base || 0,
      prix_heure: form.prix_heure || 0, statut: 'actif',
      date_embauche: new Date().toISOString().split('T')[0],
    });
    setSaving(false);
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `✅ Enseignant ${matricule} ajouté` });
    setAddDialogOpen(false);
    setForm({ nom: '', prenom: '', poste: '', telephone: '', email: '', salaire_base: 0, prix_heure: 0 });
    qc.invalidateQueries({ queryKey: ['coord-sec-employes'] });
  };

  const handleEdit = async () => {
    if (!editingEmp) return;
    setSaving(true);
    const { error } = await supabase.from('employes').update({
      nom: form.nom, prenom: form.prenom, poste: form.poste,
      telephone: form.telephone || null, email: form.email || null,
      salaire_base: form.salaire_base || 0, prix_heure: form.prix_heure || 0,
    }).eq('id', editingEmp.id);
    setSaving(false);
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '✅ Enseignant modifié' });
    setEditDialogOpen(false);
    setEditingEmp(null);
    qc.invalidateQueries({ queryKey: ['coord-sec-employes'] });
  };

  const openEdit = (emp: any) => {
    setEditingEmp(emp);
    setForm({ nom: emp.nom, prenom: emp.prenom, poste: emp.poste || '', telephone: emp.telephone || '', email: emp.email || '', salaire_base: emp.salaire_base || 0, prix_heure: emp.prix_heure || 0 });
    setEditDialogOpen(true);
  };

  const getInitials = (e: any) => `${e.prenom?.[0] || ''}${e.nom?.[0] || ''}`.toUpperCase();

  const formFields = (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Prénom *</Label><Input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} /></div>
        <div><Label>Nom *</Label><Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} /></div>
      </div>
      <div><Label>Poste / Matière(s) *</Label><Input placeholder="Ex: Mathématiques / Physique" value={form.poste} onChange={e => setForm(f => ({ ...f, poste: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Téléphone</Label><Input value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} /></div>
        <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Salaire base (GNF)</Label><Input type="number" value={form.salaire_base} onChange={e => setForm(f => ({ ...f, salaire_base: Number(e.target.value) }))} /></div>
        <div><Label>Prix/heure (GNF)</Label><Input type="number" value={form.prix_heure} onChange={e => setForm(f => ({ ...f, prix_heure: Number(e.target.value) }))} /></div>
      </div>
    </div>
  );

  const statCards = [
    { label: 'Total', value: employes.length, icon: Users, color: 'text-blue-600', borderColor: 'border-blue-200 dark:border-blue-800', gradient: 'from-blue-500/10 via-blue-500/5 to-transparent', iconBg: 'bg-blue-500/15' },
    { label: 'Actifs', value: totalActifs, icon: TrendingUp, color: 'text-emerald-600', borderColor: 'border-emerald-200 dark:border-emerald-800', gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent', iconBg: 'bg-emerald-500/15' },
    { label: 'Affectés', value: totalAffectes, icon: UserCheck, color: 'text-teal-600', borderColor: 'border-teal-200 dark:border-teal-800', gradient: 'from-teal-500/10 via-teal-500/5 to-transparent', iconBg: 'bg-teal-500/15' },
    { label: 'Non affectés', value: totalNonAffectes, icon: UserX, color: 'text-red-600', borderColor: 'border-red-200 dark:border-red-800', gradient: 'from-red-500/10 via-red-500/5 to-transparent', iconBg: 'bg-red-500/15' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-primary" />
          Enseignants — Secondaire
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Gestion du personnel enseignant du cycle secondaire</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((c, i) => (
          <Card key={i} className={`overflow-hidden border ${c.borderColor} bg-gradient-to-br ${c.gradient}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${c.iconBg} flex items-center justify-center shrink-0`}>
                <c.icon className={`h-5 w-5 ${c.color}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="liste">
        <TabsList>
          <TabsTrigger value="liste">Liste</TabsTrigger>
          <TabsTrigger value="affectations">Affectations</TabsTrigger>
        </TabsList>

        <TabsContent value="liste" className="space-y-4">
          {/* Search + Actions */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher par nom, matricule, poste…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Button size="sm" onClick={() => { setForm({ nom: '', prenom: '', poste: '', telephone: '', email: '', salaire_base: 0, prix_heure: 0 }); setAddDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Ajouter
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
          </div>

          {/* Teacher Cards */}
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Aucun enseignant secondaire trouvé.</CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {filtered.map((e: any) => {
                const affecte = isAffecte(e);
                const classesNames = e.enseignant_classes?.map((ec: any) => ec.classes?.nom).filter(Boolean) || [];
                return (
                  <Card key={e.id} className={`overflow-hidden border-l-4 ${affecte ? 'border-l-emerald-500' : 'border-l-destructive'} hover:shadow-md transition-shadow`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <Avatar className="h-12 w-12 shrink-0">
                          <AvatarImage src={e.photo_url} />
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                            {getInitials(e)}
                          </AvatarFallback>
                        </Avatar>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground">{e.prenom} {e.nom}</span>
                            <Badge variant="outline" className="text-[10px] font-mono">{e.matricule}</Badge>
                            {e.statut === 'actif' ? (
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-[10px]">Actif</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">{e.statut}</Badge>
                            )}
                            {affecte ? (
                              <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-0 text-[10px]">
                                <CircleDot className="h-2.5 w-2.5 mr-1" /> Affecté
                              </Badge>
                            ) : (
                              <Badge className="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border-0 text-[10px]">Non affecté</Badge>
                            )}
                          </div>

                          <p className="text-sm text-muted-foreground mt-1">{e.poste || '—'}</p>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                            {e.telephone && (
                              <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {e.telephone}</span>
                            )}
                            {e.email && (
                              <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {e.email}</span>
                            )}
                            {classesNames.length > 0 && (
                              <span className="flex items-center gap-1">
                                📚 {classesNames.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Edit Button */}
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => openEdit(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground text-center">{filtered.length} enseignant(s) affiché(s)</p>
        </TabsContent>

        <TabsContent value="affectations">
          <AffectationsSecondaire />
        </TabsContent>
      </Tabs>

      {/* Dialog Ajouter */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un enseignant secondaire</DialogTitle></DialogHeader>
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
          <DialogHeader><DialogTitle>Modifier l'enseignant {editingEmp?.matricule}</DialogTitle></DialogHeader>
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
