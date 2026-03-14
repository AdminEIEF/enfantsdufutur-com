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
  enseignant: [37, 99, 235],
  administration: [220, 38, 38],
  service: [22, 163, 74],
  direction: [147, 51, 234],
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

interface ContactInfo {
  telephone?: string;
  adresse?: string;
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

  // === Background ===
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, CARD_W, CARD_H, 'F');

  // === Decorative circles (subtle) ===
  doc.saveGraphicsState();
  const gState = (doc as any).GState;
  if (gState) {
    doc.setGState(new gState({ opacity: 0.04 }));
  }
  doc.setFillColor(30, 132, 73);
  doc.circle(x + CARD_W + 5, y + CARD_H - 20, 18, 'F');
  doc.setFillColor(192, 57, 43);
  doc.circle(x - 5, y + CARD_H - 5, 12, 'F');
  doc.restoreGraphicsState();

  // === Top banner — Red/Green gradient like student badges ===
  const bannerH = 18;
  // Left half red, right half green with blend
  doc.setFillColor(192, 57, 43); // #c0392b
  doc.rect(x, y, CARD_W * 0.4, bannerH, 'F');
  doc.setFillColor(169, 50, 38); // #a93226
  doc.rect(x + CARD_W * 0.4, y, CARD_W * 0.15, bannerH, 'F');
  doc.setFillColor(30, 132, 73); // #1e8449
  doc.rect(x + CARD_W * 0.55, y, CARD_W * 0.2, bannerH, 'F');
  doc.setFillColor(25, 111, 61); // #196f3d
  doc.rect(x + CARD_W * 0.75, y, CARD_W * 0.25, bannerH, 'F');

  // Banner pattern overlay (diagonal lines)
  doc.saveGraphicsState();
  if (gState) {
    doc.setGState(new gState({ opacity: 0.06 }));
  }
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  for (let i = -20; i < CARD_W + 20; i += 4) {
    doc.line(x + i, y, x + i + bannerH, y + bannerH);
  }
  doc.restoreGraphicsState();

  // Curved bottom edge of banner
  doc.setFillColor(30, 132, 73);
  doc.saveGraphicsState();
  if (gState) {
    doc.setGState(new gState({ opacity: 0.9 }));
  }
  // Simple arc effect with ellipse-like shape
  const arcH = 3;
  doc.setFillColor(192, 57, 43);
  doc.rect(x, y + bannerH, CARD_W * 0.45, arcH / 2, 'F');
  doc.setFillColor(30, 132, 73);
  doc.rect(x + CARD_W * 0.45, y + bannerH, CARD_W * 0.55, arcH / 2, 'F');
  doc.restoreGraphicsState();

  // === Logo with white circle background ===
  const logoSize = 11;
  const logoX = x + 3;
  const logoCenterY = y + bannerH / 2;
  // White circle
  doc.setFillColor(255, 255, 255);
  doc.circle(logoX + logoSize / 2, logoCenterY, logoSize / 2 + 1.2, 'F');
  // Border
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.circle(logoX + logoSize / 2, logoCenterY, logoSize / 2 + 1.2, 'S');

  if (logoImg) {
    doc.addImage(logoImg, 'PNG', logoX + 0.5, logoCenterY - logoSize / 2 + 0.5, logoSize - 1, logoSize - 1);
  }

  // === School name (WHITE, BOLD, UPPERCASE) ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.5);
  doc.setTextColor(255, 255, 255);
  const nameLines = doc.splitTextToSize(schoolName.toUpperCase(), CARD_W - logoSize - 8);
  doc.text(nameLines, x + logoSize + 5, y + bannerH / 2 - 1, { align: 'left', baseline: 'middle' });

  // === "CARTE DU PERSONNEL" label ===
  doc.saveGraphicsState();
  if (gState) {
    doc.setGState(new gState({ opacity: 0.85 }));
  }
  doc.setFillColor(255, 255, 255);
  const labelW = 28;
  const labelH = 4.5;
  const labelX = x + (CARD_W - labelW) / 2;
  const labelY = y + bannerH - 1;
  doc.roundedRect(labelX, labelY, labelW, labelH, 1.5, 1.5, 'F');
  doc.restoreGraphicsState();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.8);
  doc.setTextColor(30, 132, 73);
  doc.text('CARTE DU PERSONNEL', x + CARD_W / 2, labelY + 3, { align: 'center' });

  // === Photo ===
  const photoW = 22;
  const photoH = 26;
  const photoX = x + (CARD_W - photoW) / 2;
  const photoY = y + bannerH + arcH + 3;

  // Photo border (green tint like student badges)
  doc.setDrawColor(30, 132, 73);
  doc.setLineWidth(0.4);
  doc.roundedRect(photoX - 0.5, photoY - 0.5, photoW + 1, photoH + 1, 1.5, 1.5, 'S');

  doc.setFillColor(245, 245, 245);
  doc.roundedRect(photoX, photoY, photoW, photoH, 1, 1, 'F');

  if (photoImg) {
    doc.addImage(photoImg, 'JPEG', photoX, photoY, photoW, photoH);
  } else {
    doc.setFontSize(16);
    doc.setTextColor(180, 180, 190);
    doc.text(`${emp.prenom[0]}${emp.nom[0]}`, photoX + photoW / 2, photoY + photoH / 2 + 3, { align: 'center' });
  }

  // === Name ===
  const infoY = photoY + photoH + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(26, 26, 46);
  doc.text(`${emp.prenom} ${emp.nom}`.toUpperCase(), x + CARD_W / 2, infoY, { align: 'center' });

  // === Poste ===
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(100, 100, 120);
  doc.text(emp.poste || categorieLabel[emp.categorie] || emp.categorie, x + CARD_W / 2, infoY + 4, { align: 'center' });

  // === Matricule box (gradient style like student badge) ===
  const matBoxW = 30;
  const matBoxH = 6;
  const matBoxX = x + (CARD_W - matBoxW) / 2;
  const matBoxY = infoY + 7;
  // Red-green gradient box
  doc.setFillColor(192, 57, 43);
  doc.roundedRect(matBoxX, matBoxY, matBoxW / 2, matBoxH, 1, 1, 'F');
  doc.setFillColor(30, 132, 73);
  doc.roundedRect(matBoxX + matBoxW / 2 - 1, matBoxY, matBoxW / 2 + 1, matBoxH, 1, 1, 'F');
  // Fill the center gap
  doc.setFillColor(100, 80, 58);
  doc.rect(matBoxX + matBoxW / 2 - 1, matBoxY, 2, matBoxH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3);
  doc.setTextColor(255, 255, 255);
  doc.text('N°', matBoxX + 3, matBoxY + 3.5, { align: 'center' });
  doc.setFontSize(6);
  doc.text(emp.matricule, matBoxX + matBoxW / 2, matBoxY + 4, { align: 'center' });

  // === QR Code ===
  const qrSize = 11;
  const qrX = x + (CARD_W - qrSize) / 2;
  const qrY = matBoxY + matBoxH + 2;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(30, 132, 73);
  doc.setLineWidth(0.3);
  doc.roundedRect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 1, 1, 'FD');
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

  // === Contact info at bottom ===
  const contactY = qrY + qrSize + 2.5;
  const tel = contactInfo?.telephone || '';
  const addr = contactInfo?.adresse || '';

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(3);
  doc.setTextColor(120, 120, 130);
  doc.text('En cas de perte, veuillez contacter :', x + CARD_W / 2, contactY, { align: 'center' });

  if (tel) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(3.2);
    doc.setTextColor(80, 80, 90);
    doc.text(`Tél: ${tel}`, x + CARD_W / 2, contactY + 3, { align: 'center' });
  }

  if (addr) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(2.8);
    doc.setTextColor(100, 100, 110);
    const addrLines = doc.splitTextToSize(addr, CARD_W - 6);
    doc.text(addrLines, x + CARD_W / 2, contactY + (tel ? 5.5 : 3), { align: 'center' });
  }

  // === Footer bar — Red/Green gradient like student badges ===
  const footerH = 5;
  doc.setFillColor(192, 57, 43);
  doc.rect(x, y + CARD_H - footerH, CARD_W * 0.35, footerH, 'F');
  doc.setFillColor(169, 50, 38);
  doc.rect(x + CARD_W * 0.35, y + CARD_H - footerH, CARD_W * 0.15, footerH, 'F');
  doc.setFillColor(30, 132, 73);
  doc.rect(x + CARD_W * 0.5, y + CARD_H - footerH, CARD_W * 0.25, footerH, 'F');
  doc.setFillColor(25, 111, 61);
  doc.rect(x + CARD_W * 0.75, y + CARD_H - footerH, CARD_W * 0.25, footerH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.5);
  doc.setTextColor(255, 255, 255);
  doc.text((categorieLabel[emp.categorie] || emp.categorie).toUpperCase(), x + CARD_W / 2, y + CARD_H - 1.5, { align: 'center' });

  // === Thin border ===
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
