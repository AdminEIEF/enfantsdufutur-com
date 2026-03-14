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
const NAVY = { r: 15, g: 23, b: 42 };       // bg-blue-900 equivalent
const BLUE_ACCENT = { r: 29, g: 78, b: 216 }; // text-blue-700
const GRAY_100 = { r: 243, g: 244, b: 246 };
const GRAY_500 = { r: 107, g: 114, b: 128 };
const GRAY_800 = { r: 31, g: 41, b: 55 };
const GREEN = { r: 22, g: 163, b: 74 };
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
  adresse?: string;
  web?: string;
}

function drawSingleBadge(
  doc: jsPDF,
  emp: EmployeeBadgeData,
  qrDataUrl: string,
  offsetX: number,
  offsetY: number,
  photoImg: HTMLImageElement | null,
  logoImg: HTMLImageElement | null,
  contactInfo?: ContactInfo,
  schoolName?: string
) {
  const x = offsetX;
  const y = offsetY;

  // === White background with rounded corners ===
  doc.setFillColor(WHITE.r, WHITE.g, WHITE.b);
  doc.roundedRect(x, y, CARD_W, CARD_H, 2, 2, 'F');

  // === Watermark pattern ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  const savedGState = (doc as any).internal.getCurrentPageInfo();
  doc.setGState(new (doc as any).GState({ opacity: 0.04 }));
  for (let wy = 0; wy < CARD_H; wy += 5) {
    for (let wx = -10; wx < CARD_W + 10; wx += 22) {
      doc.text('Enfants du Futur • Personnel •', x + wx, y + wy, { angle: 15 });
    }
  }
  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  // === Header (Navy blue) ===
  const headerH = 14;
  doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
  doc.roundedRect(x, y, CARD_W, headerH, 2, 2, 'F');
  // Square off bottom corners
  doc.rect(x, y + headerH - 2, CARD_W, 2, 'F');

  // Logo circle in header - centered and properly sized
  const logoCircleR = 4.5;
  const logoCX = x + CARD_W / 2;
  const logoCY = y + 5;
  // White circle background for logo
  doc.setFillColor(WHITE.r, WHITE.g, WHITE.b);
  doc.circle(logoCX, logoCY, logoCircleR, 'F');

  if (logoImg) {
    // Fit logo inside circle with padding
    const logoSize = logoCircleR * 1.7;
    doc.addImage(logoImg, 'PNG', logoCX - logoSize / 2, logoCY - logoSize / 2, logoSize, logoSize);
  }

  // School name below logo
  const displayName = schoolName || 'LES ÉCOLES INTERNATIONALES\nENFANTS DU FUTUR';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.5);
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  const schoolLines = displayName.split('\n');
  const schoolStartY = y + 11;
  schoolLines.forEach((line, i) => {
    doc.text(line.toUpperCase(), x + CARD_W / 2, schoolStartY + i * 2, { align: 'center' });
  });

  // "BADGE DU PERSONNEL" subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4);
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  const badgeSubY = schoolStartY + schoolLines.length * 2 + 0.8;
  doc.text('BADGE DU PERSONNEL', x + CARD_W / 2, badgeSubY, { align: 'center' });

  // === Photo (circular with white border) ===
  const photoR = 11; // radius
  const photoCX = x + CARD_W / 2;
  const photoCY = y + headerH + photoR + 3;

  // White border circle
  doc.setFillColor(WHITE.r, WHITE.g, WHITE.b);
  doc.setDrawColor(220, 220, 230);
  doc.setLineWidth(0.8);
  doc.circle(photoCX, photoCY, photoR + 1.2, 'FD');

  if (photoImg) {
    // Clip photo into circle area (square crop positioned in circle)
    const photoSize = photoR * 2;
    doc.addImage(photoImg, 'JPEG', photoCX - photoR, photoCY - photoR, photoSize, photoSize);
  } else {
    // Gray placeholder with initials
    doc.setFillColor(GRAY_100.r, GRAY_100.g, GRAY_100.b);
    doc.circle(photoCX, photoCY, photoR, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(GRAY_500.r, GRAY_500.g, GRAY_500.b);
    const initials = `${(emp.prenom || '')[0] || ''}${(emp.nom || '')[0] || ''}`;
    doc.text(initials, photoCX, photoCY + 2, { align: 'center' });
  }

  // === Name (bold, dark, uppercase) ===
  const nameY = photoCY + photoR + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(GRAY_800.r, GRAY_800.g, GRAY_800.b);
  const fullName = `${emp.prenom} ${emp.nom}`.toUpperCase();
  const nameLines = doc.splitTextToSize(fullName, CARD_W - 6);
  doc.text(nameLines, x + CARD_W / 2, nameY, { align: 'center' });

  // === Role (blue, semibold) ===
  const roleY = nameY + nameLines.length * 3.5 + 1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(BLUE_ACCENT.r, BLUE_ACCENT.g, BLUE_ACCENT.b);
  doc.text(emp.poste || emp.categorie, x + CARD_W / 2, roleY, { align: 'center' });

  // === Matricule (mono style, gray bg pill) ===
  const matY = roleY + 4.5;
  const matText = `ID: ${emp.matricule}`;
  doc.setFont('courier', 'normal');
  doc.setFontSize(5.5);
  const matTextW = doc.getTextWidth(matText);
  const pillW = matTextW + 4;
  const pillH = 3.5;
  const pillX = x + (CARD_W - pillW) / 2;
  doc.setFillColor(GRAY_100.r, GRAY_100.g, GRAY_100.b);
  doc.roundedRect(pillX, matY - 2.5, pillW, pillH, 1, 1, 'F');
  doc.setTextColor(GRAY_500.r, GRAY_500.g, GRAY_500.b);
  doc.text(matText, x + CARD_W / 2, matY, { align: 'center' });

  // === QR Code (large for reliable scanning) ===
  const qrSize = 18;
  const qrX = x + (CARD_W - qrSize) / 2;
  const qrY = matY + 2.5;
  // Border around QR
  doc.setDrawColor(220, 220, 230);
  doc.setLineWidth(0.2);
  doc.rect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 'D');
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

  // === Hologram Security Seal (top-right of photo area) ===
  const holoR = 5.5;
  const holoCX = x + CARD_W - holoR - 2.5;
  const holoCY = y + headerH + 5;

  // Outer iridescent ring layers
  const iridescent = [
    { r: 178, g: 245, b: 234 },  // teal
    { r: 190, g: 227, b: 248 },  // light blue
    { r: 254, g: 215, b: 226 },  // pink
    { r: 250, g: 240, b: 137 },  // yellow
  ];

  // Base circle with gradient-like layers
  iridescent.forEach((c, i) => {
    doc.setGState(new (doc as any).GState({ opacity: 0.18 - i * 0.03 }));
    doc.setFillColor(c.r, c.g, c.b);
    doc.circle(holoCX, holoCY, holoR - i * 0.8, 'F');
  });

  // Shimmer diagonal lines
  doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.12);
  for (let sl = -holoR; sl < holoR; sl += 1.2) {
    doc.line(holoCX + sl, holoCY - holoR, holoCX + sl + holoR, holoCY + holoR);
  }

  // Outer ring border
  doc.setGState(new (doc as any).GState({ opacity: 0.3 }));
  doc.setDrawColor(200, 220, 240);
  doc.setLineWidth(0.25);
  doc.circle(holoCX, holoCY, holoR, 'D');

  // Inner spinning ring (dashed effect)
  doc.setGState(new (doc as any).GState({ opacity: 0.2 }));
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.15);
  doc.circle(holoCX, holoCY, holoR - 1.2, 'D');

  // Shield icon center - white bg
  doc.setGState(new (doc as any).GState({ opacity: 0.7 }));
  doc.setFillColor(WHITE.r, WHITE.g, WHITE.b);
  doc.circle(holoCX, holoCY, 2.2, 'F');

  // Shield checkmark
  doc.setGState(new (doc as any).GState({ opacity: 0.5 }));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text('✓', holoCX, holoCY + 1, { align: 'center' });

  // "OFFICIAL" micro-text below shield
  doc.setFontSize(1.8);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text('OFFICIAL', holoCX, holoCY + 3, { align: 'center' });

  doc.setGState(new (doc as any).GState({ opacity: 1 }));

  // === "PERSONNEL AUTORISÉ" ===
  const authY = qrY + qrSize + 2.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(3.5);
  doc.setFillColor(GREEN.r, GREEN.g, GREEN.b);
  const shieldX = x + CARD_W / 2 - 9;
  doc.circle(shieldX, authY - 0.5, 1, 'F');
  doc.setFontSize(2);
  doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  doc.text('✓', shieldX, authY, { align: 'center' });
  doc.setFontSize(3.5);
  doc.setTextColor(GRAY_500.r, GRAY_500.g, GRAY_500.b);
  doc.text('PERSONNEL AUTORISÉ', x + CARD_W / 2 + 1, authY, { align: 'center' });

  // === Category color band at bottom ===
  const bandH = 2.5;
  const catColor = getCategoryColor(emp.categorie);
  doc.setFillColor(catColor.r, catColor.g, catColor.b);
  doc.roundedRect(x, y + CARD_H - bandH, CARD_W, bandH, 0, 0, 'F');
  // Round only bottom corners
  doc.roundedRect(x, y + CARD_H - bandH, CARD_W, bandH, 2, 2, 'F');
  doc.rect(x, y + CARD_H - bandH, CARD_W, bandH / 2, 'F');

  // === Contact info on the band ===
  const tel = contactInfo?.telephone || '';
  if (tel) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(3);
    doc.setTextColor(WHITE.r, WHITE.g, WHITE.b);
    doc.text(tel, x + CARD_W / 2, y + CARD_H - 0.8, { align: 'center' });
  }

  // === Outer border ===
  doc.setDrawColor(220, 220, 230);
  doc.setLineWidth(0.15);
  doc.roundedRect(x, y, CARD_W, CARD_H, 2, 2, 'D');
}

