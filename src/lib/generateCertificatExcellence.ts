import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import type { TableauHonneurEleve } from '@/hooks/usePerformanceData';

// Import images as base64 sources
import tableauBgUrl from '@/assets/tableau-honneur-bg.jpg';
import laurelWreathUrl from '@/assets/laurel-wreath.png';
import goldMedalUrl from '@/assets/gold-medal.png';

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

async function generateSingleTableauHonneur(
  doc: jsPDF,
  eleve: TableauHonneurEleve,
  logoBase64: string | null,
  bgBase64: string | null,
  wreathBase64: string | null,
  medalBase64: string | null,
  baseUrl: string,
  periodeName: string,
  schoolConfig: { nom: string; ville: string }
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const centerX = pageW / 2;

  // === BACKGROUND IMAGE (full page) ===
  // Le fond contient déjà les éléments décoratifs (bordures, drapeaux, médaille, couronne)
  if (bgBase64) {
    try {
      doc.addImage(bgBase64, 'JPEG', 0, 0, pageW, pageH);
    } catch { /* skip */ }
  } else {
    // Fallback: draw borders manually
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageW, pageH, 'F');
    drawFallbackBorders(doc, pageW, pageH);
  }

  // === SCHOOL LOGO (top right) ===
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', pageW - 55, 14, 36, 36);
    } catch { /* skip */ }
  }

  // === HEADER SECTION ===
  let y = 22;

  // REPUBLIQUE DE GUINEE
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('REPUBLIQUE DE GUINEE', centerX, y, { align: 'center' });

  // Travail - Justice - Solidarité (colored)
  y += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bolditalic');
  const tjsText = 'Travail - Justice - Solidarité';
  const tjsWidth = doc.getTextWidth(tjsText);
  const tjsStartX = centerX - tjsWidth / 2;

  doc.setTextColor(206, 17, 38);
  doc.text('Travail', tjsStartX, y);
  const w1 = doc.getTextWidth('Travail ');
  doc.setTextColor(0, 0, 0);
  doc.text('- ', tjsStartX + w1, y);
  const w2 = w1 + doc.getTextWidth('- ');
  doc.setTextColor(252, 209, 22);
  doc.text('Justice', tjsStartX + w2, y);
  const w3 = w2 + doc.getTextWidth('Justice ');
  doc.setTextColor(0, 0, 0);
  doc.text('- ', tjsStartX + w3, y);
  const w4 = w3 + doc.getTextWidth('- ');
  doc.setTextColor(0, 154, 68);
  doc.text('Solidarité', tjsStartX + w4, y);

  // MINISTERE
  y += 8;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text("MINISTERE DE L'EDUCATION NATIONALE ET DE L'ALPHABETISATION", centerX, y, { align: 'center' });

  // Horizontal line
  y += 4;
  doc.setDrawColor(200, 170, 30);
  doc.setLineWidth(0.6);
  doc.line(50, y, pageW - 50, y);

  // School name
  y += 9;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 139);
  doc.text(schoolConfig.nom.toUpperCase(), centerX, y, { align: 'center' });

  // Slogan
  y += 6;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bolditalic');
  doc.setTextColor(200, 170, 30);
  doc.text('Faisons plus!', centerX, y, { align: 'center' });

  // === MAIN TITLE ===
  y += 14;
  doc.setFontSize(30);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 139);
  doc.text("TABLEAU D'HONNEUR", centerX, y, { align: 'center' });

  // Double underline
  const titleWidth = doc.getTextWidth("TABLEAU D'HONNEUR");
  doc.setDrawColor(200, 170, 30);
  doc.setLineWidth(1.2);
  doc.line(centerX - titleWidth / 2, y + 3, centerX + titleWidth / 2, y + 3);
  doc.setLineWidth(0.5);
  doc.line(centerX - titleWidth / 2 + 5, y + 5.5, centerX + titleWidth / 2 - 5, y + 5.5);

  // === BODY CONTENT ===
  y += 18;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  // Student name line
  const nomComplet = `${eleve.prenom} ${eleve.nom}`;
  const label1 = `L'élève :  `;
  const label1W = doc.getTextWidth(label1);
  doc.text(label1, 40, y);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(206, 17, 38);
  doc.text(nomComplet, 40 + label1W, y);

  const afterName = label1W + doc.getTextWidth(nomComplet);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(` , en classe de: `, 40 + afterName, y);

  const afterClasse = afterName + doc.getTextWidth(` , en classe de: `);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 139);
  doc.text(eleve.classe_nom, 40 + afterClasse, y);

  // Merit text
  y += 12;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text("A mérité d'être inscrit(e) au TABLEAU D'HONNEUR", 40, y);
  y += 7;
  doc.text("pour son travail, son assiduité et sa bonne conduite", 40, y);
  y += 7;

  // Period + average line
  const periodeText = periodeName || 'la période';
  const moyenneText = eleve.moyenne.toFixed(2);
  doc.text('pendant la ', 40, y);
  const pW = doc.getTextWidth('pendant la ');
  doc.setFont('helvetica', 'bold');
  doc.text(periodeText, 40 + pW, y);
  const afterP = pW + doc.getTextWidth(periodeText);
  doc.setFont('helvetica', 'normal');
  doc.text(' période avec une moyenne de: ', 40 + afterP, y);
  const afterM = afterP + doc.getTextWidth(' période avec une moyenne de: ');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 139);
  doc.setFontSize(14);
  doc.text(`${moyenneText} / ${eleve.seuil <= 10 ? '10' : '20'}.`, 40 + afterM, y);

  // Closing text
  y += 14;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bolditalic');
  doc.setTextColor(0, 0, 0);
  doc.text("En foi de quoi, nous délivrons ce tableau d'honneur pour servir", 40, y);
  y += 7;
  doc.text("et valoir ce que de droit.", 40, y);

  // Decorative gold line
  y += 5;
  doc.setDrawColor(200, 170, 30);
  doc.setLineWidth(0.8);
  doc.line(40, y, pageW - 70, y);

  // === FOOTER ===

  // QR Code (bottom left)
  try {
    const qrData = eleve.qr_code
      ? `${baseUrl}/fiche-eleve/${eleve.qr_code}`
      : `${baseUrl}/fiche-eleve/${eleve.nom}-${eleve.prenom}`;
    const qrDataUrl = await QRCode.toDataURL(qrData, { width: 200, margin: 1 });
    doc.addImage(qrDataUrl, 'PNG', 22, pageH - 48, 22, 22);
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text('Vérification', 33, pageH - 24, { align: 'center' });
  } catch { /* skip */ }

  // Directeur Général (right side)
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 139);
  doc.text('Directeur Général', pageW - 40, pageH - 36, { align: 'right' });
  doc.setDrawColor(0, 0, 139);
  doc.setLineWidth(0.5);
  const dgW = doc.getTextWidth('Directeur Général');
  doc.line(pageW - 40 - dgW, pageH - 34, pageW - 40, pageH - 34);

  // Date
  const today = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Fait à ${schoolConfig.ville}, le ${today}`, centerX, pageH - 16, { align: 'center' });
}

function drawFallbackBorders(doc: jsPDF, pageW: number, pageH: number) {
  const cx = pageW / 2;

  // Top-left flag triangles
  doc.setFillColor(206, 17, 38);
  doc.triangle(0, 0, 70, 0, 0, 60, 'F');
  doc.setFillColor(252, 209, 22);
  doc.triangle(0, 0, 55, 0, 0, 47, 'F');
  doc.setFillColor(0, 154, 68);
  doc.triangle(0, 0, 40, 0, 0, 34, 'F');

  // Bottom-right flag triangles
  doc.setFillColor(0, 154, 68);
  doc.triangle(pageW, pageH, pageW - 70, pageH, pageW, pageH - 60, 'F');
  doc.setFillColor(252, 209, 22);
  doc.triangle(pageW, pageH, pageW - 55, pageH, pageW, pageH - 47, 'F');
  doc.setFillColor(206, 17, 38);
  doc.triangle(pageW, pageH, pageW - 40, pageH, pageW, pageH - 34, 'F');

  // Green border (top + right)
  doc.setDrawColor(0, 154, 68);
  doc.setLineWidth(2);
  doc.line(65, 3, pageW - 3, 3);
  doc.line(pageW - 3, 3, pageW - 3, pageH - 55);

  // Red border (bottom + left)
  doc.setDrawColor(206, 17, 38);
  doc.line(3, 55, 3, pageH - 3);
  doc.line(3, pageH - 3, pageW - 65, pageH - 3);

  // Corner squares
  doc.setFillColor(206, 17, 38);
  doc.rect(pageW - 5, 0, 5, 5, 'F');
  doc.rect(0, pageH - 5, 5, 5, 'F');
  doc.setFillColor(200, 170, 30);
  doc.rect(cx - 2.5, pageH - 5, 5, 5, 'F');
}

export async function generateTableauHonneurPDF(
  eleve: TableauHonneurEleve,
  logoUrl: string | null,
  periodeName: string,
  schoolConfig?: { nom: string; ville: string }
) {
  const doc = new jsPDF('l', 'mm', 'a4');

  const [logoBase64, bgBase64, wreathBase64, medalBase64] = await Promise.all([
    logoUrl ? loadImageAsBase64(logoUrl) : Promise.resolve(null),
    loadImageAsBase64(tableauBgUrl),
    loadImageAsBase64(laurelWreathUrl),
    loadImageAsBase64(goldMedalUrl),
  ]);

  const baseUrl = window.location.origin;
  const config = schoolConfig || { nom: 'Ecole Internationale Les Enfants du Futur', ville: 'Sanoyah' };

  await generateSingleTableauHonneur(doc, eleve, logoBase64, bgBase64, wreathBase64, medalBase64, baseUrl, periodeName, config);

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

  const [logoBase64, bgBase64, wreathBase64, medalBase64] = await Promise.all([
    logoUrl ? loadImageAsBase64(logoUrl) : Promise.resolve(null),
    loadImageAsBase64(tableauBgUrl),
    loadImageAsBase64(laurelWreathUrl),
    loadImageAsBase64(goldMedalUrl),
  ]);

  const baseUrl = window.location.origin;
  const config = schoolConfig || { nom: 'Ecole Internationale Les Enfants du Futur', ville: 'Sanoyah' };

  for (let i = 0; i < eleves.length; i++) {
    if (i > 0) doc.addPage();
    await generateSingleTableauHonneur(doc, eleves[i], logoBase64, bgBase64, wreathBase64, medalBase64, baseUrl, periodeName, config);
  }

  doc.save('Tableaux_Honneur.pdf');
}

// Backward compatibility
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
