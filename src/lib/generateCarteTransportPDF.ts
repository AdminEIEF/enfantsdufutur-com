import jsPDF from 'jspdf';
import QRCode from 'qrcode';

/**
 * PVC CR80 card: 85.6mm × 54mm (strict, non-responsive)
 * All positions are ABSOLUTE in mm from card origin.
 * QR Code minimum 20×20mm with 2mm quiet zone.
 * Images rendered at 300 DPI equivalent (scale factor ×3).
 */
const CARD_W = 85.6;
const CARD_H = 54;

// ── Absolute positions (mm from card top-left) ──
const LOGO_X = 4;
const LOGO_Y = 2.5;
const LOGO_SIZE = 9;

const SCHOOL_NAME_Y = 8;

const PHOTO_X = 5;
const PHOTO_Y = 15;
const PHOTO_W = 16;
const PHOTO_H = 21;

const INFO_X = 24;
const NAME_Y = 19;
const MATRICULE_LABEL_Y = 23.5;
const MATRICULE_VALUE_Y = 27;
const LIGNE_Y = 32;
const BADGE_Y = 35;

const QR_SIZE = 20; // minimum 20mm for Hikvision
const QR_QUIET = 2; // 2mm white quiet zone
const QR_X = CARD_W - QR_SIZE - QR_QUIET - 3;
const QR_Y = 15;

const FOOTER_Y = CARD_H - 2.5;

interface CardData {
  prenom: string;
  nom: string;
  matricule: string;
  photoUrl?: string | null;
  zoneName: string;
  schoolName: string;
  schoolLogoUrl?: string | null;
  schoolVille?: string;
  rechargeActive: boolean;
  dateExpiration?: string;
}

