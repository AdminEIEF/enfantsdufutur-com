import jsPDF from 'jspdf';

interface EmployeeBadgeData {
  matricule: string;
  nom: string;
  prenom: string;
  poste: string;
  categorie: string;
  photo_url?: string | null;
  telephone?: string | null;
}

const CARD_W = 53.98; // mm (portrait)
const CARD_H = 85.6;

const categorieLabel: Record<string, string> = {
  enseignant: 'Enseignant',
  administration: 'Administration',
  service: 'Service',
  direction: 'Direction',
};

const categorieRibbonColor: Record<string, [number, number, number]> = {
  enseignant: [37, 99, 235],      // Blue
  administration: [220, 38, 38],   // Red
  service: [22, 163, 74],          // Green
  direction: [147, 51, 234],       // Purple
};

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = url;
    });
    return img;
  } catch {
    return null;
  }
}

function drawSingleBadge(
  doc: jsPDF,
  emp: EmployeeBadgeData,
  qrDataUrl: string,
  logoImg: HTMLImageElement | null,
  schoolName: string,
  offsetX: number,
  offsetY: number,
  photoImg: HTMLImageElement | null
) {
  const x = offsetX;
  const y = offsetY;

  // === Background ===
  doc.setFillColor(250, 250, 252);
  doc.rect(x, y, CARD_W, CARD_H, 'F');

  // === Guilloche watermark pattern ===
  doc.setDrawColor(230, 230, 240);
  doc.setLineWidth(0.15);
  for (let i = 0; i < CARD_H; i += 3) {
    const amplitude = 2;
    const points: [number, number][] = [];
    for (let px = 0; px <= CARD_W; px += 1) {
      const py = i + Math.sin((px + i) * 0.5) * amplitude;
      points.push([x + px, y + py]);
    }
    for (let j = 0; j < points.length - 1; j++) {
      doc.line(points[j][0], points[j][1], points[j + 1][0], points[j + 1][1]);
    }
  }

  // === "PERSONNEL" watermark at 45° ===
  doc.saveGraphicsState();
  const gState = (doc as any).GState;
  if (gState) {
    doc.setGState(new gState({ opacity: 0.06 }));
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(100, 100, 120);
  const textStr = 'PERSONNEL';
  for (let wy = -10; wy < CARD_H + 10; wy += 18) {
    for (let wx = -20; wx < CARD_W + 20; wx += 40) {
      doc.text(textStr, x + wx, y + wy, { angle: 45 });
    }
  }
  doc.restoreGraphicsState();

  // === Top accent bar — gradient vert clair + rouge ===
  // Red-green gradient effect: left side green, right side red
  doc.setFillColor(144, 190, 109); // Vert clair
  doc.rect(x, y, CARD_W / 2, 14, 'F');
  doc.setFillColor(200, 60, 60); // Rouge
  doc.rect(x + CARD_W / 2, y, CARD_W / 2, 14, 'F');
  // Blend strip in center
  doc.setFillColor(172, 125, 84);
  doc.rect(x + CARD_W / 2 - 3, y, 6, 14, 'F');

  // === Logo with white background circle ===
  if (logoImg) {
    const logoSize = 8;
    const logoX = x + (CARD_W - logoSize) / 2;
    const logoY = y + 1;
    // White circle behind logo
    doc.setFillColor(255, 255, 255);
    doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 1, 'F');
    doc.addImage(logoImg, 'PNG', logoX, logoY, logoSize, logoSize);
  }

  // === School name ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.2);
  doc.setTextColor(255, 255, 255);
  const nameLines = doc.splitTextToSize(schoolName, CARD_W - 4);
  const nameY = y + (logoImg ? 10.5 : 5);
  doc.text(nameLines, x + CARD_W / 2, nameY, { align: 'center' });

  // === Slogan / Devise ===
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(3.5);
  doc.setTextColor(255, 255, 230);
  doc.text('« Faisons plus ! »', x + CARD_W / 2, nameY + 3, { align: 'center' });

  // === Photo ===
  const photoW = 22;
  const photoH = 26;
  const photoX = x + (CARD_W - photoW) / 2;
  const photoY = y + 15;

  // Photo border
  doc.setDrawColor(180, 180, 190);
  doc.setLineWidth(0.4);
  doc.roundedRect(photoX - 0.8, photoY - 0.8, photoW + 1.6, photoH + 1.6, 1.5, 1.5, 'S');

  doc.setFillColor(240, 240, 245);
  doc.roundedRect(photoX, photoY, photoW, photoH, 1, 1, 'F');

  if (photoImg) {
    doc.addImage(photoImg, 'JPEG', photoX, photoY, photoW, photoH);
  } else {
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 120);
    doc.text(`${emp.prenom[0]}${emp.nom[0]}`, photoX + photoW / 2, photoY + photoH / 2 + 3, { align: 'center' });
  }

  // === Name ===
  const infoY = photoY + photoH + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(20, 20, 30);
  doc.text(`${emp.prenom} ${emp.nom}`, x + CARD_W / 2, infoY, { align: 'center' });

  // === Poste ===
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(80, 80, 100);
  doc.text(emp.poste || categorieLabel[emp.categorie] || emp.categorie, x + CARD_W / 2, infoY + 4, { align: 'center' });

  // === Matricule ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(15, 60, 50);
  doc.text(`ID: ${emp.matricule}`, x + CARD_W / 2, infoY + 9, { align: 'center' });

  // === QR Code ===
  const qrSize = 14;
  const qrX = x + (CARD_W - qrSize) / 2;
  const qrY = infoY + 12;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 1, 1, 'F');
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

  doc.setFontSize(3.5);
  doc.setTextColor(140, 140, 155);
  doc.text('Scanner pour vérification', x + CARD_W / 2, qrY + qrSize + 2.5, { align: 'center' });

  // === Category color ribbon at bottom ===
  const ribbonColor = categorieRibbonColor[emp.categorie] || [100, 100, 100];
  doc.setFillColor(ribbonColor[0], ribbonColor[1], ribbonColor[2]);
  doc.rect(x, y + CARD_H - 6, CARD_W, 6, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.5);
  doc.setTextColor(255, 255, 255);
  doc.text((categorieLabel[emp.categorie] || emp.categorie).toUpperCase(), x + CARD_W / 2, y + CARD_H - 2, { align: 'center' });

  // === Thin border ===
  doc.setDrawColor(200, 200, 210);
  doc.setLineWidth(0.3);
  doc.rect(x, y, CARD_W, CARD_H);
}

