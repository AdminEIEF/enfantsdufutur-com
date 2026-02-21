import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, Loader2, QrCode, Clock, CheckCircle, XCircle, BookOpen, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

const TYPE_SERVICES = [
  { value: 'wallet', label: 'Recharge Portefeuille', icon: Wallet, color: 'text-green-600' },
  { value: 'librairie', label: 'Librairie', icon: BookOpen, color: 'text-blue-600' },
  { value: 'boutique', label: 'Boutique', icon: ShoppingBag, color: 'text-purple-600' },
];

interface Props {
  enfants: Array<{ id: string; nom: string; prenom: string }>;
  code: string;
  soldeFamille?: number;
  onSuccess?: () => void;
}

export default function ParentServiceOrdre({ enfants, code, soldeFamille = 0, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [typeService, setTypeService] = useState('wallet');
  const [eleveId, setEleveId] = useState(enfants.length === 1 ? enfants[0]?.id || '' : '');
  const [montant, setMontant] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [ordres, setOrdres] = useState<any[]>([]);
  const [loadingOrdres, setLoadingOrdres] = useState(false);

  const fetchOrdres = async () => {
    setLoadingOrdres(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/service-ordre`,
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

  useEffect(() => { fetchOrdres(); }, []);

  const handleCreate = async () => {
    if (!montant || Number(montant) <= 0) {
      toast.error('Veuillez saisir un montant valide');
      return;
    }
    if ((typeService === 'librairie' || typeService === 'boutique') && !eleveId) {
      toast.error('Veuillez sélectionner un enfant');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/service-ordre`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            action: 'create_ordre',
            code,
            eleve_id: typeService === 'wallet' ? null : eleveId,
            montant: Number(montant),
            type_service: typeService,
            description: description || null,
          }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      toast.success('Ordre créé ! Présentez le code à la caisse pour validation.');
      setMontant('');
      setDescription('');
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

  const typeLabels: Record<string, string> = { wallet: '💰 Portefeuille', librairie: '📚 Librairie', boutique: '👕 Boutique', cantine: '🍽️ Cantine' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" /> Ordres de Paiement
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <QrCode className="h-4 w-4 mr-1" /> Nouvel ordre
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Créer un ordre de paiement
              </DialogTitle>
              <DialogDescription>
                Créez un ordre puis présentez-vous à la caisse avec le code pour valider le versement.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Type de service</Label>
                <Select value={typeService} onValueChange={setTypeService}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_SERVICES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(typeService === 'librairie' || typeService === 'boutique') && enfants.length > 1 && (
                <div className="space-y-2">
                  <Label>Enfant concerné</Label>
                  <Select value={eleveId} onValueChange={setEleveId}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un enfant" /></SelectTrigger>
                    <SelectContent>
                      {enfants.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {typeService === 'wallet' && (
                <div className="bg-green-50 rounded-lg p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Solde portefeuille actuel</p>
                  <p className="font-bold text-green-700 text-lg">{soldeFamille.toLocaleString()} GNF</p>
                  <p className="text-xs text-muted-foreground mt-1">Le montant sera crédité après validation à la caisse</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Montant (GNF)</Label>
                <Input type="number" placeholder="Ex: 100000" value={montant} onChange={e => setMontant(e.target.value)} min={1000} />
              </div>

              <div className="space-y-2">
                <Label>Description (optionnel)</Label>
                <Input placeholder="Ex: Manuels scolaires" value={description} onChange={e => setDescription(e.target.value)} />
              </div>

              <Button onClick={handleCreate} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <QrCode className="h-4 w-4 mr-2" />}
                Créer l'ordre
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active orders */}
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cfg.className}>
                          <Icon className="h-3 w-3 mr-1" />{cfg.label}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {typeLabels[o.type_service] || o.type_service}
                        </Badge>
                        {o.eleves && <span className="text-sm">{o.eleves.prenom} {o.eleves.nom}</span>}
                      </div>
                      {o.description && <p className="text-xs text-muted-foreground">{o.description}</p>}
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
        <p className="text-center text-sm text-muted-foreground py-4">Aucun ordre de paiement</p>
      )}
    </div>
  );
}
