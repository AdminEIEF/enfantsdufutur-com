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

// Colors
const NAVY = { r: 15, g: 23, b: 42 };
const NAVY_700 = { r: 26, g: 32, b: 68 };
const BLUE_600 = { r: 37, g: 99, b: 235 };
const BLUE_400 = { r: 96, g: 165, b: 250 };
const AMBER = { r: 245, g: 158, b: 11 };
const GRAY_50 = { r: 249, g: 250, b: 251 };
const GRAY_100 = { r: 243, g: 244, b: 246 };
const GRAY_400 = { r: 156, g: 163, b: 175 };
const GRAY_500 = { r: 107, g: 114, b: 128 };
const GRAY_700 = { r: 55, g: 65, b: 81 };
const GRAY_800 = { r: 31, g: 41, b: 55 };
const WHITE = { r: 255, g: 255, b: 255 };

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

interface ContactInfo {
  telephone?: string;
  email?: string;
  adresse?: string;
  web?: string;
}

function getCategoryColor(categorie: string): { r: number; g: number; b: number } {
  switch (categorie?.toLowerCase()) {
    case 'enseignant': return { r: 29, g: 78, b: 216 };
    case 'administration': return { r: 139, g: 92, b: 246 };
    case 'direction': return { r: 220, g: 38, b: 38 };
    case 'service': return { r: 22, g: 163, b: 74 };
    default: return { r: 29, g: 78, b: 216 };
  }
}

