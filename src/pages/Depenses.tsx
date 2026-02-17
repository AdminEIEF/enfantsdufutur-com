import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Calculator, Plus, Search, TrendingDown, Trash2, CheckCircle, XCircle, Clock, Users, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '@/hooks/useAuth';

const SERVICES = ['Transport', 'Cantine', 'Librairie', 'Boutique', 'Fonctionnement', 'Autre'];

const SOUS_CATEGORIES: Record<string, string[]> = {
  'Transport': ['Carburant', 'Entretien véhicule', 'Salaire chauffeur', 'Assurance', 'Autre'],
  'Cantine': ['Achat de vivres', 'Gaz', 'Salaire cuisinier', 'Ustensiles', 'Autre'],
  'Librairie': ['Achat stock fournisseur', 'Impression', 'Autre'],
  'Boutique': ['Achat stock fournisseur', 'Autre'],
  'Fonctionnement': ['Loyer', 'Électricité', 'Eau', 'Salaires professeurs', 'Fournitures bureau', 'Internet', 'Autre'],
  'Autre': ['Autre'],
};

const SERVICE_COLORS: Record<string, string> = {
  'Transport': '#f97316',
  'Cantine': '#22c55e',
  'Librairie': '#3b82f6',
  'Boutique': '#8b5cf6',
  'Fonctionnement': '#ec4899',
  'Autre': '#6b7280',
};

const SERVICE_BADGE: Record<string, string> = {
  'Transport': 'bg-orange-100 text-orange-800',
  'Cantine': 'bg-green-100 text-green-800',
  'Librairie': 'bg-blue-100 text-blue-800',
  'Boutique': 'bg-purple-100 text-purple-800',
  'Fonctionnement': 'bg-pink-100 text-pink-800',
  'Autre': 'bg-muted text-muted-foreground',
};

const STATUT_BADGE: Record<string, { class: string; label: string; icon: any }> = {
  'soumise': { class: 'bg-yellow-100 text-yellow-800', label: 'En attente', icon: Clock },
  'validee': { class: 'bg-green-100 text-green-800', label: 'Validée', icon: CheckCircle },
  'rejetee': { class: 'bg-red-100 text-red-800', label: 'Rejetée', icon: XCircle },
};

