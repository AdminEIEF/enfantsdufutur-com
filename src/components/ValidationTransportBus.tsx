import { useState, useCallback } from 'react';
import { useBarcodeScanner, extractMatriculeFromScan } from '@/hooks/useBarcodeScanner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bus, CheckCircle, XCircle, ScanLine, Search, AlertTriangle, ArrowLeftRight, WifiOff, Wifi, Download, RefreshCw, CloudOff, Smartphone, Info, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOfflineTransport } from '@/hooks/useOfflineTransport';
import QRScannerDialog from '@/components/QRScannerDialog';
import scannerIllustration from '@/assets/scanner-illustration.png';

export default function ValidationTransportBus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualSearch, setManualSearch] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  const {
    isOnline, cachedCount, lastSync, pendingCount,
    isSyncing, isCaching, downloadEleves, validateOffline, syncPendingScans,
  } = useOfflineTransport();

  const today = new Date().toISOString().slice(0, 10);

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
    enabled: isOnline,
  });

  const { data: expiredCards = [] } = useQuery({
    queryKey: ['expired-transport-cards'],
    queryFn: async () => {
      const { data: eleves, error: eErr } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, classe_id, classes(nom), zones_transport:zone_transport_id(nom)')
        .not('zone_transport_id', 'is', null)
        .eq('statut', 'inscrit')
        .order('nom');
      if (eErr) throw eErr;
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
          result.push({ ...e, derniere_recharge: lastRecharge?.date_recharge || null, date_expiration: lastRecharge?.date_expiration || null });
        }
      }
      return result;
    },
    enabled: isOnline,
  });

  const validateMutation = useMutation({
    mutationFn: async (eleveId: string) => {
      const { data: recharges } = await supabase
        .from('recharges_transport').select('*').eq('eleve_id', eleveId)
        .eq('actif', true).gte('date_expiration', new Date().toISOString())
        .order('date_expiration', { ascending: false }).limit(1);
      const recharge = (recharges as any[])?.[0];
      const { data: eleve } = await supabase
        .from('eleves').select('id, nom, prenom, matricule, zone_transport_id, famille_id').eq('id', eleveId).single();
      if (!eleve) throw new Error('Élève introuvable');
      const { data: existing } = await supabase
        .from('validations_transport').select('id, valide').eq('eleve_id', eleveId)
        .gte('validated_at', `${today}T00:00:00`).lte('validated_at', `${today}T23:59:59`);
      const count = (existing as any[])?.length || 0;
      const isValid = !!recharge;

      // Si pas de recharge et déjà scanné une fois → refuser et notifier
      if (!isValid && count >= 1) {
        // Envoyer notification élève
        await supabase.from('student_notifications').insert({
          eleve_id: eleveId,
          titre: '🚌 Carte transport non rechargée',
          message: 'Votre carte de transport n\'est pas rechargée. Veuillez demander à vos parents de la recharger pour continuer à utiliser le bus.',
          type: 'alerte',
        } as any);
        // Envoyer notification parent
        if (eleve.famille_id) {
          await supabase.from('parent_notifications').insert({
            famille_id: eleve.famille_id,
            titre: '🚌 Carte transport à recharger',
            message: `La carte transport de ${eleve.prenom} ${eleve.nom} n'est pas rechargée. Veuillez effectuer la recharge pour qu'il/elle puisse continuer à prendre le bus.`,
            type: 'alerte',
          } as any);
        }
        return { eleve, status: 'blocked_no_recharge', message: 'Carte non rechargée — Recharge requise' };
      }

      if (count >= 2) return { eleve, status: 'already', message: 'Aller-retour déjà validé' };
      const trajet = count === 0 ? 'aller' : 'retour';
      const { error } = await supabase.from('validations_transport').insert({
        eleve_id: eleveId, recharge_id: recharge?.id || null, zone_transport_id: eleve.zone_transport_id,
        valide: isValid, motif_rejet: isValid ? null : 'Carte non rechargée (1er passage autorisé)',
      } as any);
      if (error) throw error;

      // Notification parent : montée/descente
      const trajetType = count === 0 ? 'monté dans' : 'descendu du';
      const heureNow = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      if (eleve.famille_id) {
        await supabase.from('parent_notifications').insert({
          famille_id: eleve.famille_id,
          titre: count === 0 ? '🚌 Votre enfant est monté dans le bus' : '🏠 Votre enfant est descendu du bus',
          message: `Votre enfant ${eleve.prenom} ${eleve.nom} est bien ${trajetType} le bus à ${heureNow}.`,
          type: 'info',
        } as any);
      }

      return { eleve, status: isValid ? 'valid' : 'first_free', trajet, message: isValid ? `${trajet === 'aller' ? '🚌 Aller' : '🏠 Retour'} — Accès autorisé` : '⚠️ 1er passage autorisé — Recharge requise', recharge };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['validations-transport'] });
      if (result.status === 'valid') { playBeep(800); toast({ title: `✅ ${result.trajet === 'aller' ? 'Aller' : 'Retour'} validé`, description: `${result.eleve.prenom} ${result.eleve.nom}` }); }
      else if (result.status === 'first_free') { playBeep(800); toast({ title: '⚠️ 1er passage autorisé', description: `${result.eleve.prenom} ${result.eleve.nom} — Carte non rechargée, recharge requise` }); }
      else if (result.status === 'already') { toast({ title: 'ℹ️ Limite atteinte', description: `${result.eleve.prenom} ${result.eleve.nom} — Aller-retour déjà validé` }); }
      else if (result.status === 'blocked_no_recharge') { playBeep(300); toast({ title: '❌ Accès refusé', description: `${result.eleve.prenom} ${result.eleve.nom} — Carte non rechargée, notification envoyée`, variant: 'destructive' }); }
      else { playBeep(300); toast({ title: '❌ Carte expirée', description: `${result.eleve.prenom} ${result.eleve.nom} — Recharge requise`, variant: 'destructive' }); }
    },
    onError: (err: any) => { toast({ title: 'Erreur', description: err.message, variant: 'destructive' }); },
  });

  function playBeep(freq: number) {
    try { const ctx = new AudioContext(); const osc = ctx.createOscillator(); osc.frequency.value = freq; osc.connect(ctx.destination); osc.start(); setTimeout(() => osc.stop(), 150); } catch {}
  }

  const lookupAndValidate = useCallback(async (matricule: string) => {
    if (!matricule) return;
    if (!navigator.onLine) {
      const result = await validateOffline(matricule);
      if (result.status === 'valid') { playBeep(800); if (navigator.vibrate) navigator.vibrate(150); toast({ title: '✅ Validé (hors ligne)', description: result.message }); }
      else if (result.status === 'invalid') { playBeep(300); toast({ title: '❌ Carte expirée', description: result.message, variant: 'destructive' }); }
      else if (result.status === 'already') { toast({ title: 'ℹ️ Limite atteinte', description: result.message }); }
      else { toast({ title: 'Non trouvé', description: result.message, variant: 'destructive' }); }
      return;
    }
    const { data: eleve } = await supabase.from('eleves').select('id').eq('matricule', matricule).not('zone_transport_id', 'is', null).single();
    if (eleve) { validateMutation.mutate(eleve.id); }
    else { toast({ title: 'Non trouvé', description: `Aucun élève transport avec le matricule "${matricule}"`, variant: 'destructive' }); }
  }, [validateMutation, toast, validateOffline]);

  const handleScan = useCallback((text: string) => {
    const matricule = extractMatriculeFromScan(text) || text.trim();
    if (!matricule) { toast({ title: 'QR invalide', description: 'Aucun matricule détecté', variant: 'destructive' }); return; }
    lookupAndValidate(matricule);
  }, [toast, lookupAndValidate]);

  useBarcodeScanner({ onScan: handleScan });

  const handleManualValidation = async (matricule: string) => {
    if (!matricule) return;
    await lookupAndValidate(matricule);
    setManualSearch('');
  };

  const validCount = validations.filter((v: any) => v.valide).length;
  const rejectCount = validations.filter((v: any) => !v.valide).length;

  // Compteur montées vs descentes
  const monteeCount = useMemo(() => {
    const seen = new Set<string>();
    let count = 0;
    for (const v of [...validations].sort((a: any, b: any) => new Date(a.validated_at).getTime() - new Date(b.validated_at).getTime())) {
      if (!seen.has(v.eleve_id)) { seen.add(v.eleve_id); count++; }
    }
    return count;
  }, [validations]);

  const descenteCount = useMemo(() => {
    const seen = new Set<string>();
    let count = 0;
    const sorted = [...validations].sort((a: any, b: any) => new Date(a.validated_at).getTime() - new Date(b.validated_at).getTime());
    for (const v of sorted) {
      if (seen.has(v.eleve_id)) { count++; }
      else { seen.add(v.eleve_id); }
    }
    return count;
  }, [validations]);

  return (
    <div className="space-y-4">
      {/* Connection Status - Glass pill */}
      <div className={`flex items-center justify-between flex-wrap gap-2 px-4 py-2.5 rounded-2xl backdrop-blur-xl border ${isOnline ? 'bg-accent/5 border-accent/20' : 'bg-orange-500/5 border-orange-400/20'}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`h-2 w-2 rounded-full animate-pulse ${isOnline ? 'bg-emerald-500' : 'bg-orange-500'}`} />
          <span className="text-xs font-semibold">{isOnline ? 'En ligne' : 'Hors ligne'}</span>
          {cachedCount > 0 && <Badge variant="outline" className="text-[10px] rounded-full h-5">{cachedCount} en cache</Badge>}
          {pendingCount > 0 && <Badge className="text-[10px] rounded-full h-5 bg-orange-500/10 text-orange-600 border-orange-200">{pendingCount} en attente</Badge>}
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" className="h-7 text-xs rounded-full gap-1 px-3" onClick={downloadEleves} disabled={isCaching || !isOnline}>
            <Download className="h-3 w-3" />{isCaching ? '…' : 'Cache'}
          </Button>
          {pendingCount > 0 && isOnline && (
            <Button size="sm" variant="ghost" className="h-7 text-xs rounded-full gap-1 px-3" onClick={syncPendingScans} disabled={isSyncing}>
              <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />Sync
            </Button>
          )}
        </div>
      </div>

      {/* Scanner Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/90 via-primary to-primary/80 p-5 text-primary-foreground">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-8 translate-x-8" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
        
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
              <ScanLine className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Scanner une carte</h3>
              <p className="text-xs opacity-80">QR Code ou douchette</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="lg"
              className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur border-white/20 text-white rounded-2xl h-14 text-base font-semibold gap-2"
              onClick={() => setScannerOpen(true)}
            >
              <Smartphone className="h-5 w-5" /> Caméra / QR
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 rounded-2xl border-white/30 text-white hover:bg-white/10 px-4"
              onClick={() => setShowGuide(!showGuide)}
            >
              <Info className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Saisir le matricule…"
              value={manualSearch}
              onChange={e => setManualSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualValidation(manualSearch)}
              className="bg-white/15 border-white/20 text-white placeholder:text-white/50 rounded-xl h-11"
            />
            <Button className="bg-white/20 hover:bg-white/30 rounded-xl h-11 px-4" onClick={() => handleManualValidation(manualSearch)}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Scanner Guide - Illustration */}
      {showGuide && (
        <div className="rounded-3xl border bg-card/80 backdrop-blur-sm p-5 space-y-4 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <ScanLine className="h-5 w-5 text-primary" />
            <h4 className="font-bold text-base">Comment scanner les cartes ?</h4>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <img
              src={scannerIllustration}
              alt="Illustration douchette scanner"
              className="w-36 h-36 object-contain rounded-2xl"
              loading="lazy"
              width={512}
              height={512}
            />
            <div className="space-y-3 flex-1">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-primary/5 border border-primary/10">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">1</div>
                <div>
                  <p className="text-sm font-semibold">Avec la douchette (recommandé)</p>
                  <p className="text-xs text-muted-foreground">Pointez la douchette vers le QR Code de la carte. Le matricule est lu automatiquement.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-accent/5 border border-accent/10">
                <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-sm shrink-0">2</div>
                <div>
                  <p className="text-sm font-semibold">Avec la caméra du téléphone</p>
                  <p className="text-xs text-muted-foreground">Appuyez sur "Caméra / QR" et pointez vers la carte de l'élève.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-secondary/5 border border-secondary/10">
                <div className="h-8 w-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-bold text-sm shrink-0">3</div>
                <div>
                  <p className="text-sm font-semibold">Saisie manuelle</p>
                  <p className="text-xs text-muted-foreground">Entrez le matricule dans le champ et validez avec Entrée.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards - Glass */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Bus, label: 'Passages', value: validations.length, color: 'text-primary', bg: 'from-primary/10 to-primary/5' },
          { icon: CheckCircle, label: 'Validés', value: validCount, color: 'text-emerald-600', bg: 'from-emerald-500/10 to-emerald-500/5' },
          { icon: XCircle, label: 'Refusés', value: rejectCount, color: 'text-destructive', bg: 'from-destructive/10 to-destructive/5' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className={`rounded-2xl bg-gradient-to-br ${bg} border p-3.5 flex items-center gap-2.5`}>
            <div className={`h-10 w-10 rounded-xl bg-card/80 flex items-center justify-center ${color} shrink-0`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="historique">
        <TabsList className="w-full grid grid-cols-2 rounded-2xl h-11 bg-muted/50 p-1">
          <TabsTrigger value="historique" className="rounded-xl gap-1.5 text-xs sm:text-sm data-[state=active]:shadow-sm">
            <ArrowLeftRight className="h-3.5 w-3.5" /> Historique
          </TabsTrigger>
          <TabsTrigger value="expires" className="rounded-xl gap-1.5 text-xs sm:text-sm data-[state=active]:shadow-sm">
            <AlertTriangle className="h-3.5 w-3.5" /> Expirées ({expiredCards.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="historique" className="mt-3">
          <div className="rounded-2xl border bg-card/80 backdrop-blur-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <p className="text-sm font-semibold">
                {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                {!isOnline && <span className="text-xs text-orange-500 ml-2">(hors ligne)</span>}
              </p>
            </div>
            <div className="divide-y max-h-[400px] overflow-y-auto">
              {validations.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground text-sm">{isOnline ? 'Aucun passage aujourd\'hui' : 'Données visibles en ligne'}</p>
              ) : validations.map((v: any) => {
                const trajetCount = validations.filter((x: any) => x.eleve_id === v.eleve_id && new Date(x.validated_at) <= new Date(v.validated_at)).length;
                const trajetLabel = trajetCount <= 1 ? 'Aller' : 'Retour';
                return (
                  <div key={v.id} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${v.valide ? 'bg-emerald-500/10' : 'bg-destructive/10'}`}>
                      {v.valide ? <CheckCircle className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-destructive" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{v.eleves?.prenom} {v.eleves?.nom}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {v.eleves?.classes?.nom || '—'} • {(v.eleves?.zones_transport as any)?.nom || '—'}
                      </p>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <Badge variant={v.valide ? 'default' : 'destructive'} className="text-[10px] rounded-full">
                        {v.valide ? `✅ ${trajetLabel}` : '❌ Refusé'}
                      </Badge>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {new Date(v.validated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="expires" className="mt-3">
          <div className="rounded-2xl border bg-card/80 backdrop-blur-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-destructive/5">
              <p className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Cartes expirées ou non rechargées ({expiredCards.length})
              </p>
            </div>
            <div className="divide-y max-h-[400px] overflow-y-auto">
              {expiredCards.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground text-sm">Toutes les cartes sont valides ✅</p>
              ) : expiredCards.map((e: any) => (
                <div key={e.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{e.prenom} {e.nom}</p>
                    <p className="text-[11px] text-muted-foreground">{e.classes?.nom || '—'} • {(e.zones_transport as any)?.nom || '—'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="destructive" className="text-[10px] rounded-full">
                      {e.date_expiration ? `Exp. ${new Date(e.date_expiration).toLocaleDateString('fr-FR')}` : 'Jamais rechargée'}
                    </Badge>
                    {e.matricule && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{e.matricule}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <QRScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onScan={handleScan} title="Scanner carte transport" />
    </div>
  );
}
