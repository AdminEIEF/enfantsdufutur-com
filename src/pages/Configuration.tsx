import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Plus, Trash2, Pencil, GraduationCap, BookOpen, School, Tag, Calendar, Bus, Ruler } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
                <TableCell>{Number(n.frais_scolarite).toLocaleString()} GNF</TableCell>
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
              <div><Label>Frais scolarité (GNF)</Label><Input type="number" value={frais} onChange={e => setFrais(Number(e.target.value))} /></div>
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
  const [quartiersInput, setQuartiersInput] = useState('');

  const reset = () => { setEditId(null); setNom(''); setPrixMensuel(0); setChauffeurBus(''); setQuartiersInput(''); setOpen(false); };

  const save = useMutation({
    mutationFn: async () => {
      if (!nom) throw new Error('Le nom est requis');
      const quartiers = quartiersInput.split(',').map(q => q.trim()).filter(Boolean);
      const payload = { nom, prix_mensuel: prixMensuel, chauffeur_bus: chauffeurBus || null, quartiers };
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
              <TableHead>Quartiers couverts</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Chargement…</TableCell></TableRow>
            ) : (zones?.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Aucune zone configurée</TableCell></TableRow>
            ) : zones?.map((z: any) => (
              <TableRow key={z.id}>
                <TableCell className="font-medium">{z.nom}</TableCell>
                <TableCell>{Number(z.prix_mensuel).toLocaleString()} GNF</TableCell>
                <TableCell>{z.chauffeur_bus ?? '—'}</TableCell>
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

// ─── Main Page ───────────────────────────────────────────
export default function Configuration() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <Settings className="h-7 w-7 text-primary" /> Configuration
      </h1>
      <Tabs defaultValue="cycles">
        <TabsList className="flex-wrap">
          <TabsTrigger value="cycles">Cycles & Barèmes</TabsTrigger>
          <TabsTrigger value="niveaux">Niveaux</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="matieres">Matières</TabsTrigger>
          <TabsTrigger value="periodes">Périodes</TabsTrigger>
          <TabsTrigger value="tarifs">Tarifs</TabsTrigger>
          <TabsTrigger value="transport">Transport</TabsTrigger>
        </TabsList>
        <TabsContent value="cycles"><CyclesTab /></TabsContent>
        <TabsContent value="niveaux"><NiveauxTab /></TabsContent>
        <TabsContent value="classes"><ClassesTab /></TabsContent>
        <TabsContent value="matieres"><MatieresTab /></TabsContent>
        <TabsContent value="periodes"><PeriodesTab /></TabsContent>
        <TabsContent value="tarifs"><TarifsTab /></TabsContent>
        <TabsContent value="transport"><ZonesTransportTab /></TabsContent>
      </Tabs>
    </div>
  );
}
