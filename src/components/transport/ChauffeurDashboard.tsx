import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bus, Users, AlertTriangle, CheckCircle, MapPin, ScanLine, Clock, FileWarning, Truck, Phone, Shield, XCircle, ArrowRight, User, Calendar, Hash, Timer, MessageCircle, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
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

function PassagerGroupCard({ eleve, montee, descente, recharge }: { eleve: any; montee: any; descente: any; recharge: any }) {
  const jours = recharge ? getDaysRemaining(recharge.date_expiration) : 0;
  const isValid = recharge && jours > 0;

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-card border hover:shadow-md transition-shadow">
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
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{eleve?.prenom} {eleve?.nom}</p>
        <p className="text-[11px] text-muted-foreground">{eleve?.classes?.nom || '—'} • {eleve?.matricule || '—'}</p>
        {isValid ? (
          <p className={`text-[10px] font-bold ${jours <= 5 ? 'text-orange-500' : jours <= 10 ? 'text-amber-500' : 'text-emerald-600'}`}>
            <Timer className="h-3 w-3 inline mr-0.5" />{jours}j restants
          </p>
        ) : (
          <p className="text-[10px] font-bold text-destructive">Expirée</p>
        )}
      </div>
      {/* Montée & Descente côte à côte */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Montée */}
        <div className={`flex flex-col items-center gap-0.5 p-1.5 rounded-xl min-w-[56px] ${montee ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-muted/30 border border-dashed border-muted-foreground/20'}`}>
          <ArrowUp className={`h-4 w-4 ${montee ? 'text-emerald-600' : 'text-muted-foreground/40'}`} />
          <span className={`text-[9px] font-semibold ${montee ? 'text-emerald-700' : 'text-muted-foreground/40'}`}>Montée</span>
          {montee && (
            <span className="text-[9px] text-emerald-600 font-mono">
              {new Date(montee.validated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        {/* Descente */}
        <div className={`flex flex-col items-center gap-0.5 p-1.5 rounded-xl min-w-[56px] ${descente ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-muted/30 border border-dashed border-muted-foreground/20'}`}>
          <ArrowDown className={`h-4 w-4 ${descente ? 'text-blue-600' : 'text-muted-foreground/40'}`} />
          <span className={`text-[9px] font-semibold ${descente ? 'text-blue-700' : 'text-muted-foreground/40'}`}>Descente</span>
          {descente && (
            <span className="text-[9px] text-blue-600 font-mono">
              {new Date(descente.validated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChauffeurDashboard() {
  const { toast } = useToast();
  const [nonMontePage, setNonMontePage] = useState(0);
  const { user, loading: authLoading } = useAuth();
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

  // 1. Find the connected chauffeur's employee record via email
  const { data: chauffeurInfo, isLoading: loadingChauffeur } = useQuery({
    queryKey: ['chauffeur-mon-info', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data: emp } = await supabase
        .from('employes')
        .select('id, nom, prenom, matricule, photo_url')
        .eq('email', user.email)
        .eq('statut', 'actif')
        .maybeSingle();
      if (!emp) return null;
      const { data: veh } = await supabase
        .from('vehicules_transport')
        .select('*, zones_transport:zone_transport_id(id, nom)')
        .eq('chauffeur_id', emp.id)
        .eq('actif', true)
        .maybeSingle();
      return { employe: emp, vehicule: veh };
    },
    enabled: !!user?.email && !authLoading,
    retry: 2,
    retryDelay: 500,
  });

  const chauffeurVehicule = chauffeurInfo?.vehicule;
  const chauffeurEmploye = chauffeurInfo?.employe;
  const isStillLoading = authLoading || loadingChauffeur;

  const myZoneId = chauffeurVehicule?.zone_transport_id;
  const myZoneName = (chauffeurVehicule?.zones_transport as any)?.nom;

  // 2. Get all students assigned to my zone (total effectif)
  const { data: elevesZone = [] } = useQuery({
    queryKey: ['chauffeur-eleves-zone', myZoneId],
    queryFn: async () => {
      if (!myZoneId) return [];
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, photo_url, photo_thumbnail_url, classe_id, classes(nom)')
        .eq('zone_transport_id', myZoneId)
        .eq('statut', 'inscrit')
        .is('deleted_at', null)
        .order('nom');
      if (error) throw error;
      return data as any[];
    },
    enabled: !!myZoneId,
  });

  // 3. Validations du jour filtered by my zone
  const { data: validations = [] } = useQuery({
    queryKey: ['chauffeur-validations-full', today, myZoneId],
    queryFn: async () => {
      let query = supabase
        .from('validations_transport')
        .select('*, eleves(id, nom, prenom, matricule, photo_url, photo_thumbnail_url, classe_id, classes(nom), zones_transport:zone_transport_id(nom))')
        .gte('validated_at', `${today}T00:00:00`)
        .lte('validated_at', `${today}T23:59:59`)
        .order('validated_at', { ascending: false });
      if (myZoneId) {
        query = query.eq('zone_transport_id', myZoneId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });

  // Recharges actives
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

  // Véhicule (only mine)
  const { data: vehicules = [] } = useQuery({
    queryKey: ['chauffeur-vehicules', chauffeurVehicule?.id],
    queryFn: async () => {
      if (!chauffeurVehicule) {
        const { data, error } = await supabase
          .from('vehicules_transport')
          .select('*, zones_transport:zone_transport_id(nom)')
          .eq('actif', true);
        if (error) throw error;
        return data as any[];
      }
      return [chauffeurVehicule];
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

  // Realtime subscription for live updates on validations_transport
  useEffect(() => {
    const channel = supabase
      .channel('chauffeur-validations-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'validations_transport' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chauffeur-validations-full'] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const getActiveRecharge = (eleveId: string) => {
    return recharges.find(
      (r: any) => r.eleve_id === eleveId && r.actif && new Date(r.date_expiration) > new Date()
    ) || recharges.find((r: any) => r.eleve_id === eleveId);
  };

  const validCount = validations.filter((v: any) => v.valide).length;
  const rejectCount = validations.filter((v: any) => !v.valide).length;
  const uniqueEleves = new Set(validations.map((v: any) => v.eleve_id)).size;
  const totalAssigned = elevesZone.length;

  // Compteur montées (aller = 1er scan) et descentes (retour = 2e scan)
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

  // ─── Scan logic ───
  function playBeep(freq: number) {
    try { const ctx = new AudioContext(); const osc = ctx.createOscillator(); osc.frequency.value = freq; osc.connect(ctx.destination); osc.start(); setTimeout(() => osc.stop(), 150); } catch {}
  }

  const handleScanValidation = useCallback(async (matricule: string) => {
    if (!matricule) return;

    const { data: eleve } = await supabase.from('eleves')
      .select('id, nom, prenom, matricule, photo_url, photo_thumbnail_url, zone_transport_id, classe_id, classes(nom), famille_id')
      .eq('matricule', matricule).not('zone_transport_id', 'is', null).single();

    if (!eleve) {
      playBeep(300);
      setLastScanResult({ status: 'not_found', matricule });
      toast({ title: 'Non trouvé', description: `Aucun élève transport avec "${matricule}"`, variant: 'destructive' });
      return;
    }

    // Check if student belongs to my zone
    if (myZoneId && eleve.zone_transport_id !== myZoneId) {
      playBeep(300);
      setLastScanResult({ status: 'wrong_zone', eleve });
      toast({ title: '⚠️ Mauvaise zone', description: `${eleve.prenom} ${eleve.nom} n'est pas dans votre zone`, variant: 'destructive' });
      setTimeout(() => setLastScanResult(null), 5000);
      return;
    }

    const [rechargeRes, existingRes] = await Promise.all([
      supabase.from('recharges_transport')
        .select('*').eq('eleve_id', eleve.id).eq('actif', true)
        .gte('date_expiration', new Date().toISOString())
        .order('date_expiration', { ascending: false }).limit(1),
      supabase.from('validations_transport')
        .select('id').eq('eleve_id', eleve.id)
        .gte('validated_at', `${today}T00:00:00`).lte('validated_at', `${today}T23:59:59`),
    ]);
    const recharge = (rechargeRes.data as any[])?.[0];
    const count = (existingRes.data as any[])?.length || 0;
    const isValid = !!recharge;

    // Pas de recharge et déjà scanné une fois → croix rouge, pas d'insertion, notifications
    if (!isValid && count >= 1) {
      playBeep(300);
      const displayRecharge = recharges.find((r: any) => r.eleve_id === eleve.id);
      setLastScanResult({ status: 'blocked_no_recharge', eleve, recharge: displayRecharge });
      toast({ title: '❌ Accès refusé', description: `${eleve.prenom} ${eleve.nom} — Carte non rechargée`, variant: 'destructive' });
      
      // Envoyer notifications en arrière-plan
      supabase.from('student_notifications').insert({
        eleve_id: eleve.id,
        titre: '🚌 Carte transport non rechargée',
        message: 'Votre carte de transport n\'est pas rechargée. Veuillez demander à vos parents de la recharger.',
        type: 'alerte',
      } as any).then(() => {});
      if (eleve.famille_id) {
        supabase.from('parent_notifications').insert({
          famille_id: eleve.famille_id,
          titre: '🚌 Carte transport à recharger',
          message: `La carte transport de ${eleve.prenom} ${eleve.nom} n'est pas rechargée. Veuillez effectuer la recharge.`,
          type: 'alerte',
        } as any).then(() => {});
      }
      setTimeout(() => setLastScanResult(null), 5000);
      return;
    }

    if (count >= 2) {
      setLastScanResult({ status: 'already', eleve, recharge });
      toast({ title: 'ℹ️ Limite atteinte', description: `${eleve.prenom} ${eleve.nom} — Aller-retour déjà validé` });
      setTimeout(() => setLastScanResult(null), 5000);
      return;
    }

    const trajet = count === 0 ? 'aller' : 'retour';

    await supabase.from('validations_transport').insert({
      eleve_id: eleve.id, recharge_id: recharge?.id || null, zone_transport_id: eleve.zone_transport_id,
      valide: isValid, motif_rejet: isValid ? null : 'Carte non rechargée (1er passage autorisé)',
    } as any);
    queryClient.invalidateQueries({ queryKey: ['chauffeur-validations-full'] });

    // Notification parent : enfant monté/descendu du bus
    const trajetType = count === 0 ? 'monté dans' : 'descendu du';
    const heureNow = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (eleve.famille_id) {
      supabase.from('parent_notifications').insert({
        famille_id: eleve.famille_id,
        titre: count === 0 ? '🚌 Votre enfant est monté dans le bus' : '🏠 Votre enfant est descendu du bus',
        message: `Votre enfant ${eleve.prenom} ${eleve.nom} est bien ${trajetType} le bus à ${heureNow}.`,
        type: 'info',
      } as any).then(() => {});
    }

    if (isValid) {
      playBeep(800);
      if (navigator.vibrate) navigator.vibrate(150);
    } else {
      playBeep(800); // Premier passage autorisé = beep positif
      if (navigator.vibrate) navigator.vibrate(150);
    }

    const displayRecharge = recharge || recharges.find((r: any) => r.eleve_id === eleve.id);
    setLastScanResult({ 
      status: isValid ? 'valid' : 'first_free', 
      eleve, recharge: displayRecharge, trajet 
    });

    toast({
      title: isValid ? `✅ ${trajet === 'aller' ? 'Aller' : 'Retour'} validé` : '⚠️ 1er passage autorisé',
      description: `${eleve.prenom} ${eleve.nom}${!isValid ? ' — Recharge requise' : ''}`,
      variant: isValid ? undefined : undefined,
    });

    setTimeout(() => { setLastScanResult(null); }, 5000);
  }, [today, toast, queryClient, recharges, myZoneId]);

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

  // Group validations by student for side-by-side montée/descente display
  const groupedByEleve = useMemo(() => {
    const map = new Map<string, { eleve: any; montee: any; descente: any }>();
    const sorted = [...validationsWithTrajet].sort((a, b) => new Date(a.validated_at).getTime() - new Date(b.validated_at).getTime());
    for (const v of sorted) {
      const id = v.eleve_id;
      if (!map.has(id)) {
        map.set(id, { eleve: v.eleves, montee: null, descente: null });
      }
      const entry = map.get(id)!;
      if (v._trajetCount <= 1) entry.montee = v;
      else entry.descente = v;
    }
    return Array.from(map.values());
  }, [validationsWithTrajet]);

  return (
    <div className="space-y-4">
      {/* Header with chauffeur identity and zone info */}
      {isStillLoading ? (
        <div className="flex items-center gap-3 p-4 rounded-2xl border bg-card">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      ) : !chauffeurEmploye ? (
        <div className="p-4 rounded-2xl border bg-destructive/5 border-destructive/20 text-center">
          <p className="text-sm font-semibold text-destructive">⚠️ Aucun profil chauffeur trouvé</p>
          <p className="text-xs text-muted-foreground mt-1">Vérifiez que votre compte est lié à un employé chauffeur.</p>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border">
          <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            {chauffeurEmploye.photo_url ? (
              <img src={chauffeurEmploye.photo_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
            ) : (
              <User className="h-6 w-6 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold truncate">
              {chauffeurEmploye.prenom} {chauffeurEmploye.nom}
            </h1>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap">
              <Hash className="h-3 w-3" />{chauffeurEmploye.matricule}
              {myZoneName && (
                <>
                  <span className="mx-0.5">•</span>
                  <MapPin className="h-3 w-3" />
                  <span className="font-semibold text-foreground">{myZoneName}</span>
                </>
              )}
              {chauffeurVehicule?.immatriculation && (
                <>
                  <span className="mx-0.5">•</span>
                  <span className="font-mono">🚌 {chauffeurVehicule.immatriculation}</span>
                </>
              )}
            </p>
          </div>
          <Button variant="destructive" size="sm" className="shrink-0 rounded-xl" onClick={() => setShowIncident(true)}>
            <FileWarning className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: Users, label: 'Affectés', value: totalAssigned, color: 'text-primary', bg: 'from-primary/10 to-primary/5' },
          { icon: ArrowUp, label: 'Montés', value: monteeCount, color: 'text-emerald-600', bg: 'from-emerald-500/10 to-emerald-500/5' },
          { icon: ArrowDown, label: 'Descendus', value: descenteCount, color: 'text-blue-600', bg: 'from-blue-500/10 to-blue-500/5' },
          { icon: XCircle, label: 'Refusés', value: rejectCount, color: 'text-destructive', bg: 'from-destructive/10 to-destructive/5' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className={`rounded-2xl bg-gradient-to-br ${bg} border p-2.5 flex flex-col items-center gap-1`}>
            <div className={`h-8 w-8 rounded-xl bg-card/80 flex items-center justify-center ${color} shrink-0`}>
              <Icon className="h-4 w-4" />
            </div>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>

      {/* Comparaison montée vs descente */}
      {monteeCount > 0 && (
        <div className="rounded-2xl border p-3 bg-card space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1"><ArrowUp className="h-3 w-3 text-emerald-600" /> Montés</span>
            <span className="font-bold text-emerald-600">{monteeCount}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1"><ArrowDown className="h-3 w-3 text-blue-600" /> Descendus</span>
            <span className="font-bold text-blue-600">{descenteCount}</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${monteeCount > 0 ? (monteeCount / (monteeCount + descenteCount || 1)) * 100 : 50}%` }} />
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${descenteCount > 0 ? (descenteCount / (monteeCount + descenteCount || 1)) * 100 : 0}%` }} />
          </div>
          {monteeCount !== descenteCount && (
            <p className="text-[10px] text-orange-500 font-medium">
              ⚠️ {monteeCount - descenteCount} élève(s) encore dans le bus
            </p>
          )}
          {monteeCount === descenteCount && monteeCount > 0 && (
            <p className="text-[10px] text-emerald-600 font-medium">
              ✅ Tous les élèves sont descendus
            </p>
          )}
        </div>
      )}

      {/* Progress: montés / affectés */}
      {totalAssigned > 0 && (
        <div className="rounded-2xl border p-3 bg-card">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Progression du ramassage</span>
            <span className="font-bold text-foreground">{uniqueEleves}/{totalAssigned}</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(100, (uniqueEleves / totalAssigned) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {totalAssigned - uniqueEleves} élève(s) pas encore monté(s)
          </p>
        </div>
      )}

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
            <Badge variant="outline" className="text-xs">{groupedByEleve.length} élève(s) • {validationsWithTrajet.length} passages</Badge>
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
              {groupedByEleve.map((g) => (
                <PassagerGroupCard
                  key={g.eleve?.id || g.montee?.id || g.descente?.id}
                  eleve={g.eleve}
                  montee={g.montee}
                  descente={g.descente}
                  recharge={getActiveRecharge(g.montee?.eleve_id || g.descente?.eleve_id)}
                />
              ))}
            </div>
          )}

          {/* Élèves non encore montés */}
          {totalAssigned > 0 && uniqueEleves < totalAssigned && (
            <div className="space-y-2">
              <p className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" /> Pas encore montés ({totalAssigned - uniqueEleves})
              </p>
              <div className="grid grid-cols-2 gap-2">
                {elevesZone
                  .filter((e: any) => !validations.some((v: any) => v.eleve_id === e.id))
                  .slice(0, 10)
                  .map((e: any) => (
                    <div key={e.id} className="flex items-center gap-2 p-2 rounded-xl bg-muted/40 border border-dashed">
                      {e.photo_thumbnail_url || e.photo_url ? (
                        <img src={e.photo_thumbnail_url || e.photo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{e.prenom} {e.nom}</p>
                        <p className="text-[10px] text-muted-foreground">{e.classes?.nom || '—'}</p>
                      </div>
                    </div>
                  ))}
              </div>
              {(totalAssigned - uniqueEleves) > 10 && (
                <p className="text-[10px] text-muted-foreground text-center">
                  + {totalAssigned - uniqueEleves - 10} autre(s)…
                </p>
              )}
            </div>
          )}

          {/* Incidents récents */}
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

        {/* ─── SCAN BUS ─── */}
        <TabsContent value="scan" className="mt-3 space-y-4">
          {lastScanResult ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {lastScanResult.eleve && (
                <Card className="overflow-hidden border-0 shadow-xl">
                  <div className={`h-20 relative ${
                    lastScanResult.status === 'valid' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
                    lastScanResult.status === 'first_free' ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                    lastScanResult.status === 'wrong_zone' ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                    lastScanResult.status === 'blocked_no_recharge' ? 'bg-gradient-to-r from-destructive to-destructive/80' :
                    lastScanResult.status === 'invalid' ? 'bg-gradient-to-r from-destructive to-destructive/80' :
                    'bg-gradient-to-r from-primary to-primary/80'
                  }`}>
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

              {/* Wrong zone alert */}
              {lastScanResult.status === 'wrong_zone' && (
                <div className="flex flex-col items-center gap-2 p-6 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30">
                  <MapPin className="h-16 w-16 text-amber-500" />
                  <p className="text-2xl font-black text-amber-600">MAUVAISE ZONE</p>
                  <p className="text-sm text-amber-600/70">Cet élève n'est pas affecté à votre bus</p>
                </div>
              )}

              {/* Blocked: carte non rechargée, 2e scan */}
              {lastScanResult.status === 'blocked_no_recharge' && (
                <div className="flex flex-col items-center gap-2 p-6 rounded-3xl bg-destructive/10 border-2 border-destructive/30">
                  <XCircle className="h-20 w-20 text-destructive" />
                  <p className="text-2xl font-black text-destructive">ACCÈS REFUSÉ</p>
                  <p className="text-sm text-destructive/70 text-center">Carte non rechargée — Notification envoyée à l'élève et au parent</p>
                </div>
              )}

              {/* First free pass: carte non rechargée, 1er scan autorisé */}
              {lastScanResult.status === 'first_free' && (
                <div className="flex flex-col items-center gap-2 p-6 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30">
                  <AlertTriangle className="h-16 w-16 text-amber-500" />
                  <p className="text-2xl font-black text-amber-600">1er PASSAGE AUTORISÉ</p>
                  <p className="text-sm text-amber-600/70 text-center">Carte non rechargée — Le prochain scan sera refusé</p>
                </div>
              )}

              {/* BIG Validity status - only for valid scans */}
              {lastScanResult.status === 'valid' && (
                <CardValidityBig recharge={lastScanResult.recharge && getDaysRemaining(lastScanResult.recharge.date_expiration) > 0 ? lastScanResult.recharge : null} />
              )}

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
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="p-2 rounded-xl bg-muted/50">
                    <p className="text-[10px] text-muted-foreground">Capacité</p>
                    <p className="font-bold">{v.capacite} places</p>
                  </div>
                  <div className="p-2 rounded-xl bg-muted/50">
                    <p className="text-[10px] text-muted-foreground">Zone</p>
                    <p className="font-bold">{(v.zones_transport as any)?.nom || '—'}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-primary/5">
                    <p className="text-[10px] text-muted-foreground">Élèves</p>
                    <p className="font-bold text-primary">{totalAssigned}</p>
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
