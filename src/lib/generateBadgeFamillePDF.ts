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

// ── PVC CR80 format (85.6 × 54mm) for planche A4 ──
const PVC_W = 85.6;
const PVC_H = 54;

// ── Portrait format for single cards ──
const CARD_W = 85.6;
const CARD_H = 136;

const RED = { r: 192, g: 20, b: 20 };
const DARK = { r: 30, g: 30, b: 30 };
const GRAY = { r: 100, g: 100, b: 100 };
const WHITE = { r: 255, g: 255, b: 255 };

async function generateQRDataUrl(data: string): Promise<string> {
  return QRCode.toDataURL(data, { width: 600, margin: 1, color: { dark: '#1a1a1a', light: '#ffffff' }, errorCorrectionLevel: 'M' });
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

let bgCache: string | null = null;
async function getBackgroundImage(): Promise<string | null> {
  if (bgCache) return bgCache;
  bgCache = await loadImageAsDataUrl('/images/carte-famille-bg.jpg');
  return bgCache;
}

// ═══════════════════════════════════════════════
// Draw a single PVC card (85.6×54mm) at offset
// ═══════════════════════════════════════════════
async function drawPVCCard(pdf: jsPDF, f: FamilleBadgeData, bgImage: string | null, ox = 0, oy = 0) {
  // Background stretched to PVC dimensions
  if (bgImage) {
    const fmt = bgImage.includes('image/png') ? 'PNG' : 'JPEG';
    pdf.addImage(bgImage, fmt, ox, oy, PVC_W, PVC_H);
  }

  const M = 3;

  // ── QR Code (left side) ──
  const qrSize = 18;
  const qrX = ox + M + 1;
  const qrY = oy + 14;
  try {
    const qrData = JSON.stringify({ type: 'famille', id: f.id });
    const qrDataUrl = await generateQRDataUrl(qrData);
    pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
  } catch {}

  pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
  pdf.setFontSize(3);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Scanner', qrX + qrSize / 2, qrY + qrSize + 2, { align: 'center' });

  // ── Info (right of QR) ──
  const infoX = qrX + qrSize + 4;
  let yPos = oy + 16;

  // Family name
  pdf.setTextColor(DARK.r, DARK.g, DARK.b);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  const maxInfoW = ox + PVC_W - infoX - M;
  const famName = pdf.splitTextToSize(f.nom_famille.toUpperCase(), maxInfoW)[0] || f.nom_famille.toUpperCase();
  pdf.text(famName, infoX, yPos);
  yPos += 4;

  // Code
  if (f.code_plain) {
    pdf.setTextColor(RED.r, RED.g, RED.b);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6);
    pdf.text(f.code_plain, infoX, yPos);
    yPos += 3.5;
  }

  // Phones
  pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
  pdf.setFontSize(4.5);
  pdf.setFont('helvetica', 'normal');
  if (f.telephone_pere) {
    pdf.text(`P: ${f.telephone_pere}`, infoX, yPos);
    yPos += 3;
  }
  if (f.telephone_mere) {
    pdf.text(`M: ${f.telephone_mere}`, infoX, yPos);
    yPos += 3;
  }

  // ── Children (bottom row) ──
  let childY = oy + 37;
  pdf.setTextColor(DARK.r, DARK.g, DARK.b);
  pdf.setFontSize(4);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Enfant(s):', infoX, childY);
  childY += 3;

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
  pdf.setFontSize(4);
  const maxKids = Math.min(f.enfants.length, 3);
  for (let c = 0; c < maxKids; c++) {
    const child = f.enfants[c];
    let childText = `• ${child.prenom} ${child.nom}`;
    if (child.classe) childText += ` (${child.classe})`;
    const truncated = pdf.splitTextToSize(childText, maxInfoW)[0] || childText;
    pdf.text(truncated, infoX, childY);
    childY += 2.8;
  }
  if (f.enfants.length > 3) {
    pdf.setFontSize(3.5);
    pdf.text(`+ ${f.enfants.length - 3} autre(s)`, infoX, childY);
  }

  // ── Footer ID ──
  pdf.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  pdf.setFontSize(2.5);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`ID: ${f.id.slice(0, 8).toUpperCase()}`, ox + PVC_W / 2, oy + PVC_H - 1, { align: 'center' });
}

