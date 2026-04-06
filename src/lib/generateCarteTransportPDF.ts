import jsPDF from 'jspdf';
import QRCode from 'qrcode';

/**
 * PVC CR80 card: 85.6mm × 54mm
 * jsPDF uses mm units natively — pixel-perfect for print.
 */
const CARD_W = 85.6;
const CARD_H = 54;

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
  return QRCode.toDataURL(data, {
    width: 300,
    margin: 0,
    errorCorrectionLevel: 'H',
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}

function drawWaves(pdf: jsPDF) {
  // Red wave
  pdf.setFillColor(248, 113, 113);
  pdf.setGState(new (pdf as any).GState({ opacity: 0.6 }));
  
  // Approximate wave with a filled polygon
  const redWavePoints: [number, number][] = [];
  for (let x = 0; x <= CARD_W; x += 0.5) {
    const t = x / CARD_W;
    // Sinusoidal wave
    const y = CARD_H - 18 + Math.sin(t * Math.PI * 2.5 + 0.5) * 6 + Math.cos(t * Math.PI * 1.5) * 3;
    redWavePoints.push([x, y]);
  }
  redWavePoints.push([CARD_W, CARD_H]);
  redWavePoints.push([0, CARD_H]);

  pdf.moveTo(redWavePoints[0][0], redWavePoints[0][1]);
  for (let i = 1; i < redWavePoints.length; i++) {
    pdf.lineTo(redWavePoints[i][0], redWavePoints[i][1]);
  }
  pdf.fill();

  // Green wave
  pdf.setFillColor(74, 222, 128);
  pdf.setGState(new (pdf as any).GState({ opacity: 0.5 }));

  const greenWavePoints: [number, number][] = [];
  for (let x = 0; x <= CARD_W; x += 0.5) {
    const t = x / CARD_W;
    const y = CARD_H - 14 + Math.sin(t * Math.PI * 2 + 1) * 5 + Math.cos(t * Math.PI * 1.8 + 0.3) * 3;
    greenWavePoints.push([x, y]);
  }
  greenWavePoints.push([CARD_W, CARD_H]);
  greenWavePoints.push([0, CARD_H]);

  pdf.moveTo(greenWavePoints[0][0], greenWavePoints[0][1]);
  for (let i = 1; i < greenWavePoints.length; i++) {
    pdf.lineTo(greenWavePoints[i][0], greenWavePoints[i][1]);
  }
  pdf.fill();

  // Reset opacity
  pdf.setGState(new (pdf as any).GState({ opacity: 1 }));
}

async function drawSingleCard(pdf: jsPDF, card: CardData, offsetX = 0, offsetY = 0) {
  const x = offsetX;
  const y = offsetY;

  // White background with rounded corners
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(x, y, CARD_W, CARD_H, 3, 3, 'F');

  // Border
  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(x, y, CARD_W, CARD_H, 3, 3, 'S');

  // Save state and clip to card area for waves
  pdf.saveGraphicsState();
  // Draw waves relative to card position
  const savedX = x;
  const savedY = y;
  
  // Waves at bottom
  drawWavesAt(pdf, x, y);

  // Reset opacity
  pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

  // School header
  let headerX = x + CARD_W / 2;
  let logoOffset = 0;

  if (card.schoolLogoUrl) {
    try {
      const logoData = await loadImageAsDataURL(card.schoolLogoUrl);
      if (logoData) {
        const logoSize = 8;
        pdf.addImage(logoData, 'PNG', x + CARD_W / 2 - 18, y + 2.5, logoSize, logoSize);
        logoOffset = 5;
      }
    } catch {}
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(220, 38, 38); // red-600
  pdf.text(card.schoolName.toUpperCase(), x + CARD_W / 2 + logoOffset, y + 7.5, { align: 'center' });

  // Photo
  const photoX = x + 5;
  const photoY = y + 13;
  const photoW = 15;
  const photoH = 20;

  pdf.setFillColor(243, 244, 246);
  pdf.roundedRect(photoX, photoY, photoW, photoH, 1.5, 1.5, 'F');
  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.2);
  pdf.roundedRect(photoX, photoY, photoW, photoH, 1.5, 1.5, 'S');

  if (card.photoUrl) {
    try {
      const photoData = await loadImageAsDataURL(card.photoUrl);
      if (photoData) {
        // Clip to rounded rect area
        pdf.addImage(photoData, 'JPEG', photoX + 0.3, photoY + 0.3, photoW - 0.6, photoH - 0.6);
      }
    } catch {}
  } else {
    pdf.setFontSize(5);
    pdf.setTextColor(156, 163, 175);
    pdf.text('Photo', photoX + photoW / 2, photoY + photoH / 2 + 1, { align: 'center' });
  }

  // Student name
  const infoX = x + 23;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(31, 41, 55);
  pdf.text(`${card.prenom} ${card.nom}`, infoX, y + 17);

  // Matricule
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(4);
  pdf.setTextColor(156, 163, 175);
  pdf.text('MATRICULE', infoX, y + 21);
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(6);
  pdf.setTextColor(55, 65, 81);
  pdf.text(card.matricule || '—', infoX, y + 24);

  // Zone/Ligne
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(5);
  pdf.setTextColor(30, 64, 175); // blue-800
  pdf.text(`📍 LIGNE : ${card.zoneName}`, infoX, y + 29);

  // Active badge
  if (card.rechargeActive && card.dateExpiration) {
    pdf.setFillColor(209, 250, 229); // green-100
    pdf.roundedRect(infoX, y + 31, 10, 3.5, 1, 1, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(3.5);
    pdf.setTextColor(6, 95, 70);
    pdf.text('● ACTIVE', infoX + 5, y + 33.3, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(4);
    pdf.setTextColor(107, 114, 128);
    pdf.text(`Expire le ${card.dateExpiration}`, infoX + 12, y + 33.3);
  }

  // QR Code
  const qrSize = 17;
  const qrX = x + CARD_W - qrSize - 6;
  const qrY = y + 14;

  // QR background
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(qrX - 1.5, qrY - 1.5, qrSize + 3, qrSize + 3, 1.5, 1.5, 'FD');

  try {
    const qrData = JSON.stringify({ type: 'transport', matricule: card.matricule, id: card.matricule });
    const qrDataURL = await generateQRDataURL(qrData);
    pdf.addImage(qrDataURL, 'PNG', qrX, qrY, qrSize, qrSize);
  } catch {}

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(3);
  pdf.setTextColor(156, 163, 175);
  pdf.text('Scanner pour valider', qrX + qrSize / 2, qrY + qrSize + 3, { align: 'center' });

  // Footer
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(3.5);
  pdf.setTextColor(17, 24, 39);
  pdf.text(card.schoolVille || 'Conakry, Guinée', x + 5, y + CARD_H - 2);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(3);
  pdf.setTextColor(17, 24, 39);
  pdf.text('Carte permanente • Rechargeable', x + CARD_W - 5, y + CARD_H - 2, { align: 'right' });

  pdf.restoreGraphicsState();
}

function drawWavesAt(pdf: jsPDF, ox: number, oy: number) {
  // Red wave
  pdf.setFillColor(248, 113, 113);
  pdf.setGState(new (pdf as any).GState({ opacity: 0.6 }));

  const points1: number[][] = [];
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    const xp = ox + t * CARD_W;
    const yp = oy + CARD_H - 18 + Math.sin(t * Math.PI * 2.5 + 0.5) * 6 + Math.cos(t * Math.PI * 1.5) * 3;
    points1.push([xp, yp]);
  }
  points1.push([ox + CARD_W, oy + CARD_H]);
  points1.push([ox, oy + CARD_H]);

  // Use lines array approach
  const lines1: number[][] = [];
  for (let i = 1; i < points1.length; i++) {
    lines1.push([points1[i][0] - points1[i - 1][0], points1[i][1] - points1[i - 1][1]]);
  }
  (pdf as any).lines(lines1, points1[0][0], points1[0][1], [1, 1], 'F', false);

  // Green wave
  pdf.setFillColor(74, 222, 128);
  pdf.setGState(new (pdf as any).GState({ opacity: 0.5 }));

  const points2: number[][] = [];
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    const xp = ox + t * CARD_W;
    const yp = oy + CARD_H - 14 + Math.sin(t * Math.PI * 2 + 1) * 5 + Math.cos(t * Math.PI * 1.8 + 0.3) * 3;
    points2.push([xp, yp]);
  }
  points2.push([ox + CARD_W, oy + CARD_H]);
  points2.push([ox, oy + CARD_H]);

  const lines2: number[][] = [];
  for (let i = 1; i < points2.length; i++) {
    lines2.push([points2[i][0] - points2[i - 1][0], points2[i][1] - points2[i - 1][1]]);
  }
  (pdf as any).lines(lines2, points2[0][0], points2[0][1], [1, 1], 'F', false);

  pdf.setGState(new (pdf as any).GState({ opacity: 1 }));
}

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

export async function exportBulkTransportCards(
  cards: TransportCardExportData[],
  schoolName: string,
  schoolLogoUrl?: string | null,
  schoolVille?: string
): Promise<void> {
  if (cards.length === 0) return;

  // A4 page: 210 x 297mm — fit cards in a grid
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = 210;
  const pageH = 297;
  const marginX = (pageW - CARD_W * 2 - 8) / 2; // 2 columns with 8mm gap
  const marginY = 10;
  const gapX = 8;
  const gapY = 8;
  const cols = 2;
  const rows = Math.floor((pageH - marginY * 2 + gapY) / (CARD_H + gapY));
  const cardsPerPage = cols * rows;

  for (let i = 0; i < cards.length; i++) {
    const pageIndex = Math.floor(i / cardsPerPage);
    const posOnPage = i % cardsPerPage;
    const col = posOnPage % cols;
    const row = Math.floor(posOnPage / cols);

    if (i > 0 && posOnPage === 0) {
      pdf.addPage();
    }

    const ox = marginX + col * (CARD_W + gapX);
    const oy = marginY + row * (CARD_H + gapY);

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
  }

  pdf.save(`cartes_transport_lot_${cards.length}.pdf`);
}
