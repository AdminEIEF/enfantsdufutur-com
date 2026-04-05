import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2, Smartphone, CreditCard, Wallet, Copy, MessageCircle, CheckCircle2, X, ArrowLeft,
  ChevronRight, UtensilsCrossed, BookOpen, ShoppingBag, Bus, Plus, Minus, ShoppingCart, Package, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enfants: Array<{
    id: string; nom: string; prenom: string; classes?: any; solde_cantine?: number;
    photo_url?: string; option_cantine?: boolean; zone_transport_id?: string; zones_transport?: any;
    classe_id?: string;
  }>;
  code: string;
  onSuccess?: () => void;
  soldeFamille?: number;
  initialMode?: 'mobile-wallet' | 'wallet-cantine' | 'wallet-librairie';
}

const TYPE_OPTIONS = [
  { value: 'cantine', label: 'Cantine', emoji: '🍽️', description: 'Recharge repas' },
  { value: 'transport', label: 'Transport', emoji: '🚌', description: 'Frais transport' },
  { value: 'librairie', label: 'Librairie', emoji: '📚', description: 'Fournitures' },
  { value: 'boutique', label: 'Boutique', emoji: '👕', description: 'Uniformes' },
  { value: 'autre', label: 'Autre', emoji: '📦', description: 'Autre paiement' },
];

const CANTINE_MENSUEL = 400000;
const MOIS_SCOLAIRES = ['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'];

const MANUEL_PURPOSE_OPTIONS = [
  { value: 'scolarite', label: 'Paiement Scolarité', emoji: '🎓' },
  { value: 'inscription', label: 'Inscription / Réinscription', emoji: '📋' },
  { value: 'wallet', label: 'Recharge Portefeuille', emoji: '💰' },
];

interface Article {
  id: string; nom: string; categorie: string; prix: number; stock: number; taille?: string; niveau_id?: string; fichier_url?: string | null;
}
interface CartItem { article: Article; quantite: number; }

const WALLET_SERVICES = [
  { value: 'cantine', label: 'Cantine', emoji: '🍽️', desc: 'Recharger le solde repas (1x/mois)', gradient: 'from-emerald-500 to-teal-600', icon: UtensilsCrossed },
  { value: 'librairie', label: 'Livres Numériques', emoji: '📱', desc: 'Acheter des romans & manuels numériques', gradient: 'from-violet-500 to-purple-600', icon: FileText },
  { value: 'boutique', label: 'Boutique', emoji: '👕', desc: 'Fournitures & uniformes', gradient: 'from-pink-500 to-rose-600', icon: ShoppingBag },
  { value: 'transport', label: 'Transport', emoji: '🚌', desc: 'Frais de transport', gradient: 'from-amber-500 to-orange-600', icon: Bus },
  { value: 'autre', label: 'Autre', emoji: '📦', desc: 'Autre paiement', gradient: 'from-gray-500 to-slate-600', icon: Package },
];

