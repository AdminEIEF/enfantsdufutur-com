import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { UtensilsCrossed, Loader2, QrCode, Clock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  enfants: Array<{ id: string; nom: string; prenom: string; solde_cantine?: number; option_cantine?: boolean }>;
  code: string;
  onSuccess?: () => void;
}

export default function ParentCantineOrdre({ enfants, code, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [eleveId, setEleveId] = useState(enfants.length === 1 ? enfants[0]?.id || '' : '');
  const [montant, setMontant] = useState('');
  const [loading, setLoading] = useState(false);
  const [ordres, setOrdres] = useState<any[]>([]);
  const [loadingOrdres, setLoadingOrdres] = useState(false);

  const fetchOrdres = async () => {
    setLoadingOrdres(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cantine-ordre`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ action: 'get_ordres', code }),
        }
      );
      const data = await resp.json();
      if (resp.ok) setOrdres(data.ordres || []);
    } catch {
      // silent
    } finally {
      setLoadingOrdres(false);
    }
  };

  useEffect(() => {
    fetchOrdres();
  }, []);

  const handleCreate = async () => {
    if (!eleveId || !montant || Number(montant) <= 0) {
      toast.error('Veuillez sélectionner un enfant et saisir un montant');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cantine-ordre`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ action: 'create_ordre', code, eleve_id: eleveId, montant: Number(montant) }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      toast.success('Ordre de rechargement créé ! Présentez-vous à la caisse avec le code.');
      setMontant('');
      setOpen(false);
      fetchOrdres();
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const statusConfig = {
    en_attente: { label: 'En attente', icon: Clock, className: 'bg-amber-100 text-amber-800 border-amber-300' },
    valide: { label: 'Validé', icon: CheckCircle, className: 'bg-green-100 text-green-800 border-green-300' },
    annule: { label: 'Annulé', icon: XCircle, className: 'bg-red-100 text-red-800 border-red-300' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5 text-primary" /> Recharge Cantine
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <UtensilsCrossed className="h-4 w-4 mr-1" /> Ordonner un rechargement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5 text-primary" />
                Ordonner un rechargement Cantine
              </DialogTitle>
              <DialogDescription>
                Créez un ordre de rechargement. Présentez-vous ensuite à la caisse avec le code pour valider le versement.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {enfants.length > 1 ? (
                <div className="space-y-2">
                  <Label>Enfant concerné</Label>
                  <Select value={eleveId} onValueChange={setEleveId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un enfant" />
                    </SelectTrigger>
                    <SelectContent>
                      {enfants.filter(e => e.option_cantine).map(e => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.prenom} {e.nom} — Solde: {(e.solde_cantine || 0).toLocaleString()} GNF
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Élève</p>
                  <p className="font-semibold">{enfants[0]?.prenom} {enfants[0]?.nom}</p>
                  <p className="text-xs text-muted-foreground">Solde actuel: {(enfants[0]?.solde_cantine || 0).toLocaleString()} GNF</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Montant à recharger (GNF)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 100000"
                  value={montant}
                  onChange={e => setMontant(e.target.value)}
                  min={1000}
                />
              </div>
              <Button onClick={handleCreate} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <QrCode className="h-4 w-4 mr-2" />}
                Créer l'ordre de rechargement
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Soldes actuels */}
      <div className="grid grid-cols-2 gap-2">
        {enfants.filter(e => e.option_cantine).map(e => (
          <Card key={e.id} className="border-primary/20">
            <CardContent className="pt-3 pb-2">
              <p className="text-xs text-muted-foreground">{e.prenom} {e.nom}</p>
              <p className="text-lg font-bold text-primary">{(e.solde_cantine || 0).toLocaleString()} GNF</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ordres en cours */}
      {loadingOrdres ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : ordres.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Historique des ordres</p>
          {ordres.map((o: any) => {
            const cfg = statusConfig[o.statut as keyof typeof statusConfig] || statusConfig.en_attente;
            const Icon = cfg.icon;
            return (
              <Card key={o.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cfg.className}>
                          <Icon className="h-3 w-3 mr-1" />
                          {cfg.label}
                        </Badge>
                        <span className="text-sm font-medium">{o.eleves?.prenom} {o.eleves?.nom}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {o.statut === 'en_attente' && (
                        <div className="flex items-center gap-2 mt-2">
                          <QRCodeSVG value={o.code_transaction} size={64} />
                          <div>
                            <p className="text-xs text-muted-foreground">Code transaction</p>
                            <p className="font-mono font-bold text-lg tracking-wider">{o.code_transaction}</p>
                            <p className="text-xs text-muted-foreground">Présentez ce code à la caisse</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="font-bold text-primary text-lg">{Number(o.montant).toLocaleString()} GNF</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground py-4">Aucun ordre de rechargement</p>
      )}
    </div>
  );
}
