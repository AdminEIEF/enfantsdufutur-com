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
  logoImg: HTMLImageElement | null,
  schoolName: string,
  offsetX: number,
  offsetY: number,
  photoImg: HTMLImageElement | null,
  contactInfo?: ContactInfo
) {
  const x = offsetX;
  const y = offsetY;

  // === White background ===
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, CARD_W, CARD_H, 'F');

  // === TOP BANNER — Tall red/green with yellow accent ===
  const bannerH = 22;

  // Red section (left ~60%)
  doc.setFillColor(200, 16, 46); // vibrant red
  doc.rect(x, y, CARD_W * 0.55, bannerH, 'F');

  // Yellow thin stripe
  doc.setFillColor(255, 206, 0);
  doc.rect(x + CARD_W * 0.55, y, CARD_W * 0.04, bannerH, 'F');

  // Green section (right ~40%)
  doc.setFillColor(0, 130, 60); // vibrant green
  doc.rect(x + CARD_W * 0.59, y, CARD_W * 0.41, bannerH, 'F');

  // === Logo circle (white background) ===
  const logoCircleR = 7.5;
  const logoCX = x + logoCircleR + 2;
  const logoCY = y + bannerH / 2;
  doc.setFillColor(255, 255, 255);
  doc.circle(logoCX, logoCY, logoCircleR, 'F');

  if (logoImg) {
    const logoS = logoCircleR * 1.6;
    doc.addImage(logoImg, 'PNG', logoCX - logoS / 2, logoCY - logoS / 2, logoS, logoS);
  }

  // === School name (white, bold, uppercase, right of logo) ===
  const nameStartX = logoCX + logoCircleR + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(255, 255, 255);
  const nameMaxW = CARD_W - (nameStartX - x) - 2;
  const nameLines = doc.splitTextToSize(schoolName.toUpperCase(), nameMaxW);
  const nameBlockH = nameLines.length * 3;
  const nameStartY = y + (bannerH - nameBlockH) / 2 + 2.5;
  doc.text(nameLines, nameStartX, nameStartY);

  // === "FAISONS PLUS !" motto under logo area ===
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(3.2);
  doc.setTextColor(255, 255, 255);
  doc.text('FAISONS PLUS !', logoCX, logoCY + logoCircleR - 1.5, { align: 'center' });

  // === "CARTE DU PERSONNEL" ribbon ===
  const ribbonY = y + bannerH + 1;
  const ribbonH = 5.5;
  // Background: gradient-like red-yellow-green
  doc.setFillColor(200, 16, 46);
  doc.rect(x + 4, ribbonY, CARD_W * 0.35, ribbonH, 'F');
  doc.setFillColor(255, 206, 0);
  doc.rect(x + 4 + CARD_W * 0.35, ribbonY, CARD_W * 0.15, ribbonH, 'F');
  doc.setFillColor(0, 130, 60);
  doc.rect(x + 4 + CARD_W * 0.5, ribbonY, CARD_W * 0.35, ribbonH, 'F');

  // White rounded inner label
  const labelPadX = 3;
  const labelInnerW = CARD_W - 8 - labelPadX * 2;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x + 4 + labelPadX, ribbonY + 0.8, labelInnerW, ribbonH - 1.6, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.5);
  doc.setTextColor(0, 130, 60);
  doc.text('CARTE DU PERSONNEL', x + CARD_W / 2, ribbonY + ribbonH / 2 + 1.2, { align: 'center' });

  // === Watermark (subtle school name behind photo area) ===
  const gState = (doc as any).GState;
  if (gState) {
    doc.saveGraphicsState();
    doc.setGState(new gState({ opacity: 0.04 }));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(200, 16, 46);
    const wmLines = doc.splitTextToSize(schoolName.toUpperCase(), CARD_W - 6);
    for (let wi = 0; wi < 3; wi++) {
      doc.text(wmLines, x + CARD_W / 2, y + 35 + wi * 15, { align: 'center' });
    }
    // "FAISONS PLUS !" watermark
    doc.setFontSize(9);
    doc.setTextColor(0, 130, 60);
    doc.text('FAISONS PLUS !', x + CARD_W / 2, y + 62, { align: 'center' });
    doc.restoreGraphicsState();
  }

  // === Photo ===
  const photoW = 24;
  const photoH = 28;
  const photoX = x + (CARD_W - photoW) / 2;
  const photoY = ribbonY + ribbonH + 2;

  // Green border
  doc.setDrawColor(0, 130, 60);
  doc.setLineWidth(0.6);
  doc.roundedRect(photoX - 0.8, photoY - 0.8, photoW + 1.6, photoH + 1.6, 2, 2, 'S');

  // Photo placeholder
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(photoX, photoY, photoW, photoH, 1.5, 1.5, 'F');

  if (photoImg) {
    doc.addImage(photoImg, 'JPEG', photoX, photoY, photoW, photoH);
  } else {
    doc.setFontSize(18);
    doc.setTextColor(180, 180, 190);
    doc.text(`${emp.prenom[0]}${emp.nom[0]}`, photoX + photoW / 2, photoY + photoH / 2 + 3, { align: 'center' });
  }

  // === Name ===
  const infoY = photoY + photoH + 3.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(26, 26, 46);
  const fullName = `${emp.prenom} ${emp.nom}`.toUpperCase();
  const nameTextLines = doc.splitTextToSize(fullName, CARD_W - 6);
  doc.text(nameTextLines, x + CARD_W / 2, infoY, { align: 'center' });

  // === Poste ===
  const posteY = infoY + nameTextLines.length * 3.5;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(5.5);
  doc.setTextColor(80, 80, 90);
  doc.text(emp.poste || emp.categorie, x + CARD_W / 2, posteY, { align: 'center' });

  // === Matricule box ===
  const matBoxW = 28;
  const matBoxH = 5.5;
  const matBoxX = x + (CARD_W - matBoxW) / 2;
  const matBoxY = posteY + 3;

  // Red left half
  doc.setFillColor(200, 16, 46);
  doc.roundedRect(matBoxX, matBoxY, matBoxW * 0.3, matBoxH, 1, 1, 'F');
  // Yellow stripe
  doc.setFillColor(255, 206, 0);
  doc.rect(matBoxX + matBoxW * 0.3, matBoxY, matBoxW * 0.05, matBoxH, 'F');
  // Green right part
  doc.setFillColor(0, 130, 60);
  doc.roundedRect(matBoxX + matBoxW * 0.35 - 0.5, matBoxY, matBoxW * 0.65 + 0.5, matBoxH, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.5);
  doc.setTextColor(255, 255, 255);
  doc.text('N°', matBoxX + matBoxW * 0.15, matBoxY + 3.5, { align: 'center' });
  doc.setFontSize(6);
  doc.text(emp.matricule, matBoxX + matBoxW * 0.67, matBoxY + 3.8, { align: 'center' });

  // === QR Code ===
  const qrSize = 12;
  const qrX = x + (CARD_W - qrSize) / 2;
  const qrY = matBoxY + matBoxH + 2;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 130, 60);
  doc.setLineWidth(0.4);
  doc.roundedRect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 1, 1, 'FD');
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

  // === Footer bar — Red/Yellow/Green ===
  const footerH = 7;
  const footerY = y + CARD_H - footerH;

  // Yellow left accent line
  doc.setFillColor(255, 206, 0);
  doc.rect(x, footerY, 1.5, footerH, 'F');

  // Red section
  doc.setFillColor(200, 16, 46);
  doc.rect(x + 1.5, footerY, CARD_W * 0.45, footerH, 'F');

  // Yellow stripe
  doc.setFillColor(255, 206, 0);
  doc.rect(x + 1.5 + CARD_W * 0.45, footerY, CARD_W * 0.04, footerH, 'F');

  // Green section
  doc.setFillColor(0, 130, 60);
  doc.rect(x + 1.5 + CARD_W * 0.49, footerY, CARD_W * 0.51 - 1.5, footerH, 'F');

  // Contact info in footer
  const tel = contactInfo?.telephone || '';
  const web = contactInfo?.web || '';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3);
  doc.setTextColor(255, 255, 255);

  if (tel) {
    doc.text(`Contact: ${tel}`, x + 3, footerY + 3, { align: 'left' });
  } else {
    doc.text('Contact:', x + 3, footerY + 3, { align: 'left' });
  }

  if (web) {
    doc.text(`web: ${web}`, x + 3, footerY + 5.5, { align: 'left' });
  } else {
    doc.text('web:', x + 3, footerY + 5.5, { align: 'left' });
  }

  // === Thin outer border ===
  doc.setDrawColor(200, 200, 210);
  doc.setLineWidth(0.2);
  doc.rect(x, y, CARD_W, CARD_H);
}

