import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Package, Search, Plus, Pencil, Trash2, AlertTriangle, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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

function useArticles(categorie?: string) {
  return useQuery({
    queryKey: ['articles-librairie', categorie],
    queryFn: async () => {
      let q = supabase.from('articles' as any).select('*, niveaux:niveau_id(nom, cycles(nom))').order('nom');
      if (categorie) q = q.eq('categorie', categorie);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });
}

function useVentes() {
  return useQuery({
    queryKey: ['ventes-librairie'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ventes_articles' as any)
        .select('*, articles:article_id(nom, categorie), eleves:eleve_id(nom, prenom, matricule)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as any[];
    },
  });
}

function ArticleManager({ categorie, label, icon: Icon }: { categorie: string; label: string; icon: any }) {
  const qc = useQueryClient();
  const { data: niveaux } = useNiveaux();
  const { data: articles = [], isLoading } = useArticles(categorie);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [prix, setPrix] = useState(0);
  const [stock, setStock] = useState(0);
  const [niveauId, setNiveauId] = useState('');

  const reset = () => { setEditId(null); setNom(''); setPrix(0); setStock(0); setNiveauId(''); setOpen(false); };

  const filtered = articles.filter((a: any) =>
    `${a.nom} ${a.niveaux?.nom || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const stockBas = articles.filter((a: any) => a.stock < 10).length;
  const stockEpuise = articles.filter((a: any) => a.stock <= 0).length;
  const valeurStock = articles.reduce((s: number, a: any) => s + Number(a.prix) * a.stock, 0);

  const save = useMutation({
    mutationFn: async () => {
      if (!nom) throw new Error('Le nom est requis');
      const payload = { nom, categorie, prix, stock, niveau_id: niveauId || null };
      if (editId) {
        const { error } = await supabase.from('articles' as any).update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('articles' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['articles-librairie', categorie] }); toast.success(`${label} enregistré`); reset(); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('articles' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['articles-librairie', categorie] }); toast.success(`${label} supprimé`); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (a: any) => {
    setEditId(a.id); setNom(a.nom); setPrix(Number(a.prix)); setStock(a.stock); setNiveauId(a.niveau_id ?? ''); setOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Icon className="h-8 w-8 text-primary" />
            <div><p className="text-sm text-muted-foreground">Total articles</p><p className="text-xl font-bold">{articles.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Package className="h-8 w-8 text-accent" />
            <div><p className="text-sm text-muted-foreground">Valeur du stock</p><p className="text-xl font-bold">{valeurStock.toLocaleString()} <span className="text-sm font-normal">GNF</span></p></div>
          </CardContent>
        </Card>
        <Card className={stockBas > 0 ? 'border-warning/40' : ''}>
          <CardContent className="pt-4 flex items-center gap-3">
            <AlertTriangle className={`h-8 w-8 ${stockBas > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
            <div><p className="text-sm text-muted-foreground">Stock bas (&lt;10)</p><p className="text-xl font-bold text-warning">{stockBas}</p></div>
          </CardContent>
        </Card>
        <Card className={stockEpuise > 0 ? 'border-destructive/40' : ''}>
          <CardContent className="pt-4 flex items-center gap-3">
            <AlertTriangle className={`h-8 w-8 ${stockEpuise > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            <div><p className="text-sm text-muted-foreground">Épuisé</p><p className="text-xl font-bold text-destructive">{stockEpuise}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Add */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={`Rechercher un ${label.toLowerCase()}…`} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => { reset(); setOpen(true); }}><Plus className="h-4 w-4 mr-2" /> Ajouter</Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Prix unitaire</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Valeur</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Chargement…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun article</TableCell></TableRow>
              ) : filtered.map((a: any) => (
                <TableRow key={a.id} className={a.stock < 10 ? 'bg-destructive/5' : ''}>
                  <TableCell className="font-medium">{a.nom}</TableCell>
                  <TableCell>{a.niveaux?.nom ? `${a.niveaux.cycles?.nom} — ${a.niveaux.nom}` : <span className="text-muted-foreground text-xs">Tous</span>}</TableCell>
                  <TableCell>{Number(a.prix).toLocaleString()} GNF</TableCell>
                  <TableCell>
                    <Badge variant={a.stock <= 0 ? 'destructive' : a.stock < 10 ? 'secondary' : 'default'}>
                      {a.stock <= 0 ? '⚠️ Épuisé' : a.stock < 10 ? `⚠️ ${a.stock}` : a.stock}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{(Number(a.prix) * a.stock).toLocaleString()} GNF</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(a.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Modifier' : 'Ajouter'} — {label}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom *</Label><Input value={nom} onChange={e => setNom(e.target.value)} placeholder={`Nom de l'article`} /></div>
            <div><Label>Niveau scolaire (optionnel)</Label>
              <Select value={niveauId || '__all__'} onValueChange={(v) => setNiveauId(v === '__all__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Tous les niveaux" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous les niveaux</SelectItem>
                  {niveaux?.map((n: any) => <SelectItem key={n.id} value={n.id}>{n.nom} ({n.cycles?.nom})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prix unitaire (GNF)</Label><Input type="number" value={prix} onChange={e => setPrix(Number(e.target.value))} min={0} /></div>
              <div><Label>Stock initial</Label><Input type="number" value={stock} onChange={e => setStock(Number(e.target.value))} min={0} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Librairie() {
  const { data: ventes = [] } = useVentes();
  const { data: allArticles = [] } = useArticles();

  const totalArticles = allArticles.length;
  const totalValeur = allArticles.reduce((s: number, a: any) => s + Number(a.prix) * a.stock, 0);
  const totalVentes = ventes.reduce((s: number, v: any) => s + Number(v.prix_unitaire) * v.quantite, 0);
  const alertes = allArticles.filter((a: any) => a.stock < 10).length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <BookOpen className="h-7 w-7 text-primary" /> Librairie & Inventaire
      </h1>

      {/* Global stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            <div><p className="text-sm text-muted-foreground">Articles en stock</p><p className="text-2xl font-bold">{totalArticles}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Tag className="h-8 w-8 text-accent" />
            <div><p className="text-sm text-muted-foreground">Valeur totale du stock</p><p className="text-2xl font-bold">{totalValeur.toLocaleString()} <span className="text-sm font-normal">GNF</span></p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            <div><p className="text-sm text-muted-foreground">CA Ventes Librairie</p><p className="text-2xl font-bold">{totalVentes.toLocaleString()} <span className="text-sm font-normal">GNF</span></p></div>
          </CardContent>
        </Card>
        <Card className={alertes > 0 ? 'border-warning/40' : ''}>
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className={`h-8 w-8 ${alertes > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
            <div><p className="text-sm text-muted-foreground">Alertes stock</p><p className="text-2xl font-bold text-warning">{alertes}</p></div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="fournitures">
        <TabsList>
          <TabsTrigger value="fournitures">📦 Fournitures</TabsTrigger>
          <TabsTrigger value="manuels">📖 Manuels</TabsTrigger>
          <TabsTrigger value="romans">📚 Romans</TabsTrigger>
          <TabsTrigger value="ventes">🧾 Historique ventes</TabsTrigger>
        </TabsList>

        <TabsContent value="fournitures" className="mt-4">
          <ArticleManager categorie="fourniture" label="Fourniture" icon={Package} />
        </TabsContent>
        <TabsContent value="manuels" className="mt-4">
          <ArticleManager categorie="manuel" label="Manuel" icon={BookOpen} />
        </TabsContent>
        <TabsContent value="romans" className="mt-4">
          <ArticleManager categorie="roman" label="Roman" icon={BookOpen} />
        </TabsContent>

        <TabsContent value="ventes" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Dernières ventes</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead>Article</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Qté</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ventes.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucune vente</TableCell></TableRow>
                  ) : ventes.map((v: any) => (
                    <TableRow key={v.id}>
                      <TableCell className="text-xs">{new Date(v.created_at).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell className="font-medium">{v.eleves?.prenom} {v.eleves?.nom}</TableCell>
                      <TableCell>{v.articles?.nom || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{v.articles?.categorie || '—'}</Badge></TableCell>
                      <TableCell>{v.quantite}</TableCell>
                      <TableCell className="font-mono font-bold">{(Number(v.prix_unitaire) * v.quantite).toLocaleString()} GNF</TableCell>
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