async function loadImageAsDataURL(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();
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

async function generateQRDataURL(data: string): Promise<string> {
  // 1200px for a 20mm print area ≈ 1524 DPI effective resolution
  return QRCode.toDataURL(data, {
    width: 1200,
    margin: 0,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}

// ── Footer gradient bar (matching badge scolaire style) ──
function drawFooterBar(pdf: jsPDF, ox: number, oy: number) {
  const barH = CARD_H * 0.08; // 8% of card height
  const barY = oy + CARD_H - barH;
  const barW = CARD_W;
  const steps = 4;
  const colors = [
    [192, 57, 43],   // #c0392b
    [169, 50, 38],   // #a93226
    [30, 132, 73],   // #1e8449
    [25, 111, 61],   // #196f3d
  ];
  const stepW = barW / steps;
  for (let i = 0; i < steps; i++) {
    pdf.setFillColor(colors[i][0], colors[i][1], colors[i][2]);
    pdf.rect(ox + i * stepW, barY, stepW + 0.5, barH, 'F');
  }
}

// ── Draw one card at absolute offset ──
async function drawSingleCard(pdf: jsPDF, card: CardData, ox = 0, oy = 0) {
  // 1. Card background
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(ox, oy, CARD_W, CARD_H, 3, 3, 'F');

  // Subtle cream tint top half
  pdf.setFillColor(254, 252, 248);
  pdf.setGState(new (pdf as any).GState({ opacity: 0.6 }));
  pdf.rect(ox + 1, oy + 1, CARD_W - 2, CARD_H * 0.5, 'F');
  pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

  // Border
  pdf.setDrawColor(190, 195, 210);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(ox, oy, CARD_W, CARD_H, 3, 3, 'S');

  pdf.saveGraphicsState();

  // 2. Footer bar (always rendered)
  drawFooterBar(pdf, ox, oy);

  // (no header line)

  // 3. School logo (absolute position)
  if (card.schoolLogoUrl) {
    try {
      const logoData = await loadImageAsDataURL(card.schoolLogoUrl);
      if (logoData) {
        pdf.addImage(logoData, 'PNG', ox + LOGO_X, oy + LOGO_Y, LOGO_SIZE, LOGO_SIZE);
      }
    } catch {}
  }

  // 4. School name
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(220, 38, 38);
  const schoolNameX = card.schoolLogoUrl ? ox + LOGO_X + LOGO_SIZE + 3 : ox + CARD_W / 2;
  const schoolAlign = card.schoolLogoUrl ? 'left' : 'center';
  pdf.text(card.schoolName.toUpperCase(), schoolNameX, oy + SCHOOL_NAME_Y, { align: schoolAlign as any });

  // 5. Photo (absolute position)
  pdf.setFillColor(243, 244, 246);
  pdf.roundedRect(ox + PHOTO_X, oy + PHOTO_Y, PHOTO_W, PHOTO_H, 1.5, 1.5, 'F');
  pdf.setDrawColor(210, 215, 225);
  pdf.setLineWidth(0.25);
  pdf.roundedRect(ox + PHOTO_X, oy + PHOTO_Y, PHOTO_W, PHOTO_H, 1.5, 1.5, 'S');

  if (card.photoUrl) {
    try {
      const photoData = await loadImageAsDataURL(card.photoUrl);
      if (photoData) {
        pdf.addImage(photoData, 'JPEG', ox + PHOTO_X + 0.4, oy + PHOTO_Y + 0.4, PHOTO_W - 0.8, PHOTO_H - 0.8);
      }
    } catch {}
  } else {
    pdf.setFontSize(5);
    pdf.setTextColor(156, 163, 175);
    pdf.text('Photo', ox + PHOTO_X + PHOTO_W / 2, oy + PHOTO_Y + PHOTO_H / 2 + 1, { align: 'center' });
  }

  // 6. Student name (absolute)
  const ix = ox + INFO_X;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(31, 41, 55);
  const fullName = `${card.prenom} ${card.nom}`;
  // Truncate if too long to avoid overlapping QR
  const maxNameW = QR_X - INFO_X - 2;
  pdf.text(fullName, ix, oy + NAME_Y, { maxWidth: maxNameW });

  // 7. Matricule (absolute)
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(4);
  pdf.setTextColor(156, 163, 175);
  pdf.text('MATRICULE', ix, oy + MATRICULE_LABEL_Y);
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(6.5);
  pdf.setTextColor(55, 65, 81);
  pdf.text(card.matricule || '—', ix, oy + MATRICULE_VALUE_Y);

  // 8. Zone / Ligne (absolute — centered in blue badge)
  const ligneText = `LIGNE : ${card.zoneName}`;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(5.5);
  const ligneTextW = pdf.getTextWidth(ligneText);
  const ligneBadgeW = ligneTextW + 4; // 2mm padding each side
  const ligneBadgeH = 4;
  const ligneBadgeX = ix;
  const ligneBadgeY = oy + LIGNE_Y - 3;
  // Badge background
  pdf.setFillColor(239, 246, 255); // #EFF6FF
  pdf.setDrawColor(191, 219, 254); // #BFDBFE
  pdf.setLineWidth(0.2);
  pdf.roundedRect(ligneBadgeX, ligneBadgeY, ligneBadgeW, ligneBadgeH, 1, 1, 'FD');
  // Text centered in badge
  pdf.setTextColor(30, 64, 175);
  pdf.text(ligneText, ligneBadgeX + ligneBadgeW / 2, ligneBadgeY + ligneBadgeH / 2 + 1, { align: 'center' });

  // 9. Active badge (absolute)
  if (card.rechargeActive && card.dateExpiration) {
    pdf.setFillColor(209, 250, 229);
    pdf.roundedRect(ix, oy + BADGE_Y, 11, 3.5, 1, 1, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(3.5);
    pdf.setTextColor(6, 95, 70);
    pdf.text('ACTIVE', ix + 5.5, oy + BADGE_Y + 2.6, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(4);
    pdf.setTextColor(107, 114, 128);
    pdf.text(`Exp. ${card.dateExpiration}`, ix + 13, oy + BADGE_Y + 2.6);
  }

  // 10. QR Code (absolute position, 20×20mm + 2mm quiet zone)
  const qrBoxX = ox + QR_X - QR_QUIET;
  const qrBoxY = oy + QR_Y - QR_QUIET;
  const qrBoxSize = QR_SIZE + QR_QUIET * 2;

  // White quiet zone background
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(220, 225, 235);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 1.5, 1.5, 'FD');

  try {
    const qrData = JSON.stringify({ type: 'transport', matricule: card.matricule, id: card.matricule });
    const qrDataURL = await generateQRDataURL(qrData);
    pdf.addImage(qrDataURL, 'PNG', ox + QR_X, oy + QR_Y, QR_SIZE, QR_SIZE);
  } catch {}

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(3);
  pdf.setTextColor(140, 145, 160);
  pdf.text('Scanner pour valider', ox + QR_X + QR_SIZE / 2, oy + QR_Y + QR_SIZE + QR_QUIET + 1.5, { align: 'center' });

  // 11. Footer (absolute)
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(3.5);
  pdf.setTextColor(255, 255, 255);
  pdf.text(card.schoolVille || 'Conakry, Guinée', ox + 5, oy + FOOTER_Y);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(3);
  pdf.setTextColor(255, 255, 255);
  pdf.text('Carte permanente • Rechargeable', ox + CARD_W - 5, oy + FOOTER_Y, { align: 'right' });

  pdf.restoreGraphicsState();
}

// ── Public exports ──

export interface TransportCardExportData {
  id: string;
  prenom: string;
  nom: string;
  matricule: string;
  photoUrl?: string | null;
  zoneName: string;
  rechargeActive: boolean;
  dateExpiration?: string;
}

/**
 * Export a single card as PDF at exact PVC CR80 dimensions (85.6×54mm).
 */
export async function exportSingleTransportCard(
  card: TransportCardExportData,
  schoolName: string,
  schoolLogoUrl?: string | null,
  schoolVille?: string
): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [CARD_W, CARD_H],
  });

  await drawSingleCard(pdf, {
    prenom: card.prenom,
    nom: card.nom,
    matricule: card.matricule,
    photoUrl: card.photoUrl,
    zoneName: card.zoneName,
    schoolName,
    schoolLogoUrl,
    schoolVille,
    rechargeActive: card.rechargeActive,
    dateExpiration: card.dateExpiration,
  });

  pdf.save(`carte_transport_${card.matricule || card.id}.pdf`);
}

/**
 * Export multiple cards on A4 pages (2 columns, centered).
 * Each card keeps strict 85.6×54mm dimensions.
 */
/**
 * Export multiple cards on A4 pages.
 * Planche mode: 2 columns × 5 rows = 10 cards/page, 2mm gaps, crop marks.
 */
export async function exportBulkTransportCards(
  cards: TransportCardExportData[],
  schoolName: string,
  schoolLogoUrl?: string | null,
  schoolVille?: string
): Promise<void> {
  if (cards.length === 0) return;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = 210;
  const pageH = 297;
  const gap = 2; // 2mm entre chaque carte pour découpe massicot
  const cols = 2;
  const rows = 5;
  const cardsPerPage = cols * rows;

  // Centre la grille sur la page
  const gridW = CARD_W * cols + gap * (cols - 1);
  const gridH = CARD_H * rows + gap * (rows - 1);
  const marginX = (pageW - gridW) / 2;
  const marginY = (pageH - gridH) / 2;

  for (let i = 0; i < cards.length; i++) {
    const posOnPage = i % cardsPerPage;
    const col = posOnPage % cols;
    const row = Math.floor(posOnPage / cols);

    if (i > 0 && posOnPage === 0) {
      pdf.addPage();
    }

    const ox = marginX + col * (CARD_W + gap);
    const oy = marginY + row * (CARD_H + gap);

    await drawSingleCard(pdf, {
      prenom: cards[i].prenom,
      nom: cards[i].nom,
      matricule: cards[i].matricule,
      photoUrl: cards[i].photoUrl,
      zoneName: cards[i].zoneName,
      schoolName,
      schoolLogoUrl,
      schoolVille,
      rechargeActive: cards[i].rechargeActive,
      dateExpiration: cards[i].dateExpiration,
    }, ox, oy);

    // Repères de découpe (crop marks)
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.1);
    const m = 3;
    // Coins
    pdf.line(ox - 1, oy, ox - 1 - m, oy);
    pdf.line(ox, oy - 1, ox, oy - 1 - m);
    pdf.line(ox + CARD_W + 1, oy, ox + CARD_W + 1 + m, oy);
    pdf.line(ox + CARD_W, oy - 1, ox + CARD_W, oy - 1 - m);
    pdf.line(ox - 1, oy + CARD_H, ox - 1 - m, oy + CARD_H);
    pdf.line(ox, oy + CARD_H + 1, ox, oy + CARD_H + 1 + m);
    pdf.line(ox + CARD_W + 1, oy + CARD_H, ox + CARD_W + 1 + m, oy + CARD_H);
    pdf.line(ox + CARD_W, oy + CARD_H + 1, ox + CARD_W, oy + CARD_H + 1 + m);
  }

  pdf.save(`planche_cartes_transport_${cards.length}.pdf`);
}
