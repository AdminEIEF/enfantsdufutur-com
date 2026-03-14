import jsPDF from 'jspdf';
import badgeTemplateSrc from '@/assets/badge-personnel-template.jpg';

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

let cachedTemplateImg: HTMLImageElement | null = null;

async function getTemplateImage(): Promise<HTMLImageElement | null> {
  if (cachedTemplateImg) return cachedTemplateImg;
  cachedTemplateImg = await loadImage(badgeTemplateSrc);
  return cachedTemplateImg;
}

function drawSingleBadge(
  doc: jsPDF,
  emp: EmployeeBadgeData,
  qrDataUrl: string,
  templateImg: HTMLImageElement | null,
  offsetX: number,
  offsetY: number,
  photoImg: HTMLImageElement | null,
  contactInfo?: ContactInfo
) {
  const x = offsetX;
  const y = offsetY;

  // === Background template image ===
  if (templateImg) {
    doc.addImage(templateImg, 'JPEG', x, y, CARD_W, CARD_H);
  } else {
    // Fallback white background
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, CARD_W, CARD_H, 'F');
  }

  // === Photo dans le cadre vert du haut ===
  const photoW = 26;
  const photoH = 26;
  const photoX = x + (CARD_W - photoW) / 2;
  const photoY = y + 14.5;

  if (photoImg) {
    doc.addImage(photoImg, 'JPEG', photoX, photoY, photoW, photoH);
  }

  // === Nom et prénom (gros, rouge, sous la photo ~50%) ===
  const nameY = y + 46;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(200, 16, 46);
  const fullName = `${emp.prenom} ${emp.nom}`.toUpperCase();
  const nameLines = doc.splitTextToSize(fullName, CARD_W - 6);
  doc.text(nameLines, x + CARD_W / 2, nameY, { align: 'center' });

  // === Fonction (italique, sous le nom ~55%) ===
  const fonctionY = nameY + nameLines.length * 4 + 1;
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 50);
  doc.text(emp.poste || emp.categorie, x + CARD_W / 2, fonctionY, { align: 'center' });

  // === Matricule (sur la barre tricolore ~62%) ===
  const matY = y + 58;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(emp.matricule, x + CARD_W / 2, matY, { align: 'center' });

  // === QR Code (cadre blanc du bas ~66-84%) ===
  const qrSize = 15;
  const qrX = x + (CARD_W - qrSize) / 2;
  const qrY = y + 61;
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

  // === Contact & Web (bandeau du bas ~94%) ===
  const tel = contactInfo?.telephone || '';
  const web = contactInfo?.web || '';
  const footerY = y + CARD_H - 3;

  if (tel || web) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255);
    if (tel && web) {
      doc.text(`${tel} | ${web}`, x + CARD_W / 2, footerY, { align: 'center' });
    } else if (tel) {
      doc.text(tel, x + CARD_W / 2, footerY, { align: 'center' });
    } else if (web) {
      doc.text(web, x + CARD_W / 2, footerY, { align: 'center' });
    }
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

  const templateImg = await getTemplateImage();
  const photoImg = emp.photo_url ? await loadImage(emp.photo_url) : null;

  drawSingleBadge(doc, emp, qrDataUrl, templateImg, 0, 0, photoImg, contactInfo);

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

  const templateImg = await getTemplateImage();

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

      drawSingleBadge(doc, emp, qr, templateImg, ox, oy, photoImg, contactInfo);

      // Pas de cut marks - le template a déjà les repères visuels
    }
  }

  doc.save(`planches_badges_employes.pdf`);
}
