import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Upload, FileText, Trash2, Eye, Loader2, BookOpen, Download, Plus, CheckCircle2, Clock, User, BarChart3, History, BookMarked, TrendingUp, Sparkles, Library, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const ALL_LEVELS_VALUE = '__all_levels__';

const formatCategoryLabel = (category?: string | null) => {
  const normalized = category?.toLowerCase();
  if (normalized === 'roman' || normalized === 'romans') return 'Roman';
  if (normalized === 'manuel' || normalized === 'manuels') return 'Manuel';
  return category || 'Livre';
};

const isPdfFile = (fileName?: string | null, url?: string | null) => {
  const lowerName = fileName?.toLowerCase() || '';
  const lowerUrl = url?.toLowerCase() || '';
  return lowerName.endsWith('.pdf') || lowerUrl.includes('.pdf');
};

const getFriendlyErrorMessage = (error: any) => {
  const message = error?.message || error?.error_description || error?.details || '';
  if (message.includes('articles_categorie_check')) return 'Catégorie invalide. Choisissez Roman ou Manuel.';
  if (message.toLowerCase().includes('row-level security')) return "Votre compte n'a pas l'autorisation d'ajouter ce livre.";
  return message || "Erreur lors de l'ajout du livre numérique";
};

function useArticlesWithFiles() {
  return useQuery({
    queryKey: ['livres-numeriques'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('livres_numeriques' as any)
        .select('*, niveaux:niveau_id(nom)')
        .order('categorie')
        .order('nom');
      if (error) throw error;
      return data as any[];
    },
  });
}

function useNiveaux() {
  return useQuery({
    queryKey: ['niveaux-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('niveaux').select('id, nom').order('nom');
      if (error) throw error;
      return data;
    },
  });
}

