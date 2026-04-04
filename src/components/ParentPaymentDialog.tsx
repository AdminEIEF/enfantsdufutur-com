import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Smartphone, CreditCard, Wallet, Copy, MessageCircle, CheckCircle2, X, ArrowLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enfants: Array<{ id: string; nom: string; prenom: string; classes?: any; solde_cantine?: number; photo_url?: string; option_cantine?: boolean; zone_transport_id?: string; zones_transport?: any }>;
  code: string;
  onSuccess?: () => void;
  soldeFamille?: number;
  initialMode?: 'mobile-wallet';
}

const TYPE_OPTIONS = [
  { value: 'cantine', label: 'Cantine', emoji: '🍽️', description: 'Recharge repas' },
  { value: 'transport', label: 'Transport', emoji: '🚌', description: 'Frais transport' },
  { value: 'librairie', label: 'Librairie', emoji: '📚', description: 'Fournitures' },
  { value: 'boutique', label: 'Boutique', emoji: '👕', description: 'Uniformes' },
  { value: 'autre', label: 'Autre', emoji: '📦', description: 'Autre paiement' },
];

const DEBIT_TYPES = [
  { value: 'cantine', label: 'Cantine', emoji: '🍽️' },
  { value: 'transport', label: 'Transport', emoji: '🚌' },
  { value: 'librairie', label: 'Librairie', emoji: '📚' },
  { value: 'boutique', label: 'Boutique', emoji: '👕' },
  { value: 'fournitures', label: 'Fournitures', emoji: '📦' },
  { value: 'autre', label: 'Autre', emoji: '📦' },
];

const CANTINE_MENSUEL = 400000;
const MOIS_SCOLAIRES = ['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'];

const MANUEL_PURPOSE_OPTIONS = [
  { value: 'scolarite', label: 'Paiement Scolarité', emoji: '🎓' },
  { value: 'inscription', label: 'Inscription / Réinscription', emoji: '📋' },
  { value: 'wallet', label: 'Recharge Portefeuille', emoji: '💰' },
];

