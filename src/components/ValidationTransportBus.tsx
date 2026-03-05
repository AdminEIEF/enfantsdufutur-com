import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bus, CheckCircle, XCircle, ScanLine, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import QRScannerDialog from '@/components/QRScannerDialog';

export default function ValidationTransportBus() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualSearch, setManualSearch] = useState('');

  // Validations d'aujourd'hui
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

      // Récupérer l'élève pour la zone
      const { data: eleve } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, zone_transport_id')
        .eq('id', eleveId)
        .single();

      if (!eleve) throw new Error('Élève introuvable');

      // Vérifier si déjà validé aujourd'hui
      const { data: existing } = await supabase
        .from('validations_transport')
        .select('id')
        .eq('eleve_id', eleveId)
        .gte('validated_at', `${today}T00:00:00`)
        .lte('validated_at', `${today}T23:59:59`);

      if ((existing as any[])?.length > 0) {
        return { eleve, status: 'already', message: 'Déjà validé aujourd\'hui' };
      }

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
        message: isValid ? 'Accès autorisé' : 'Carte expirée — Accès refusé',
        recharge,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['validations-transport'] });
      if (result.status === 'valid') {
        // Beep sonore
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          osc.frequency.value = 800;
          osc.connect(ctx.destination);
          osc.start();
          setTimeout(() => osc.stop(), 150);
        } catch {}
        toast({ title: '✅ Validé', description: `${result.eleve.prenom} ${result.eleve.nom} — Accès autorisé` });
      } else if (result.status === 'already') {
        toast({ title: 'ℹ️ Déjà scanné', description: `${result.eleve.prenom} ${result.eleve.nom} a déjà été validé aujourd'hui` });
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
      // Essayer comme matricule
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

  return (
    <div className="space-y-4">
      {/* Zone scan */}
      <Card className="border-primary/30">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <Button size="lg" className="gap-2 text-lg px-8" onClick={() => setScannerOpen(true)}>
              <ScanLine className="h-6 w-6" /> Scanner une carte
            </Button>
            <div className="text-muted-foreground">ou</div>
            <div className="flex gap-2 flex-1 max-w-md">
              <Input
                placeholder="Saisir le matricule…"
                value={manualSearch}
                onChange={e => setManualSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManualValidation(manualSearch)}
              />
              <Button variant="outline" onClick={() => handleManualValidation(manualSearch)}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats du jour */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <Bus className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Passages aujourd'hui</p>
              <p className="text-2xl font-bold">{validations.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-accent" />
            <div>
              <p className="text-sm text-muted-foreground">Validés</p>
              <p className="text-2xl font-bold text-accent">{validCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">Refusés</p>
              <p className="text-2xl font-bold text-destructive">{rejectCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historique du jour */}
      <Card>
        <CardHeader><CardTitle className="text-base">Historique du jour — {new Date().toLocaleDateString('fr-FR')}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Heure</TableHead>
                <TableHead>Élève</TableHead>
                <TableHead>Matricule</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead className="text-center">Statut</TableHead>
                <TableHead>Motif</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {validations.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun passage enregistré</TableCell></TableRow>
              ) : validations.map((v: any) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-xs">
                    {new Date(v.validated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell className="font-medium">{v.eleves?.prenom} {v.eleves?.nom}</TableCell>
                  <TableCell className="font-mono text-xs">{v.eleves?.matricule || '—'}</TableCell>
                  <TableCell>{v.eleves?.classes?.nom || '—'}</TableCell>
                  <TableCell>{(v.eleves?.zones_transport as any)?.nom || '—'}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={v.valide ? 'default' : 'destructive'}>
                      {v.valide ? '✅ Validé' : '❌ Refusé'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{v.motif_rejet || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <QRScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onScan={handleScan} title="Scanner carte transport" />
    </div>
  );
}
