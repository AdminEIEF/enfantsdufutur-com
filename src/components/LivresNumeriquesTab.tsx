import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Upload, FileText, Trash2, Eye, Loader2, BookOpen, Download, Plus, CheckCircle2, Clock, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const ALL_LEVELS_VALUE = '__all_levels__';

function useArticlesWithFiles() {
  return useQuery({
    queryKey: ['articles-livres-numeriques'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles' as any)
        .select('*, niveaux:niveau_id(nom)')
        .in('categorie', ['Roman', 'Manuel', 'Romans', 'Manuels'])
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
        .from('commandes_articles' as any)
        .select('*, eleves:eleve_id(nom, prenom, matricule, classe_id, classes:classe_id(nom))')
        .eq('article_type', 'librairie')
        .eq('statut', 'en_attente_validation')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 15000,
  });
}

export default function LivresNumeriquesTab() {
  const { data: articles = [], isLoading } = useArticlesWithFiles();
  const { data: niveaux = [] } = useNiveaux();
  const { data: pendingValidations = [], isLoading: loadingValidations } = usePendingValidations();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'livres' | 'validations'>('livres');

  // Add book dialog
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ nom: '', categorie: 'Roman', prix: '', stock: '0', niveau_id: ALL_LEVELS_VALUE });
  const [addFile, setAddFile] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);
  const addFileRef = useRef<HTMLInputElement>(null);
  const [validating, setValidating] = useState<string | null>(null);

  const filtered = articles.filter((a: any) =>
    `${a.nom} ${a.categorie}`.toLowerCase().includes(search.toLowerCase())
  );

  const withFile = filtered.filter((a: any) => a.fichier_url);
  const withoutFile = filtered.filter((a: any) => !a.fichier_url);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedArticleId) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'epub'].includes(ext || '')) {
      toast.error('Format non supporté. Utilisez PDF ou EPUB.');
      return;
    }

    setUploading(selectedArticleId);
    try {
      const path = `articles/${selectedArticleId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage
        .from('livres-numeriques')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: signedData } = await supabase.storage
        .from('livres-numeriques')
        .createSignedUrl(path, 31536000);

      if (!signedData?.signedUrl) throw new Error("Échec de la signature");

      const { error: updErr } = await supabase
        .from('articles' as any)
        .update({ fichier_url: signedData.signedUrl, fichier_nom: file.name } as any)
        .eq('id', selectedArticleId);
      if (updErr) throw updErr;

      toast.success('Fichier numérique uploadé !');
      queryClient.invalidateQueries({ queryKey: ['articles-livres-numeriques'] });
    } catch (err: any) {
      toast.error(err.message || 'Erreur upload');
    } finally {
      setUploading(null);
      setSelectedArticleId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (articleId: string) => {
    try {
      const { error } = await supabase
        .from('articles' as any)
        .update({ fichier_url: null, fichier_nom: null } as any)
        .eq('id', articleId);
      if (error) throw error;
      toast.success('Fichier numérique supprimé');
      queryClient.invalidateQueries({ queryKey: ['articles-livres-numeriques'] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handlePreview = (url: string, name: string) => {
    setPreviewUrl(url);
    setPreviewName(name);
  };

  const handleValidate = async (commandeId: string, eleveId: string, articleNom: string) => {
    setValidating(commandeId);
    try {
      // Find the matching article by name
      const matchingArticle = articles.find((a: any) => a.nom === articleNom && a.fichier_url);
      
      if (!matchingArticle) {
        toast.error('Article numérique introuvable. Vérifiez que le fichier est uploadé.');
        return;
      }

      // Create ventes_articles entry to grant access
      const { error: venteErr } = await supabase
        .from('ventes_articles' as any)
        .insert({
          eleve_id: eleveId,
          article_id: matchingArticle.id,
          quantite: 1,
          prix_unitaire: matchingArticle.prix,
        } as any);
      if (venteErr) throw venteErr;

      // Update commande status
      const { error: updErr } = await supabase
        .from('commandes_articles' as any)
        .update({ statut: 'valide' } as any)
        .eq('id', commandeId);
      if (updErr) throw updErr;

      toast.success(`Livre "${articleNom}" validé pour l'élève !`);
      queryClient.invalidateQueries({ queryKey: ['pending-digital-validations'] });
    } catch (err: any) {
      toast.error(err.message || 'Erreur de validation');
    } finally {
      setValidating(null);
    }
  };

  const handleAddBook = async () => {
    if (!addForm.nom.trim()) { toast.error('Nom requis'); return; }
    if (!addForm.prix || isNaN(Number(addForm.prix))) { toast.error('Prix invalide'); return; }
    if (!addFile) { toast.error('Ajoutez le fichier numérique du livre.'); return; }

    const ext = addFile.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'epub'].includes(ext || '')) {
      toast.error('Format non supporté. Utilisez PDF ou EPUB.');
      return;
    }

    setAdding(true);
    let articleId: string | null = null;
    let uploadedPath: string | null = null;

    try {
      const insertData: any = {
        nom: addForm.nom.trim(),
        categorie: addForm.categorie,
        prix: Number(addForm.prix),
        stock: Number(addForm.stock) || 0,
        niveau_id: addForm.niveau_id === ALL_LEVELS_VALUE ? null : addForm.niveau_id,
      };

      const { data: newArt, error: insErr } = await supabase
        .from('articles' as any)
        .insert(insertData as any)
        .select('id')
        .single();
      if (insErr) throw insErr;

      articleId = (newArt as any).id;

      uploadedPath = `articles/${articleId}/${Date.now()}_${addFile.name}`;
      const { error: upErr } = await supabase.storage
        .from('livres-numeriques')
        .upload(uploadedPath, addFile, { upsert: true });
      if (upErr) throw upErr;

      const { data: signedData, error: signedErr } = await supabase.storage
        .from('livres-numeriques')
        .createSignedUrl(uploadedPath, 31536000);
      if (signedErr) throw signedErr;
      if (!signedData?.signedUrl) throw new Error('Impossible de générer le lien du fichier.');

      const { error: updateErr } = await supabase
        .from('articles' as any)
        .update({ fichier_url: signedData.signedUrl, fichier_nom: addFile.name } as any)
        .eq('id', articleId);
      if (updateErr) throw updateErr;

      toast.success('Livre numérique ajouté !');
      queryClient.invalidateQueries({ queryKey: ['articles-livres-numeriques'] });
      setShowAdd(false);
      setAddForm({ nom: '', categorie: 'Roman', prix: '', stock: '0', niveau_id: ALL_LEVELS_VALUE });
      setAddFile(null);
    } catch (err: any) {
      if (uploadedPath) {
        await supabase.storage.from('livres-numeriques').remove([uploadedPath]);
      }
      if (articleId) {
        await supabase.from('articles' as any).delete().eq('id', articleId);
      }
      toast.error(err.message || 'Erreur lors de l\'ajout du livre numérique');
    } finally {
      setAdding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <input ref={fileInputRef} type="file" accept=".pdf,.epub" className="hidden" onChange={handleUpload} />

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Livres Numériques
          </h2>
          <p className="text-sm text-muted-foreground">
            Gérez vos romans et manuels numériques (PDF/EPUB).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {withFile.length}/{articles.length} avec fichier
          </Badge>
          <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        </div>
      </div>

      {/* Tabs: Livres / Validations */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('livres')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'livres'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'bg-muted/60 text-muted-foreground hover:bg-muted'
          }`}
        >
          <FileText className="h-4 w-4" /> Catalogue
        </button>
        <button
          onClick={() => setActiveTab('validations')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all relative ${
            activeTab === 'validations'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'bg-muted/60 text-muted-foreground hover:bg-muted'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" /> Validations
          {pendingValidations.length > 0 && (
            <Badge className="absolute -top-1.5 -right-1.5 h-5 min-w-5 flex items-center justify-center text-[10px] px-1 rounded-full bg-destructive text-destructive-foreground">
              {pendingValidations.length}
            </Badge>
          )}
        </button>
      </div>

      {activeTab === 'livres' && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un livre..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Articles avec fichier */}
          {withFile.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                <FileText className="h-4 w-4" /> Avec fichier numérique ({withFile.length})
              </h3>
              <div className="grid gap-2">
                {withFile.map((art: any) => (
                  <Card key={art.id} className="border-0 shadow-sm">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate">{art.nom}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{art.categorie}</Badge>
                          {art.niveaux?.nom && <Badge variant="secondary" className="text-[10px]">{art.niveaux.nom}</Badge>}
                          <span className="text-[10px] text-muted-foreground truncate">{art.fichier_nom}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handlePreview(art.fichier_url, art.fichier_nom || art.nom)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDelete(art.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Articles sans fichier */}
          {withoutFile.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                <Upload className="h-4 w-4" /> Sans fichier numérique ({withoutFile.length})
              </h3>
              <div className="grid gap-2">
                {withoutFile.map((art: any) => (
                  <Card key={art.id} className="border-0 shadow-sm">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate">{art.nom}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{art.categorie}</Badge>
                          {art.niveaux?.nom && <Badge variant="secondary" className="text-[10px]">{art.niveaux.nom}</Badge>}
                          <span className="text-[10px] text-muted-foreground">Stock: {art.stock}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 gap-1.5"
                        disabled={uploading === art.id}
                        onClick={() => {
                          setSelectedArticleId(art.id);
                          setTimeout(() => fileInputRef.current?.click(), 50);
                        }}
                      >
                        {uploading === art.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Upload
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── VALIDATIONS TAB ─── */}
      {activeTab === 'validations' && (
        <div className="space-y-3">
          <div className="bg-muted/40 rounded-xl p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">📋 Procédure de validation</p>
            <p>Lorsqu'un parent achète un livre numérique, la commande apparaît ici. Validez pour que le livre soit accessible dans l'espace élève.</p>
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
              {pendingValidations.map((cmd: any) => {
                const eleve = cmd.eleves;
                return (
                  <Card key={cmd.id} className="border-0 shadow-md ring-1 ring-amber-200 dark:ring-amber-800">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                          <Clock className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate">{cmd.article_nom}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {eleve?.prenom} {eleve?.nom}
                            </span>
                            {eleve?.classes?.nom && (
                              <Badge variant="secondary" className="text-[9px] px-1.5 rounded-full">{eleve.classes.nom}</Badge>
                            )}
                            <span className="text-[10px] font-semibold text-primary">{cmd.prix_unitaire?.toLocaleString()} GNF</span>
                            <span className="text-[9px] text-muted-foreground">
                              {new Date(cmd.created_at).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="shrink-0 gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700"
                          disabled={validating === cmd.id}
                          onClick={() => handleValidate(cmd.id, cmd.eleve_id, cmd.article_nom)}
                        >
                          {validating === cmd.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
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

      {/* Add Book Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" /> Ajouter un livre numérique
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nom du livre *</Label>
              <Input
                placeholder="Ex: Le Petit Prince"
                value={addForm.nom}
                onChange={e => setAddForm(f => ({ ...f, nom: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Catégorie *</Label>
                <Select value={addForm.categorie} onValueChange={v => setAddForm(f => ({ ...f, categorie: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Roman">Roman</SelectItem>
                    <SelectItem value="Manuel">Manuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prix (GNF) *</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={addForm.prix}
                  onChange={e => setAddForm(f => ({ ...f, prix: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Niveau</Label>
                <Select value={addForm.niveau_id} onValueChange={v => setAddForm(f => ({ ...f, niveau_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Tous niveaux" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_LEVELS_VALUE}>Tous niveaux</SelectItem>
                    {niveaux.map((n: any) => (
                      <SelectItem key={n.id} value={n.id}>{n.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Stock physique</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={addForm.stock}
                  onChange={e => setAddForm(f => ({ ...f, stock: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fichier numérique (PDF/EPUB)</Label>
              <input
                ref={addFileRef}
                type="file"
                accept=".pdf,.epub"
                className="hidden"
                onChange={e => setAddFile(e.target.files?.[0] || null)}
              />
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => addFileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {addFile ? addFile.name : 'Choisir un fichier'}
              </Button>
            </div>
            <Button className="w-full gap-2" disabled={adding || !addFile} onClick={handleAddBook}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Ajouter le livre
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => { setPreviewUrl(null); setPreviewName(''); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4" /> {previewName}
              <a href={previewUrl || ''} target="_blank" rel="noopener noreferrer" className="ml-auto">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Télécharger
                </Button>
              </a>
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-2">
            {previewUrl && previewUrl.includes('.pdf') ? (
              <iframe
                src={`https://docs.google.com/gview?url=${encodeURIComponent(previewUrl)}&embedded=true`}
                className="w-full h-[70vh] rounded-lg border"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <FileText className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">Aperçu non disponible pour ce format</p>
                <a href={previewUrl || ''} target="_blank" rel="noopener noreferrer" className="mt-3">
                  <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" /> Télécharger le fichier
                  </Button>
                </a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
