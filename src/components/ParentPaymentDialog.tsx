import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Smartphone, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enfants: Array<{ id: string; nom: string; prenom: string; classes?: any; solde_cantine?: number }>;
  code: string;
  onSuccess?: () => void;
}

const TYPE_OPTIONS = [
  { value: 'scolarite', label: '🎓 Scolarité', description: 'Paiement tranche mensuelle' },
  { value: 'cantine', label: '🍽️ Recharge Cantine', description: 'Crédit repas' },
  { value: 'transport', label: '🚌 Transport', description: 'Frais de transport' },
  { value: 'inscription', label: '📋 Inscription', description: 'Frais d\'inscription' },
  { value: 'librairie', label: '📚 Librairie', description: 'Fournitures scolaires' },
  { value: 'boutique', label: '👕 Boutique', description: 'Uniformes et accessoires' },
  { value: 'autre', label: '📦 Autre', description: 'Autre type de paiement' },
];

const MOIS_SCOLAIRES = ['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'];

export default function ParentPaymentDialog({ open, onOpenChange, enfants, code, onSuccess }: PaymentDialogProps) {
  const isSingle = enfants.length === 1;
  const [eleveId, setEleveId] = useState(isSingle ? enfants[0]?.id || '' : '');
  const [typePaiement, setTypePaiement] = useState('');
  const [montant, setMontant] = useState('');
  const [moisConcerne, setMoisConcerne] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-select when single child
  useState(() => {
    if (isSingle && enfants[0]) setEleveId(enfants[0].id);
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

      // Redirect to PayDunya payment page
      if (data.url) {
        window.open(data.url, '_blank');
        toast.success('Redirection vers la page de paiement...');
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error('URL de paiement non reçue');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'initialisation du paiement');
    } finally {
      setLoading(false);
    }
  };

  const selectedEnfant = enfants.find(e => e.id === eleveId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Paiement Mobile Money
          </DialogTitle>
          <DialogDescription>
            Payez via Orange Money ou MTN Mobile Money en toute sécurité.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Enfant selection - hidden if single child */}
          {isSingle ? (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="text-xs text-muted-foreground">Élève</p>
              <p className="font-semibold">{enfants[0]?.prenom} {enfants[0]?.nom}</p>
              {enfants[0]?.classes?.niveaux?.nom && (
                <p className="text-xs text-muted-foreground">{enfants[0]?.classes?.niveaux?.nom}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Enfant concerné</Label>
              <Select value={eleveId} onValueChange={setEleveId}>
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
          )}

          {/* Type de paiement */}
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

          {/* Mois (for scolarité) */}
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

          {/* Montant */}
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

          {/* Summary */}
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
              <><CreditCard className="h-4 w-4 mr-2" /> Payer maintenant</>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Paiement sécurisé via PayDunya • Orange Money & MTN MoMo
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
