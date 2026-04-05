import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Upload, FileText, Trash2, Eye, Loader2, BookOpen, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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

export default function LivresNumeriquesTab() {
  const { data: articles = [], isLoading } = useArticlesWithFiles();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

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
        .createSignedUrl(path, 31536000); // 1 year

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
            Uploadez des fichiers PDF/EPUB pour chaque article. Les élèves ayant acheté l'article y auront accès.
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {withFile.length}/{articles.length} avec fichier
        </Badge>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher un article..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Articles avec fichier */}
      {withFile.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-emerald-600 flex items-center gap-2">
            <FileText className="h-4 w-4" /> Avec fichier numérique ({withFile.length})
          </h3>
          <div className="grid gap-2">
            {withFile.map((art: any) => (
              <Card key={art.id} className="border-0 shadow-sm">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-emerald-600" />
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
