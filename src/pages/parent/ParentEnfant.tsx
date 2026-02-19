import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useParentAuth } from '@/hooks/useParentAuth';
import {
  ArrowLeft, UtensilsCrossed, BookOpen, ShoppingBag, FileText,
  Loader2, CheckCircle2, Clock, Package, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { generateBonRecuperation } from '@/lib/generateBonRecuperation';

export default function ParentEnfant() {
  const { id } = useParams<{ id: string }>();
  const { session, logout } = useParentAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const enfant = session?.eleves.find((e) => e.id === id);

  useEffect(() => {
    if (!session || !id) return;
    fetchEnfantData();
  }, [session, id]);

  const fetchEnfantData = async () => {
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parent-data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ code: session!.code, action: 'enfant', eleve_id: id }),
        }
      );
      const result = await resp.json();
      if (!resp.ok) {
        if (resp.status === 401) { logout(); navigate('/parent', { replace: true }); return; }
        throw new Error(result.error);
      }
      setData(result);
    } catch (err: any) {
      toast.error(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  if (!session || !enfant) {
    navigate('/parent', { replace: true });
    return null;
  }

  const repas = data?.repas || [];
  const ventesArticles = data?.ventesArticles || [];
  const boutiqueVentes = data?.boutiqueVentes || [];
  const articlesNiveau = data?.articlesNiveau || [];
  const bulletinPublications = data?.bulletinPublications || [];
  const commandesArticles = data?.commandesArticles || [];

  // Determine librairie status per article
  const articlesAchetes = new Set(ventesArticles.map((v: any) => v.article_id));
  const librairieFull = articlesNiveau.length > 0 && articlesNiveau.every((a: any) => articlesAchetes.has(a.id));

  // Boutique items from ventes
  const allBoutiqueItems = boutiqueVentes.flatMap((v: any) => 
    (v.boutique_vente_items || []).map((item: any) => ({
      ...item,
      date: v.created_at,
    }))
  );

  // Commandes groupées par statut
  const commandesPaye = commandesArticles.filter((c: any) => c.statut === 'paye');
  const commandesLivrees = commandesArticles.filter((c: any) => c.statut === 'livre');

  const handleDownloadBonRecuperation = () => {
    if (commandesLivrees.length === 0) return;
    const now = new Date();
    generateBonRecuperation({
      eleve: `${enfant.prenom} ${enfant.nom}`,
      matricule: enfant.matricule || '',
      classe: enfant.classes?.nom || '—',
      articles: commandesLivrees.map((c: any) => ({
        nom: c.article_nom,
        taille: c.article_taille,
        quantite: c.quantite,
        prixUnitaire: Number(c.prix_unitaire),
      })),
      totalMontant: commandesLivrees.reduce((s: number, c: any) => s + Number(c.prix_unitaire) * c.quantite, 0),
      date: now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
      heure: commandesLivrees[0]?.livre_at
        ? new Date(commandesLivrees[0].livre_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        : now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/parent/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            {enfant.photo_url ? (
              <img src={enfant.photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {enfant.prenom[0]}{enfant.nom[0]}
              </div>
            )}
            <div>
              <h1 className="font-bold text-sm leading-tight">{enfant.prenom} {enfant.nom}</h1>
              <p className="text-xs text-muted-foreground">
                {enfant.classes?.niveaux?.cycles?.nom} — {enfant.classes?.niveaux?.nom} — {enfant.classes?.nom}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="commandes">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="commandes">
                <Package className="h-4 w-4 mr-1" /> Commandes
                {commandesPaye.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5 bg-orange-100 text-orange-800">{commandesPaye.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="cantine">
                <UtensilsCrossed className="h-4 w-4 mr-1" /> Cantine
              </TabsTrigger>
              <TabsTrigger value="fournitures">
                <BookOpen className="h-4 w-4 mr-1" /> Achats
              </TabsTrigger>
              <TabsTrigger value="bulletins">
                <FileText className="h-4 w-4 mr-1" /> Bulletins
                {bulletinPublications.length > 0 && (
                  <Badge variant="default" className="ml-1 text-xs h-5 px-1.5">{bulletinPublications.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Commandes / Suivi Articles */}
            <TabsContent value="commandes" className="mt-4 space-y-4">
              {commandesArticles.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>Aucune commande d'articles enregistrée</p>
                </CardContent></Card>
              ) : (
                <>
                  {/* En attente de retrait */}
                  {commandesPaye.length > 0 && (
                    <Card className="border-orange-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
                          <Clock className="h-4 w-4" /> En attente de retrait ({commandesPaye.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-xs text-muted-foreground mb-2">
                          Ces articles sont payés et peuvent être récupérés à la boutique de l'école.
                        </p>
                        {commandesPaye.map((c: any) => (
                          <div key={c.id} className="flex items-center justify-between p-2 rounded border bg-orange-50/50">
                            <div>
                              <p className="text-sm font-medium">{c.article_nom}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {c.article_taille && <span>Taille: {c.article_taille}</span>}
                                <span>Qté: {c.quantite}</span>
                              </div>
                            </div>
                            <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">
                              <Clock className="h-3 w-3 mr-1" /> Payé
                            </Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Livrés */}
                  {commandesLivrees.length > 0 && (
                    <Card className="border-green-200">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                            <CheckCircle2 className="h-4 w-4" /> Livrés ({commandesLivrees.length})
                          </CardTitle>
                          <Button variant="outline" size="sm" onClick={handleDownloadBonRecuperation} className="text-xs gap-1">
                            <Download className="h-3 w-3" /> Bon de Récupération
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {commandesLivrees.map((c: any) => (
                          <div key={c.id} className="flex items-center justify-between p-2 rounded border bg-green-50/50">
                            <div>
                              <p className="text-sm font-medium">{c.article_nom}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {c.article_taille && <span>Taille: {c.article_taille}</span>}
                                <span>Qté: {c.quantite}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="default" className="bg-green-600 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Livré
                              </Badge>
                              {c.livre_at && (
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  {new Date(c.livre_at).toLocaleDateString('fr-FR')}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            {/* Cantine */}
            <TabsContent value="cantine" className="mt-4 space-y-4">
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="pt-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Solde cantine</p>
                    <p className="text-2xl font-bold text-green-700">{(data?.solde_cantine ?? enfant.solde_cantine ?? 0).toLocaleString()} GNF</p>
                  </div>
                  <UtensilsCrossed className="h-8 w-8 text-green-300" />
                </CardContent>
              </Card>

              <h3 className="text-sm font-semibold">Repas récents (30 derniers jours)</h3>
              {repas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun repas enregistré</p>
              ) : (
                <div className="space-y-2">
                  {repas.map((r: any) => (
                    <Card key={r.id}>
                      <CardContent className="py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{r.plat_nom || 'Repas'}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(r.date_repas).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-red-600">-{r.montant_debite.toLocaleString()} GNF</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Fournitures (Librairie + Boutique) */}
            <TabsContent value="fournitures" className="mt-4 space-y-4">
              {/* Librairie */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <BookOpen className="h-4 w-4" /> Librairie / Fournitures
                  </h3>
                  <Badge variant={librairieFull ? 'default' : 'secondary'} className={librairieFull ? 'bg-green-600' : ''}>
                    {librairieFull ? 'Complet' : 'Partiel'}
                  </Badge>
                </div>

                {articlesNiveau.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucun article prévu pour ce niveau</p>
                ) : (
                  <div className="space-y-1">
                    {articlesNiveau.map((article: any) => {
                      const acheté = articlesAchetes.has(article.id);
                      return (
                        <div key={article.id} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-card border">
                          {acheté ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          ) : (
                            <Clock className="h-4 w-4 text-orange-500 shrink-0" />
                          )}
                          <span className="text-sm flex-1">{article.nom}</span>
                          <Badge variant="outline" className="text-xs">{article.categorie}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {acheté ? 'Récupéré' : 'En attente'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Boutique */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" /> Boutique / Uniformes
                </h3>
                {allBoutiqueItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucun achat en boutique</p>
                ) : (
                  <div className="space-y-1">
                    {allBoutiqueItems.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-card border">
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        <span className="text-sm flex-1">
                          {item.boutique_articles?.nom || 'Article'}
                          {item.boutique_articles?.taille && item.boutique_articles.taille !== 'unique' && ` (${item.boutique_articles.taille})`}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.date).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Bulletins */}
            <TabsContent value="bulletins" className="mt-4 space-y-4">
              {bulletinPublications.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      Les bulletins seront disponibles après la publication des résultats par l'administration.
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Consultez cette section régulièrement après chaque période d'examen.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {bulletinPublications.map((pub: any) => (
                    <Card key={pub.id} className="border-primary/20">
                      <CardContent className="py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">Bulletin — {pub.periodes?.nom}</p>
                            <p className="text-xs text-muted-foreground">
                              Publié le {new Date(pub.published_at).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                        <Badge variant="default" className="bg-green-600 text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Disponible
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
