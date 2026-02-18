import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Plus, Search, Phone, Mail, MapPin, Edit, Trash2, UserPlus, ChevronRight, KeyRound, Copy, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ─── Hooks ───────────────────────────────────────────────
function useFamilles() {
  return useQuery({
    queryKey: ['familles-with-children'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('familles')
        .select('*, eleves(id, nom, prenom, statut, matricule, date_naissance, sexe, classe_id, classes(nom, niveaux:niveau_id(nom, cycles:cycle_id(nom))))')
        .order('nom_famille');
      if (error) throw error;
      return data;
    },
  });
}

function useClassesAll() {
  return useQuery({
    queryKey: ['classes-all-familles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*, niveaux:niveau_id(nom, cycles:cycle_id(nom))')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });
}

export default function Familles() {
  const qc = useQueryClient();
  const { data: familles = [], isLoading } = useFamilles();
  const { data: allClasses = [] } = useClassesAll();
  const [search, setSearch] = useState('');

  // Create/Edit family
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nomFamille, setNomFamille] = useState('');
  const [telPere, setTelPere] = useState('');
  const [telMere, setTelMere] = useState('');
  const [email, setEmail] = useState('');
  const [adresse, setAdresse] = useState('');

  // Detail view
  const [selectedFamille, setSelectedFamille] = useState<any>(null);

  // Add child dialog
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [childNom, setChildNom] = useState('');
  const [childPrenom, setChildPrenom] = useState('');
  const [childSexe, setChildSexe] = useState('');
  const [childDob, setChildDob] = useState('');
  const [childClasseId, setChildClasseId] = useState('');

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const resetForm = () => {
    setNomFamille(''); setTelPere(''); setTelMere(''); setEmail(''); setAdresse(''); setEditId(null);
  };

  const resetChildForm = () => {
    setChildNom(''); setChildPrenom(''); setChildSexe(''); setChildDob(''); setChildClasseId('');
  };

  const openEdit = (f: any) => {
    setEditId(f.id);
    setNomFamille(f.nom_famille);
    setTelPere(f.telephone_pere || '');
    setTelMere(f.telephone_mere || '');
    setEmail(f.email_parent || '');
    setAdresse(f.adresse || '');
    setFormOpen(true);
  };

  const openCreate = () => { resetForm(); setFormOpen(true); };

  // ─── Mutations ─────────────────────────────────────────
  const saveFamille = useMutation({
    mutationFn: async () => {
      if (!nomFamille.trim()) throw new Error('Le nom de famille est obligatoire');
      if (nomFamille.trim().length > 100) throw new Error('Le nom ne doit pas dépasser 100 caractères');
      const payload = {
        nom_famille: nomFamille.trim(),
        telephone_pere: telPere.trim() || null,
        telephone_mere: telMere.trim() || null,
        email_parent: email.trim() || null,
        adresse: adresse.trim() || null,
      };
      if (editId) {
        const { error } = await supabase.from('familles').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('familles').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['familles-with-children'] });
      toast.success(editId ? 'Famille modifiée' : 'Famille créée');
      resetForm(); setFormOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteFamille = useMutation({
    mutationFn: async (id: string) => {
      // Détacher les enfants d'abord
      const { error: detachErr } = await supabase.from('eleves').update({ famille_id: null }).eq('famille_id', id);
      if (detachErr) throw detachErr;
      const { error } = await supabase.from('familles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['familles-with-children'] });
      toast.success('Famille supprimée');
      setDeleteConfirmId(null);
      setSelectedFamille(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addChild = useMutation({
    mutationFn: async () => {
      if (!childNom.trim() || !childPrenom.trim()) throw new Error('Nom et prénom obligatoires');
      if (!selectedFamille) throw new Error('Aucune famille sélectionnée');
      const { error } = await supabase.from('eleves').insert({
        nom: childNom.trim(),
        prenom: childPrenom.trim(),
        sexe: childSexe || null,
        date_naissance: childDob || null,
        classe_id: childClasseId || null,
        famille_id: selectedFamille.id,
        statut: 'inscrit',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['familles-with-children'] });
      toast.success(`${childPrenom} ${childNom} ajouté(e) à la famille`);
      resetChildForm(); setAddChildOpen(false);
      // Refresh selected famille
      setTimeout(() => {
        const updated = qc.getQueryData<any[]>(['familles-with-children']);
        if (updated) {
          const f = updated.find((fam: any) => fam.id === selectedFamille.id);
          if (f) setSelectedFamille(f);
        }
      }, 500);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeChildFromFamily = useMutation({
    mutationFn: async (eleveId: string) => {
      const { error } = await supabase.from('eleves').update({ famille_id: null }).eq('id', eleveId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['familles-with-children'] });
      toast.success('Enfant détaché de la famille');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const generateCode = useMutation({
    mutationFn: async (familleId: string) => {
      const code = 'FAM-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      const { error } = await supabase.from('familles').update({ code_acces: code } as any).eq('id', familleId);
      if (error) throw error;
      return code;
    },
    onSuccess: (code) => {
      qc.invalidateQueries({ queryKey: ['familles-with-children'] });
      toast.success(`Code généré : ${code}`);
      // Update selected famille in place
      if (selectedFamille) {
        setSelectedFamille({ ...selectedFamille, code_acces: code });
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Stats
  const totalFamilles = familles.length;
  const totalEnfants = familles.reduce((s: number, f: any) => s + (f.eleves?.length || 0), 0);
  const famillesMulti = familles.filter((f: any) => (f.eleves?.length || 0) > 1).length;

  const filtered = useMemo(() =>
    familles.filter((f: any) =>
      `${f.nom_famille} ${f.email_parent || ''} ${f.telephone_pere || ''} ${f.telephone_mere || ''} ${f.adresse || ''}`.toLowerCase().includes(search.toLowerCase())
    ), [familles, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-7 w-7 text-primary" /> Familles
        </h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Nouvelle Famille</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total familles</p>
                <p className="text-2xl font-bold">{totalFamilles}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <UserPlus className="h-8 w-8 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">Total enfants inscrits</p>
                <p className="text-2xl font-bold">{totalEnfants}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-secondary" />
              <div>
                <p className="text-sm text-muted-foreground">Familles multi-enfants</p>
                <p className="text-2xl font-bold text-secondary">{famillesMulti}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher une famille…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Family Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <p className="text-muted-foreground col-span-full text-center py-8">Chargement…</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground col-span-full text-center py-8">Aucune famille trouvée</p>
        ) : filtered.map((f: any) => (
          <Card key={f.id} className="cursor-pointer hover:shadow-md transition-shadow group" onClick={() => setSelectedFamille(f)}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{f.nom_famille}</CardTitle>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {f.telephone_pere && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3 w-3" /> Père: {f.telephone_pere}</div>}
              {f.telephone_mere && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3 w-3" /> Mère: {f.telephone_mere}</div>}
              {f.email_parent && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3 w-3" /> {f.email_parent}</div>}
              {f.adresse && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3 w-3" /> {f.adresse}</div>}
              <div className="flex gap-2 pt-1">
                <Badge variant="outline">{f.eleves?.length || 0} enfant(s)</Badge>
                {(f.eleves?.length || 0) > 1 && <Badge variant="secondary">Fratrie</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ─── Create/Edit Family Dialog ─── */}
      <Dialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) resetForm(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Modifier la famille' : 'Créer une famille'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom de famille *</Label><Input value={nomFamille} onChange={e => setNomFamille(e.target.value)} maxLength={100} placeholder="Ex: Dupont" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Téléphone père</Label><Input value={telPere} onChange={e => setTelPere(e.target.value)} placeholder="+237 6XX XX XX XX" /></div>
              <div><Label>Téléphone mère</Label><Input value={telMere} onChange={e => setTelMere(e.target.value)} placeholder="+237 6XX XX XX XX" /></div>
            </div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="parent@email.com" /></div>
            <div><Label>Adresse</Label><Input value={adresse} onChange={e => setAdresse(e.target.value)} placeholder="Quartier, ville" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFormOpen(false); resetForm(); }}>Annuler</Button>
            <Button onClick={() => saveFamille.mutate()} disabled={saveFamille.isPending}>
              {editId ? 'Enregistrer' : 'Créer la famille'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Family Detail Dialog ─── */}
      <Dialog open={!!selectedFamille} onOpenChange={(o) => { if (!o) setSelectedFamille(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Famille {selectedFamille?.nom_famille}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { openEdit(selectedFamille); setSelectedFamille(null); }}>
                  <Edit className="h-3 w-3 mr-1" /> Modifier
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmId(selectedFamille?.id)}>
                  <Trash2 className="h-3 w-3 mr-1" /> Supprimer
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {selectedFamille && (
            <Tabs defaultValue="infos" className="mt-2">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="infos">Informations</TabsTrigger>
                <TabsTrigger value="enfants">Enfants ({selectedFamille.eleves?.length || 0})</TabsTrigger>
              </TabsList>

              <TabsContent value="infos" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Nom de famille</p>
                    <p className="font-medium">{selectedFamille.nom_famille}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedFamille.email_parent || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Téléphone père</p>
                    <p className="font-medium">{selectedFamille.telephone_pere || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Téléphone mère</p>
                    <p className="font-medium">{selectedFamille.telephone_mere || '—'}</p>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <p className="text-sm text-muted-foreground">Adresse</p>
                    <p className="font-medium">{selectedFamille.adresse || '—'}</p>
                  </div>
                  {/* Code d'accès parent */}
                  <div className="space-y-2 col-span-2 border-t pt-4 mt-2">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <KeyRound className="h-3.5 w-3.5" /> Code d'accès Espace Parent
                    </p>
                    <div className="flex items-center gap-2">
                      {selectedFamille.code_acces ? (
                        <>
                          <code className="bg-muted px-3 py-1.5 rounded font-mono text-lg tracking-widest font-bold">
                            {selectedFamille.code_acces}
                          </code>
                          <Button variant="outline" size="sm" onClick={() => {
                            navigator.clipboard.writeText(selectedFamille.code_acces);
                            toast.success('Code copié !');
                          }}>
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => generateCode.mutate(selectedFamille.id)}>
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" onClick={() => generateCode.mutate(selectedFamille.id)}>
                          <KeyRound className="h-4 w-4 mr-1" /> Générer un code
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="enfants" className="mt-4 space-y-4">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => { resetChildForm(); setAddChildOpen(true); }}>
                    <UserPlus className="h-4 w-4 mr-2" /> Ajouter un enfant
                  </Button>
                </div>

                {selectedFamille.eleves?.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Sexe</TableHead>
                        <TableHead>Classe</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedFamille.eleves.map((e: any) => (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.prenom} {e.nom}</TableCell>
                          <TableCell>{e.sexe || '—'}</TableCell>
                          <TableCell>
                            {e.classes ? (
                              <span className="text-sm">{e.classes.niveaux?.cycles?.nom} — {e.classes.niveaux?.nom} — {e.classes.nom}</span>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={e.statut === 'inscrit' ? 'default' : e.statut === 'réinscrit' ? 'secondary' : 'outline'}>
                              {e.statut}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => removeChildFromFamily.mutate(e.id)} title="Détacher de la famille">
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-4">Aucun enfant rattaché à cette famille</p>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Add Child Dialog ─── */}
      <Dialog open={addChildOpen} onOpenChange={(o) => { setAddChildOpen(o); if (!o) resetChildForm(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un enfant à la famille {selectedFamille?.nom_famille}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prénom *</Label><Input value={childPrenom} onChange={e => setChildPrenom(e.target.value)} maxLength={50} placeholder="Prénom" /></div>
              <div><Label>Nom *</Label><Input value={childNom} onChange={e => setChildNom(e.target.value)} maxLength={50} placeholder="Nom" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Sexe</Label>
                <Select value={childSexe} onValueChange={setChildSexe}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculin</SelectItem>
                    <SelectItem value="F">Féminin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Date de naissance</Label><Input type="date" value={childDob} onChange={e => setChildDob(e.target.value)} /></div>
            </div>
            <div>
              <Label>Classe</Label>
              <Select value={childClasseId} onValueChange={setChildClasseId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner la classe" /></SelectTrigger>
                <SelectContent>
                  {allClasses.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.niveaux?.cycles?.nom} — {c.niveaux?.nom} — {c.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddChildOpen(false)}>Annuler</Button>
            <Button onClick={() => addChild.mutate()} disabled={addChild.isPending}>
              <UserPlus className="h-4 w-4 mr-2" /> Ajouter l'enfant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirm Dialog ─── */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmer la suppression</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cette action supprimera la famille et détachera tous les enfants associés. Les enfants ne seront pas supprimés.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && deleteFamille.mutate(deleteConfirmId)} disabled={deleteFamille.isPending}>
              Supprimer la famille
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