// ═══════════════════════════════════════════════
// Single card (portrait 85.6×136mm) — original
// ═══════════════════════════════════════════════
export async function generateBadgeFamillePDF(
  familles: FamilleBadgeData[],
  schoolName = 'Les Ecoles la Mame Plus',
  logoUrl?: string | null,
): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [CARD_W, CARD_H] });
  const bgImage = await getBackgroundImage();

  for (let i = 0; i < familles.length; i++) {
    if (i > 0) pdf.addPage([CARD_W, CARD_H], 'portrait');
    const f = familles[i];

    if (bgImage) {
      const fmt = bgImage.includes('image/png') ? 'PNG' : 'JPEG';
      pdf.addImage(bgImage, fmt, 0, 0, CARD_W, CARD_H);
    }

    const M = 6;
    const bodyTop = 38;

    const qrSize = 34;
    const qrX = (CARD_W - qrSize) / 2;
    const qrY = bodyTop;
    try {
      const qrData = JSON.stringify({ type: 'famille', id: f.id });
      const qrDataUrl = await generateQRDataUrl(qrData);
      pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    } catch (err) {
      console.error('QR generation error:', err);
    }

    pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
    pdf.setFontSize(4.5);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Scanner pour accéder', CARD_W / 2, qrY + qrSize + 3, { align: 'center' });

    let yPos = qrY + qrSize + 9;

    pdf.setTextColor(DARK.r, DARK.g, DARK.b);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    const famName = pdf.splitTextToSize(f.nom_famille.toUpperCase(), CARD_W - M * 2)[0] || f.nom_famille.toUpperCase();
    pdf.text(famName, CARD_W / 2, yPos, { align: 'center' });
    yPos += 5;

    if (f.code_plain) {
      pdf.setTextColor(RED.r, RED.g, RED.b);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text(f.code_plain, CARD_W / 2, yPos, { align: 'center' });
      yPos += 5;
    }

    pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');
    if (f.telephone_pere) {
      pdf.text(`Père: ${f.telephone_pere}`, CARD_W / 2, yPos, { align: 'center' });
      yPos += 3.5;
    }
    if (f.telephone_mere) {
      pdf.text(`Mère: ${f.telephone_mere}`, CARD_W / 2, yPos, { align: 'center' });
      yPos += 3.5;
    }

    yPos += 3;
    pdf.setTextColor(DARK.r, DARK.g, DARK.b);
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Enfant(s) :', M + 2, yPos);
    yPos += 4;

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
    pdf.setFontSize(6);
    const maxKids = Math.min(f.enfants.length, 5);
    for (let c = 0; c < maxKids; c++) {
      const child = f.enfants[c];
      let childText = `• ${child.prenom} ${child.nom}`;
      if (child.classe) childText += ` (${child.classe})`;
      const truncated = pdf.splitTextToSize(childText, CARD_W - M * 2 - 4)[0] || childText;
      pdf.text(truncated, M + 4, yPos);
      yPos += 3.5;
    }
    if (f.enfants.length > 5) {
      pdf.setFontSize(5);
      pdf.text(`+ ${f.enfants.length - 5} autre(s)`, M + 4, yPos);
    }

    pdf.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    pdf.setFontSize(3.5);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`ID: ${f.id.slice(0, 8).toUpperCase()}  •  Année scolaire 2026-2027`, CARD_W / 2, CARD_H - 1, { align: 'center' });
  }

  pdf.save(`badges_familles_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ═══════════════════════════════════════════════
// Planche A4 — 2 colonnes × 3 lignes (portrait)
// ═══════════════════════════════════════════════
export async function generatePlancheBadgesFamillePDF(
  familles: FamilleBadgeData[],
  schoolName = 'Les Ecoles la Mame Plus',
  logoUrl?: string | null,
): Promise<void> {
  if (familles.length === 0) return;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const bgImage = await getBackgroundImage();

  const pageW = 210;
  const pageH = 297;
  const gap = 2;
  const cols = 2;
  const rows = 3;
  const cardsPerPage = cols * rows;

  // Scale card to fit 3 rows on A4
  const maxCardH = (pageH - gap * (rows - 1) - 8) / rows; // ~95mm
  const scale = maxCardH / CARD_H;
  const cW = CARD_W * scale;
  const cH = maxCardH;

  const gridW = cW * cols + gap * (cols - 1);
  const gridH = cH * rows + gap * (rows - 1);
  const marginX = (pageW - gridW) / 2;
  const marginY = (pageH - gridH) / 2;

  for (let i = 0; i < familles.length; i++) {
    const posOnPage = i % cardsPerPage;
    const col = posOnPage % cols;
    const row = Math.floor(posOnPage / cols);

    if (i > 0 && posOnPage === 0) {
      pdf.addPage();
    }

    const ox = marginX + col * (cW + gap);
    const oy = marginY + row * (cH + gap);
    const f = familles[i];

    // Background
    if (bgImage) {
      const fmt = bgImage.includes('image/png') ? 'PNG' : 'JPEG';
      pdf.addImage(bgImage, fmt, ox, oy, cW, cH);
    }

    const M = 4 * scale;
    const s = scale; // shorthand

    // QR Code
    const qrSize = 34 * s;
    const qrX = ox + (cW - qrSize) / 2;
    const qrY = oy + 38 * s;
    try {
      const qrData = JSON.stringify({ type: 'famille', id: f.id });
      const qrDataUrl = await generateQRDataUrl(qrData);
      pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    } catch {}

    pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
    pdf.setFontSize(4.5 * s);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Scanner pour accéder', ox + cW / 2, qrY + qrSize + 2.5 * s, { align: 'center' });

    let yPos = qrY + qrSize + 7 * s;

    // Family name
    pdf.setTextColor(DARK.r, DARK.g, DARK.b);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10 * s);
    const famName = pdf.splitTextToSize(f.nom_famille.toUpperCase(), cW - M * 2)[0] || f.nom_famille.toUpperCase();
    pdf.text(famName, ox + cW / 2, yPos, { align: 'center' });
    yPos += 4 * s;

    // Code
    if (f.code_plain) {
      pdf.setTextColor(RED.r, RED.g, RED.b);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8 * s);
      pdf.text(f.code_plain, ox + cW / 2, yPos, { align: 'center' });
      yPos += 4 * s;
    }

    // Phones
    pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
    pdf.setFontSize(6 * s);
    pdf.setFont('helvetica', 'normal');
    if (f.telephone_pere) {
      pdf.text(`Père: ${f.telephone_pere}`, ox + cW / 2, yPos, { align: 'center' });
      yPos += 3 * s;
    }
    if (f.telephone_mere) {
      pdf.text(`Mère: ${f.telephone_mere}`, ox + cW / 2, yPos, { align: 'center' });
      yPos += 3 * s;
    }

    // Children
    yPos += 2 * s;
    pdf.setTextColor(DARK.r, DARK.g, DARK.b);
    pdf.setFontSize(5.5 * s);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Enfant(s) :', ox + M + 2 * s, yPos);
    yPos += 3.5 * s;

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
    pdf.setFontSize(5.5 * s);
    const maxKids = Math.min(f.enfants.length, 4);
    for (let c = 0; c < maxKids; c++) {
      const child = f.enfants[c];
      let childText = `• ${child.prenom} ${child.nom}`;
      if (child.classe) childText += ` (${child.classe})`;
      const truncated = pdf.splitTextToSize(childText, cW - M * 2 - 4 * s)[0] || childText;
      pdf.text(truncated, ox + M + 3 * s, yPos);
      yPos += 3 * s;
    }
    if (f.enfants.length > 4) {
      pdf.setFontSize(4.5 * s);
      pdf.text(`+ ${f.enfants.length - 4} autre(s)`, ox + M + 3 * s, yPos);
    }

    // Footer
    pdf.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    pdf.setFontSize(3 * s);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`ID: ${f.id.slice(0, 8).toUpperCase()}`, ox + cW / 2, oy + cH - 1 * s, { align: 'center' });

    // Crop marks
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.1);
    const m = 3;
    pdf.line(ox - 1, oy, ox - 1 - m, oy);
    pdf.line(ox, oy - 1, ox, oy - 1 - m);
    pdf.line(ox + cW + 1, oy, ox + cW + 1 + m, oy);
    pdf.line(ox + cW, oy - 1, ox + cW, oy - 1 - m);
    pdf.line(ox - 1, oy + cH, ox - 1 - m, oy + cH);
    pdf.line(ox, oy + cH + 1, ox, oy + cH + 1 + m);
    pdf.line(ox + cW + 1, oy + cH, ox + cW + 1 + m, oy + cH);
    pdf.line(ox + cW, oy + cH + 1, ox + cW, oy + cH + 1 + m);
  }

  pdf.save(`planche_badges_familles_${familles.length}.pdf`);
}

export async function generateSingleBadgeFamillePDF(
  famille: FamilleBadgeData,
  schoolName?: string,
  logoUrl?: string | null,
): Promise<void> {
  return generateBadgeFamillePDF([famille], schoolName, logoUrl);
}
