import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Wallet, Banknote, CalendarCheck, PenTool, FileText, Loader2, Check, Search, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { generateRegistrePaiePDF } from '@/lib/generateRegistrePaiePDF';

const CATEGORIES = [
  { value: 'all', label: 'Toutes les catégories' },
  { value: 'enseignant', label: 'Professeurs' },
  { value: 'chauffeur', label: 'Chauffeurs' },
  { value: 'administration', label: 'Administration' },
  { value: 'securite', label: 'Sécurité' },
  { value: 'technique', label: 'Technique' },
  { value: 'cuisine', label: 'Cuisine' },
];

interface Employe {
  id: string;
  nom: string;
  prenom: string;
  poste: string;
  categorie: string;
  salaire_base: number;
  statut: string;
}

interface PaiementRecord {
  id: string;
  employe_id: string;
  montant: number;
  date_paiement: string;
  mois: number;
  annee: number;
}

export default function TresorierDashboard() {
  const [employes, setEmployes] = useState<Employe[]>([]);
  const [paiements, setPaiements] = useState<PaiementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [categorie, setCategorie] = useState('all');
  const [search, setSearch] = useState('');
  const [currentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear] = useState(new Date().getFullYear());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [empRes, paiRes] = await Promise.all([
      supabase.from('employes').select('id, nom, prenom, poste, categorie, salaire_base, statut').eq('statut', 'actif'),
      supabase.from('paiements_tresorier').select('*').eq('mois', currentMonth).eq('annee', currentYear),
    ]);
    if (empRes.data) setEmployes(empRes.data);
    if (paiRes.data) setPaiements(paiRes.data as PaiementRecord[]);
    setLoading(false);
  }, [currentMonth, currentYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePay = async (emp: Employe) => {
    setPaying(emp.id);
    const { error } = await supabase.from('paiements_tresorier').insert({
      employe_id: emp.id,
      montant: emp.salaire_base,
      mois: currentMonth,
      annee: currentYear,
      paye_par: user?.id,
    } as any);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Paiement enregistré', description: `${emp.prenom} ${emp.nom} a été payé.` });
      fetchData();
    }
    setPaying(null);
  };

  const isPaid = (empId: string) => paiements.some(p => p.employe_id === empId);

  const filtered = employes.filter(e => {
    const matchCat = categorie === 'all' || e.categorie === categorie;
    const matchSearch = `${e.nom} ${e.prenom} ${e.poste}`.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const totalBudget = filtered.reduce((s, e) => s + e.salaire_base, 0);
  const totalPaye = filtered.filter(e => isPaid(e.id)).reduce((s, e) => s + e.salaire_base, 0);
  const soldeRestant = totalBudget - totalPaye;
  const nbPaye = filtered.filter(e => isPaid(e.id)).length;

  // Canvas signature logic
  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY;
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDraw = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleGeneratePDF = () => {
    const signatureDataUrl = hasSignature ? canvasRef.current?.toDataURL('image/png') : undefined;
    const paidEmployees = filtered.filter(e => isPaid(e.id)).map(e => {
      const p = paiements.find(p => p.employe_id === e.id);
      return {
        nom: e.nom,
        prenom: e.prenom,
        poste: e.poste,
        categorie: e.categorie,
        montant: e.salaire_base,
        datePaiement: p?.date_paiement || new Date().toISOString(),
      };
    });
    generateRegistrePaiePDF(paidEmployees, currentMonth, currentYear, signatureDataUrl);
    toast({ title: 'PDF généré', description: 'Le registre de paie a été téléchargé.' });
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
      <div className="flex items-center gap-3">
        <Wallet className="h-7 w-7 text-emerald-600" />
        <h1 className="text-2xl font-bold">Trésorerie — Registre de Paie</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Banknote className="h-8 w-8 text-emerald-600" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Budget Réel</p>
                <p className="text-xl font-bold">{totalBudget.toLocaleString()} GNF</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <CalendarCheck className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Montant Payé</p>
                <p className="text-xl font-bold text-emerald-600">{totalPaye.toLocaleString()} GNF</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${soldeRestant > 0 ? 'border-l-destructive' : 'border-l-emerald-500'}`}>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Wallet className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Solde Restant</p>
                <p className={`text-xl font-bold ${soldeRestant > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                  {soldeRestant.toLocaleString()} GNF
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-violet-600" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Employés payés</p>
                <p className="text-xl font-bold">{nbPaye} / {filtered.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
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

      {/* Employee Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personnel — {format(new Date(), 'MMMM yyyy', { locale: fr })}</CardTitle>
        </CardHeader>
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
                const paiement = paiements.find(p => p.employe_id === emp.id);
                return (
                  <TableRow key={emp.id} className={paid ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : ''}>
                    <TableCell className="font-medium">{emp.prenom} {emp.nom}</TableCell>
                    <TableCell>{emp.poste}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{emp.categorie}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{emp.salaire_base.toLocaleString()} GNF</TableCell>
                    <TableCell>
                      {paid ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">
                          <Check className="h-3 w-3 mr-1" /> Payé
                        </Badge>
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
                          onClick={() => handlePay(emp)}
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
      </Card>

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
    </div>
  );
}
