import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Upload, FileText, Trash2, Eye, Loader2, BookOpen, Download, Plus, CheckCircle2, Clock, User, BarChart3, History, BookMarked, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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

  // Dashboard stats
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

      // Send notification to parent with child's name
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
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const tabs = [
    { key: 'dashboard' as const, label: 'Tableau de bord', icon: BarChart3, badge: null },
    { key: 'livres' as const, label: 'Catalogue', icon: FileText, badge: totalBooks },
    { key: 'validations' as const, label: 'Validations', icon: CheckCircle2, badge: pendingCount > 0 ? pendingCount : null },
    { key: 'historique' as const, label: 'Historique', icon: History, badge: null },
  ];

  return (
    <div className="space-y-6">
      <input ref={fileInputRef} type="file" accept=".pdf,.epub" className="hidden" onChange={handleUpload} />

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Livres Numériques
          </h2>
          <p className="text-sm text-muted-foreground">Gérez vos romans et manuels numériques (PDF/EPUB).</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => { resetAddDialog(); setShowAdd(true); }}>
          <Plus className="h-4 w-4" /> Ajouter
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all relative ${
              activeTab === t.key
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted'
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
            {t.badge !== null && (
              <Badge className="absolute -top-1.5 -right-1.5 h-5 min-w-5 flex items-center justify-center text-[10px] px-1 rounded-full bg-destructive text-destructive-foreground">
                {t.badge}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* ─── DASHBOARD TAB ─── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-0 shadow-md bg-gradient-to-br from-primary/10 to-primary/5">
              <CardContent className="p-4 text-center">
                <BookOpen className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-2xl font-extrabold">{totalBooks}</p>
                <p className="text-xs text-muted-foreground font-medium">Total livres</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md bg-gradient-to-br from-violet-500/10 to-violet-500/5">
              <CardContent className="p-4 text-center">
                <BookMarked className="h-8 w-8 text-violet-600 mx-auto mb-2" />
                <p className="text-2xl font-extrabold">{romanCount}</p>
                <p className="text-xs text-muted-foreground font-medium">Romans</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md bg-gradient-to-br from-blue-500/10 to-blue-500/5">
              <CardContent className="p-4 text-center">
                <FileText className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-extrabold">{manuelCount}</p>
                <p className="text-xs text-muted-foreground font-medium">Manuels</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-2xl font-extrabold">{totalValidated}</p>
                <p className="text-xs text-muted-foreground font-medium">Ventes validées</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <p className="text-sm font-bold mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-amber-500" /> En attente de validation</p>
                {pendingCount === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune commande en attente ✓</p>
                ) : (
                  <div className="space-y-2">
                    {pendingValidations.slice(0, 5).map((v: any) => (
                      <div key={v.id} className="flex items-center justify-between text-sm">
                        <span className="truncate">{v.livres_numeriques?.nom || '—'}</span>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{v.eleves?.prenom} {v.eleves?.nom}</Badge>
                      </div>
                    ))}
                    {pendingCount > 5 && <p className="text-xs text-muted-foreground text-center">+{pendingCount - 5} autres...</p>}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <p className="text-sm font-bold mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-500" /> Revenus numériques</p>
                <p className="text-3xl font-extrabold text-emerald-600">{totalRevenue.toLocaleString()} <span className="text-base font-medium text-muted-foreground">GNF</span></p>
                <p className="text-xs text-muted-foreground mt-1">Sur {totalValidated} vente{totalValidated > 1 ? 's' : ''} validée{totalValidated > 1 ? 's' : ''}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ─── CATALOGUE TAB ─── */}
      {activeTab === 'livres' && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher un livre..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>

          {filtered.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                <FileText className="h-4 w-4" /> Catalogue ({filtered.length})
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {filtered.map((art: any) => (
                  <Card key={art.id} className="border-0 shadow-md overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex flex-col h-full">
                        <div className="bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center py-5">
                          <FileText className="h-10 w-10 text-primary/60" />
                        </div>
                        <div className="p-3 flex flex-col flex-1">
                          <p className="text-sm font-bold truncate">{art.nom}</p>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            <Badge variant="outline" className="text-[10px]">{formatCategoryLabel(art.categorie)}</Badge>
                            {art.niveaux?.nom && <Badge variant="secondary" className="text-[10px]">{art.niveaux.nom}</Badge>}
                          </div>
                          <p className="text-xs font-semibold text-primary mt-1.5">{Number(art.prix).toLocaleString()} GNF</p>
                          {art.fichier_nom && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{art.fichier_nom}</p>}
                          <div className="flex gap-1 mt-auto pt-2">
                            {art.fichier_url && (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handlePreview(art.fichier_url, art.fichier_nom || art.nom)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(art.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center text-muted-foreground">
                <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Aucun livre numérique trouvé</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ─── VALIDATIONS TAB ─── */}
      {activeTab === 'validations' && (
        <div className="space-y-3">
          <div className="bg-muted/40 rounded-xl p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">📋 Procédure de validation</p>
            <p>Lorsqu'un parent achète un livre numérique, la commande apparaît ici. Validez pour que le livre soit accessible dans l'espace élève.</p>
            <p className="mt-1">Actualisation automatique toutes les 5 secondes.</p>
          </div>

          {loadingValidations ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : pendingValidations.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Aucune validation en attente</p>
                <p className="text-xs mt-1">Les achats de livres numériques par les parents apparaîtront ici.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2">
              {pendingValidations.map((achat: any) => {
                const eleve = achat.eleves;
                const livre = achat.livres_numeriques;
                const cmd = achat.commandes_articles;
                const articleNom = livre?.nom || cmd?.article_nom || '—';
                const prix = livre?.prix || cmd?.prix_unitaire || 0;
                return (
                  <Card key={achat.id} className="border-0 shadow-md ring-1 ring-border">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent/50 flex items-center justify-center shrink-0">
                          <Clock className="h-5 w-5 text-accent-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate">{articleNom}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {eleve?.prenom} {eleve?.nom}
                            </span>
                            {eleve?.classes?.nom && <Badge variant="secondary" className="text-[9px] px-1.5 rounded-full">{eleve.classes.nom}</Badge>}
                            <span className="text-[10px] font-semibold text-primary">{prix?.toLocaleString()} GNF</span>
                            <span className="text-[9px] text-muted-foreground">{new Date(achat.created_at).toLocaleDateString('fr-FR')}</span>
                          </div>
                        </div>
                        <Button size="sm" className="shrink-0 gap-1.5 rounded-xl" disabled={validating === achat.id} onClick={() => handleValidate(achat.id, achat.eleve_id, articleNom)}>
                          {validating === achat.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          Valider
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── HISTORIQUE TAB ─── */}
      {activeTab === 'historique' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Historique des 50 dernières validations de livres numériques.</p>
          {validationHistory.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center text-muted-foreground">
                <History className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Aucune validation effectuée</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2">
              {validationHistory.map((v: any) => {
                const eleve = v.eleves;
                const livre = v.livres_numeriques;
                return (
                  <Card key={v.id} className="border-0 shadow-sm">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate">{livre?.nom || '—'}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-muted-foreground">{eleve?.prenom} {eleve?.nom}</span>
                            {eleve?.classes?.nom && <Badge variant="secondary" className="text-[9px] px-1.5 rounded-full">{eleve.classes.nom}</Badge>}
                            <Badge variant="outline" className="text-[9px] px-1.5 rounded-full">{formatCategoryLabel(livre?.categorie)}</Badge>
                            <span className="text-[10px] font-semibold text-emerald-600">{(livre?.prix || 0).toLocaleString()} GNF</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {v.valide_at ? new Date(v.valide_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

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
                  <DialogDescription>{addStatus === 'success' ? 'Le livre est enregistré et le fichier numérique est disponible dans le catalogue.' : 'Ajoutez un roman ou un manuel avec son fichier PDF ou EPUB.'}</DialogDescription>
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
                <div className="space-y-1"><p className="text-sm font-semibold">Fichier numérique</p><p className="text-xs text-muted-foreground">Formats acceptés : PDF ou EPUB</p></div>
                <input ref={addFileRef} type="file" accept=".pdf,.epub" className="hidden" onChange={e => { setAddFile(e.target.files?.[0] || null); setAddStatus('idle'); }} />
                <Button type="button" variant="outline" className="h-auto w-full justify-start rounded-3xl border-dashed px-4 py-5 text-left" onClick={() => addFileRef.current?.click()}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Upload className="h-5 w-5" /></div>
                    <div className="min-w-0"><p className="font-medium">{addFile ? 'Fichier prêt à envoyer' : 'Choisir un fichier'}</p><p className="truncate text-xs text-muted-foreground">{addFile ? addFile.name : 'Touchez ici pour sélectionner le PDF/EPUB'}</p></div>
                  </div>
                </Button>
                <div className="space-y-3 rounded-2xl bg-muted/40 p-3">
                  <div className="flex items-center justify-between gap-3"><span className="text-xs font-medium text-muted-foreground">État du fichier</span><Badge variant={addFile ? 'default' : 'secondary'} className="rounded-full">{addFile ? (isPdfFile(addFile.name) ? 'PDF prêt' : 'EPUB prêt') : 'Aucun fichier'}</Badge></div>
                  <div className="flex items-start gap-2 text-sm"><FileText className="mt-0.5 h-4 w-4 text-primary" /><p className="text-muted-foreground">{addStatus === 'uploading' ? 'Téléversement du fichier et enregistrement du livre en cours...' : 'Après validation, une confirmation affichera que le PDF a bien été téléversé.'}</p></div>
                </div>
                <Button className="w-full gap-2 rounded-2xl" disabled={adding || !addFile} onClick={handleAddBook}>
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {adding ? 'Ajout en cours...' : 'Ajouter le livre'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => { setPreviewUrl(null); setPreviewName(''); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4" /> {previewName}
              <a href={previewUrl || ''} target="_blank" rel="noopener noreferrer" className="ml-auto"><Button size="sm" variant="outline" className="gap-1.5"><Download className="h-3.5 w-3.5" /> Télécharger</Button></a>
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-2">
            {previewUrl && isPdfFile(previewName, previewUrl) ? (
              <iframe src={`https://docs.google.com/gview?url=${encodeURIComponent(previewUrl)}&embedded=true`} className="w-full h-[70vh] rounded-lg border" />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <FileText className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">Aperçu non disponible pour ce format</p>
                <a href={previewUrl || ''} target="_blank" rel="noopener noreferrer" className="mt-3"><Button variant="outline" className="gap-2"><Download className="h-4 w-4" /> Télécharger le fichier</Button></a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
