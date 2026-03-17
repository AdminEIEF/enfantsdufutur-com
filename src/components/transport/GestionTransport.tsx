import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Bus, Plus, Pencil, Trash2, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ─── Zones Transport ─────────────────────────────────────
function ZonesTab() {
  const qc = useQueryClient();
  const { data: zones = [], isLoading } = useQuery({
    queryKey: ['zones_transport'],
    queryFn: async () => {
      const { data, error } = await supabase.from('zones_transport' as any).select('*').order('nom');
      if (error) throw error;
      return data as any[];
    },
  });

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [prixMensuel, setPrixMensuel] = useState(0);
  const [chauffeurBus, setChauffeurBus] = useState('');
  const [telephoneChauffeur, setTelephoneChauffeur] = useState('');
  const [quartiersInput, setQuartiersInput] = useState('');

  const reset = () => { setEditId(null); setNom(''); setPrixMensuel(0); setChauffeurBus(''); setTelephoneChauffeur(''); setQuartiersInput(''); setOpen(false); };

  const save = useMutation({
    mutationFn: async () => {
      if (!nom) throw new Error('Le nom est requis');
      const quartiers = quartiersInput.split(',').map(q => q.trim()).filter(Boolean);
      const payload = { nom, prix_mensuel: prixMensuel, chauffeur_bus: chauffeurBus || null, telephone_chauffeur: telephoneChauffeur || null, quartiers };
      if (editId) {
        const { error } = await supabase.from('zones_transport' as any).update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('zones_transport' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones_transport'] }); qc.invalidateQueries({ queryKey: ['transport-zones'] }); toast.success('Zone enregistrée'); reset(); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('zones_transport' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones_transport'] }); qc.invalidateQueries({ queryKey: ['transport-zones'] }); toast.success('Zone supprimée'); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (z: any) => {
    setEditId(z.id); setNom(z.nom); setPrixMensuel(z.prix_mensuel); setChauffeurBus(z.chauffeur_bus ?? '');
    setTelephoneChauffeur(z.telephone_chauffeur ?? '');
    setQuartiersInput((z.quartiers ?? []).join(', ')); setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-5 w-5" /> Zones de Transport</CardTitle>
        <Button size="sm" onClick={() => { reset(); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zone</TableHead>
              <TableHead>Prix mensuel</TableHead>
              <TableHead>Chauffeur / Bus</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Quartiers</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Chargement…</TableCell></TableRow>
            ) : zones.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucune zone configurée</TableCell></TableRow>
            ) : zones.map((z: any) => (
              <TableRow key={z.id}>
                <TableCell className="font-medium">{z.nom}</TableCell>
                <TableCell>{Number(z.prix_mensuel).toLocaleString()} GNF</TableCell>
                <TableCell>{z.chauffeur_bus ?? '—'}</TableCell>
                <TableCell>{z.telephone_chauffeur ?? '—'}</TableCell>
                <TableCell className="max-w-[200px] truncate">{(z.quartiers ?? []).join(', ') || '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(z)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(z.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Modifier' : 'Ajouter'} une zone de transport</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom de la zone</Label><Input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex: Zone Nord" /></div>
            <div><Label>Prix mensuel (GNF)</Label><Input type="number" value={prixMensuel} onChange={e => setPrixMensuel(Number(e.target.value))} min={0} /></div>
            <div><Label>Chauffeur / Bus</Label><Input value={chauffeurBus} onChange={e => setChauffeurBus(e.target.value)} placeholder="Ex: Bus A – M. Diallo" /></div>
            <div><Label>Téléphone chauffeur</Label><Input value={telephoneChauffeur} onChange={e => setTelephoneChauffeur(e.target.value)} placeholder="Ex: 620 00 00 00" /></div>
            <div>
              <Label>Quartiers couverts (séparés par des virgules)</Label>
              <Input value={quartiersInput} onChange={e => setQuartiersInput(e.target.value)} placeholder="Ex: Quartier A, Quartier B" />
              <p className="text-xs text-muted-foreground mt-1">Servent à suggérer la zone automatiquement.</p>
            </div>
          </div>
          <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Véhicules / Bus ─────────────────────────────────────
function VehiculesTab() {
  const qc = useQueryClient();
  const { data: vehicules = [], isLoading } = useQuery({
    queryKey: ['vehicules-gestion'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicules_transport')
        .select('*, zones_transport:zone_transport_id(nom)')
        .order('immatriculation');
      if (error) throw error;
      return data;
    },
  });

  const { data: zones = [] } = useQuery({
    queryKey: ['zones_transport'],
    queryFn: async () => {
      const { data, error } = await supabase.from('zones_transport' as any).select('id, nom').order('nom');
      if (error) throw error;
      return data as any[];
    },
  });

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [immat, setImmat] = useState('');
  const [marque, setMarque] = useState('');
  const [modele, setModele] = useState('');
  const [capacite, setCapacite] = useState(30);
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [couleur, setCouleur] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [assuranceExpire, setAssuranceExpire] = useState('');
  const [ctExpire, setCtExpire] = useState('');
  const [actif, setActif] = useState(true);

  const reset = () => {
    setEditId(null); setImmat(''); setMarque(''); setModele(''); setCapacite(30);
    setAnnee(new Date().getFullYear()); setCouleur(''); setZoneId('');
    setAssuranceExpire(''); setCtExpire(''); setActif(true); setOpen(false);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!immat) throw new Error("L'immatriculation est requise");
      const payload: any = {
        immatriculation: immat, marque: marque || null, modele: modele || null,
        capacite, annee, couleur: couleur || null,
        zone_transport_id: zoneId || null,
        assurance_expire: assuranceExpire || null,
        controle_technique_expire: ctExpire || null,
        actif,
      };
      if (editId) {
        payload.updated_at = new Date().toISOString();
        const { error } = await supabase.from('vehicules_transport').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('vehicules_transport').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicules-gestion'] }); qc.invalidateQueries({ queryKey: ['vehicules-assignation'] }); toast.success('Véhicule enregistré'); reset(); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vehicules_transport').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicules-gestion'] }); qc.invalidateQueries({ queryKey: ['vehicules-assignation'] }); toast.success('Véhicule supprimé'); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (v: any) => {
    setEditId(v.id); setImmat(v.immatriculation); setMarque(v.marque ?? ''); setModele(v.modele ?? '');
    setCapacite(v.capacite ?? 30); setAnnee(v.annee ?? new Date().getFullYear());
    setCouleur(v.couleur ?? ''); setZoneId(v.zone_transport_id ?? '');
    setAssuranceExpire(v.assurance_expire ?? ''); setCtExpire(v.controle_technique_expire ?? '');
    setActif(v.actif); setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base"><Bus className="h-5 w-5" /> Véhicules / Bus</CardTitle>
        <Button size="sm" onClick={() => { reset(); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Ajouter un bus</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Immatriculation</TableHead>
              <TableHead>Marque / Modèle</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead className="text-center">Capacité</TableHead>
              <TableHead>Assurance</TableHead>
              <TableHead>CT</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Chargement…</TableCell></TableRow>
            ) : vehicules.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Aucun véhicule enregistré</TableCell></TableRow>
            ) : vehicules.map((v: any) => {
              const isAssuranceExpired = v.assurance_expire && new Date(v.assurance_expire) < new Date();
              const isCTExpired = v.controle_technique_expire && new Date(v.controle_technique_expire) < new Date();
              return (
                <TableRow key={v.id}>
                  <TableCell className="font-medium font-mono">{v.immatriculation}</TableCell>
                  <TableCell>{[v.marque, v.modele].filter(Boolean).join(' ') || '—'}</TableCell>
                  <TableCell>{v.zones_transport ? <Badge variant="outline">{(v.zones_transport as any).nom}</Badge> : '—'}</TableCell>
                  <TableCell className="text-center">{v.capacite ?? '—'}</TableCell>
                  <TableCell>
                    {v.assurance_expire ? (
                      <Badge variant={isAssuranceExpired ? 'destructive' : 'secondary'}>{v.assurance_expire}</Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    {v.controle_technique_expire ? (
                      <Badge variant={isCTExpired ? 'destructive' : 'secondary'}>{v.controle_technique_expire}</Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={v.actif ? 'default' : 'secondary'}>{v.actif ? 'Actif' : 'Inactif'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? 'Modifier' : 'Ajouter'} un véhicule</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Immatriculation *</Label><Input value={immat} onChange={e => setImmat(e.target.value)} placeholder="Ex: RC 1234 AB" /></div>
            <div><Label>Marque</Label><Input value={marque} onChange={e => setMarque(e.target.value)} placeholder="Ex: Toyota" /></div>
            <div><Label>Modèle</Label><Input value={modele} onChange={e => setModele(e.target.value)} placeholder="Ex: Coaster" /></div>
            <div><Label>Capacité (places)</Label><Input type="number" value={capacite} onChange={e => setCapacite(Number(e.target.value))} min={1} /></div>
            <div><Label>Année</Label><Input type="number" value={annee} onChange={e => setAnnee(Number(e.target.value))} /></div>
            <div><Label>Couleur</Label><Input value={couleur} onChange={e => setCouleur(e.target.value)} placeholder="Ex: Jaune" /></div>
            <div>
              <Label>Zone</Label>
              <Select value={zoneId} onValueChange={setZoneId}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  {zones.map((z: any) => <SelectItem key={z.id} value={z.id}>{z.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Assurance expire le</Label><Input type="date" value={assuranceExpire} onChange={e => setAssuranceExpire(e.target.value)} /></div>
            <div><Label>Contrôle technique expire le</Label><Input type="date" value={ctExpire} onChange={e => setCtExpire(e.target.value)} /></div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="vehicule-actif" checked={actif} onChange={e => setActif(e.target.checked)} className="rounded" />
              <Label htmlFor="vehicule-actif">Véhicule actif</Label>
            </div>
          </div>
          <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Composant principal ─────────────────────────────────
export default function GestionTransport() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="zones">
        <TabsList>
          <TabsTrigger value="zones" className="gap-1"><MapPin className="h-3.5 w-3.5" /> Zones</TabsTrigger>
          <TabsTrigger value="vehicules" className="gap-1"><Bus className="h-3.5 w-3.5" /> Véhicules</TabsTrigger>
        </TabsList>
        <TabsContent value="zones" className="mt-4">
          <ZonesTab />
        </TabsContent>
        <TabsContent value="vehicules" className="mt-4">
          <VehiculesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