// =============================================
// RECTO (Front side)
// =============================================
function drawRecto(
  doc: jsPDF,
  emp: EmployeeBadgeData,
  qrDataUrl: string,
  x: number,
  y: number,
  photoImg: HTMLImageElement | null,
  logoImg: HTMLImageElement | null,
  schoolName?: string
) {
  // === White background ===
  doc.setFillColor(WHITE.r, WHITE.g, WHITE.b);
  doc.roundedRect(x, y, CARD_W, CARD_H, 2, 2, 'F');

  // === Geometric shapes (top-right navy triangle + blue accent) ===
  // Large navy diagonal shape
  doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
  const topShapePoints = [
    { x: x, y: y },
    { x: x + CARD_W, y: y },
    { x: x + CARD_W, y: y + 28 },
    { x: x, y: y + 20 },
  ];
  (doc as any).triangle(
    topShapePoints[0].x, topShapePoints[0].y,
    topShapePoints[1].x, topShapePoints[1].y,
    topShapePoints[2].x, topShapePoints[2].y, 'F'
  );
  (doc as any).triangle(
    topShapePoints[0].x, topShapePoints[0].y,
    topShapePoints[2].x, topShapePoints[2].y,
    topShapePoints[3].x, topShapePoints[3].y, 'F'
  );

  // Blue accent diagonal strip
  doc.setFillColor(BLUE_600.r, BLUE_600.g, BLUE_600.b);
  (doc as any).triangle(
    x, y + 20,
    x + CARD_W, y + 28,
    x + CARD_W, y + 32, 'F'
  );
  (doc as any).triangle(
    x, y + 20,
    x + CARD_W, y + 32,
    x, y + 24, 'F'
  );

  // === Security watermark ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.5);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.setGState(new (doc as any).GState({ opacity: 0.03 }));
  for (let wy = 30; wy < CARD_H; wy += 4.5) {
    for (let wx = -5; wx < CARD_W + 5; wx += 20) {
      doc.text('Enfants du Futur', x + wx, y + wy, { angle: 20 });
    }
  }
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  // === Logo in white circle ===
  const logoCX = x + CARD_W / 2;
  const logoCY = y + 8;
  const logoCircleR = 5.5;
  doc.setFillColor(WHITE.r, WHITE.g, WHITE.b);
  doc.circle(logoCX, logoCY, logoCircleR, 'F');
  if (logoImg) {
    const logoSize = 9;
    doc.addImage(logoImg, 'PNG', logoCX - logoSize / 2, logoCY - logoSize / 2, logoSize, logoSize);
  }

  // === School name (white on navy) ===
  const displayName = schoolName || 'Les Écoles Internationales\nEnfants du Futur';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.5);
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  const schoolLines = displayName.split('\n');
  schoolLines.forEach((line, i) => {
    doc.text(line.toUpperCase(), x + CARD_W / 2, y + 15.5 + i * 2.2, { align: 'center' });
  });

  // === Photo with styled border ===
  const photoR = 10;
  const photoCX = x + CARD_W / 2;
  const photoCY = y + 35;

  // Outer ring (blue accent)
  doc.setDrawColor(BLUE_600.r, BLUE_600.g, BLUE_600.b);
  doc.setLineWidth(0.8);
  doc.circle(photoCX, photoCY, photoR + 1.5, 'D');

  // White border
  doc.setFillColor(WHITE.r, WHITE.g, WHITE.b);
  doc.circle(photoCX, photoCY, photoR + 0.5, 'F');

  if (photoImg) {
    const photoSize = photoR * 2;
    doc.addImage(photoImg, 'JPEG', photoCX - photoR, photoCY - photoR, photoSize, photoSize);
  } else {
    doc.setFillColor(GRAY_100.r, GRAY_100.g, GRAY_100.b);
    doc.circle(photoCX, photoCY, photoR, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(GRAY_500.r, GRAY_500.g, GRAY_500.b);
    const initials = `${(emp.prenom || '')[0] || ''}${(emp.nom || '')[0] || ''}`;
    doc.text(initials, photoCX, photoCY + 2, { align: 'center' });
  }

  // === "OFFICIEL" badge ===
  const officielY = photoCY + photoR + 1;
  const officielW = 14;
  const officielH = 3.5;
  doc.setFillColor(AMBER.r, AMBER.g, AMBER.b);
  doc.roundedRect(photoCX - officielW / 2, officielY, officielW, officielH, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4);
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.text('OFFICIEL', photoCX, officielY + 2.5, { align: 'center' });

  // === Name ===
  const nameY = officielY + officielH + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(GRAY_800.r, GRAY_800.g, GRAY_800.b);
  const fullName = `${emp.prenom} ${emp.nom}`.toUpperCase();
  const nameLines = doc.splitTextToSize(fullName, CARD_W - 6);
  doc.text(nameLines, x + CARD_W / 2, nameY, { align: 'center' });

  // === Role ===
  const roleY = nameY + nameLines.length * 3.5 + 1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(BLUE_600.r, BLUE_600.g, BLUE_600.b);
  doc.text(emp.poste || emp.categorie, x + CARD_W / 2, roleY, { align: 'center' });

  // === Bottom section: ID + QR side by side ===
  const bottomY = y + CARD_H - 20;

  // ID Number section (left)
  const idSectionX = x + 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(3.5);
  doc.setTextColor(GRAY_400.r, GRAY_400.g, GRAY_400.b);
  doc.text('ID NUMBER', idSectionX, bottomY + 2);

  doc.setFont('courier', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text(emp.matricule, idSectionX, bottomY + 6);

  // QR Code (right)
  const qrSize = 12;
  const qrX = x + CARD_W - qrSize - 3;
  const qrY = bottomY - 1;
  doc.setFillColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setDrawColor(GRAY_100.r, GRAY_100.g, GRAY_100.b);
  doc.setLineWidth(0.3);
  doc.rect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 'FD');
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
  }

  // === Category color band at very bottom ===
  const bandH = 2;
  const catColor = getCategoryColor(emp.categorie);
  doc.setFillColor(catColor.r, catColor.g, catColor.b);
  doc.roundedRect(x, y + CARD_H - bandH, CARD_W, bandH, 2, 2, 'F');
  doc.rect(x, y + CARD_H - bandH, CARD_W, bandH / 2, 'F');

  // === Outer border ===
  doc.setDrawColor(220, 220, 230);
  doc.setLineWidth(0.15);
  doc.roundedRect(x, y, CARD_W, CARD_H, 2, 2, 'D');
}

