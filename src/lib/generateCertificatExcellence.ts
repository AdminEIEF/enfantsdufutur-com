import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import type { TableauHonneurEleve } from '@/hooks/usePerformanceData';

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
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

function drawBorders(doc: jsPDF, pageW: number, pageH: number) {
  // Outer golden border (thick)
  doc.setDrawColor(200, 170, 30);
  doc.setLineWidth(3);
  doc.rect(5, 5, pageW - 10, pageH - 10);

  // Second golden border (thinner)
  doc.setDrawColor(200, 170, 30);
  doc.setLineWidth(1.5);
  doc.rect(9, 9, pageW - 18, pageH - 18);

  // Inner blue border
  doc.setDrawColor(0, 0, 139);
  doc.setLineWidth(1.5);
  doc.rect(12, 12, pageW - 24, pageH - 24);

  // Corner ornaments (golden squares at intersections)
  const corners = [
    [7, 7], [pageW - 11, 7], [7, pageH - 11], [pageW - 11, pageH - 11]
  ];
  doc.setFillColor(200, 170, 30);
  corners.forEach(([x, y]) => {
    doc.rect(x, y, 4, 4, 'F');
  });
}

function drawFlagTriangles(doc: jsPDF) {
  // Red triangle (top-left corner)
  doc.setFillColor(206, 17, 38);
  doc.triangle(12, 12, 65, 12, 12, 55, 'F');

  // Yellow triangle (smaller, overlapping)
  doc.setFillColor(252, 209, 22);
  doc.triangle(12, 12, 50, 12, 12, 42, 'F');

  // Green triangle (smallest)
  doc.setFillColor(0, 154, 68);
  doc.triangle(12, 12, 35, 12, 12, 30, 'F');
}

