import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DollarSign, Check, Loader2, Banknote, PenTool, ClipboardList } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { format } from 'date-fns';
import { generateRecuAvancePDF } from '@/lib/generateRecuAvancePDF';

function fmtNum(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function TresorierAvances() {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: schoolConfig } = useSchoolConfig();
  const [payTarget, setPayTarget] = useState<any>(null);
  const [paying, setPaying] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: avances = [], isLoading } = useQuery({
    queryKey: ['avances-tresorier'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avances_salaire')
        .select('*, employes(nom, prenom, matricule, poste)')
        .in('statut', ['approuve', 'rembourse', 'paye'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: totalDemandes = 0 } = useQuery({
    queryKey: ['avances-total-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('avances_salaire')
        .select('id', { count: 'exact', head: true });
      return count || 0;
    },
  });

  const approuvees = avances.filter((a: any) => a.statut === 'approuve');
  const payees = avances.filter((a: any) => a.statut === 'paye' || a.statut === 'rembourse');
  const totalRestant = approuvees.reduce((s: number, a: any) => s + (Number(a.montant) - Number(a.montant_rembourse || 0)), 0);

  // Canvas helpers
  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    return { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
  };
  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    const pos = getPos(e, canvas);
    ctx.moveTo(pos.x, pos.y);
  };
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a1a2e';
    ctx.lineTo(pos.x, pos.y); ctx.stroke();
    setHasSignature(true);
  };
  const stopDraw = () => setIsDrawing(false);
  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const openPayDialog = (avance: any) => {
    setPayTarget(avance);
    setHasSignature(false);
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }, 100);
  };

  const handleConfirmPay = async () => {
    if (!payTarget || !hasSignature) return;
    setPaying(true);

    const signatureData = canvasRef.current?.toDataURL('image/png') || null;

    await supabase.from('avances_salaire').update({
      statut: 'paye',
      traite_par: user?.id,
      traite_at: new Date().toISOString(),
    }).eq('id', payTarget.id);

    if (payTarget.employe_id) {
      await supabase.from('employee_notifications').insert({
        employe_id: payTarget.employe_id,
        titre: '💰 Avance versée',
        message: `Votre avance de ${fmtNum(Number(payTarget.montant))} GNF a été versée. Elle sera déduite de votre prochain bulletin de paie.`,
        type: 'info',
      });
    }

    generateRecuAvancePDF({
      employe: {
        nom: payTarget.employes?.nom || '',
        prenom: payTarget.employes?.prenom || '',
        matricule: payTarget.employes?.matricule || '',
        poste: payTarget.employes?.poste || '',
      },
      montant: Number(payTarget.montant),
      motif: payTarget.motif,
      date: format(new Date(), 'dd/MM/yyyy HH:mm'),
      signatureEmploye: signatureData || undefined,
      schoolName: schoolConfig?.nom,
      schoolCity: schoolConfig?.ville,
      logoUrl: schoolConfig?.logo_url,
    });

    toast({ title: '✅ Avance payée', description: `Reçu généré pour ${payTarget.employes?.prenom} ${payTarget.employes?.nom}.` });
    qc.invalidateQueries({ queryKey: ['avances-tresorier'] });
    qc.invalidateQueries({ queryKey: ['avances-total-count'] });
    setPaying(false);
    setPayTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DollarSign className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestion des Avances</h1>
          <p className="text-sm text-muted-foreground">Avances validées par le personnel — prêtes pour le paiement</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4 text-center overflow-hidden">
            <ClipboardList className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-xl font-bold truncate">{totalDemandes}</div>
            <p className="text-xs text-muted-foreground">Total demandes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center overflow-hidden">
            <Check className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
            <div className="text-xl font-bold truncate">{approuvees.length}</div>
            <p className="text-xs text-muted-foreground">Approuvées pour paiement</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center overflow-hidden">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-destructive" />
            <div className="text-lg font-bold truncate">{fmtNum(totalRestant)} GNF</div>
            <p className="text-xs text-muted-foreground">Montant à verser</p>
          </CardContent>
        </Card>
      </div>

      {/* Liste des avances approuvées - prêtes pour paiement */}
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Banknote className="h-4 w-4" /> Avances approuvées — Procéder au paiement</CardTitle></CardHeader>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead>Matricule</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Date demande</TableHead>
                <TableHead>Date demande</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : approuvees.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune avance en attente de paiement</TableCell></TableRow>
              ) : approuvees.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.employes?.prenom} {a.employes?.nom}</TableCell>
                  <TableCell className="font-mono text-xs">{a.employes?.matricule}</TableCell>
                  <TableCell className="font-bold">{fmtNum(Number(a.montant))} GNF</TableCell>
                  <TableCell className="text-sm max-w-40 truncate">{a.motif || '—'}</TableCell>
                  <TableCell className="text-sm">{format(new Date(a.created_at), 'dd/MM/yyyy')}</TableCell>
                  <TableCell><Badge className="bg-amber-500 hover:bg-amber-600 text-white">Approuvé pour le paiement</Badge></TableCell>
                  <TableCell className="text-center">
                    <Button size="sm" onClick={() => openPayDialog(a)} className="bg-emerald-600 hover:bg-emerald-700">
                      <Banknote className="h-4 w-4 mr-1" /> Payer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Historique des avances payées */}
      {payees.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Avances payées — Suivi des remboursements</CardTitle></CardHeader>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Remboursé</TableHead>
                  <TableHead>Restant</TableHead>
                  <TableHead>Mois déduction</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payees.map((a: any) => {
                  const restant = Number(a.montant) - Number(a.montant_rembourse || 0);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.employes?.prenom} {a.employes?.nom}</TableCell>
                      <TableCell>{fmtNum(Number(a.montant))} GNF</TableCell>
                      <TableCell className="text-emerald-600">{fmtNum(Number(a.montant_rembourse || 0))} GNF</TableCell>
                      <TableCell className={`font-bold ${restant > 0 ? 'text-destructive' : 'text-emerald-600'}`}>{fmtNum(restant)} GNF</TableCell>
                      <TableCell className="text-sm">{a.mois_remboursement || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={a.statut === 'rembourse' ? 'default' : 'secondary'}>
                          {a.statut === 'rembourse' ? 'Remboursé' : 'Payé'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Signature Dialog */}
      <Dialog open={!!payTarget} onOpenChange={(open) => { if (!open) setPayTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5" /> Paiement d'avance — Signature
            </DialogTitle>
          </DialogHeader>
          {payTarget && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="font-semibold">{payTarget.employes?.prenom} {payTarget.employes?.nom}</p>
                <p className="text-sm text-muted-foreground">{payTarget.employes?.poste} — {payTarget.employes?.matricule}</p>
                <p className="text-lg font-bold mt-1 text-amber-600">{fmtNum(Number(payTarget.montant))} GNF</p>
                {payTarget.motif && <p className="text-sm text-muted-foreground mt-1">Motif: {payTarget.motif}</p>}
              </div>
              <p className="text-sm font-medium text-destructive">
                ⚠️ La signature de l'employé est obligatoire pour valider le paiement.
              </p>
              <p className="text-sm text-muted-foreground">
                L'employé doit signer ci-dessous comme preuve de réception. Un reçu sera généré automatiquement.
              </p>
              <div className="border-2 border-dashed rounded-lg p-1 bg-white">
                <canvas
                  ref={canvasRef}
                  width={380}
                  height={120}
                  className="cursor-crosshair touch-none w-full"
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={stopDraw}
                />
              </div>
              <Button variant="ghost" size="sm" onClick={clearSignature}>Effacer</Button>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setPayTarget(null)}>Annuler</Button>
            <Button
              onClick={handleConfirmPay}
              disabled={paying || !hasSignature}
              className="bg-emerald-600 hover:bg-emerald-700"
              title={!hasSignature ? "La signature de l'employé est obligatoire" : ''}
            >
              {paying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Confirmer le paiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
