import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bus, Users, AlertTriangle, CheckCircle, MapPin, ScanLine, Clock, FileWarning, Truck, Phone, Shield, XCircle, ArrowRight, User, Calendar, Hash, Timer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useBarcodeScanner, extractMatriculeFromScan } from '@/hooks/useBarcodeScanner';
import { useOfflineTransport } from '@/hooks/useOfflineTransport';
import QRScannerDialog from '@/components/QRScannerDialog';
import { Skeleton } from '@/components/ui/skeleton';

function getDaysRemaining(dateExpiration: string) {
  const diff = new Date(dateExpiration).getTime() - new Date().getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function CardValidityBig({ recharge }: { recharge: any }) {
  if (!recharge) {
    return (
      <div className="flex flex-col items-center gap-2 p-6 rounded-3xl bg-destructive/10 border-2 border-destructive/30">
        <XCircle className="h-16 w-16 text-destructive" />
        <p className="text-2xl font-black text-destructive">CARTE EXPIRÉE</p>
        <p className="text-sm text-destructive/70">Recharge nécessaire</p>
      </div>
    );
  }
  const jours = getDaysRemaining(recharge.date_expiration);
  if (jours <= 0) {
    return (
      <div className="flex flex-col items-center gap-2 p-6 rounded-3xl bg-destructive/10 border-2 border-destructive/30">
        <XCircle className="h-16 w-16 text-destructive" />
        <p className="text-2xl font-black text-destructive">CARTE EXPIRÉE</p>
        <p className="text-sm text-destructive/70">Expirée depuis le {new Date(recharge.date_expiration).toLocaleDateString('fr-FR')}</p>
      </div>
    );
  }
  if (jours <= 5) {
    return (
      <div className="flex flex-col items-center gap-2 p-6 rounded-3xl bg-orange-500/10 border-2 border-orange-500/30">
        <AlertTriangle className="h-16 w-16 text-orange-500 animate-pulse" />
        <p className="text-2xl font-black text-orange-600">EXPIRE BIENTÔT</p>
        <p className="text-lg font-bold text-orange-500">{jours} jour(s) restant(s)</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 p-6 rounded-3xl bg-emerald-500/10 border-2 border-emerald-500/30">
      <CheckCircle className="h-16 w-16 text-emerald-500" />
      <p className="text-2xl font-black text-emerald-600">CARTE VALIDE</p>
      <p className="text-lg font-bold text-emerald-500">{jours} jour(s) restant(s)</p>
      <p className="text-xs text-muted-foreground">Expire le {new Date(recharge.date_expiration).toLocaleDateString('fr-FR')}</p>
    </div>
  );
}

function PassagerCard({ v, eleve, recharge }: { v: any; eleve: any; recharge: any }) {
  const jours = recharge ? getDaysRemaining(recharge.date_expiration) : 0;
  const isValid = recharge && jours > 0;
  const trajetCount = v._trajetCount || 1;
  const trajetLabel = trajetCount <= 1 ? 'Aller' : 'Retour';

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border hover:shadow-md transition-shadow">
      {/* Photo */}
      <div className="relative shrink-0">
        {eleve?.photo_url || eleve?.photo_thumbnail_url ? (
          <img src={eleve.photo_thumbnail_url || eleve.photo_url} alt="" className="w-12 h-12 rounded-xl object-cover border-2 border-background" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
            <User className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background ${isValid ? 'bg-emerald-500' : 'bg-destructive'}`} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{eleve?.prenom} {eleve?.nom}</p>
        <p className="text-[11px] text-muted-foreground">{eleve?.classes?.nom || '—'} • {eleve?.matricule || '—'}</p>
      </div>

      {/* Status */}
      <div className="text-right shrink-0 space-y-1">
        <Badge variant={v.valide ? 'default' : 'destructive'} className="text-[10px] rounded-full">
          {v.valide ? `✅ ${trajetLabel}` : '❌ Refusé'}
        </Badge>
        {isValid ? (
          <p className={`text-[10px] font-bold ${jours <= 5 ? 'text-orange-500' : jours <= 10 ? 'text-amber-500' : 'text-emerald-600'}`}>
            <Timer className="h-3 w-3 inline mr-0.5" />{jours}j restants
          </p>
        ) : (
          <p className="text-[10px] font-bold text-destructive">Expirée</p>
        )}
        <p className="text-[10px] text-muted-foreground font-mono">
          {new Date(v.validated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

export default function ChauffeurDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showIncident, setShowIncident] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<any>(null);
  const [incidentForm, setIncidentForm] = useState({
    type_incident: 'retard', description: '', gravite: 'moyenne', lieu: '',
  });

  const { isOnline, validateOffline } = useOfflineTransport();

  // Validations du jour avec détails élèves
  const { data: validations = [] } = useQuery({
    queryKey: ['chauffeur-validations-full', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('validations_transport')
        .select('*, eleves(id, nom, prenom, matricule, photo_url, photo_thumbnail_url, classe_id, classes(nom), zones_transport:zone_transport_id(nom))')
        .gte('validated_at', `${today}T00:00:00`)
        .lte('validated_at', `${today}T23:59:59`)
        .order('validated_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Recharges actives pour afficher jours restants
  const { data: recharges = [] } = useQuery({
    queryKey: ['chauffeur-recharges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recharges_transport')
        .select('*')
        .order('date_expiration', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Véhicules
  const { data: vehicules = [] } = useQuery({
    queryKey: ['chauffeur-vehicules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicules_transport')
        .select('*, zones_transport:zone_transport_id(nom)')
        .eq('actif', true);
      if (error) throw error;
      return data as any[];
    },
  });

  // Incidents
  const { data: incidents = [] } = useQuery({
    queryKey: ['chauffeur-incidents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incidents_transport')
        .select('*, routes_transport:route_id(nom)')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as any[];
    },
  });

  const getActiveRecharge = (eleveId: string) => {
    return recharges.find(
      (r: any) => r.eleve_id === eleveId && r.actif && new Date(r.date_expiration) > new Date()
    ) || recharges.find((r: any) => r.eleve_id === eleveId);
  };

  const validCount = validations.filter((v: any) => v.valide).length;
  const rejectCount = validations.filter((v: any) => !v.valide).length;
  const uniqueEleves = new Set(validations.map((v: any) => v.eleve_id)).size;

  // ─── Scan logic ───
  function playBeep(freq: number) {
    try { const ctx = new AudioContext(); const osc = ctx.createOscillator(); osc.frequency.value = freq; osc.connect(ctx.destination); osc.start(); setTimeout(() => osc.stop(), 150); } catch {}
  }

  const handleScanValidation = useCallback(async (matricule: string) => {
    if (!matricule) return;

    // Lookup élève
    const { data: eleve } = await supabase.from('eleves')
      .select('id, nom, prenom, matricule, photo_url, photo_thumbnail_url, zone_transport_id, classe_id, classes(nom)')
      .eq('matricule', matricule).not('zone_transport_id', 'is', null).single();

    if (!eleve) {
      playBeep(300);
      setLastScanResult({ status: 'not_found', matricule });
      toast({ title: 'Non trouvé', description: `Aucun élève transport avec "${matricule}"`, variant: 'destructive' });
      return;
    }

    // Check recharge
    const { data: activeRecharges } = await supabase.from('recharges_transport')
      .select('*').eq('eleve_id', eleve.id).eq('actif', true)
      .gte('date_expiration', new Date().toISOString())
      .order('date_expiration', { ascending: false }).limit(1);
    const recharge = (activeRecharges as any[])?.[0];

    // Check existing validations today
    const { data: existing } = await supabase.from('validations_transport')
      .select('id').eq('eleve_id', eleve.id)
      .gte('validated_at', `${today}T00:00:00`).lte('validated_at', `${today}T23:59:59`);
    const count = (existing as any[])?.length || 0;

    if (count >= 2) {
      setLastScanResult({ status: 'already', eleve, recharge });
      toast({ title: 'ℹ️ Limite atteinte', description: `${eleve.prenom} ${eleve.nom} — Aller-retour déjà validé` });
      return;
    }

    const trajet = count === 0 ? 'aller' : 'retour';
    const isValid = !!recharge;

    await supabase.from('validations_transport').insert({
      eleve_id: eleve.id, recharge_id: recharge?.id || null, zone_transport_id: eleve.zone_transport_id,
      valide: isValid, motif_rejet: isValid ? null : 'Carte expirée ou non rechargée',
    } as any);

    if (isValid) {
      playBeep(800);
      if (navigator.vibrate) navigator.vibrate(150);
    } else {
      playBeep(300);
    }

    // Get full recharge info for display
    const { data: allRecharges } = await supabase.from('recharges_transport')
      .select('*').eq('eleve_id', eleve.id).order('date_expiration', { ascending: false }).limit(1);

    setLastScanResult({ status: isValid ? 'valid' : 'invalid', eleve, recharge: recharge || (allRecharges as any[])?.[0], trajet });
    queryClient.invalidateQueries({ queryKey: ['chauffeur-validations-full'] });

    toast({
      title: isValid ? `✅ ${trajet === 'aller' ? 'Aller' : 'Retour'} validé` : '❌ Carte expirée',
      description: `${eleve.prenom} ${eleve.nom}`,
      variant: isValid ? undefined : 'destructive',
    });

    // Auto-return to dashboard after 4s
    setTimeout(() => {
      setLastScanResult(null);
    }, 5000);
  }, [today, toast, queryClient]);

  const handleScan = useCallback((text: string) => {
    const matricule = extractMatriculeFromScan(text) || text.trim();
    if (!matricule) return;
    handleScanValidation(matricule);
  }, [handleScanValidation]);

  useBarcodeScanner({ onScan: handleScan });

  // Incident mutation
  const handleIncident = async () => {
    if (!incidentForm.description.trim()) { toast({ title: 'Erreur', description: 'Description requise', variant: 'destructive' }); return; }
    const { error } = await supabase.from('incidents_transport').insert({
      type_incident: incidentForm.type_incident, description: incidentForm.description,
      gravite: incidentForm.gravite, lieu: incidentForm.lieu || null, date_incident: today,
    } as any);
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    await supabase.from('notifications').insert({
      destinataire_type: 'staff', titre: `🚨 Incident transport — ${incidentForm.type_incident}`,
      message: `${incidentForm.description.slice(0, 200)} | Gravité: ${incidentForm.gravite}`, type: 'alerte',
    } as any);
    queryClient.invalidateQueries({ queryKey: ['chauffeur-incidents'] });
    toast({ title: '✅ Incident signalé' });
    setShowIncident(false);
    setIncidentForm({ type_incident: 'retard', description: '', gravite: 'moyenne', lieu: '' });
  };

  // Compute trajet count per validation
  const validationsWithTrajet = useMemo(() => {
    return validations.map((v: any) => {
      const count = validations.filter((x: any) => x.eleve_id === v.eleve_id && new Date(x.validated_at) <= new Date(v.validated_at)).length;
      return { ...v, _trajetCount: count };
    });
  }, [validations]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Bus className="h-6 w-6 text-primary" /> Chauffeur
        </h1>
        <Button variant="destructive" size="sm" onClick={() => setShowIncident(true)}>
          <FileWarning className="h-4 w-4 mr-1" /> Incident
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Users, label: 'Passagers', value: uniqueEleves, color: 'text-primary', bg: 'from-primary/10 to-primary/5' },
          { icon: CheckCircle, label: 'Validés', value: validCount, color: 'text-emerald-600', bg: 'from-emerald-500/10 to-emerald-500/5' },
          { icon: XCircle, label: 'Refusés', value: rejectCount, color: 'text-destructive', bg: 'from-destructive/10 to-destructive/5' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className={`rounded-2xl bg-gradient-to-br ${bg} border p-3 flex items-center gap-2`}>
            <div className={`h-9 w-9 rounded-xl bg-card/80 flex items-center justify-center ${color} shrink-0`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-3 rounded-2xl h-11 bg-muted/50 p-1">
          <TabsTrigger value="dashboard" className="rounded-xl text-xs gap-1.5 data-[state=active]:shadow-sm">
            <Bus className="h-3.5 w-3.5" /> Passagers
          </TabsTrigger>
          <TabsTrigger value="scan" className="rounded-xl text-xs gap-1.5 data-[state=active]:shadow-sm">
            <ScanLine className="h-3.5 w-3.5" /> Scan Bus
          </TabsTrigger>
          <TabsTrigger value="vehicule" className="rounded-xl text-xs gap-1.5 data-[state=active]:shadow-sm">
            <Truck className="h-3.5 w-3.5" /> Véhicule
          </TabsTrigger>
        </TabsList>

        {/* ─── DASHBOARD: Liste passagers scannés ─── */}
        <TabsContent value="dashboard" className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <Badge variant="outline" className="text-xs">{validationsWithTrajet.length} passages</Badge>
          </div>

          {validationsWithTrajet.length === 0 ? (
            <Card className="border-dashed border-2 border-muted">
              <CardContent className="flex flex-col items-center py-12 gap-3">
                <div className="p-4 rounded-full bg-muted">
                  <Bus className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm text-center">
                  Aucun passager scanné aujourd'hui
                </p>
                <Button variant="default" className="rounded-xl gap-2" onClick={() => setActiveTab('scan')}>
                  <ScanLine className="h-4 w-4" /> Scanner un badge
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {validationsWithTrajet.map((v: any) => (
                <PassagerCard
                  key={v.id}
                  v={v}
                  eleve={v.eleves}
                  recharge={getActiveRecharge(v.eleve_id)}
                />
              ))}
            </div>
          )}

          {/* Incidents récents (compact) */}
          {incidents.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Incidents récents
              </p>
              {incidents.slice(0, 3).map((inc: any) => (
                <div key={inc.id} className="flex items-center gap-2 p-2 rounded-xl bg-muted/50 text-sm">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${inc.gravite === 'critique' ? 'bg-destructive' : inc.gravite === 'grave' ? 'bg-orange-500' : 'bg-yellow-400'}`} />
                  <span className="truncate flex-1">{inc.description}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{new Date(inc.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── SCAN BUS: uniquement scanner ─── */}
        <TabsContent value="scan" className="mt-3 space-y-4">
          {/* Scan result display */}
          {lastScanResult ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Élève info hero */}
              {lastScanResult.eleve && (
                <Card className="overflow-hidden border-0 shadow-xl">
                  <div className={`h-20 relative ${lastScanResult.status === 'valid' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : lastScanResult.status === 'invalid' ? 'bg-gradient-to-r from-destructive to-destructive/80' : 'bg-gradient-to-r from-primary to-primary/80'}`}>
                    <div className="absolute inset-0 bg-white/5" />
                  </div>
                  <CardContent className="relative pt-0 pb-4 px-4">
                    <div className="flex items-end gap-3 -mt-8">
                      <div className="relative z-10">
                        {lastScanResult.eleve.photo_thumbnail_url || lastScanResult.eleve.photo_url ? (
                          <img src={lastScanResult.eleve.photo_thumbnail_url || lastScanResult.eleve.photo_url} alt="" className="w-16 h-16 rounded-2xl object-cover border-4 border-background shadow-lg" />
                        ) : (
                          <div className="w-16 h-16 rounded-2xl bg-muted border-4 border-background shadow-lg flex items-center justify-center">
                            <User className="h-7 w-7 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 pb-1">
                        <h3 className="text-lg font-bold">{lastScanResult.eleve.prenom} {lastScanResult.eleve.nom}</h3>
                        <div className="flex gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px]"><Hash className="h-2.5 w-2.5 mr-0.5" />{lastScanResult.eleve.matricule}</Badge>
                          <Badge variant="outline" className="text-[10px] bg-primary/5">{lastScanResult.eleve.classes?.nom || '—'}</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* BIG Validity status */}
              <CardValidityBig recharge={lastScanResult.recharge && getDaysRemaining(lastScanResult.recharge.date_expiration) > 0 ? lastScanResult.recharge : null} />

              {lastScanResult.status === 'not_found' && (
                <div className="flex flex-col items-center gap-2 p-6 rounded-3xl bg-muted border-2 border-muted">
                  <XCircle className="h-16 w-16 text-muted-foreground" />
                  <p className="text-xl font-bold">ÉLÈVE NON TROUVÉ</p>
                  <p className="text-sm text-muted-foreground">Matricule : {lastScanResult.matricule}</p>
                </div>
              )}

              {lastScanResult.status === 'already' && (
                <div className="flex flex-col items-center gap-2 p-6 rounded-3xl bg-blue-500/10 border-2 border-blue-500/30">
                  <Bus className="h-16 w-16 text-blue-500" />
                  <p className="text-xl font-bold text-blue-600">ALLER-RETOUR DÉJÀ VALIDÉ</p>
                </div>
              )}

              <Button variant="outline" className="w-full rounded-xl h-11" onClick={() => setLastScanResult(null)}>
                <ScanLine className="h-4 w-4 mr-2" /> Scanner un autre badge
              </Button>
            </div>
          ) : (
            /* Waiting for scan */
            <div className="space-y-4">
              <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-accent/10">
                <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" style={{ animationDuration: '2s' }} />
                    <div className="relative p-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                      <ScanLine className="h-16 w-16 text-primary animate-pulse" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-lg font-semibold">En attente de scan…</p>
                    <p className="text-sm text-muted-foreground">Placez le badge devant la douchette</p>
                  </div>
                </CardContent>
              </Card>

              <Button
                size="lg"
                className="w-full rounded-2xl h-14 text-base font-semibold gap-2 bg-primary"
                onClick={() => setScannerOpen(true)}
              >
                <ScanLine className="h-5 w-5" /> Ouvrir la caméra
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ─── VÉHICULE ─── */}
        <TabsContent value="vehicule" className="mt-3 space-y-3">
          {vehicules.length === 0 ? (
            <Card className="border-dashed border-2 border-muted">
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                <Truck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                Aucun véhicule assigné
              </CardContent>
            </Card>
          ) : vehicules.map((v: any) => (
            <Card key={v.id} className="rounded-2xl">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Truck className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold">{v.marque} {v.modele}</p>
                    <p className="text-xs text-muted-foreground font-mono">{v.immatriculation}</p>
                  </div>
                  {v.couleur && <Badge variant="outline" className="ml-auto text-xs">{v.couleur}</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-2 rounded-xl bg-muted/50">
                    <p className="text-[10px] text-muted-foreground">Capacité</p>
                    <p className="font-bold">{v.capacite} places</p>
                  </div>
                  <div className="p-2 rounded-xl bg-muted/50">
                    <p className="text-[10px] text-muted-foreground">Zone</p>
                    <p className="font-bold">{(v.zones_transport as any)?.nom || '—'}</p>
                  </div>
                </div>
                {v.assurance_expire && (
                  <div className={`flex items-center gap-2 text-xs p-2 rounded-xl ${new Date(v.assurance_expire) < new Date() ? 'bg-destructive/10 text-destructive' : 'bg-muted/50'}`}>
                    <Shield className="h-3.5 w-3.5" />
                    Assurance : {new Date(v.assurance_expire).toLocaleDateString('fr-FR')}
                    {new Date(v.assurance_expire) < new Date() && <Badge variant="destructive" className="text-[10px] ml-auto">Expirée</Badge>}
                  </div>
                )}
                {v.controle_technique_expire && (
                  <div className={`flex items-center gap-2 text-xs p-2 rounded-xl ${new Date(v.controle_technique_expire) < new Date() ? 'bg-destructive/10 text-destructive' : 'bg-muted/50'}`}>
                    <Clock className="h-3.5 w-3.5" />
                    CT : {new Date(v.controle_technique_expire).toLocaleDateString('fr-FR')}
                    {new Date(v.controle_technique_expire) < new Date() && <Badge variant="destructive" className="text-[10px] ml-auto">Expiré</Badge>}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* QR Scanner Dialog */}
      <QRScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onScan={handleScan} title="Scanner badge transport" />

      {/* Dialog: Incident */}
      <Dialog open={showIncident} onOpenChange={setShowIncident}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Signaler un incident</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={incidentForm.type_incident} onValueChange={v => setIncidentForm(f => ({ ...f, type_incident: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="panne">🔧 Panne</SelectItem>
                    <SelectItem value="accident">💥 Accident</SelectItem>
                    <SelectItem value="comportement">⚠️ Comportement</SelectItem>
                    <SelectItem value="retard">🕐 Retard</SelectItem>
                    <SelectItem value="autre">📋 Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gravité</Label>
                <Select value={incidentForm.gravite} onValueChange={v => setIncidentForm(f => ({ ...f, gravite: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="faible">Faible</SelectItem>
                    <SelectItem value="moyenne">Moyenne</SelectItem>
                    <SelectItem value="grave">Grave</SelectItem>
                    <SelectItem value="critique">Critique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Lieu (optionnel)</Label>
              <Input value={incidentForm.lieu} onChange={e => setIncidentForm(f => ({ ...f, lieu: e.target.value }))} placeholder="Ex: Carrefour Cosa…" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={incidentForm.description} onChange={e => setIncidentForm(f => ({ ...f, description: e.target.value }))} placeholder="Décrivez l'incident…" rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowIncident(false)}>Annuler</Button>
              <Button variant="destructive" onClick={handleIncident}>
                <FileWarning className="h-4 w-4 mr-1" /> Signaler
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
