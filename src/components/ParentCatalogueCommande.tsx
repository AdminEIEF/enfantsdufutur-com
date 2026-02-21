import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, ShoppingBag, Plus, Minus, ShoppingCart, Loader2, Wallet, Package } from 'lucide-react';
import { toast } from 'sonner';

interface Article {
  id: string;
  nom: string;
  categorie: string;
  prix: number;
  stock: number;
  taille?: string;
  niveau_id?: string;
}

interface CartItem {
  article: Article;
  quantite: number;
}

interface Props {
  enfants: Array<{ id: string; nom: string; prenom: string; classe_id?: string }>;
  code: string;
  soldeFamille: number;
  onSuccess?: () => void;
}

export default function ParentCatalogueCommande({ enfants, code, soldeFamille, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [typeService, setTypeService] = useState<'librairie' | 'boutique'>('librairie');
  const [eleveId, setEleveId] = useState(enfants.length === 1 ? enfants[0]?.id || '' : '');
  const [catalogue, setCatalogue] = useState<Article[]>([]);
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchCatalogue = async () => {
    if (!eleveId && typeService === 'librairie' && enfants.length > 1) return;
    if (!eleveId && typeService === 'boutique') return;
    setLoadingCatalogue(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parent-data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            action: 'catalogue',
            code,
            type_service: typeService,
            eleve_id: eleveId || undefined,
          }),
        }
      );
      const data = await resp.json();
      if (resp.ok) setCatalogue(data.articles || []);
    } catch {
      // silent
    } finally {
      setLoadingCatalogue(false);
    }
  };

  useEffect(() => {
    if (open) {
      setCart([]);
      fetchCatalogue();
    }
  }, [open, typeService, eleveId]);

  const addToCart = (article: Article) => {
    setCart(prev => {
      const existing = prev.find(c => c.article.id === article.id);
      if (existing) {
        return prev.map(c => c.article.id === article.id ? { ...c, quantite: c.quantite + 1 } : c);
      }
      return [...prev, { article, quantite: 1 }];
    });
  };

  const updateQuantite = (articleId: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.article.id !== articleId) return c;
      const newQ = c.quantite + delta;
      return newQ <= 0 ? c : { ...c, quantite: newQ };
    }).filter(c => c.quantite > 0));
  };

  const removeFromCart = (articleId: string) => {
    setCart(prev => prev.filter(c => c.article.id !== articleId));
  };

  const totalPanier = cart.reduce((s, c) => s + c.article.prix * c.quantite, 0);

  const handleCommander = async () => {
    if (cart.length === 0) { toast.error('Panier vide'); return; }
    if (!eleveId) { toast.error('Sélectionnez un enfant'); return; }
    if (totalPanier > soldeFamille) {
      toast.error(`Solde insuffisant. Il manque ${(totalPanier - soldeFamille).toLocaleString()} GNF`);
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parent-data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            action: 'commander_articles',
            code,
            eleve_id: eleveId,
            type_service: typeService,
            items: cart.map(c => ({
              article_id: c.article.id,
              article_nom: c.article.nom,
              article_taille: (c.article as any).taille || null,
              quantite: c.quantite,
              prix_unitaire: c.article.prix,
            })),
            total: totalPanier,
          }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      toast.success('Commande validée ! Les articles sont réservés et en attente de retrait.');
      setCart([]);
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la commande');
    } finally {
      setSubmitting(false);
    }
  };

  const cartCount = cart.reduce((s, c) => s + c.quantite, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" /> Commander des articles
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <ShoppingCart className="h-4 w-4 mr-1" /> Catalogue
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Commander des articles
              </DialogTitle>
              <DialogDescription>
                Choisissez les articles, le montant sera débité de votre portefeuille famille.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Wallet info */}
              <div className="bg-green-50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">Solde portefeuille</span>
                </div>
                <p className="font-bold text-green-700 text-lg">{soldeFamille.toLocaleString()} GNF</p>
              </div>

              {/* Type selector */}
              <Tabs value={typeService} onValueChange={(v) => setTypeService(v as any)}>
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="librairie"><BookOpen className="h-4 w-4 mr-1" /> Librairie</TabsTrigger>
                  <TabsTrigger value="boutique"><ShoppingBag className="h-4 w-4 mr-1" /> Boutique</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Child selector */}
              {enfants.length > 1 && (
                <Select value={eleveId} onValueChange={setEleveId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un enfant" /></SelectTrigger>
                  <SelectContent>
                    {enfants.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Catalogue */}
              {loadingCatalogue ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : catalogue.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">
                  {!eleveId && enfants.length > 1 ? 'Sélectionnez un enfant pour continuer' : 'Aucun article disponible'}
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {catalogue.map(article => {
                    const inCart = cart.find(c => c.article.id === article.id);
                    return (
                      <div key={article.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{article.nom}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">{article.categorie}</Badge>
                            {(article as any).taille && (article as any).taille !== 'unique' && (
                              <span>Taille: {(article as any).taille}</span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm font-bold text-primary whitespace-nowrap">{article.prix.toLocaleString()} GNF</p>
                        {inCart ? (
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantite(article.id, -1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm font-bold">{inCart.quantite}</span>
                            <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantite(article.id, 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="secondary" className="h-7 px-2" onClick={() => addToCart(article)} disabled={article.stock <= 0}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Cart summary */}
              {cart.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" /> Panier ({cartCount} article{cartCount > 1 ? 's' : ''})
                  </h4>
                  {cart.map(c => (
                    <div key={c.article.id} className="flex items-center justify-between text-sm">
                      <span className="truncate flex-1">{c.article.nom} × {c.quantite}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{(c.article.prix * c.quantite).toLocaleString()} GNF</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeFromCart(c.article.id)}>×</Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t font-bold">
                    <span>Total</span>
                    <span className={totalPanier > soldeFamille ? 'text-destructive' : 'text-primary'}>
                      {totalPanier.toLocaleString()} GNF
                    </span>
                  </div>
                  {totalPanier > soldeFamille && (
                    <p className="text-xs text-destructive">Solde insuffisant. Rechargez votre portefeuille.</p>
                  )}
                  <Button onClick={handleCommander} disabled={submitting || totalPanier > soldeFamille} className="w-full">
                    {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
                    Valider la commande ({totalPanier.toLocaleString()} GNF)
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
