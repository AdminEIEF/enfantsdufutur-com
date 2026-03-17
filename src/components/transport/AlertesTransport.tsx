import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Bell, Bus, Send, Clock, MapPin, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface Props {
  zones: any[];
}

export default function AlertesTransport({ zones }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSignaler, setShowSignaler] = useState(false);
  const [alertForm, setAlertForm] = useState({
    route_id: '', type_trajet: 'aller', retard_minutes: 10, motif_retard: '',
  });

  // Routes pour le formulaire
  const { data: routes = [] } = useQuery({
    queryKey: ['routes-transport-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes_transport')
        .select('id, nom, zone_transport_id, zones_transport:zone_transport_id(nom)')
        .eq('actif', true)
        .order('nom');
      if (error) throw error;
      return data as any[];
    },
  });

  // Dernières alertes (retards > 5 min des 30 derniers jours)
  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);

  const { data: alertes = [] } = useQuery({
    queryKey: ['alertes-transport', thirtyDaysAgo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trajets_transport')
        .select('*, routes_transport:route_id(nom, zones_transport:zone_transport_id(nom, chauffeur_bus))')
        .gt('retard_minutes', 5)
        .gte('date_trajet', thirtyDaysAgo)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Cartes expirées
  const { data: expiredCount = 0 } = useQuery({
    queryKey: ['transport-expired-count'],
    queryFn: async () => {
      const { data: eleves } = await supabase
        .from('eleves')
        .select('id')
        .not('zone_transport_id', 'is', null)
        .eq('statut', 'inscrit');

      const { data: recharges } = await supabase
        .from('recharges_transport')
        .select('eleve_id, date_expiration, actif');

      const now = new Date().toISOString();
      let count = 0;
      for (const e of (eleves || [])) {
        const hasActive = (recharges || []).some((r: any) => r.eleve_id === e.id && r.actif && r.date_expiration >= now);
        if (!hasActive) count++;
      }
      return count;
    },
  });

  // Signaler un retard
  const signalerMutation = useMutation({
    mutationFn: async () => {
      if (!alertForm.route_id) throw new Error('Sélectionnez une route');
      const { error } = await supabase.from('trajets_transport').insert({
        route_id: alertForm.route_id,
        type_trajet: alertForm.type_trajet,
        retard_minutes: alertForm.retard_minutes,
        motif_retard: alertForm.motif_retard || null,
        statut: 'termine',
      } as any);
      if (error) throw error;

      // Notifier les parents des élèves de cette zone
      const route = routes.find((r: any) => r.id === alertForm.route_id);
      if (route) {
        const { data: elevesZone } = await supabase
          .from('eleves')
          .select('id, famille_id')
          .eq('zone_transport_id', route.zone_transport_id)
          .eq('statut', 'inscrit')
          .not('famille_id', 'is', null);

        const familleIds = [...new Set((elevesZone || []).map((e: any) => e.famille_id).filter(Boolean))];

        if (familleIds.length > 0) {
          const notifs = familleIds.map(fid => ({
            famille_id: fid,
            titre: `🚌 Retard bus — ${route.nom}`,
            message: `Le bus de la route "${route.nom}" a un retard de ${alertForm.retard_minutes} min (${alertForm.type_trajet}).${alertForm.motif_retard ? ` Motif: ${alertForm.motif_retard}` : ''}`,
            type: 'info',
          }));
          await supabase.from('parent_notifications').insert(notifs as any);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertes-transport'] });
      queryClient.invalidateQueries({ queryKey: ['trajets-transport'] });
      toast({ title: '✅ Retard signalé', description: 'Les parents concernés ont été notifiés' });
      setShowSignaler(false);
      setAlertForm({ route_id: '', type_trajet: 'aller', retard_minutes: 10, motif_retard: '' });
    },
    onError: (err: any) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  const alertesAujourdhui = alertes.filter(a => a.date_trajet === new Date().toISOString().slice(0, 10));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" /> Alertes transport
        </h3>
        <Button size="sm" variant="destructive" onClick={() => setShowSignaler(true)}>
          <AlertTriangle className="h-4 w-4 mr-1" /> Signaler un retard
        </Button>
      </div>

      {/* Résumé alertes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className={alertesAujourdhui.length > 0 ? 'border-warning/40' : ''}>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <AlertTriangle className={`h-7 w-7 shrink-0 ${alertesAujourdhui.length > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
            <div>
              <p className="text-xs text-muted-foreground">Retards aujourd'hui</p>
              <p className="text-xl font-bold">{alertesAujourdhui.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Clock className="h-7 w-7 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Retards ce mois</p>
              <p className="text-xl font-bold">{alertes.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={expiredCount > 0 ? 'border-destructive/40' : ''}>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Users className={`h-7 w-7 shrink-0 ${expiredCount > 0 ? 'text-destructive' : 'text-accent'}`} />
            <div>
              <p className="text-xs text-muted-foreground">Cartes expirées</p>
              <p className="text-xl font-bold">{expiredCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertes du jour */}
      {alertesAujourdhui.length > 0 && (
        <Card className="border-warning/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning animate-pulse" /> Alertes en cours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alertesAujourdhui.map((a: any) => (
                <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg bg-warning/5 border border-warning/20">
                  <Bus className="h-5 w-5 text-warning shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {(a.routes_transport as any)?.nom} — {a.type_trajet === 'aller' ? '🚌 Aller' : '🏠 Retour'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(a.routes_transport as any)?.zones_transport?.chauffeur_bus || '—'} •
                      {a.motif_retard || 'Aucun motif'}
                    </p>
                  </div>
                  <Badge variant="destructive">{a.retard_minutes} min</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historique */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Historique des retards (30 derniers jours)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Chauffeur</TableHead>
                <TableHead className="text-center">Trajet</TableHead>
                <TableHead className="text-center">Retard</TableHead>
                <TableHead>Motif</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertes.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun retard signalé 🎉</TableCell></TableRow>
              ) : alertes.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="text-sm">{new Date(a.date_trajet).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell className="font-medium text-sm">{(a.routes_transport as any)?.nom || '—'}</TableCell>
                  <TableCell className="text-sm">{(a.routes_transport as any)?.zones_transport?.nom || '—'}</TableCell>
                  <TableCell className="text-sm">{(a.routes_transport as any)?.zones_transport?.chauffeur_bus || '—'}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-xs">{a.type_trajet === 'aller' ? '🚌 Aller' : '🏠 Retour'}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={a.retard_minutes >= 15 ? 'destructive' : 'secondary'}>{a.retard_minutes} min</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{a.motif_retard || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog: Signaler retard */}
      <Dialog open={showSignaler} onOpenChange={setShowSignaler}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Signaler un retard de bus</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Route</Label>
              <Select value={alertForm.route_id} onValueChange={v => setAlertForm(f => ({ ...f, route_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une route" /></SelectTrigger>
                <SelectContent>
                  {routes.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.nom} ({(r.zones_transport as any)?.nom})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Trajet</Label>
                <Select value={alertForm.type_trajet} onValueChange={v => setAlertForm(f => ({ ...f, type_trajet: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aller">🚌 Aller (matin)</SelectItem>
                    <SelectItem value="retour">🏠 Retour (soir)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Retard (minutes)</Label>
                <Input type="number" min={1} value={alertForm.retard_minutes} onChange={e => setAlertForm(f => ({ ...f, retard_minutes: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div>
              <Label>Motif (optionnel)</Label>
              <Textarea value={alertForm.motif_retard} onChange={e => setAlertForm(f => ({ ...f, motif_retard: e.target.value }))} placeholder="Ex: Embouteillage sur la route de Kipé…" rows={2} />
            </div>
            <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
              ⚠️ Les parents des élèves de cette zone recevront une notification automatique.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSignaler(false)}>Annuler</Button>
              <Button variant="destructive" onClick={() => signalerMutation.mutate()} disabled={signalerMutation.isPending}>
                <Send className="h-4 w-4 mr-1" /> Signaler & Notifier
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
