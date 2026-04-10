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

// Badge dimensions (mm) - portrait card like the model
const CARD_W = 85.6;
const CARD_H = 136; // portrait ratio matching the template

// Colors
const RED = { r: 192, g: 20, b: 20 };
const GREEN = { r: 0, g: 140, b: 50 };
const DARK = { r: 30, g: 30, b: 30 };
const GRAY = { r: 100, g: 100, b: 100 };
const WHITE = { r: 255, g: 255, b: 255 };

async function generateQRDataUrl(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    width: 400,
    margin: 1,
    color: { dark: '#1a1a1a', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
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
  } catch {
    return null;
  }
}

function drawCardBackground(pdf: jsPDF) {
  // White background
  pdf.setFillColor(WHITE.r, WHITE.g, WHITE.b);
  pdf.rect(0, 0, CARD_W, CARD_H, 'F');

  // ── Top section: diagonal red/green design ──
  const headerH = 32;

  // Yellow triangle (left background)
  pdf.setFillColor(230, 190, 30);
  pdf.triangle(0, 0, CARD_W * 0.55, 0, 0, headerH + 8, 'F');

  // Red diagonal band
  pdf.setFillColor(RED.r, RED.g, RED.b);
  pdf.triangle(CARD_W * 0.2, 0, CARD_W, 0, CARD_W, headerH - 4, 'F');
  pdf.triangle(CARD_W * 0.2, 0, CARD_W, headerH - 4, CARD_W * 0.35, headerH + 8, 'F');

  // Green block top-right
  pdf.setFillColor(GREEN.r, GREEN.g, GREEN.b);
  pdf.rect(CARD_W * 0.52, 0, CARD_W * 0.48, headerH * 0.45, 'F');

  // Green triangle for "CARTE DE FAMILLE"
  pdf.setFillColor(GREEN.r, GREEN.g, GREEN.b);
  const ctY = headerH * 0.45;
  pdf.triangle(CARD_W * 0.35, ctY, CARD_W, ctY, CARD_W, headerH + 2, 'F');
  pdf.triangle(CARD_W * 0.35, ctY, CARD_W, headerH + 2, CARD_W * 0.48, headerH + 2, 'F');

  // School name text in red/green area
  pdf.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(5.5);
  pdf.text('ECOLE INTERNATIONALE', CARD_W * 0.75, 5, { align: 'center' });
  pdf.setFontSize(7);
  pdf.text('LES ENFANTS DU FUTUR', CARD_W * 0.75, 10, { align: 'center' });

  // "CARTE DE FAMILLE" text
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text('CARTE DE FAMILLE', CARD_W * 0.72, headerH * 0.45 + (headerH * 0.55) / 2 + 2, { align: 'center' });

  // ── Bottom bar: red left + green right ──
  const footerH = 4;
  const footerY = CARD_H - footerH;
  pdf.setFillColor(RED.r, RED.g, RED.b);
  pdf.rect(0, footerY, CARD_W / 2, footerH, 'F');
  pdf.setFillColor(GREEN.r, GREEN.g, GREEN.b);
  pdf.rect(CARD_W / 2, footerY, CARD_W / 2, footerH, 'F');
}

async function drawLogoCircle(pdf: jsPDF, logoUrl?: string | null) {
  const cx = 16;
  const cy = 16;
  const r = 12;

  // White circle background
  pdf.setFillColor(WHITE.r, WHITE.g, WHITE.b);
  pdf.circle(cx, cy, r + 1, 'F');

  // Green circle border
  pdf.setDrawColor(GREEN.r, GREEN.g, GREEN.b);
  pdf.setLineWidth(0.8);
  pdf.circle(cx, cy, r, 'S');

  if (logoUrl) {
    const logoData = await loadImageAsDataUrl(logoUrl);
    if (logoData) {
      try {
        const fmt = logoData.includes('image/png') ? 'PNG' : 'JPEG';
        pdf.addImage(logoData, fmt, cx - r + 2, cy - r + 2, (r - 2) * 2, (r - 2) * 2);
      } catch { /* fallback */ }
    }
  }

  // "FAISONS PLUS !" text under logo
  pdf.setTextColor(RED.r, RED.g, RED.b);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(4.5);
  pdf.text('FAISONS PLUS !', cx, cy + r + 3, { align: 'center' });
}

