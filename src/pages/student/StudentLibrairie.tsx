import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { StudentLayout } from '@/components/StudentLayout';
import { BookOpen, Download, Eye, Loader2, Lock, ShoppingBag, FileText, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface LibrairieArticle {
  id: string;
  nom: string;
  categorie: string;
  prix: number;
  stock: number;
  fichier_url: string | null;
  fichier_nom: string | null;
  purchased: boolean;
}

export default function StudentLibrairie() {
  const { session } = useStudentAuth();
  const [articles, setArticles] = useState<LibrairieArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'purchased' | 'available'>('all');

  useEffect(() => {
    if (!session) return;
    fetchLibrairie();
  }, [session]);

  const fetchLibrairie = async () => {
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ token: session!.token, action: 'librairie' }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setArticles(data.articles || []);
    } catch (err: any) {
      toast.error(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const filtered = articles.filter(a => {
    const matchSearch = `${a.nom} ${a.categorie}`.toLowerCase().includes(search.toLowerCase());
    if (activeFilter === 'purchased') return matchSearch && a.purchased;
    if (activeFilter === 'available') return matchSearch && a.fichier_url && !a.purchased;
    return matchSearch;
  });

  const purchasedCount = articles.filter(a => a.purchased).length;
  const digitalCount = articles.filter(a => a.fichier_url).length;

  const categories = [...new Set(filtered.map(a => a.categorie))].sort();

  return (
    <StudentLayout>
      <div className="space-y-5 pb-24">
        {/* Header */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mx-auto mb-3 shadow-lg">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-extrabold">Ma Bibliothèque</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {purchasedCount} livre{purchasedCount > 1 ? 's' : ''} acheté{purchasedCount > 1 ? 's' : ''} • Romans & manuels numériques
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un livre..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {([
            { key: 'all', label: 'Tous', count: articles.length },
            { key: 'purchased', label: '📖 Mes livres', count: purchasedCount },
            { key: 'available', label: '🆕 Disponibles', count: digitalCount },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 ${
                activeFilter === f.key
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted/60 text-muted-foreground'
              }`}
            >
              {f.label}
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 rounded-full">{f.count}</Badge>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-0 shadow-md rounded-2xl">
            <CardContent className="py-16 text-center text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Aucun livre trouvé</p>
            </CardContent>
          </Card>
        ) : (
          categories.map(cat => {
            const catArticles = filtered.filter(a => a.categorie === cat);
            if (catArticles.length === 0) return null;
            return (
              <div key={cat} className="space-y-2">
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  📂 {cat}
                  <Badge variant="secondary" className="text-[10px]">{catArticles.length}</Badge>
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {catArticles.map((art, i) => (
                    <motion.div
                      key={art.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <Card className={`border-0 shadow-md rounded-2xl overflow-hidden transition-all ${art.purchased ? 'ring-1 ring-emerald-200 dark:ring-emerald-800' : ''}`}>
                        <CardContent className="p-0">
                          <div className="flex items-center gap-3 p-3.5">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                              art.purchased
                                ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                                : art.fichier_url
                                  ? 'bg-gradient-to-br from-purple-500 to-violet-600'
                                  : 'bg-gradient-to-br from-gray-400 to-gray-500'
                            }`}>
                              {art.purchased ? (
                                <BookOpen className="h-5 w-5 text-white" />
                              ) : art.fichier_url ? (
                                <FileText className="h-5 w-5 text-white" />
                              ) : (
                                <Lock className="h-5 w-5 text-white" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold truncate">{art.nom}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  {art.prix.toLocaleString()} GNF
                                </span>
                                {art.purchased && (
                                  <Badge className="bg-emerald-600 text-[9px] px-1.5 py-0 rounded-full">
                                    ✓ Acheté
                                  </Badge>
                                )}
                                {!art.purchased && art.fichier_url && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded-full text-purple-600 border-purple-200">
                                    📱 Numérique
                                  </Badge>
                                )}
                                {!art.fichier_url && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded-full">
                                    Physique
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {art.purchased && art.fichier_url && (
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-9 w-9 p-0 text-primary"
                                  onClick={() => { setPreviewUrl(art.fichier_url); setPreviewName(art.fichier_nom || art.nom); }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <a href={art.fichier_url} target="_blank" rel="noopener noreferrer">
                                  <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-primary">
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </a>
                              </div>
                            )}
                            {!art.purchased && (
                              <div className="shrink-0">
                                <ShoppingBag className="h-4 w-4 text-muted-foreground/40" />
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => { setPreviewUrl(null); setPreviewName(''); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4" /> {previewName}
              <a href={previewUrl || ''} target="_blank" rel="noopener noreferrer" className="ml-auto">
                <Button size="sm" variant="outline" className="gap-1.5 rounded-xl">
                  <Download className="h-3.5 w-3.5" /> Télécharger
                </Button>
              </a>
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-2">
            {previewUrl && (previewUrl.toLowerCase().includes('.pdf') || previewUrl.includes('livres-numeriques')) ? (
              <iframe
                src={`https://docs.google.com/gview?url=${encodeURIComponent(previewUrl)}&embedded=true`}
                className="w-full h-[70vh] rounded-xl border"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <FileText className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">Aperçu non disponible pour ce format</p>
                <a href={previewUrl || ''} target="_blank" rel="noopener noreferrer" className="mt-3">
                  <Button variant="outline" className="gap-2 rounded-xl">
                    <Download className="h-4 w-4" /> Télécharger le fichier
                  </Button>
                </a>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </StudentLayout>
  );
}
