import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Star, TrendingUp, Users, Download, Award, Crown, Printer, FileText, GraduationCap, School } from 'lucide-react';
import { usePerformanceData, type TableauHonneurEleve } from '@/hooks/usePerformanceData';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { generateTableauHonneurPDF, generateAllTableauxHonneurPDF } from '@/lib/generateCertificatExcellence';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

function HonneurCard({ eleve, rank, logoUrl, periodeName, schoolConfig }: {
  eleve: TableauHonneurEleve;
  rank: number;
  logoUrl: string | null;
  periodeName: string;
  schoolConfig: { nom: string; ville: string };
}) {
  const isFirst = rank === 0;
  const [printing, setPrinting] = useState(false);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await generateTableauHonneurPDF(eleve, logoUrl, periodeName, schoolConfig);
      toast.success(`Tableau d'Honneur généré pour ${eleve.prenom} ${eleve.nom}`);
    } catch {
      toast.error('Erreur lors de la génération');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Card className={`relative overflow-hidden transition-all hover:shadow-xl ${isFirst ? 'ring-2 ring-[hsl(38,92%,50%)] shadow-lg' : 'border-border/60'}`}>
      {isFirst && (
        <div className="absolute top-2 right-2">
          <Crown className="h-5 w-5 text-[hsl(38,92%,50%)]" />
        </div>
      )}
      <CardContent className="flex flex-col items-center pt-6 pb-4 px-4">
        <div className={`w-20 h-20 rounded-full overflow-hidden mb-3 border-[3px] ${isFirst ? 'border-[hsl(38,92%,50%)] shadow-[0_0_16px_hsl(38,92%,50%,0.3)]' : 'border-primary/30'} bg-muted flex items-center justify-center`}>
          {eleve.photo_url ? (
            <img src={eleve.photo_url} alt={`${eleve.prenom} ${eleve.nom}`} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-muted-foreground" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              {eleve.prenom[0]}{eleve.nom[0]}
            </span>
          )}
        </div>
        <h3 className="text-sm font-bold text-foreground text-center leading-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          {eleve.prenom} {eleve.nom}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">{eleve.classe_nom}</p>
        <Badge variant="secondary" className="mt-2 text-[10px]">
          {eleve.niveau_nom} — {eleve.cycle_nom}
        </Badge>
        <div className="mt-3 bg-primary/5 rounded-lg px-4 py-2 text-center">
          <div className="text-2xl font-extrabold text-primary" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {eleve.moyenne.toFixed(2)}
          </div>
          <div className="text-[10px] text-muted-foreground font-medium">/ 20 (seuil: {eleve.seuil})</div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-3 w-full h-7 text-[10px] gap-1 border-[hsl(38,92%,50%)]/30 text-[hsl(38,92%,50%)] hover:bg-[hsl(38,92%,50%)]/10"
          onClick={handlePrint}
          disabled={printing}
        >
          <FileText className="h-3 w-3" />
          {printing ? 'Génération...' : "Tableau d'Honneur"}
        </Button>
      </CardContent>
    </Card>
  );
}

const SECONDAIRE_CYCLES = ['collège', 'lycée', 'college', 'lycee'];
const isSecondaireCycle = (cycleName: string) => SECONDAIRE_CYCLES.some(c => cycleName.toLowerCase().includes(c));

