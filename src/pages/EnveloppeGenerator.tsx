import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Printer, Mail, Loader2, Lock, QrCode, Globe, Users, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import * as QRCode from 'qrcode';

// C4 envelope: 229mm x 324mm
const ENV_W = 229;
const ENV_H = 324;
const MARGIN = 15;

const NAVY = { r: 0, g: 100, b: 0 };      // Dark green (logo color)
const BLUE = { r: 34, g: 139, b: 34 };     // Forest green accent
const LIGHT_BLUE = { r: 220, g: 245, b: 220 }; // Light green bg
const WHITE = { r: 255, g: 255, b: 255 };
const GRAY = { r: 120, g: 120, b: 130 };
const DARK = { r: 30, g: 30, b: 40 };
const RED = { r: 200, g: 30, b: 30 };

async function generateQRDataUrl(data: string): Promise<string> {
  return QRCode.toDataURL(data, { width: 400, margin: 1, color: { dark: '#0f2041', light: '#ffffff' }, errorCorrectionLevel: 'M' });
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, { mode: 'cors' });
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

interface EnvelopeData {
  eleveNom: string;
  elevePrenom: string;
  classe: string;
  familleName: string;
  telephone: string;
  familleId: string;
}

async function generateEnveloppesPDF(
  envelopes: EnvelopeData[],
  schoolName: string,
  schoolSubtitle: string,
  schoolVille: string,
  schoolTel: string,
  logoUrl: string | null,
  siteUrl: string,
  periodeName: string,
): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [ENV_W, ENV_H] });

  let logoData: string | null = null;
  if (logoUrl) logoData = await loadImageAsDataUrl(logoUrl);

  for (let i = 0; i < envelopes.length; i++) {
    if (i > 0) pdf.addPage([ENV_W, ENV_H], 'portrait');
    const env = envelopes[i];

    // ── White background ──
    pdf.setFillColor(WHITE.r, WHITE.g, WHITE.b);
    pdf.rect(0, 0, ENV_W, ENV_H, 'F');

    // ── Watermark logo center ──
    if (logoData) {
      try {
        const fmt = logoData.includes('image/png') ? 'PNG' : 'JPEG';
        const wmSize = 80;
        const wmX = (ENV_W - wmSize) / 2;
        const wmY = (ENV_H - wmSize) / 2;
        // Save graphics state for opacity
        (pdf as any).saveGraphicsState?.();
        (pdf as any).setGState?.((pdf as any).GState?.({ opacity: 0.10 }));
        pdf.addImage(logoData, fmt, wmX, wmY, wmSize, wmSize);
        (pdf as any).restoreGraphicsState?.();
      } catch { /* silent */ }
    }

    // ── Bottom footer bar (define early for layout math) ──
    const footerH = 14;
    const footerY = ENV_H - footerH;

    // ── Top header bar ──
    const headerH = 48;
    pdf.setFillColor(NAVY.r, NAVY.g, NAVY.b);
    pdf.rect(0, 0, ENV_W, headerH, 'F');

    // Red accent line below header
    pdf.setFillColor(RED.r, RED.g, RED.b);
    pdf.rect(0, headerH, ENV_W, 2, 'F');

    // ── Logo in header ──
    const logoSize = 28;
    const logoX = MARGIN + 2;
    const logoY = (headerH - logoSize) / 2;
    if (logoData) {
      try {
        pdf.setFillColor(WHITE.r, WHITE.g, WHITE.b);
        pdf.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 1.5, 'F');
        const fmt = logoData.includes('image/png') ? 'PNG' : 'JPEG';
        pdf.addImage(logoData, fmt, logoX + 2, logoY + 2, logoSize - 4, logoSize - 4);
      } catch { /* silent */ }
    }

    // ── School name in header ──
    const textX = logoX + logoSize + 8;
    pdf.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    const nameLines = pdf.splitTextToSize(schoolName.toUpperCase(), ENV_W - textX - MARGIN - 5);
    let nameY = nameLines.length > 2 ? 10 : nameLines.length > 1 ? 12 : 15;
    nameLines.forEach((line: string, idx: number) => {
      pdf.text(line, textX, nameY + idx * 6);
    });

    // Subtitle
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(schoolSubtitle, textX, nameY + nameLines.length * 6 + 4);

    // Ville + Tel
    pdf.setFontSize(8);
    const contactLine = [schoolVille, schoolTel].filter(Boolean).join(' • ');
    pdf.text(contactLine, textX, nameY + nameLines.length * 6 + 10);

    // ── Content area boundaries ──
    const contentTop = headerH + 6;
    const contentBottom = footerY - 4;

    // ── Decorative border (within content area) ──
    pdf.setDrawColor(NAVY.r, NAVY.g, NAVY.b);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(MARGIN - 3, contentTop, ENV_W - (MARGIN - 3) * 2, contentBottom - contentTop, 4, 4, 'S');

    // Inner subtle border
    pdf.setDrawColor(BLUE.r, BLUE.g, BLUE.b);
    pdf.setLineWidth(0.2);
    pdf.roundedRect(MARGIN, contentTop + 3, ENV_W - MARGIN * 2, contentBottom - contentTop - 6, 3, 3, 'S');

    // ── "RESULTAT SCOLAIRE DE L'ENFANT" label ──
    const labelY = contentTop + 16;
    pdf.setFillColor(LIGHT_BLUE.r, LIGHT_BLUE.g, LIGHT_BLUE.b);
    pdf.roundedRect(MARGIN + 5, labelY - 7, ENV_W - MARGIN * 2 - 10, 15, 3, 3, 'F');
    pdf.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text(`RESULTAT SCOLAIRE DE L'ENFANT — ${periodeName.toUpperCase()}`, ENV_W / 2, labelY + 2, { align: 'center' });

    // ── Destinataire section ──
    const destY = labelY + 22;

    pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text('DESTINATAIRE', MARGIN + 8, destY);

    // Separator line
    pdf.setDrawColor(BLUE.r, BLUE.g, BLUE.b);
    pdf.setLineWidth(0.3);
    pdf.line(MARGIN + 8, destY + 2, ENV_W / 2 + 30, destY + 2);

    // Family name (no "Famille" prefix, just the name)
    pdf.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    const familleLines = pdf.splitTextToSize(env.familleName, ENV_W - MARGIN * 2 - 20);
    familleLines.slice(0, 2).forEach((line: string, idx: number) => {
      pdf.text(line, MARGIN + 8, destY + 15 + idx * 8);
    });
    const familleEndY = destY + 15 + Math.min(familleLines.length, 2) * 8;

    // Phone under family name
    if (env.telephone) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
      pdf.text(`Tel : ${env.telephone}`, MARGIN + 8, familleEndY + 5);
    }

    // Student name — BOLD and CENTERED
    const studentY = familleEndY + (env.telephone ? 18 : 10);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(DARK.r, DARK.g, DARK.b);
    pdf.text(`${env.elevePrenom} ${env.eleveNom}`, ENV_W / 2, studentY, { align: 'center' });

    // Class
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
    pdf.text(`Classe : ${env.classe}`, ENV_W / 2, studentY + 9, { align: 'center' });

    // ── Slogan ──
    pdf.setFont('helvetica', 'bolditalic');
    pdf.setFontSize(10);
    pdf.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    pdf.text('A EIEF nous faisons toujours plus !', ENV_W / 2, studentY + 24, { align: 'center' });

    // ── QR Codes section (anchored from bottom, above footer) ──
    const qrSize = 38;
    const qrFramePad = 5;
    const labelGap = 5;
    const qrLabelH = 18; // space for 3 lines of text
    const qrBlockH = qrFramePad + qrSize + qrFramePad + labelGap + qrLabelH;
    const qrSectionY = contentBottom - qrBlockH - 8 + qrFramePad; // QR image Y

    // QR1 - Site web (left)
    const qr1CenterX = MARGIN + 12 + qrFramePad + qrSize / 2;
    const qr1X = qr1CenterX - qrSize / 2;
    try {
      const qr1Data = await generateQRDataUrl(siteUrl);
      pdf.setFillColor(WHITE.r, WHITE.g, WHITE.b);
      pdf.roundedRect(qr1X - qrFramePad, qrSectionY - qrFramePad, qrSize + qrFramePad * 2, qrSize + qrFramePad * 2, 3, 3, 'F');
      pdf.setDrawColor(NAVY.r, NAVY.g, NAVY.b);
      pdf.setLineWidth(0.4);
      pdf.roundedRect(qr1X - qrFramePad, qrSectionY - qrFramePad, qrSize + qrFramePad * 2, qrSize + qrFramePad * 2, 3, 3, 'S');
      pdf.addImage(qr1Data, 'PNG', qr1X, qrSectionY, qrSize, qrSize);

      // Legend
      const lbl1Y = qrSectionY + qrSize + qrFramePad + labelGap;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(NAVY.r, NAVY.g, NAVY.b);
      pdf.text('DECOUVRIR NOTRE ECOLE', qr1CenterX, lbl1Y, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
      pdf.text('Scannez pour visiter notre site', qr1CenterX, lbl1Y + 4.5, { align: 'center' });
      pdf.setFontSize(5.5);
      pdf.text(siteUrl.replace(/^https?:\/\//, ''), qr1CenterX, lbl1Y + 9, { align: 'center' });
    } catch { /* silent */ }

    // QR2 - Espace Parent (right)
    const qr2CenterX = ENV_W - MARGIN - 12 - qrFramePad - qrSize / 2;
    const qr2X = qr2CenterX - qrSize / 2;
    try {
      const parentUrl = `${siteUrl}/parent`;
      const qr2Data = await generateQRDataUrl(parentUrl);
      pdf.setFillColor(WHITE.r, WHITE.g, WHITE.b);
      pdf.roundedRect(qr2X - qrFramePad, qrSectionY - qrFramePad, qrSize + qrFramePad * 2, qrSize + qrFramePad * 2, 3, 3, 'F');
      pdf.setDrawColor(NAVY.r, NAVY.g, NAVY.b);
      pdf.setLineWidth(0.4);
      pdf.roundedRect(qr2X - qrFramePad, qrSectionY - qrFramePad, qrSize + qrFramePad * 2, qrSize + qrFramePad * 2, 3, 3, 'S');
      pdf.addImage(qr2Data, 'PNG', qr2X, qrSectionY, qrSize, qrSize);

      // Legend
      const lbl2Y = qrSectionY + qrSize + qrFramePad + labelGap;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(NAVY.r, NAVY.g, NAVY.b);
      pdf.text('ESPACE PARENT SECURISE', qr2CenterX, lbl2Y, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
      pdf.text('Bulletins & suivi scolaire en ligne', qr2CenterX, lbl2Y + 4.5, { align: 'center' });
      pdf.setFontSize(5.5);
      pdf.text('Acces confidentiel et securise', qr2CenterX, lbl2Y + 9, { align: 'center' });
    } catch { /* silent */ }

    // Connector dashed line between QR codes
    const connY = qrSectionY + qrSize / 2;
    pdf.setDrawColor(BLUE.r, BLUE.g, BLUE.b);
    pdf.setLineWidth(0.2);
    pdf.setLineDashPattern([2, 2], 0);
    pdf.line(qr1X + qrSize + qrFramePad + 4, connY, qr2X - qrFramePad - 4, connY);
    pdf.setLineDashPattern([], 0);

    // ── Draw footer (green + red) ──
    const redStripeH = 3;
    pdf.setFillColor(NAVY.r, NAVY.g, NAVY.b);
    pdf.rect(0, footerY, ENV_W, footerH, 'F');
    pdf.setFillColor(RED.r, RED.g, RED.b);
    pdf.rect(0, footerY, ENV_W, redStripeH, 'F');

    pdf.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Annee scolaire 2026-2027  •  ${schoolName}`, ENV_W / 2, footerY + redStripeH + 4, { align: 'center' });
    pdf.setFontSize(5.5);
    pdf.text('Gestion scolaire integree EduGestion Pro', ENV_W / 2, footerY + redStripeH + 9, { align: 'center' });
  }

  pdf.save(`enveloppes_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── Hooks ───────────────────────────────────────────────

function useClasses() {
  return useQuery({
    queryKey: ['enveloppe-classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, nom, niveaux:niveau_id(nom, cycles:cycle_id(nom))')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });
}

function usePeriodes() {
  return useQuery({
    queryKey: ['enveloppe-periodes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('periodes')
        .select('id, nom')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });
}

function useElevesByClasse(classeId: string | null) {
  return useQuery({
    queryKey: ['enveloppe-eleves', classeId],
    enabled: !!classeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, classe_id, famille_id, familles:famille_id(id, nom_famille, telephone_pere, telephone_mere), classes:classe_id(nom)')
        .eq('classe_id', classeId!)
        .eq('statut', 'inscrit')
        .is('deleted_at', null)
        .order('nom');
      if (error) throw error;
      return data;
    },
  });
}

// ─── Main Component ──────────────────────────────────────

export default function EnveloppeGenerator() {
  const { hasRole } = useAuth();
  const { data: config } = useSchoolConfig();
  const { data: classes, isLoading: loadingClasses } = useClasses();
  const { data: periodes } = usePeriodes();
  const [selectedClasse, setSelectedClasse] = useState<string | null>(null);
  const [selectedPeriode, setSelectedPeriode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const { data: eleves, isLoading: loadingEleves } = useElevesByClasse(selectedClasse);

  const selectedClasseInfo = classes?.find((c: any) => c.id === selectedClasse);

  const envelopeData: EnvelopeData[] = useMemo(() => {
    if (!eleves) return [];
    // Deduplicate by famille
    const familleMap = new Map<string, EnvelopeData>();
    eleves.forEach((e: any) => {
      const famille = e.familles;
      if (!famille) return;
      const key = famille.id;
      if (!familleMap.has(key)) {
        familleMap.set(key, {
          eleveNom: e.nom,
          elevePrenom: e.prenom,
          classe: (e.classes as any)?.nom || '',
          familleName: famille.nom_famille,
          telephone: famille.telephone_pere || famille.telephone_mere || '',
          familleId: famille.id,
        });
      }
    });
    return Array.from(familleMap.values());
  }, [eleves]);

  if (!hasRole('superviseur')) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleGenerate = async () => {
    if (envelopeData.length === 0) {
      toast.error('Aucune famille trouvée pour cette classe');
      return;
    }
    if (!selectedPeriode) {
      toast.error('Veuillez sélectionner une période');
      return;
    }
    const periodeName = periodes?.find((p: any) => p.id === selectedPeriode)?.nom || 'Période';
    setGenerating(true);
    try {
      const siteUrl = 'https://enfantsdufutur.com';
      await generateEnveloppesPDF(
        envelopeData,
        config?.nom || 'Ecole Internationale Les Enfants du Futur',
        config?.soustitre || 'Enseignement Général et Technique',
        config?.ville || 'Conakry, Guinée',
        config?.telephone || '',
        config?.logo_url || null,
        siteUrl,
        periodeName,
      );
      toast.success(`${envelopeData.length} enveloppe(s) générée(s) avec succès`);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Générateur d'Enveloppes</h1>
          <p className="text-sm text-muted-foreground">Format C4 (229×324mm) — Impression groupée par classe</p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Sélection de la classe et période
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Select
                value={selectedClasse || ''}
                onValueChange={(v) => setSelectedClasse(v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une classe..." />
                </SelectTrigger>
                <SelectContent>
                  {loadingClasses ? (
                    <SelectItem value="_loading" disabled>Chargement...</SelectItem>
                  ) : (
                    classes?.map((c: any) => {
                      const cycle = (c.niveaux as any)?.cycles?.nom || '';
                      const niveau = (c.niveaux as any)?.nom || '';
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nom} — {niveau} ({cycle})
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Select
                value={selectedPeriode || ''}
                onValueChange={(v) => setSelectedPeriode(v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une période..." />
                </SelectTrigger>
                <SelectContent>
                  {periodes?.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!selectedClasse || !selectedPeriode || generating || envelopeData.length === 0}
              className="gap-2"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              {generating ? 'Génération...' : `Imprimer ${envelopeData.length} enveloppe(s)`}
            </Button>
          </div>

          {/* Stats */}
          {selectedClasse && !loadingEleves && (
            <div className="flex flex-wrap gap-3">
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3 w-3" />
                {eleves?.length || 0} élèves
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Mail className="h-3 w-3" />
                {envelopeData.length} familles
              </Badge>
              <Badge variant="outline" className="gap-1">
                <QrCode className="h-3 w-3" />
                2 QR codes par enveloppe
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Lock className="h-3 w-3" />
                Accès sécurisé parent
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview list */}
      {selectedClasse && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Aperçu — {selectedClasseInfo?.nom || 'Classe'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEleves ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : envelopeData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucune famille associée à cette classe</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {envelopeData.map((env, idx) => (
                  <div
                    key={idx}
                    className="border rounded-lg p-3 bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">Famille {env.familleName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {env.elevePrenom} {env.eleveNom} — {env.classe}
                        </p>
                        {env.telephone && (
                          <p className="text-xs text-muted-foreground mt-0.5">{env.telephone}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
