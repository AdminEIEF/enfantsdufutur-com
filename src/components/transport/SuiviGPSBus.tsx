import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Navigation, MapPin, AlertTriangle, Clock, Bus, Send, Radio, Wifi, WifiOff, CircleDot } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const STATUT_COLORS: Record<string, string> = {
  en_route: 'bg-emerald-500',
  arret: 'bg-amber-500',
  incident: 'bg-red-500',
  termine: 'bg-muted-foreground',
};

const STATUT_LABELS: Record<string, string> = {
  en_route: 'En route',
  arret: 'À l\'arrêt',
  incident: 'Incident',
  termine: 'Terminé',
};

export default function SuiviGPSBus() {
  const qc = useQueryClient();
  const [showSignal, setShowSignal] = useState(false);
  const [signalForm, setSignalForm] = useState({ vehicule_id: '', statut: 'incident', message: '' });

  // Véhicules actifs avec chauffeur et zone
  const { data: vehicules = [] } = useQuery({
    queryKey: ['gps-vehicules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicules_transport')
        .select('id, immatriculation, marque, capacite, zone_transport_id, chauffeur_id, employes:chauffeur_id(id, nom, prenom, telephone), zones_transport:zone_transport_id(nom)')
        .eq('actif', true)
        .order('immatriculation');
      if (error) throw error;
      return data as any[];
    },
  });

  // Dernières positions GPS (une par véhicule)
  const { data: positions = [], refetch: refetchPositions } = useQuery({
    queryKey: ['bus-positions'],
    queryFn: async () => {
      // Récupérer les positions les plus récentes groupées par véhicule
      const { data, error } = await supabase
        .from('bus_positions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      // Garder seulement la dernière position par véhicule
      const map = new Map<string, any>();
      for (const p of (data || [])) {
        if (!map.has(p.vehicule_id)) map.set(p.vehicule_id, p);
      }
      return Array.from(map.values());
    },
    refetchInterval: 15000, // Rafraîchir toutes les 15 secondes
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('bus-positions-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bus_positions' }, () => {
        refetchPositions();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetchPositions]);

  // Incidents récents (dernières 24h)
  const { data: incidentsRecents = [] } = useQuery({
    queryKey: ['gps-incidents-recents'],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('bus_positions')
        .select('*, vehicules_transport:vehicule_id(immatriculation, marque, employes:chauffeur_id(nom, prenom))')
        .eq('statut', 'incident')
        .gte('created_at', since)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Signaler une position/incident
  const signalMutation = useMutation({
    mutationFn: async () => {
      if (!signalForm.vehicule_id) throw new Error('Sélectionnez un véhicule');
      if (signalForm.statut === 'incident' && !signalForm.message.trim()) throw new Error('Décrivez l\'incident');

      // Tenter de récupérer la position GPS du navigateur
      let lat = 9.5370, lng = -13.6785; // Conakry par défaut
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch { /* position par défaut */ }

      const { error } = await supabase.from('bus_positions').insert({
        vehicule_id: signalForm.vehicule_id,
        latitude: lat,
        longitude: lng,
        statut: signalForm.statut,
        message: signalForm.message || null,
      });
      if (error) throw error;

      // Notifier l'admin si incident
      if (signalForm.statut === 'incident') {
        const veh = vehicules.find((v: any) => v.id === signalForm.vehicule_id);
        await supabase.from('notifications').insert({
          destinataire_type: 'staff',
          titre: `🚨 Incident bus ${veh?.immatriculation || ''}`,
          message: signalForm.message.slice(0, 200),
          type: 'info',
        } as any);

        // Notifier les parents de la zone
        if (veh?.zone_transport_id) {
          const { data: elevesZone } = await supabase
            .from('eleves')
            .select('famille_id')
            .eq('zone_transport_id', veh.zone_transport_id)
            .eq('statut', 'inscrit')
            .not('famille_id', 'is', null);
          const familleIds = [...new Set((elevesZone || []).map((e: any) => e.famille_id))];
          if (familleIds.length > 0) {
            await supabase.from('parent_notifications').insert(
              familleIds.map(fid => ({
                famille_id: fid,
                titre: `🚨 Incident bus — ${veh.zones_transport?.nom || ''}`,
                message: signalForm.message.slice(0, 200),
                type: 'alerte',
              })) as any
            );
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bus-positions'] });
      qc.invalidateQueries({ queryKey: ['gps-incidents-recents'] });
      toast.success(signalForm.statut === 'incident' ? 'Incident signalé — parents et admin notifiés' : 'Position mise à jour');
      setShowSignal(false);
      setSignalForm({ vehicule_id: '', statut: 'incident', message: '' });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Données enrichies
  const busData = useMemo(() => {
    return vehicules.map((v: any) => {
      const pos = positions.find((p: any) => p.vehicule_id === v.id);
      const chauffeur = v.employes;
      return {
        ...v,
        zoneName: v.zones_transport?.nom || '—',
        chauffeurName: chauffeur ? `${chauffeur.prenom} ${chauffeur.nom}` : null,
        chauffeurTel: chauffeur?.telephone,
        lastPosition: pos,
        lastStatut: pos?.statut || 'termine',
        lastMessage: pos?.message,
        lastUpdate: pos?.created_at,
        isOnline: pos && (Date.now() - new Date(pos.created_at).getTime()) < 30 * 60 * 1000,
      };
    });
  }, [vehicules, positions]);

  const onlineBuses = busData.filter(b => b.isOnline).length;
  const incidentBuses = busData.filter(b => b.lastStatut === 'incident' && b.isOnline).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Navigation className="h-5 w-5 text-primary" /> Suivi GPS des bus
        </h3>
        <Button size="sm" variant="destructive" onClick={() => setShowSignal(true)}>
          <AlertTriangle className="h-4 w-4 mr-1" /> Signaler
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Bus className="h-6 w-6 text-primary shrink-0" />
            <div>
              <p className="text-[11px] text-muted-foreground">Total bus</p>
              <p className="text-xl font-bold">{vehicules.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={onlineBuses > 0 ? 'border-emerald-500/30' : ''}>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Wifi className="h-6 w-6 text-emerald-500 shrink-0" />
            <div>
              <p className="text-[11px] text-muted-foreground">En ligne</p>
              <p className="text-xl font-bold text-emerald-600">{onlineBuses}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <WifiOff className="h-6 w-6 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[11px] text-muted-foreground">Hors ligne</p>
              <p className="text-xl font-bold">{vehicules.length - onlineBuses}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={incidentBuses > 0 ? 'border-destructive/30' : ''}>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <AlertTriangle className={`h-6 w-6 shrink-0 ${incidentBuses > 0 ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
            <div>
              <p className="text-[11px] text-muted-foreground">Incidents</p>
              <p className="text-xl font-bold text-destructive">{incidentBuses}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liste des bus avec position */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {busData.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">Aucun véhicule configuré</CardContent>
          </Card>
        ) : busData.map((bus: any) => (
          <Card key={bus.id} className={`transition-all ${
            bus.lastStatut === 'incident' && bus.isOnline ? 'border-destructive/50 bg-destructive/5' :
            bus.isOnline ? 'border-emerald-500/30' : 'opacity-60'
          }`}>
            <CardContent className="pt-4 pb-3 px-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${bus.isOnline ? STATUT_COLORS[bus.lastStatut] || 'bg-muted-foreground' : 'bg-muted-foreground'} ${bus.isOnline && bus.lastStatut === 'en_route' ? 'animate-pulse' : ''}`} />
                  <div>
                    <p className="font-mono font-bold text-sm">{bus.immatriculation}</p>
                    {bus.marque && <p className="text-[11px] text-muted-foreground">{bus.marque}</p>}
                  </div>
                </div>
                <Badge variant={bus.isOnline ? (bus.lastStatut === 'incident' ? 'destructive' : 'default') : 'secondary'} className="text-[10px]">
                  {bus.isOnline ? STATUT_LABELS[bus.lastStatut] || bus.lastStatut : 'Hors ligne'}
                </Badge>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>{bus.zoneName}</span>
                </div>
                {bus.chauffeurName && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Radio className="h-3 w-3" />
                    <span>{bus.chauffeurName}</span>
                    {bus.chauffeurTel && <span className="ml-auto">📞 {bus.chauffeurTel}</span>}
                  </div>
                )}
                {bus.lastUpdate && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Dernière mise à jour : {new Date(bus.lastUpdate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
              </div>

              {bus.lastMessage && bus.isOnline && (
                <div className={`text-xs p-2 rounded ${bus.lastStatut === 'incident' ? 'bg-destructive/10 text-destructive' : 'bg-muted'}`}>
                  💬 {bus.lastMessage}
                </div>
              )}

              {bus.lastPosition && (
                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {bus.lastPosition.latitude.toFixed(4)}, {bus.lastPosition.longitude.toFixed(4)}
                  </span>
                  {bus.lastPosition.vitesse > 0 && (
                    <span className="text-[10px] text-muted-foreground">🚗 {Math.round(bus.lastPosition.vitesse)} km/h</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Incidents récents */}
      {incidentsRecents.length > 0 && (
        <Card className="border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Incidents signalés (24h)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {incidentsRecents.map((inc: any) => {
              const veh = inc.vehicules_transport as any;
              const chauffeur = veh?.employes;
              return (
                <div key={inc.id} className="flex items-start gap-2 p-2 rounded-lg bg-destructive/5 border border-destructive/10">
                  <CircleDot className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold">{veh?.immatriculation}</span>
                      {chauffeur && <span className="text-xs text-muted-foreground">— {chauffeur.prenom} {chauffeur.nom}</span>}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {new Date(inc.created_at).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm mt-0.5">{inc.message}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Dialog: Signaler position/incident */}
      <Dialog open={showSignal} onOpenChange={setShowSignal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>📡 Signaler une information</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Véhicule *</Label>
              <Select value={signalForm.vehicule_id} onValueChange={v => setSignalForm(f => ({ ...f, vehicule_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un bus" /></SelectTrigger>
                <SelectContent>
                  {vehicules.map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.immatriculation} — {v.zones_transport?.nom || 'Sans zone'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type de signalement</Label>
              <Select value={signalForm.statut} onValueChange={v => setSignalForm(f => ({ ...f, statut: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en_route">🟢 En route (tout va bien)</SelectItem>
                  <SelectItem value="arret">🟡 À l'arrêt (embouteillage/pause)</SelectItem>
                  <SelectItem value="incident">🔴 Incident (accident/panne/urgence)</SelectItem>
                  <SelectItem value="termine">⚪ Trajet terminé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Message {signalForm.statut === 'incident' ? '*' : '(optionnel)'}</Label>
              <Textarea
                value={signalForm.message}
                onChange={e => setSignalForm(f => ({ ...f, message: e.target.value }))}
                placeholder={
                  signalForm.statut === 'incident' ? "Décrivez l'incident (accident, panne, etc.)…" :
                  signalForm.statut === 'arret' ? "Ex: Embouteillage au rond-point de Cosa…" :
                  "Informations complémentaires…"
                }
                rows={3}
              />
            </div>
            {signalForm.statut === 'incident' && (
              <p className="text-xs text-destructive/80 bg-destructive/5 rounded p-2">
                ⚠️ Un incident notifie automatiquement l'administration et tous les parents de la zone concernée.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSignal(false)}>Annuler</Button>
            <Button
              variant={signalForm.statut === 'incident' ? 'destructive' : 'default'}
              onClick={() => signalMutation.mutate()}
              disabled={signalMutation.isPending}
            >
              <Send className="h-4 w-4 mr-1" />
              {signalMutation.isPending ? 'Envoi…' : 'Envoyer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
