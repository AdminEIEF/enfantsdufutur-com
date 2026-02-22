import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Briefcase, Plus, Search, Loader2, Clock, Calendar, DollarSign, FileText,
  Check, X, Eye, Trash2, Upload, UserPlus, Users, ScanLine
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import QRScannerDialog from '@/components/QRScannerDialog';

const MOIS_NOMS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export default function Personnel() {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [pointageOpen, setPointageOpen] = useState(false);
  const [paieOpen, setPaieOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Form state for new employee
  const [form, setForm] = useState({
    matricule: '', nom: '', prenom: '', sexe: 'M', telephone: '', email: '',
    adresse: '', categorie: 'service' as string, poste: '', salaire_base: '',
    date_embauche: new Date().toISOString().slice(0, 10), mot_de_passe: '',
  });

  // Paie form
  const [paieForm, setPaieForm] = useState({
    employe_id: '', mois: new Date().getMonth() + 1, annee: new Date().getFullYear(),
    salaire_brut: 0, retenues: 0, avances_deduites: 0, primes: 0, commentaire: '',
  });

  // Fetch employees
  const { data: employes = [], isLoading } = useQuery({
    queryKey: ['employes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employes')
        .select('*')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  // Fetch pointages today
  const today = new Date().toISOString().slice(0, 10);
  const { data: pointagesToday = [] } = useQuery({
    queryKey: ['pointages-today', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pointages_employes')
        .select('*, employes(nom, prenom, matricule)')
        .eq('date_pointage', today)
        .order('heure_arrivee', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch congés en attente
  const { data: congesEnAttente = [] } = useQuery({
    queryKey: ['conges-attente'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conges')
        .select('*, employes(nom, prenom, matricule, categorie)')
        .eq('statut', 'en_attente')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch avances en attente
  const { data: avancesEnAttente = [] } = useQuery({
    queryKey: ['avances-attente'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avances_salaire')
        .select('*, employes(nom, prenom, matricule)')
        .eq('statut', 'en_attente')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch bulletins de paie
  const { data: bulletins = [] } = useQuery({
    queryKey: ['bulletins-paie'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bulletins_paie')
        .select('*, employes(nom, prenom, matricule)')
        .order('annee', { ascending: false })
        .order('mois', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Add employee mutation
  const addEmployee = useMutation({
    mutationFn: async () => {
      if (!form.matricule || !form.nom || !form.prenom) throw new Error('Champs obligatoires manquants');
      const { error } = await supabase.from('employes').insert({
        matricule: form.matricule.toUpperCase(),
        nom: form.nom,
        prenom: form.prenom,
        sexe: form.sexe,
        telephone: form.telephone || null,
        email: form.email || null,
        adresse: form.adresse || null,
        categorie: form.categorie as any,
        poste: form.poste,
        salaire_base: Number(form.salaire_base) || 0,
        date_embauche: form.date_embauche,
        mot_de_passe: form.mot_de_passe || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: '✅ Employé ajouté' });
      qc.invalidateQueries({ queryKey: ['employes'] });
      setAddOpen(false);
      setForm({ matricule: '', nom: '', prenom: '', sexe: 'M', telephone: '', email: '', adresse: '', categorie: 'service', poste: '', salaire_base: '', date_embauche: new Date().toISOString().slice(0, 10), mot_de_passe: '' });
    },
    onError: (err: any) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  // QR Scan pointage
  const handleScanPointage = async (matricule: string) => {
    const emp = employes.find((e: any) => e.matricule === matricule);
    if (!emp) { toast({ title: 'Employé introuvable', variant: 'destructive' }); return; }
    if (emp.statut !== 'actif') { toast({ title: 'Employé inactif', variant: 'destructive' }); return; }

    const existing = pointagesToday.find((p: any) => p.employe_id === emp.id);
    if (existing && existing.heure_depart) {
      toast({ title: 'Déjà pointé arrivée et départ' }); return;
    }

    if (existing && !existing.heure_depart) {
      // Mark departure
      const heureDepart = new Date();
      const heuresT = existing.heure_arrivee
        ? ((heureDepart.getTime() - new Date(existing.heure_arrivee).getTime()) / 3600000).toFixed(1)
        : 0;
      await supabase.from('pointages_employes').update({
        heure_depart: heureDepart.toISOString(),
        heures_travaillees: Number(heuresT),
      }).eq('id', existing.id);
      toast({ title: `✅ Départ enregistré pour ${emp.prenom} ${emp.nom}` });
    } else {
      // Mark arrival
      const now = new Date();
      const heure = now.getHours();
      const retard = heure >= 8; // 8h = seuil de retard
      await supabase.from('pointages_employes').insert({
        employe_id: emp.id,
        date_pointage: today,
        heure_arrivee: now.toISOString(),
        retard,
      });
      const beep = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==');
      beep.play().catch(() => {});
      toast({ title: `✅ Arrivée enregistrée pour ${emp.prenom} ${emp.nom}${retard ? ' (RETARD)' : ''}` });
    }
    qc.invalidateQueries({ queryKey: ['pointages-today'] });
    setScannerOpen(false);
  };

  // Approve/reject congé
  const handleConge = async (id: string, statut: 'approuve' | 'refuse') => {
    await supabase.from('conges').update({
      statut,
      traite_par: user?.id,
      traite_at: new Date().toISOString(),
    }).eq('id', id);
    toast({ title: statut === 'approuve' ? '✅ Congé approuvé' : '❌ Congé refusé' });
    qc.invalidateQueries({ queryKey: ['conges-attente'] });
  };

  // Approve/reject avance
  const handleAvance = async (id: string, statut: 'approuve' | 'refuse') => {
    await supabase.from('avances_salaire').update({
      statut,
      traite_par: user?.id,
      traite_at: new Date().toISOString(),
    }).eq('id', id);
    toast({ title: statut === 'approuve' ? '✅ Avance approuvée' : '❌ Avance refusée' });
    qc.invalidateQueries({ queryKey: ['avances-attente'] });
  };

  // Generate bulletin de paie
  const generateBulletin = async () => {
    if (!paieForm.employe_id) { toast({ title: 'Sélectionnez un employé', variant: 'destructive' }); return; }
    const emp = employes.find((e: any) => e.id === paieForm.employe_id);
    const brut = paieForm.salaire_brut || Number(emp?.salaire_base || 0);
    const net = brut + paieForm.primes - paieForm.retenues - paieForm.avances_deduites;

    const { error } = await supabase.from('bulletins_paie').upsert({
      employe_id: paieForm.employe_id,
      mois: paieForm.mois,
      annee: paieForm.annee,
      salaire_brut: brut,
      retenues: paieForm.retenues,
      avances_deduites: paieForm.avances_deduites,
      primes: paieForm.primes,
      salaire_net: net,
      commentaire: paieForm.commentaire || null,
      genere_par: user?.id,
    }, { onConflict: 'employe_id,mois,annee' });

    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }

    // Notify employee
    await supabase.from('employee_notifications').insert({
      employe_id: paieForm.employe_id,
      titre: '💰 Bulletin de paie disponible',
      message: `Votre bulletin de paie de ${MOIS_NOMS[paieForm.mois]} ${paieForm.annee} est disponible. Salaire net: ${net.toLocaleString()} GNF.`,
      type: 'info',
    });

    toast({ title: '✅ Bulletin généré' });
    qc.invalidateQueries({ queryKey: ['bulletins-paie'] });
    setPaieOpen(false);
  };

  const filtered = employes.filter((e: any) => {
    const q = search.toLowerCase();
    return !q || e.nom.toLowerCase().includes(q) || e.prenom.toLowerCase().includes(q) || e.matricule.toLowerCase().includes(q);
  });

  const categorieLabel: Record<string, string> = {
    enseignant: 'Enseignant', administration: 'Administration', service: 'Service', direction: 'Direction',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Briefcase className="h-7 w-7 text-primary" /> Personnel
          <Badge>{employes.length}</Badge>
        </h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setScannerOpen(true)}>
            <ScanLine className="h-4 w-4 mr-1" /> Pointage QR
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><UserPlus className="h-4 w-4 mr-1" /> Ajouter</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nouvel employé</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Matricule *</Label><Input value={form.matricule} onChange={e => setForm(f => ({ ...f, matricule: e.target.value.toUpperCase() }))} placeholder="EMP-001" /></div>
                  <div className="space-y-1"><Label>Catégorie *</Label>
                    <Select value={form.categorie} onValueChange={v => setForm(f => ({ ...f, categorie: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="enseignant">Enseignant</SelectItem>
                        <SelectItem value="administration">Administration</SelectItem>
                        <SelectItem value="service">Service</SelectItem>
                        <SelectItem value="direction">Direction</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Nom *</Label><Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>Prénom *</Label><Input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Poste</Label><Input value={form.poste} onChange={e => setForm(f => ({ ...f, poste: e.target.value }))} placeholder="Ex: Prof de Maths" /></div>
                  <div className="space-y-1"><Label>Sexe</Label>
                    <Select value={form.sexe} onValueChange={v => setForm(f => ({ ...f, sexe: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Masculin</SelectItem>
                        <SelectItem value="F">Féminin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Téléphone</Label><Input value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Salaire (GNF)</Label><Input type="number" value={form.salaire_base} onChange={e => setForm(f => ({ ...f, salaire_base: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>Date d'embauche</Label><Input type="date" value={form.date_embauche} onChange={e => setForm(f => ({ ...f, date_embauche: e.target.value }))} /></div>
                </div>
                <div className="space-y-1"><Label>Mot de passe portail</Label><Input value={form.mot_de_passe} onChange={e => setForm(f => ({ ...f, mot_de_passe: e.target.value }))} placeholder="Pour l'accès employé" /></div>
                <div className="space-y-1"><Label>Adresse</Label><Input value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} /></div>
                <Button className="w-full" onClick={() => addEmployee.mutate()} disabled={addEmployee.isPending}>
                  {addEmployee.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Créer l'employé
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 text-center"><Users className="h-5 w-5 mx-auto mb-1 text-primary" /><div className="text-xl font-bold">{employes.filter((e: any) => e.statut === 'actif').length}</div><p className="text-xs text-muted-foreground">Actifs</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><Clock className="h-5 w-5 mx-auto mb-1 text-blue-500" /><div className="text-xl font-bold">{pointagesToday.length}</div><p className="text-xs text-muted-foreground">Pointages aujourd'hui</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><Calendar className="h-5 w-5 mx-auto mb-1 text-orange-500" /><div className="text-xl font-bold">{congesEnAttente.length}</div><p className="text-xs text-muted-foreground">Congés en attente</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><DollarSign className="h-5 w-5 mx-auto mb-1 text-green-500" /><div className="text-xl font-bold">{avancesEnAttente.length}</div><p className="text-xs text-muted-foreground">Avances en attente</p></CardContent></Card>
      </div>

      <Tabs defaultValue="employes">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="employes"><Users className="h-3.5 w-3.5 mr-1" />Employés</TabsTrigger>
          <TabsTrigger value="pointage"><Clock className="h-3.5 w-3.5 mr-1" />Pointage</TabsTrigger>
          <TabsTrigger value="conges"><Calendar className="h-3.5 w-3.5 mr-1" />Congés ({congesEnAttente.length})</TabsTrigger>
          <TabsTrigger value="avances"><DollarSign className="h-3.5 w-3.5 mr-1" />Avances ({avancesEnAttente.length})</TabsTrigger>
          <TabsTrigger value="paie"><FileText className="h-3.5 w-3.5 mr-1" />Paie</TabsTrigger>
        </TabsList>

        {/* Employés */}
        <TabsContent value="employes" className="mt-4">
          <div className="mb-4">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          </div>
          <Card>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matricule</TableHead>
                    <TableHead>Nom & Prénom</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Poste</TableHead>
                    <TableHead>Salaire</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun employé</TableCell></TableRow>
                  ) : filtered.map((emp: any) => (
                    <TableRow key={emp.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedEmp(emp)}>
                      <TableCell className="font-mono text-xs">{emp.matricule}</TableCell>
                      <TableCell className="font-medium">{emp.prenom} {emp.nom}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{categorieLabel[emp.categorie] || emp.categorie}</Badge></TableCell>
                      <TableCell className="text-sm">{emp.poste}</TableCell>
                      <TableCell className="text-sm">{Number(emp.salaire_base).toLocaleString()} GNF</TableCell>
                      <TableCell><Badge variant={emp.statut === 'actif' ? 'default' : 'destructive'}>{emp.statut}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Pointage */}
        <TabsContent value="pointage" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" /> Pointages du {format(new Date(), 'EEEE dd MMMM yyyy', { locale: fr })}
              </CardTitle>
            </CardHeader>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employé</TableHead>
                    <TableHead>Arrivée</TableHead>
                    <TableHead>Départ</TableHead>
                    <TableHead>Heures</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pointagesToday.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun pointage</TableCell></TableRow>
                  ) : pointagesToday.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.employes?.prenom} {p.employes?.nom}</TableCell>
                      <TableCell>{p.heure_arrivee ? format(new Date(p.heure_arrivee), 'HH:mm') : '—'}</TableCell>
                      <TableCell>{p.heure_depart ? format(new Date(p.heure_depart), 'HH:mm') : '—'}</TableCell>
                      <TableCell>{p.heures_travaillees ? `${p.heures_travaillees}h` : '—'}</TableCell>
                      <TableCell>{p.retard ? <Badge variant="destructive" className="text-xs">Retard</Badge> : <Badge className="text-xs bg-green-500">OK</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Congés */}
        <TabsContent value="conges" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Demandes de congé en attente</CardTitle></CardHeader>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employé</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {congesEnAttente.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucune demande</TableCell></TableRow>
                  ) : congesEnAttente.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.employes?.prenom} {c.employes?.nom}</TableCell>
                      <TableCell className="capitalize">{c.type_conge}</TableCell>
                      <TableCell className="text-sm">{format(new Date(c.date_debut), 'dd/MM')} → {format(new Date(c.date_fin), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="text-sm max-w-32 truncate">{c.motif || '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleConge(c.id, 'approuve')}><Check className="h-3.5 w-3.5 text-green-600" /></Button>
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleConge(c.id, 'refuse')}><X className="h-3.5 w-3.5 text-red-600" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Avances */}
        <TabsContent value="avances" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Demandes d'avance en attente</CardTitle></CardHeader>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employé</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {avancesEnAttente.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucune demande</TableCell></TableRow>
                  ) : avancesEnAttente.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.employes?.prenom} {a.employes?.nom}</TableCell>
                      <TableCell className="font-bold">{Number(a.montant).toLocaleString()} GNF</TableCell>
                      <TableCell className="text-sm max-w-32 truncate">{a.motif || '—'}</TableCell>
                      <TableCell className="text-sm">{format(new Date(a.created_at), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleAvance(a.id, 'approuve')}><Check className="h-3.5 w-3.5 text-green-600" /></Button>
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleAvance(a.id, 'refuse')}><X className="h-3.5 w-3.5 text-red-600" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Paie */}
        <TabsContent value="paie" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={paieOpen} onOpenChange={setPaieOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><FileText className="h-4 w-4 mr-1" /> Générer un bulletin</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Générer un bulletin de paie</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1"><Label>Employé *</Label>
                    <Select value={paieForm.employe_id} onValueChange={v => {
                      const emp = employes.find((e: any) => e.id === v);
                      setPaieForm(f => ({ ...f, employe_id: v, salaire_brut: Number(emp?.salaire_base || 0) }));
                    }}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                      <SelectContent>
                        {employes.filter((e: any) => e.statut === 'actif').map((e: any) => (
                          <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.matricule})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Mois</Label>
                      <Select value={String(paieForm.mois)} onValueChange={v => setPaieForm(f => ({ ...f, mois: Number(v) }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MOIS_NOMS.slice(1).map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label>Année</Label><Input type="number" value={paieForm.annee} onChange={e => setPaieForm(f => ({ ...f, annee: Number(e.target.value) }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Salaire brut</Label><Input type="number" value={paieForm.salaire_brut} onChange={e => setPaieForm(f => ({ ...f, salaire_brut: Number(e.target.value) }))} /></div>
                    <div className="space-y-1"><Label>Primes</Label><Input type="number" value={paieForm.primes} onChange={e => setPaieForm(f => ({ ...f, primes: Number(e.target.value) }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Retenues</Label><Input type="number" value={paieForm.retenues} onChange={e => setPaieForm(f => ({ ...f, retenues: Number(e.target.value) }))} /></div>
                    <div className="space-y-1"><Label>Avances déduites</Label><Input type="number" value={paieForm.avances_deduites} onChange={e => setPaieForm(f => ({ ...f, avances_deduites: Number(e.target.value) }))} /></div>
                  </div>
                  <div className="space-y-1"><Label>Commentaire</Label><Input value={paieForm.commentaire} onChange={e => setPaieForm(f => ({ ...f, commentaire: e.target.value }))} /></div>
                  <div className="text-sm font-bold text-right">
                    Net: {(paieForm.salaire_brut + paieForm.primes - paieForm.retenues - paieForm.avances_deduites).toLocaleString()} GNF
                  </div>
                  <Button className="w-full" onClick={generateBulletin}>Générer le bulletin</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employé</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Brut</TableHead>
                    <TableHead>Net</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bulletins.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun bulletin</TableCell></TableRow>
                  ) : bulletins.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.employes?.prenom} {b.employes?.nom}</TableCell>
                      <TableCell>{MOIS_NOMS[b.mois]} {b.annee}</TableCell>
                      <TableCell>{Number(b.salaire_brut).toLocaleString()}</TableCell>
                      <TableCell className="font-bold">{Number(b.salaire_net).toLocaleString()} GNF</TableCell>
                      <TableCell className="text-sm">{format(new Date(b.created_at), 'dd/MM/yyyy')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Employee detail dialog */}
      <Dialog open={!!selectedEmp} onOpenChange={v => { if (!v) setSelectedEmp(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {selectedEmp && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedEmp.prenom} {selectedEmp.nom}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Matricule:</span> <span className="font-mono">{selectedEmp.matricule}</span></div>
                  <div><span className="text-muted-foreground">Catégorie:</span> {categorieLabel[selectedEmp.categorie]}</div>
                  <div><span className="text-muted-foreground">Poste:</span> {selectedEmp.poste || '—'}</div>
                  <div><span className="text-muted-foreground">Sexe:</span> {selectedEmp.sexe || '—'}</div>
                  <div><span className="text-muted-foreground">Téléphone:</span> {selectedEmp.telephone || '—'}</div>
                  <div><span className="text-muted-foreground">Email:</span> {selectedEmp.email || '—'}</div>
                  <div><span className="text-muted-foreground">Adresse:</span> {selectedEmp.adresse || '—'}</div>
                  <div><span className="text-muted-foreground">Embauche:</span> {selectedEmp.date_embauche ? format(new Date(selectedEmp.date_embauche), 'dd/MM/yyyy') : '—'}</div>
                  <div><span className="text-muted-foreground">Salaire:</span> <span className="font-bold">{Number(selectedEmp.salaire_base).toLocaleString()} GNF</span></div>
                  <div><span className="text-muted-foreground">Statut:</span> <Badge variant={selectedEmp.statut === 'actif' ? 'default' : 'destructive'}>{selectedEmp.statut}</Badge></div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* QR Scanner */}
      <QRScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScanPointage}
        title="Scanner badge employé"
      />
    </div>
  );
}
