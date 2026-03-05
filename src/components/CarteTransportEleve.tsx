import { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bus, CreditCard, Download, Printer, Search, Wallet, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { QRCodeCanvas } from 'qrcode.react';
import { useState, useMemo } from 'react';
import html2canvas from 'html2canvas';

interface CarteTransportEleveProps {
  zones: any[];
}

export default function CarteTransportEleve({ zones }: CarteTransportEleveProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterZone, setFilterZone] = useState('all');
  const [rechargeDialog, setRechargeDialog] = useState<any>(null);
  const [montantRecharge, setMontantRecharge] = useState('');
  const [printCard, setPrintCard] = useState<any>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const { data: eleves = [] } = useQuery({
    queryKey: ['transport-card-eleves'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, classe_id, classes(nom), zone_transport_id, zones_transport:zone_transport_id(id, nom, prix_mensuel, chauffeur_bus)')
        .not('zone_transport_id', 'is', null)
        .eq('statut', 'inscrit')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  const { data: recharges = [] } = useQuery({
    queryKey: ['recharges-transport'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recharges_transport')
        .select('*')
        .order('date_recharge', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const rechargeMutation = useMutation({
    mutationFn: async ({ eleveId, montant }: { eleveId: string; montant: number }) => {
      // Désactiver les anciennes recharges actives
      await supabase
        .from('recharges_transport')
        .update({ actif: false } as any)
        .eq('eleve_id', eleveId)
        .eq('actif', true);

      const { error } = await supabase.from('recharges_transport').insert({
        eleve_id: eleveId,
        montant,
        actif: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recharges-transport'] });
      toast({ title: 'Recharge effectuée', description: 'La carte transport a été rechargée pour 30 jours.' });
      setRechargeDialog(null);
      setMontantRecharge('');
    },
    onError: (err: any) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    },
  });

  const getActiveRecharge = (eleveId: string) => {
    return recharges.find(
      (r: any) => r.eleve_id === eleveId && r.actif && new Date(r.date_expiration) > new Date()
    );
  };

  const getDaysRemaining = (dateExpiration: string) => {
    const diff = new Date(dateExpiration).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const filteredEleves = useMemo(() => {
    return eleves.filter((e: any) => {
      const matchSearch = `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(search.toLowerCase());
      const matchZone = filterZone === 'all' || e.zone_transport_id === filterZone;
      return matchSearch && matchZone;
    });
  }, [eleves, search, filterZone]);

  const exportCard = async () => {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, { scale: 3, useCORS: true });
    const link = document.createElement('a');
    link.download = `carte_transport_${printCard?.matricule || 'eleve'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast({ title: 'Carte exportée' });
  };

  const totalActives = eleves.filter((e: any) => getActiveRecharge(e.id)).length;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Cartes actives</p>
                <p className="text-2xl font-bold">{totalActives} / {eleves.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Wallet className="h-8 w-8 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">Recharges ce mois</p>
                <p className="text-2xl font-bold">
                  {recharges.filter((r: any) => {
                    const d = new Date(r.date_recharge);
                    const now = new Date();
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-8 w-8 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Cartes expirées</p>
                <p className="text-2xl font-bold text-destructive">{eleves.length - totalActives}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterZone} onValueChange={setFilterZone}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Zone" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les zones</SelectItem>
            {zones.map((z: any) => <SelectItem key={z.id} value={z.id}>{z.nom}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matricule</TableHead>
                <TableHead>Élève</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead className="text-center">Statut carte</TableHead>
                <TableHead className="text-center">Jours restants</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEleves.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun élève</TableCell></TableRow>
              ) : filteredEleves.map((e: any) => {
                const recharge = getActiveRecharge(e.id);
                const jours = recharge ? getDaysRemaining(recharge.date_expiration) : 0;
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.matricule || '—'}</TableCell>
                    <TableCell className="font-medium">{e.prenom} {e.nom}</TableCell>
                    <TableCell>{e.classes?.nom || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{(e.zones_transport as any)?.nom || '—'}</Badge></TableCell>
                    <TableCell className="text-center">
                      <Badge variant={recharge ? 'default' : 'destructive'}>
                        {recharge ? 'Active' : 'Expirée'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {recharge ? (
                        <span className={jours <= 5 ? 'text-destructive font-bold' : jours <= 10 ? 'text-warning font-medium' : ''}>
                          {jours}j
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="outline" onClick={() => {
                          setRechargeDialog(e);
                          setMontantRecharge(String((e.zones_transport as any)?.prix_mensuel || 0));
                        }}>
                          <Wallet className="h-3 w-3 mr-1" /> Recharger
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setPrintCard({ ...e, recharge })}>
                          <Printer className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog recharge */}
      <Dialog open={!!rechargeDialog} onOpenChange={() => setRechargeDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Recharger la carte transport</DialogTitle></DialogHeader>
          {rechargeDialog && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p><strong>Élève :</strong> {rechargeDialog.prenom} {rechargeDialog.nom}</p>
                <p><strong>Zone :</strong> {(rechargeDialog.zones_transport as any)?.nom}</p>
                <p><strong>Validité :</strong> 30 jours à partir d'aujourd'hui</p>
              </div>
              <div>
                <label className="text-sm font-medium">Montant (GNF)</label>
                <Input type="number" value={montantRecharge} onChange={e => setMontantRecharge(e.target.value)} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setRechargeDialog(null)}>Annuler</Button>
                <Button
                  disabled={rechargeMutation.isPending || !montantRecharge}
                  onClick={() => rechargeMutation.mutate({ eleveId: rechargeDialog.id, montant: Number(montantRecharge) })}
                >
                  {rechargeMutation.isPending ? 'En cours…' : 'Confirmer la recharge'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog impression carte */}
      <Dialog open={!!printCard} onOpenChange={() => setPrintCard(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Carte de transport</DialogTitle></DialogHeader>
          {printCard && (
            <div className="space-y-4">
              <div ref={cardRef} className="bg-gradient-to-br from-primary/90 to-primary rounded-xl p-5 text-primary-foreground mx-auto" style={{ width: 340, minHeight: 200 }}>
                <div className="flex items-center gap-2 mb-3 border-b border-primary-foreground/20 pb-2">
                  <Bus className="h-6 w-6" />
                  <div>
                    <p className="font-bold text-sm">CARTE DE TRANSPORT</p>
                    <p className="text-[10px] opacity-80">Rechargeable • 30 jours</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1.5">
                    <p className="text-lg font-bold leading-tight">{printCard.prenom} {printCard.nom}</p>
                    <p className="text-xs opacity-80">Matricule : {printCard.matricule || '—'}</p>
                    <p className="text-xs opacity-80">Classe : {printCard.classes?.nom || '—'}</p>
                    <p className="text-xs opacity-80">Zone : {(printCard.zones_transport as any)?.nom || '—'}</p>
                    <div className="mt-2 pt-2 border-t border-primary-foreground/20">
                      {printCard.recharge ? (
                        <>
                          <p className="text-[10px] opacity-70">Expire le</p>
                          <p className="text-sm font-bold">{new Date(printCard.recharge.date_expiration).toLocaleDateString('fr-FR')}</p>
                        </>
                      ) : (
                        <p className="text-xs font-bold text-warning">NON RECHARGÉE</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <div className="bg-white rounded-lg p-1.5">
                      <QRCodeCanvas
                        value={JSON.stringify({ type: 'transport', matricule: printCard.matricule, id: printCard.id })}
                        size={80}
                        level="M"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setPrintCard(null)}>Fermer</Button>
                <Button onClick={exportCard}>
                  <Download className="h-4 w-4 mr-1" /> Exporter PNG
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
