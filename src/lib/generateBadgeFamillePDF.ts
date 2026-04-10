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
const M = 3.5; // margin

// Colors — school palette (red/green from Guinea flag + professional navy)
const RED    = { r: 192, g: 57, b: 43 };
const GREEN  = { r: 30, g: 132, b: 73 };
const NAVY   = { r: 15, g: 32, b: 65 };
const GRAY   = { r: 120, g: 120, b: 130 };
const DARK   = { r: 30, g: 30, b: 40 };
const WHITE  = { r: 255, g: 255, b: 255 };

async function generateQRDataUrl(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    width: 300,
    margin: 1,
    color: { dark: '#0f2041', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
}

async function loadLogoAsDataUrl(logoUrl: string): Promise<string | null> {
  try {
    const resp = await fetch(logoUrl, { mode: 'cors' });
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateBadgeFamillePDF(
  familles: FamilleBadgeData[],
  schoolName = 'Ecole Internationale Les Enfants du Futur',
  logoUrl?: string | null,
): Promise<void> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [CARD_W, CARD_H] });

  // Pre-load logo once
  let logoData: string | null = null;
  if (logoUrl) {
    logoData = await loadLogoAsDataUrl(logoUrl);
  }

  for (let i = 0; i < familles.length; i++) {
    if (i > 0) pdf.addPage([CARD_W, CARD_H], 'landscape');
    const f = familles[i];

    // ── Background ──
    pdf.setFillColor(WHITE.r, WHITE.g, WHITE.b);
    pdf.roundedRect(0, 0, CARD_W, CARD_H, 2, 2, 'F');

    // ── Top gradient bar (red → green, Guinea flag) ──
    const headerH = 16;
    // Red left half
    pdf.setFillColor(RED.r, RED.g, RED.b);
    pdf.roundedRect(0, 0, CARD_W, headerH, 2, 2, 'F');
    // Cover bottom rounded corners
    pdf.rect(0, 4, CARD_W, headerH - 4, 'F');
    // Green right overlay
    pdf.setFillColor(GREEN.r, GREEN.g, GREEN.b);
    pdf.rect(CARD_W * 0.5, 0, CARD_W * 0.5, headerH, 'F');
    // Re-do top-right corner
    pdf.roundedRect(CARD_W * 0.5 - 5, 0, CARD_W * 0.5 + 5, headerH, 0, 2, 'F');
    pdf.rect(CARD_W * 0.5 - 5, 4, CARD_W * 0.5 + 5, headerH - 4, 'F');

    // ── Logo circle ──
    const logoSize = 10;
    const logoX = M + 1;
    const logoY = 3;
    pdf.setFillColor(WHITE.r, WHITE.g, WHITE.b);
    pdf.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 0.5, 'F');
    if (logoData) {
      try {
        const fmt = logoData.includes('image/png') ? 'PNG' : 'JPEG';
        pdf.addImage(logoData, fmt, logoX + 0.8, logoY + 0.8, logoSize - 1.6, logoSize - 1.6);
      } catch { /* fallback: just white circle */ }
    } else {
      pdf.setFontSize(14);
      pdf.text('🎓', logoX + 2.2, logoY + 7.5);
    }

    // ── School name (full) ──
    pdf.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    pdf.setFont('helvetica', 'bold');
    const nameX = logoX + logoSize + 2;
    const maxNameW = CARD_W - nameX - M - 1;
    // Split into lines if needed
    pdf.setFontSize(6.5);
    const nameLines = pdf.splitTextToSize(schoolName.toUpperCase(), maxNameW);
    const nameStartY = nameLines.length > 1 ? 5.5 : 7;
    nameLines.forEach((line: string, idx: number) => {
      pdf.text(line, nameX, nameStartY + idx * 3);
    });

    // ── "CARTE FAMILLE" label ──
    pdf.setFontSize(5.5);
    pdf.setFont('helvetica', 'normal');
    pdf.text('CARTE FAMILLE', nameX, headerH - 3);

    // ── Thin navy separator ──
    pdf.setFillColor(NAVY.r, NAVY.g, NAVY.b);
    pdf.rect(0, headerH, CARD_W, 0.6, 'F');

    // ═══════ BODY AREA ═══════
    // Left column: family info | Right column: QR code
    const bodyTop = headerH + 2;
    const qrSize = 20;
    const qrX = CARD_W - M - qrSize;
    const qrY = bodyTop + 0.5;
    const infoMaxX = qrX - 3; // text must not go past this

    // ── Family name ──
    pdf.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    const famName = pdf.splitTextToSize(f.nom_famille.toUpperCase(), infoMaxX - M - 1)[0] || f.nom_famille.toUpperCase();
    pdf.text(famName, M + 1, bodyTop + 4);

    // ── Code ──
    let yPos = bodyTop + 7.5;
    if (f.code_plain) {
      pdf.setFontSize(6.5);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(GREEN.r, GREEN.g, GREEN.b);
      pdf.text(f.code_plain, M + 1, yPos);
      yPos += 3.5;
    }

    // ── Contacts ──
    pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
    pdf.setFontSize(5.5);
    pdf.setFont('helvetica', 'normal');
    if (f.telephone_pere) {
      pdf.text(`Père: ${f.telephone_pere}`, M + 1, yPos);
      yPos += 3;
    }
    if (f.telephone_mere) {
      pdf.text(`Mère: ${f.telephone_mere}`, M + 1, yPos);
      yPos += 3;
    }

    // ── Children ──
    pdf.setTextColor(DARK.r, DARK.g, DARK.b);
    pdf.setFontSize(5);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Enfants :', M + 1, yPos + 0.5);
    yPos += 2.8;
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
    const maxTextW = infoMaxX - M - 3;
    const maxKids = Math.min(f.enfants.length, 3);
    for (let c = 0; c < maxKids; c++) {
      const child = f.enfants[c];
      let childText = `• ${child.prenom} ${child.nom}`;
      if (child.classe) childText += ` (${child.classe})`;
      const truncated = pdf.splitTextToSize(childText, maxTextW)[0] || childText;
      pdf.text(truncated, M + 2, yPos);
      yPos += 2.5;
    }
    if (f.enfants.length > 3) {
      pdf.setFontSize(4.5);
      pdf.text(`+ ${f.enfants.length - 3} autre(s)`, M + 2, yPos);
    }

    // ── QR Code ──
    try {
      const qrData = JSON.stringify({ type: 'famille', id: f.id });
      const qrDataUrl = await generateQRDataUrl(qrData);

      // QR frame
      pdf.setDrawColor(NAVY.r, NAVY.g, NAVY.b);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 1.5, 1.5, 'S');
      pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

      // QR label
      pdf.setFontSize(4);
      pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
      pdf.text('Scanner pour accéder', qrX + qrSize / 2, qrY + qrSize + 3.5, { align: 'center' });
    } catch (err) {
      console.error('QR generation error:', err);
    }

    // ── Bottom bar ──
    const footerH = 4.5;
    const footerY = CARD_H - footerH;
    // Gradient bar: red → green
    pdf.setFillColor(RED.r, RED.g, RED.b);
    pdf.rect(0, footerY, CARD_W / 2, footerH, 'F');
    pdf.setFillColor(GREEN.r, GREEN.g, GREEN.b);
    pdf.rect(CARD_W / 2, footerY, CARD_W / 2, footerH, 'F');
    // Bottom rounded corners
    pdf.setFillColor(GREEN.r, GREEN.g, GREEN.b);
    pdf.roundedRect(CARD_W / 2 - 2, footerY, CARD_W / 2 + 2, footerH, 0, 2, 'F');
    pdf.setFillColor(RED.r, RED.g, RED.b);
    pdf.roundedRect(0, footerY, CARD_W / 2 + 2, footerH, 2, 0, 'F');
    pdf.rect(0, footerY, CARD_W / 2 + 2, footerH - 2, 'F');
    pdf.setFillColor(GREEN.r, GREEN.g, GREEN.b);
    pdf.rect(CARD_W / 2, footerY, CARD_W / 2, footerH - 2, 'F');

    pdf.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    pdf.setFontSize(4);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`ID: ${f.id.slice(0, 8).toUpperCase()}  •  Année scolaire 2026-2027`, CARD_W / 2, CARD_H - 1.2, { align: 'center' });
  }

  pdf.save(`badges_familles_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// Generate a single badge
export async function generateSingleBadgeFamillePDF(
  famille: FamilleBadgeData,
  schoolName?: string,
  logoUrl?: string | null,
): Promise<void> {
  return generateBadgeFamillePDF([famille], schoolName, logoUrl);
}
