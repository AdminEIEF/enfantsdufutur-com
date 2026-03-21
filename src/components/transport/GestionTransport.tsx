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
import { MapPin, Bus, Plus, Pencil, Trash2, User, Navigation } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import SuiviGPSBus from './SuiviGPSBus';

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

  // Véhicules avec chauffeur pour afficher l'assignation par zone
  const { data: vehicules = [] } = useQuery({
    queryKey: ['vehicules-assignation'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicules_transport')
        .select('*, employes:chauffeur_id(id, nom, prenom, telephone), zones_transport:zone_transport_id(nom)')
        .eq('actif', true)
        .order('immatriculation');
      if (error) throw error;
      return data;
    },
  });

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [quartiersInput, setQuartiersInput] = useState('');

  const reset = () => { setEditId(null); setNom(''); setQuartiersInput(''); setOpen(false); };

  const save = useMutation({
    mutationFn: async () => {
      if (!nom) throw new Error('Le nom est requis');
      const quartiers = quartiersInput.split(',').map(q => q.trim()).filter(Boolean);
      const payload = { nom, quartiers };
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
    setEditId(z.id); setNom(z.nom);
    setQuartiersInput((z.quartiers ?? []).join(', ')); setOpen(true);
  };

  // Helper: get vehicle + chauffeur for a zone
  const getVehiculeForZone = (zoneId: string) => {
    return vehicules.find((v: any) => v.zone_transport_id === zoneId);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-5 w-5" /> Zones</CardTitle>
        <Button size="sm" onClick={() => { reset(); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Zone</TableHead>
              <TableHead>Bus assigné</TableHead>
              <TableHead>Chauffeur</TableHead>
              <TableHead>Quartiers</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Chargement…</TableCell></TableRow>
            ) : zones.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucune zone</TableCell></TableRow>
            ) : zones.map((z: any) => {
              const veh = getVehiculeForZone(z.id);
              const chauffeur = veh?.employes;
              return (
                <TableRow key={z.id}>
                  <TableCell className="font-medium">{z.nom}</TableCell>
                  <TableCell>
                    {veh ? (
                      <div className="text-sm">
                        <span className="font-mono">{veh.immatriculation}</span>
                        {veh.marque && <span className="text-muted-foreground ml-1 text-xs">({veh.marque})</span>}
                      </div>
                    ) : <span className="text-muted-foreground text-xs italic">Non assigné</span>}
                  </TableCell>
                  <TableCell>
                    {chauffeur ? (
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{chauffeur.prenom} {chauffeur.nom}</p>
                          {chauffeur.telephone && <p className="text-[11px] text-muted-foreground">{chauffeur.telephone}</p>}
                        </div>
                      </div>
                    ) : <span className="text-muted-foreground text-xs italic">—</span>}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{(z.quartiers ?? []).join(', ') || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(z)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(z.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? 'Modifier' : 'Ajouter'} une zone</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom *</Label><Input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex: Zone Nord" /></div>
            <div><Label>Quartiers (séparés par virgules)</Label><Input value={quartiersInput} onChange={e => setQuartiersInput(e.target.value)} placeholder="Quartier A, Quartier B" /></div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">💡 Pour assigner un chauffeur, allez dans l'onglet <strong>Assignation</strong> après avoir créé un véhicule lié à cette zone.</p>
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
        .select('*, employes:chauffeur_id(id, nom, prenom), zones_transport:zone_transport_id(nom)')
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
  const [capacite, setCapacite] = useState(30);
  const [zoneId, setZoneId] = useState('');

  const reset = () => { setEditId(null); setImmat(''); setMarque(''); setCapacite(30); setZoneId(''); setOpen(false); };

  const save = useMutation({
    mutationFn: async () => {
      if (!immat) throw new Error("L'immatriculation est requise");
      const payload: any = {
        immatriculation: immat, marque: marque || null,
        capacite, zone_transport_id: zoneId && zoneId !== 'none' ? zoneId : null, actif: true,
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
    setEditId(v.id); setImmat(v.immatriculation); setMarque(v.marque ?? '');
    setCapacite(v.capacite ?? 30); setZoneId(v.zone_transport_id ?? ''); setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base"><Bus className="h-5 w-5" /> Véhicules</CardTitle>
        <Button size="sm" onClick={() => { reset(); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Immatriculation</TableHead>
              <TableHead>Marque</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>Chauffeur</TableHead>
              <TableHead className="text-center">Places</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Chargement…</TableCell></TableRow>
            ) : vehicules.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun véhicule</TableCell></TableRow>
            ) : vehicules.map((v: any) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium font-mono">{v.immatriculation}</TableCell>
                <TableCell>{v.marque || '—'}</TableCell>
                <TableCell>{v.zones_transport ? <Badge variant="outline">{(v.zones_transport as any).nom}</Badge> : '—'}</TableCell>
                <TableCell>
                  {v.employes ? (
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-primary" />
                      <span className="text-sm">{v.employes.prenom} {v.employes.nom}</span>
                    </div>
                  ) : <span className="text-muted-foreground text-xs italic">Non assigné</span>}
                </TableCell>
                <TableCell className="text-center">{v.capacite ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editId ? 'Modifier' : 'Ajouter'} un véhicule</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Immatriculation *</Label><Input value={immat} onChange={e => setImmat(e.target.value)} placeholder="RC 1234 AB" /></div>
            <div><Label>Marque</Label><Input value={marque} onChange={e => setMarque(e.target.value)} placeholder="Toyota Coaster" /></div>
            <div><Label>Capacité (places)</Label><Input type="number" value={capacite} onChange={e => setCapacite(Number(e.target.value))} min={1} /></div>
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
          </div>
          <p className="text-xs text-muted-foreground mt-1">💡 Pour assigner un chauffeur, utilisez l'onglet <strong>Assignation</strong>.</p>
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
          <TabsTrigger value="gps" className="gap-1"><Navigation className="h-3.5 w-3.5" /> Suivi GPS</TabsTrigger>
        </TabsList>
        <TabsContent value="zones" className="mt-4"><ZonesTab /></TabsContent>
        <TabsContent value="vehicules" className="mt-4"><VehiculesTab /></TabsContent>
        <TabsContent value="gps" className="mt-4"><SuiviGPSBus /></TabsContent>
      </Tabs>
    </div>
  );
}