export default function Depenses() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isComptable = hasRole('comptable');
  const canManage = isAdmin || isComptable;

  const [open, setOpen] = useState(false);
  const [fournisseurOpen, setFournisseurOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterService, setFilterService] = useState<string>('all');
  const [filterStatut, setFilterStatut] = useState<string>('all');
  const [filterMois, setFilterMois] = useState<string>('all');
  const [libelle, setLibelle] = useState('');
  const [montant, setMontant] = useState('');
  const [service, setService] = useState('');
  const [sousCategorie, setSousCategorie] = useState('');
  const [fournisseurId, setFournisseurId] = useState('');
  const [dateDepense, setDateDepense] = useState(new Date().toISOString().split('T')[0]);

  // Fournisseur form
  const [fNom, setFNom] = useState('');
  const [fTelephone, setFTelephone] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fAdresse, setFAdresse] = useState('');
  const [fCategorie, setFCategorie] = useState('');

  const queryClient = useQueryClient();

  const { data: depenses = [], isLoading } = useQuery({
    queryKey: ['depenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('depenses')
        .select('*')
        .order('date_depense', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: fournisseurs = [] } = useQuery({
    queryKey: ['fournisseurs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fournisseurs')
        .select('*')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  const createDepense = useMutation({
    mutationFn: async () => {
      if (!libelle.trim() || !montant || parseFloat(montant) <= 0 || !service) throw new Error('Tous les champs sont obligatoires');
      const { data: { user } } = await supabase.auth.getUser();
      const statut = canManage ? 'validee' : 'soumise';
      const { error } = await supabase.from('depenses').insert({
        libelle: libelle.trim(),
        montant: parseFloat(montant),
        service,
        sous_categorie: sousCategorie || null,
        fournisseur_id: fournisseurId || null,
        date_depense: dateDepense,
        created_by: user?.id || null,
        statut,
        validated_by: canManage ? user?.id : null,
        validated_at: canManage ? new Date().toISOString() : null,
      });
      if (error) throw error;
      return statut;
    },
    onSuccess: (statut) => {
      queryClient.invalidateQueries({ queryKey: ['depenses'] });
      const msg = statut === 'soumise' ? 'Demande soumise — en attente de validation Admin' : `${libelle} — ${parseInt(montant).toLocaleString()} GNF`;
      toast({ title: statut === 'soumise' ? 'Demande soumise' : 'Dépense enregistrée', description: msg });
      setLibelle(''); setMontant(''); setService(''); setSousCategorie(''); setFournisseurId(''); setOpen(false);
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  const validateMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'validee' | 'rejetee' }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('depenses').update({
        statut: action,
        validated_by: user?.id,
        validated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['depenses'] });
      toast({ title: action === 'validee' ? 'Dépense validée' : 'Dépense rejetée' });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('depenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['depenses'] });
      toast({ title: 'Dépense supprimée' });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  const createFournisseur = useMutation({
    mutationFn: async () => {
      if (!fNom.trim() || !fCategorie) throw new Error('Nom et catégorie obligatoires');
      const { error } = await supabase.from('fournisseurs').insert({
        nom: fNom.trim(),
        telephone: fTelephone || null,
        email: fEmail || null,
        adresse: fAdresse || null,
        categorie: fCategorie,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fournisseurs'] });
      toast({ title: 'Fournisseur ajouté', description: fNom });
      setFNom(''); setFTelephone(''); setFEmail(''); setFAdresse(''); setFCategorie(''); setFournisseurOpen(false);
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  const deleteFournisseur = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fournisseurs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fournisseurs'] });
      toast({ title: 'Fournisseur supprimé' });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  const moisOptions = useMemo(() => {
    const set = new Set<string>();
    depenses.forEach((d: any) => {
      const m = d.date_depense.substring(0, 7);
      set.add(m);
    });
    return Array.from(set).sort().reverse();
  }, [depenses]);

  const filtered = depenses.filter((d: any) => {
    const matchSearch = `${d.libelle} ${d.service} ${d.sous_categorie || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchService = filterService === 'all' || d.service === filterService;
    const matchStatut = filterStatut === 'all' || d.statut === filterStatut;
    const matchMois = filterMois === 'all' || d.date_depense.startsWith(filterMois);
    return matchSearch && matchService && matchStatut && matchMois;
  });

  const pendingCount = depenses.filter((d: any) => d.statut === 'soumise').length;
  const totalFiltered = filtered.filter((d: any) => d.statut === 'validee').reduce((s: number, d: any) => s + Number(d.montant), 0);
  const totalGeneral = depenses.filter((d: any) => d.statut === 'validee').reduce((s: number, d: any) => s + Number(d.montant), 0);

  const statsByService = SERVICES.map(s => ({
    name: s,
    total: depenses.filter((d: any) => d.service === s && d.statut === 'validee').reduce((sum: number, d: any) => sum + Number(d.montant), 0),
    count: depenses.filter((d: any) => d.service === s && d.statut === 'validee').length,
  }));

  const pieData = statsByService.filter(s => s.total > 0);

  const chartData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const monthDeps = depenses.filter((dep: any) => {
        const pd = new Date(dep.date_depense);
        return pd >= start && pd <= end && dep.statut === 'validee';
      });
      const entry: any = { mois: format(d, 'MMM yy', { locale: fr }) };
      SERVICES.forEach(s => {
        entry[s] = monthDeps.filter((dep: any) => dep.service === s).reduce((sum: number, dep: any) => sum + Number(dep.montant), 0);
      });
      entry.total = monthDeps.reduce((sum: number, dep: any) => sum + Number(dep.montant), 0);
      months.push(entry);
    }
    return months;
  }, [depenses]);

  const getFournisseurNom = (id: string | null) => {
    if (!id) return '—';
    const f = fournisseurs.find((f: any) => f.id === id);
    return f ? (f as any).nom : '—';
  };

  const filteredFournisseurs = fournisseurs as any[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Calculator className="h-7 w-7 text-primary" /> Gestion des Dépenses
        </h1>
        <div className="flex gap-2">
          {canManage && pendingCount > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              <Clock className="h-3 w-3 mr-1" /> {pendingCount} en attente
            </Badge>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> {canManage ? 'Nouvelle Dépense' : 'Soumettre une dépense'}</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{canManage ? 'Enregistrer une dépense' : 'Soumettre une demande de dépense'}</DialogTitle></DialogHeader>
              {!canManage && (
                <p className="text-sm text-muted-foreground bg-yellow-50 border border-yellow-200 rounded-md p-2">
                  ⚠️ Votre demande devra être validée par un administrateur avant d'être prise en compte.
                </p>
              )}
              <div className="space-y-3">
                <div><Label>Libellé *</Label><Input value={libelle} onChange={e => setLibelle(e.target.value)} placeholder="Ex: Carburant bus, Achat de riz" /></div>
                <div><Label>Montant (GNF) *</Label><Input type="number" value={montant} onChange={e => setMontant(e.target.value)} placeholder="0" /></div>
                <div>
                  <Label>Catégorie de revenu *</Label>
                  <Select value={service} onValueChange={(v) => { setService(v); setSousCategorie(''); }}>
                    <SelectTrigger><SelectValue placeholder="Lier à un poste de revenu" /></SelectTrigger>
                    <SelectContent>{SERVICES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {service && SOUS_CATEGORIES[service] && (
                  <div>
                    <Label>Sous-catégorie</Label>
                    <Select value={sousCategorie} onValueChange={setSousCategorie}>
                      <SelectTrigger><SelectValue placeholder="Préciser le type" /></SelectTrigger>
                      <SelectContent>{SOUS_CATEGORIES[service].map(sc => <SelectItem key={sc} value={sc}>{sc}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Fournisseur</Label>
                  <Select value={fournisseurId} onValueChange={setFournisseurId}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner (optionnel)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {filteredFournisseurs.filter((f: any) => !service || f.categorie === service.toLowerCase() || f.categorie === service).map((f: any) => (
                        <SelectItem key={f.id} value={f.id}>{f.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Date</Label><Input type="date" value={dateDepense} onChange={e => setDateDepense(e.target.value)} /></div>
                <Button onClick={() => createDepense.mutate()} disabled={createDepense.isPending} className="w-full">
                  {canManage ? 'Enregistrer' : 'Soumettre la demande'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
        <Card>
          <CardHeader className="pb-1 pt-3 px-3"><CardTitle className="text-xs text-muted-foreground">Total validé</CardTitle></CardHeader>
          <CardContent className="px-3 pb-3"><p className="text-lg font-bold">{totalGeneral.toLocaleString()} F</p></CardContent>
        </Card>
        {statsByService.filter(s => s.total > 0).map(s => (
          <Card key={s.name}>
            <CardHeader className="pb-1 pt-3 px-3"><CardTitle className="text-xs text-muted-foreground">{s.name}</CardTitle></CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-lg font-bold">{s.total.toLocaleString()} F</p>
              <p className="text-xs text-muted-foreground">{s.count} opération(s)</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="historique">
        <TabsList>
          <TabsTrigger value="historique">Historique</TabsTrigger>
          {canManage && <TabsTrigger value="validation">Validation {pendingCount > 0 && <Badge variant="destructive" className="ml-1 text-xs px-1.5">{pendingCount}</Badge>}</TabsTrigger>}
          <TabsTrigger value="fournisseurs">Fournisseurs</TabsTrigger>
          <TabsTrigger value="suivi">Suivi mensuel</TabsTrigger>
        </TabsList>

        {/* Historique */}
        <TabsContent value="historique" className="space-y-4 mt-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterService} onValueChange={setFilterService}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                {SERVICES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatut} onValueChange={setFilterStatut}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="validee">Validées</SelectItem>
                <SelectItem value="soumise">En attente</SelectItem>
                <SelectItem value="rejetee">Rejetées</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterMois} onValueChange={setFilterMois}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tous les mois" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les mois</SelectItem>
                {moisOptions.map(m => <SelectItem key={m} value={m}>{format(new Date(m + '-01'), 'MMMM yyyy', { locale: fr })}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-2 text-sm">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Total validé:</span>
              <span className="font-bold">{totalFiltered.toLocaleString()} GNF</span>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Libellé</TableHead><TableHead>Catégorie</TableHead>
                    <TableHead>Sous-cat.</TableHead><TableHead>Fournisseur</TableHead><TableHead>Statut</TableHead>
                    <TableHead className="text-right">Montant</TableHead><TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucune dépense</TableCell></TableRow>
                  ) : filtered.map((d: any) => {
                    const st = STATUT_BADGE[d.statut] || STATUT_BADGE['validee'];
                    const StIcon = st.icon;
                    return (
                      <TableRow key={d.id} className={d.statut === 'rejetee' ? 'opacity-50' : ''}>
                        <TableCell className="text-xs">{format(new Date(d.date_depense), 'dd MMM yyyy', { locale: fr })}</TableCell>
                        <TableCell className="font-medium">{d.libelle}</TableCell>
                        <TableCell><Badge className={SERVICE_BADGE[d.service] || ''}>{d.service}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{d.sous_categorie || '—'}</TableCell>
                        <TableCell className="text-xs">{getFournisseurNom(d.fournisseur_id)}</TableCell>
                        <TableCell>
                          <Badge className={st.class}><StIcon className="h-3 w-3 mr-1" />{st.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{Number(d.montant).toLocaleString()} F</TableCell>
                        <TableCell>
                          {canManage && (
                            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-sm text-muted-foreground">{filtered.length} dépense(s)</p>
        </TabsContent>

        {/* Validation (Admin only) */}
        {canManage && (
          <TabsContent value="validation" className="mt-4 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Clock className="h-5 w-5 text-warning" /> Dépenses en attente de validation</h2>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead><TableHead>Libellé</TableHead><TableHead>Catégorie</TableHead>
                      <TableHead>Sous-cat.</TableHead><TableHead>Fournisseur</TableHead>
                      <TableHead className="text-right">Montant</TableHead><TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {depenses.filter((d: any) => d.statut === 'soumise').length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune demande en attente</TableCell></TableRow>
                    ) : depenses.filter((d: any) => d.statut === 'soumise').map((d: any) => (
                      <TableRow key={d.id}>
                        <TableCell className="text-xs">{format(new Date(d.date_depense), 'dd MMM yyyy', { locale: fr })}</TableCell>
                        <TableCell className="font-medium">{d.libelle}</TableCell>
                        <TableCell><Badge className={SERVICE_BADGE[d.service] || ''}>{d.service}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{d.sous_categorie || '—'}</TableCell>
                        <TableCell className="text-xs">{getFournisseurNom(d.fournisseur_id)}</TableCell>
                        <TableCell className="text-right font-semibold">{Number(d.montant).toLocaleString()} F</TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50"
                              onClick={() => validateMutation.mutate({ id: d.id, action: 'validee' })} disabled={validateMutation.isPending}>
                              <CheckCircle className="h-4 w-4 mr-1" /> Valider
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50"
                              onClick={() => validateMutation.mutate({ id: d.id, action: 'rejetee' })} disabled={validateMutation.isPending}>
                              <XCircle className="h-4 w-4 mr-1" /> Rejeter
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Fournisseurs */}
        <TabsContent value="fournisseurs" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Base Fournisseurs</h2>
            {canManage && (
              <Dialog open={fournisseurOpen} onOpenChange={setFournisseurOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Ajouter un fournisseur</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nouveau Fournisseur</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Nom *</Label><Input value={fNom} onChange={e => setFNom(e.target.value)} placeholder="Ex: Grossiste de riz" /></div>
                    <div><Label>Téléphone</Label><Input value={fTelephone} onChange={e => setFTelephone(e.target.value)} placeholder="Ex: 621 00 00 00" /></div>
                    <div><Label>Email</Label><Input value={fEmail} onChange={e => setFEmail(e.target.value)} placeholder="Ex: fournisseur@email.com" /></div>
                    <div><Label>Adresse</Label><Input value={fAdresse} onChange={e => setFAdresse(e.target.value)} placeholder="Ex: Marché Madina" /></div>
                    <div>
                      <Label>Catégorie *</Label>
                      <Select value={fCategorie} onValueChange={setFCategorie}>
                        <SelectTrigger><SelectValue placeholder="Catégorie du fournisseur" /></SelectTrigger>
                        <SelectContent>{SERVICES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Button onClick={() => createFournisseur.mutate()} disabled={createFournisseur.isPending} className="w-full">Enregistrer</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead><TableHead>Catégorie</TableHead><TableHead>Téléphone</TableHead>
                    <TableHead>Email</TableHead><TableHead>Adresse</TableHead>
                    {canManage && <TableHead className="w-16"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFournisseurs.length === 0 ? (
                    <TableRow><TableCell colSpan={canManage ? 6 : 5} className="text-center py-8 text-muted-foreground">Aucun fournisseur</TableCell></TableRow>
                  ) : filteredFournisseurs.map((f: any) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.nom}</TableCell>
                      <TableCell><Badge className={SERVICE_BADGE[f.categorie] || 'bg-muted text-muted-foreground'}>{f.categorie}</Badge></TableCell>
                      <TableCell className="text-sm">{f.telephone || '—'}</TableCell>
                      <TableCell className="text-sm">{f.email || '—'}</TableCell>
                      <TableCell className="text-sm">{f.adresse || '—'}</TableCell>
                      {canManage && (
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => deleteFournisseur.mutate(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Suivi mensuel */}
        <TabsContent value="suivi" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Dépenses mensuelles par catégorie</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="mois" fontSize={12} />
                      <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => `${v.toLocaleString()} GNF`} />
                      <Legend />
                      {SERVICES.map(s => (
                        <Bar key={s} dataKey={s} stackId="a" fill={SERVICE_COLORS[s]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Postes les plus coûteux</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={SERVICE_COLORS[entry.name]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${v.toLocaleString()} GNF`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