export default function ParentPaymentDialog({ open, onOpenChange, enfants, code, onSuccess, soldeFamille = 0, initialMode }: PaymentDialogProps) {
  const isSingle = enfants.length === 1;
  const [activeMode, setActiveMode] = useState<'select' | 'mobile' | 'wallet'>('select');
  const [walletSubMode, setWalletSubMode] = useState<'menu' | 'cantine' | 'catalogue' | 'debit' | 'transport'>('menu');
  const [eleveId, setEleveId] = useState(isSingle ? enfants[0]?.id || '' : '');
  const [typePaiement, setTypePaiement] = useState('');
  const [montant, setMontant] = useState('');
  const [moisConcerne, setMoisConcerne] = useState('');
  const [loading, setLoading] = useState(false);
  const [mobileMode, setMobileMode] = useState<'manuel' | 'auto'>('manuel');
  const [copied, setCopied] = useState(false);
  const [manuelPurpose, setManuelPurpose] = useState('');
  const [manuelMontant, setManuelMontant] = useState('');

  const NUMERO_MARCHAND = '47 09 03';
  const WHATSAPP_NUMERO = '224628848437';

  // Wallet debit state
  const [debitEleveId, setDebitEleveId] = useState(isSingle ? enfants[0]?.id || '' : '');
  const [debitType, setDebitType] = useState('');
  const [debitMontant, setDebitMontant] = useState('');
  const [debitDescription, setDebitDescription] = useState('');
  const [debitLoading, setDebitLoading] = useState(false);

  // Cantine recharge state
  const [cantineSelectedIds, setCantineSelectedIds] = useState<string[]>(isSingle ? [enfants[0]?.id || ''] : []);
  const [cantineMontant, setCantineMontant] = useState(CANTINE_MENSUEL.toString());
  const [cantineLoading, setCantineLoading] = useState(false);

  // Transport state
  const [transportSelectedIds, setTransportSelectedIds] = useState<string[]>(isSingle ? [enfants[0]?.id || ''] : []);
  const [transportLoading, setTransportLoading] = useState(false);

  // Catalogue state
  const [catalogueType, setCatalogueType] = useState<'librairie' | 'boutique'>('librairie');
  const [catalogueEleveId, setCatalogueEleveId] = useState(isSingle ? enfants[0]?.id || '' : '');
  const [catalogue, setCatalogue] = useState<Article[]>([]);
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [submittingCatalogue, setSubmittingCatalogue] = useState(false);
  

  useEffect(() => {
    if (open && initialMode === 'mobile-wallet') {
      setActiveMode('mobile'); setMobileMode('manuel'); setManuelPurpose('wallet');
    } else if (open && initialMode === 'wallet-cantine') {
      setActiveMode('wallet'); setWalletSubMode('cantine');
    } else if (open && initialMode === 'wallet-librairie') {
      setActiveMode('wallet'); setWalletSubMode('catalogue'); setCatalogueType('librairie');
    }
    if (!open) {
      setActiveMode('select'); setWalletSubMode('menu'); setMobileMode('manuel');
      setManuelPurpose(''); setManuelMontant(''); setDebitType(''); setDebitMontant('');
      setCart([]); setCantineMontant(CANTINE_MENSUEL.toString());
      setCantineSelectedIds(isSingle ? [enfants[0]?.id || ''] : []);
      setTransportSelectedIds(isSingle ? [enfants[0]?.id || ''] : []);
    }
  }, [open, initialMode]);

  // Fetch catalogue
  const fetchCatalogue = async () => {
    if (!catalogueEleveId) return;
    setLoadingCatalogue(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parent-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ action: 'catalogue', code, type_service: catalogueType, eleve_id: catalogueEleveId }),
      });
      const data = await resp.json();
      if (resp.ok) setCatalogue(data.articles || []);
    } catch { /* silent */ } finally { setLoadingCatalogue(false); }
  };

  useEffect(() => {
    if (walletSubMode === 'catalogue' && catalogueEleveId) {
      setCart([]);
      fetchCatalogue();
    }
  }, [walletSubMode, catalogueType, catalogueEleveId]);

  // Auto-fill debit amount
  const handleDebitTypeSelect = (type: string) => {
    setDebitType(type);
    const sel = enfants.find(e => e.id === debitEleveId);
    if (type === 'transport' && sel?.zones_transport) {
      const prix = getTransportPrix(sel);
      setDebitMontant(prix.toString());
      setDebitDescription(`Transport ${getTrajetLabel(sel)}`);
    } else {
      setDebitMontant(''); setDebitDescription('');
    }
  };

  const handlePay = async () => {
    if (!eleveId || !typePaiement || !montant || Number(montant) <= 0) { toast.error('Veuillez remplir tous les champs'); return; }
    setLoading(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paydunya-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ code, eleve_id: eleveId, type_paiement: typePaiement, montant: Number(montant), mois_concerne: typePaiement === 'scolarite' ? moisConcerne : undefined }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erreur de paiement');
      if (data.url) { window.open(data.url, '_blank'); toast.success('Redirection vers la page de paiement...'); onOpenChange(false); onSuccess?.(); }
    } catch (err: any) { toast.error(err.message || "Erreur"); } finally { setLoading(false); }
  };

  const handleDebitWallet = async () => {
    if (!debitEleveId || !debitType || !debitMontant || Number(debitMontant) <= 0) { toast.error('Veuillez remplir tous les champs'); return; }
    if (Number(debitMontant) > soldeFamille) { toast.error(`Solde insuffisant`); return; }
    setDebitLoading(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parent-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ code, action: 'debit_wallet', eleve_id: debitEleveId, montant: Number(debitMontant), type_paiement: debitType, description: debitDescription || null }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      toast.success(`${Number(debitMontant).toLocaleString()} GNF débités`);
      setDebitMontant(''); setDebitType(''); setDebitDescription('');
      onOpenChange(false); onSuccess?.();
    } catch (err: any) { toast.error(err.message || 'Erreur'); } finally { setDebitLoading(false); }
  };

  // Cantine recharge handler
  const handleCantineRecharge = async () => {
    if (cantineSelectedIds.length === 0 || !cantineMontant || Number(cantineMontant) <= 0) { toast.error('Sélectionnez un enfant et un montant'); return; }
    const total = cantineSelectedIds.length * Number(cantineMontant);
    if (total > soldeFamille) { toast.error(`Solde insuffisant. Il manque ${(total - soldeFamille).toLocaleString()} GNF`); return; }
    setCantineLoading(true);
    try {
      for (const eid of cantineSelectedIds) {
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cantine-ordre`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ action: 'create_ordre', code, eleve_id: eid, montant: Number(cantineMontant) }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error);
      }
      toast.success(`Cantine rechargée pour ${cantineSelectedIds.length} enfant(s) !`);
      onOpenChange(false); onSuccess?.();
    } catch (err: any) { toast.error(err.message || 'Erreur'); } finally { setCantineLoading(false); }
  };

  // Catalogue handlers
  const addToCart = (article: Article) => {
    setCart(prev => {
      const existing = prev.find(c => c.article.id === article.id);
      if (existing) return prev.map(c => c.article.id === article.id ? { ...c, quantite: c.quantite + 1 } : c);
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
  const removeFromCart = (articleId: string) => setCart(prev => prev.filter(c => c.article.id !== articleId));
  const totalPanier = cart.reduce((s, c) => s + c.article.prix * c.quantite, 0);
  const cartCount = cart.reduce((s, c) => s + c.quantite, 0);

  const handleCommander = async () => {
    if (cart.length === 0) { toast.error('Panier vide'); return; }
    if (!catalogueEleveId) { toast.error('Sélectionnez un enfant'); return; }
    if (totalPanier > soldeFamille) { toast.error(`Solde insuffisant`); return; }
    setSubmittingCatalogue(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parent-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          action: 'commander_articles', code, eleve_id: catalogueEleveId, type_service: catalogueType,
          items: cart.map(c => ({ article_id: c.article.id, article_nom: c.article.nom, article_taille: (c.article as any).taille || null, quantite: c.quantite, prix_unitaire: c.article.prix })),
          total: totalPanier,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      toast.success('Commande validée !');
      setCart([]); onOpenChange(false); onSuccess?.();
    } catch (err: any) { toast.error(err.message || 'Erreur'); } finally { setSubmittingCatalogue(false); }
  };

  const selectedEnfant = enfants.find(e => e.id === eleveId);
  const cantineTotal = cantineSelectedIds.length * Number(cantineMontant || 0);

  const handleBack = () => {
    if (activeMode === 'wallet' && walletSubMode !== 'menu') {
      setWalletSubMode('menu'); setCart([]);
    } else if (activeMode !== 'select') {
      setActiveMode('select');
    }
  };

  const showBack = activeMode !== 'select';

  const getTitle = () => {
    if (activeMode === 'select') return 'Paiements';
    if (activeMode === 'mobile') return 'Mobile Money';
    if (walletSubMode === 'cantine') return 'Recharge Cantine';
    if (walletSubMode === 'transport') return 'Transport Scolaire';
    if (walletSubMode === 'catalogue') return catalogueType === 'librairie' ? 'Livres Numériques' : 'Boutique';
    if (walletSubMode === 'debit') return 'Payer un service';
    return 'Portefeuille';
  };

  const getSubtitle = () => {
    if (activeMode === 'select') return 'Choisissez votre méthode';
    if (activeMode === 'mobile') return 'Orange Money • MTN MoMo';
    if (walletSubMode === 'menu') return `Solde : ${soldeFamille.toLocaleString()} GNF`;
    if (walletSubMode === 'cantine') return 'Recharger le solde repas de vos enfants';
    if (walletSubMode === 'catalogue') return 'Sélectionnez et commandez';
    return `Solde : ${soldeFamille.toLocaleString()} GNF`;
  };

  const handleWalletServiceClick = (svc: string) => {
    if (svc === 'cantine') {
      setWalletSubMode('cantine');
    } else if (svc === 'transport') {
      setWalletSubMode('transport');
    } else if (svc === 'librairie' || svc === 'boutique') {
      setCatalogueType(svc as any);
      setWalletSubMode('catalogue');
    } else {
      setDebitType(svc);
      handleDebitTypeSelect(svc);
      setWalletSubMode('debit');
    }
  };

  // Transport enfants with zone
  const transportEnfants = enfants.filter(e => e.zone_transport_id && e.zones_transport);
  const MOIS_FR_LABELS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const moisCourantLabel = MOIS_FR_LABELS[new Date().getMonth()];
  const anneeCourante = new Date().getFullYear();

  const getTransportPrix = (e: any) => {
    const zone = e.zones_transport;
    const typeTrajet = (e as any).type_trajet_transport || 'aller_retour';
    if (typeTrajet === 'aller_simple') return zone?.prix_aller_simple || zone?.prix_mensuel || 0;
    if (typeTrajet === 'retour_simple') return zone?.prix_retour_simple || zone?.prix_mensuel || 0;
    return zone?.prix_mensuel || 0;
  };

  const getTrajetLabel = (e: any) => {
    const typeTrajet = (e as any).type_trajet_transport || 'aller_retour';
    if (typeTrajet === 'aller_simple') return 'Aller simple';
    if (typeTrajet === 'retour_simple') return 'Retour simple';
    return 'Aller-Retour';
  };

  const transportTotal = transportSelectedIds.reduce((sum, id) => {
    const e = enfants.find(x => x.id === id);
    return sum + (e ? getTransportPrix(e) : 0);
  }, 0);

  const handleTransportPayment = async () => {
    if (transportSelectedIds.length === 0) { toast.error('Sélectionnez au moins un enfant'); return; }
    if (transportTotal > soldeFamille) { toast.error('Solde insuffisant'); return; }
    setTransportLoading(true);
    try {
      for (const eid of transportSelectedIds) {
        const enf = enfants.find(x => x.id === eid);
        const montant = enf ? getTransportPrix(enf) : 0;
        const trajetLabel = enf ? getTrajetLabel(enf) : '';
        const description = `Transport ${trajetLabel} du mois de ${moisCourantLabel} ${anneeCourante}`;
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parent-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ code, action: 'debit_wallet', eleve_id: eid, montant, type_paiement: 'transport', description }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error);
      }
      toast.success(`Transport payé pour ${transportSelectedIds.length} enfant(s) !`);
      onOpenChange(false); onSuccess?.();
    } catch (err: any) { toast.error(err.message || 'Erreur'); } finally { setTransportLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-0 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary via-primary/90 to-accent p-5 relative">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-primary-foreground/5 -translate-y-1/2 translate-x-1/4" />
          <button onClick={() => onOpenChange(false)} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center hover:bg-primary-foreground/30 transition-colors z-20 shadow-sm">
            <X className="h-5 w-5 text-primary-foreground" />
          </button>
          {showBack && (
            <button onClick={handleBack} className="absolute top-3 left-3 w-9 h-9 rounded-full bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center hover:bg-primary-foreground/30 transition-colors z-20 shadow-sm">
              <ArrowLeft className="h-5 w-5 text-primary-foreground" />
            </button>
          )}
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-primary-foreground/15 flex items-center justify-center mb-3">
              {activeMode === 'wallet' && walletSubMode === 'cantine' ? <UtensilsCrossed className="h-6 w-6 text-primary-foreground" /> :
               activeMode === 'wallet' && walletSubMode === 'catalogue' ? (catalogueType === 'librairie' ? <BookOpen className="h-6 w-6 text-primary-foreground" /> : <ShoppingBag className="h-6 w-6 text-primary-foreground" />) :
               <CreditCard className="h-6 w-6 text-primary-foreground" />}
            </div>
            <h2 className="text-lg font-extrabold text-primary-foreground">{getTitle()}</h2>
            <p className="text-xs text-primary-foreground/60 mt-0.5">{getSubtitle()}</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <AnimatePresence mode="wait">

            {/* ─── MODE SELECT ─── */}
            {activeMode === 'select' && (
              <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <button onClick={() => setActiveMode('mobile')} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border border-orange-200/50 hover:shadow-md transition-all active:scale-[0.98]">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-md shrink-0">
                    <Smartphone className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-sm">Mobile Money</p>
                    <p className="text-[11px] text-muted-foreground">Orange Money • MTN MoMo</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </button>

                <button onClick={() => setActiveMode('wallet')} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200/50 hover:shadow-md transition-all active:scale-[0.98]">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md shrink-0">
                    <Wallet className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-sm">Portefeuille</p>
                    <p className="text-[11px] text-muted-foreground">Solde : <span className="font-bold text-emerald-600">{soldeFamille.toLocaleString()} GNF</span></p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </button>
              </motion.div>
            )}

            {/* ─── MOBILE MONEY ─── */}
            {activeMode === 'mobile' && (
              <motion.div key="mobile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="flex gap-1.5 p-1 bg-muted/60 rounded-2xl">
                  <button onClick={() => setMobileMode('manuel')} className={`flex-1 text-xs font-bold py-2.5 rounded-xl transition-all ${mobileMode === 'manuel' ? 'bg-card shadow-md text-foreground' : 'text-muted-foreground'}`}>📱 Manuel</button>
                  <button onClick={() => setMobileMode('auto')} className={`flex-1 text-xs font-bold py-2.5 rounded-xl transition-all ${mobileMode === 'auto' ? 'bg-card shadow-md text-foreground' : 'text-muted-foreground'}`}>⚡ Automatique</button>
                </div>

                {mobileMode === 'manuel' ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Motif du paiement</Label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {MANUEL_PURPOSE_OPTIONS.map(opt => (
                          <button key={opt.value} onClick={() => setManuelPurpose(opt.value)} className={`flex flex-col items-center gap-1 p-3 rounded-xl text-center transition-all active:scale-95 ${manuelPurpose === opt.value ? 'bg-primary/10 ring-2 ring-primary/40 shadow-sm' : 'bg-muted/40 hover:bg-muted/60'}`}>
                            <span className="text-lg">{opt.emoji}</span>
                            <span className="text-[9px] font-semibold leading-tight">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Montant envoyé (GNF)</Label>
                      <Input type="number" placeholder="Ex: 500000" value={manuelMontant} onChange={e => setManuelMontant(e.target.value)} min={1000} className="rounded-xl h-11 text-lg font-bold" />
                    </div>
                    <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
                      <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-4 text-center">
                        <p className="text-[10px] text-white/70 uppercase tracking-wider font-medium">Numéro Marchand</p>
                        <div className="flex items-center justify-center gap-2 mt-1">
                          <p className="text-3xl font-extrabold tracking-widest text-white">{NUMERO_MARCHAND}</p>
                          <button onClick={() => { navigator.clipboard.writeText(NUMERO_MARCHAND.replace(/\s/g, '')); setCopied(true); toast.success('Numéro copié !'); setTimeout(() => setCopied(false), 2000); }} className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
                            {copied ? <CheckCircle2 className="h-4 w-4 text-white" /> : <Copy className="h-4 w-4 text-white" />}
                          </button>
                        </div>
                      </div>
                      <CardContent className="p-4 space-y-2">
                        <p className="font-bold text-xs">📋 Instructions :</p>
                        <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-muted-foreground">
                          <li>Sélectionnez le <strong>motif</strong> et saisissez le <strong>montant</strong></li>
                          <li>Envoyez au <strong className="text-foreground">{NUMERO_MARCHAND}</strong> via <strong className="text-orange-600">Orange Money</strong></li>
                          <li>Faites une <strong>capture d'écran</strong></li>
                          <li>Cliquez sur <strong className="text-green-600">Envoyer sur WhatsApp</strong></li>
                        </ol>
                      </CardContent>
                    </Card>
                    <Button disabled={!manuelPurpose || !manuelMontant || Number(manuelMontant) <= 0} onClick={() => {
                      const purposeLabel = MANUEL_PURPOSE_OPTIONS.find(o => o.value === manuelPurpose)?.label || manuelPurpose;
                      const message = encodeURIComponent(`Bonjour, je viens d'effectuer un paiement Orange Money.\n\n📌 Motif : ${purposeLabel}\n💰 Montant : ${Number(manuelMontant).toLocaleString()} GNF\n👨‍👩‍👧 Code famille : ${code}\n\nVoici ma capture d'écran.`);
                      window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${message}`, '_blank');
                    }} className="w-full bg-green-600 hover:bg-green-700 text-white rounded-2xl h-12 font-bold" size="lg">
                      <MessageCircle className="h-4 w-4 mr-2" /> Envoyer sur WhatsApp
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {!isSingle ? (
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Enfant concerné</Label>
                        <Select value={eleveId} onValueChange={setEleveId}>
                          <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Choisir un enfant" /></SelectTrigger>
                          <SelectContent>{enfants.map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <EnfantChip enfant={enfants[0]} />
                    )}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Type de paiement</Label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {TYPE_OPTIONS.map(opt => (
                          <button key={opt.value} onClick={() => setTypePaiement(opt.value)} className={`flex flex-col items-center gap-1 p-2.5 rounded-xl text-center transition-all active:scale-95 ${typePaiement === opt.value ? 'bg-primary/10 ring-2 ring-primary/40 shadow-sm' : 'bg-muted/40 hover:bg-muted/60'}`}>
                            <span className="text-lg">{opt.emoji}</span>
                            <span className="text-[9px] font-semibold leading-tight">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {typePaiement === 'scolarite' && (
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Mois concerné</Label>
                        <Select value={moisConcerne} onValueChange={setMoisConcerne}>
                          <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Sélectionner le mois" /></SelectTrigger>
                          <SelectContent>{MOIS_SCOLAIRES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Montant (GNF)</Label>
                      <Input type="number" placeholder="Ex: 500000" value={montant} onChange={e => setMontant(e.target.value)} min={1000} className="rounded-xl h-11 text-lg font-bold" />
                    </div>
                    {eleveId && typePaiement && montant && Number(montant) > 0 && (
                      <Card className="border-0 shadow-md rounded-2xl bg-primary/5">
                        <CardContent className="p-4 space-y-1.5">
                          <p className="text-xs font-bold uppercase text-muted-foreground">Récapitulatif</p>
                          <p className="text-sm">👤 {selectedEnfant?.prenom} {selectedEnfant?.nom}</p>
                          <p className="text-sm">{TYPE_OPTIONS.find(t => t.value === typePaiement)?.emoji} {TYPE_OPTIONS.find(t => t.value === typePaiement)?.label}</p>
                          {moisConcerne && <p className="text-sm">📅 {moisConcerne}</p>}
                          <p className="text-2xl font-extrabold text-primary">{Number(montant).toLocaleString()} GNF</p>
                        </CardContent>
                      </Card>
                    )}
                    <Button onClick={handlePay} disabled={loading} className="w-full rounded-2xl h-12 font-bold" size="lg">
                      {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Initialisation...</> : <><Smartphone className="h-4 w-4 mr-2" /> Payer via Mobile Money</>}
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center">Paiement sécurisé via PayDunya</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ─── WALLET ─── */}
            {activeMode === 'wallet' && (
              <motion.div key="wallet" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">

                {/* Balance card - always visible */}
                <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 p-4 relative">
                    <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/5 -translate-y-1/3 translate-x-1/4" />
                    <div className="flex items-center justify-between relative z-10">
                      <div>
                        <p className="text-[10px] text-white/70 uppercase tracking-wider font-medium">Solde disponible</p>
                        <p className="text-2xl font-extrabold text-white">{soldeFamille.toLocaleString()} <span className="text-sm opacity-60">GNF</span></p>
                      </div>
                      <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center">
                        <Wallet className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    {soldeFamille <= 0 && (
                      <button onClick={() => { setActiveMode('mobile'); setMobileMode('manuel'); setManuelPurpose('wallet'); }} className="mt-3 w-full py-2 rounded-xl bg-white/15 text-white text-xs font-bold hover:bg-white/25 transition-colors flex items-center justify-center gap-1.5">
                        <Smartphone className="h-3.5 w-3.5" /> Recharger le portefeuille
                      </button>
                    )}
                  </div>
                </Card>

                {/* ─── WALLET MENU ─── */}
                {walletSubMode === 'menu' && soldeFamille > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Utiliser mon solde</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {WALLET_SERVICES.map((svc) => {
                        const Icon = svc.icon;
                        return (
                          <button key={svc.value} onClick={() => handleWalletServiceClick(svc.value)} className="flex flex-col items-start gap-2 p-3.5 rounded-2xl border border-border/50 bg-card hover:shadow-lg hover:border-primary/20 transition-all active:scale-[0.97] text-left group">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${svc.gradient} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                              <Icon className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-bold">{svc.label}</p>
                              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{svc.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <button onClick={() => { setActiveMode('mobile'); setMobileMode('manuel'); setManuelPurpose('wallet'); }} className="w-full py-3 rounded-2xl border-2 border-dashed border-primary/20 text-primary text-xs font-bold hover:bg-primary/5 transition-colors flex items-center justify-center gap-2">
                      <Plus className="h-4 w-4" /> Recharger le portefeuille
                    </button>
                  </motion.div>
                )}

                {walletSubMode === 'menu' && soldeFamille <= 0 && (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">Rechargez votre portefeuille pour accéder aux services</p>
                  </div>
                )}

                {/* ─── CANTINE SUB-MODE ─── */}
                {walletSubMode === 'cantine' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    {/* Children selection */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold">Enfant(s) à recharger</Label>
                        {enfants.length > 1 && (
                          <button onClick={() => setCantineSelectedIds(prev => prev.length === enfants.length ? [] : enfants.map(e => e.id))} className="text-[10px] font-bold text-primary hover:underline">
                            {cantineSelectedIds.length === enfants.length ? 'Désélectionner' : 'Tous'}
                          </button>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {enfants.map(e => (
                          <label key={e.id} className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${cantineSelectedIds.includes(e.id) ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm' : 'border-border hover:bg-muted/50'}`}>
                            <Checkbox checked={cantineSelectedIds.includes(e.id)} onCheckedChange={() => setCantineSelectedIds(prev => prev.includes(e.id) ? prev.filter(x => x !== e.id) : [...prev, e.id])} />
                            {e.photo_url ? (
                              <img src={e.photo_url} alt="" className="w-9 h-9 rounded-xl object-cover" />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{e.prenom[0]}{e.nom[0]}</div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">{e.prenom} {e.nom}</p>
                              <p className="text-[10px] text-muted-foreground">Solde cantine: <span className="font-bold text-emerald-600">{(e.solde_cantine || 0).toLocaleString()} GNF</span></p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Montant par enfant (GNF)</Label>
                      <Input type="number" placeholder="400000" value={cantineMontant} onChange={e => setCantineMontant(e.target.value)} min={1000} className="rounded-xl h-11 text-lg font-bold" />
                      <p className="text-[10px] text-muted-foreground">Tarif mensuel : <strong>{CANTINE_MENSUEL.toLocaleString()} GNF</strong> — <span className="text-amber-600 font-semibold">1 recharge/mois max par enfant</span></p>
                    </div>

                    {cantineSelectedIds.length > 0 && Number(cantineMontant) > 0 && (
                      <Card className="border-0 shadow-md rounded-2xl bg-emerald-50 dark:bg-emerald-950/20">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total à débiter</p>
                              <p className="text-xl font-extrabold text-emerald-700">{cantineTotal.toLocaleString()} GNF</p>
                              {cantineSelectedIds.length > 1 && <p className="text-[10px] text-muted-foreground">{cantineSelectedIds.length} × {Number(cantineMontant).toLocaleString()} GNF</p>}
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-muted-foreground">Solde après</p>
                              <p className={`text-sm font-bold ${soldeFamille - cantineTotal < 0 ? 'text-destructive' : 'text-emerald-600'}`}>{(soldeFamille - cantineTotal).toLocaleString()} GNF</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {cantineTotal > soldeFamille && <p className="text-xs text-destructive font-medium text-center">⚠️ Solde insuffisant</p>}

                    <Button onClick={handleCantineRecharge} disabled={cantineLoading || cantineSelectedIds.length === 0 || cantineTotal <= 0 || cantineTotal > soldeFamille} className="w-full rounded-2xl h-12 font-bold bg-emerald-600 hover:bg-emerald-700" size="lg">
                      {cantineLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UtensilsCrossed className="h-4 w-4 mr-2" />}
                      Recharger la cantine
                    </Button>
                  </motion.div>
                )}

                {/* ─── CATALOGUE SUB-MODE ─── */}
                {walletSubMode === 'catalogue' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">

                    {/* Child selector */}
                    {!isSingle ? (
                      <Select value={catalogueEleveId} onValueChange={setCatalogueEleveId}>
                        <SelectTrigger className="rounded-xl h-10 text-sm"><SelectValue placeholder="Sélectionner un enfant" /></SelectTrigger>
                        <SelectContent>{enfants.map(e => <SelectItem key={e.id} value={e.id} className="text-sm">{e.prenom} {e.nom}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : null}

                    {/* Info: Livres numériques uniquement */}
                    {catalogueType === 'librairie' && (
                      <div className="bg-violet-50 dark:bg-violet-950/20 rounded-xl p-2.5 text-[10px] text-violet-700 dark:text-violet-300">
                        📱 Seuls les livres numériques sont disponibles à l'achat en ligne. Les livres physiques s'achètent directement à la librairie.
                      </div>
                    )}

                    {/* Catalogue items */}
                    {loadingCatalogue ? (
                      <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                    ) : catalogue.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-6">{!catalogueEleveId && !isSingle ? 'Sélectionnez un enfant' : 'Aucun article disponible'}</p>
                    ) : (() => {
                      const filtered = catalogue;
                      return filtered.length === 0 ? (
                        <p className="text-center text-xs text-muted-foreground py-6">Aucun livre numérique disponible</p>
                      ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {filtered.map(article => {
                          const inCart = cart.find(c => c.article.id === article.id);
                          return (
                            <div key={article.id} className="flex items-center gap-3 p-3 rounded-2xl border bg-card hover:shadow-md transition-all">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                                catalogueType === 'librairie'
                                  ? 'bg-gradient-to-br from-violet-500 to-purple-600'
                                  : 'bg-gradient-to-br from-pink-500 to-rose-600'
                              }`}>
                                {catalogueType === 'librairie' ? <FileText className="h-4 w-4 text-white" /> : <ShoppingBag className="h-4 w-4 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold leading-tight">{article.nom}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <Badge variant="outline" className="text-[9px] px-1.5 rounded-full">{article.categorie}</Badge>
                                  {catalogueType === 'librairie' && <Badge className="text-[8px] px-1.5 py-0 rounded-full bg-violet-600">📱 Numérique</Badge>}
                                  {(article as any).taille && (article as any).taille !== 'unique' && <span className="text-[10px] text-muted-foreground">T: {(article as any).taille}</span>}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <p className="text-xs font-bold text-primary">{article.prix.toLocaleString()} <span className="text-[9px] opacity-60">GNF</span></p>
                                {inCart ? (
                                  <div className="flex items-center gap-0.5">
                                    <Button size="icon" variant="outline" className="h-6 w-6 rounded-lg" onClick={() => updateQuantite(article.id, -1)}><Minus className="h-2.5 w-2.5" /></Button>
                                    <span className="w-5 text-center text-xs font-bold">{inCart.quantite}</span>
                                    <Button size="icon" variant="outline" className="h-6 w-6 rounded-lg" onClick={() => updateQuantite(article.id, 1)}><Plus className="h-2.5 w-2.5" /></Button>
                                  </div>
                                ) : (
                                  <Button size="sm" variant="secondary" className="h-7 px-2.5 text-[10px] font-bold rounded-lg gap-1" onClick={() => addToCart(article)} disabled={article.stock <= 0}>
                                    <Plus className="h-3 w-3" /> Ajouter
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      );
                    })()}

                    {/* Cart summary */}
                    {cart.length > 0 && (
                      <div className="border-t pt-3 space-y-2">
                        <h4 className="text-xs font-bold flex items-center gap-1.5"><ShoppingCart className="h-3.5 w-3.5" /> Panier ({cartCount})</h4>
                        {cart.map(c => (
                          <div key={c.article.id} className="flex items-center justify-between text-xs gap-1">
                            <span className="truncate flex-1">{c.article.nom} × {c.quantite}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="font-semibold">{(c.article.prix * c.quantite).toLocaleString()}</span>
                              <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => removeFromCart(c.article.id)}>×</Button>
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center justify-between pt-2 border-t font-bold text-sm">
                          <span>Total</span>
                          <span className={totalPanier > soldeFamille ? 'text-destructive' : 'text-primary'}>{totalPanier.toLocaleString()} GNF</span>
                        </div>
                        {totalPanier > soldeFamille && <p className="text-[10px] text-destructive">Solde insuffisant</p>}
                        <Button onClick={handleCommander} disabled={submittingCatalogue || totalPanier > soldeFamille} className="w-full rounded-2xl h-11 font-bold" size="lg">
                          {submittingCatalogue ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-2" />}
                          Commander ({totalPanier.toLocaleString()} GNF)
                        </Button>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ─── TRANSPORT SUB-MODE ─── */}
                {walletSubMode === 'transport' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    {transportEnfants.length === 0 ? (
                      <div className="text-center py-6">
                        <Bus className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                        <p className="text-sm text-muted-foreground">Aucun enfant inscrit au transport scolaire</p>
                        <p className="text-[10px] text-muted-foreground mt-1">L'option transport doit être activée lors de l'inscription</p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold">Enfant(s) à payer</Label>
                            {transportEnfants.length > 1 && (
                              <button onClick={() => setTransportSelectedIds(prev => prev.length === transportEnfants.length ? [] : transportEnfants.map(e => e.id))} className="text-[10px] font-bold text-primary hover:underline">
                                {transportSelectedIds.length === transportEnfants.length ? 'Désélectionner' : 'Tous'}
                              </button>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {transportEnfants.map(e => {
                              const prix = getTransportPrix(e);
                              const zoneName = e.zones_transport?.nom || '—';
                              const trajet = getTrajetLabel(e);
                              return (
                                <label key={e.id} className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${transportSelectedIds.includes(e.id) ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm' : 'border-border hover:bg-muted/50'}`}>
                                  <Checkbox checked={transportSelectedIds.includes(e.id)} onCheckedChange={() => setTransportSelectedIds(prev => prev.includes(e.id) ? prev.filter(x => x !== e.id) : [...prev, e.id])} />
                                  {e.photo_url ? (
                                    <img src={e.photo_url} alt="" className="w-9 h-9 rounded-xl object-cover" />
                                  ) : (
                                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-700 font-bold text-xs">{e.prenom[0]}{e.nom[0]}</div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm truncate">{e.prenom} {e.nom}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                      <Badge variant="outline" className="text-[9px] px-1.5 rounded-full">{zoneName}</Badge>
                                      <Badge variant="secondary" className="text-[9px] px-1.5 rounded-full">{trajet}</Badge>
                                      <span className="text-[10px] font-bold text-amber-700">{prix.toLocaleString()} GNF</span>
                                    </div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="bg-muted/40 rounded-2xl p-3 text-xs text-muted-foreground">
                          <p className="font-bold text-foreground mb-1">📅 {moisCourantLabel} {anneeCourante}</p>
                          <p>Le montant est calculé automatiquement selon le trajet de chaque enfant.</p>
                        </div>

                        {transportSelectedIds.length > 0 && (
                          <Card className="border-0 shadow-md rounded-2xl bg-amber-50 dark:bg-amber-950/20">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total à débiter</p>
                                  <p className="text-xl font-extrabold text-amber-700">{transportTotal.toLocaleString()} GNF</p>
                                  {transportSelectedIds.length > 1 && <p className="text-[10px] text-muted-foreground">{transportSelectedIds.length} enfant(s)</p>}
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] text-muted-foreground">Solde après</p>
                                  <p className={`text-sm font-bold ${soldeFamille - transportTotal < 0 ? 'text-destructive' : 'text-emerald-600'}`}>{(soldeFamille - transportTotal).toLocaleString()} GNF</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {transportTotal > soldeFamille && <p className="text-xs text-destructive font-medium text-center">⚠️ Solde insuffisant</p>}

                        <Button onClick={handleTransportPayment} disabled={transportLoading || transportSelectedIds.length === 0 || transportTotal <= 0 || transportTotal > soldeFamille} className="w-full rounded-2xl h-12 font-bold bg-amber-600 hover:bg-amber-700" size="lg">
                          {transportLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bus className="h-4 w-4 mr-2" />}
                          Payer le transport
                        </Button>
                      </>
                    )}
                  </motion.div>
                )}

                {/* ─── DEBIT SUB-MODE (autre) ─── */}
                {walletSubMode === 'debit' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    {!isSingle ? (
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Enfant concerné</Label>
                        <Select value={debitEleveId} onValueChange={setDebitEleveId}>
                          <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Choisir un enfant" /></SelectTrigger>
                          <SelectContent>{enfants.map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    ) : <EnfantChip enfant={enfants[0]} />}

                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Montant à débiter (GNF)</Label>
                      <Input type="number" placeholder="Ex: 200000" value={debitMontant} onChange={e => setDebitMontant(e.target.value)} min={100} max={soldeFamille} className="rounded-xl h-11 text-lg font-bold" />
                      {Number(debitMontant) > soldeFamille && <p className="text-xs text-destructive">Montant supérieur au solde</p>}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Description (optionnel)</Label>
                      <Input placeholder="Ex: Transport Janvier" value={debitDescription} onChange={e => setDebitDescription(e.target.value)} maxLength={100} className="rounded-xl h-11" />
                    </div>

                    {debitEleveId && debitMontant && Number(debitMontant) > 0 && Number(debitMontant) <= soldeFamille && (
                      <Card className="border-0 shadow-md rounded-2xl bg-destructive/5">
                        <CardContent className="p-4 space-y-1.5">
                          <p className="text-xs font-bold uppercase text-muted-foreground">Récapitulatif</p>
                          <p className="text-2xl font-extrabold text-destructive">−{Number(debitMontant).toLocaleString()} GNF</p>
                          <p className="text-[11px] text-muted-foreground">Solde après : <strong>{(soldeFamille - Number(debitMontant)).toLocaleString()} GNF</strong></p>
                        </CardContent>
                      </Card>
                    )}

                    <Button onClick={handleDebitWallet} disabled={debitLoading || Number(debitMontant) > soldeFamille} className="w-full rounded-2xl h-12 font-bold" size="lg">
                      {debitLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Traitement...</> : <><Wallet className="h-4 w-4 mr-2" /> Débiter le portefeuille</>}
                    </Button>
                  </motion.div>
                )}

              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EnfantChip({ enfant }: { enfant: any }) {
  if (!enfant) return null;
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40">
      {enfant.photo_url ? (
        <img src={enfant.photo_url} alt="" className="w-9 h-9 rounded-xl object-cover" />
      ) : (
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{enfant.prenom?.[0]}{enfant.nom?.[0]}</div>
      )}
      <div>
        <p className="text-sm font-bold">{enfant.prenom} {enfant.nom}</p>
        <p className="text-[10px] text-muted-foreground">{enfant.classes?.niveaux?.nom || enfant.classes?.nom || ''}</p>
      </div>
    </div>
  );
}
