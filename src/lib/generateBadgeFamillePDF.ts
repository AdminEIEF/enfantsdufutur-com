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

const CARD_W = 85.6;
const CARD_H = 136;

const RED = { r: 192, g: 20, b: 20 };
const GREEN = { r: 0, g: 140, b: 50 };
const DARK = { r: 30, g: 30, b: 30 };
const GRAY = { r: 100, g: 100, b: 100 };
const WHITE = { r: 255, g: 255, b: 255 };

async function generateQRDataUrl(data: string): Promise<string> {
  return QRCode.toDataURL(data, { width: 400, margin: 1, color: { dark: '#1a1a1a', light: '#ffffff' }, errorCorrectionLevel: 'M' });
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

// Pre-load the background template once
let bgCache: string | null = null;
async function getBackgroundImage(): Promise<string | null> {
  if (bgCache) return bgCache;
  bgCache = await loadImageAsDataUrl('/images/carte-famille-bg.jpg');
  return bgCache;
}

export async function generateBadgeFamillePDF(
  familles: FamilleBadgeData[],
  schoolName = 'Ecole Internationale Les Enfants du Futur',
  logoUrl?: string | null,
): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [CARD_W, CARD_H] });
  const bgImage = await getBackgroundImage();

  for (let i = 0; i < familles.length; i++) {
    if (i > 0) pdf.addPage([CARD_W, CARD_H], 'portrait');
    const f = familles[i];

    // ── Background image (the actual template) ──
    if (bgImage) {
      const fmt = bgImage.includes('image/png') ? 'PNG' : 'JPEG';
      pdf.addImage(bgImage, fmt, 0, 0, CARD_W, CARD_H);
    }

    // ══════ OVERLAY DATA ══════
    const M = 6;
    const bodyTop = 40; // below the header design

    // ── QR Code ──
    const qrSize = 22;
    const qrX = M + 1;
    const qrY = bodyTop;
    try {
      const qrData = JSON.stringify({ type: 'famille', id: f.id });
      const qrDataUrl = await generateQRDataUrl(qrData);
      pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    } catch (err) {
      console.error('QR generation error:', err);
    }

    pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
    pdf.setFontSize(4);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Scanner pour accéder', qrX + qrSize / 2, qrY + qrSize + 3, { align: 'center' });

    // ── Right side info ──
    const infoX = qrX + qrSize + 4;
    const infoMaxW = CARD_W - infoX - M;
    let yPos = bodyTop + 3;

    // "Compte Famille Individuel"
    pdf.setTextColor(GREEN.r, GREEN.g, GREEN.b);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6);
    pdf.text('Compte Famille Individuel', infoX, yPos);
    yPos += 5;

    // Family name
    pdf.setTextColor(DARK.r, DARK.g, DARK.b);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    const famName = pdf.splitTextToSize(f.nom_famille.toUpperCase(), infoMaxW)[0] || f.nom_famille.toUpperCase();
    pdf.text(famName, infoX, yPos);
    yPos += 5;

    // Code
    if (f.code_plain) {
      pdf.setTextColor(RED.r, RED.g, RED.b);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text(f.code_plain, infoX, yPos);
      yPos += 5;
    }

    // Phone
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

    // ── Children ──
    const childrenTop = Math.max(yPos, qrY + qrSize + 8) + 3;
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

    // ── Footer ID ──
    pdf.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    pdf.setFontSize(3.5);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`ID: ${f.id.slice(0, 8).toUpperCase()}  •  Année scolaire 2026-2027`, CARD_W / 2, CARD_H - 1, { align: 'center' });
  }

  pdf.save(`badges_familles_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function generateSingleBadgeFamillePDF(
  famille: FamilleBadgeData,
  schoolName?: string,
  logoUrl?: string | null,
): Promise<void> {
  return generateBadgeFamillePDF([famille], schoolName, logoUrl);
}