export async function generateBadgeFamillePDF(
  familles: FamilleBadgeData[],
  schoolName = 'Ecole Internationale Les Enfants du Futur',
  logoUrl?: string | null,
): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [CARD_W, CARD_H] });

  for (let i = 0; i < familles.length; i++) {
    if (i > 0) pdf.addPage([CARD_W, CARD_H], 'portrait');
    const f = familles[i];

    // ── Draw background ──
    drawCardBackground(pdf);

    // ── Draw logo circle ──
    await drawLogoCircle(pdf, logoUrl);

    // ══════ BODY AREA ══════
    const bodyTop = 38;
    const M = 5; // margin

    // ── QR Code on the left ──
    const qrSize = 24;
    const qrX = M + 2;
    const qrY = bodyTop + 2;

    try {
      const qrData = JSON.stringify({ type: 'famille', id: f.id });
      const qrDataUrl = await generateQRDataUrl(qrData);
      pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    } catch (err) {
      console.error('QR generation error:', err);
    }

    // ── "Scanner pour accéder" under QR ──
    pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
    pdf.setFontSize(4);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Scanner pour accéder', qrX + qrSize / 2, qrY + qrSize + 3, { align: 'center' });

    // ── Right side: "Compte Famille" label ──
    const infoX = qrX + qrSize + 5;
    const infoMaxW = CARD_W - infoX - M;
    let yPos = bodyTop + 4;

    pdf.setTextColor(GREEN.r, GREEN.g, GREEN.b);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6);
    pdf.text('Compte Famille Individuel', infoX, yPos);
    yPos += 5;

    // ── Family name ──
    pdf.setTextColor(DARK.r, DARK.g, DARK.b);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    const famName = pdf.splitTextToSize(f.nom_famille.toUpperCase(), infoMaxW)[0] || f.nom_famille.toUpperCase();
    pdf.text(famName, infoX, yPos);
    yPos += 5;

    // ── Code ──
    if (f.code_plain) {
      pdf.setTextColor(RED.r, RED.g, RED.b);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text(f.code_plain, infoX, yPos);
      yPos += 5;
    }

    // ── Phone ──
    pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');
    if (f.telephone_pere) {
      pdf.text(`Père: ${f.telephone_pere}`, infoX, yPos);
      yPos += 3.5;
    }
    if (f.telephone_mere) {
      pdf.text(`Mère: ${f.telephone_mere}`, infoX, yPos);
      yPos += 3.5;
    }

    // ── Children section (full width below QR + info) ──
    const childrenTop = Math.max(yPos, qrY + qrSize + 8) + 4;
    let cY = childrenTop;

    pdf.setTextColor(DARK.r, DARK.g, DARK.b);
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Enfant(s) :', M + 2, cY);
    cY += 4;

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
    pdf.setFontSize(6);
    const maxKids = Math.min(f.enfants.length, 5);
    for (let c = 0; c < maxKids; c++) {
      const child = f.enfants[c];
      let childText = `• ${child.prenom} ${child.nom}`;
      if (child.classe) childText += ` (${child.classe})`;
      const truncated = pdf.splitTextToSize(childText, CARD_W - M * 2 - 4)[0] || childText;
      pdf.text(truncated, M + 4, cY);
      cY += 3.5;
    }
    if (f.enfants.length > 5) {
      pdf.setFontSize(5);
      pdf.text(`+ ${f.enfants.length - 5} autre(s)`, M + 4, cY);
    }

    // ── Footer text ──
    pdf.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    pdf.setFontSize(3.5);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`ID: ${f.id.slice(0, 8).toUpperCase()}  •  Année scolaire 2026-2027`, CARD_W / 2, CARD_H - 1, { align: 'center' });
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