function usePendingValidations() {
  return useQuery({
    queryKey: ['pending-digital-validations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('achats_livres_numeriques' as any)
        .select('*, eleves:eleve_id(nom, prenom, matricule, classe_id, classes:classe_id(nom)), livres_numeriques:livre_numerique_id(nom, categorie, prix, fichier_url), commandes_articles:commande_id(id, article_nom, prix_unitaire, quantite)')
        .eq('statut', 'en_attente')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 5000,
  });
}

function useValidationHistory() {
  return useQuery({
    queryKey: ['digital-validation-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('achats_livres_numeriques' as any)
        .select('*, eleves:eleve_id(nom, prenom, matricule, classes:classe_id(nom)), livres_numeriques:livre_numerique_id(nom, categorie, prix)')
        .eq('statut', 'valide')
        .order('valide_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 10000,
  });
}

export default function LivresNumeriquesTab() {
  const { data: articles = [], isLoading } = useArticlesWithFiles();
  const { data: niveaux = [] } = useNiveaux();
  const { data: pendingValidations = [], isLoading: loadingValidations } = usePendingValidations();
  const { data: validationHistory = [] } = useValidationHistory();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'livres' | 'validations' | 'historique'>('dashboard');

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ nom: '', categorie: 'roman', prix: '', niveau_id: ALL_LEVELS_VALUE });
  const [addFile, setAddFile] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);
  const addFileRef = useRef<HTMLInputElement>(null);
  const [validating, setValidating] = useState<string | null>(null);
  const [addStatus, setAddStatus] = useState<'idle' | 'uploading' | 'success'>('idle');
  const [lastAddedBook, setLastAddedBook] = useState<{ nom: string; fichierNom: string; categorie: string; niveau: string } | null>(null);

  const filtered = articles.filter((a: any) =>
    `${a.nom} ${a.categorie}`.toLowerCase().includes(search.toLowerCase())
  );

  const totalBooks = articles.length;
  const romanCount = articles.filter((a: any) => a.categorie?.toLowerCase() === 'roman').length;
  const manuelCount = articles.filter((a: any) => a.categorie?.toLowerCase() === 'manuel').length;
  const totalValidated = validationHistory.length;
  const pendingCount = pendingValidations.length;
  const totalRevenue = validationHistory.reduce((sum: number, v: any) => sum + (v.livres_numeriques?.prix || 0), 0);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedArticleId) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'epub'].includes(ext || '')) { toast.error('Format non supporté. Utilisez PDF ou EPUB.'); return; }
    setUploading(selectedArticleId);
    try {
      const path = `livres/${selectedArticleId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('livres-numeriques').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: signedData } = await supabase.storage.from('livres-numeriques').createSignedUrl(path, 31536000);
      if (!signedData?.signedUrl) throw new Error("Échec de la signature");
      const { error: updErr } = await supabase.from('livres_numeriques' as any).update({ fichier_url: signedData.signedUrl, fichier_nom: file.name } as any).eq('id', selectedArticleId);
      if (updErr) throw updErr;
      toast.success('Fichier numérique uploadé !');
      queryClient.invalidateQueries({ queryKey: ['livres-numeriques'] });
    } catch (err: any) { toast.error(err.message || 'Erreur upload'); }
    finally { setUploading(null); setSelectedArticleId(null); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleDelete = async (articleId: string) => {
    try {
      const { error } = await supabase.from('livres_numeriques' as any).delete().eq('id', articleId);
      if (error) throw error;
      toast.success('Livre numérique supprimé');
      queryClient.invalidateQueries({ queryKey: ['livres-numeriques'] });
    } catch (err: any) { toast.error(err.message); }
  };

  const handlePreview = (url: string, name: string) => { setPreviewUrl(url); setPreviewName(name); };

  const resetAddDialog = () => {
    setAddForm({ nom: '', categorie: 'roman', prix: '', niveau_id: ALL_LEVELS_VALUE });
    setAddFile(null); setAddStatus('idle'); setLastAddedBook(null);
    if (addFileRef.current) addFileRef.current.value = '';
  };

  const handleAddDialogChange = (open: boolean) => {
    if (!open && !adding) resetAddDialog();
    setShowAdd(open);
  };

  const handleValidate = async (achatId: string, eleveId: string, livreNom: string) => {
    setValidating(achatId);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const { error: updErr } = await supabase.from('achats_livres_numeriques' as any).update({ statut: 'valide', valide_at: new Date().toISOString(), valide_par: authData.user?.id ?? null } as any).eq('id', achatId);
      if (updErr) throw updErr;
      const achat = pendingValidations.find((v: any) => v.id === achatId);
      if (achat?.commande_id) {
        const { error: commandeError } = await supabase.from('commandes_articles' as any).update({ statut: 'valide' } as any).eq('id', achat.commande_id);
        if (commandeError && !commandeError.message?.toLowerCase().includes('row-level security')) throw commandeError;
      }
      const eleveData = achat?.eleves;
      const eleveNomComplet = eleveData ? `${eleveData.prenom} ${eleveData.nom}` : 'votre enfant';
      const { data: eleveRow } = await supabase.from('eleves').select('famille_id').eq('id', eleveId).maybeSingle();
      if (eleveRow?.famille_id) {
        await supabase.from('parent_notifications').insert({
          famille_id: eleveRow.famille_id,
          titre: '✅ Livre numérique validé',
          message: `Le livre "${livreNom}" pour ${eleveNomComplet} a été validé. Il est maintenant disponible dans son espace élève dans la Bibliothèque.`,
          type: 'info',
        });
      }
      toast.success(`Livre "${livreNom}" validé pour l'élève !`);
      queryClient.invalidateQueries({ queryKey: ['pending-digital-validations'] });
      queryClient.invalidateQueries({ queryKey: ['digital-validation-history'] });
      queryClient.invalidateQueries({ queryKey: ['livres-numeriques'] });
    } catch (err: any) { toast.error(err.message || 'Erreur de validation'); }
    finally { setValidating(null); }
  };

  const handleAddBook = async () => {
    if (!addForm.nom.trim()) { toast.error('Nom requis'); return; }
    if (!addForm.prix || isNaN(Number(addForm.prix))) { toast.error('Prix invalide'); return; }
    if (!addFile) { toast.error('Ajoutez le fichier numérique du livre.'); return; }
    const ext = addFile.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'epub'].includes(ext || '')) { toast.error('Format non supporté. Utilisez PDF ou EPUB.'); return; }
    setAdding(true); setAddStatus('uploading'); setLastAddedBook(null);
    let articleId: string | null = null;
    let uploadedPath: string | null = null;
    const trimmedName = addForm.nom.trim();
    const selectedNiveauLabel = addForm.niveau_id === ALL_LEVELS_VALUE ? 'Tous les niveaux' : niveaux.find((n: any) => n.id === addForm.niveau_id)?.nom || 'Niveau ciblé';
    try {
      const insertData: any = { nom: trimmedName, categorie: addForm.categorie.toLowerCase(), prix: Number(addForm.prix), niveau_id: addForm.niveau_id === ALL_LEVELS_VALUE ? null : addForm.niveau_id };
      const { data: newArt, error: insErr } = await supabase.from('livres_numeriques' as any).insert(insertData as any).select('id').single();
      if (insErr) throw insErr;
      articleId = (newArt as any).id;
      uploadedPath = `livres/${articleId}/${Date.now()}_${addFile.name}`;
      const { error: upErr } = await supabase.storage.from('livres-numeriques').upload(uploadedPath, addFile, { upsert: true });
      if (upErr) throw upErr;
      const { data: signedData, error: signedErr } = await supabase.storage.from('livres-numeriques').createSignedUrl(uploadedPath, 31536000);
      if (signedErr) throw signedErr;
      if (!signedData?.signedUrl) throw new Error('Impossible de générer le lien du fichier.');
      const { error: updateErr } = await supabase.from('livres_numeriques' as any).update({ fichier_url: signedData.signedUrl, fichier_nom: addFile.name } as any).eq('id', articleId);
      if (updateErr) throw updateErr;
      toast.success(`Livre ajouté. Le fichier ${addFile.name} a bien été téléversé.`);
      queryClient.invalidateQueries({ queryKey: ['livres-numeriques'] });
      setLastAddedBook({ nom: trimmedName, fichierNom: addFile.name, categorie: formatCategoryLabel(addForm.categorie), niveau: selectedNiveauLabel });
      setAddStatus('success');
      setAddForm({ nom: '', categorie: 'roman', prix: '', niveau_id: ALL_LEVELS_VALUE });
      setAddFile(null);
      if (addFileRef.current) addFileRef.current.value = '';
    } catch (err: any) {
      if (uploadedPath) await supabase.storage.from('livres-numeriques').remove([uploadedPath]);
      if (articleId) await supabase.from('livres_numeriques' as any).delete().eq('id', articleId);
      setAddStatus('idle');
      toast.error(getFriendlyErrorMessage(err));
    } finally { setAdding(false); }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="relative">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground font-medium">Chargement de la bibliothèque…</p>
      </div>
    );
  }

  const tabs = [
    { key: 'dashboard' as const, label: 'Tableau de bord', icon: BarChart3, badge: null },
    { key: 'livres' as const, label: 'Catalogue', icon: Library, badge: totalBooks > 0 ? totalBooks : null },
    { key: 'validations' as const, label: 'Validations', icon: ShieldCheck, badge: pendingCount > 0 ? pendingCount : null },
    { key: 'historique' as const, label: 'Historique', icon: History, badge: null },
  ];

  return (
    <div className="space-y-6">
      <input ref={fileInputRef} type="file" accept=".pdf,.epub" className="hidden" onChange={handleUpload} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
            <BookOpen className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">Livres Numériques</h2>
            <p className="text-sm text-muted-foreground">Gérez les romans et manuels numériques</p>
          </div>
        </div>
        <Button className="gap-2 rounded-2xl shadow-md hover:shadow-lg transition-shadow" onClick={() => { resetAddDialog(); setShowAdd(true); }}>
          <Plus className="h-4 w-4" /> Ajouter un livre
        </Button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1.5 p-1.5 bg-muted/50 rounded-2xl overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
              activeTab === t.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            }`}
          >
            <t.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{t.label}</span>
            {t.badge !== null && (
              <span className={`flex items-center justify-center h-5 min-w-5 text-[10px] font-bold rounded-full px-1.5 ${
                t.key === 'validations' ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-primary/15 text-primary'
              }`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ─── DASHBOARD ─── */}
        {activeTab === 'dashboard' && (
          <motion.div key="dashboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { icon: BookOpen, label: 'Total livres', value: totalBooks, gradient: 'from-primary/15 to-primary/5', iconColor: 'text-primary' },
                { icon: BookMarked, label: 'Romans', value: romanCount, gradient: 'from-amber-500/15 to-orange-500/5', iconColor: 'text-amber-600' },
                { icon: FileText, label: 'Manuels', value: manuelCount, gradient: 'from-blue-500/15 to-indigo-500/5', iconColor: 'text-blue-600' },
                { icon: TrendingUp, label: 'Validés', value: totalValidated, gradient: 'from-accent/15 to-accent/5', iconColor: 'text-accent' },
              ].map((stat, i) => (
                <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className={`border-0 shadow-sm bg-gradient-to-br ${stat.gradient} overflow-hidden`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-3xl font-black tracking-tight">{stat.value}</p>
                          <p className="text-xs text-muted-foreground font-medium mt-0.5">{stat.label}</p>
                        </div>
                        <div className={`h-10 w-10 rounded-xl bg-background/80 flex items-center justify-center ${stat.iconColor}`}>
                          <stat.icon className="h-5 w-5" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Bottom cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                    <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Clock className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <p className="text-sm font-bold">En attente</p>
                    {pendingCount > 0 && (
                      <Badge variant="destructive" className="ml-auto text-[10px] h-5 rounded-full">{pendingCount}</Badge>
                    )}
                  </div>
                  <div className="px-4 pb-4">
                    {pendingCount === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">Aucune commande en attente ✓</p>
                    ) : (
                      <div className="space-y-2 mt-2">
                        {pendingValidations.slice(0, 4).map((v: any) => (
                          <div key={v.id} className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-border/50 last:border-0">
                            <span className="truncate font-medium">{v.livres_numeriques?.nom || '—'}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{v.eleves?.prenom} {v.eleves?.nom}</span>
                          </div>
                        ))}
                        {pendingCount > 4 && (
                          <button onClick={() => setActiveTab('validations')} className="text-xs text-primary font-semibold hover:underline w-full text-center pt-1">
                            Voir tout ({pendingCount})
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                    <div className="h-7 w-7 rounded-lg bg-accent/10 flex items-center justify-center">
                      <TrendingUp className="h-3.5 w-3.5 text-accent" />
                    </div>
                    <p className="text-sm font-bold">Revenus numériques</p>
                  </div>
                  <div className="px-4 pb-4">
                    <p className="text-4xl font-black tracking-tight text-accent mt-2">
                      {totalRevenue.toLocaleString()}
                      <span className="text-sm font-medium text-muted-foreground ml-1.5">GNF</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Sur {totalValidated} vente{totalValidated > 1 ? 's' : ''} validée{totalValidated > 1 ? 's' : ''}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {/* ─── CATALOGUE ─── */}
        {activeTab === 'livres' && (
          <motion.div key="livres" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher un livre…" value={search} onChange={e => setSearch(e.target.value)} className="pl-10 rounded-2xl bg-muted/40 border-0 focus-visible:ring-1" />
            </div>

            {filtered.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                {filtered.map((art: any, i: number) => {
                  const isRoman = art.categorie?.toLowerCase() === 'roman';
                  const coverGradient = isRoman
                    ? 'from-amber-600 via-orange-500 to-yellow-400'
                    : 'from-blue-600 via-indigo-500 to-violet-500';
                  const accentRing = isRoman ? 'hover:ring-amber-300/50' : 'hover:ring-blue-300/50';
                  return (
                    <motion.div
                      key={art.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="group"
                    >
                      <div className={`relative aspect-[2/3] rounded-2xl overflow-hidden shadow-md hover:shadow-xl ring-1 ring-border/30 ${accentRing} hover:ring-2 transition-all duration-300 cursor-pointer`}>
                        {/* Cover */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${coverGradient}`} />
                        {/* Decorative pattern */}
                        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '20px 20px' }} />
                        {/* Content */}
                        <div className="relative h-full flex flex-col p-4 text-white">
                          <div className="flex items-start justify-between">
                            <Badge className="bg-white/20 border-0 text-white text-[9px] font-bold backdrop-blur-sm">{formatCategoryLabel(art.categorie)}</Badge>
                            <BookOpen className="h-5 w-5 opacity-30" />
                          </div>
                          <div className="flex-1 flex items-center justify-center px-1">
                            <p className="text-sm font-extrabold leading-snug text-center line-clamp-4 drop-shadow-sm">{art.nom}</p>
                          </div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-bold bg-black/20 px-2 py-0.5 rounded-full backdrop-blur-sm">{Number(art.prix).toLocaleString()} GNF</span>
                            {art.niveaux?.nom && <span className="text-[9px] font-medium opacity-80 truncate">{art.niveaux.nom}</span>}
                          </div>
                        </div>
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-3">
                          {art.fichier_url && (
                            <Button size="icon" variant="secondary" className="h-10 w-10 rounded-full shadow-lg" onClick={() => handlePreview(art.fichier_url, art.fichier_nom || art.nom)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="destructive" className="h-10 w-10 rounded-full shadow-lg" onClick={() => handleDelete(art.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 px-1">
                        <p className="text-sm font-bold truncate">{art.nom}</p>
                        {art.fichier_nom && <p className="text-[10px] text-muted-foreground truncate">{art.fichier_nom}</p>}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <Card className="border-0 shadow-sm rounded-2xl">
                <CardContent className="py-16 text-center text-muted-foreground">
                  <Library className="h-12 w-12 mx-auto mb-3 opacity-15" />
                  <p className="text-sm font-semibold">Aucun livre numérique trouvé</p>
                  <p className="text-xs mt-1">Ajoutez votre premier livre avec le bouton ci-dessus</p>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {/* ─── VALIDATIONS ─── */}
        {activeTab === 'validations' && (
          <motion.div key="validations" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <Card className="border-0 bg-primary/5 rounded-2xl">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="text-sm">
                  <p className="font-bold text-foreground">Validation des commandes</p>
                  <p className="text-muted-foreground text-xs mt-0.5">Les achats de livres numériques par les parents apparaissent ici. Validez pour rendre le livre accessible à l'élève. Actualisation auto toutes les 5s.</p>
                </div>
              </CardContent>
            </Card>

            {loadingValidations ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : pendingValidations.length === 0 ? (
              <Card className="border-0 shadow-sm rounded-2xl">
                <CardContent className="py-16 text-center text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-15 text-accent" />
                  <p className="text-sm font-semibold">Aucune validation en attente</p>
                  <p className="text-xs mt-1">Tout est à jour !</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {pendingValidations.map((achat: any, i: number) => {
                  const eleve = achat.eleves;
                  const livre = achat.livres_numeriques;
                  const cmd = achat.commandes_articles;
                  const articleNom = livre?.nom || cmd?.article_nom || '—';
                  const prix = livre?.prix || cmd?.prix_unitaire || 0;
                  const isRoman = livre?.categorie?.toLowerCase() === 'roman';
                  return (
                    <motion.div key={achat.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden">
                        <CardContent className="p-0">
                          <div className="flex items-stretch">
                            <div className={`w-1.5 shrink-0 ${isRoman ? 'bg-amber-500' : 'bg-blue-500'}`} />
                            <div className="flex items-center gap-3 p-4 flex-1 min-w-0">
                              <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${isRoman ? 'bg-amber-500/10' : 'bg-blue-500/10'}`}>
                                <BookOpen className={`h-5 w-5 ${isRoman ? 'text-amber-600' : 'text-blue-600'}`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold truncate">{articleNom}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <User className="h-3 w-3" /> {eleve?.prenom} {eleve?.nom}
                                  </span>
                                  {eleve?.classes?.nom && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 rounded-full h-4">{eleve.classes.nom}</Badge>}
                                  <span className="text-xs font-semibold text-primary">{prix?.toLocaleString()} GNF</span>
                                </div>
                              </div>
                              <Button className="shrink-0 gap-1.5 rounded-xl shadow-sm" size="sm" disabled={validating === achat.id} onClick={() => handleValidate(achat.id, achat.eleve_id, articleNom)}>
                                {validating === achat.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                Valider
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ─── HISTORIQUE ─── */}
        {activeTab === 'historique' && (
          <motion.div key="historique" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <p className="text-sm text-muted-foreground">50 dernières validations</p>
            {validationHistory.length === 0 ? (
              <Card className="border-0 shadow-sm rounded-2xl">
                <CardContent className="py-16 text-center text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-15" />
                  <p className="text-sm font-semibold">Aucune validation effectuée</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {validationHistory.map((v: any, i: number) => {
                  const eleve = v.eleves;
                  const livre = v.livres_numeriques;
                  return (
                    <motion.div key={v.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                      <Card className="border-0 shadow-sm rounded-2xl">
                        <CardContent className="p-3.5">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="h-4 w-4 text-accent" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold truncate">{livre?.nom || '—'}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-[11px] text-muted-foreground">{eleve?.prenom} {eleve?.nom}</span>
                                {eleve?.classes?.nom && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 rounded-full h-4">{eleve.classes.nom}</Badge>}
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded-full h-4">{formatCategoryLabel(livre?.categorie)}</Badge>
                                <span className="text-[11px] font-semibold text-accent">{(livre?.prix || 0).toLocaleString()} GNF</span>
                              </div>
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                              {v.valide_at ? new Date(v.valide_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Book Dialog */}
      <Dialog open={showAdd} onOpenChange={handleAddDialogChange}>
        <DialogContent className="max-w-2xl overflow-hidden rounded-3xl border-0 p-0 shadow-2xl">
          <div className="border-b bg-gradient-to-br from-primary/10 via-background to-accent/10 p-6">
            <DialogHeader className="text-left">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                  {addStatus === 'success' ? <CheckCircle2 className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-xl">{addStatus === 'success' ? 'Livre bien ajouté' : 'Ajouter un livre numérique'}</DialogTitle>
                  <DialogDescription>{addStatus === 'success' ? 'Le livre est enregistré et disponible dans le catalogue.' : 'Ajoutez un roman ou un manuel avec son fichier PDF ou EPUB.'}</DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          {addStatus === 'success' && lastAddedBook ? (
            <div className="space-y-5 p-6">
              <div className="rounded-3xl border bg-card p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <Badge className="gap-1 rounded-full"><CheckCircle2 className="h-3.5 w-3.5" /> PDF téléversé</Badge>
                    <div><p className="text-lg font-semibold">{lastAddedBook.nom}</p><p className="text-sm text-muted-foreground">{lastAddedBook.fichierNom}</p></div>
                  </div>
                  <div className="grid gap-2 text-sm sm:text-right">
                    <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Catégorie</p><p className="font-medium">{lastAddedBook.categorie}</p></div>
                    <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Niveau</p><p className="font-medium">{lastAddedBook.niveau}</p></div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button variant="outline" className="rounded-2xl" onClick={() => handleAddDialogChange(false)}>Fermer</Button>
                <Button className="gap-2 rounded-2xl" onClick={() => { setAddStatus('idle'); setLastAddedBook(null); }}><Plus className="h-4 w-4" /> Ajouter un autre livre</Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 p-6 md:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <div className="space-y-2"><Label>Nom du livre *</Label><Input placeholder="Ex: Le Petit Prince" value={addForm.nom} onChange={e => setAddForm(f => ({ ...f, nom: e.target.value }))} className="rounded-2xl" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Catégorie *</Label><Select value={addForm.categorie} onValueChange={v => setAddForm(f => ({ ...f, categorie: v }))}><SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="roman">Roman</SelectItem><SelectItem value="manuel">Manuel</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Prix (GNF) *</Label><Input type="number" placeholder="0" value={addForm.prix} onChange={e => setAddForm(f => ({ ...f, prix: e.target.value }))} className="rounded-2xl" /></div>
                </div>
                <div className="space-y-2"><Label>Niveau</Label><Select value={addForm.niveau_id} onValueChange={v => setAddForm(f => ({ ...f, niveau_id: v }))}><SelectTrigger className="rounded-2xl"><SelectValue placeholder="Tous niveaux" /></SelectTrigger><SelectContent><SelectItem value={ALL_LEVELS_VALUE}>Tous niveaux</SelectItem>{niveaux.map((n: any) => (<SelectItem key={n.id} value={n.id}>{n.nom}</SelectItem>))}</SelectContent></Select></div>
              </div>
              <div className="space-y-4 rounded-3xl border bg-card/70 p-4 shadow-sm">
                <div className="space-y-1"><p className="text-sm font-semibold">Fichier numérique</p><p className="text-xs text-muted-foreground">Formats : PDF ou EPUB</p></div>
                <input ref={addFileRef} type="file" accept=".pdf,.epub" className="hidden" onChange={e => { setAddFile(e.target.files?.[0] || null); setAddStatus('idle'); }} />
                <Button type="button" variant="outline" className="h-auto w-full justify-start rounded-3xl border-dashed px-4 py-5 text-left" onClick={() => addFileRef.current?.click()}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Upload className="h-5 w-5" /></div>
                    <div className="min-w-0"><p className="font-medium">{addFile ? 'Fichier prêt' : 'Choisir un fichier'}</p><p className="truncate text-xs text-muted-foreground">{addFile ? addFile.name : 'PDF/EPUB'}</p></div>
                  </div>
                </Button>
                <div className="space-y-3 rounded-2xl bg-muted/40 p-3">
                  <div className="flex items-center justify-between gap-3"><span className="text-xs font-medium text-muted-foreground">État</span><Badge variant={addFile ? 'default' : 'secondary'} className="rounded-full">{addFile ? (isPdfFile(addFile.name) ? 'PDF prêt' : 'EPUB prêt') : 'Aucun fichier'}</Badge></div>
                </div>
                <Button className="w-full gap-2 rounded-2xl" disabled={adding || !addFile} onClick={handleAddBook}>
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {adding ? 'Ajout en cours…' : 'Ajouter le livre'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => { setPreviewUrl(null); setPreviewName(''); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4" /> {previewName}
              <a href={previewUrl || ''} target="_blank" rel="noopener noreferrer" className="ml-auto"><Button size="sm" variant="outline" className="gap-1.5 rounded-xl"><Download className="h-3.5 w-3.5" /> Télécharger</Button></a>
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-2">
            {previewUrl && isPdfFile(previewName, previewUrl) ? (
              <iframe src={`https://docs.google.com/gview?url=${encodeURIComponent(previewUrl)}&embedded=true`} className="w-full h-[70vh] rounded-xl border" />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <FileText className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">Aperçu non disponible pour ce format</p>
                <a href={previewUrl || ''} target="_blank" rel="noopener noreferrer" className="mt-3"><Button variant="outline" className="gap-2 rounded-xl"><Download className="h-4 w-4" /> Télécharger</Button></a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
