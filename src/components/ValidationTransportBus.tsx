import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bus, CheckCircle, XCircle, ScanLine, Search, AlertTriangle, ArrowLeftRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import QRScannerDialog from '@/components/QRScannerDialog';

export default function ValidationTransportBus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualSearch, setManualSearch] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  // Validations du jour
  const { data: validations = [] } = useQuery({
    queryKey: ['validations-transport', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('validations_transport')
        .select('*, eleves(nom, prenom, matricule, classes(nom), zones_transport:zone_transport_id(nom))')
        .gte('validated_at', `${today}T00:00:00`)
        .lte('validated_at', `${today}T23:59:59`)
        .order('validated_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Élèves avec cartes expirées
  const { data: expiredCards = [] } = useQuery({
    queryKey: ['expired-transport-cards'],
    queryFn: async () => {
      // Récupérer tous les élèves transport
      const { data: eleves, error: eErr } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, classe_id, classes(nom), zones_transport:zone_transport_id(nom)')
        .not('zone_transport_id', 'is', null)
        .eq('statut', 'inscrit')
        .order('nom');
      if (eErr) throw eErr;

      // Récupérer la dernière recharge pour chaque élève
      const { data: recharges, error: rErr } = await supabase
        .from('recharges_transport')
        .select('eleve_id, date_recharge, date_expiration, actif')
        .order('date_expiration', { ascending: false });
      if (rErr) throw rErr;

      const now = new Date().toISOString();
      const result: any[] = [];

      for (const e of (eleves || [])) {
        const eleveRecharges = (recharges || []).filter((r: any) => r.eleve_id === e.id);
        const lastRecharge = eleveRecharges[0];
        const hasActive = eleveRecharges.some((r: any) => r.actif && r.date_expiration >= now);

        if (!hasActive) {
          result.push({
            ...e,
            derniere_recharge: lastRecharge?.date_recharge || null,
            date_expiration: lastRecharge?.date_expiration || null,
          });
        }
      }
      return result;
    },
  });

  const validateMutation = useMutation({
    mutationFn: async (eleveId: string) => {
      // Vérifier la recharge active
      const { data: recharges } = await supabase
        .from('recharges_transport')
        .select('*')
        .eq('eleve_id', eleveId)
        .eq('actif', true)
        .gte('date_expiration', new Date().toISOString())
        .order('date_expiration', { ascending: false })
        .limit(1);

      const recharge = (recharges as any[])?.[0];

      const { data: eleve } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, zone_transport_id')
        .eq('id', eleveId)
        .single();

      if (!eleve) throw new Error('Élève introuvable');

      // Vérifier combien de validations aujourd'hui (max 2 : aller + retour)
      const { data: existing } = await supabase
        .from('validations_transport')
        .select('id')
        .eq('eleve_id', eleveId)
        .gte('validated_at', `${today}T00:00:00`)
        .lte('validated_at', `${today}T23:59:59`);

      const count = (existing as any[])?.length || 0;

      if (count >= 2) {
        return { eleve, status: 'already', message: 'Aller-retour déjà validé' };
      }

      const trajet = count === 0 ? 'aller' : 'retour';
      const isValid = !!recharge;

      const { error } = await supabase.from('validations_transport').insert({
        eleve_id: eleveId,
        recharge_id: recharge?.id || null,
        zone_transport_id: eleve.zone_transport_id,
        valide: isValid,
        motif_rejet: isValid ? null : 'Carte expirée ou non rechargée',
      } as any);
      if (error) throw error;

      return {
        eleve,
        status: isValid ? 'valid' : 'invalid',
        trajet,
        message: isValid ? `${trajet === 'aller' ? '🚌 Aller' : '🏠 Retour'} — Accès autorisé` : 'Carte expirée — Accès refusé',
        recharge,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['validations-transport'] });
      if (result.status === 'valid') {
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          osc.frequency.value = 800;
          osc.connect(ctx.destination);
          osc.start();
          setTimeout(() => osc.stop(), 150);
        } catch {}
        toast({ title: `✅ ${result.trajet === 'aller' ? 'Aller' : 'Retour'} validé`, description: `${result.eleve.prenom} ${result.eleve.nom}` });
      } else if (result.status === 'already') {
        toast({ title: 'ℹ️ Limite atteinte', description: `${result.eleve.prenom} ${result.eleve.nom} — Aller-retour déjà validé` });
      } else {
        toast({ title: '❌ Carte expirée', description: `${result.eleve.prenom} ${result.eleve.nom} — Recharge requise`, variant: 'destructive' });
      }
    },
    onError: (err: any) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    },
  });

  const handleScan = (text: string) => {
    setScannerOpen(false);
    try {
      const data = JSON.parse(text);
      if (data.type === 'transport' && data.id) {
        validateMutation.mutate(data.id);
      } else {
        toast({ title: 'QR invalide', description: 'Ce QR code n\'est pas une carte transport', variant: 'destructive' });
      }
    } catch {
      handleManualValidation(text.trim());
    }
  };

  const handleManualValidation = async (matricule: string) => {
    if (!matricule) return;
    const { data: eleve } = await supabase
      .from('eleves')
      .select('id')
      .eq('matricule', matricule)
      .not('zone_transport_id', 'is', null)
      .single();

    if (eleve) {
      validateMutation.mutate(eleve.id);
    } else {
      toast({ title: 'Non trouvé', description: `Aucun élève transport avec le matricule "${matricule}"`, variant: 'destructive' });
    }
    setManualSearch('');
  };

  const validCount = validations.filter((v: any) => v.valide).length;
  const rejectCount = validations.filter((v: any) => !v.valide).length;

  // Count trajets
  const eleveTrajetMap = new Map<string, number>();
  validations.forEach((v: any) => {
    eleveTrajetMap.set(v.eleve_id, (eleveTrajetMap.get(v.eleve_id) || 0) + 1);
  });

  return (
    <div className="space-y-3">
      {/* Zone scan — optimisée mobile */}
      <Card className="border-primary/30">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              className="gap-2 text-base sm:text-lg w-full sm:w-auto py-6 sm:py-4"
              onClick={() => setScannerOpen(true)}
            >
              <ScanLine className="h-6 w-6" /> Scanner une carte
            </Button>
            <div className="flex gap-2 w-full">
              <Input
                placeholder="Saisir le matricule…"
                value={manualSearch}
                onChange={e => setManualSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManualValidation(manualSearch)}
                className="text-base"
              />
              <Button variant="outline" onClick={() => handleManualValidation(manualSearch)}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats du jour — responsive grid */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-3 sm:pt-6 sm:px-6 flex items-center gap-2 sm:gap-3">
            <Bus className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Passages</p>
              <p className="text-xl sm:text-2xl font-bold">{validations.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-3 sm:pt-6 sm:px-6 flex items-center gap-2 sm:gap-3">
            <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-accent shrink-0" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Validés</p>
              <p className="text-xl sm:text-2xl font-bold text-accent">{validCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-3 sm:pt-6 sm:px-6 flex items-center gap-2 sm:gap-3">
            <XCircle className="h-6 w-6 sm:h-8 sm:w-8 text-destructive shrink-0" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Refusés</p>
              <p className="text-xl sm:text-2xl font-bold text-destructive">{rejectCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Historique + Cartes expirées */}
      <Tabs defaultValue="historique">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="historique" className="gap-1 text-xs sm:text-sm">
            <ArrowLeftRight className="h-3.5 w-3.5" /> Historique
          </TabsTrigger>
          <TabsTrigger value="expires" className="gap-1 text-xs sm:text-sm">
            <AlertTriangle className="h-3.5 w-3.5" /> Expirées ({expiredCards.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="historique" className="mt-2">
          <Card>
            <CardHeader className="pb-2 px-3 sm:px-6">
              <CardTitle className="text-sm sm:text-base">
                {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isMobile ? (
                // Vue mobile : cartes empilées
                <div className="divide-y">
                  {validations.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground text-sm">Aucun passage</p>
                  ) : validations.map((v: any) => {
                    const trajetCount = validations.filter((x: any) => x.eleve_id === v.eleve_id && new Date(x.validated_at) <= new Date(v.validated_at)).length;
                    const trajetLabel = trajetCount <= 1 ? 'Aller' : 'Retour';
                    return (
                      <div key={v.id} className="px-3 py-2.5 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{v.eleves?.prenom} {v.eleves?.nom}</p>
                          <p className="text-xs text-muted-foreground">
                            {v.eleves?.classes?.nom || '—'} • {(v.eleves?.zones_transport as any)?.nom || '—'}
                          </p>
                        </div>
                        <div className="text-right shrink-0 space-y-0.5">
                          <Badge variant={v.valide ? 'default' : 'destructive'} className="text-xs">
                            {v.valide ? `✅ ${trajetLabel}` : '❌'}
                          </Badge>
                          <p className="text-xs text-muted-foreground font-mono">
                            {new Date(v.validated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Vue desktop : tableau
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Heure</TableHead>
                      <TableHead>Élève</TableHead>
                      <TableHead>Classe</TableHead>
                      <TableHead>Zone</TableHead>
                      <TableHead className="text-center">Trajet</TableHead>
                      <TableHead className="text-center">Statut</TableHead>
                      <TableHead>Motif</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validations.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun passage enregistré</TableCell></TableRow>
                    ) : validations.map((v: any) => {
                      const trajetCount = validations.filter((x: any) => x.eleve_id === v.eleve_id && new Date(x.validated_at) <= new Date(v.validated_at)).length;
                      const trajetLabel = trajetCount <= 1 ? '🚌 Aller' : '🏠 Retour';
                      return (
                        <TableRow key={v.id}>
                          <TableCell className="font-mono text-xs">
                            {new Date(v.validated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                          <TableCell className="font-medium">{v.eleves?.prenom} {v.eleves?.nom}</TableCell>
                          <TableCell>{v.eleves?.classes?.nom || '—'}</TableCell>
                          <TableCell>{(v.eleves?.zones_transport as any)?.nom || '—'}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-xs">{trajetLabel}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={v.valide ? 'default' : 'destructive'}>
                              {v.valide ? '✅ Validé' : '❌ Refusé'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{v.motif_rejet || '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expires" className="mt-2">
          <Card>
            <CardHeader className="pb-2 px-3 sm:px-6">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Élèves avec carte expirée ({expiredCards.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isMobile ? (
                <div className="divide-y">
                  {expiredCards.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground text-sm">Toutes les cartes sont valides</p>
                  ) : expiredCards.map((e: any) => (
                    <div key={e.id} className="px-3 py-2.5">
                      <p className="font-medium text-sm">{e.prenom} {e.nom}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.classes?.nom || '—'} • {(e.zones_transport as any)?.nom || '—'}
                      </p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="destructive" className="text-xs">
                          {e.date_expiration
                            ? `Exp. ${new Date(e.date_expiration).toLocaleDateString('fr-FR')}`
                            : 'Jamais rechargée'}
                        </Badge>
                        {e.derniere_recharge && (
                          <span className="text-xs text-muted-foreground">
                            Dern. recharge : {new Date(e.derniere_recharge).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matricule</TableHead>
                      <TableHead>Élève</TableHead>
                      <TableHead>Classe</TableHead>
                      <TableHead>Zone</TableHead>
                      <TableHead>Dernière recharge</TableHead>
                      <TableHead>Date expiration</TableHead>
                      <TableHead className="text-center">Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiredCards.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Toutes les cartes sont valides ✅</TableCell></TableRow>
                    ) : expiredCards.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-xs">{e.matricule || '—'}</TableCell>
                        <TableCell className="font-medium">{e.prenom} {e.nom}</TableCell>
                        <TableCell>{e.classes?.nom || '—'}</TableCell>
                        <TableCell>{(e.zones_transport as any)?.nom || '—'}</TableCell>
                        <TableCell className="text-sm">
                          {e.derniere_recharge
                            ? new Date(e.derniere_recharge).toLocaleDateString('fr-FR')
                            : <span className="text-muted-foreground">Jamais</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {e.date_expiration
                            ? new Date(e.date_expiration).toLocaleDateString('fr-FR')
                            : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="destructive">Expirée</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <QRScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onScan={handleScan} title="Scanner carte transport" />
    </div>
  );
}
