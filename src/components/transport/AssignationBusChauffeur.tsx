import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Bus, User, LinkIcon, Unlink, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export default function AssignationBusChauffeur() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [assignDialog, setAssignDialog] = useState<{ vehiculeId: string; vehiculeNom: string } | null>(null);
  const [selectedChauffeur, setSelectedChauffeur] = useState('');

  // Véhicules avec chauffeur assigné
  const { data: vehicules = [], isLoading } = useQuery({
    queryKey: ['vehicules-assignation'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicules_transport')
        .select('*, employes:chauffeur_id(id, nom, prenom, matricule, telephone), zones_transport:zone_transport_id(nom)')
        .order('immatriculation');
      if (error) throw error;
      return data;
    },
  });

  // Chauffeurs disponibles
  const { data: chauffeurs = [] } = useQuery({
    queryKey: ['chauffeurs-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employes')
        .select('id, nom, prenom, matricule, telephone')
        .eq('statut', 'actif')
        .ilike('poste', '%chauffeur%')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  // Assigner un chauffeur
  const assignMutation = useMutation({
    mutationFn: async ({ vehiculeId, chauffeurId }: { vehiculeId: string; chauffeurId: string | null }) => {
      const { error } = await supabase
        .from('vehicules_transport')
        .update({ chauffeur_id: chauffeurId, updated_at: new Date().toISOString() })
        .eq('id', vehiculeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicules-assignation'] });
      toast({ title: 'Assignation mise à jour' });
      setAssignDialog(null);
      setSelectedChauffeur('');
    },
    onError: (err: any) => {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    },
  });

  // IDs des chauffeurs déjà assignés
  const assignedChauffeurIds = vehicules
    .filter((v: any) => v.chauffeur_id)
    .map((v: any) => v.chauffeur_id);

  const availableChauffeurs = chauffeurs.filter(
    (c: any) => !assignedChauffeurIds.includes(c.id)
  );

  const vehiculesActifs = vehicules.filter((v: any) => v.actif);
  const vehiculesAssignes = vehiculesActifs.filter((v: any) => v.chauffeur_id);
  const vehiculesLibres = vehiculesActifs.filter((v: any) => !v.chauffeur_id);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <Bus className="h-7 w-7 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Véhicules actifs</p>
              <p className="text-xl font-bold">{vehiculesActifs.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <CheckCircle2 className="h-7 w-7 text-accent" />
            <div>
              <p className="text-xs text-muted-foreground">Assignés</p>
              <p className="text-xl font-bold">{vehiculesAssignes.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <AlertTriangle className="h-7 w-7 text-warning" />
            <div>
              <p className="text-xs text-muted-foreground">Sans chauffeur</p>
              <p className="text-xl font-bold">{vehiculesLibres.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LinkIcon className="h-4 w-4" /> Assignation Bus ↔ Chauffeur
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Véhicule</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Capacité</TableHead>
                <TableHead>Chauffeur assigné</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Chargement…</TableCell>
                </TableRow>
              ) : vehicules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun véhicule enregistré</TableCell>
                </TableRow>
              ) : vehicules.map((v: any) => {
                const chauffeur = v.employes;
                const zone = v.zones_transport;
                return (
                  <TableRow key={v.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{v.immatriculation}</p>
                        <p className="text-xs text-muted-foreground">
                          {[v.marque, v.modele, v.annee].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {zone ? <Badge variant="outline">{zone.nom}</Badge> : <span className="text-muted-foreground text-sm">—</span>}
                    </TableCell>
                    <TableCell className="text-center">{v.capacite || '—'}</TableCell>
                    <TableCell>
                      {chauffeur ? (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" />
                          <div>
                            <p className="font-medium text-sm">{chauffeur.prenom} {chauffeur.nom}</p>
                            <p className="text-xs text-muted-foreground">{chauffeur.matricule}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm italic">Non assigné</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{chauffeur?.telephone || '—'}</TableCell>
                    <TableCell>
                      {!v.actif ? (
                        <Badge variant="secondary">Inactif</Badge>
                      ) : chauffeur ? (
                        <Badge className="bg-accent/20 text-accent hover:bg-accent/20">Assigné</Badge>
                      ) : (
                        <Badge variant="destructive">Libre</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant={chauffeur ? 'outline' : 'default'}
                          onClick={() => {
                            setAssignDialog({ vehiculeId: v.id, vehiculeNom: `${v.immatriculation} ${v.marque || ''}`.trim() });
                            setSelectedChauffeur(v.chauffeur_id || '');
                          }}
                        >
                          <LinkIcon className="h-3.5 w-3.5 mr-1" />
                          {chauffeur ? 'Modifier' : 'Assigner'}
                        </Button>
                        {chauffeur && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => assignMutation.mutate({ vehiculeId: v.id, chauffeurId: null })}
                          >
                            <Unlink className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog d'assignation */}
      <Dialog open={!!assignDialog} onOpenChange={() => { setAssignDialog(null); setSelectedChauffeur(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bus className="h-5 w-5 text-primary" />
              Assigner un chauffeur — {assignDialog?.vehiculeNom}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sélectionner un chauffeur</label>
              <Select value={selectedChauffeur} onValueChange={setSelectedChauffeur}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un chauffeur…" />
                </SelectTrigger>
                <SelectContent>
                  {availableChauffeurs.length === 0 && !selectedChauffeur ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Tous les chauffeurs sont déjà assignés</div>
                  ) : null}
                  {chauffeurs.map((c: any) => {
                    const isAssigned = assignedChauffeurIds.includes(c.id) && c.id !== selectedChauffeur;
                    return (
                      <SelectItem key={c.id} value={c.id} disabled={isAssigned}>
                        {c.prenom} {c.nom} ({c.matricule}){isAssigned ? ' — déjà assigné' : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {selectedChauffeur && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4 text-sm">
                  {(() => {
                    const c = chauffeurs.find((ch: any) => ch.id === selectedChauffeur) as any;
                    if (!c) return null;
                    return (
                      <div className="flex items-center gap-3">
                        <User className="h-8 w-8 text-primary" />
                        <div>
                          <p className="font-medium">{c.prenom} {c.nom}</p>
                          <p className="text-xs text-muted-foreground">Matricule: {c.matricule} · Tél: {c.telephone || '—'}</p>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAssignDialog(null); setSelectedChauffeur(''); }}>
              Annuler
            </Button>
            <Button
              disabled={!selectedChauffeur || assignMutation.isPending}
              onClick={() => {
                if (assignDialog && selectedChauffeur) {
                  assignMutation.mutate({ vehiculeId: assignDialog.vehiculeId, chauffeurId: selectedChauffeur });
                }
              }}
            >
              {assignMutation.isPending ? 'En cours…' : 'Confirmer l\'assignation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
