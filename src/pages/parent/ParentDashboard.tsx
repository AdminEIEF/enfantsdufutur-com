import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NotificationBell } from '@/components/NotificationBell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useParentAuth } from '@/hooks/useParentAuth';
import {
  GraduationCap, LogOut, Wallet, TrendingDown, CreditCard, Users,
  ChevronRight, UtensilsCrossed, BookOpen, Download, Loader2, MessageCircle, Smartphone, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { AIChatBubble } from '@/components/AIChatBubble';
import ParentPaymentDialog from '@/components/ParentPaymentDialog';
import ParentDevisInscription from '@/components/ParentDevisInscription';
import ParentCantineOrdre from '@/components/ParentCantineOrdre';

import ParentCatalogueCommande from '@/components/ParentCatalogueCommande';

const MOIS_SCOLAIRES = ['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'];

export default function ParentDashboard() {
  const { session, logout } = useParentAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [dashData, setDashData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);

  useEffect(() => {
    if (!session) return;
    fetchDashboard();
    // Check payment return
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') toast.success('Paiement initié avec succès ! Vous recevrez une confirmation.');
    if (paymentStatus === 'cancelled') toast.error('Paiement annulé.');
  }, [session]);

  const fetchDashboard = async () => {
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parent-data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ code: session!.token, action: 'dashboard' }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) {
        if (resp.status === 401) { logout(); navigate('/parent', { replace: true }); return; }
        throw new Error(data.error);
      }
      setDashData(data);
    } catch (err: any) {
      toast.error(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  if (!session) { navigate('/parent', { replace: true }); return null; }

  // Calculate financial summary
  const famille = session.famille;
  const eleves = dashData?.eleves || session.eleves;
  const paiements = dashData?.paiements || [];

  let totalScolariteAnnuel = 0;
  let totalTransportAnnuel = 0;
  let totalPayeScolarite = 0;
  let totalPayeTransport = 0;
  let totalPayeCantine = 0;
  let totalSoldeCantine = 0;

  eleves.forEach((e: any) => {
    const frais = e.classes?.niveaux?.frais_scolarite || 0;
    totalScolariteAnnuel += frais;
    // Transport: 10 mois
    if (e.zones_transport || e.zone_transport_id) {
      const zt = e.zones_transport;
      if (zt) totalTransportAnnuel += (zt.prix_mensuel || 0) * 10;
    }
    totalSoldeCantine += e.solde_cantine || 0;
  });

  paiements.forEach((p: any) => {
    if (p.type_paiement === 'scolarite') totalPayeScolarite += p.montant;
    else if (p.type_paiement === 'transport') totalPayeTransport += p.montant;
    else if (p.type_paiement === 'cantine') totalPayeCantine += p.montant;
  });

  const resteScolarite = totalScolariteAnnuel - totalPayeScolarite;
  const resteTransport = totalTransportAnnuel - totalPayeTransport;
  const resteTotal = resteScolarite + resteTransport;
  const totalPaye = totalPayeScolarite + totalPayeTransport + totalPayeCantine;

  // Current month installment
  const currentMonth = new Date().getMonth(); // 0=Jan
  const moisIndex = currentMonth >= 8 ? currentMonth - 8 : currentMonth + 4; // Sep=0, Oct=1...
  const moisActuel = MOIS_SCOLAIRES[Math.min(moisIndex, 9)] || MOIS_SCOLAIRES[0];
  const mensualiteScolarite = totalScolariteAnnuel > 0 ? Math.ceil(totalScolariteAnnuel / 10) : 0;

  const handleLogout = () => { logout(); navigate('/parent', { replace: true }); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
            <div className="min-w-0">
              <h1 className="font-bold text-xs sm:text-sm leading-tight truncate">Espace Parent</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Famille {famille.nom_famille}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <NotificationBell
              mode="parent"
              targetId={famille.id}
              token={session.token}
              onViewAll={() => navigate('/parent/notifications')}
            />
            <Button size="sm" className="text-xs px-2 sm:px-3 h-8" onClick={() => setPaymentOpen(true)}>
              <Smartphone className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" /> Payer
            </Button>
            <Button variant="ghost" size="sm" className="text-xs px-2 sm:px-3 h-8" onClick={handleLogout}>
              <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline ml-1">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Financial Summary Cards */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <Card className="col-span-2 border-primary/20 bg-primary/5">
                <CardContent className="pt-3 sm:pt-4 pb-2 sm:pb-3 px-3 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">Reste à payer</p>
                      <p className="text-xl sm:text-2xl font-bold text-primary truncate">{resteTotal.toLocaleString()} GNF</p>
                    </div>
                    <Wallet className="h-8 w-8 sm:h-10 sm:w-10 text-primary/30 shrink-0" />
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    Mensualité {moisActuel} : <span className="font-semibold text-foreground">{mensualiteScolarite.toLocaleString()} GNF</span>
                  </p>
                </CardContent>
              </Card>

              {/* Portefeuille famille */}
              <Card className="col-span-2 border-green-200 bg-green-50/50">
                <CardContent className="pt-3 sm:pt-4 pb-2 sm:pb-3 px-3 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">💰 Portefeuille Famille</p>
                      <p className="text-xl sm:text-2xl font-bold text-green-700 truncate">{(dashData?.solde_famille || 0).toLocaleString()} GNF</p>
                    </div>
                    <Wallet className="h-8 w-8 sm:h-10 sm:w-10 text-green-300 shrink-0" />
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    Solde rechargeable pour achats boutique, librairie, cantine
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-3 sm:pt-4 pb-2 sm:pb-3 px-3 sm:px-6">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Scolarité payée</p>
                  <p className="text-base sm:text-lg font-bold text-green-600 truncate">{totalPayeScolarite.toLocaleString()}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">/ {totalScolariteAnnuel.toLocaleString()} GNF</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-3 sm:pt-4 pb-2 sm:pb-3 px-3 sm:px-6">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Transport payé</p>
                  <p className="text-base sm:text-lg font-bold text-orange-600 truncate">{totalPayeTransport.toLocaleString()}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">/ {totalTransportAnnuel.toLocaleString()} GNF</p>
                </CardContent>
              </Card>
            </div>

            {/* Children Cards */}
            <div className="space-y-2 sm:space-y-3">
              <h2 className="font-semibold flex items-center gap-2 text-sm sm:text-base">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" /> Mes enfants
              </h2>
              {eleves.map((enfant: any) => (
                <Card
                  key={enfant.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/parent/enfant/${enfant.id}`)}
                >
                  <CardContent className="pt-3 sm:pt-4 pb-2 sm:pb-3 px-3 sm:px-6">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        {enfant.photo_url ? (
                          <img src={enfant.photo_url} alt="" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs sm:text-sm shrink-0">
                            {enfant.prenom[0]}{enfant.nom[0]}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-sm sm:text-base truncate">{enfant.prenom} {enfant.nom}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                            {enfant.classes?.niveaux?.cycles?.nom} — {enfant.classes?.niveaux?.nom} — {enfant.classes?.nom}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        {enfant.option_cantine && (
                          <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 sm:px-2">
                            <UtensilsCrossed className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                            {(enfant.solde_cantine || 0).toLocaleString()}
                          </Badge>
                        )}
                        <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Catalogue & Commande d'articles */}
            <ParentCatalogueCommande
              enfants={eleves}
              code={session.token}
              soldeFamille={dashData?.solde_famille || 0}
              onSuccess={fetchDashboard}
            />

            {/* Cantine Recharge */}
            <ParentCantineOrdre
              enfants={eleves}
              code={session.token}
              onSuccess={fetchDashboard}
            />


            {/* Payment History */}
            <Tabs defaultValue="devis">
              <TabsList className="w-full grid grid-cols-3 h-9 sm:h-10">
                <TabsTrigger value="devis" className="text-xs sm:text-sm px-1 sm:px-3">
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" /> Devis
                </TabsTrigger>
                <TabsTrigger value="historique" className="text-xs sm:text-sm px-1 sm:px-3">
                  <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" /> Hist.
                </TabsTrigger>
                <TabsTrigger value="echeancier" className="text-xs sm:text-sm px-1 sm:px-3">
                  <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" /> Éch.
                </TabsTrigger>
              </TabsList>

              <TabsContent value="devis" className="mt-4">
                <ParentDevisInscription
                  eleves={eleves}
                  paiements={paiements}
                  tarifs={dashData?.tarifs || []}
                  nbEnfantsFamille={eleves.length}
                />
              </TabsContent>

              <TabsContent value="historique" className="mt-4">
                {paiements.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Aucun paiement enregistré</p>
                ) : (
                  <div className="space-y-2">
                    {paiements.slice(0, 20).map((p: any) => {
                      const enfant = eleves.find((e: any) => e.id === p.eleve_id);
                      return (
                        <Card key={p.id}>
                          <CardContent className="py-2 sm:py-3 px-3 sm:px-6 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                <p className="text-xs sm:text-sm font-medium truncate">
                                  {p.type_paiement === 'scolarite' ? '🎓' : p.type_paiement === 'transport' ? '🚌' : p.type_paiement === 'cantine' ? '🍽️' : p.type_paiement === 'fournitures' ? '📚' : p.type_paiement === 'librairie' ? '📚' : p.type_paiement === 'boutique' ? '👕' : p.type_paiement === 'inscription' ? '📝' : p.type_paiement === 'reinscription' ? '🔄' : '📦'}
                                  {' '}{p.type_paiement}
                                  {p.type_paiement === 'cantine' && p.mois_concerne === 'Recharge directe' && ' (directe)'}
                                  {p.type_paiement === 'cantine' && p.mois_concerne === 'Recharge ordonnée' && ' (ordonnée ✓)'}
                                  {p.mois_concerne && !p.mois_concerne.startsWith('Recharge') && ` — ${p.mois_concerne}`}
                                </p>
                                {enfant && (
                                  <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5">
                                    {enfant.prenom}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[10px] sm:text-xs text-muted-foreground">
                                {new Date(p.date_paiement).toLocaleDateString('fr-FR')} • {p.canal}
                              </p>
                            </div>
                            <p className="font-bold text-green-600 text-xs sm:text-sm whitespace-nowrap shrink-0">{p.montant.toLocaleString()} GNF</p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="echeancier" className="mt-4">
                <Card>
                  <CardContent className="pt-3 sm:pt-4 px-2 sm:px-6 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs sm:text-sm">Mois</TableHead>
                          <TableHead className="text-right text-xs sm:text-sm">Scolarité</TableHead>
                          <TableHead className="text-right text-xs sm:text-sm">Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {MOIS_SCOLAIRES.map((mois, idx) => {
                          const paiementsMois = paiements.filter(
                            (p: any) => p.type_paiement === 'scolarite' && p.mois_concerne?.includes(mois)
                          );
                          const payeMois = paiementsMois.reduce((s: number, p: any) => s + p.montant, 0);
                          const isPaid = payeMois >= mensualiteScolarite;
                          const isCurrentMonth = idx === moisIndex;
                          return (
                            <TableRow key={mois} className={isCurrentMonth ? 'bg-primary/5' : ''}>
                              <TableCell className="font-medium text-xs sm:text-sm py-2 sm:py-3">
                                {mois} {isCurrentMonth && <Badge variant="outline" className="ml-1 text-[10px] sm:text-xs">Actuel</Badge>}
                              </TableCell>
                              <TableCell className="text-right text-xs sm:text-sm py-2 sm:py-3 whitespace-nowrap">{mensualiteScolarite.toLocaleString()} GNF</TableCell>
                              <TableCell className="text-right py-2 sm:py-3">
                                {payeMois > 0 ? (
                                  <Badge variant={isPaid ? 'default' : 'secondary'} className={`text-[10px] sm:text-xs ${isPaid ? 'bg-green-600' : ''}`}>
                                    {isPaid ? '✓ Payé' : `${payeMois.toLocaleString()} / ${mensualiteScolarite.toLocaleString()}`}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px] sm:text-xs">
                                    Non payé
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      <AIChatBubble />

      <ParentPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        enfants={session.eleves}
        code={session.token}
        onSuccess={fetchDashboard}
        soldeFamille={dashData?.solde_famille || 0}
      />
    </div>
  );
}