// =============================================
// VERSO (Back side)
// =============================================
function drawVerso(
  doc: jsPDF,
  x: number,
  y: number,
  logoImg: HTMLImageElement | null,
  contactInfo?: ContactInfo,
  schoolName?: string,
  anneeScolaire?: string
) {
  // === Background ===
  doc.setFillColor(GRAY_50.r, GRAY_50.g, GRAY_50.b);
  doc.roundedRect(x, y, CARD_W, CARD_H, 2, 2, 'F');

  // === Top navy band ===
  const topBandH = 8;
  doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
  doc.roundedRect(x, y, CARD_W, topBandH, 2, 2, 'F');
  doc.rect(x, y + topBandH - 2, CARD_W, 2, 'F');

  // Logo in top band
  if (logoImg) {
    const logoSize = 6;
    doc.addImage(logoImg, 'PNG', x + CARD_W / 2 - logoSize / 2, y + 1, logoSize, logoSize);
  }

  // === "Informations Générales" title ===
  const titleY = y + topBandH + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text('Informations Générales', x + CARD_W / 2, titleY, { align: 'center' });

  // Underline
  const underW = 20;
  doc.setDrawColor(BLUE_600.r, BLUE_600.g, BLUE_600.b);
  doc.setLineWidth(0.4);
  doc.line(x + CARD_W / 2 - underW / 2, titleY + 1.5, x + CARD_W / 2 + underW / 2, titleY + 1.5);

  // === Contact info lines ===
  const contactStartY = titleY + 6;
  const lineH = 5.5;
  const iconX = x + 5;
  const textX = x + 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.5);
  doc.setTextColor(GRAY_700.r, GRAY_700.g, GRAY_700.b);

  // Phone
  const phone = contactInfo?.telephone || '+224 000 00 00 00';
  doc.setFillColor(BLUE_600.r, BLUE_600.g, BLUE_600.b);
  doc.circle(iconX, contactStartY - 0.5, 1.5, 'F');
  doc.setFontSize(3);
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.text('T', iconX, contactStartY + 0.3, { align: 'center' });
  doc.setFontSize(4.5);
  doc.setTextColor(GRAY_700.r, GRAY_700.g, GRAY_700.b);
  doc.text(phone, textX, contactStartY);

  // Email
  const email = contactInfo?.email || 'contact@enfantsdufutur.gn';
  const emailY = contactStartY + lineH;
  doc.setFillColor(BLUE_600.r, BLUE_600.g, BLUE_600.b);
  doc.circle(iconX, emailY - 0.5, 1.5, 'F');
  doc.setFontSize(3);
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.text('@', iconX, emailY + 0.3, { align: 'center' });
  doc.setFontSize(4.5);
  doc.setTextColor(GRAY_700.r, GRAY_700.g, GRAY_700.b);
  doc.text(email, textX, emailY);

  // Address
  const adresse = contactInfo?.adresse || 'Conakry, République de Guinée';
  const addrY = emailY + lineH;
  doc.setFillColor(BLUE_600.r, BLUE_600.g, BLUE_600.b);
  doc.circle(iconX, addrY - 0.5, 1.5, 'F');
  doc.setFontSize(3);
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.text('A', iconX, addrY + 0.3, { align: 'center' });
  doc.setFontSize(4);
  doc.setTextColor(GRAY_700.r, GRAY_700.g, GRAY_700.b);
  const addrLines = doc.splitTextToSize(adresse, CARD_W - 14);
  doc.text(addrLines, textX, addrY);

  // Website
  const web = contactInfo?.web || 'www.enfantsdufutur.gn';
  const webY = addrY + lineH;
  doc.setFillColor(BLUE_600.r, BLUE_600.g, BLUE_600.b);
  doc.circle(iconX, webY - 0.5, 1.5, 'F');
  doc.setFontSize(3);
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.text('W', iconX, webY + 0.3, { align: 'center' });
  doc.setFontSize(4.5);
  doc.setTextColor(GRAY_700.r, GRAY_700.g, GRAY_700.b);
  doc.text(web, textX, webY);

  // === Legal disclaimer ===
  const disclaimerY = webY + lineH + 3;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(3);
  doc.setTextColor(GRAY_500.r, GRAY_500.g, GRAY_500.b);
  const disclaimer = "Ce badge est la propriété de l'établissement. En cas de perte, merci de le rapporter à l'administration. Toute utilisation frauduleuse est passible de sanctions.";
  const disclaimerLines = doc.splitTextToSize(disclaimer, CARD_W - 10);
  doc.text(disclaimerLines, x + CARD_W / 2, disclaimerY, { align: 'center' });

  // === School year at bottom ===
  const yearText = anneeScolaire || '2025-2026';
  const yearY = y + CARD_H - 6;

  // Navy pill for year
  const yearTextW = 18;
  const yearPillH = 5;
  doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
  doc.roundedRect(x + CARD_W / 2 - yearTextW / 2, yearY, yearTextW, yearPillH, 1.5, 1.5, 'F');

  // Logo mini in pill
  if (logoImg) {
    const miniLogo = 3.5;
    doc.addImage(logoImg, 'PNG', x + CARD_W / 2 - yearTextW / 2 + 1.5, yearY + 0.75, miniLogo, miniLogo);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.text(yearText, x + CARD_W / 2 + 3, yearY + 3.5, { align: 'center' });

  // === Outer border ===
  doc.setDrawColor(220, 220, 230);
  doc.setLineWidth(0.15);
  doc.roundedRect(x, y, CARD_W, CARD_H, 2, 2, 'D');
}