function getCategoryColor(categorie: string): { r: number; g: number; b: number } {
  switch (categorie?.toLowerCase()) {
    case 'enseignant': return { r: 29, g: 78, b: 216 };   // Blue
    case 'administration': return { r: 139, g: 92, b: 246 }; // Purple
    case 'direction': return { r: 220, g: 38, b: 38 };    // Red
    case 'service': return { r: 22, g: 163, b: 74 };      // Green
    default: return { r: 29, g: 78, b: 216 };             // Blue default
  }
}

export async function generateBadgeEmployePDF(
  emp: EmployeeBadgeData,
  qrDataUrl: string,
  schoolName?: string,
  logoUrl?: string | null,
  contactInfo?: ContactInfo
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [CARD_W, CARD_H] });

  const photoImg = emp.photo_url ? await loadImage(emp.photo_url) : null;
  const logoImg = logoUrl ? await loadImage(logoUrl) : null;

  drawSingleBadge(doc, emp, qrDataUrl, 0, 0, photoImg, logoImg, contactInfo, schoolName);

  doc.save(`badge_${emp.matricule}.pdf`);
}

// Generate A4 sheet with 10 badges (2 cols x 5 rows)
export async function generatePlancheBadgesEmployesPDF(
  employes: EmployeeBadgeData[],
  qrDataUrls: Record<string, string>,
  schoolName?: string,
  logoUrl?: string | null,
  contactInfo?: ContactInfo
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
    if (page > 0) doc.addPage();

    const pageEmps = employes.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

    for (let i = 0; i < pageEmps.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const ox = marginX + col * (CARD_W + marginX);
      const oy = marginY + row * (CARD_H + marginY);

      const emp = pageEmps[i];
      const qr = qrDataUrls[emp.matricule] || '';
      const photoImg = photoCache[emp.matricule] || null;

      drawSingleBadge(doc, emp, qr, ox, oy, photoImg, logoImg, contactInfo, schoolName);

      // Cut marks
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
  }

  doc.save(`planches_badges_employes.pdf`);
}
