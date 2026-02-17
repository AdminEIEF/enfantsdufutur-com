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
import { Checkbox } from '@/components/ui/checkbox';
import { BookOpen, Package, Search, Plus, Pencil, Trash2, AlertTriangle, Tag, ShoppingCart, Printer, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { generateRecuLibrairiePDF, generateBonSortiePDF } from '@/lib/generateRecuLibrairiePDF';

// ─── Hooks ────────────────────────────────────────────
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

function useElevesLibrairie() {
  return useQuery({
    queryKey: ['eleves-librairie'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, option_fournitures, classe_id, classes(nom, niveau_id, niveaux:niveau_id(id, nom, cycles:cycle_id(nom)))')
        .eq('option_fournitures', true)
        .eq('statut', 'inscrit')
        .is('deleted_at', null)
        .order('nom');
      if (error) throw error;
      return data;
    },
  });
}

// ─── Article Manager (Inventaire) ─────────────────────
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
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 flex items-center gap-3"><Icon className="h-8 w-8 text-emerald-600" /><div><p className="text-sm text-muted-foreground">Total articles</p><p className="text-xl font-bold">{articles.length}</p></div></CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3"><Package className="h-8 w-8 text-emerald-500" /><div><p className="text-sm text-muted-foreground">Valeur du stock</p><p className="text-xl font-bold">{valeurStock.toLocaleString()} <span className="text-sm font-normal">GNF</span></p></div></CardContent></Card>
        <Card className={stockBas > 0 ? 'border-warning/40' : ''}><CardContent className="pt-4 flex items-center gap-3"><AlertTriangle className={`h-8 w-8 ${stockBas > 0 ? 'text-warning' : 'text-muted-foreground'}`} /><div><p className="text-sm text-muted-foreground">Stock bas (&lt;10)</p><p className="text-xl font-bold text-warning">{stockBas}</p></div></CardContent></Card>
        <Card className={stockEpuise > 0 ? 'border-destructive/40' : ''}><CardContent className="pt-4 flex items-center gap-3"><AlertTriangle className={`h-8 w-8 ${stockEpuise > 0 ? 'text-destructive' : 'text-muted-foreground'}`} /><div><p className="text-sm text-muted-foreground">Épuisé</p><p className="text-xl font-bold text-destructive">{stockEpuise}</p></div></CardContent></Card>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={`Rechercher un ${label.toLowerCase()}…`} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => { reset(); setOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-2" /> Ajouter</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nom</TableHead><TableHead>Niveau</TableHead><TableHead>Prix unitaire</TableHead><TableHead>Stock</TableHead><TableHead>Valeur</TableHead><TableHead className="w-24">Actions</TableHead>
            </TableRow></TableHeader>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? 'Modifier' : 'Ajouter'} — {label}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom *</Label><Input value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom de l'article" /></div>
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
          <DialogFooter><Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-emerald-600 hover:bg-emerald-700">{save.isPending ? 'Enregistrement…' : 'Enregistrer'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Vente "À la Carte" Panel ─────────────────────────
function VenteALaCartePanel() {
  const qc = useQueryClient();
  const { data: elevesLib = [], isLoading: loadingEleves } = useElevesLibrairie();
  const { data: allArticles = [] } = useArticles();
  const { data: ventesAll = [] } = useVentes();
  const [selectedEleve, setSelectedEleve] = useState<any>(null);
  const [panier, setPanier] = useState<Record<string, number>>({});
  const [canal, setCanal] = useState('especes');
  const [reference, setReference] = useState('');
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  // Determine which articles this student has already purchased
  const ventesEleve = useMemo(() => {
    if (!selectedEleve) return [];
    return ventesAll.filter((v: any) => v.eleve_id === selectedEleve.id);
  }, [ventesAll, selectedEleve]);

  const articlesAchetes = useMemo(() => {
    const map: Record<string, number> = {};
    ventesEleve.forEach((v: any) => { map[v.article_id] = (map[v.article_id] || 0) + v.quantite; });
    return map;
  }, [ventesEleve]);

  // Articles for this student's level
  const niveauId = selectedEleve?.classes?.niveau_id || selectedEleve?.classes?.niveaux?.id;
  const articlesNiveau = useMemo(() => {
    if (!niveauId) return allArticles;
    return allArticles.filter((a: any) => !a.niveau_id || a.niveau_id === niveauId);
  }, [allArticles, niveauId]);

  // Check if student has all articles for their level
  const articlesPrevus = articlesNiveau.length;
  const articlesPayes = articlesNiveau.filter((a: any) => (articlesAchetes[a.id] || 0) > 0).length;
  const isComplet = articlesPrevus > 0 && articlesPayes >= articlesPrevus;

  // Build status for each student in the list
  const elevesAvecStatut = useMemo(() => {
    return (elevesLib || []).map((e: any) => {
      const nId = e.classes?.niveau_id || e.classes?.niveaux?.id;
      const artNiv = nId ? allArticles.filter((a: any) => !a.niveau_id || a.niveau_id === nId) : allArticles;
      const achats: Record<string, number> = {};
      ventesAll.filter((v: any) => v.eleve_id === e.id).forEach((v: any) => { achats[v.article_id] = (achats[v.article_id] || 0) + v.quantite; });
      const total = artNiv.length;
      const done = artNiv.filter((a: any) => (achats[a.id] || 0) > 0).length;
      const complet = total > 0 && done >= total;
      return { ...e, artTotal: total, artDone: done, complet };
    }).filter((e: any) => !e.complet); // Only show non-complete students
  }, [elevesLib, allArticles, ventesAll]);

  const panierItems = useMemo(() => {
    return Object.entries(panier).filter(([, q]) => q > 0).map(([id, q]) => {
      const art = allArticles.find((a: any) => a.id === id);
      return { id, nom: art?.nom || '', prix: Number(art?.prix || 0), quantite: q, categorie: art?.categorie || '', stock: art?.stock || 0 };
    });
  }, [panier, allArticles]);

  const totalPanier = panierItems.reduce((s, i) => s + i.prix * i.quantite, 0);

  const validerVente = useMutation({
    mutationFn: async () => {
      if (!selectedEleve || panierItems.length === 0) throw new Error('Sélectionnez un élève et des articles');
      // Verify stock
      for (const item of panierItems) {
        if (item.quantite > item.stock) throw new Error(`Stock insuffisant pour ${item.nom}`);
      }
      // Insert sales (triggers stock decrement)
      for (const item of panierItems) {
        const { error } = await supabase.from('ventes_articles' as any).insert({
          eleve_id: selectedEleve.id,
          article_id: item.id,
          quantite: item.quantite,
          prix_unitaire: item.prix,
        });
        if (error) throw error;
      }
      // Record payment
      const { error } = await supabase.from('paiements').insert({
        eleve_id: selectedEleve.id,
        montant: totalPanier,
        canal,
        type_paiement: 'article',
        reference: (canal !== 'especes' && reference) ? reference : null,
        mois_concerne: null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['articles-librairie'] });
      qc.invalidateQueries({ queryKey: ['ventes-librairie'] });
      qc.invalidateQueries({ queryKey: ['eleves-librairie'] });
      toast.success(`Vente de ${totalPanier.toLocaleString()} GNF enregistrée`);

      // Print receipt
      generateRecuLibrairiePDF({
        eleve: `${selectedEleve.prenom} ${selectedEleve.nom}`,
        matricule: selectedEleve.matricule || '',
        classe: selectedEleve.classes?.nom || '—',
        articles: panierItems.map(i => ({ nom: i.nom, categorie: i.categorie, quantite: i.quantite, prixUnitaire: i.prix })),
        totalMontant: totalPanier,
        canal: canal === 'especes' ? 'Espèces' : canal === 'orange_money' ? 'Orange Money' : 'MTN MoMo',
        reference: (canal !== 'especes' && reference) ? reference : null,
        date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
      });

      // Print bon de sortie
      generateBonSortiePDF({
        eleve: `${selectedEleve.prenom} ${selectedEleve.nom}`,
        matricule: selectedEleve.matricule || '',
        classe: selectedEleve.classes?.nom || '—',
        articles: panierItems.map(i => ({ nom: i.nom, categorie: i.categorie, quantite: i.quantite })),
        date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
      });

      setPanier({});
      setSelectedEleve(null);
      setCanal('especes');
      setReference('');
      setExpandedCat(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePanier = (articleId: string, checked: boolean) => {
    setPanier(prev => ({ ...prev, [articleId]: checked ? 1 : 0 }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Student list */}
      <div className="lg:col-span-1 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-emerald-600" /> Attente Librairie ({elevesAvecStatut.length})</h3>
        <div className="space-y-1 max-h-[600px] overflow-y-auto">
          {loadingEleves ? <p className="text-sm text-muted-foreground">Chargement…</p> :
          elevesAvecStatut.length === 0 ? <p className="text-sm text-muted-foreground">Aucun élève en attente</p> :
          elevesAvecStatut.map((e: any) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedEleve?.id === e.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-muted/50'}`}
              onClick={() => { setSelectedEleve(e); setPanier({}); setExpandedCat(null); }}
            >
              <p className="font-medium text-sm">{e.prenom} {e.nom}</p>
              <p className="text-xs text-muted-foreground">{e.classes?.nom || '—'} • {e.matricule || ''}</p>
              <div className="flex items-center gap-2 mt-1">
                {e.artDone > 0 && e.artDone < e.artTotal ? (
                  <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">Partiel ({e.artDone}/{e.artTotal})</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">0/{e.artTotal} articles</Badge>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Article selection */}
      <div className="lg:col-span-2">
        {!selectedEleve ? (
          <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground">
            <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Sélectionnez un élève dans la liste pour commencer la vente</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-4">
            <Card className="border-emerald-300/50 bg-emerald-50/30 dark:bg-emerald-950/20">
              <CardContent className="pt-4">
                <p className="font-semibold">{selectedEleve.prenom} {selectedEleve.nom} — {selectedEleve.classes?.nom || '—'}</p>
                <p className="text-xs text-muted-foreground">Niveau : {selectedEleve.classes?.niveaux?.nom || '—'} • {articlesPayes}/{articlesPrevus} articles déjà achetés</p>
              </CardContent>
            </Card>

            {/* Articles by category */}
            {['fourniture', 'manuel', 'roman', 'art_plastique'].map(cat => {
              const items = articlesNiveau.filter((a: any) => a.categorie === cat);
              if (items.length === 0) return null;
              const isExpanded = expandedCat === cat || expandedCat === null;
              const catLabel = cat === 'fourniture' ? '📦 Fournitures' : cat === 'manuel' ? '📖 Manuels' : cat === 'roman' ? '📚 Romans' : '🎨 Art Plastique';

              return (
                <Card key={cat} className="border-emerald-200/50">
                  <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpandedCat(expandedCat === cat ? null : cat)}>
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>{catLabel} ({items.length})</span>
                      <span className="text-xs text-muted-foreground">{isExpanded ? '▾' : '▸'}</span>
                    </CardTitle>
                  </CardHeader>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <CardContent className="pt-0 space-y-1">
                          {items.map((a: any) => {
                            const dejaAchete = (articlesAchetes[a.id] || 0) > 0;
                            const enPanier = (panier[a.id] || 0) > 0;
                            return (
                              <motion.div
                                key={a.id}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${dejaAchete ? 'bg-emerald-100/50 dark:bg-emerald-900/20' : enPanier ? 'bg-emerald-50 border border-emerald-300 dark:bg-emerald-950/30' : 'bg-muted/50'} ${a.stock <= 0 ? 'opacity-40' : ''}`}
                              >
                                <div className="flex items-center gap-2">
                                  {dejaAchete ? (
                                    <span className="text-emerald-600 text-xs">✓</span>
                                  ) : (
                                    <Checkbox checked={enPanier} onCheckedChange={(v) => togglePanier(a.id, !!v)} disabled={a.stock <= 0} />
                                  )}
                                  <span className={dejaAchete ? 'line-through text-muted-foreground' : ''}>{a.nom}</span>
                                  {a.stock <= 0 && <Badge variant="destructive" className="text-[10px] px-1">Épuisé</Badge>}
                                  {a.stock > 0 && a.stock < 10 && <Badge variant="secondary" className="text-[10px] px-1">Stock: {a.stock}</Badge>}
                                </div>
                                <span className="font-medium text-emerald-700">{Number(a.prix).toLocaleString()} GNF</span>
                              </motion.div>
                            );
                          })}
                        </CardContent>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              );
            })}

            {/* Cart summary */}
            {panierItems.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Panier ({panierItems.length} article{panierItems.length > 1 ? 's' : ''})</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {panierItems.map(i => (
                      <div key={i.id} className="flex justify-between text-sm">
                        <span>{i.nom} × {i.quantite}</span>
                        <span className="font-bold">{(i.prix * i.quantite).toLocaleString()} GNF</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold text-base pt-2 border-t border-emerald-300">
                      <span>TOTAL</span>
                      <span className="text-emerald-700">{totalPanier.toLocaleString()} GNF</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div>
                        <Label className="text-xs">Canal</Label>
                        <Select value={canal} onValueChange={setCanal}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="especes">Espèces</SelectItem>
                            <SelectItem value="orange_money">Orange Money</SelectItem>
                            <SelectItem value="mtn_momo">MTN MoMo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {(canal === 'orange_money' || canal === 'mtn_momo') && (
                        <div><Label className="text-xs">Référence</Label><Input className="h-8" value={reference} onChange={e => setReference(e.target.value)} placeholder="N° transaction" /></div>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => validerVente.mutate()} disabled={validerVente.isPending}>
                        <Printer className="h-4 w-4 mr-2" /> {validerVente.isPending ? 'Validation…' : 'Valider & Imprimer'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────
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
        <BookOpen className="h-7 w-7 text-emerald-600" /> Librairie & Inventaire
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 flex items-center gap-3"><Package className="h-8 w-8 text-emerald-600" /><div><p className="text-sm text-muted-foreground">Articles en stock</p><p className="text-2xl font-bold">{totalArticles}</p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3"><Tag className="h-8 w-8 text-emerald-500" /><div><p className="text-sm text-muted-foreground">Valeur totale du stock</p><p className="text-2xl font-bold">{totalValeur.toLocaleString()} <span className="text-sm font-normal">GNF</span></p></div></CardContent></Card>
        <Card><CardContent className="pt-6 flex items-center gap-3"><BookOpen className="h-8 w-8 text-emerald-600" /><div><p className="text-sm text-muted-foreground">CA Ventes Librairie</p><p className="text-2xl font-bold">{totalVentes.toLocaleString()} <span className="text-sm font-normal">GNF</span></p></div></CardContent></Card>
        <Card className={alertes > 0 ? 'border-warning/40' : ''}><CardContent className="pt-6 flex items-center gap-3"><AlertTriangle className={`h-8 w-8 ${alertes > 0 ? 'text-warning' : 'text-muted-foreground'}`} /><div><p className="text-sm text-muted-foreground">Alertes stock</p><p className="text-2xl font-bold text-warning">{alertes}</p></div></CardContent></Card>
      </div>

      <Tabs defaultValue="vente">
        <TabsList>
          <TabsTrigger value="vente">🛒 Vente à la carte</TabsTrigger>
          <TabsTrigger value="fournitures">📦 Fournitures</TabsTrigger>
          <TabsTrigger value="manuels">📖 Manuels</TabsTrigger>
          <TabsTrigger value="romans">📚 Romans</TabsTrigger>
          <TabsTrigger value="art_plastique">🎨 Art Plastique</TabsTrigger>
          <TabsTrigger value="ventes">🧾 Historique ventes</TabsTrigger>
        </TabsList>

        <TabsContent value="vente" className="mt-4">
          <VenteALaCartePanel />
        </TabsContent>
        <TabsContent value="fournitures" className="mt-4"><ArticleManager categorie="fourniture" label="Fourniture" icon={Package} /></TabsContent>
        <TabsContent value="manuels" className="mt-4"><ArticleManager categorie="manuel" label="Manuel" icon={BookOpen} /></TabsContent>
        <TabsContent value="romans" className="mt-4"><ArticleManager categorie="roman" label="Roman" icon={BookOpen} /></TabsContent>
        <TabsContent value="art_plastique" className="mt-4"><ArticleManager categorie="art_plastique" label="Art Plastique" icon={BookOpen} /></TabsContent>

        <TabsContent value="ventes" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Dernières ventes</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Élève</TableHead><TableHead>Article</TableHead><TableHead>Catégorie</TableHead><TableHead>Qté</TableHead><TableHead>Total</TableHead>
                </TableRow></TableHeader>
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