// =============================================
// EXPORTS
// =============================================

export async function generateBadgeEmployePDF(
  emp: EmployeeBadgeData,
  qrDataUrl: string,
  schoolName?: string,
  logoUrl?: string | null,
  contactInfo?: ContactInfo,
  anneeScolaire?: string
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [CARD_W, CARD_H] });

  const photoImg = emp.photo_url ? await loadImage(emp.photo_url) : null;
  const logoImg = logoUrl ? await loadImage(logoUrl) : null;

  // Page 1: Recto
  drawRecto(doc, emp, qrDataUrl, 0, 0, photoImg, logoImg, schoolName);

  // Page 2: Verso
  doc.addPage([CARD_W, CARD_H]);
  drawVerso(doc, 0, 0, logoImg, contactInfo, schoolName, anneeScolaire);

  doc.save(`badge_${emp.matricule}.pdf`);
}

// Generate A4 sheet with badges (recto pages then verso pages)
export async function generatePlancheBadgesEmployesPDF(
  employes: EmployeeBadgeData[],
  qrDataUrls: Record<string, string>,
  schoolName?: string,
  logoUrl?: string | null,
  contactInfo?: ContactInfo,
  anneeScolaire?: string
) {
  const A4_W = 210;
  const A4_H = 297;
  const COLS = 2;
  const ROWS = 5;
  const PER_PAGE = COLS * ROWS;

  const marginX = (A4_W - COLS * CARD_W) / (COLS + 1);
  const marginY = (A4_H - ROWS * CARD_H) / (ROWS + 1);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

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
    // === RECTO PAGE ===
    if (page > 0) doc.addPage();

    const pageEmps = employes.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

    for (let i = 0; i < pageEmps.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const ox = marginX + col * (CARD_W + marginX);
      const oy = marginY + row * (CARD_H + marginY);

      const emp = pageEmps[i];
      const qr = qrDataUrls[emp.matricule] || '';
      const photo = photoCache[emp.matricule] || null;

      drawRecto(doc, emp, qr, ox, oy, photo, logoImg, schoolName);

      // Cut marks
      drawCutMarks(doc, ox, oy);
    }

    // === VERSO PAGE ===
    doc.addPage();

    for (let i = 0; i < pageEmps.length; i++) {
      // Mirror columns for verso (so it aligns when printed double-sided)
      const col = (COLS - 1) - (i % COLS);
      const row = Math.floor(i / COLS);
      const ox = marginX + col * (CARD_W + marginX);
      const oy = marginY + row * (CARD_H + marginY);

      drawVerso(doc, ox, oy, logoImg, contactInfo, schoolName, anneeScolaire);

      // Cut marks
      drawCutMarks(doc, ox, oy);
    }
  }

  doc.save(`planches_badges_employes.pdf`);
}

function drawCutMarks(doc: jsPDF, ox: number, oy: number) {
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.1);
  const m = 4;
  doc.line(ox - 2, oy, ox - 2 - m, oy);
  doc.line(ox, oy - 2, ox, oy - 2 - m);
  doc.line(ox + CARD_W + 2, oy, ox + CARD_W + 2 + m, oy);
  doc.line(ox + CARD_W, oy - 2, ox + CARD_W, oy - 2 - m);
  doc.line(ox - 2, oy + CARD_H, ox - 2 - m, oy + CARD_H);
  doc.line(ox, oy + CARD_H + 2, ox, oy + CARD_H + 2 + m);
  doc.line(ox + CARD_W + 2, oy + CARD_H, ox + CARD_W + 2 + m, oy + CARD_H);
  doc.line(ox + CARD_W, oy + CARD_H + 2, ox + CARD_W, oy + CARD_H + 2 + m);
}
