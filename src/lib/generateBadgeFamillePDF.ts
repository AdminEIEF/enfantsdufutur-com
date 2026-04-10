import jsPDF from 'jspdf';
import * as QRCode from 'qrcode';

interface FamilleBadgeData {
  id: string;
  nom_famille: string;
  telephone_pere?: string | null;
  telephone_mere?: string | null;
  code_plain?: string;
  enfants: { prenom: string; nom: string; classe?: string }[];
}

// Badge dimensions (mm) - standard card size
const CARD_W = 85.6;
const CARD_H = 54;
const MARGIN = 4;

// Colors
const PRIMARY = { r: 30, g: 58, b: 138 };   // Deep blue
const ACCENT = { r: 37, g: 99, b: 235 };    // Blue accent
const GRAY = { r: 107, g: 114, b: 128 };
const DARK = { r: 17, g: 24, b: 39 };
const WHITE = { r: 255, g: 255, b: 255 };

async function generateQRDataUrl(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    width: 200,
    margin: 1,
    color: { dark: '#1e3a8a', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
}

export async function generateBadgeFamillePDF(familles: FamilleBadgeData[], schoolName = 'E.I.E.F'): Promise<void> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [CARD_W, CARD_H] });

  for (let i = 0; i < familles.length; i++) {
    if (i > 0) pdf.addPage([CARD_W, CARD_H], 'landscape');
    const f = familles[i];

    // Background
    pdf.setFillColor(WHITE.r, WHITE.g, WHITE.b);
    pdf.roundedRect(0, 0, CARD_W, CARD_H, 3, 3, 'F');

    // Top bar
    pdf.setFillColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
    pdf.roundedRect(0, 0, CARD_W, 14, 3, 3, 'F');
    pdf.setFillColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
    pdf.rect(0, 5, CARD_W, 9, 'F');

    // School name
    pdf.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text(schoolName, CARD_W / 2, 5.5, { align: 'center' });

    // "CARTE FAMILLE" subtitle
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');
    pdf.text('CARTE FAMILLE', CARD_W / 2, 9.5, { align: 'center' });

    // Thin accent line under header
    pdf.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
    pdf.rect(0, 14, CARD_W, 0.8, 'F');

    // Family name
    pdf.setTextColor(DARK.r, DARK.g, DARK.b);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    const famName = f.nom_famille.length > 25 ? f.nom_famille.slice(0, 24) + '…' : f.nom_famille;
    pdf.text(famName, MARGIN + 1, 21);

    // Code
    if (f.code_plain) {
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
      pdf.text(f.code_plain, MARGIN + 1, 25.5);
    }

    // Contact info
    pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');
    let yContact = 29.5;
    if (f.telephone_pere) {
      pdf.text(`Père: ${f.telephone_pere}`, MARGIN + 1, yContact);
      yContact += 3.5;
    }
    if (f.telephone_mere) {
      pdf.text(`Mère: ${f.telephone_mere}`, MARGIN + 1, yContact);
      yContact += 3.5;
    }

    // Children list
    pdf.setTextColor(DARK.r, DARK.g, DARK.b);
    pdf.setFontSize(5.5);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Enfants :', MARGIN + 1, yContact + 1);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
    const maxChildren = Math.min(f.enfants.length, 4);
    for (let c = 0; c < maxChildren; c++) {
      const child = f.enfants[c];
      const childText = `• ${child.prenom} ${child.nom}${child.classe ? ` (${child.classe})` : ''}`;
      const truncated = childText.length > 35 ? childText.slice(0, 34) + '…' : childText;
      pdf.text(truncated, MARGIN + 2, yContact + 4 + c * 3);
    }
    if (f.enfants.length > 4) {
      pdf.text(`+ ${f.enfants.length - 4} autre(s)`, MARGIN + 2, yContact + 4 + 4 * 3);
    }

    // QR Code (right side) - encode family UUID for scanning
    try {
      const qrData = JSON.stringify({ type: 'famille', id: f.id });
      const qrDataUrl = await generateQRDataUrl(qrData);
      const qrSize = 22;
      const qrX = CARD_W - MARGIN - qrSize - 1;
      const qrY = 17;
      pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

      // QR label
      pdf.setFontSize(4.5);
      pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
      pdf.text('Scanner pour accéder', qrX + qrSize / 2, qrY + qrSize + 2.5, { align: 'center' });
    } catch (err) {
      console.error('QR generation error:', err);
    }

    // Bottom bar
    pdf.setFillColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
    pdf.roundedRect(0, CARD_H - 5, CARD_W, 5, 0, 0, 'F');
    pdf.roundedRect(0, CARD_H - 3, CARD_W, 3, 3, 3, 'F');
    pdf.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    pdf.setFontSize(4.5);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`ID: ${f.id.slice(0, 8).toUpperCase()}`, CARD_W / 2, CARD_H - 1, { align: 'center' });
  }

  pdf.save(`badges_familles_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// Generate a single badge
export async function generateSingleBadgeFamillePDF(famille: FamilleBadgeData, schoolName?: string): Promise<void> {
  return generateBadgeFamillePDF([famille], schoolName);
}
