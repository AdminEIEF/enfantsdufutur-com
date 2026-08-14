import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Banknote, PenTool, FileText, Loader2, Check, Search, Users, ChevronDown, Printer, Download, AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { generateRegistrePaiePDF } from '@/lib/generateRegistrePaiePDF';
import { generateBulletinPaiePDF } from '@/lib/generateBulletinPaiePDF';
import { downloadListePersonnelPDF, printListePersonnelPDF } from '@/lib/generateListePersonnelPDF';

const CATEGORIES = [
  { value: 'all', label: 'Toutes les catégories' },
  { value: 'enseignant_primaire', label: '👨‍🏫 Enseignant Primaire' },
  { value: 'enseignant_secondaire', label: '👨‍🏫 Enseignant Secondaire' },
  { value: 'administration', label: '🏢 Administration' },
  { value: 'service', label: '🔧 Service' },
  { value: 'direction', label: '👔 Direction' },
  { value: 'hygiene', label: '🧹 Service Hygiène' },
  { value: 'securite_primaire', label: '🛡️ Sécurité Primaire' },
  { value: 'securite_lycee', label: '🛡️ Sécurité Lycée' },
  { value: 'chauffeur', label: '🚗 Chauffeur' },
  { value: 'infirmiere', label: '🏥 Infirmière' },
  { value: 'librairie', label: '📚 Librairie' },
  { value: 'cantine', label: '🍽️ Cantine' },
  { value: 'surveillant', label: '👁️ Surveillant' },
];

interface Employe {
  id: string;
  nom: string;
  prenom: string;
  poste: string;
  categorie: string;
  matricule: string;
  salaire_base: number;
  prix_heure: number;
  statut: string;
  salaire_calcule?: number; // computed salary for secondary teachers
  heures_mensuelles?: number;
}

const getEffectiveCat = (e: Employe) => e.categorie === 'enseignant'
  ? (e.matricule?.startsWith('ESC') ? 'enseignant_secondaire' : 'enseignant_primaire')
  : e.categorie;

interface PaiementRecord {
  id: string;
  employe_id: string;
  montant: number;
  date_paiement: string;
  mois: number;
  annee: number;
  signature_employe?: string | null;
}