export default function ParentPaymentDialog({ open, onOpenChange, enfants, code, onSuccess, soldeFamille = 0, initialMode }: PaymentDialogProps) {
  const isSingle = enfants.length === 1;
  const [activeMode, setActiveMode] = useState<'select' | 'mobile' | 'wallet'>('select');
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

  const [debitEleveId, setDebitEleveId] = useState(isSingle ? enfants[0]?.id || '' : '');
  const [debitType, setDebitType] = useState('');
  const [debitMontant, setDebitMontant] = useState('');
  const [debitDescription, setDebitDescription] = useState('');
  const [debitLoading, setDebitLoading] = useState(false);

  // Handle initialMode for wallet recharge
  useEffect(() => {
    if (open && initialMode === 'mobile-wallet') {
      setActiveMode('mobile');
      setMobileMode('manuel');
      setManuelPurpose('wallet');
    }
    if (!open) {
      setActiveMode('select');
      setMobileMode('manuel');
      setManuelPurpose('');
      setManuelMontant('');
      setDebitType('');
      setDebitMontant('');
    }
  }, [open, initialMode]);

  // Auto-fill amount when selecting debit type
  const handleDebitTypeSelect = (type: string) => {
    setDebitType(type);
    const selectedEnfantForDebit = enfants.find(e => e.id === debitEleveId);
    if (type === 'cantine') {
      setDebitMontant(CANTINE_MENSUEL.toString());
      setDebitDescription('Cantine mensuel');
    } else if (type === 'transport' && selectedEnfantForDebit?.zones_transport?.prix_mensuel) {
      setDebitMontant(selectedEnfantForDebit.zones_transport.prix_mensuel.toString());
      setDebitDescription('Transport mensuel');
    } else {
      setDebitMontant('');
      setDebitDescription('');
    }
  };

  const handlePay = async () => {
    if (!eleveId || !typePaiement || !montant || Number(montant) <= 0) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paydunya-checkout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ code, eleve_id: eleveId, type_paiement: typePaiement, montant: Number(montant), mois_concerne: typePaiement === 'scolarite' ? moisConcerne : undefined }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erreur de paiement');
      if (data.url) {
        window.open(data.url, '_blank');
        toast.success('Redirection vers la page de paiement...');
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'initialisation");
    } finally {
      setLoading(false);
    }
  };

  const handleDebitWallet = async () => {
    if (!debitEleveId || !debitType || !debitMontant || Number(debitMontant) <= 0) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    if (Number(debitMontant) > soldeFamille) {
      toast.error(`Solde insuffisant. Solde actuel : ${soldeFamille.toLocaleString()} GNF`);
      return;
    }
    setDebitLoading(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parent-data`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ code, action: 'debit_wallet', eleve_id: debitEleveId, montant: Number(debitMontant), type_paiement: debitType, description: debitDescription || null }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erreur de débit');
      toast.success(`${Number(debitMontant).toLocaleString()} GNF débités`);
      setDebitMontant(''); setDebitType(''); setDebitDescription('');
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du débit');
    } finally {
      setDebitLoading(false);
    }
  };

  const selectedEnfant = enfants.find(e => e.id === eleveId);
  const selectedDebitEnfant = enfants.find(e => e.id === debitEleveId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-0 shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* ─── Top gradient header ─── */}
        <div className="bg-gradient-to-br from-primary via-primary/90 to-accent p-5 relative">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-primary-foreground/5 -translate-y-1/2 translate-x-1/4" />
          <button onClick={() => onOpenChange(false)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary-foreground/20 transition-colors z-10">
            <X className="h-4 w-4 text-primary-foreground" />
          </button>
          {activeMode !== 'select' && (
            <button onClick={() => setActiveMode('select')} className="absolute top-3 left-3 w-8 h-8 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary-foreground/20 transition-colors z-10">
              <ArrowLeft className="h-4 w-4 text-primary-foreground" />
            </button>
          )}
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-primary-foreground/15 flex items-center justify-center mb-3">
              <CreditCard className="h-6 w-6 text-primary-foreground" />
            </div>
            <h2 className="text-lg font-extrabold text-primary-foreground">
              {activeMode === 'select' ? 'Paiements' : activeMode === 'mobile' ? 'Mobile Money' : 'Portefeuille'}
            </h2>
            <p className="text-xs text-primary-foreground/60 mt-0.5">
              {activeMode === 'select' ? 'Choisissez votre méthode de paiement' : activeMode === 'mobile' ? 'Payez via Orange Money ou MTN' : `Solde : ${soldeFamille.toLocaleString()} GNF`}
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <AnimatePresence mode="wait">
            {/* ─── MODE SELECT ─── */}
            {activeMode === 'select' && (
              <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <button
                  onClick={() => setActiveMode('mobile')}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border border-orange-200/50 hover:shadow-md transition-all active:scale-[0.98]"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-md shrink-0">
                    <Smartphone className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-sm">Mobile Money</p>
                    <p className="text-[11px] text-muted-foreground">Orange Money • MTN MoMo</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </button>

                <button
                  onClick={() => setActiveMode('wallet')}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-200/50 hover:shadow-md transition-all active:scale-[0.98]"
                >
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
                {/* Mode toggle pills */}
                <div className="flex gap-1.5 p-1 bg-muted/60 rounded-2xl">
                  <button onClick={() => setMobileMode('manuel')} className={`flex-1 text-xs font-bold py-2.5 rounded-xl transition-all ${mobileMode === 'manuel' ? 'bg-card shadow-md text-foreground' : 'text-muted-foreground'}`}>
                    📱 Manuel
                  </button>
                  <button onClick={() => setMobileMode('auto')} className={`flex-1 text-xs font-bold py-2.5 rounded-xl transition-all ${mobileMode === 'auto' ? 'bg-card shadow-md text-foreground' : 'text-muted-foreground'}`}>
                    ⚡ Automatique
                  </button>
                </div>

                {mobileMode === 'manuel' ? (
                  <div className="space-y-4">
                    {/* Purpose selector */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Motif du paiement</Label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {MANUEL_PURPOSE_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setManuelPurpose(opt.value)}
                            className={`flex flex-col items-center gap-1 p-3 rounded-xl text-center transition-all active:scale-95 ${
                              manuelPurpose === opt.value
                                ? 'bg-primary/10 ring-2 ring-primary/40 shadow-sm'
                                : 'bg-muted/40 hover:bg-muted/60'
                            }`}
                          >
                            <span className="text-lg">{opt.emoji}</span>
                            <span className="text-[9px] font-semibold leading-tight">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Montant */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Montant envoyé (GNF)</Label>
                      <Input type="number" placeholder="Ex: 500000" value={manuelMontant} onChange={e => setManuelMontant(e.target.value)} min={1000} className="rounded-xl h-11 text-lg font-bold" />
                    </div>

                    <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
                      <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-4 text-center">
                        <p className="text-[10px] text-white/70 uppercase tracking-wider font-medium">Numéro Marchand</p>
                        <div className="flex items-center justify-center gap-2 mt-1">
                          <p className="text-3xl font-extrabold tracking-widest text-white">{NUMERO_MARCHAND}</p>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(NUMERO_MARCHAND.replace(/\s/g, ''));
                              setCopied(true);
                              toast.success('Numéro copié !');
                              setTimeout(() => setCopied(false), 2000);
                            }}
                            className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                          >
                            {copied ? <CheckCircle2 className="h-4 w-4 text-white" /> : <Copy className="h-4 w-4 text-white" />}
                          </button>
                        </div>
                      </div>
                      <CardContent className="p-4 space-y-2">
                        <p className="font-bold text-xs">📋 Instructions :</p>
                        <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-muted-foreground">
                          <li>Sélectionnez le <strong>motif</strong> et saisissez le <strong>montant</strong></li>
                          <li>Envoyez le montant au <strong className="text-foreground">{NUMERO_MARCHAND}</strong> via <strong className="text-orange-600">Orange Money</strong></li>
                          <li>Faites une <strong>capture d'écran</strong> de la confirmation</li>
                          <li>Cliquez sur <strong className="text-green-600">Envoyer sur WhatsApp</strong></li>
                        </ol>
                      </CardContent>
                    </Card>
                    <Button
                      disabled={!manuelPurpose || !manuelMontant || Number(manuelMontant) <= 0}
                      onClick={() => {
                        const purposeLabel = MANUEL_PURPOSE_OPTIONS.find(o => o.value === manuelPurpose)?.label || manuelPurpose;
                        const message = encodeURIComponent(
                          `Bonjour, je viens d'effectuer un paiement Orange Money.\n\n` +
                          `📌 Motif : ${purposeLabel}\n` +
                          `💰 Montant : ${Number(manuelMontant).toLocaleString()} GNF\n` +
                          `👨‍👩‍👧 Code famille : ${code}\n\n` +
                          `Voici ma capture d'écran.`
                        );
                        window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${message}`, '_blank');
                      }}
                      className="w-full bg-green-600 hover:bg-green-700 text-white rounded-2xl h-12 font-bold" size="lg"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" /> Envoyer sur WhatsApp
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Enfant selector */}
                    {!isSingle ? (
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Enfant concerné</Label>
                        <Select value={eleveId} onValueChange={setEleveId}>
                          <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Choisir un enfant" /></SelectTrigger>
                          <SelectContent>
                            {enfants.map(e => (
                              <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40">
                        {enfants[0]?.photo_url ? (
                          <img src={enfants[0].photo_url} alt="" className="w-9 h-9 rounded-xl object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{enfants[0]?.prenom[0]}{enfants[0]?.nom[0]}</div>
                        )}
                        <div>
                          <p className="text-sm font-bold">{enfants[0]?.prenom} {enfants[0]?.nom}</p>
                          <p className="text-[10px] text-muted-foreground">{enfants[0]?.classes?.niveaux?.nom}</p>
                        </div>
                      </div>
                    )}

                    {/* Type grid */}
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Type de paiement</Label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {TYPE_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setTypePaiement(opt.value)}
                            className={`flex flex-col items-center gap-1 p-2.5 rounded-xl text-center transition-all active:scale-95 ${
                              typePaiement === opt.value
                                ? 'bg-primary/10 ring-2 ring-primary/40 shadow-sm'
                                : 'bg-muted/40 hover:bg-muted/60'
                            }`}
                          >
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
                          <SelectContent>
                            {MOIS_SCOLAIRES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
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
                    <p className="text-[10px] text-muted-foreground text-center">Paiement sécurisé via PayDunya • Orange Money & MTN MoMo</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ─── WALLET ─── */}
            {activeMode === 'wallet' && (
              <motion.div key="wallet" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                {/* Balance card */}
                <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-white/70 uppercase tracking-wider font-medium">Solde disponible</p>
                      <p className="text-2xl font-extrabold text-white">{soldeFamille.toLocaleString()} GNF</p>
                    </div>
                    <Wallet className="h-8 w-8 text-white/30" />
                  </div>
                </Card>

                {soldeFamille <= 0 ? (
                  <div className="text-center py-6">
                    <Wallet className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Solde insuffisant</p>
                    <p className="text-xs text-muted-foreground mt-1">Rechargez via Mobile Money d'abord</p>
                    <Button variant="outline" className="mt-3 rounded-xl" onClick={() => setActiveMode('mobile')}>
                      <Smartphone className="h-4 w-4 mr-2" /> Recharger
                    </Button>
                  </div>
                ) : (
                  <>
                    {!isSingle ? (
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Enfant concerné</Label>
                        <Select value={debitEleveId} onValueChange={setDebitEleveId}>
                          <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Choisir un enfant" /></SelectTrigger>
                          <SelectContent>
                            {enfants.map(e => <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40">
                        {enfants[0]?.photo_url ? (
                          <img src={enfants[0].photo_url} alt="" className="w-9 h-9 rounded-xl object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{enfants[0]?.prenom[0]}{enfants[0]?.nom[0]}</div>
                        )}
                        <div>
                          <p className="text-sm font-bold">{enfants[0]?.prenom} {enfants[0]?.nom}</p>
                          <p className="text-[10px] text-muted-foreground">{enfants[0]?.classes?.niveaux?.nom}</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Type de paiement</Label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {DEBIT_TYPES.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setDebitType(opt.value)}
                            className={`flex flex-col items-center gap-1 p-2.5 rounded-xl text-center transition-all active:scale-95 ${
                              debitType === opt.value
                                ? 'bg-primary/10 ring-2 ring-primary/40 shadow-sm'
                                : 'bg-muted/40 hover:bg-muted/60'
                            }`}
                          >
                            <span className="text-lg">{opt.emoji}</span>
                            <span className="text-[9px] font-semibold leading-tight">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Montant à débiter (GNF)</Label>
                      <Input type="number" placeholder="Ex: 200000" value={debitMontant} onChange={e => setDebitMontant(e.target.value)} min={100} max={soldeFamille} className="rounded-xl h-11 text-lg font-bold" />
                      {Number(debitMontant) > soldeFamille && (
                        <p className="text-xs text-destructive">Montant supérieur au solde</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold">Description (optionnel)</Label>
                      <Input placeholder="Ex: Scolarité Janvier" value={debitDescription} onChange={e => setDebitDescription(e.target.value)} maxLength={100} className="rounded-xl h-11" />
                    </div>

                    {debitEleveId && debitType && debitMontant && Number(debitMontant) > 0 && Number(debitMontant) <= soldeFamille && (
                      <Card className="border-0 shadow-md rounded-2xl bg-destructive/5">
                        <CardContent className="p-4 space-y-1.5">
                          <p className="text-xs font-bold uppercase text-muted-foreground">Récapitulatif du débit</p>
                          <p className="text-sm">👤 {selectedDebitEnfant?.prenom} {selectedDebitEnfant?.nom}</p>
                          <p className="text-sm">{DEBIT_TYPES.find(t => t.value === debitType)?.emoji} {DEBIT_TYPES.find(t => t.value === debitType)?.label}</p>
                          {debitDescription && <p className="text-sm">📝 {debitDescription}</p>}
                          <p className="text-2xl font-extrabold text-destructive">−{Number(debitMontant).toLocaleString()} GNF</p>
                          <p className="text-[11px] text-muted-foreground">Solde après : <strong>{(soldeFamille - Number(debitMontant)).toLocaleString()} GNF</strong></p>
                        </CardContent>
                      </Card>
                    )}

                    <Button onClick={handleDebitWallet} disabled={debitLoading || Number(debitMontant) > soldeFamille} className="w-full rounded-2xl h-12 font-bold" size="lg">
                      {debitLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Traitement...</> : <><Wallet className="h-4 w-4 mr-2" /> Débiter le portefeuille</>}
                    </Button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
