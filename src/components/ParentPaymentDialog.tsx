import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Smartphone, CreditCard, Wallet } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enfants: Array<{ id: string; nom: string; prenom: string; classes?: any; solde_cantine?: number }>;
  code: string;
  onSuccess?: () => void;
  soldeFamille?: number;
}

const TYPE_OPTIONS = [
  { value: 'scolarite', label: '🎓 Scolarité', description: 'Paiement tranche mensuelle' },
  { value: 'cantine', label: '🍽️ Recharge Cantine', description: 'Crédit repas' },
  { value: 'transport', label: '🚌 Transport', description: 'Frais de transport' },
  { value: 'wallet', label: '💰 Recharge Portefeuille', description: 'Recharger le solde famille' },
  { value: 'inscription', label: '📋 Inscription', description: "Frais d'inscription" },
  { value: 'librairie', label: '📚 Librairie', description: 'Fournitures scolaires' },
  { value: 'boutique', label: '👕 Boutique', description: 'Uniformes et accessoires' },
  { value: 'autre', label: '📦 Autre', description: 'Autre type de paiement' },
];

const DEBIT_TYPES = [
  { value: 'scolarite', label: '🎓 Scolarité' },
  { value: 'cantine', label: '🍽️ Recharge Cantine' },
  { value: 'transport', label: '🚌 Transport' },
  { value: 'librairie', label: '📚 Librairie' },
  { value: 'boutique', label: '👕 Boutique' },
  { value: 'fournitures', label: '📦 Fournitures' },
  { value: 'autre', label: '📦 Autre' },
];

const MOIS_SCOLAIRES = ['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'];