export default function PerformanceExcellence({ isPublic = false }: { isPublic?: boolean }) {
  const [selectedPeriode, setSelectedPeriode] = useState<string>('all');
  const [sectionTab, setSectionTab] = useState<string>('autres');
  const [printingAll, setPrintingAll] = useState(false);
  const hallRef = useRef<HTMLDivElement>(null);
  const { data: schoolConfig } = useSchoolConfig();

  const { periodes, niveauPerformances, moyenneGenerale, tableauHonneur, selectedPeriodeName, isLoading, totalElevesNotes } = usePerformanceData(
    selectedPeriode !== 'all' ? selectedPeriode : undefined
  );

  // Filter by section tab instead of cycle dropdown
  const filteredPerf = niveauPerformances.filter(n => 
    sectionTab === 'secondaire' ? isSecondaireCycle(n.cycle_nom) : !isSecondaireCycle(n.cycle_nom)
  );

  const filteredHonneur = tableauHonneur.filter(e => 
    sectionTab === 'secondaire' ? isSecondaireCycle(e.cycle_nom) : !isSecondaireCycle(e.cycle_nom)
  );

  const periodeName = selectedPeriode === 'all'
    ? 'Toutes les périodes'
    : periodes.find(p => p.id === selectedPeriode)?.nom || '';

  const config = {
    nom: schoolConfig?.nom || 'Ecole Internationale Les Enfants du Futur',
    ville: schoolConfig?.ville || 'Sanoyah',
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, pageW, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text("TABLEAU D'HONNEUR", pageW / 2, 16, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`${periodeName} — Moyenne Générale: ${moyenneGenerale.toFixed(2)} / 20`, pageW / 2, 26, { align: 'center' });

    doc.setTextColor(30, 30, 30);
    let y = 45;
    const colW = (pageW - 30) / 3;

    filteredHonneur.forEach((eleve, i) => {
      const col = i % 3;
      const x = 15 + col * colW;
      if (col === 0 && i > 0) y += 50;
      if (y > 270) { doc.addPage(); y = 20; }

      doc.setDrawColor(200, 170, 50);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, y, colW - 5, 45, 3, 3);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${eleve.prenom} ${eleve.nom}`, x + (colW - 5) / 2, y + 12, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`${eleve.classe_nom} — ${eleve.niveau_nom}`, x + (colW - 5) / 2, y + 19, { align: 'center' });
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`${eleve.moyenne.toFixed(2)}`, x + (colW - 5) / 2, y + 32, { align: 'center' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('/ 20', x + (colW - 5) / 2 + 12, y + 32);
      doc.setTextColor(30, 30, 30);
    });

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} — EduGestion Pro`, pageW / 2, 290, { align: 'center' });
    doc.save('Tableau_Honneur.pdf');
  };

  const handlePrintAllCertificates = async () => {
    if (filteredHonneur.length === 0) return;
    setPrintingAll(true);
    try {
      await generateAllTableauxHonneurPDF(filteredHonneur, schoolConfig?.logo_url || null, periodeName, config);
      toast.success(`${filteredHonneur.length} tableaux d'honneur générés avec succès`);
    } catch {
      toast.error("Erreur lors de la génération des tableaux d'honneur");
    } finally {
      setPrintingAll(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" ref={hallRef}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[hsl(38,92%,50%)]/10 flex items-center justify-center">
            <Trophy className="h-5 w-5 text-[hsl(38,92%,50%)]" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Performance & Tableau d'Honneur
            </h2>
            <p className="text-xs text-muted-foreground">Primaire ≥ 8/20 · Collège & Lycée ≥ 16/20</p>
          </div>
        </div>
        {!isPublic && (
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={selectedPeriode} onValueChange={setSelectedPeriode}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les périodes</SelectItem>
                {periodes.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={handleExportPDF} className="h-8 text-xs">
              <Download className="mr-1.5 h-3.5 w-3.5" />
              PDF
            </Button>
            {filteredHonneur.length > 0 && (
              <Button
                size="sm"
                onClick={handlePrintAllCertificates}
                disabled={printingAll}
                className="h-8 text-xs bg-[hsl(38,92%,50%)] hover:bg-[hsl(38,92%,45%)] text-white"
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                {printingAll ? 'Génération...' : `Tous les TH (${filteredHonneur.length})`}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Section tabs */}
      <Tabs value={sectionTab} onValueChange={setSectionTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="autres" className="gap-2">
            <School className="h-4 w-4" /> Préscolaire & Primaire
          </TabsTrigger>
          <TabsTrigger value="secondaire" className="gap-2">
            <GraduationCap className="h-4 w-4" /> Secondaire
          </TabsTrigger>
        </TabsList>
      </Tabs>


      {/* Global Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-none shadow-md">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {moyenneGenerale.toFixed(2)}
              </div>
              <div className="text-[10px] text-muted-foreground">Moyenne Générale</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-10 h-10 rounded-lg bg-[hsl(38,92%,50%)]/10 flex items-center justify-center shrink-0">
              <Star className="h-5 w-5 text-[hsl(38,92%,50%)]" />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {filteredHonneur.length}
              </div>
              <div className="text-[10px] text-muted-foreground">Tableau d'Honneur</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-10 h-10 rounded-lg bg-[hsl(var(--warning))]/10 flex items-center justify-center shrink-0">
              <Award className="h-5 w-5 text-[hsl(var(--warning))]" />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {filteredPerf.length > 0 ? Math.round(filteredPerf.reduce((s, n) => s + n.taux_reussite, 0) / filteredPerf.length) : 0}%
              </div>
              <div className="text-[10px] text-muted-foreground">Taux de Réussite</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-10 h-10 rounded-lg bg-[hsl(var(--info))]/10 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-[hsl(var(--info))]" />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {totalElevesNotes}
              </div>
              <div className="text-[10px] text-muted-foreground">Élèves évalués</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Taux de Réussite par Niveau */}
      {!isPublic && filteredPerf.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              <TrendingUp className="h-4 w-4 text-primary" />
              Taux de Réussite par Niveau
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {filteredPerf.map(n => (
              <div key={n.niveau_id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{n.niveau_nom}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{n.cycle_nom}</Badge>
                    <span className="text-xs text-muted-foreground">Moy: {n.moyenne_niveau.toFixed(2)}</span>
                    <span className="font-semibold text-sm" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                      {n.taux_reussite}%
                    </span>
                  </div>
                </div>
                <Progress value={n.taux_reussite} className="h-2.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tableau d'Honneur */}
      {filteredHonneur.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-5 w-5 text-[hsl(38,92%,50%)]" />
            <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Tableau d'Honneur ({filteredHonneur.length} élèves)
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {filteredHonneur.map((eleve, i) => (
              <HonneurCard
                key={eleve.id}
                eleve={eleve}
                rank={i}
                logoUrl={schoolConfig?.logo_url || null}
                periodeName={periodeName}
                schoolConfig={config}
              />
            ))}
          </div>
        </div>
      )}

      {filteredHonneur.length === 0 && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Trophy className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">Aucun élève éligible au Tableau d'Honneur pour cette période.</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Primaire ≥ 8/20 · Collège & Lycée ≥ 16/20</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
