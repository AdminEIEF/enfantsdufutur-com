import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { StudentLayout } from '@/components/StudentLayout';
import { BookOpen, Download, Eye, Loader2, Clock, FileText, Search, Library, Sparkles } from 'lucide-react';
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
  statut: string;
}

export default function StudentLibrairie() {
  const { session } = useStudentAuth();
  const [articles, setArticles] = useState<LibrairieArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'valide' | 'en_attente'>('all');

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
    if (activeFilter === 'valide') return matchSearch && a.statut === 'valide';
    if (activeFilter === 'en_attente') return matchSearch && a.statut !== 'valide';
    return matchSearch;
  });

  const validatedCount = articles.filter(a => a.statut === 'valide').length;
  const pendingCount = articles.filter(a => a.statut !== 'valide').length;

  return (
    <StudentLayout>
      <div className="space-y-5 pb-24">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-accent/10 p-5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <Library className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">Ma Bibliothèque</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {validatedCount} disponible{validatedCount > 1 ? 's' : ''}
                {pendingCount > 0 && <span className="text-amber-600 font-semibold"> · {pendingCount} en attente</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un livre…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 rounded-2xl bg-muted/40 border-0 focus-visible:ring-1"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5 p-1 bg-muted/40 rounded-2xl">
          {([
            { key: 'all' as const, label: 'Tous', count: articles.length },
            { key: 'valide' as const, label: 'Disponibles', count: validatedCount },
            { key: 'en_attente' as const, label: 'En attente', count: pendingCount },
          ]).map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                activeFilter === f.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              {f.key === 'valide' && '✅'} {f.key === 'en_attente' && '⏳'} {f.label}
              {f.count > 0 && (
                <span className={`text-[10px] font-bold ${activeFilter === f.key ? 'text-primary' : 'text-muted-foreground'}`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">Chargement…</p>
          </div>
        ) : articles.length === 0 ? (
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="py-20 text-center text-muted-foreground">
              <Library className="h-14 w-14 mx-auto mb-3 opacity-15" />
              <p className="text-sm font-semibold">Aucun livre commandé</p>
              <p className="text-xs mt-1.5 max-w-xs mx-auto">Vos livres commandés par vos parents apparaîtront ici une fois validés</p>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="py-16 text-center text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-15" />
              <p className="text-sm font-semibold">Aucun résultat</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((art, i) => {
              const isValidated = art.statut === 'valide';
              const isRoman = art.categorie?.toLowerCase() === 'roman';
              const coverGradient = isValidated
                ? (isRoman ? 'from-amber-600 via-orange-500 to-yellow-400' : 'from-blue-600 via-indigo-500 to-violet-500')
                : 'from-gray-400 via-gray-500 to-gray-600';
              return (
                <motion.div
                  key={art.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="group"
                >
                  {/* Book Cover */}
                  <div className={`relative aspect-[2/3] rounded-2xl overflow-hidden shadow-md ${isValidated ? 'hover:shadow-xl' : ''} transition-all duration-300`}>
                    <div className={`absolute inset-0 bg-gradient-to-br ${coverGradient}`} />
                    {/* Decorative */}
                    <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '16px 16px' }} />
                    {/* Content */}
                    <div className="relative h-full flex flex-col p-3 text-white">
                      <div className="flex items-start justify-between">
                        <Badge className={`text-[8px] font-bold border-0 backdrop-blur-sm px-1.5 py-0 h-4 ${
                          isValidated ? 'bg-white/25 text-white' : 'bg-black/30 text-white/80'
                        }`}>
                          {isValidated ? '✅ Dispo' : '⏳ Attente'}
                        </Badge>
                        {isValidated ? (
                          <BookOpen className="h-4 w-4 opacity-40" />
                        ) : (
                          <Clock className="h-4 w-4 opacity-40" />
                        )}
                      </div>
                      <div className="flex-1 flex items-center justify-center px-1">
                        <p className="text-xs font-extrabold leading-snug text-center line-clamp-4 drop-shadow-sm">{art.nom}</p>
                      </div>
                      <div className="flex items-end justify-between gap-1">
                        <span className="text-[9px] font-bold bg-black/20 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                          {art.prix.toLocaleString()} GNF
                        </span>
                        <span className="text-[8px] opacity-70 font-medium">{isRoman ? 'Roman' : 'Manuel'}</span>
                      </div>
                    </div>

                    {/* Actions for validated books */}
                    {isValidated && art.fichier_url && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 active:opacity-100 transition-all duration-200 flex items-center justify-center gap-3">
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-10 w-10 rounded-full shadow-lg"
                          onClick={() => { setPreviewUrl(art.fichier_url); setPreviewName(art.fichier_nom || art.nom); }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <a href={art.fichier_url} target="_blank" rel="noopener noreferrer">
                          <Button size="icon" variant="secondary" className="h-10 w-10 rounded-full shadow-lg">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    )}
                  </div>
                  {/* Title below */}
                  <div className="mt-1.5 px-0.5">
                    <p className="text-xs font-bold truncate">{art.nom}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
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
                <p className="text-sm">Aperçu non disponible</p>
                <a href={previewUrl || ''} target="_blank" rel="noopener noreferrer" className="mt-3">
                  <Button variant="outline" className="gap-2 rounded-xl">
                    <Download className="h-4 w-4" /> Télécharger
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
