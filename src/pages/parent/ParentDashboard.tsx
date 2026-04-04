import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { NotificationBell } from '@/components/NotificationBell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useParentAuth } from '@/hooks/useParentAuth';
import {
  GraduationCap, LogOut, Wallet, TrendingDown, CreditCard, Users,
  ChevronRight, UtensilsCrossed, BookOpen, Loader2, MessageCircle, Smartphone, FileText,
  Bus, CalendarDays, Phone, Mail, MapPin, X, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { AIChatBubble } from '@/components/AIChatBubble';
import { SchoolWatermark } from '@/components/SchoolWatermark';
import ParentPaymentDialog from '@/components/ParentPaymentDialog';
import ParentDevisInscription from '@/components/ParentDevisInscription';
import ParentCantineOrdre from '@/components/ParentCantineOrdre';
import ParentCatalogueCommande from '@/components/ParentCatalogueCommande';
import { motion, AnimatePresence } from 'framer-motion';

const MOIS_SCOLAIRES = ['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'];

export default function ParentDashboard() {
  const { session, logout } = useParentAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [dashData, setDashData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [familyDetailsOpen, setFamilyDetailsOpen] = useState(false);

  useEffect(() => {
    if (!session) return;
    fetchDashboard();
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') toast.success('Paiement initié avec succès !');
    if (paymentStatus === 'cancelled') toast.error('Paiement annulé.');
  }, [session]);

  const fetchDashboard = async () => {
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parent-data`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
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

  const famille = session.famille;
  const eleves = dashData?.eleves || session.eleves;
  const paiements = dashData?.paiements || [];

  let totalScolariteAnnuel = 0;
  let totalTransportAnnuel = 0;
  let totalPayeScolarite = 0;
  let totalPayeTransport = 0;
  let totalPayeCantine = 0;

  eleves.forEach((e: any) => {
    const frais = e.classes?.niveaux?.frais_scolarite || 0;
    totalScolariteAnnuel += frais;
    if (e.zones_transport || e.zone_transport_id) {
      const zt = e.zones_transport;
      if (zt) totalTransportAnnuel += (zt.prix_mensuel || 0) * 10;
    }
  });

  paiements.forEach((p: any) => {
    if (p.type_paiement === 'scolarite') totalPayeScolarite += p.montant;
    else if (p.type_paiement === 'transport') totalPayeTransport += p.montant;
    else if (p.type_paiement === 'cantine') totalPayeCantine += p.montant;
  });

  const resteScolarite = totalScolariteAnnuel - totalPayeScolarite;
  const resteTransport = totalTransportAnnuel - totalPayeTransport;
  const resteTotal = resteScolarite + resteTransport;

  const currentMonth = new Date().getMonth();
  const moisIndex = currentMonth >= 8 ? currentMonth - 8 : currentMonth + 4;
  const moisActuel = MOIS_SCOLAIRES[Math.min(moisIndex, 9)] || MOIS_SCOLAIRES[0];
  const mensualiteScolarite = totalScolariteAnnuel > 0 ? Math.ceil(totalScolariteAnnuel / 10) : 0;

  const handleLogout = () => { logout(); navigate('/parent', { replace: true }); };

  const progressScolarite = totalScolariteAnnuel > 0 ? Math.min(100, Math.round((totalPayeScolarite / totalScolariteAnnuel) * 100)) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background relative">
      <SchoolWatermark />

      {/* ─── Header ─── */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-primary via-primary/95 to-primary shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {eleves.length > 0 && eleves[0].photo_url ? (
              <img src={eleves[0].photo_url} alt="" loading="lazy" decoding="async" className="w-10 h-10 rounded-2xl object-cover ring-2 ring-primary-foreground/30 shadow-md shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-primary-foreground/20 backdrop-blur flex items-center justify-center shrink-0 shadow-md">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            <button onClick={() => setFamilyDetailsOpen(true)} className="min-w-0 text-left hover:opacity-80 transition-opacity">
              <h1 className="font-bold text-sm text-primary-foreground leading-tight truncate">Espace Parent</h1>
              <p className="text-[11px] text-primary-foreground/60 truncate font-medium underline decoration-dotted underline-offset-2">
                Famille {famille.nom_famille} ▾
              </p>
            </button>
            {eleves.length > 1 && (
              <div className="hidden sm:flex -space-x-2 ml-1">
                {eleves.slice(1, 4).map((e: any) => (
                  e.photo_url ? (
                    <img key={e.id} src={e.photo_url} alt="" loading="lazy" decoding="async" className="w-7 h-7 rounded-full object-cover ring-2 ring-primary" />
                  ) : (
                    <div key={e.id} className="w-7 h-7 rounded-full bg-primary-foreground/20 flex items-center justify-center text-primary-foreground font-bold text-[10px] ring-2 ring-primary">
                      {e.prenom[0]}{e.nom[0]}
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <NotificationBell mode="parent" targetId={famille.id} token={session.token} onViewAll={() => navigate('/parent/notifications')} />
            <Button size="sm" className="text-xs px-3 h-9 rounded-xl bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0 backdrop-blur font-bold gap-1.5" onClick={() => setPaymentOpen(true)}>
              <Smartphone className="h-4 w-4" /> Payer
            </Button>
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10 h-9 w-9 rounded-xl" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-5 space-y-5 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* ─── Hero Financial Card ─── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <Card className="border-0 rounded-3xl overflow-hidden shadow-xl bg-gradient-to-br from-primary via-primary/90 to-accent relative">
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-primary-foreground/5 -translate-y-1/3 translate-x-1/4" />
                <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-primary-foreground/5 translate-y-1/3 -translate-x-1/4" />
                <CardContent className="relative z-10 p-5 sm:p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-xs text-primary-foreground/60 uppercase tracking-wider font-medium">Reste à payer</p>
                      <p className="text-3xl sm:text-4xl font-extrabold text-primary-foreground mt-1">{resteTotal.toLocaleString()} <span className="text-lg font-bold opacity-60">GNF</span></p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-primary-foreground/10 flex items-center justify-center">
                      <Wallet className="h-6 w-6 text-primary-foreground/70" />
                    </div>
                  </div>
                  <div className="space-y-1.5 mb-4">
                    <div className="flex justify-between text-[10px] text-primary-foreground/60 font-medium">
                      <span>Progression scolarité</span>
                      <span>{progressScolarite}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-primary-foreground/10 overflow-hidden">
                      <motion.div className="h-full rounded-full bg-primary-foreground/80" initial={{ width: 0 }} animate={{ width: `${progressScolarite}%` }} transition={{ duration: 1, ease: 'easeOut' }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm">
                    <CalendarDays className="h-4 w-4 text-primary-foreground/60 shrink-0" />
                    <p className="text-xs text-primary-foreground/80">
                      Mensualité <span className="font-bold text-primary-foreground">{moisActuel}</span> : <span className="font-extrabold text-primary-foreground">{mensualiteScolarite.toLocaleString()} GNF</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* ─── Quick Stats ─── */}
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-3 gap-2.5">
              {[
                { label: 'Portefeuille', value: (dashData?.solde_famille || 0).toLocaleString(), icon: Wallet, gradient: 'from-emerald-500 to-teal-600', suffix: 'GNF' },
                { label: 'Scolarité', value: totalPayeScolarite.toLocaleString(), icon: GraduationCap, gradient: 'from-blue-500 to-indigo-600', suffix: 'payé' },
                { label: 'Transport', value: totalPayeTransport.toLocaleString(), icon: Bus, gradient: 'from-amber-500 to-orange-600', suffix: 'payé' },
              ].map((stat, i) => (
                <motion.div key={stat.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 + i * 0.05 }}>
                  <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                    <div className={`bg-gradient-to-br ${stat.gradient} p-3 text-white`}>
                      <stat.icon className="h-4 w-4 mb-2 opacity-70" />
                      <p className="text-lg sm:text-xl font-extrabold leading-none truncate">{stat.value}</p>
                      <p className="text-[9px] sm:text-[10px] font-medium opacity-70 mt-0.5">{stat.suffix}</p>
                    </div>
                    <div className="px-3 py-1.5 bg-card">
                      <p className="text-[10px] text-muted-foreground font-medium truncate">{stat.label}</p>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </motion.div>

            {/* ─── Children Gallery ─── */}
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-3">
              <h2 className="font-bold flex items-center gap-2 text-sm sm:text-base">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                Mes enfants
                <Badge variant="secondary" className="text-[10px] ml-auto rounded-full">{eleves.length}</Badge>
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {eleves.map((enfant: any, i: number) => (
                  <motion.div
                    key={enfant.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + i * 0.06 }}
                  >
                    <Card
                      className="cursor-pointer border-0 shadow-lg rounded-2xl hover:shadow-xl transition-all active:scale-[0.97] overflow-hidden group"
                      onClick={() => navigate(`/parent/enfant/${enfant.id}`)}
                    >
                      <CardContent className="p-0">
                        {/* Photo section */}
                        <div className="relative h-28 sm:h-32 bg-gradient-to-br from-primary/15 to-accent/20 overflow-hidden">
                          {enfant.photo_url ? (
                            <img src={enfant.photo_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-4xl font-extrabold text-primary/30">{enfant.prenom[0]}{enfant.nom[0]}</span>
                            </div>
                          )}
                          {/* Badges overlay */}
                          <div className="absolute top-2 right-2 flex gap-1">
                            {enfant.option_cantine && (
                              <span className="w-6 h-6 rounded-full bg-emerald-500/90 backdrop-blur flex items-center justify-center shadow-md">
                                <UtensilsCrossed className="h-3 w-3 text-white" />
                              </span>
                            )}
                            {enfant.zone_transport_id && (
                              <span className="w-6 h-6 rounded-full bg-amber-500/90 backdrop-blur flex items-center justify-center shadow-md">
                                <Bus className="h-3 w-3 text-white" />
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Info */}
                        <div className="px-3 py-2.5 flex items-center justify-between gap-1">
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{enfant.prenom}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{enfant.classes?.niveaux?.nom} — {enfant.classes?.nom}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Catalogue & Commande */}
            <ParentCatalogueCommande enfants={eleves} code={session.token} soldeFamille={dashData?.solde_famille || 0} onSuccess={fetchDashboard} />

            {/* Cantine Recharge */}
            <ParentCantineOrdre enfants={eleves} code={session.token} onSuccess={fetchDashboard} />

            {/* ─── Payment Tabs ─── */}
            <Tabs defaultValue="devis">
              <TabsList className="w-full grid grid-cols-3 h-10 rounded-2xl bg-muted/60 p-1">
                <TabsTrigger value="devis" className="rounded-xl text-xs font-bold data-[state=active]:shadow-md">
                  <FileText className="h-3.5 w-3.5 mr-1" /> Devis
                </TabsTrigger>
                <TabsTrigger value="historique" className="rounded-xl text-xs font-bold data-[state=active]:shadow-md">
                  <CreditCard className="h-3.5 w-3.5 mr-1" /> Hist.
                </TabsTrigger>
                <TabsTrigger value="echeancier" className="rounded-xl text-xs font-bold data-[state=active]:shadow-md">
                  <TrendingDown className="h-3.5 w-3.5 mr-1" /> Éch.
                </TabsTrigger>
              </TabsList>

              <TabsContent value="devis" className="mt-4">
                <ParentDevisInscription eleves={eleves} paiements={paiements} tarifs={dashData?.tarifs || []} nbEnfantsFamille={eleves.length} />
              </TabsContent>

              <TabsContent value="historique" className="mt-4">
                {paiements.length === 0 ? (
                  <Card className="border-0 shadow-md rounded-2xl">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">Aucun paiement enregistré</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {paiements.slice(0, 20).map((p: any) => {
                      const enfant = eleves.find((e: any) => e.id === p.eleve_id);
                      const typeEmojis: Record<string, string> = { scolarite: '🎓', transport: '🚌', cantine: '🍽️', fournitures: '📚', librairie: '📚', boutique: '👕', inscription: '📝', reinscription: '🔄' };
                      return (
                        <Card key={p.id} className="border-0 shadow-sm rounded-2xl hover:shadow-md transition-shadow">
                          <CardContent className="py-3 px-4 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-xs sm:text-sm font-semibold truncate">
                                  {typeEmojis[p.type_paiement] || '📦'} {p.type_paiement}
                                  {p.type_paiement === 'cantine' && p.mois_concerne === 'Recharge directe' && ' (directe)'}
                                  {p.type_paiement === 'cantine' && p.mois_concerne === 'Recharge ordonnée' && ' (ordonnée ✓)'}
                                  {p.mois_concerne && !p.mois_concerne.startsWith('Recharge') && ` — ${p.mois_concerne}`}
                                </p>
                                {enfant && <Badge variant="outline" className="text-[10px] px-1.5 rounded-full">{enfant.prenom}</Badge>}
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {new Date(p.date_paiement).toLocaleDateString('fr-FR')} • {p.canal}
                              </p>
                            </div>
                            <span className="font-extrabold text-emerald-600 text-xs sm:text-sm whitespace-nowrap shrink-0">{p.montant.toLocaleString()} GNF</span>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="echeancier" className="mt-4">
                <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="text-xs font-bold">Mois</TableHead>
                          <TableHead className="text-right text-xs font-bold">Scolarité</TableHead>
                          <TableHead className="text-right text-xs font-bold">Statut</TableHead>
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
                              <TableCell className="font-medium text-xs py-2.5">
                                {mois} {isCurrentMonth && <Badge variant="outline" className="ml-1 text-[10px] rounded-full">Actuel</Badge>}
                              </TableCell>
                              <TableCell className="text-right text-xs py-2.5 whitespace-nowrap">{mensualiteScolarite.toLocaleString()} GNF</TableCell>
                              <TableCell className="text-right py-2.5">
                                {payeMois > 0 ? (
                                  <Badge variant={isPaid ? 'default' : 'secondary'} className={`text-[10px] rounded-full ${isPaid ? 'bg-emerald-600' : ''}`}>
                                    {isPaid ? '✓ Payé' : `${payeMois.toLocaleString()} / ${mensualiteScolarite.toLocaleString()}`}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px] rounded-full">Non payé</Badge>
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

      {/* ─── Family Details Dialog ─── */}
      <Dialog open={familyDetailsOpen} onOpenChange={setFamilyDetailsOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-0 shadow-2xl">
          {/* Header gradient */}
          <div className="bg-gradient-to-br from-primary via-primary/90 to-accent p-5 pb-8 relative">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-primary-foreground/5 -translate-y-1/2 translate-x-1/4" />
            <button onClick={() => setFamilyDetailsOpen(false)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary-foreground/20 transition-colors">
              <X className="h-4 w-4 text-primary-foreground" />
            </button>
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-primary-foreground/15 flex items-center justify-center mb-3">
                <Users className="h-7 w-7 text-primary-foreground" />
              </div>
              <h2 className="text-xl font-extrabold text-primary-foreground">Famille {famille.nom_famille}</h2>
              <p className="text-xs text-primary-foreground/60 mt-1">{eleves.length} enfant{eleves.length > 1 ? 's' : ''} inscrit{eleves.length > 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="p-5 -mt-4 space-y-4">
            {/* Contact info */}
            <Card className="border-0 shadow-md rounded-2xl bg-card">
              <CardContent className="p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Informations</h3>
                {famille.telephone_pere && (
                  <a href={`tel:${famille.telephone_pere}`} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Phone className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tél. Père</p>
                      <p className="text-sm font-semibold">{famille.telephone_pere}</p>
                    </div>
                  </a>
                )}
                {famille.telephone_mere && (
                  <a href={`tel:${famille.telephone_mere}`} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Phone className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tél. Mère</p>
                      <p className="text-sm font-semibold">{famille.telephone_mere}</p>
                    </div>
                  </a>
                )}
                {famille.email_parent && (
                  <a href={`mailto:${famille.email_parent}`} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Mail className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-semibold truncate">{famille.email_parent}</p>
                    </div>
                  </a>
                )}
                {famille.adresse && (
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Adresse</p>
                      <p className="text-sm font-semibold">{famille.adresse}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Wallet */}
            <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-white/70 uppercase tracking-wider font-medium">Solde Portefeuille</p>
                  <p className="text-2xl font-extrabold text-white">{(dashData?.solde_famille || 0).toLocaleString()} GNF</p>
                </div>
                <Wallet className="h-8 w-8 text-white/30" />
              </div>
            </Card>

            {/* Children gallery */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Enfants</h3>
              <div className="grid grid-cols-2 gap-2.5">
                {eleves.map((enfant: any) => (
                  <button
                    key={enfant.id}
                    onClick={() => { setFamilyDetailsOpen(false); navigate(`/parent/enfant/${enfant.id}`); }}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-muted/40 hover:bg-muted/60 transition-all active:scale-95"
                  >
                    {enfant.photo_url ? (
                      <img src={enfant.photo_url} alt="" loading="lazy" decoding="async" className="w-14 h-14 rounded-2xl object-cover shadow-md ring-2 ring-border/30" />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary font-bold shadow-md">
                        {enfant.prenom[0]}{enfant.nom[0]}
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-xs font-bold truncate max-w-[100px]">{enfant.prenom} {enfant.nom}</p>
                      <p className="text-[10px] text-muted-foreground">{enfant.classes?.nom}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