export async function generateBadgeEmployePDF(
  emp: EmployeeBadgeData,
  qrDataUrl: string,
  schoolName?: string,
  logoUrl?: string | null,
  contactInfo?: ContactInfo
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [CARD_W, CARD_H] });
  const sName = schoolName || 'Ecole Internationale Les Enfants du Futur';

  const logoImg = logoUrl ? await loadImage(logoUrl) : null;
  const photoImg = emp.photo_url ? await loadImage(emp.photo_url) : null;

  drawSingleBadge(doc, emp, qrDataUrl, logoImg, sName, 0, 0, photoImg, contactInfo);

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

      drawSingleBadge(doc, emp, qr, logoImg, sName, ox, oy, photoImg, contactInfo);

      // Cut marks
      const markLen = 4;
      doc.line(ox - 2, oy, ox - 2 - markLen, oy);
      doc.line(ox, oy - 2, ox, oy - 2 - markLen);
      doc.line(ox + CARD_W + 2, oy, ox + CARD_W + 2 + markLen, oy);
      doc.line(ox + CARD_W, oy - 2, ox + CARD_W, oy - 2 - markLen);
      doc.line(ox - 2, oy + CARD_H, ox - 2 - markLen, oy + CARD_H);
      doc.line(ox, oy + CARD_H + 2, ox, oy + CARD_H + 2 + markLen);
      doc.line(ox + CARD_W + 2, oy + CARD_H, ox + CARD_W + 2 + markLen, oy + CARD_H);
      doc.line(ox + CARD_W, oy + CARD_H + 2, ox + CARD_W, oy + CARD_H + 2 + markLen);
    }
  }

  doc.save(`planches_badges_employes.pdf`);
}
