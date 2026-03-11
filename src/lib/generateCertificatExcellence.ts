import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import type { MajorEleve } from '@/hooks/usePerformanceData';

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

function drawBorder(doc: jsPDF, pageW: number, pageH: number) {
  // Outer border
  doc.setDrawColor(180, 150, 50);
  doc.setLineWidth(2);
  doc.rect(8, 8, pageW - 16, pageH - 16);

  // Inner border
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.8);
  doc.rect(13, 13, pageW - 26, pageH - 26);

  // Corner ornaments (small golden squares)
  const corners = [
    [10, 10], [pageW - 14, 10], [10, pageH - 14], [pageW - 14, pageH - 14]
  ];
  doc.setFillColor(200, 170, 50);
  corners.forEach(([x, y]) => {
    doc.rect(x, y, 4, 4, 'F');
  });

  // Decorative lines
  doc.setDrawColor(200, 170, 50);
  doc.setLineWidth(0.4);
  doc.rect(16, 16, pageW - 32, pageH - 32);
}

async function generateSingleCertificate(
  doc: jsPDF,
  major: MajorEleve,
  logoBase64: string | null,
  baseUrl: string
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const centerX = pageW / 2;

  // Background
  doc.setFillColor(255, 253, 245);
  doc.rect(0, 0, pageW, pageH, 'F');

  // Border
  drawBorder(doc, pageW, pageH);

  // Logos (left and right)
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 25, 22, 28, 28);
      doc.addImage(logoBase64, 'PNG', pageW - 53, 22, 28, 28);
    } catch { /* skip if image fails */ }
  }

  // School name
  doc.setTextColor(30, 58, 138);
  doc.setFontSize(13);
  doc.setFont('times', 'bold');
  doc.text('ECOLE INTERNATIONALE LES ENFANTS DU FUTUR', centerX, 30, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('times', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text('Enseignement Général et Technique — Conakry, Guinée', centerX, 37, { align: 'center' });

  // Decorative line
  doc.setDrawColor(200, 170, 50);
  doc.setLineWidth(1);
  doc.line(60, 44, pageW - 60, 44);
  doc.setLineWidth(0.3);
  doc.line(60, 46, pageW - 60, 46);

  // Title
  doc.setFontSize(30);
  doc.setFont('times', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text('CERTIFICAT D\'EXCELLENCE', centerX, 62, { align: 'center' });

  // Subtitle decorative line
  doc.setDrawColor(200, 170, 50);
  doc.setLineWidth(0.5);
  doc.line(80, 67, pageW - 80, 67);

  // Star icons (simulated with text)
  doc.setFontSize(14);
  doc.setTextColor(200, 170, 50);
  doc.text('★  ★  ★', centerX, 75, { align: 'center' });

  // Body text
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(13);
  doc.setFont('times', 'normal');
  doc.text('Ce certificat est décerné à', centerX, 88, { align: 'center' });

  // Student name
  doc.setFontSize(26);
  doc.setFont('times', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text(`${major.prenom} ${major.nom}`, centerX, 102, { align: 'center' });

  // Underline under name
  const nameWidth = doc.getTextWidth(`${major.prenom} ${major.nom}`);
  doc.setDrawColor(200, 170, 50);
  doc.setLineWidth(0.8);
  doc.line(centerX - nameWidth / 2, 105, centerX + nameWidth / 2, 105);

  // Class
  doc.setFontSize(14);
  doc.setFont('times', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(`Élève en classe de : ${major.classe_nom}`, centerX, 117, { align: 'center' });

  // Achievement
  doc.setFontSize(13);
  doc.setFont('times', 'italic');
  doc.text('Pour avoir obtenu la plus haute moyenne de sa promotion', centerX, 128, { align: 'center' });

  // Average - prominent
  doc.setFontSize(36);
  doc.setFont('times', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text(`${major.moyenne.toFixed(2)}`, centerX - 8, 147, { align: 'center' });

  doc.setFontSize(16);
  doc.setFont('times', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('/ 20', centerX + 22, 147, { align: 'center' });

  // Niveau badge
  doc.setFillColor(30, 58, 138);
  const badgeText = `Major de ${major.niveau_nom}`;
  const badgeW = doc.getTextWidth(badgeText) * 0.65 + 20;
  doc.roundedRect(centerX - badgeW / 2, 152, badgeW, 10, 3, 3, 'F');
  doc.setFontSize(10);
  doc.setFont('times', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(badgeText, centerX, 159, { align: 'center' });

  // Date and location
  const today = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  doc.setFontSize(11);
  doc.setFont('times', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(`Fait à Conakry, le ${today}`, centerX, 175, { align: 'center' });

  // Signature section
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.3);

  // Director signature
  doc.line(pageW - 90, pageH - 38, pageW - 40, pageH - 38);
  doc.setFontSize(9);
  doc.setFont('times', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Le Directeur', pageW - 65, pageH - 32, { align: 'center' });

  // School stamp placeholder
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.5);
  doc.circle(centerX, pageH - 38, 12);
  doc.circle(centerX, pageH - 38, 10);
  doc.setFontSize(6);
  doc.setFont('times', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text('EI ENFANTS', centerX, pageH - 41, { align: 'center' });
  doc.text('DU FUTUR', centerX, pageH - 38, { align: 'center' });
  doc.setFontSize(5);
  doc.text('CONAKRY', centerX, pageH - 35, { align: 'center' });

  // QR Code
  try {
    const qrData = major.qr_code
      ? `${baseUrl}/fiche-eleve/${major.qr_code}`
      : `${baseUrl}/fiche-eleve/${major.nom}-${major.prenom}`;
    const qrDataUrl = await QRCode.toDataURL(qrData, { width: 200, margin: 1 });
    doc.addImage(qrDataUrl, 'PNG', 25, pageH - 50, 20, 20);
    doc.setFontSize(5);
    doc.setTextColor(150, 150, 150);
    doc.text('Vérification', 35, pageH - 28, { align: 'center' });
  } catch { /* skip QR if fails */ }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text('Ecole Internationale Les Enfants du Futur — Certificat généré par EduGestion Pro', centerX, pageH - 12, { align: 'center' });
}

export async function generateCertificatePDF(
  major: MajorEleve,
  logoUrl: string | null
) {
  const doc = new jsPDF('l', 'mm', 'a4');
  const logoBase64 = logoUrl ? await loadImageAsBase64(logoUrl) : null;
  const baseUrl = window.location.origin;

  await generateSingleCertificate(doc, major, logoBase64, baseUrl);

  doc.save(`Certificat_Excellence_${major.prenom}_${major.nom}.pdf`);
}

export async function generateAllCertificatesPDF(
  majors: MajorEleve[],
  logoUrl: string | null
) {
  if (majors.length === 0) return;

  const doc = new jsPDF('l', 'mm', 'a4');
  const logoBase64 = logoUrl ? await loadImageAsBase64(logoUrl) : null;
  const baseUrl = window.location.origin;

  for (let i = 0; i < majors.length; i++) {
    if (i > 0) doc.addPage();
    await generateSingleCertificate(doc, majors[i], logoBase64, baseUrl);
  }

  doc.save('Certificats_Excellence_Majors.pdf');
}
