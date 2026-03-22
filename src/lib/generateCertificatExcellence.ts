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
  let y = 18;

  // REPUBLIQUE DE GUINEE
  doc.setFontSize(20);
  doc.setFont('times', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('REPUBLIQUE DE GUINEE', centerX, y, { align: 'center' });

  // Travail - Justice - Solidarité (colored)
  y += 9;
  doc.setFontSize(13);
  doc.setFont('times', 'bolditalic');
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
  y += 10;
  doc.setFontSize(11);
  doc.setFont('times', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text("MINISTERE DE L'EDUCATION NATIONALE ET DE L'ALPHABETISATION", centerX, y, { align: 'center' });

  // School name
  y += 8;
  doc.setFontSize(18);
  doc.setFont('times', 'bold');
  doc.setTextColor(0, 0, 139);
  doc.text(schoolConfig.nom.toUpperCase(), centerX, y, { align: 'center' });

  // Slogan
  y += 8;
  doc.setFontSize(14);
  doc.setFont('times', 'bolditalic');
  doc.setTextColor(200, 170, 30);
  doc.text('Faisons plus!', centerX, y, { align: 'center' });

  // === MAIN TITLE ===
  y += 18;
  doc.setFontSize(36);
  doc.setFont('times', 'bold');
  doc.setTextColor(0, 0, 139);
  doc.text("TABLEAU D'HONNEUR", centerX, y, { align: 'center' });

  // Double underline
  const titleWidth = doc.getTextWidth("TABLEAU D'HONNEUR");
  doc.setDrawColor(200, 170, 30);
  doc.setLineWidth(1.5);
  doc.line(centerX - titleWidth / 2, y + 4, centerX + titleWidth / 2, y + 4);
  doc.setLineWidth(0.8);
  doc.line(centerX - titleWidth / 2 + 8, y + 7, centerX + titleWidth / 2 - 8, y + 7);

  // === BODY CONTENT (ALL CENTERED) ===
  y += 22;
  doc.setFontSize(15);
  doc.setFont('times', 'normal');
  doc.setTextColor(0, 0, 0);

  // Student name line - centered
  const nomComplet = `${eleve.prenom} ${eleve.nom}`;
  const line1 = `L'élève : ${nomComplet} , en classe de ${eleve.classe_nom}`;
  const line1Width = doc.getTextWidth(line1);
  const line1X = centerX - line1Width / 2;
  
  // Draw with different styles for each part
  doc.text("L'élève : ", line1X, y);
  const part1W = doc.getTextWidth("L'élève : ");
  
  doc.setFont('times', 'bold');
  doc.setTextColor(206, 17, 38);
  doc.text(nomComplet, line1X + part1W, y);
  const part2W = doc.getTextWidth(nomComplet);
  
  doc.setFont('times', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(" , en classe de ", line1X + part1W + part2W, y);
  const part3W = doc.getTextWidth(" , en classe de ");
  
  doc.setFont('times', 'bold');
  doc.setTextColor(0, 0, 139);
  doc.text(eleve.classe_nom, line1X + part1W + part2W + part3W, y);
  doc.setTextColor(0, 0, 0);

  // Merit text - centered
  y += 14;
  doc.setFontSize(16);
  doc.setFont('times', 'bold');
  doc.setTextColor(0, 0, 0);
  const meritText = "A mérité d'être inscrit(e) au TABLEAU D'HONNEUR";
  doc.text(meritText, centerX, y, { align: 'center' });
  
  y += 10;
  doc.setFont('times', 'normal');
  doc.setFontSize(14);
  doc.text("pour son travail, son assiduité et sa bonne conduite", centerX, y, { align: 'center' });
  
  y += 10;
  const moyenneText = eleve.moyenne.toFixed(2);
  
  // Dynamic period text based on period name
  let periodeLine: string;
  const pName = (periodeName || '').trim().toUpperCase();
  if (pName === 'P1' || pName.includes('PÉRIODE 1') || pName.includes('PREMIERE') || pName.includes('PREMIÈRE')) {
    periodeLine = 'pendant la première période avec une moyenne de: ';
  } else if (pName === 'P2' || pName.includes('PÉRIODE 2') || pName.includes('DEUXIÈME') || pName.includes('DEUXIEME')) {
    periodeLine = 'pendant la deuxième période avec une moyenne de: ';
  } else if (pName === 'P3' || pName.includes('PÉRIODE 3') || pName.includes('TROISIÈME') || pName.includes('TROISIEME')) {
    periodeLine = 'pendant la troisième période avec une moyenne de: ';
  } else if (pName === 'P4' || pName.includes('PÉRIODE 4') || pName.includes('QUATRIÈME') || pName.includes('QUATRIEME')) {
    periodeLine = 'pendant la quatrième période avec une moyenne de: ';
  } else if (pName === 'P5' || pName.includes('TOUTES') || pName.includes('ANNUEL')) {
    periodeLine = 'pendant toutes les périodes avec une moyenne de: ';
  } else if (periodeName) {
    periodeLine = `pendant la période ${periodeName} avec une moyenne de: `;
  } else {
    periodeLine = 'avec une moyenne de: ';
  }
  
  const periodeLineWidth = doc.getTextWidth(periodeLine);
  const moyennePart = `${moyenneText} / ${eleve.seuil <= 10 ? '10' : '20'}.`;
  const moyennePartWidth = doc.getTextWidth(moyennePart);
  const totalWidth = periodeLineWidth + moyennePartWidth;
  const startX = centerX - totalWidth / 2;
  
  doc.text(periodeLine, startX, y);
  doc.setFont('times', 'bold');
  doc.setTextColor(0, 0, 139);
  doc.setFontSize(18);
  doc.text(moyennePart, startX + periodeLineWidth, y);
  doc.setTextColor(0, 0, 0);

  // Closing text - centered
  y += 16;
  doc.setFontSize(14);
  doc.setFont('times', 'bolditalic');
  doc.text("En foi de quoi, nous délivrons ce tableau d'honneur pour servir", centerX, y, { align: 'center' });
  y += 9;
  doc.text("et valoir ce que de droit.", centerX, y, { align: 'center' });

  // === FOOTER ===

  // QR Code (bottom left)
  try {
    const qrData = eleve.qr_code
      ? `${baseUrl}/fiche-eleve/${eleve.qr_code}`
      : `${baseUrl}/fiche-eleve/${eleve.nom}-${eleve.prenom}`;
    const qrDataUrl = await QRCode.toDataURL(qrData, { width: 200, margin: 1 });
    doc.addImage(qrDataUrl, 'PNG', 22, pageH - 52, 26, 26);
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.setFont('times', 'normal');
    doc.text('Vérification', 35, pageH - 24, { align: 'center' });
  } catch { /* skip */ }

  // Directeur Général (centered)
  const dgLabel = 'Directeur Général';
  doc.setFontSize(15);
  doc.setFont('times', 'bold');
  doc.setTextColor(0, 0, 139);
  doc.text(dgLabel, centerX, pageH - 42, { align: 'center' });
  doc.setDrawColor(0, 0, 139);
  doc.setLineWidth(0.6);
  const dgW = doc.getTextWidth(dgLabel);
  doc.line(centerX - dgW / 2 - 10, pageH - 39, centerX + dgW / 2 + 10, pageH - 39);

  // Date
  const today = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  doc.setFontSize(12);
  doc.setFont('times', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Fait à ${schoolConfig.ville}, le ${today}`, centerX, pageH - 18, { align: 'center' });
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