export default function ParentPaymentDialog({ open, onOpenChange, enfants, code, onSuccess, soldeFamille = 0 }: PaymentDialogProps) {
  const isSingle = enfants.length === 1;
  const [eleveId, setEleveId] = useState(isSingle ? enfants[0]?.id || '' : '');
  const [typePaiement, setTypePaiement] = useState('');
  const [montant, setMontant] = useState('');
  const [moisConcerne, setMoisConcerne] = useState('');
  const [loading, setLoading] = useState(false);

  // Debit wallet state
  const [debitEleveId, setDebitEleveId] = useState(isSingle ? enfants[0]?.id || '' : '');
  const [debitType, setDebitType] = useState('');
  const [debitMontant, setDebitMontant] = useState('');
  const [debitDescription, setDebitDescription] = useState('');
  const [debitLoading, setDebitLoading] = useState(false);

  // Auto-select when single child
  useState(() => {
    if (isSingle && enfants[0]) {
      setEleveId(enfants[0].id);
      setDebitEleveId(enfants[0].id);
    }
  });

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
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            code,
            eleve_id: eleveId,
            type_paiement: typePaiement,
            montant: Number(montant),
            mois_concerne: typePaiement === 'scolarite' ? moisConcerne : undefined,
          }),
        }
      );

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erreur de paiement');

      if (data.url) {
        window.open(data.url, '_blank');
        toast.success('Redirection vers la page de paiement...');
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error('URL de paiement non reçue');
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'initialisation du paiement");
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
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            code,
            action: 'debit_wallet',
            eleve_id: debitEleveId,
            montant: Number(debitMontant),
            type_paiement: debitType,
            description: debitDescription || null,
          }),
        }
      );

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erreur de débit');

      toast.success(`${Number(debitMontant).toLocaleString()} GNF débités du portefeuille`);
      setDebitMontant('');
      setDebitType('');
      setDebitDescription('');
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

  const EnfantSelector = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
    if (isSingle) {
      return (
        <div className="bg-muted/50 rounded-lg p-3 text-sm">
          <p className="text-xs text-muted-foreground">Élève</p>
          <p className="font-semibold">{enfants[0]?.prenom} {enfants[0]?.nom}</p>
          {enfants[0]?.classes?.niveaux?.nom && (
            <p className="text-xs text-muted-foreground">{enfants[0]?.classes?.niveaux?.nom}</p>
          )}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <Label>Enfant concerné</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner un enfant" />
          </SelectTrigger>
          <SelectContent>
            {enfants.map(e => (
              <SelectItem key={e.id} value={e.id}>
                {e.prenom} {e.nom} {e.classes?.niveaux?.nom ? `— ${e.classes.niveaux.nom}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Paiements
          </DialogTitle>
          <DialogDescription>
            Rechargez par Mobile Money ou payez depuis votre portefeuille.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="mobile">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="mobile" className="text-xs">
              <Smartphone className="h-3 w-3 mr-1" /> Mobile Money
            </TabsTrigger>
            <TabsTrigger value="wallet" className="text-xs">
              <Wallet className="h-3 w-3 mr-1" /> Portefeuille
            </TabsTrigger>
          </TabsList>

          {/* ─── MOBILE MONEY TAB ─── */}
          <TabsContent value="mobile" className="space-y-4 mt-4">
            <EnfantSelector value={eleveId} onChange={setEleveId} />

            <div className="space-y-2">
              <Label>Type de paiement</Label>
              <Select value={typePaiement} onValueChange={setTypePaiement}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner le type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {typePaiement === 'scolarite' && (
              <div className="space-y-2">
                <Label>Mois concerné</Label>
                <Select value={moisConcerne} onValueChange={setMoisConcerne}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner le mois" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOIS_SCOLAIRES.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Montant (GNF)</Label>
              <Input
                type="number"
                placeholder="Ex: 500000"
                value={montant}
                onChange={e => setMontant(e.target.value)}
                min={1000}
              />
            </div>

            {eleveId && typePaiement && montant && Number(montant) > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p className="font-medium">Récapitulatif :</p>
                <p>👤 {selectedEnfant?.prenom} {selectedEnfant?.nom}</p>
                <p>📋 {TYPE_OPTIONS.find(t => t.value === typePaiement)?.label}</p>
                {moisConcerne && <p>📅 {moisConcerne}</p>}
                <p className="text-lg font-bold text-primary">{Number(montant).toLocaleString()} GNF</p>
              </div>
            )}

            <Button onClick={handlePay} disabled={loading} className="w-full" size="lg">
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Initialisation...</>
              ) : (
                <><Smartphone className="h-4 w-4 mr-2" /> Payer via Mobile Money</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Paiement sécurisé via PayDunya • Orange Money & MTN MoMo
            </p>
          </TabsContent>

          {/* ─── WALLET DEBIT TAB ─── */}
          <TabsContent value="wallet" className="space-y-4 mt-4">
            {/* Wallet balance */}
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">💰 Solde Portefeuille</p>
                    <p className="text-2xl font-bold text-green-700">{soldeFamille.toLocaleString()} GNF</p>
                  </div>
                  <Wallet className="h-8 w-8 text-green-300" />
                </div>
                {soldeFamille <= 0 && (
                  <p className="text-xs text-destructive mt-2">
                    Solde insuffisant. Rechargez d'abord via l'onglet "Mobile Money" → type "Recharge Portefeuille".
                  </p>
                )}
              </CardContent>
            </Card>

            {soldeFamille > 0 && (
              <>
                <EnfantSelector value={debitEleveId} onChange={setDebitEleveId} />

                <div className="space-y-2">
                  <Label>Type de paiement</Label>
                  <Select value={debitType} onValueChange={setDebitType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner le type" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEBIT_TYPES.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Montant à débiter (GNF)</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 200000"
                    value={debitMontant}
                    onChange={e => setDebitMontant(e.target.value)}
                    min={100}
                    max={soldeFamille}
                  />
                  {Number(debitMontant) > soldeFamille && (
                    <p className="text-xs text-destructive">Le montant dépasse le solde disponible</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Description (optionnel)</Label>
                  <Input
                    placeholder="Ex: Scolarité Janvier"
                    value={debitDescription}
                    onChange={e => setDebitDescription(e.target.value)}
                    maxLength={100}
                  />
                </div>

                {debitEleveId && debitType && debitMontant && Number(debitMontant) > 0 && Number(debitMontant) <= soldeFamille && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                    <p className="font-medium">Récapitulatif du débit :</p>
                    <p>👤 {selectedDebitEnfant?.prenom} {selectedDebitEnfant?.nom}</p>
                    <p>📋 {DEBIT_TYPES.find(t => t.value === debitType)?.label}</p>
                    {debitDescription && <p>📝 {debitDescription}</p>}
                    <p className="text-lg font-bold text-destructive">−{Number(debitMontant).toLocaleString()} GNF</p>
                    <p className="text-xs text-muted-foreground">
                      Solde après débit : <strong>{(soldeFamille - Number(debitMontant)).toLocaleString()} GNF</strong>
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleDebitWallet}
                  disabled={debitLoading || Number(debitMontant) > soldeFamille}
                  className="w-full"
                  size="lg"
                  variant="default"
                >
                  {debitLoading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Traitement...</>
                  ) : (
                    <><Wallet className="h-4 w-4 mr-2" /> Débiter le portefeuille</>
                  )}
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
