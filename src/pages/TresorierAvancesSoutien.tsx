import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DollarSign, Check, Loader2, Banknote, PenTool, Search, Users, HandCoins } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { generateRecuAvancePDF } from '@/lib/generateRecuAvancePDF';

function fmtNum(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const SOUTIEN_CATS = ['hygiene', 'securite_primaire', 'securite_lycee', 'chauffeur', 'infirmiere', 'cantine', 'librairie', 'surveillant'] as const;

export default function TresorierAvancesSoutien() {
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get('employe_id') || '';
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: schoolConfig } = useSchoolConfig();

  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [montant, setMontant] = useState('');
  const [step, setStep] = useState<'list' | 'form' | 'sign'>('list');
  const [paying, setPaying] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch support staff employees
  const { data: employes = [], isLoading: loadingEmp } = useQuery({
    queryKey: ['employes-soutien'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employes')
        .select('id, nom, prenom, poste, categorie, matricule, salaire_base, statut')
        .eq('statut', 'actif')
        .in('categorie', SOUTIEN_CATS)
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing avances for these employees
  const { data: avancesSoutien = [] } = useQuery({
    queryKey: ['avances-soutien'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avances_salaire')
        .select('*, employes(nom, prenom, matricule, poste, categorie)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).filter((a: any) => SOUTIEN_CATS.includes(a.employes?.categorie));
    },
  });

  const avancesPayees = avancesSoutien.filter((a: any) => a.statut === 'paye' || a.statut === 'rembourse');
  const avancesEnCours = avancesSoutien.filter((a: any) => a.statut === 'approuve');

  // No pre-selection effect needed; user clicks from the list

  const filtered = employes.filter((e: any) =>
    `${e.nom} ${e.prenom} ${e.poste}`.toLowerCase().includes(search.toLowerCase())
  );

  const catLabels: Record<string, string> = {
    hygiene: '🧹 Hygiène', securite_primaire: '🛡️ Sécu. Primaire', securite_lycee: '🛡️ Sécu. Lycée',
    chauffeur: '🚗 Chauffeur', infirmiere: '🏥 Infirmière', cantine: '🍽️ Cantine',
    librairie: '📚 Librairie', surveillant: '👁️ Surveillant',
  };

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

  const handleSelectEmp = (emp: any) => {
    setSelectedEmp(emp);
    setMontant('');
    setStep('form');
  };

  const handleProceedToSign = () => {
    if (!montant || Number(montant) <= 0) {
      toast({ title: 'Montant requis', description: 'Veuillez saisir un montant valide.', variant: 'destructive' });
      return;
    }
    setStep('sign');
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
    if (!selectedEmp || !hasSignature || !montant) return;
    setPaying(true);

    const signatureData = canvasRef.current?.toDataURL('image/png') || null;

    // Create the advance directly as 'paye' (approved + paid in one step by treasurer)
    const { error } = await supabase.from('avances_salaire').insert({
      employe_id: selectedEmp.id,
      montant: Number(montant),
      motif: 'Avance service soutien — validée par le trésorier',
      statut: 'paye',
      traite_par: user?.id,
      traite_at: new Date().toISOString(),
    });

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      setPaying(false);
      return;
    }

    // Notify the employee
    await supabase.from('employee_notifications').insert({
      employe_id: selectedEmp.id,
      titre: '💰 Avance versée',
      message: `Une avance de ${fmtNum(Number(montant))} GNF vous a été versée. Elle sera déduite de votre prochain bulletin de paie.`,
      type: 'info',
    });

    // Generate receipt PDF
    generateRecuAvancePDF({
      employe: {
        nom: selectedEmp.nom,
        prenom: selectedEmp.prenom,
        matricule: selectedEmp.matricule,
        poste: selectedEmp.poste,
      },
      montant: Number(montant),
      motif: undefined,
      date: format(new Date(), 'dd/MM/yyyy HH:mm'),
      signatureEmploye: signatureData || undefined,
      schoolName: schoolConfig?.nom,
      schoolCity: schoolConfig?.ville,
      logoUrl: schoolConfig?.logo_url,
    });

    toast({ title: '✅ Avance versée et signée', description: `Reçu généré pour ${selectedEmp.prenom} ${selectedEmp.nom}.` });
    qc.invalidateQueries({ queryKey: ['avances-soutien'] });
    qc.invalidateQueries({ queryKey: ['avances-tresorier'] });
    qc.invalidateQueries({ queryKey: ['avances-total-count'] });
    setPaying(false);
    setSelectedEmp(null);
    setMontant('');
    setStep('list');
  };

  return (
    <div className="space-y-6 p-2 sm:p-4">
      <div className="flex items-center gap-3">
        <HandCoins className="h-7 w-7 text-amber-600" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Avances — Service de Soutien</h1>
          <p className="text-sm text-muted-foreground">Validation directe des avances pour le personnel de soutien (hygiène, sécurité, chauffeurs...)</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-3">
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-amber-600" />
            <div className="text-xl font-bold">{employes.length}</div>
            <p className="text-xs text-muted-foreground">Personnel soutien</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-4 text-center">
            <Check className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
            <div className="text-xl font-bold">{avancesPayees.length}</div>
            <p className="text-xs text-muted-foreground">Avances versées</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-blue-600" />
            <div className="text-xl font-bold">{avancesEnCours.length}</div>
            <p className="text-xs text-muted-foreground">En cours</p>
          </CardContent>
        </Card>
      </div>

      {step === 'list' && (
        <>
          {/* Search */}
          <Card>
            <CardContent className="pt-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher un employé..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
            </CardContent>
          </Card>

          {/* Employee List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" /> Cliquez sur un nom pour créer une avance
              </CardTitle>
            </CardHeader>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom & Prénom</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Poste</TableHead>
                    <TableHead className="text-right">Salaire</TableHead>
                    <TableHead className="text-center">Avances</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingEmp ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun employé trouvé</TableCell></TableRow>
                  ) : filtered.map((emp: any) => {
                    const empAvances = avancesSoutien.filter((a: any) => a.employe_id === emp.id && (a.statut === 'paye' || a.statut === 'approuve'));
                    return (
                      <TableRow
                        key={emp.id}
                        className="cursor-pointer hover:bg-amber-50/50 dark:hover:bg-amber-950/10 transition-colors"
                        onClick={() => handleSelectEmp(emp)}
                      >
                        <TableCell className="font-medium">{emp.prenom} {emp.nom}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{catLabels[emp.categorie] || emp.categorie}</Badge></TableCell>
                        <TableCell className="text-sm">{emp.poste}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmtNum(Number(emp.salaire_base))} GNF</TableCell>
                        <TableCell className="text-center">
                          {empAvances.length > 0 ? (
                            <Badge variant="secondary" className="text-xs">{empAvances.length} avance(s)</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}

      {step === 'form' && selectedEmp && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Banknote className="h-5 w-5 text-amber-600" /> Nouvelle avance pour {selectedEmp.prenom} {selectedEmp.nom}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="font-semibold">{selectedEmp.prenom} {selectedEmp.nom}</p>
              <p className="text-sm text-muted-foreground">{catLabels[selectedEmp.categorie] || selectedEmp.categorie} — {selectedEmp.poste}</p>
              <p className="text-sm">Matricule: <strong className="font-mono">{selectedEmp.matricule}</strong></p>
              <p className="text-sm">Salaire: <strong>{fmtNum(Number(selectedEmp.salaire_base))} GNF</strong></p>
            </div>
            <div className="space-y-2">
              <Label className="text-base font-medium">Montant de l'avance (GNF)</Label>
              <Input
                type="number"
                value={montant}
                onChange={e => setMontant(e.target.value)}
                placeholder="Ex: 200000"
                className="text-lg font-mono"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setStep('list'); setSelectedEmp(null); }}>
                ← Retour à la liste
              </Button>
              <Button
                onClick={handleProceedToSign}
                disabled={!montant || Number(montant) <= 0}
                className="bg-amber-600 hover:bg-amber-700 flex-1"
              >
                <PenTool className="h-4 w-4 mr-2" /> Procéder à la signature
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'sign' && selectedEmp && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PenTool className="h-5 w-5" /> Signature — Validation de l'avance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="font-semibold">{selectedEmp.prenom} {selectedEmp.nom}</p>
              <p className="text-sm text-muted-foreground">{catLabels[selectedEmp.categorie] || selectedEmp.categorie} — {selectedEmp.matricule}</p>
              <p className="text-lg font-bold mt-1 text-amber-600">{fmtNum(Number(montant))} GNF</p>
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
                width={400}
                height={130}
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
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={clearSignature}>Effacer</Button>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('form')}>
                ← Retour
              </Button>
              <Button
                onClick={handleConfirmPay}
                disabled={paying || !hasSignature}
                className="bg-emerald-600 hover:bg-emerald-700 flex-1"
                title={!hasSignature ? "La signature est obligatoire" : ''}
              >
                {paying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                Confirmer le paiement
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {avancesPayees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Historique des avances versées — Service de soutien</CardTitle>
          </CardHeader>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {avancesPayees.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.employes?.prenom} {a.employes?.nom}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{catLabels[a.employes?.categorie] || a.employes?.categorie}</Badge></TableCell>
                    <TableCell className="font-bold">{fmtNum(Number(a.montant))} GNF</TableCell>
                    <TableCell className="text-sm">{a.traite_at ? format(new Date(a.traite_at), 'dd/MM/yyyy') : format(new Date(a.created_at), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant={a.statut === 'rembourse' ? 'default' : 'secondary'}>
                        {a.statut === 'rembourse' ? '✅ Remboursé' : '💰 Payée'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
