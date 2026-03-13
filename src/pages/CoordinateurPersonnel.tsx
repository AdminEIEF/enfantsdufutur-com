import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Briefcase, Plus, Search, Loader2, Eye, Users, Phone, Mail, Download, GraduationCap, CircleDot } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { exportToExcel } from '@/lib/excelUtils';
import AffectationsEnseignants from '@/components/AffectationsEnseignants';

export default function CoordinateurPersonnel() {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [editEmp, setEditEmp] = useState<any>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [form, setForm] = useState({
    nom: '', prenom: '', sexe: 'M', telephone: '', email: '',
    categorie: 'enseignant' as string, poste: '', salaire_base: '',
    date_embauche: new Date().toISOString().slice(0, 10),
    date_naissance: '',
  });

  // Fetch employes - RLS will filter to primary/maternelle only
  const { data: employes = [], isLoading } = useQuery({
    queryKey: ['coord-employes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employes')
        .select('*, enseignant_classes(id, classe_id, matiere_id, classes(nom, niveaux(nom, cycles(nom))))')
        .eq('categorie', 'enseignant')
        .order('nom');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch primary/maternelle classes for assignment
  const { data: classes = [] } = useQuery({
    queryKey: ['coord-classes-primary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, nom, niveaux(nom, cycles(nom))')
        .order('nom');
      if (error) throw error;
      // Filter to primary/maternelle/creche on client side
      return (data || []).filter((c: any) => {
        const cycleName = c.niveaux?.cycles?.nom?.toLowerCase() || '';
        return cycleName.includes('maternelle') || cycleName.includes('primaire') || cycleName.includes('crèche');
      });
    },
  });

  const { data: matieres = [] } = useQuery({
    queryKey: ['coord-matieres'],
    queryFn: async () => {
      const { data } = await supabase.from('matieres').select('id, nom').order('nom');
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const matricule = `EMP-${String(Math.floor(1000 + Math.random() * 9000))}`;
      const { error } = await supabase.from('employes').insert({
        matricule,
        nom: form.nom,
        prenom: form.prenom,
        sexe: form.sexe,
        telephone: form.telephone || null,
        email: form.email || null,
        categorie: form.categorie as any,
        poste: form.poste || 'Enseignant',
        salaire_base: Number(form.salaire_base) || 0,
        date_embauche: form.date_embauche,
        date_naissance: form.date_naissance || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: '✅ Employé ajouté avec succès' });
      qc.invalidateQueries({ queryKey: ['coord-employes'] });
      setAddOpen(false);
      setForm({ nom: '', prenom: '', sexe: 'M', telephone: '', email: '', categorie: 'enseignant', poste: '', salaire_base: '', date_embauche: new Date().toISOString().slice(0, 10), date_naissance: '' });
    },
    onError: (err: any) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: string }) => {
      const { error } = await supabase.from('employes').update({ statut }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { statut }) => {
      const labels: Record<string, string> = { actif: 'Actif', inactif: 'Inactif', 'en congé': 'En congé' };
      toast({ title: `✅ Statut mis à jour : ${labels[statut] || statut}` });
      qc.invalidateQueries({ queryKey: ['coord-employes'] });
    },
    onError: (err: any) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    },
  });

  const filtered = employes.filter((e: any) =>
    `${e.nom} ${e.prenom} ${e.matricule} ${e.poste}`.toLowerCase().includes(search.toLowerCase())
  );

  const categorieLabel: Record<string, string> = {
    enseignant: 'Enseignant', administration: 'Administration', administratif: 'Administratif', service: 'Service', direction: 'Direction',
  };

  const categorieBadge = (cat: string) => {
    const colors: Record<string, string> = {
      enseignant: 'bg-blue-100 text-blue-800',
      administratif: 'bg-purple-100 text-purple-800',
      service: 'bg-green-100 text-green-800',
      securite: 'bg-orange-100 text-orange-800',
    };
    return colors[cat] || 'bg-muted text-muted-foreground';
  };

  const handleExportExcel = async () => {
    const data = filtered.map((e: any) => ({
      'Matricule': e.matricule,
      'Nom': e.nom,
      'Prénom': e.prenom,
      'Catégorie': categorieLabel[e.categorie] || e.categorie,
      'Poste': e.poste || '',
      'Téléphone': e.telephone || '',
      'Statut': e.statut,
    }));
    await exportToExcel(data, 'personnel_primaire', 'Personnel');
    toast({ title: '✅ Export Excel réussi' });
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-primary" />
          Enseignants — Crèche, Maternelle & Primaire
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestion et affectation des enseignants aux classes Crèche, Maternelle et Primaire
        </p>
      </div>

      <Tabs defaultValue="liste" className="space-y-4">
        <TabsList>
          <TabsTrigger value="liste"><Users className="h-4 w-4 mr-1" /> Liste des enseignants</TabsTrigger>
          <TabsTrigger value="affectations"><GraduationCap className="h-4 w-4 mr-1" /> Affectations</TabsTrigger>
        </TabsList>

        <TabsContent value="liste" className="space-y-4">
        <div className="flex gap-2 flex-wrap justify-end">
          <Button size="sm" variant="outline" onClick={handleExportExcel}>
            <Download className="h-4 w-4 mr-1" /> Exporter Excel
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Ajouter</Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nouvel employé</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nom *</Label><Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} /></div>
                <div><Label>Prénom *</Label><Input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Sexe</Label>
                  <Select value={form.sexe} onValueChange={v => setForm(f => ({ ...f, sexe: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculin</SelectItem>
                      <SelectItem value="F">Féminin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Catégorie</Label>
                  <Select value={form.categorie} onValueChange={v => setForm(f => ({ ...f, categorie: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enseignant">Enseignant</SelectItem>
                      <SelectItem value="administratif">Administratif</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Poste</Label><Input value={form.poste} onChange={e => setForm(f => ({ ...f, poste: e.target.value }))} placeholder="Ex: Instituteur" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Téléphone</Label><Input value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} /></div>
                <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date de naissance</Label><Input type="date" value={form.date_naissance} onChange={e => setForm(f => ({ ...f, date_naissance: e.target.value }))} /></div>
                <div><Label>Date d'embauche</Label><Input type="date" value={form.date_embauche} onChange={e => setForm(f => ({ ...f, date_embauche: e.target.value }))} /></div>
              </div>
              <div><Label>Salaire de base (FCFA)</Label><Input type="number" value={form.salaire_base} onChange={e => setForm(f => ({ ...f, salaire_base: e.target.value }))} /></div>
              <Button className="w-full" onClick={() => addMutation.mutate()} disabled={!form.nom || !form.prenom || addMutation.isPending}>
                {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enregistrer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{employes.length}</div>
            <p className="text-xs text-muted-foreground">Total personnel</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{employes.filter((e: any) => e.categorie === 'enseignant').length}</div>
            <p className="text-xs text-muted-foreground">Enseignants</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-600">{employes.filter((e: any) => e.statut === 'actif').length}</div>
            <p className="text-xs text-muted-foreground">Actifs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-red-500">{employes.filter((e: any) => e.statut === 'inactif').length}</div>
            <p className="text-xs text-muted-foreground">Inactifs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-orange-500">{employes.filter((e: any) => e.statut === 'en congé').length}</div>
            <p className="text-xs text-muted-foreground">En congé</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Rechercher un employé..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Each teacher collapsible */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Aucun personnel trouvé</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((emp: any) => (
            <details key={emp.id} className="group border rounded-lg overflow-hidden">
              <summary className="cursor-pointer list-none flex items-center gap-3 py-3 px-4 hover:bg-accent/50 transition-colors">
                <span className="transition-transform group-open:rotate-90 text-muted-foreground text-xs">▶</span>
                <span className="font-mono text-xs text-muted-foreground">{emp.matricule}</span>
                <span className="font-medium text-sm">{emp.prenom} {emp.nom}</span>
                {emp.poste && <span className="text-xs text-muted-foreground hidden sm:inline">— {emp.poste}</span>}
                <div className="ml-auto flex items-center gap-2">
                  {emp.enseignant_classes?.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {emp.enseignant_classes.length} classe{emp.enseignant_classes.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                  <Badge 
                    variant={emp.statut === 'actif' ? 'default' : emp.statut === 'en congé' ? 'outline' : 'secondary'} 
                    className={`text-xs ${emp.statut === 'en congé' ? 'border-orange-400 text-orange-600' : ''}`}
                  >
                    {emp.statut === 'en congé' ? '🏖️ En congé' : emp.statut}
                  </Badge>
                </div>
              </summary>
              <div className="border-t px-4 py-3 bg-muted/30 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Poste</span>
                    <p className="font-medium">{emp.poste || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Catégorie</span>
                    <p><Badge variant="outline" className={categorieBadge(emp.categorie)}>{emp.categorie}</Badge></p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Téléphone</span>
                    <p className="font-medium">{emp.telephone || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Email</span>
                    <p className="font-medium truncate">{emp.email || '—'}</p>
                  </div>
                </div>
                {emp.enseignant_classes?.length > 0 && (
                  <div>
                    <span className="text-muted-foreground text-xs">Classes affectées</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {emp.enseignant_classes.map((ec: any) => (
                        <Badge key={ec.id} variant="outline" className="text-xs">
                          {ec.classes?.niveaux?.nom} — {ec.classes?.nom}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {/* Status change */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium mr-1">Changer le statut :</span>
                  {['actif', 'inactif', 'en congé'].map((s) => {
                    const isCurrentStatus = emp.statut === s;
                    const labels: Record<string, string> = { actif: '✅ Actif', inactif: '⛔ Inactif', 'en congé': '🏖️ En congé' };
                    const variants: Record<string, string> = { 
                      actif: isCurrentStatus ? 'bg-green-100 border-green-400 text-green-700' : '', 
                      inactif: isCurrentStatus ? 'bg-red-100 border-red-400 text-red-700' : '', 
                      'en congé': isCurrentStatus ? 'bg-orange-100 border-orange-400 text-orange-700' : '' 
                    };
                    return (
                      <Button
                        key={s}
                        size="sm"
                        variant={isCurrentStatus ? 'outline' : 'ghost'}
                        className={`text-xs ${variants[s]} ${isCurrentStatus ? 'pointer-events-none font-semibold' : ''}`}
                        disabled={isCurrentStatus || statusMutation.isPending}
                        onClick={(e) => {
                          e.preventDefault();
                          statusMutation.mutate({ id: emp.id, statut: s });
                        }}
                      >
                        {statusMutation.isPending && statusMutation.variables?.id === emp.id && statusMutation.variables?.statut === s 
                          ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> 
                          : null}
                        {labels[s]}
                      </Button>
                    );
                  })}
                </div>

                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => {
                    setSelectedEmp(emp);
                    setEditEmp({
                      nom: emp.nom, prenom: emp.prenom, sexe: emp.sexe || 'M',
                      telephone: emp.telephone || '', email: emp.email || '',
                      poste: emp.poste || '', salaire_base: emp.salaire_base || 0,
                      date_naissance: emp.date_naissance || '', date_embauche: emp.date_embauche || '',
                    });
                  }}>
                    <Eye className="h-4 w-4 mr-1" /> Modifier la fiche
                  </Button>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}

      {/* Detail / Edit dialog */}
      <Dialog open={!!selectedEmp} onOpenChange={() => { setSelectedEmp(null); setEditEmp(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fiche enseignant — {selectedEmp?.prenom} {selectedEmp?.nom}</DialogTitle>
          </DialogHeader>
          {selectedEmp && editEmp && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Matricule:</span> <strong>{selectedEmp.matricule}</strong></div>
                <div><span className="text-muted-foreground">Statut:</span> <Badge variant={selectedEmp.statut === 'actif' ? 'default' : 'secondary'}>{selectedEmp.statut}</Badge></div>
              </div>

              {(selectedEmp.coord_edit_count ?? 0) >= 2 ? (
                <div className="bg-accent/50 border border-border rounded-lg p-4 text-sm text-foreground">
                  <p className="font-medium">⚠️ Limite de modifications atteinte</p>
                  <p className="mt-1 text-muted-foreground">Vous avez déjà modifié cette fiche 2 fois. Pour toute modification supplémentaire, veuillez contacter l'administrateur.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Nom</Label><Input value={editEmp.nom} onChange={e => setEditEmp((f: any) => ({ ...f, nom: e.target.value }))} /></div>
                    <div><Label>Prénom</Label><Input value={editEmp.prenom} onChange={e => setEditEmp((f: any) => ({ ...f, prenom: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Sexe</Label>
                      <Select value={editEmp.sexe} onValueChange={v => setEditEmp((f: any) => ({ ...f, sexe: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Masculin</SelectItem>
                          <SelectItem value="F">Féminin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Poste</Label><Input value={editEmp.poste} onChange={e => setEditEmp((f: any) => ({ ...f, poste: e.target.value }))} placeholder="Ex: Instituteur" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Téléphone</Label><Input value={editEmp.telephone} onChange={e => setEditEmp((f: any) => ({ ...f, telephone: e.target.value }))} /></div>
                    <div><Label>Email</Label><Input value={editEmp.email} onChange={e => setEditEmp((f: any) => ({ ...f, email: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Date de naissance</Label><Input type="date" value={editEmp.date_naissance} onChange={e => setEditEmp((f: any) => ({ ...f, date_naissance: e.target.value }))} /></div>
                    <div><Label>Date d'embauche</Label><Input type="date" value={editEmp.date_embauche} onChange={e => setEditEmp((f: any) => ({ ...f, date_embauche: e.target.value }))} /></div>
                  </div>
                  <div><Label>Salaire de base (GNF)</Label><Input type="number" value={editEmp.salaire_base} onChange={e => setEditEmp((f: any) => ({ ...f, salaire_base: e.target.value }))} /></div>
                  <p className="text-xs text-muted-foreground">Modifications restantes : {2 - (selectedEmp.coord_edit_count ?? 0)}/2</p>
                  <Button className="w-full" disabled={editSaving} onClick={async () => {
                    setEditSaving(true);
                    try {
                      const { error } = await supabase.from('employes').update({
                        nom: editEmp.nom,
                        prenom: editEmp.prenom,
                        sexe: editEmp.sexe,
                        telephone: editEmp.telephone || null,
                        email: editEmp.email || null,
                        poste: editEmp.poste,
                        salaire_base: Number(editEmp.salaire_base) || 0,
                        date_naissance: editEmp.date_naissance || null,
                        date_embauche: editEmp.date_embauche || null,
                        coord_edit_count: (selectedEmp.coord_edit_count ?? 0) + 1,
                      } as any).eq('id', selectedEmp.id);
                      if (error) throw error;
                      toast({ title: '✅ Fiche mise à jour' });
                      qc.invalidateQueries({ queryKey: ['coord-employes'] });
                      setSelectedEmp(null);
                      setEditEmp(null);
                    } catch (err: any) {
                      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
                    } finally {
                      setEditSaving(false);
                    }
                  }}>
                    {editSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Valider les modifications
                  </Button>
                </>
              )}

              {selectedEmp.enseignant_classes?.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Classes affectées</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedEmp.enseignant_classes.map((ec: any) => (
                      <Badge key={ec.id} variant="outline">
                        {ec.classes?.nom} — {ec.classes?.niveaux?.nom}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

        </TabsContent>

        <TabsContent value="affectations">
          <AffectationsEnseignants primaryOnly />
        </TabsContent>
      </Tabs>
    </div>
  );
}