async function generateSingleTableauHonneur(
  doc: jsPDF,
  eleve: TableauHonneurEleve,
  logoBase64: string | null,
  baseUrl: string,
  periodeName: string,
  schoolConfig: { nom: string; ville: string }
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const centerX = pageW / 2;

  // White background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, 'F');

  // Borders
  drawBorders(doc, pageW, pageH);

  // Flag triangles
  drawFlagTriangles(doc);

  // Logo (top right)
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', pageW - 58, 16, 40, 40);
    } catch { /* skip */ }
  }

  // === Header Section ===
  let y = 24;

  // REPUBLIQUE DE GUINEE
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('REPUBLIQUE DE GUINEE', centerX, y, { align: 'center' });

  // Travail - Justice - Solidarité
  y += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bolditalic');
  
  // "Travail" in red
  const tjsText = 'Travail - Justice - Solidarité';
  const tjsWidth = doc.getTextWidth(tjsText);
  const tjsStartX = centerX - tjsWidth / 2;
  
  doc.setTextColor(206, 17, 38);
  doc.text('Travail', tjsStartX, y);
  const dashWidth1 = doc.getTextWidth('Travail ');
  doc.setTextColor(0, 0, 0);
  doc.text('- ', tjsStartX + dashWidth1, y);
  const afterDash1 = dashWidth1 + doc.getTextWidth('- ');
  doc.setTextColor(252, 209, 22);
  doc.text('Justice', tjsStartX + afterDash1, y);
  const afterJustice = afterDash1 + doc.getTextWidth('Justice ');
  doc.setTextColor(0, 0, 0);
  doc.text('- ', tjsStartX + afterJustice, y);
  const afterDash2 = afterJustice + doc.getTextWidth('- ');
  doc.setTextColor(0, 154, 68);
  doc.text('Solidarité', tjsStartX + afterDash2, y);

  // MINISTERE
  y += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text("MINISTERE DE L'EDUCATION NATIONALE ET DE L'ALPHABETISATION", centerX, y, { align: 'center' });

  // Horizontal line
  y += 5;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(20, y, pageW - 20, y);

  // School name
  y += 10;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 139);
  doc.text(schoolConfig.nom.toUpperCase(), centerX, y, { align: 'center' });

  // Slogan
  y += 7;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bolditalic');
  doc.setTextColor(252, 209, 22);
  doc.text('Faisons plus!', centerX, y, { align: 'center' });

  // === TABLEAU D'HONNEUR (main title) ===
  y += 14;
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 139);
  doc.text("TABLEAU D'HONNEUR", centerX, y, { align: 'center' });

  // Underline
  const titleWidth = doc.getTextWidth("TABLEAU D'HONNEUR");
  doc.setDrawColor(0, 0, 139);
  doc.setLineWidth(1.2);
  doc.line(centerX - titleWidth / 2, y + 2, centerX + titleWidth / 2, y + 2);

  // === Body ===
  y += 18;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  // "L'élève : -Nom et prenom- , en classe de:--------"
  const nomComplet = `${eleve.prenom} ${eleve.nom}`;
  const ligneEleve = `L'élève :  `;
  const ligneEleveW = doc.getTextWidth(ligneEleve);
  doc.text(ligneEleve, 30, y);
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(206, 17, 38);
  doc.text(nomComplet, 30 + ligneEleveW, y);
  
  const afterName = ligneEleveW + doc.getTextWidth(nomComplet);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(` , en classe de: `, 30 + afterName, y);
  
  const afterClasse = afterName + doc.getTextWidth(` , en classe de: `);
  doc.setFont('helvetica', 'bold');
  doc.text(eleve.classe_nom, 30 + afterClasse, y);

  // Body text
  y += 14;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text("A mérité d'être inscrit(e) au TABLEAU D'HONNEUR", 30, y);
  y += 7;
  doc.text("pour son travail, son assiduité et sa bonne conduite", 30, y);
  y += 7;

  const periodeText = periodeName || 'la période';
  const moyenneText = eleve.moyenne.toFixed(2);
  doc.text(`pendant la `, 30, y);
  const afterPendant = doc.getTextWidth('pendant la ');
  doc.setFont('helvetica', 'bold');
  doc.text(periodeText, 30 + afterPendant, y);
  const afterPeriode = afterPendant + doc.getTextWidth(periodeText);
  doc.setFont('helvetica', 'normal');
  doc.text(` période avec une moyenne de: `, 30 + afterPeriode, y);
  const afterMoyLabel = afterPeriode + doc.getTextWidth(' période avec une moyenne de: ');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 139);
  doc.text(`${moyenneText} / 20.`, 30 + afterMoyLabel, y);

  // Italic closing text
  y += 16;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bolditalic');
  doc.setTextColor(0, 0, 0);
  doc.text("En foi de quoi, nous délivrons ce tableau d'honneur pour servir", 30, y);
  y += 7;
  doc.text("et valoir ce que de droit.", 30, y);

  // Decorative line under closing text
  y += 4;
  doc.setDrawColor(200, 170, 30);
  doc.setLineWidth(1);
  doc.line(30, y, pageW - 60, y);

  // === Footer Section ===
  
  // QR Code (bottom left)
  try {
    const qrData = eleve.qr_code
      ? `${baseUrl}/fiche-eleve/${eleve.qr_code}`
      : `${baseUrl}/fiche-eleve/${eleve.nom}-${eleve.prenom}`;
    const qrDataUrl = await QRCode.toDataURL(qrData, { width: 200, margin: 1 });
    doc.addImage(qrDataUrl, 'PNG', 20, pageH - 50, 25, 25);
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text('Vérification', 32.5, pageH - 23, { align: 'center' });
  } catch { /* skip QR if fails */ }

  // "Directeur Général" (right side)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 139);
  doc.text('Directeur Général', pageW - 35, pageH - 38, { align: 'right' });
  // Underline
  doc.setDrawColor(0, 0, 139);
  doc.setLineWidth(0.5);
  const dgWidth = doc.getTextWidth('Directeur Général');
  doc.line(pageW - 35 - dgWidth, pageH - 36, pageW - 35, pageH - 36);

  // Date (centered bottom)
  const today = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Fait à Sanoyah, le ${today}`, centerX, pageH - 18, { align: 'center' });
}

export async function generateTableauHonneurPDF(
  eleve: TableauHonneurEleve,
  logoUrl: string | null,
  periodeName: string,
  schoolConfig?: { nom: string; ville: string }
) {
  const doc = new jsPDF('l', 'mm', 'a4');
  const logoBase64 = logoUrl ? await loadImageAsBase64(logoUrl) : null;
  const baseUrl = window.location.origin;
  const config = schoolConfig || { nom: 'Ecole Internationale Les Enfants du Futur', ville: 'Sanoyah' };

  await generateSingleTableauHonneur(doc, eleve, logoBase64, baseUrl, periodeName, config);

  doc.save(`Tableau_Honneur_${eleve.prenom}_${eleve.nom}.pdf`);
}

export async function generateAllTableauxHonneurPDF(
  eleves: TableauHonneurEleve[],
  logoUrl: string | null,
  periodeName: string,
  schoolConfig?: { nom: string; ville: string }
) {
  if (eleves.length === 0) return;

  const doc = new jsPDF('l', 'mm', 'a4');
  const logoBase64 = logoUrl ? await loadImageAsBase64(logoUrl) : null;
  const baseUrl = window.location.origin;
  const config = schoolConfig || { nom: 'Ecole Internationale Les Enfants du Futur', ville: 'Sanoyah' };

  for (let i = 0; i < eleves.length; i++) {
    if (i > 0) doc.addPage();
    await generateSingleTableauHonneur(doc, eleves[i], logoBase64, baseUrl, periodeName, config);
  }

  doc.save('Tableaux_Honneur.pdf');
}

// Keep backward compatibility
export async function generateCertificatePDF(
  major: TableauHonneurEleve,
  logoUrl: string | null
) {
  await generateTableauHonneurPDF(major, logoUrl, '');
}

export async function generateAllCertificatesPDF(
  majors: TableauHonneurEleve[],
  logoUrl: string | null
) {
  await generateAllTableauxHonneurPDF(majors, logoUrl, '');
}
