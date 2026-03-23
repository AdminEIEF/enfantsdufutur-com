import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Bus, Users, AlertTriangle, CheckCircle, MapPin, ScanLine, Clock, FileWarning, Truck, Phone, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import ValidationTransportBus from '@/components/ValidationTransportBus';

export default function ChauffeurDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [showIncident, setShowIncident] = useState(false);
  const [incidentForm, setIncidentForm] = useState({
    type_incident: 'retard', description: '', gravite: 'moyenne', lieu: '',
  });

  // Routes du chauffeur (toutes les routes actives)
  const { data: routes = [] } = useQuery({
    queryKey: ['chauffeur-routes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routes_transport')
        .select('*, zones_transport:zone_transport_id(nom, chauffeur_bus, telephone_chauffeur, quartiers), arrets_transport(id, nom, ordre, heure_passage_matin, heure_passage_soir)')
        .eq('actif', true)
        .order('nom');
      if (error) throw error;
      return (data || []).map((r: any) => ({
        ...r,
        arrets_transport: (r.arrets_transport || []).sort((a: any, b: any) => a.ordre - b.ordre),
      }));
    },
  });

  // Élèves par zone (pour check-in)
  const { data: eleves = [] } = useQuery({
    queryKey: ['chauffeur-eleves'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, zone_transport_id, classe_id, famille_id, classes(nom), photo_url')
        .not('zone_transport_id', 'is', null)
        .eq('statut', 'inscrit')
        .order('nom');
      if (error) throw error;
      return data as any[];
    },
  });

  // Check-ins du jour
  const { data: checkins = [] } = useQuery({
    queryKey: ['chauffeur-checkins', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checkin_transport')
        .select('*')
        .eq('date_checkin', today);
      if (error) throw error;
      return data as any[];
    },
  });

  // Validations du jour
  const { data: validations = [] } = useQuery({
    queryKey: ['chauffeur-validations', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('validations_transport')
        .select('id, eleve_id, valide')
        .gte('validated_at', `${today}T00:00:00`)
        .lte('validated_at', `${today}T23:59:59`);
      if (error) throw error;
      return data as any[];
    },
  });

  // Véhicule assigné
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

  // Incidents récents
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

  // Check-in mutation
  const checkinMutation = useMutation({
    mutationFn: async ({ eleveId, routeId, arretId, present, trajet }: any) => {
      // Vérifier si déjà checké
      const existing = checkins.find(
        (c: any) => c.eleve_id === eleveId && c.type_trajet === trajet
      );
      if (existing) {
        // Update
        const { error } = await supabase
          .from('checkin_transport')
          .update({ present, arret_id: arretId } as any)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('checkin_transport').insert({
          eleve_id: eleveId,
          route_id: routeId,
          arret_id: arretId,
          type_trajet: trajet,
          present,
        } as any);
        if (error) throw error;
      }

      // Notifier le parent si absent
      if (!present) {
        const { data: eleve } = await supabase
          .from('eleves')
          .select('nom, prenom, famille_id')
          .eq('id', eleveId)
          .single();
        if (eleve?.famille_id) {
          await supabase.from('parent_notifications').insert({
            famille_id: eleve.famille_id,
            titre: '🚌 Absence au point de ramassage',
            message: `${eleve.prenom} ${eleve.nom} n'était pas au point de ramassage ce matin.`,
            type: 'info',
          } as any);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chauffeur-checkins'] });
    },
    onError: (err: any) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  // Incident mutation
  const incidentMutation = useMutation({
    mutationFn: async () => {
      if (!incidentForm.description.trim()) throw new Error('Description requise');
      const { error } = await supabase.from('incidents_transport').insert({
        type_incident: incidentForm.type_incident,
        description: incidentForm.description,
        gravite: incidentForm.gravite,
        lieu: incidentForm.lieu || null,
        date_incident: today,
      } as any);
      if (error) throw error;

      // Notifier les admins (alerte)
      await supabase.from('notifications').insert({
        destinataire_type: 'staff',
        titre: `🚨 Incident transport — ${incidentForm.type_incident}`,
        message: `${incidentForm.description.slice(0, 200)} | Gravité: ${incidentForm.gravite}${incidentForm.lieu ? ' | Lieu: ' + incidentForm.lieu : ''}`,
        type: 'alerte',
      } as any);

      // Notifier les parents des élèves transportés
      const elevesWithFamille = eleves.filter((e: any) => e.famille_id);
      if (elevesWithFamille.length > 0) {
        const parentNotifs = elevesWithFamille.map((e: any) => ({
          famille_id: e.famille_id,
          titre: `🚨 Incident transport — ${incidentForm.type_incident}`,
          message: `Un incident (${incidentForm.gravite}) a été signalé sur le trajet de votre enfant ${e.prenom} ${e.nom}. ${incidentForm.description.slice(0, 150)}${incidentForm.lieu ? ' — Lieu: ' + incidentForm.lieu : ''}`,
          type: 'alerte',
        }));
        await supabase.from('parent_notifications').insert(parentNotifs as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chauffeur-incidents'] });
      toast({ title: '✅ Incident signalé', description: 'L\'administration a été notifiée' });
      setShowIncident(false);
      setIncidentForm({ type_incident: 'retard', description: '', gravite: 'moyenne', lieu: '' });
    },
    onError: (err: any) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  const totalEleves = eleves.length;
  const checkinsToday = checkins.filter((c: any) => c.present).length;
  const validationsToday = validations.length;

  // Déterminer le trajet en cours (matin avant 13h, soir après)
  const currentHour = new Date().getHours();
  const currentTrajet = currentHour < 13 ? 'aller' : 'retour';

  return (
    <div className="space-y-4">
      {/* Header mobile-optimisé */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Bus className="h-6 w-6 text-primary" /> Tableau de bord
        </h1>
        <Button variant="destructive" size="sm" onClick={() => setShowIncident(true)}>
          <FileWarning className="h-4 w-4 mr-1" /> Incident
        </Button>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="pt-3 pb-2 px-3 text-center">
            <Users className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{totalEleves}</p>
            <p className="text-[10px] text-muted-foreground">Élèves</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2 px-3 text-center">
            <CheckCircle className="h-5 w-5 mx-auto text-accent mb-1" />
            <p className="text-lg font-bold">{checkinsToday}</p>
            <p className="text-[10px] text-muted-foreground">Présents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2 px-3 text-center">
            <ScanLine className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold">{validationsToday}</p>
            <p className="text-[10px] text-muted-foreground">Validations</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="scan">
        <TabsList className="w-full grid grid-cols-4 h-auto">
          <TabsTrigger value="scan" className="text-xs py-2 gap-1"><ScanLine className="h-3.5 w-3.5" /> Scan</TabsTrigger>
          <TabsTrigger value="checkin" className="text-xs py-2 gap-1"><CheckCircle className="h-3.5 w-3.5" /> Check-in</TabsTrigger>
          <TabsTrigger value="incidents" className="text-xs py-2 gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Incidents</TabsTrigger>
          <TabsTrigger value="vehicule" className="text-xs py-2 gap-1"><Truck className="h-3.5 w-3.5" /> Véhicule</TabsTrigger>
        </TabsList>

        {/* Scan QR */}
        <TabsContent value="scan" className="mt-3">
          <ValidationTransportBus />
        </TabsContent>

        {/* Check-in élèves */}
        <TabsContent value="checkin" className="mt-3 space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant={currentTrajet === 'aller' ? 'default' : 'secondary'} className="text-sm">
              {currentTrajet === 'aller' ? '🚌 Ramassage matin' : '🏠 Retour soir'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>

          {routes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                Aucune route configurée
              </CardContent>
            </Card>
          ) : routes.map((route: any) => {
            const zoneEleves = eleves.filter((e: any) => e.zone_transport_id === route.zone_transport_id);
            if (zoneEleves.length === 0) return null;

            return (
              <Card key={route.id}>
                <CardHeader className="pb-2 px-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    {route.nom}
                    <Badge variant="outline" className="text-xs ml-auto">{zoneEleves.length} élèves</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="space-y-1.5">
                    {zoneEleves.map((eleve: any) => {
                      const isChecked = checkins.some(
                        (c: any) => c.eleve_id === eleve.id && c.type_trajet === currentTrajet && c.present
                      );
                      const isAbsent = checkins.some(
                        (c: any) => c.eleve_id === eleve.id && c.type_trajet === currentTrajet && !c.present
                      );

                      return (
                        <div key={eleve.id} className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              checkinMutation.mutate({
                                eleveId: eleve.id,
                                routeId: route.id,
                                arretId: route.arrets_transport?.[0]?.id || null,
                                present: !!checked,
                                trajet: currentTrajet,
                              });
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${isAbsent ? 'text-destructive line-through' : ''}`}>
                              {eleve.prenom} {eleve.nom}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{eleve.classes?.nom || '—'} • {eleve.matricule || '—'}</p>
                          </div>
                          {isChecked && <CheckCircle className="h-4 w-4 text-accent shrink-0" />}
                          {isAbsent && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Incidents */}
        <TabsContent value="incidents" className="mt-3 space-y-3">
          <Button className="w-full" variant="destructive" onClick={() => setShowIncident(true)}>
            <FileWarning className="h-4 w-4 mr-2" /> Signaler un incident
          </Button>

          {incidents.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                Aucun incident récent 🎉
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {incidents.map((inc: any) => (
                <Card key={inc.id} className={inc.statut === 'ouvert' ? 'border-warning/40' : ''}>
                  <CardContent className="pt-3 pb-3 px-3">
                    <div className="flex items-start gap-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        inc.gravite === 'critique' ? 'bg-destructive' :
                        inc.gravite === 'grave' ? 'bg-warning' :
                        inc.gravite === 'moyenne' ? 'bg-yellow-400' : 'bg-muted-foreground'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{inc.type_incident}</Badge>
                          <Badge variant={inc.statut === 'ouvert' ? 'destructive' : inc.statut === 'en_cours' ? 'secondary' : 'default'} className="text-[10px]">
                            {inc.statut}
                          </Badge>
                        </div>
                        <p className="text-sm mt-1">{inc.description}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(inc.created_at).toLocaleDateString('fr-FR')} •
                          {inc.lieu && ` ${inc.lieu} •`}
                          {(inc.routes_transport as any)?.nom || ''}
                        </p>
                        {inc.resolution && (
                          <p className="text-xs text-accent mt-1">✅ {inc.resolution}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Véhicule */}
        <TabsContent value="vehicule" className="mt-3 space-y-3">
          {vehicules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                <Truck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                Aucun véhicule assigné
              </CardContent>
            </Card>
          ) : vehicules.map((v: any) => (
            <Card key={v.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  {v.marque} {v.modele}
                  {v.couleur && <Badge variant="outline" className="text-xs">{v.couleur}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Immatriculation</p>
                    <p className="font-mono font-bold">{v.immatriculation}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Capacité</p>
                    <p className="font-bold">{v.capacite} places</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Zone</p>
                    <p>{(v.zones_transport as any)?.nom || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Année</p>
                    <p>{v.annee || '—'}</p>
                  </div>
                </div>

                {/* Alertes documents */}
                <div className="space-y-1.5">
                  {v.assurance_expire && (
                    <div className={`flex items-center gap-2 text-xs p-2 rounded ${
                      new Date(v.assurance_expire) < new Date() ? 'bg-destructive/10 text-destructive' : 'bg-muted'
                    }`}>
                      <Shield className="h-3.5 w-3.5" />
                      Assurance : {new Date(v.assurance_expire).toLocaleDateString('fr-FR')}
                      {new Date(v.assurance_expire) < new Date() && <Badge variant="destructive" className="text-[10px] ml-auto">Expirée</Badge>}
                    </div>
                  )}
                  {v.controle_technique_expire && (
                    <div className={`flex items-center gap-2 text-xs p-2 rounded ${
                      new Date(v.controle_technique_expire) < new Date() ? 'bg-destructive/10 text-destructive' : 'bg-muted'
                    }`}>
                      <Clock className="h-3.5 w-3.5" />
                      Contrôle technique : {new Date(v.controle_technique_expire).toLocaleDateString('fr-FR')}
                      {new Date(v.controle_technique_expire) < new Date() && <Badge variant="destructive" className="text-[10px] ml-auto">Expiré</Badge>}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Infos zones assignées */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Zones de desserte</CardTitle>
            </CardHeader>
            <CardContent>
              {routes.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{r.nom}</p>
                    <p className="text-xs text-muted-foreground">{(r.zones_transport as any)?.nom}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs">{r.arrets_transport?.length || 0} arrêts</p>
                    {(r.zones_transport as any)?.telephone_chauffeur && (
                      <a href={`tel:${(r.zones_transport as any).telephone_chauffeur}`} className="text-xs text-primary flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {(r.zones_transport as any).telephone_chauffeur}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Signaler incident */}
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
              <Input value={incidentForm.lieu} onChange={e => setIncidentForm(f => ({ ...f, lieu: e.target.value }))} placeholder="Ex: Carrefour Cosa, Km36…" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={incidentForm.description} onChange={e => setIncidentForm(f => ({ ...f, description: e.target.value }))} placeholder="Décrivez l'incident…" rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowIncident(false)}>Annuler</Button>
              <Button variant="destructive" onClick={() => incidentMutation.mutate()} disabled={incidentMutation.isPending}>
                <FileWarning className="h-4 w-4 mr-1" /> Signaler
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
