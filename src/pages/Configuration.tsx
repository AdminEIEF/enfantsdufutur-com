import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Plus, Trash2, Pencil, GraduationCap, BookOpen, School } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
      const { data, error } = await supabase.from('matieres').select('*, cycles(nom)').order('nom');
      if (error) throw error;
      return data;
    },
  });
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

  const reset = () => { setEditId(null); setNom(''); setCycleId(''); setOrdre(1); setFrais(0); setOpen(false); };

  const save = useMutation({
    mutationFn: async () => {
      if (!nom || !cycleId) throw new Error('Champs requis');
      const payload = { nom, cycle_id: cycleId, ordre, frais_scolarite: frais };
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
    setEditId(n.id); setNom(n.nom); setCycleId(n.cycle_id); setOrdre(n.ordre); setFrais(n.frais_scolarite); setOpen(true);
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
              <TableHead>Frais scolarité</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Chargement…</TableCell></TableRow>
            ) : niveaux?.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Aucun niveau configuré</TableCell></TableRow>
            ) : niveaux?.map((n: any) => (
              <TableRow key={n.id}>
                <TableCell className="font-medium">{n.nom}</TableCell>
                <TableCell>{n.cycles?.nom}</TableCell>
                <TableCell>{n.ordre}</TableCell>
                <TableCell>{Number(n.frais_scolarite).toLocaleString()} FCFA</TableCell>
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
              <div><Label>Frais scolarité (FCFA)</Label><Input type="number" value={frais} onChange={e => setFrais(Number(e.target.value))} /></div>
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
  const { data: matieres, isLoading } = useMatieres();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [cycleId, setCycleId] = useState('');
  const [coefficient, setCoefficient] = useState(1);
  const [pole, setPole] = useState('');
  const [filterCycle, setFilterCycle] = useState('');

  const filteredMatieres = matieres?.filter((m: any) => !filterCycle || m.cycle_id === filterCycle) ?? [];

  const reset = () => { setEditId(null); setNom(''); setCycleId(''); setCoefficient(1); setPole(''); setOpen(false); };

  const save = useMutation({
    mutationFn: async () => {
      if (!nom || !cycleId) throw new Error('Champs requis');
      const payload = { nom, cycle_id: cycleId, coefficient, pole: pole || null };
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
    setEditId(m.id); setNom(m.nom); setCycleId(m.cycle_id ?? ''); setCoefficient(m.coefficient); setPole(m.pole ?? ''); setOpen(true);
  };

  const poles = ['Langues', 'Sciences', 'Arts', 'Sport', 'Éveil', 'Technique'];

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
              <TableHead>Pôle</TableHead>
              <TableHead>Coefficient</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Chargement…</TableCell></TableRow>
            ) : filteredMatieres.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Aucune matière</TableCell></TableRow>
            ) : filteredMatieres.map((m: any) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.nom}</TableCell>
                <TableCell>{m.cycles?.nom}</TableCell>
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
            <div><Label>Cycle</Label>
              <Select value={cycleId} onValueChange={setCycleId}>
                <SelectTrigger><SelectValue placeholder="Choisir un cycle" /></SelectTrigger>
                <SelectContent>{cycles?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}</SelectContent>
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

// ─── Main Page ───────────────────────────────────────────
export default function Configuration() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <Settings className="h-7 w-7 text-primary" /> Configuration
      </h1>
      <Tabs defaultValue="niveaux">
        <TabsList>
          <TabsTrigger value="niveaux">Niveaux</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="matieres">Matières</TabsTrigger>
        </TabsList>
        <TabsContent value="niveaux"><NiveauxTab /></TabsContent>
        <TabsContent value="classes"><ClassesTab /></TabsContent>
        <TabsContent value="matieres"><MatieresTab /></TabsContent>
      </Tabs>
    </div>
  );
}