function fmtNum(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const FILTER_MODES: Record<string, { label: string; cats: string[] }> = {
  secondaire: { label: 'Salaires — Enseignants Secondaire', cats: ['enseignant_secondaire'] },
  primaire: { label: 'Salaires — Enseignants Primaire', cats: ['enseignant_primaire'] },
  soutien: { label: 'Salaires — Service de soutien', cats: ['hygiene', 'securite_primaire', 'securite_lycee', 'chauffeur', 'infirmiere', 'cantine', 'librairie', 'surveillant'] },
  admin: { label: 'Salaires — Administration & Direction', cats: ['administration', 'direction', 'service'] },
};

const SOUTIEN_CATS = ['hygiene', 'securite_primaire', 'securite_lycee', 'chauffeur', 'infirmiere', 'cantine', 'librairie', 'surveillant'];

export default function TresorierGestionSalaires() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || '';
  const filterMode = FILTER_MODES[mode] || null;
  const [employes, setEmployes] = useState<Employe[]>([]);
  const [paiements, setPaiements] = useState<PaiementRecord[]>([]);
  const [avancesSoutien, setAvancesSoutien] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [categorie, setCategorie] = useState('all');
  const [search, setSearch] = useState('');
  const [currentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear] = useState(new Date().getFullYear());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const empCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isEmpDrawing, setIsEmpDrawing] = useState(false);
  const [hasEmpSignature, setHasEmpSignature] = useState(false);
  const [signDialog, setSignDialog] = useState<Employe | null>(null);
  const [deduireAvance, setDeduireAvance] = useState(true);
  const [dialogAvanceTotal, setDialogAvanceTotal] = useState(0);
  const [montantDeduction, setMontantDeduction] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: schoolConfig } = useSchoolConfig();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [empRes, paiRes, edtRes, avRes] = await Promise.all([
      supabase.from('employes').select('id, nom, prenom, poste, categorie, matricule, salaire_base, prix_heure, statut').eq('statut', 'actif'),
      supabase.from('paiements_tresorier').select('*').eq('mois', currentMonth).eq('annee', currentYear),
      supabase.from('emploi_du_temps').select('enseignant_id, heure_debut, heure_fin, jour_semaine'),
      supabase.from('avances_salaire').select('employe_id, montant, statut').eq('statut', 'paye'),
    ]);

    // Calculate weekly hours per teacher from emploi_du_temps
    const heuresParEnseignant: Record<string, number> = {};
    if (edtRes.data) {
      for (const slot of edtRes.data) {
        if (!slot.enseignant_id) continue;
        const [hd, md] = slot.heure_debut.split(':').map(Number);
        const [hf, mf] = slot.heure_fin.split(':').map(Number);
        const duree = (hf + mf / 60) - (hd + md / 60);
        if (duree > 0) {
          heuresParEnseignant[slot.enseignant_id] = (heuresParEnseignant[slot.enseignant_id] || 0) + duree;
        }
      }
    }

    if (empRes.data) {
      const enriched = empRes.data.map(emp => {
        const isSecondaire = emp.categorie === 'enseignant' && emp.matricule?.startsWith('ESC');
        if (isSecondaire && emp.prix_heure > 0) {
          const heuresHebdo = heuresParEnseignant[emp.id] || 0;
          // Monthly = weekly hours × ~4.33 weeks
          const heuresMensuelles = Math.round(heuresHebdo * 4.33 * 100) / 100;
          const salaireCalc = Math.round(heuresMensuelles * emp.prix_heure);
          return { ...emp, salaire_calcule: salaireCalc, heures_mensuelles: heuresMensuelles };
        }
        return { ...emp, salaire_calcule: emp.salaire_base, heures_mensuelles: undefined };
      });
      setEmployes(enriched);
    }
    if (paiRes.data) setPaiements(paiRes.data as PaiementRecord[]);
    if (avRes.data) setAvancesSoutien(avRes.data);
    setLoading(false);
  }, [currentMonth, currentYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openPayDialog = (emp: Employe) => {
    setSignDialog(emp);
    setHasEmpSignature(false);
    setDeduireAvance(true);
    const totalAv = avancesSoutien
      .filter(a => a.employe_id === emp.id)
      .reduce((sum: number, a: any) => sum + Number(a.montant), 0);
    setDialogAvanceTotal(totalAv);
    setMontantDeduction(totalAv);
    setTimeout(() => {
      const canvas = empCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }, 100);
  };

  const handleConfirmPay = async () => {
    if (!signDialog || !hasEmpSignature) return;
    const emp = signDialog;
    const salaire = emp.salaire_calcule || emp.salaire_base;
    setPaying(emp.id);

    const signatureData = empCanvasRef.current?.toDataURL('image/png') || null;

    // Montant effectif (avec ou sans déduction d'avance)
    const montantPaye = deduireAvance && montantDeduction > 0 ? salaire - montantDeduction : salaire;

    const { error } = await supabase.from('paiements_tresorier').insert({
      employe_id: emp.id,
      montant: salaire,
      mois: currentMonth,
      annee: currentYear,
      paye_par: user?.id,
      signature_employe: signatureData,
    } as any);

    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      setPaying(null);
      setSignDialog(null);
      return;
    }

    // Auto-generate bulletin de paie — fetch all non-remboursé avances
    const { data: pendingAvances } = await supabase
      .from('avances_salaire')
      .select('id, montant, montant_rembourse, statut')
      .eq('employe_id', emp.id)
      .in('statut', ['approuve', 'paye']);

    let totalAvancesDeduites = 0;
    const avancesToUpdate: { id: string; deduction: number }[] = [];

    if (deduireAvance && montantDeduction > 0 && pendingAvances && pendingAvances.length > 0) {
      let restADeduire = montantDeduction;
      for (const av of pendingAvances) {
        if (restADeduire <= 0) break;
        const remaining = Number(av.montant) - Number(av.montant_rembourse);
        if (remaining > 0) {
          const deduction = Math.min(remaining, restADeduire);
          totalAvancesDeduites += deduction;
          avancesToUpdate.push({ id: av.id, deduction });
          restADeduire -= deduction;
        }
      }
    }

    const salaireNet = salaire - totalAvancesDeduites;

    await supabase.from('bulletins_paie').upsert({
      employe_id: emp.id,
      mois: currentMonth,
      annee: currentYear,
      salaire_brut: salaire,
      retenues: 0,
      avances_deduites: totalAvancesDeduites,
      primes: 0,
      salaire_net: salaireNet,
      commentaire: null,
      genere_par: user?.id,
      signature_employe: signatureData,
    } as any, { onConflict: 'employe_id,mois,annee' });

    for (const av of avancesToUpdate) {
      const { data: avData } = await supabase.from('avances_salaire').select('montant, montant_rembourse').eq('id', av.id).single();
      if (avData) {
        const newRembourse = Number(avData.montant_rembourse) + av.deduction;
        await supabase.from('avances_salaire').update({
          montant_rembourse: newRembourse,
          mois_remboursement: `${currentMonth}/${currentYear}`,
          statut: newRembourse >= Number(avData.montant) ? 'rembourse' : 'approuve',
        }).eq('id', av.id);
      }
    }

    await supabase.from('employee_notifications').insert({
      employe_id: emp.id,
      titre: '💰 Bulletin de paie disponible',
      message: `Votre bulletin de paie est disponible. Salaire net: ${fmtNum(salaireNet)} GNF.${totalAvancesDeduites > 0 ? ` (Avances déduites: ${fmtNum(totalAvancesDeduites)} GNF)` : ''}`,
      type: 'info',
    });

    // Auto-generate receipt PDF
    const resteAvance = dialogAvanceTotal - totalAvancesDeduites;

    generateBulletinPaiePDF({
      employe: {
        nom: emp.nom, prenom: emp.prenom, matricule: emp.matricule,
        poste: emp.poste, categorie: emp.categorie,
      },
      mois: currentMonth, annee: currentYear,
      salaire_brut: salaire, primes: 0, retenues: 0,
      avances_deduites: totalAvancesDeduites, salaire_net: salaireNet,
      avance_totale: dialogAvanceTotal,
      reste_avance: resteAvance > 0 ? resteAvance : 0,
      schoolName: schoolConfig?.nom, schoolCity: schoolConfig?.ville, logoUrl: schoolConfig?.logo_url,
      signatureEmploye: signatureData || undefined,
    });

    toast({ title: 'Paiement enregistré', description: `${emp.prenom} ${emp.nom} a été payé. Bulletin et reçu générés.` });
    fetchData();
    setPaying(null);
    setSignDialog(null);
  };

  const isPaid = (empId: string) => paiements.some(p => p.employe_id === empId);
  const hasSigned = (empId: string) => paiements.some(p => p.employe_id === empId && p.signature_employe);

  const filtered = employes.filter(e => {
    const effCat = getEffectiveCat(e);
    // If a filter mode is active, only show those categories
    if (filterMode && !filterMode.cats.includes(effCat)) return false;
    const matchCat = categorie === 'all' || effCat === categorie;
    const matchSearch = `${e.nom} ${e.prenom} ${e.poste}`.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const nbPaye = filtered.filter(e => isPaid(e.id)).length;

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

  const startEmpDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = empCanvasRef.current;
    if (!canvas) return;
    setIsEmpDrawing(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    const pos = getPos(e, canvas);
    ctx.moveTo(pos.x, pos.y);
  };
  const drawEmp = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isEmpDrawing) return;
    const canvas = empCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a1a2e';
    ctx.lineTo(pos.x, pos.y); ctx.stroke();
    setHasEmpSignature(true);
  };
  const stopEmpDraw = () => setIsEmpDrawing(false);
  const clearEmpSignature = () => {
    const canvas = empCanvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasEmpSignature(false);
  };

  const handleGeneratePDF = () => {
    const signatureDataUrl = hasSignature ? canvasRef.current?.toDataURL('image/png') : undefined;
    const paidEmployees = filtered.filter(e => isPaid(e.id)).map(e => {
      const p = paiements.find(p => p.employe_id === e.id);
      return {
        nom: e.nom, prenom: e.prenom, poste: e.poste, categorie: e.categorie,
        montant: e.salaire_calcule || e.salaire_base,
        datePaiement: p?.date_paiement || new Date().toISOString(),
        signatureEmploye: p?.signature_employe || undefined,
      };
    });
    generateRegistrePaiePDF(paidEmployees, currentMonth, currentYear, signatureDataUrl);
    toast({ title: 'PDF généré', description: 'Le registre de paie a été téléchargé.' });
  };

  const getListePDFOptions = () => {
    const catLabel = categorie !== 'all'
      ? CATEGORIES.find(c => c.value === categorie)?.label || categorie
      : filterMode ? filterMode.label : 'Tout le personnel';
    return {
      title: catLabel,
      schoolName: schoolConfig?.nom || 'Ecole Internationale Les Enfants du Futur',
      logoUrl: schoolConfig?.logo_url,
      employes: filtered.map(e => ({
        nom: e.nom,
        prenom: e.prenom,
        poste: e.poste,
        salaire_base: e.salaire_calcule || e.salaire_base,
        matricule: e.matricule,
      })),
      mois: format(new Date(), 'MMMM yyyy', { locale: fr }),
    };
  };

  const handleDownloadListe = () => {
    downloadListePersonnelPDF(getListePDFOptions());
    toast({ title: 'PDF téléchargé', description: 'La liste du personnel a été générée.' });
  };

  const handlePrintListe = () => {
    printListePersonnelPDF(getListePDFOptions());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2 sm:p-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Banknote className="h-7 w-7 text-emerald-600" />
          <h1 className="text-2xl font-bold">{filterMode ? filterMode.label : 'Gestion Salaires'} — {format(new Date(), 'MMMM yyyy', { locale: fr })}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrintListe}>
            <Printer className="h-4 w-4 mr-1" /> Imprimer
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadListe}>
            <Download className="h-4 w-4 mr-1" /> Télécharger PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher un employé..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={categorie} onValueChange={setCategorie}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Collapsible defaultOpen>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><Users className="h-4 w-4" /> Liste du personnel</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{nbPaye} payé(s) / {filtered.length}</Badge>
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=closed]:rotate-[-90deg]" />
                </div>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom & Prénom</TableHead>
                    <TableHead>Poste</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-right">Salaire</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(emp => {
                    const paid = isPaid(emp.id);
                    const signed = hasSigned(emp.id);
                    const paiement = paiements.find(p => p.employe_id === emp.id);
                    return (
                      <TableRow key={emp.id} className={paid ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : ''}>
                        <TableCell className="font-medium">{emp.prenom} {emp.nom}</TableCell>
                        <TableCell>{emp.poste}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{CATEGORIES.find(c => c.value === getEffectiveCat(emp))?.label || emp.categorie}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {fmtNum(emp.salaire_calcule || emp.salaire_base)} GNF
                          {emp.heures_mensuelles != null && (
                            <div className="text-[10px] text-muted-foreground font-normal">{emp.heures_mensuelles}h × {fmtNum(emp.prix_heure)} GNF/h</div>
                          )}
                          {SOUTIEN_CATS.includes(emp.categorie) && (() => {
                            const totalAvance = avancesSoutien
                              .filter(a => a.employe_id === emp.id)
                              .reduce((sum: number, a: any) => sum + Number(a.montant), 0);
                            return totalAvance > 0 ? (
                              <div className="text-xs text-destructive font-semibold mt-0.5">− {fmtNum(totalAvance)} GNF avancé</div>
                            ) : null;
                          })()}
                        </TableCell>
                        <TableCell>
                          {paid ? (
                            <div className="flex flex-col gap-1">
                              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                <Check className="h-3 w-3 mr-1" /> Payé
                              </Badge>
                              {signed && (
                                <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700">
                                  <PenTool className="h-2.5 w-2.5 mr-1" /> Signé
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <Badge variant="destructive">En attente</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {paid ? (
                            <div className="text-xs text-muted-foreground">
                              {paiement && format(new Date(paiement.date_paiement), 'dd/MM/yyyy HH:mm')}
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => openPayDialog(emp)}
                              disabled={paying === emp.id}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              {paying === emp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4 mr-1" />}
                              Payer
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun employé trouvé</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Signature & PDF */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PenTool className="h-5 w-5" /> Signature du Trésorier
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-1 inline-block bg-white">
            <canvas
              ref={canvasRef}
              width={400}
              height={150}
              className="cursor-crosshair touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={clearSignature}>Effacer la signature</Button>
            <Button
              onClick={handleGeneratePDF}
              disabled={nbPaye === 0}
              className="bg-primary hover:bg-primary/90"
            >
              <FileText className="h-4 w-4 mr-2" /> Générer le Registre de Paie PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Employee Signature Dialog */}
      <Dialog open={!!signDialog} onOpenChange={(open) => { if (!open) setSignDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5" /> Signature de l'employé
            </DialogTitle>
          </DialogHeader>
          {signDialog && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="font-semibold">{signDialog.prenom} {signDialog.nom}</p>
                <p className="text-sm text-muted-foreground">{signDialog.poste} — {CATEGORIES.find(c => c.value === getEffectiveCat(signDialog))?.label || signDialog.categorie}</p>
                <p className="text-lg font-bold mt-1">{fmtNum(signDialog.salaire_calcule || signDialog.salaire_base)} GNF</p>
                {signDialog.heures_mensuelles != null && (
                  <p className="text-xs text-muted-foreground">{signDialog.heures_mensuelles}h/mois × {fmtNum(signDialog.prix_heure)} GNF/h</p>
                )}
              </div>
              {dialogAvanceTotal > 0 && (
                <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <p className="text-sm font-semibold text-destructive">
                      Avance en cours : {fmtNum(dialogAvanceTotal)} GNF
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="deduire-avance"
                      checked={deduireAvance}
                      onCheckedChange={(v) => {
                        setDeduireAvance(!!v);
                        if (v) setMontantDeduction(dialogAvanceTotal);
                        else setMontantDeduction(0);
                      }}
                    />
                    <label htmlFor="deduire-avance" className="text-sm cursor-pointer">
                      Déduire l'avance du salaire
                    </label>
                  </div>
                  {deduireAvance && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Montant à déduire (GNF)</label>
                      <Input
                        type="number"
                        min={0}
                        max={dialogAvanceTotal}
                        value={montantDeduction}
                        onChange={(e) => {
                          const val = Math.min(Math.max(0, Number(e.target.value)), dialogAvanceTotal);
                          setMontantDeduction(val);
                        }}
                        className="h-9"
                      />
                      <p className="text-xs text-muted-foreground">
                        Salaire net après déduction : <strong className="text-foreground">{fmtNum((signDialog.salaire_calcule || signDialog.salaire_base) - montantDeduction)} GNF</strong>
                      </p>
                      {montantDeduction < dialogAvanceTotal && (
                        <p className="text-xs font-semibold text-destructive">
                          ⚠️ Reste d'avance non couvert : {fmtNum(dialogAvanceTotal - montantDeduction)} GNF
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
              <p className="text-sm font-medium text-destructive">
                ⚠️ La signature est obligatoire pour valider le paiement.
              </p>
              <p className="text-sm text-muted-foreground">
                L'employé doit signer ci-dessous comme preuve de réception. Un reçu sera généré automatiquement.
              </p>
              <div className="border-2 border-dashed rounded-lg p-1 bg-white">
                <canvas
                  ref={empCanvasRef}
                  width={380}
                  height={120}
                  className="cursor-crosshair touch-none w-full"
                  onMouseDown={startEmpDraw}
                  onMouseMove={drawEmp}
                  onMouseUp={stopEmpDraw}
                  onMouseLeave={stopEmpDraw}
                  onTouchStart={startEmpDraw}
                  onTouchMove={drawEmp}
                  onTouchEnd={stopEmpDraw}
                />
              </div>
              <Button variant="ghost" size="sm" onClick={clearEmpSignature}>Effacer</Button>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setSignDialog(null)}>Annuler</Button>
            <Button
              onClick={handleConfirmPay}
              disabled={paying !== null || !hasEmpSignature}
              className="bg-emerald-600 hover:bg-emerald-700"
              title={!hasEmpSignature ? 'La signature de l\'employé est obligatoire' : ''}
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
