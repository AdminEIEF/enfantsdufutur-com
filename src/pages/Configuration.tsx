import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Plus, Trash2, Pencil, GraduationCap, BookOpen, School, Tag, Calendar, Bus, Ruler, RotateCcw, Archive } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ─── Hooks ───────────────────────────────────────────────
function useCycles() {
  return useQuery({
    queryKey: ['cycles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cycles').select('*').order('ordre');
      if (error) throw error;
      return data;
    },
  });
}

function useNiveaux() {
  return useQuery({
    queryKey: ['niveaux'],
    queryFn: async () => {
      const { data, error } = await supabase.from('niveaux').select('*, cycles(nom)').order('ordre');
      if (error) throw error;
      return data;
    },
  });
}

function useClasses() {
  return useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*, niveaux(nom, cycle_id, cycles(nom))');
      if (error) throw error;
      return data;
    },
  });
}

function useMatieres() {
  return useQuery({
    queryKey: ['matieres'],
    queryFn: async () => {
      const { data, error } = await supabase.from('matieres').select('*, cycles(nom), niveaux:niveau_id(nom)').order('nom');
      if (error) throw error;
      return data;
    },
  });
}

function usePeriodes() {
  return useQuery({
    queryKey: ['periodes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('periodes').select('*').order('ordre');
      if (error) throw error;
      return data;
    },
  });
}

export function useZonesTransport() {
  return useQuery({
    queryKey: ['zones_transport'],
    queryFn: async () => {
      const { data, error } = await supabase.from('zones_transport' as any).select('*').order('nom');
      if (error) throw error;
      return data as any[];
    },
  });
}