export async function generateBadgeEmployePDF(emp: EmployeeBadgeData, qrDataUrl: string, schoolName?: string, logoUrl?: string | null) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [CARD_W, CARD_H] });
  const sName = schoolName || 'Ecole Internationale Les Enfants du Futur';

  const logoImg = logoUrl ? await loadImage(logoUrl) : null;
  const photoImg = emp.photo_url ? await loadImage(emp.photo_url) : null;

  drawSingleBadge(doc, emp, qrDataUrl, logoImg, sName, 0, 0, photoImg);

  doc.save(`badge_${emp.matricule}.pdf`);
}

// Generate A4 sheet with 10 badges (2 cols x 5 rows)
export async function generatePlancheBadgesEmployesPDF(
  employes: EmployeeBadgeData[],
  qrDataUrls: Record<string, string>,
  schoolName?: string,
  logoUrl?: string | null
) {
  const A4_W = 210;
  const A4_H = 297;
  const COLS = 2;
  const ROWS = 5;
  const PER_PAGE = COLS * ROWS;

  const marginX = (A4_W - COLS * CARD_W) / (COLS + 1);
  const marginY = (A4_H - ROWS * CARD_H) / (ROWS + 1);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const sName = schoolName || 'Ecole Internationale Les Enfants du Futur';

  const logoImg = logoUrl ? await loadImage(logoUrl) : null;

  // Preload all photos
  const photoCache: Record<string, HTMLImageElement | null> = {};
  for (const emp of employes) {
    if (emp.photo_url) {
      photoCache[emp.matricule] = await loadImage(emp.photo_url);
    }
  }

  const totalPages = Math.ceil(employes.length / PER_PAGE);

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) doc.addPage();

    // Cut marks
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.1);

    const pageEmps = employes.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

    for (let i = 0; i < pageEmps.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const ox = marginX + col * (CARD_W + marginX);
      const oy = marginY + row * (CARD_H + marginY);

      const emp = pageEmps[i];
      const qr = qrDataUrls[emp.matricule] || '';
      const photoImg = photoCache[emp.matricule] || null;

      drawSingleBadge(doc, emp, qr, logoImg, sName, ox, oy, photoImg);

      // Cut marks
      const markLen = 4;
      // Top-left
      doc.line(ox - 2, oy, ox - 2 - markLen, oy);
      doc.line(ox, oy - 2, ox, oy - 2 - markLen);
      // Top-right
      doc.line(ox + CARD_W + 2, oy, ox + CARD_W + 2 + markLen, oy);
      doc.line(ox + CARD_W, oy - 2, ox + CARD_W, oy - 2 - markLen);
      // Bottom-left
      doc.line(ox - 2, oy + CARD_H, ox - 2 - markLen, oy + CARD_H);
      doc.line(ox, oy + CARD_H + 2, ox, oy + CARD_H + 2 + markLen);
      // Bottom-right
      doc.line(ox + CARD_W + 2, oy + CARD_H, ox + CARD_W + 2 + markLen, oy + CARD_H);
      doc.line(ox + CARD_W, oy + CARD_H + 2, ox + CARD_W, oy + CARD_H + 2 + markLen);
    }
  }

  doc.save(`planches_badges_employes.pdf`);
}
