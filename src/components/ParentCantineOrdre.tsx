import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  const [selectedIds, setSelectedIds] = useState<string[]>(enfants.length === 1 ? [enfants[0]?.id || ''] : []);
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

  const toggleChild = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === enfants.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(enfants.map(e => e.id));
    }
  };

  const handleCreate = async () => {
    if (selectedIds.length === 0 || !montant || Number(montant) <= 0) {
      toast.error('Veuillez sélectionner au moins un enfant et saisir un montant');
      return;
    }
    setLoading(true);
    try {
      // Create one order per selected child
      for (const eleveId of selectedIds) {
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
      }
      const count = selectedIds.length;
      toast.success(`${count} ordre(s) de rechargement créé(s) ! Présentez-vous à la caisse avec le code.`);
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

  const totalRecharge = selectedIds.length * Number(montant || 0);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base">
          <UtensilsCrossed className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" /> Recharge Cantine
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="text-xs sm:text-sm px-2 sm:px-3 h-8 whitespace-nowrap">
              <UtensilsCrossed className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" /> Recharger
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md w-[95vw] sm:w-full p-3 sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <UtensilsCrossed className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Rechargement Cantine
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Sélectionnez un ou plusieurs enfants et saisissez le montant par enfant.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 sm:space-y-4">
              {/* Multi-child selection */}
              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs sm:text-sm">Enfant(s) à recharger</Label>
                  {enfants.length > 1 && (
                    <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={selectAll}>
                      {selectedIds.length === enfants.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                    </Button>
                  )}
                </div>
                <div className="space-y-1.5">
                  {enfants.map(e => (
                    <label
                      key={e.id}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        selectedIds.includes(e.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <Checkbox
                        checked={selectedIds.includes(e.id)}
                        onCheckedChange={() => toggleChild(e.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{e.prenom} {e.nom}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          Solde: {(e.solde_cantine || 0).toLocaleString()} GNF
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm">Montant par enfant (GNF)</Label>
                <Input
                  type="number"
                  placeholder="Ex: 100000"
                  value={montant}
                  onChange={e => setMontant(e.target.value)}
                  min={1000}
                  className="h-9 sm:h-10 text-sm"
                />
                {selectedIds.length > 1 && Number(montant) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Total: <span className="font-bold text-primary">{totalRecharge.toLocaleString()} GNF</span> ({selectedIds.length} × {Number(montant).toLocaleString()} GNF)
                  </p>
                )}
              </div>
              <Button onClick={handleCreate} disabled={loading} className="w-full h-9 sm:h-10 text-xs sm:text-sm">
                {loading ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 animate-spin" /> : <QrCode className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />}
                Recharger {selectedIds.length > 1 ? `${selectedIds.length} enfants` : ''}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Soldes actuels */}
      <div className="grid grid-cols-2 gap-2">
        {enfants.map(e => (
          <Card key={e.id} className="border-primary/20">
            <CardContent className="pt-2.5 sm:pt-3 pb-2 px-3 sm:px-6">
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{e.prenom} {e.nom}</p>
              <p className="text-base sm:text-lg font-bold text-primary truncate">{(e.solde_cantine || 0).toLocaleString()} GNF</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ordres en cours */}
      {loadingOrdres ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : ordres.length > 0 ? (
        <div className="space-y-1.5 sm:space-y-2">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">Historique des ordres</p>
          {ordres.map((o: any) => {
            const cfg = statusConfig[o.statut as keyof typeof statusConfig] || statusConfig.en_attente;
            const Icon = cfg.icon;
            return (
              <Card key={o.id}>
                <CardContent className="py-2 sm:py-3 px-3 sm:px-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <Badge variant="outline" className={`${cfg.className} text-[10px] sm:text-xs px-1.5 sm:px-2`}>
                          <Icon className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                          {cfg.label}
                        </Badge>
                        <span className="text-xs sm:text-sm font-medium truncate">{o.eleves?.prenom} {o.eleves?.nom}</span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {o.statut === 'en_attente' && (
                        <div className="flex items-center gap-2 mt-1.5 sm:mt-2">
                          <QRCodeSVG value={o.code_transaction} size={48} className="sm:hidden shrink-0" />
                          <QRCodeSVG value={o.code_transaction} size={64} className="hidden sm:block shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] sm:text-xs text-muted-foreground">Code transaction</p>
                            <p className="font-mono font-bold text-sm sm:text-lg tracking-wider truncate">{o.code_transaction}</p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">Présentez ce code à la caisse</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="font-bold text-primary text-sm sm:text-lg whitespace-nowrap shrink-0">{Number(o.montant).toLocaleString()} GNF</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="text-center text-xs sm:text-sm text-muted-foreground py-3 sm:py-4">Aucun ordre de rechargement</p>
      )}
    </div>
  );
}
