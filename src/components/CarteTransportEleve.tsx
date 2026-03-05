import { useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bus, CreditCard, Download, Printer, Search, Wallet, RefreshCw, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { QRCodeCanvas } from 'qrcode.react';
import { useState, useMemo } from 'react';
import html2canvas from 'html2canvas';

interface CarteTransportEleveProps {
  zones: any[];
}

export default function CarteTransportEleve({ zones }: CarteTransportEleveProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: schoolConfig } = useSchoolConfig();
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
        .select('id, nom, prenom, matricule, classe_id, photo_url, classes(nom), zone_transport_id, zones_transport:zone_transport_id(id, nom, prix_mensuel, chauffeur_bus)')
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
      if (error) {
        if (error.message?.includes('déjà été rechargé')) {
          throw new Error('Cet élève a déjà été rechargé pour ce mois.');
        }
        throw error;
      }
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

  const hasRechargeThisMonth = (eleveId: string) => {
    const now = new Date();
    return recharges.some(
      (r: any) => r.eleve_id === eleveId &&
        new Date(r.date_recharge).getMonth() === now.getMonth() &&
        new Date(r.date_recharge).getFullYear() === now.getFullYear()
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
    const canvas = await html2canvas(cardRef.current, { scale: 4, useCORS: true, backgroundColor: null });
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
                const alreadyThisMonth = hasRechargeThisMonth(e.id);
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
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={alreadyThisMonth}
                          title={alreadyThisMonth ? 'Déjà rechargé ce mois' : ''}
                          onClick={() => {
                            setRechargeDialog(e);
                            setMontantRecharge(String((e.zones_transport as any)?.prix_mensuel || 0));
                          }}
                        >
                          <Wallet className="h-3 w-3 mr-1" /> {alreadyThisMonth ? 'Rechargé' : 'Recharger'}
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
              {hasRechargeThisMonth(rechargeDialog.id) && (
                <div className="bg-warning/10 border border-warning/30 rounded-md p-3 text-sm text-warning-foreground">
                  ⚠️ Cet élève a déjà été rechargé ce mois-ci. Une seule recharge par mois est autorisée.
                </div>
              )}
              <div>
                <label className="text-sm font-medium">Montant (GNF)</label>
                <Input type="number" value={montantRecharge} onChange={e => setMontantRecharge(e.target.value)} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setRechargeDialog(null)}>Annuler</Button>
                <Button
                  disabled={rechargeMutation.isPending || !montantRecharge || hasRechargeThisMonth(rechargeDialog.id)}
                  onClick={() => rechargeMutation.mutate({ eleveId: rechargeDialog.id, montant: Number(montantRecharge) })}
                >
                  {rechargeMutation.isPending ? 'En cours…' : 'Confirmer la recharge'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog impression carte PVC */}
      <Dialog open={!!printCard} onOpenChange={() => setPrintCard(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Carte de transport scolaire</DialogTitle></DialogHeader>
          {printCard && (
            <div className="space-y-4">
              {/* PVC Card — 85.6mm x 54mm ratio = ~1.585 */}
              <div
                ref={cardRef}
                className="relative mx-auto overflow-hidden"
                style={{
                  width: 400,
                  height: 252,
                  borderRadius: 14,
                  fontFamily: "'Inter', 'Space Grotesk', sans-serif",
                  background: '#FFFFFF',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.13)',
                }}
              >
                {/* Background wave shape */}
                <svg
                  className="absolute bottom-0 left-0 w-full"
                  viewBox="0 0 400 90"
                  preserveAspectRatio="none"
                  style={{ height: 90 }}
                >
                  <path
                    d="M0,40 C80,0 160,70 240,35 C300,10 360,50 400,25 L400,90 L0,90 Z"
                    fill="#87CEEB"
                    opacity="0.35"
                  />
                  <path
                    d="M0,55 C60,30 140,75 220,50 C290,30 350,65 400,40 L400,90 L0,90 Z"
                    fill="#5BA3D9"
                    opacity="0.25"
                  />
                </svg>

                {/* Bus watermark */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-[0.06]">
                  <svg width="140" height="90" viewBox="0 0 140 90" fill="none">
                    <rect x="10" y="15" width="110" height="50" rx="8" fill="#F59E0B" />
                    <rect x="15" y="22" width="22" height="18" rx="3" fill="#FDE68A" />
                    <rect x="42" y="22" width="22" height="18" rx="3" fill="#FDE68A" />
                    <rect x="69" y="22" width="22" height="18" rx="3" fill="#FDE68A" />
                    <rect x="96" y="22" width="18" height="18" rx="3" fill="#FDE68A" />
                    <rect x="5" y="45" width="120" height="8" rx="2" fill="#D97706" />
                    <circle cx="35" cy="70" r="10" fill="#374151" />
                    <circle cx="35" cy="70" r="5" fill="#9CA3AF" />
                    <circle cx="95" cy="70" r="10" fill="#374151" />
                    <circle cx="95" cy="70" r="5" fill="#9CA3AF" />
                    <rect x="110" y="30" width="15" height="12" rx="2" fill="#EF4444" />
                    <text x="65" y="42" textAnchor="middle" fontSize="8" fill="#92400E" fontWeight="bold">SCHOOL BUS</text>
                  </svg>
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-4 pt-3 pb-1 relative z-10">
                  <div className="flex items-center gap-2">
                    {schoolConfig?.logo_url ? (
                      <img
                        src={schoolConfig.logo_url}
                        alt="Logo"
                        className="h-8 w-8 rounded-full object-cover"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bus className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className="leading-none">
                      <p style={{ fontSize: 7, color: '#6B7280', fontWeight: 500 }}>
                        {schoolConfig?.nom || 'École'}
                      </p>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-1 px-3 py-1 rounded-full"
                    style={{ background: '#FCD34D', fontSize: 8, fontWeight: 700, color: '#92400E' }}
                  >
                    <Bus style={{ width: 10, height: 10 }} />
                    TRANSPORT SCOLAIRE
                  </div>
                </div>

                {/* Body */}
                <div className="flex gap-3 px-4 pt-2 relative z-10" style={{ height: 140 }}>
                  {/* Photo */}
                  <div
                    className="flex-shrink-0 rounded-lg overflow-hidden bg-muted border"
                    style={{
                      width: 72,
                      height: 90,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                    }}
                  >
                    {printCard.photo_url ? (
                      <img
                        src={printCard.photo_url}
                        alt="Photo"
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground" style={{ fontSize: 10 }}>
                        Photo
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 flex flex-col justify-between py-0.5">
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 800, color: '#1F2937', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                        {printCard.prenom} {printCard.nom}
                      </p>
                      <div className="flex gap-3 mt-1.5">
                        <div>
                          <p style={{ fontSize: 7, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Matricule</p>
                          <p style={{ fontSize: 10, fontWeight: 600, color: '#374151', fontFamily: 'monospace' }}>{printCard.matricule || '—'}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 7, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Classe</p>
                          <p style={{ fontSize: 10, fontWeight: 600, color: '#374151' }}>{printCard.classes?.nom || '—'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Zone / Ligne */}
                    <div
                      className="flex items-center gap-1 rounded-md px-2 py-1 mt-1"
                      style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', width: 'fit-content' }}
                    >
                      <MapPin style={{ width: 10, height: 10, color: '#3B82F6' }} />
                      <span style={{ fontSize: 9, fontWeight: 600, color: '#1E40AF' }}>
                        LIGNE : {(printCard.zones_transport as any)?.nom || '—'}
                      </span>
                    </div>

                    {/* Validity */}
                    <div className="mt-1">
                      {printCard.recharge ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="rounded-full px-2 py-0.5"
                            style={{ background: '#D1FAE5', fontSize: 7, fontWeight: 600, color: '#065F46' }}
                          >
                            ● ACTIVE
                          </div>
                          <span style={{ fontSize: 8, color: '#6B7280' }}>
                            Expire le {new Date(printCard.recharge.date_expiration).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      ) : (
                        <div
                          className="rounded-full px-2 py-0.5"
                          style={{ background: '#FEE2E2', fontSize: 7, fontWeight: 700, color: '#991B1B', width: 'fit-content' }}
                        >
                          NON RECHARGÉE
                        </div>
                      )}
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="flex-shrink-0 flex flex-col items-center justify-center">
                    <div
                      className="bg-white rounded-lg p-1.5"
                      style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.1)', border: '2px solid #E5E7EB' }}
                    >
                      <QRCodeCanvas
                        value={JSON.stringify({ type: 'transport', matricule: printCard.matricule, id: printCard.id })}
                        size={70}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                    <p style={{ fontSize: 6, color: '#9CA3AF', marginTop: 3 }}>Scanner pour valider</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="absolute bottom-1.5 left-4 right-4 flex justify-between items-center z-10">
                  <p style={{ fontSize: 6, color: '#9CA3AF' }}>
                    {schoolConfig?.ville || 'Conakry, Guinée'} • Année scolaire 2025-2026
                  </p>
                  <p style={{ fontSize: 6, color: '#9CA3AF' }}>
                    Carte rechargeable • 30 jours
                  </p>
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
