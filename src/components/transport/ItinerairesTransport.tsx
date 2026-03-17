import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Route, MapPin, Plus, Clock, Trash2, GripVertical, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface Props {
  zones: any[];
}

export default function ItinerairesTransport({ zones }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);
  const [showAddArret, setShowAddArret] = useState<string | null>(null);
  const [newRoute, setNewRoute] = useState({
    zone_transport_id: '', nom: '', description: '',
    heure_depart_matin: '06:30', heure_arrivee_matin: '07:30',
    heure_depart_soir: '16:00', heure_arrivee_soir: '17:00',
  });
  const [newArret, setNewArret] = useState({ nom: '', heure_passage_matin: '', heure_passage_soir: '', ordre: 0 });

  const { data: routes = [] } = useQuery({
    queryKey: ['routes-transport'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes_transport')
        .select('*, zones_transport:zone_transport_id(nom, chauffeur_bus), arrets_transport(id, nom, ordre, heure_passage_matin, heure_passage_soir)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        ...r,
        arrets_transport: (r.arrets_transport || []).sort((a: any, b: any) => a.ordre - b.ordre),
      }));
    },
  });

  const addRouteMutation = useMutation({
    mutationFn: async () => {
      if (!newRoute.zone_transport_id || !newRoute.nom) throw new Error('Zone et nom requis');
      const { error } = await supabase.from('routes_transport').insert(newRoute as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes-transport'] });
      toast({ title: 'Route ajoutée' });
      setShowAdd(false);
      setNewRoute({ zone_transport_id: '', nom: '', description: '', heure_depart_matin: '06:30', heure_arrivee_matin: '07:30', heure_depart_soir: '16:00', heure_arrivee_soir: '17:00' });
    },
    onError: (err: any) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  const addArretMutation = useMutation({
    mutationFn: async (routeId: string) => {
      if (!newArret.nom) throw new Error('Nom requis');
      const { error } = await supabase.from('arrets_transport').insert({ ...newArret, route_id: routeId } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes-transport'] });
      toast({ title: 'Arrêt ajouté' });
      setShowAddArret(null);
      setNewArret({ nom: '', heure_passage_matin: '', heure_passage_soir: '', ordre: 0 });
    },
    onError: (err: any) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  const deleteArretMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('arrets_transport').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes-transport'] });
      toast({ title: 'Arrêt supprimé' });
    },
  });

  const toggleRouteMutation = useMutation({
    mutationFn: async ({ id, actif }: { id: string; actif: boolean }) => {
      const { error } = await supabase.from('routes_transport').update({ actif } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['routes-transport'] }),
  });

  const deleteRouteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('routes_transport').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes-transport'] });
      toast({ title: 'Route supprimée' });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Route className="h-5 w-5 text-primary" /> Itinéraires ({routes.length})
        </h3>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nouvelle route
        </Button>
      </div>

      {routes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Route className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Aucun itinéraire configuré. Créez une route pour commencer.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {routes.map((route: any) => {
            const isExpanded = expandedRoute === route.id;
            return (
              <Card key={route.id} className={!route.actif ? 'opacity-60' : ''}>
                <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpandedRoute(isExpanded ? null : route.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2">
                          {route.nom}
                          <Badge variant="outline" className="text-xs">{(route.zones_transport as any)?.nom}</Badge>
                          {!route.actif && <Badge variant="destructive" className="text-xs">Inactif</Badge>}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          🚌 {(route.zones_transport as any)?.chauffeur_bus || '—'} •
                          Matin: {route.heure_depart_matin?.slice(0, 5)} → {route.heure_arrivee_matin?.slice(0, 5)} •
                          Soir: {route.heure_depart_soir?.slice(0, 5)} → {route.heure_arrivee_soir?.slice(0, 5)} •
                          {route.arrets_transport?.length || 0} arrêt(s)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <Switch
                        checked={route.actif}
                        onCheckedChange={actif => toggleRouteMutation.mutate({ id: route.id, actif })}
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                        if (confirm('Supprimer cette route et ses arrêts ?')) deleteRouteMutation.mutate(route.id);
                      }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="pt-0">
                    {route.description && <p className="text-sm text-muted-foreground mb-3">{route.description}</p>}

                    {/* Arrêts */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Arrêts du parcours</p>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                          setNewArret({ nom: '', heure_passage_matin: '', heure_passage_soir: '', ordre: (route.arrets_transport?.length || 0) + 1 });
                          setShowAddArret(route.id);
                        }}>
                          <Plus className="h-3 w-3 mr-1" /> Arrêt
                        </Button>
                      </div>

                      {route.arrets_transport?.length > 0 ? (
                        <div className="relative pl-6 space-y-0">
                          {route.arrets_transport.map((arret: any, idx: number) => (
                            <div key={arret.id} className="relative flex items-center gap-3 py-2 group">
                              {/* Vertical line */}
                              {idx < route.arrets_transport.length - 1 && (
                                <div className="absolute left-[-12px] top-[22px] bottom-[-10px] w-0.5 bg-primary/20" />
                              )}
                              <div className="absolute left-[-16px] w-3 h-3 rounded-full bg-primary border-2 border-background z-10" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{arret.ordre}. {arret.nom}</p>
                                <p className="text-xs text-muted-foreground">
                                  {arret.heure_passage_matin && `Matin: ${arret.heure_passage_matin.slice(0, 5)}`}
                                  {arret.heure_passage_matin && arret.heure_passage_soir && ' • '}
                                  {arret.heure_passage_soir && `Soir: ${arret.heure_passage_soir.slice(0, 5)}`}
                                </p>
                              </div>
                              <Button
                                variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                                onClick={() => deleteArretMutation.mutate(arret.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-3">Aucun arrêt défini</p>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog: Nouvelle route */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nouvelle route</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Zone de transport</Label>
              <Select value={newRoute.zone_transport_id} onValueChange={v => setNewRoute(r => ({ ...r, zone_transport_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une zone" /></SelectTrigger>
                <SelectContent>
                  {zones.map((z: any) => <SelectItem key={z.id} value={z.id}>{z.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nom de la route</Label>
              <Input value={newRoute.nom} onChange={e => setNewRoute(r => ({ ...r, nom: e.target.value }))} placeholder="Ex: Route Nord - Kipé" />
            </div>
            <div>
              <Label>Description (optionnel)</Label>
              <Input value={newRoute.description} onChange={e => setNewRoute(r => ({ ...r, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Départ matin</Label>
                <Input type="time" value={newRoute.heure_depart_matin} onChange={e => setNewRoute(r => ({ ...r, heure_depart_matin: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Arrivée matin</Label>
                <Input type="time" value={newRoute.heure_arrivee_matin} onChange={e => setNewRoute(r => ({ ...r, heure_arrivee_matin: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Départ soir</Label>
                <Input type="time" value={newRoute.heure_depart_soir} onChange={e => setNewRoute(r => ({ ...r, heure_depart_soir: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Arrivée soir</Label>
                <Input type="time" value={newRoute.heure_arrivee_soir} onChange={e => setNewRoute(r => ({ ...r, heure_arrivee_soir: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Annuler</Button>
              <Button onClick={() => addRouteMutation.mutate()} disabled={addRouteMutation.isPending}>Créer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nouvel arrêt */}
      <Dialog open={!!showAddArret} onOpenChange={() => setShowAddArret(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Ajouter un arrêt</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nom de l'arrêt</Label>
              <Input value={newArret.nom} onChange={e => setNewArret(a => ({ ...a, nom: e.target.value }))} placeholder="Ex: Carrefour Cosa" />
            </div>
            <div>
              <Label>Ordre</Label>
              <Input type="number" value={newArret.ordre} onChange={e => setNewArret(a => ({ ...a, ordre: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Passage matin</Label>
                <Input type="time" value={newArret.heure_passage_matin} onChange={e => setNewArret(a => ({ ...a, heure_passage_matin: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Passage soir</Label>
                <Input type="time" value={newArret.heure_passage_soir} onChange={e => setNewArret(a => ({ ...a, heure_passage_soir: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddArret(null)}>Annuler</Button>
              <Button onClick={() => showAddArret && addArretMutation.mutate(showAddArret)} disabled={addArretMutation.isPending}>Ajouter</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