// ─── Tab: Cycles (Barème) ────────────────────────────────
function CyclesTab() {
  const qc = useQueryClient();
  const { data: cycles, isLoading } = useCycles();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [ordre, setOrdre] = useState(1);
  const [bareme, setBareme] = useState(20);

  const reset = () => { setEditId(null); setNom(''); setOrdre(1); setBareme(20); setOpen(false); };

  const save = useMutation({
    mutationFn: async () => {
      if (!nom) throw new Error('Le nom est requis');
      const payload = { nom, ordre, bareme };
      if (editId) {
        const { error } = await supabase.from('cycles').update(payload as any).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cycles').insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cycles'] }); toast.success('Cycle enregistré'); reset(); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cycles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cycles'] }); toast.success('Cycle supprimé'); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (c: any) => {
    setEditId(c.id); setNom(c.nom); setOrdre(c.ordre); setBareme(c.bareme ?? 20); setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Ruler className="h-5 w-5" /> Cycles & Barèmes</CardTitle>
        <Button size="sm" onClick={() => { reset(); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cycle</TableHead>
              <TableHead>Ordre</TableHead>
              <TableHead>Barème des notes</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Chargement…</TableCell></TableRow>
            ) : cycles?.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Aucun cycle</TableCell></TableRow>
            ) : cycles?.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.nom}</TableCell>
                <TableCell>{c.ordre}</TableCell>
                <TableCell>
                  <Badge variant="outline">/ {c.bareme ?? 20}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Modifier' : 'Ajouter'} un cycle</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom du cycle</Label><Input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex: Primaire" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Ordre</Label><Input type="number" value={ordre} onChange={e => setOrdre(Number(e.target.value))} min={1} /></div>
              <div><Label>Barème des notes (ex: 10, 20)</Label><Input type="number" value={bareme} onChange={e => setBareme(Number(e.target.value))} min={1} /></div>
            </div>
            <p className="text-xs text-muted-foreground">Le barème définit la note maximale pour ce cycle. Ex: /10 pour le Primaire, /20 pour le Collège/Lycée.</p>
          </div>
          <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Tab: Niveaux ────────────────────────────────────────
function NiveauxTab() {
  const qc = useQueryClient();
  const { data: cycles } = useCycles();
  const { data: niveaux, isLoading } = useNiveaux();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [cycleId, setCycleId] = useState('');
  const [ordre, setOrdre] = useState(1);
  const [frais, setFrais] = useState(0);
  const [fraisInscription, setFraisInscription] = useState(100000);
  const [fraisReinscription, setFraisReinscription] = useState(150000);
  const [fraisDossier, setFraisDossier] = useState(0);
  const [fraisAssurance, setFraisAssurance] = useState(0);

  const reset = () => { setEditId(null); setNom(''); setCycleId(''); setOrdre(1); setFrais(0); setFraisInscription(100000); setFraisReinscription(150000); setFraisDossier(0); setFraisAssurance(0); setOpen(false); };

  const save = useMutation({
    mutationFn: async () => {
      if (!nom || !cycleId) throw new Error('Champs requis');
      const payload = { nom, cycle_id: cycleId, ordre, frais_scolarite: frais, frais_inscription: fraisInscription, frais_reinscription: fraisReinscription, frais_dossier: fraisDossier, frais_assurance: fraisAssurance };
      if (editId) {
        const { error } = await supabase.from('niveaux').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('niveaux').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['niveaux'] }); toast.success('Niveau enregistré'); reset(); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('niveaux').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['niveaux'] }); toast.success('Niveau supprimé'); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (n: any) => {
    setEditId(n.id); setNom(n.nom); setCycleId(n.cycle_id); setOrdre(n.ordre); setFrais(n.frais_scolarite);
    setFraisInscription(n.frais_inscription ?? 100000); setFraisReinscription(n.frais_reinscription ?? 150000);
    setFraisDossier(n.frais_dossier ?? 0); setFraisAssurance(n.frais_assurance ?? 0);
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" /> Niveaux</CardTitle>
        <Button size="sm" onClick={() => { reset(); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Cycle</TableHead>
              <TableHead>Ordre</TableHead>
              <TableHead>Scolarité annuelle</TableHead>
              <TableHead>Inscription</TableHead>
              <TableHead>Dossier</TableHead>
              <TableHead>Assurance</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
               <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Chargement…</TableCell></TableRow>
            ) : niveaux?.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Aucun niveau configuré</TableCell></TableRow>
            ) : niveaux?.map((n: any) => (
              <TableRow key={n.id}>
                <TableCell className="font-medium">{n.nom}</TableCell>
                <TableCell>{n.cycles?.nom}</TableCell>
                <TableCell>{n.ordre}</TableCell>
                <TableCell>{Number(n.frais_scolarite).toLocaleString()} GNF/an</TableCell>
                <TableCell>{Number(n.frais_inscription ?? 100000).toLocaleString()} GNF</TableCell>
                <TableCell>{Number(n.frais_dossier ?? 0).toLocaleString()} GNF</TableCell>
                <TableCell>{Number(n.frais_assurance ?? 0).toLocaleString()} GNF</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(n)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(n.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Modifier' : 'Ajouter'} un niveau</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Cycle</Label>
              <Select value={cycleId} onValueChange={setCycleId}>
                <SelectTrigger><SelectValue placeholder="Choisir un cycle" /></SelectTrigger>
                <SelectContent>{cycles?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Nom</Label><Input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex: CP1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Ordre</Label><Input type="number" value={ordre} onChange={e => setOrdre(Number(e.target.value))} /></div>
              <div><Label>Scolarité annuelle (GNF)</Label><Input type="number" value={frais} onChange={e => setFrais(Number(e.target.value))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Frais inscription (GNF)</Label><Input type="number" value={fraisInscription} onChange={e => setFraisInscription(Number(e.target.value))} /></div>
              <div><Label>Frais réinscription (GNF)</Label><Input type="number" value={fraisReinscription} onChange={e => setFraisReinscription(Number(e.target.value))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Frais de dossier (GNF)</Label><Input type="number" value={fraisDossier} onChange={e => setFraisDossier(Number(e.target.value))} /></div>
              <div><Label>Assurance scolaire (GNF)</Label><Input type="number" value={fraisAssurance} onChange={e => setFraisAssurance(Number(e.target.value))} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Tab: Classes ────────────────────────────────────────
function ClassesTab() {
  const qc = useQueryClient();
  const { data: cycles } = useCycles();
  const { data: niveaux } = useNiveaux();
  const { data: classes, isLoading } = useClasses();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [niveauId, setNiveauId] = useState('');
  const [capacite, setCapacite] = useState(30);
  const [filterCycle, setFilterCycle] = useState('');

  const filteredNiveaux = niveaux?.filter((n: any) => !filterCycle || n.cycle_id === filterCycle) ?? [];
  const filteredClasses = classes?.filter((c: any) => {
    if (!filterCycle) return true;
    return c.niveaux?.cycle_id === filterCycle;
  }) ?? [];

  const reset = () => { setEditId(null); setNom(''); setNiveauId(''); setCapacite(30); setOpen(false); };

  const save = useMutation({
    mutationFn: async () => {
      if (!nom || !niveauId) throw new Error('Champs requis');
      const payload = { nom, niveau_id: niveauId, capacite };
      if (editId) {
        const { error } = await supabase.from('classes').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('classes').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['classes'] }); toast.success('Classe enregistrée'); reset(); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['classes'] }); toast.success('Classe supprimée'); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (c: any) => {
    setEditId(c.id); setNom(c.nom); setNiveauId(c.niveau_id); setCapacite(c.capacite ?? 30);
    setFilterCycle(c.niveaux?.cycle_id ?? '');
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><School className="h-5 w-5" /> Classes</CardTitle>
        <div className="flex gap-2 items-center">
          <Select value={filterCycle || '__all__'} onValueChange={(v) => setFilterCycle(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tous les cycles" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tous les cycles</SelectItem>
              {cycles?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => { reset(); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Niveau</TableHead>
              <TableHead>Cycle</TableHead>
              <TableHead>Capacité</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Chargement…</TableCell></TableRow>
            ) : filteredClasses.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Aucune classe</TableCell></TableRow>
            ) : filteredClasses.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.nom}</TableCell>
                <TableCell>{c.niveaux?.nom}</TableCell>
                <TableCell>{c.niveaux?.cycles?.nom}</TableCell>
                <TableCell>{c.capacite}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Modifier' : 'Ajouter'} une classe</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Cycle</Label>
              <Select value={filterCycle || '__all__'} onValueChange={(v) => { setFilterCycle(v === '__all__' ? '' : v); setNiveauId(''); }}>
                <SelectTrigger><SelectValue placeholder="Filtrer par cycle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous</SelectItem>
                  {cycles?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Niveau</Label>
              <Select value={niveauId} onValueChange={setNiveauId}>
                <SelectTrigger><SelectValue placeholder="Choisir un niveau" /></SelectTrigger>
                <SelectContent>
                  {filteredNiveaux.length === 0 ? (
                    <SelectItem value="__empty__" disabled>Aucun niveau</SelectItem>
                  ) : filteredNiveaux.map((n: any) => (
                    <SelectItem key={n.id} value={n.id}>{n.nom} ({n.cycles?.nom})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nom de la classe</Label><Input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex: CP1-A" /></div>
            <div><Label>Capacité</Label><Input type="number" value={capacite} onChange={e => setCapacite(Number(e.target.value))} /></div>
          </div>
          <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Tab: Matières ───────────────────────────────────────
function MatieresTab() {
  const qc = useQueryClient();
  const { data: cycles } = useCycles();
  const { data: niveaux } = useNiveaux();
  const { data: matieres, isLoading } = useMatieres();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [cycleId, setCycleId] = useState('');
  const [niveauId, setNiveauId] = useState('');
  const [coefficient, setCoefficient] = useState(1);
  const [pole, setPole] = useState('');
  const [filterCycle, setFilterCycle] = useState('');

  const filteredNiveaux = niveaux?.filter((n: any) => !cycleId || n.cycle_id === cycleId) ?? [];
  const filteredMatieres = matieres?.filter((m: any) => !filterCycle || m.cycle_id === filterCycle) ?? [];

  const reset = () => { setEditId(null); setNom(''); setCycleId(''); setNiveauId(''); setCoefficient(1); setPole(''); setOpen(false); };

  const save = useMutation({
    mutationFn: async () => {
      if (!nom || !cycleId) throw new Error('Champs requis');
      const payload = { nom, cycle_id: cycleId, niveau_id: niveauId || null, coefficient, pole: pole || null } as any;
      if (editId) {
        const { error } = await supabase.from('matieres').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('matieres').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['matieres'] }); toast.success('Matière enregistrée'); reset(); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('matieres').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['matieres'] }); toast.success('Matière supprimée'); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (m: any) => {
    setEditId(m.id); setNom(m.nom); setCycleId(m.cycle_id ?? ''); setNiveauId((m as any).niveau_id ?? ''); setCoefficient(m.coefficient); setPole(m.pole ?? ''); setOpen(true);
  };

  const poles = ['Littéraire', 'Scientifique', 'Expérimentale'];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Matières</CardTitle>
        <div className="flex gap-2 items-center">
          <Select value={filterCycle || '__all__'} onValueChange={(v) => setFilterCycle(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tous les cycles" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tous les cycles</SelectItem>
              {cycles?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => { reset(); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Cycle</TableHead>
              <TableHead>Niveau</TableHead>
              <TableHead>Pôle</TableHead>
              <TableHead>Coefficient</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Chargement…</TableCell></TableRow>
            ) : filteredMatieres.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Aucune matière</TableCell></TableRow>
            ) : filteredMatieres.map((m: any) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.nom}</TableCell>
                <TableCell>{m.cycles?.nom}</TableCell>
                <TableCell>{m.niveaux?.nom || <span className="text-muted-foreground text-xs">Tous</span>}</TableCell>
                <TableCell>{m.pole ?? '—'}</TableCell>
                <TableCell>{m.coefficient}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Modifier' : 'Ajouter'} une matière</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Cycle *</Label>
              <Select value={cycleId} onValueChange={(v) => { setCycleId(v); setNiveauId(''); }}>
                <SelectTrigger><SelectValue placeholder="Choisir un cycle" /></SelectTrigger>
                <SelectContent>{cycles?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Niveau (optionnel — vide = tous les niveaux du cycle)</Label>
              <Select value={niveauId || '__all__'} onValueChange={(v) => setNiveauId(v === '__all__' ? '' : v)} disabled={!cycleId}>
                <SelectTrigger><SelectValue placeholder="Tous les niveaux" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous les niveaux du cycle</SelectItem>
                  {filteredNiveaux.map((n: any) => <SelectItem key={n.id} value={n.id}>{n.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nom</Label><Input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex: Mathématiques" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Pôle</Label>
                <Select value={pole || '__none__'} onValueChange={(v) => setPole(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucun</SelectItem>
                    {poles.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Coefficient</Label><Input type="number" value={coefficient} onChange={e => setCoefficient(Number(e.target.value))} min={1} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
// ─── Hook & Tab: Tarifs ──────────────────────────────────
function useTarifs() {
  return useQuery({
    queryKey: ['tarifs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tarifs').select('*').order('categorie').order('label');
      if (error) throw error;
      return data;
    },
  });
}

const TARIF_CATEGORIES = [
  { value: 'scolarite', label: 'Scolarité' },
  { value: 'transport', label: 'Transport' },
  { value: 'cantine', label: 'Cantine' },
  { value: 'fournitures', label: 'Fournitures' },
  { value: 'uniforme_scolaire', label: 'Tenue scolaire' },
  { value: 'uniforme_polo_lacoste', label: 'Polo Lacoste' },
  { value: 'uniforme_sport', label: 'Tenue de Sport' },
  { value: 'uniforme_karate', label: 'Tenue de Karaté' },
];

function TarifsTab() {
  const qc = useQueryClient();
  const { data: tarifs, isLoading } = useTarifs();
  const { data: cycles } = useCycles();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [categorie, setCategorie] = useState('');
  const [montant, setMontant] = useState(0);
  const [cycleId, setCycleId] = useState('');
  const [filterCat, setFilterCat] = useState('');

  const filtered = tarifs?.filter((t: any) => !filterCat || t.categorie === filterCat) ?? [];

  const reset = () => { setEditId(null); setLabel(''); setCategorie(''); setMontant(0); setCycleId(''); setOpen(false); };

  const save = useMutation({
    mutationFn: async () => {
      if (!label || !categorie) throw new Error('Champs requis');
      const payload = {
        label,
        categorie,
        montant,
        cycle_id: categorie === 'scolarite' ? (cycleId || null) : null,
        zone_transport: null,
      };
      if (editId) {
        const { error } = await supabase.from('tarifs').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tarifs').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tarifs'] }); toast.success('Tarif enregistré'); reset(); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tarifs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tarifs'] }); toast.success('Tarif supprimé'); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (t: any) => {
    setEditId(t.id); setLabel(t.label); setCategorie(t.categorie); setMontant(t.montant); setCycleId(t.cycle_id ?? ''); setOpen(true);
  };

  const getCycleName = (cId: string | null) => {
    if (!cId || !cycles) return '—';
    const c = cycles.find((cy: any) => cy.id === cId);
    return c ? c.nom : '—';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> Tarifs</CardTitle>
        <div className="flex gap-2 items-center">
          <Select value={filterCat || '__all__'} onValueChange={(v) => setFilterCat(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Toutes catégories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Toutes catégories</SelectItem>
              {TARIF_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => { reset(); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Libellé</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Cycle</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Chargement…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Aucun tarif</TableCell></TableRow>
            ) : filtered.map((t: any) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.label}</TableCell>
                <TableCell className="capitalize">{t.categorie}</TableCell>
                <TableCell>{getCycleName(t.cycle_id)}</TableCell>
                <TableCell>{Number(t.montant).toLocaleString()} GNF</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Modifier' : 'Ajouter'} un tarif</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Catégorie</Label>
              <Select value={categorie} onValueChange={setCategorie}>
                <SelectTrigger><SelectValue placeholder="Choisir une catégorie" /></SelectTrigger>
                <SelectContent>
                  {TARIF_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Libellé</Label><Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex: Frais d'inscription" /></div>
            {categorie === 'scolarite' && (
              <div><Label>Cycle</Label>
                <Select value={cycleId || '__none__'} onValueChange={(v) => setCycleId(v === '__none__' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Tous les cycles" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Tous les cycles</SelectItem>
                    {cycles?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Montant (GNF)</Label><Input type="number" value={montant} onChange={e => setMontant(Number(e.target.value))} min={0} /></div>
          </div>
          <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Tab: Périodes ────────────────────────────────────────
function PeriodesTab() {
  const qc = useQueryClient();
  const { data: periodes, isLoading } = usePeriodes();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [ordre, setOrdre] = useState(1);
  const [anneeScolaire, setAnneeScolaire] = useState('2025-2026');
  const [estRattrapage, setEstRattrapage] = useState(false);

  const reset = () => { setEditId(null); setNom(''); setOrdre(1); setAnneeScolaire('2025-2026'); setEstRattrapage(false); setOpen(false); };

  const save = useMutation({
    mutationFn: async () => {
      if (!nom) throw new Error('Le nom est requis');
      const payload = { nom, ordre, annee_scolaire: anneeScolaire, est_rattrapage: estRattrapage };
      if (editId) {
        const { error } = await supabase.from('periodes').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('periodes').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['periodes'] }); toast.success('Période enregistrée'); reset(); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('periodes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['periodes'] }); toast.success('Période supprimée'); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (p: any) => {
    setEditId(p.id); setNom(p.nom); setOrdre(p.ordre); setAnneeScolaire(p.annee_scolaire); setEstRattrapage(p.est_rattrapage ?? false); setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Périodes scolaires</CardTitle>
        <Button size="sm" onClick={() => { reset(); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Année scolaire</TableHead>
              <TableHead>Ordre</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Chargement…</TableCell></TableRow>
            ) : periodes?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Aucune période</TableCell></TableRow>
            ) : periodes?.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.nom}</TableCell>
                <TableCell>{p.annee_scolaire}</TableCell>
                <TableCell>{p.ordre}</TableCell>
                <TableCell>
                  {p.est_rattrapage ? (
                    <Badge variant="secondary">Rattrapage</Badge>
                  ) : (
                    <Badge variant="default">Évaluation</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Modifier' : 'Ajouter'} une période</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom</Label><Input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex: Semestre 1, Trimestre 2" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Année scolaire</Label><Input value={anneeScolaire} onChange={e => setAnneeScolaire(e.target.value)} placeholder="2025-2026" /></div>
              <div><Label>Ordre</Label><Input type="number" value={ordre} onChange={e => setOrdre(Number(e.target.value))} min={1} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={estRattrapage} onCheckedChange={(v) => setEstRattrapage(!!v)} />
              <Label>Période de rattrapage</Label>
            </div>
          </div>
          <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Tab: Zones Transport ────────────────────────────────
function ZonesTransportTab() {
  const qc = useQueryClient();
  const { data: zones, isLoading } = useZonesTransport();
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones_transport'] }); toast.success('Zone enregistrée'); reset(); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('zones_transport' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['zones_transport'] }); toast.success('Zone supprimée'); },
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
        <CardTitle className="flex items-center gap-2"><Bus className="h-5 w-5" /> Zones de Transport</CardTitle>
        <Button size="sm" onClick={() => { reset(); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom de la zone</TableHead>
              <TableHead>Prix mensuel</TableHead>
              <TableHead>Chauffeur / Bus</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Quartiers couverts</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Chargement…</TableCell></TableRow>
            ) : (zones?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Aucune zone configurée</TableCell></TableRow>
            ) : zones?.map((z: any) => (
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
              <Input value={quartiersInput} onChange={e => setQuartiersInput(e.target.value)} placeholder="Ex: Quartier A, Quartier B, Quartier C" />
              <p className="text-xs text-muted-foreground mt-1">Ces quartiers servent à suggérer automatiquement la zone en fonction de l'adresse de l'élève.</p>
            </div>
          </div>
          <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Tab: Corbeille ──────────────────────────────────────
function CorbeilleTab() {
  const qc = useQueryClient();
  const { data: deleted = [], isLoading } = useQuery({
    queryKey: ['eleves-corbeille'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('*, classes(nom)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('eleves').update({ deleted_at: null } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eleves-corbeille'] });
      qc.invalidateQueries({ queryKey: ['eleves'] });
      toast.success('Élève restauré avec succès');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePermanently = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('eleves').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eleves-corbeille'] });
      toast.success('Élève supprimé définitivement');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Archive className="h-5 w-5" /> Corbeille ({deleted.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Matricule</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Prénom</TableHead>
              <TableHead>Classe</TableHead>
              <TableHead>Supprimé le</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Chargement…</TableCell></TableRow>
            ) : deleted.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">La corbeille est vide</TableCell></TableRow>
            ) : deleted.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-xs">{e.matricule || '—'}</TableCell>
                <TableCell className="font-medium">{e.nom}</TableCell>
                <TableCell>{e.prenom}</TableCell>
                <TableCell>{e.classes?.nom || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(e.deleted_at).toLocaleDateString('fr-FR')}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => restore.mutate(e.id)} title="Restaurer">
                      <RotateCcw className="h-4 w-4 mr-1" /> Restaurer
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" title="Supprimer définitivement">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Suppression définitive</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action est irréversible. L'élève {e.prenom} {e.nom} sera supprimé définitivement de la base de données.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deletePermanently.mutate(e.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer définitivement</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Tab: Tranches de Paiement (par niveau) ─────────────────
const TOUS_LES_MOIS = ['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'];

type TrancheConfig = { label: string; mois: string[]; montant: number };
type TranchesParNiveau = Record<string, TrancheConfig[]>;

function TranchesTab() {
  const qc = useQueryClient();
  const { data: niveaux } = useNiveaux();
  const { data: parametres } = useQuery({
    queryKey: ['parametres-tranches-v2'],
    queryFn: async () => {
      const { data, error } = await supabase.from('parametres').select('*').eq('cle', 'tranches_paiement_v2').maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [selectedNiveauId, setSelectedNiveauId] = useState('');
  const [tranches, setTranches] = useState<TrancheConfig[]>([]);
  const [allTranches, setAllTranches] = useState<TranchesParNiveau>({});
  const [loaded, setLoaded] = useState(false);

  // Load from DB
  if (parametres && !loaded) {
    try {
      const val = parametres.valeur as any;
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        setAllTranches(val);
      }
    } catch {}
    setLoaded(true);
  }

  // When selecting a niveau, load its tranches
  const handleSelectNiveau = (nId: string) => {
    // Save current before switching
    if (selectedNiveauId && tranches.length > 0) {
      setAllTranches(prev => ({ ...prev, [selectedNiveauId]: tranches }));
    }
    setSelectedNiveauId(nId);
    setTranches(allTranches[nId] || [{ label: 'Tranche 1', mois: [], montant: 0 }]);
  };

  const selectedNiveau = niveaux?.find((n: any) => n.id === selectedNiveauId);
  const fraisAnnuels = selectedNiveau ? Number(selectedNiveau.frais_scolarite) : 0;
  const totalTranches = tranches.reduce((s, t) => s + t.montant, 0);
  const ecart = fraisAnnuels - totalTranches;

  const addTranche = () => {
    setTranches([...tranches, { label: `Tranche ${tranches.length + 1}`, mois: [], montant: 0 }]);
  };

  const removeTranche = (idx: number) => {
    setTranches(tranches.filter((_, i) => i !== idx));
  };

  const updateLabel = (idx: number, val: string) => {
    const next = [...tranches];
    next[idx] = { ...next[idx], label: val };
    setTranches(next);
  };

  const updateMontant = (idx: number, val: number) => {
    const next = [...tranches];
    next[idx] = { ...next[idx], montant: val };
    setTranches(next);
  };

  const toggleMois = (idx: number, mois: string) => {
    const next = [...tranches];
    const current = next[idx].mois;
    next[idx] = { ...next[idx], mois: current.includes(mois) ? current.filter(m => m !== mois) : [...current, mois] };
    setTranches(next);
  };

  const moisUsedBy = (idx: number) => {
    return tranches.flatMap((t, i) => i === idx ? [] : t.mois);
  };

  // Copy config from another niveau
  const [copyFromId, setCopyFromId] = useState('');
  const handleCopyFrom = () => {
    if (copyFromId && allTranches[copyFromId]) {
      setTranches(JSON.parse(JSON.stringify(allTranches[copyFromId])));
      setCopyFromId('');
      toast.success('Configuration copiée');
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!selectedNiveauId) throw new Error('Sélectionnez un niveau');
      // Validate months
      const allAssigned = tranches.flatMap(t => t.mois);
      const duplicates = allAssigned.filter((m, i) => allAssigned.indexOf(m) !== i);
      if (duplicates.length > 0) throw new Error(`Mois en doublon: ${[...new Set(duplicates)].join(', ')}`);
      if (tranches.some(t => t.mois.length === 0)) throw new Error('Chaque tranche doit avoir au moins un mois');
      if (tranches.some(t => !t.label.trim())) throw new Error('Chaque tranche doit avoir un nom');

      // Warn if total doesn't match (but don't block)
      const finalData = { ...allTranches, [selectedNiveauId]: tranches };

      if (parametres?.id) {
        const { error } = await supabase.from('parametres').update({ valeur: finalData as any, updated_at: new Date().toISOString() }).eq('id', parametres.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('parametres').insert({ cle: 'tranches_paiement_v2', valeur: finalData as any });
        if (error) throw error;
      }
      setAllTranches(finalData);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parametres-tranches-v2'] });
      if (ecart !== 0) {
        toast.success('Tranches enregistrées', { description: `⚠️ Écart de ${Math.abs(ecart).toLocaleString()} GNF avec les frais annuels` });
      } else {
        toast.success('Tranches enregistrées — Total conforme ✓');
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Configured niveaux count
  const configuredNiveaux = Object.keys(allTranches).filter(k => allTranches[k]?.length > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> Tranches de Paiement par Niveau</CardTitle>
        {selectedNiveauId && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={addTranche}><Plus className="h-4 w-4 mr-1" /> Ajouter une tranche</Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Configurez les tranches de paiement pour chaque niveau. Assignez les mois et saisissez le montant de chaque tranche.
        </p>

        {/* Niveau selector */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Label>Sélectionnez un niveau</Label>
            <Select value={selectedNiveauId || '__none__'} onValueChange={v => v !== '__none__' && handleSelectNiveau(v)}>
              <SelectTrigger><SelectValue placeholder="Choisir un niveau" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" disabled>Choisir un niveau</SelectItem>
                {niveaux?.map((n: any) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.nom} ({n.cycles?.nom}) — {Number(n.frais_scolarite).toLocaleString()} GNF/an
                    {allTranches[n.id]?.length ? ' ✓' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedNiveauId && configuredNiveaux.filter(id => id !== selectedNiveauId).length > 0 && (
            <div className="flex gap-2 items-end">
              <div>
                <Label className="text-xs">Copier depuis</Label>
                <Select value={copyFromId || '__none__'} onValueChange={v => setCopyFromId(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Copier depuis..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {configuredNiveaux.filter(id => id !== selectedNiveauId).map(id => {
                      const n = niveaux?.find((nv: any) => nv.id === id);
                      return <SelectItem key={id} value={id}>{n?.nom || id}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopyFrom} disabled={!copyFromId}>Copier</Button>
            </div>
          )}
        </div>

        {/* Summary bar */}
        {selectedNiveauId && (
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">Frais annuels</p>
              <p className="font-bold">{fraisAnnuels.toLocaleString()} GNF</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">Total tranches</p>
              <p className="font-bold">{totalTranches.toLocaleString()} GNF</p>
            </div>
            <div className={`rounded-lg p-3 ${ecart === 0 ? 'bg-green-50 dark:bg-green-950' : 'bg-destructive/10'}`}>
              <p className="text-xs text-muted-foreground">Écart</p>
              <p className={`font-bold ${ecart === 0 ? 'text-green-600' : 'text-destructive'}`}>
                {ecart === 0 ? '✓ Conforme' : `${ecart > 0 ? '+' : ''}${ecart.toLocaleString()} GNF`}
              </p>
            </div>
          </div>
        )}

        {/* Tranches list */}
        {selectedNiveauId && tranches.map((t, idx) => {
          const usedElsewhere = moisUsedBy(idx);
          return (
            <Card key={idx} className="border-primary/20">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Label>Nom de la tranche</Label>
                    <Input value={t.label} onChange={e => updateLabel(idx, e.target.value)} />
                  </div>
                  <div className="w-48">
                    <Label>Montant (GNF)</Label>
                    <Input type="number" value={t.montant} onChange={e => updateMontant(idx, Number(e.target.value))} min={0} />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeTranche(idx)} className="mt-5">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div>
                  <Label>Mois inclus</Label>
                  <div className="grid grid-cols-5 gap-1.5 mt-1">
                    {TOUS_LES_MOIS.map(m => {
                      const isSelected = t.mois.includes(m);
                      const isUsed = usedElsewhere.includes(m);
                      return (
                        <label key={m} className={`flex items-center gap-1.5 text-xs rounded px-2 py-1.5 cursor-pointer select-none ${isUsed ? 'bg-muted/50 text-muted-foreground/50 cursor-not-allowed' : isSelected ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-muted text-muted-foreground'}`}>
                          <Checkbox checked={isSelected} disabled={isUsed} onCheckedChange={() => !isUsed && toggleMois(idx, m)} className="h-3.5 w-3.5" />
                          {m}{isUsed ? ' ✓' : ''}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t.mois.length} mois sélectionné(s)</span>
                  <span className="font-medium">{t.montant.toLocaleString()} GNF</span>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {!selectedNiveauId && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Sélectionnez un niveau pour configurer ses tranches de paiement.</p>
            {configuredNiveaux.length > 0 && (
              <p className="mt-2 text-xs">{configuredNiveaux.length} niveau(x) déjà configuré(s)</p>
            )}
          </div>
        )}

        {/* Configured niveaux summary */}
        {configuredNiveaux.length > 0 && (
          <div className="mt-6">
            <Label className="text-sm font-semibold">Niveaux configurés</Label>
            <div className="flex gap-2 flex-wrap mt-2">
              {configuredNiveaux.map(id => {
                const n = niveaux?.find((nv: any) => nv.id === id);
                const trCount = allTranches[id]?.length || 0;
                const trTotal = (allTranches[id] || []).reduce((s: number, t: TrancheConfig) => s + t.montant, 0);
                const annuel = n ? Number(n.frais_scolarite) : 0;
                const ok = trTotal === annuel;
                return (
                  <Badge key={id} variant={ok ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => handleSelectNiveau(id)}>
                    {n?.nom || id} — {trCount} tranche(s) {ok ? '✓' : `(${trTotal.toLocaleString()}/${annuel.toLocaleString()})`}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Tab: École (Config) ─────────────────────────────────
function EcoleTab() {
  const qc = useQueryClient();
  const [nom, setNom] = useState('Ecole Internationale Les Enfants du Futur');
  const [soustitre, setSoustitre] = useState('Enseignement Général et Technique');
  const [ville, setVille] = useState('Conakry, Guinée');
  const [logoUrl, setLogoUrl] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: config } = useQuery({
    queryKey: ['school-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('parametres').select('*').eq('cle', 'school_config').maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (config && !loaded) {
      const val = (config.valeur || {}) as Record<string, string>;
      if (val?.nom) setNom(val.nom);
      if (val?.soustitre) setSoustitre(val.soustitre);
      if (val?.ville) setVille(val.ville);
      if (val?.logo_url) setLogoUrl(val.logo_url);
      setLoaded(true);
    }
  }, [config, loaded]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `school-logo.${ext}`;
      const { error: uploadError } = await supabase.storage.from('photos').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path);
      setLogoUrl(urlData.publicUrl + '?t=' + Date.now());
      toast.success('Logo téléversé avec succès');
    } catch (err: any) {
      toast.error('Erreur upload: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const valeur = { nom, soustitre, ville, logo_url: logoUrl || null };
      if (config?.id) {
        const { error } = await supabase.from('parametres').update({ valeur: valeur as any }).eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('parametres').insert({ cle: 'school_config', valeur: valeur as any });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school-config'] });
      toast.success('Configuration de l\'école enregistrée');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><School className="h-5 w-5" /> Informations de l'établissement</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Ces informations apparaissent sur les bulletins, reçus et documents officiels.</p>
        
        {/* Logo section */}
        <div className="flex items-center gap-6 p-4 rounded-lg border bg-muted/30">
          <div className="flex-shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo école" className="h-20 w-20 rounded-full object-cover border-2 border-primary/30 shadow" />
            ) : (
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
                <School className="h-8 w-8 text-muted-foreground/50" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Logo de l'établissement</Label>
            <p className="text-xs text-muted-foreground">Ce logo apparaîtra sur tous les reçus et documents imprimés.</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild disabled={uploading}>
                <label className="cursor-pointer">
                  {uploading ? 'Téléversement…' : '📷 Téléverser un logo'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </label>
              </Button>
              {logoUrl && (
                <Button variant="ghost" size="sm" onClick={() => setLogoUrl('')} className="text-destructive">
                  Supprimer
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Nom de l'établissement</Label>
            <Input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex: Ecole Internationale Les Enfants du Futur" />
          </div>
          <div>
            <Label>Sous-titre</Label>
            <Input value={soustitre} onChange={e => setSoustitre(e.target.value)} placeholder="Ex: Enseignement Général et Technique" />
          </div>
          <div>
            <Label>Ville / Pays</Label>
            <Input value={ville} onChange={e => setVille(e.target.value)} placeholder="Ex: Conakry, Guinée" />
          </div>
          <div>
            <Label>URL du logo (alternative)</Label>
            <Input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." className="text-xs" />
          </div>
        </div>

        {/* Preview */}
        {nom && (
          <div className="p-4 rounded-lg border bg-background text-center space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Aperçu en-tête reçu</p>
            {logoUrl && <img src={logoUrl} alt="Logo" className="h-10 mx-auto object-contain" />}
            <p className="font-bold text-primary">{nom}</p>
            {soustitre && <p className="text-xs text-muted-foreground italic">{soustitre}</p>}
            {ville && <p className="text-xs text-muted-foreground">{ville}</p>}
          </div>
        )}

        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────
export default function Configuration() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <Settings className="h-7 w-7 text-primary" /> Configuration
      </h1>
      <Tabs defaultValue="ecole">
        <TabsList className="flex-wrap">
          <TabsTrigger value="ecole">🏫 École</TabsTrigger>
          <TabsTrigger value="cycles">Cycles & Barèmes</TabsTrigger>
          <TabsTrigger value="niveaux">Niveaux</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="matieres">Matières</TabsTrigger>
          <TabsTrigger value="periodes">Périodes</TabsTrigger>
          <TabsTrigger value="tranches">💳 Tranches</TabsTrigger>
          <TabsTrigger value="transport">Transport</TabsTrigger>
          <TabsTrigger value="corbeille">🗑️ Corbeille</TabsTrigger>
        </TabsList>
        <TabsContent value="ecole"><EcoleTab /></TabsContent>
        <TabsContent value="cycles"><CyclesTab /></TabsContent>
        <TabsContent value="niveaux"><NiveauxTab /></TabsContent>
        <TabsContent value="classes"><ClassesTab /></TabsContent>
        <TabsContent value="matieres"><MatieresTab /></TabsContent>
        <TabsContent value="periodes"><PeriodesTab /></TabsContent>
        <TabsContent value="tranches"><TranchesTab /></TabsContent>
        <TabsContent value="transport"><ZonesTransportTab /></TabsContent>
        <TabsContent value="corbeille"><CorbeilleTab /></TabsContent>
      </Tabs>
    </div>
  );
}
