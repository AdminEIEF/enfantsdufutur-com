import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Video, FileText, Plus, Eye, EyeOff, Trash2, BookOpen, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

export default function CoursAdmin() {
  const [tab, setTab] = useState('cours');
  const [filterClasse, setFilterClasse] = useState('all');
  const [search, setSearch] = useState('');
  const [openCours, setOpenCours] = useState(false);
  const [openDevoir, setOpenDevoir] = useState(false);
  const qc = useQueryClient();

  // Form states - Cours
  const [cTitre, setCTitre] = useState('');
  const [cDescription, setCDescription] = useState('');
  const [cMatiereId, setCMatiereId] = useState('');
  const [cClasseId, setCClasseId] = useState('');
  const [cTypeContenu, setCTypeContenu] = useState('pdf');
  const [cUrl, setCUrl] = useState('');

  // Form states - Devoir
  const [dTitre, setDTitre] = useState('');
  const [dDescription, setDDescription] = useState('');
  const [dMatiereId, setDMatiereId] = useState('');
  const [dClasseId, setDClasseId] = useState('');
  const [dDateLimite, setDDateLimite] = useState('');
  const [dNoteMax, setDNoteMax] = useState('20');

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*, niveaux:niveau_id(nom, cycle_id, cycles:cycle_id(nom))').order('nom');
      if (error) throw error;
      return data;
    },
  });

  const { data: matieres = [] } = useQuery({
    queryKey: ['matieres'],
    queryFn: async () => {
      const { data, error } = await supabase.from('matieres').select('*').order('nom');
      if (error) throw error;
      return data;
    },
  });

  const { data: cours = [], isLoading: loadingCours } = useQuery({
    queryKey: ['admin-cours'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cours').select('*, matieres:matiere_id(nom), classes:classe_id(nom)').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: devoirs = [], isLoading: loadingDevoirs } = useQuery({
    queryKey: ['admin-devoirs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('devoirs').select('*, matieres:matiere_id(nom), classes:classe_id(nom)').order('date_limite', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const toggleVisibility = useMutation({
    mutationFn: async ({ id, visible }: { id: string; visible: boolean }) => {
      const { error } = await supabase.from('cours').update({ visible } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-cours'] });
      toast({ title: 'Visibilité mise à jour' });
    },
  });

  const createCours = useMutation({
    mutationFn: async () => {
      if (!cTitre.trim() || !cMatiereId || !cClasseId || !cUrl.trim()) throw new Error('Champs obligatoires manquants');
      const { error } = await supabase.from('cours').insert({
        titre: cTitre.trim(),
        description: cDescription.trim() || null,
        matiere_id: cMatiereId,
        classe_id: cClasseId,
        type_contenu: cTypeContenu,
        contenu_url: cUrl.trim(),
        visible: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-cours'] });
      toast({ title: 'Cours ajouté' });
      setOpenCours(false);
      setCTitre(''); setCDescription(''); setCMatiereId(''); setCClasseId(''); setCUrl(''); setCTypeContenu('pdf');
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const createDevoir = useMutation({
    mutationFn: async () => {
      if (!dTitre.trim() || !dMatiereId || !dClasseId || !dDateLimite) throw new Error('Champs obligatoires manquants');
      const { error } = await supabase.from('devoirs').insert({
        titre: dTitre.trim(),
        description: dDescription.trim() || null,
        matiere_id: dMatiereId,
        classe_id: dClasseId,
        date_limite: dDateLimite,
        note_max: Number(dNoteMax) || 20,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-devoirs'] });
      toast({ title: 'Devoir ajouté' });
      setOpenDevoir(false);
      setDTitre(''); setDDescription(''); setDMatiereId(''); setDClasseId(''); setDDateLimite(''); setDNoteMax('20');
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const deleteCours = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cours').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-cours'] });
      toast({ title: 'Cours supprimé' });
    },
  });

  const deleteDevoir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('devoirs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-devoirs'] });
      toast({ title: 'Devoir supprimé' });
    },
  });

  const filteredCours = cours.filter((c: any) => {
    const matchClasse = filterClasse === 'all' || c.classe_id === filterClasse;
    const matchSearch = !search || c.titre.toLowerCase().includes(search.toLowerCase());
    return matchClasse && matchSearch;
  });

  const filteredDevoirs = devoirs.filter((d: any) => {
    const matchClasse = filterClasse === 'all' || d.classe_id === filterClasse;
    const matchSearch = !search || d.titre.toLowerCase().includes(search.toLowerCase());
    return matchClasse && matchSearch;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <BookOpen className="h-7 w-7 text-primary" /> Cours & Devoirs
      </h1>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterClasse} onValueChange={setFilterClasse}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Classe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="cours">Cours ({filteredCours.length})</TabsTrigger>
          <TabsTrigger value="devoirs">Devoirs ({filteredDevoirs.length})</TabsTrigger>
        </TabsList>

        {/* COURS TAB */}
        <TabsContent value="cours" className="space-y-4 mt-3">
          <div className="flex justify-end">
            <Dialog open={openCours} onOpenChange={setOpenCours}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Ajouter un cours</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nouveau cours</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Titre *</Label><Input value={cTitre} onChange={e => setCTitre(e.target.value)} /></div>
                  <div><Label>Description</Label><Input value={cDescription} onChange={e => setCDescription(e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Classe *</Label>
                      <Select value={cClasseId} onValueChange={setCClasseId}>
                        <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                        <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Matière *</Label>
                      <Select value={cMatiereId} onValueChange={setCMatiereId}>
                        <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                        <SelectContent>{matieres.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.nom}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Type de contenu</Label>
                    <Select value={cTypeContenu} onValueChange={setCTypeContenu}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="video">Vidéo (YouTube/Vimeo/MP4)</SelectItem>
                        <SelectItem value="lien">Lien externe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>URL du contenu *</Label><Input value={cUrl} onChange={e => setCUrl(e.target.value)} placeholder={cTypeContenu === 'video' ? 'https://youtube.com/watch?v=...' : 'https://...'} /></div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenCours(false)}>Annuler</Button>
                  <Button onClick={() => createCours.mutate()} disabled={createCours.isPending}>
                    {createCours.isPending ? 'Ajout...' : 'Ajouter'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titre</TableHead>
                    <TableHead>Matière</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Visible</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingCours ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : filteredCours.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun cours</TableCell></TableRow>
                  ) : filteredCours.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.titre}</TableCell>
                      <TableCell>{(c.matieres as any)?.nom || '—'}</TableCell>
                      <TableCell>{(c.classes as any)?.nom || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          {c.type_contenu === 'video' ? <Video className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                          {c.type_contenu}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={c.visible !== false}
                          onCheckedChange={(checked) => toggleVisibility.mutate({ id: c.id, visible: checked })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteCours.mutate(c.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DEVOIRS TAB */}
        <TabsContent value="devoirs" className="space-y-4 mt-3">
          <div className="flex justify-end">
            <Dialog open={openDevoir} onOpenChange={setOpenDevoir}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Ajouter un devoir</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nouveau devoir</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Titre *</Label><Input value={dTitre} onChange={e => setDTitre(e.target.value)} /></div>
                  <div><Label>Description</Label><Input value={dDescription} onChange={e => setDDescription(e.target.value)} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Classe *</Label>
                      <Select value={dClasseId} onValueChange={setDClasseId}>
                        <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                        <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Matière *</Label>
                      <Select value={dMatiereId} onValueChange={setDMatiereId}>
                        <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                        <SelectContent>{matieres.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.nom}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Date limite *</Label><Input type="datetime-local" value={dDateLimite} onChange={e => setDDateLimite(e.target.value)} /></div>
                    <div><Label>Note max</Label><Input type="number" value={dNoteMax} onChange={e => setDNoteMax(e.target.value)} /></div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenDevoir(false)}>Annuler</Button>
                  <Button onClick={() => createDevoir.mutate()} disabled={createDevoir.isPending}>
                    {createDevoir.isPending ? 'Ajout...' : 'Ajouter'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titre</TableHead>
                    <TableHead>Matière</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Date limite</TableHead>
                    <TableHead>Note max</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingDevoirs ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : filteredDevoirs.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun devoir</TableCell></TableRow>
                  ) : filteredDevoirs.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.titre}</TableCell>
                      <TableCell>{(d.matieres as any)?.nom || '—'}</TableCell>
                      <TableCell>{(d.classes as any)?.nom || '—'}</TableCell>
                      <TableCell>{new Date(d.date_limite).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell>{d.note_max}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteDevoir.mutate(d.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
