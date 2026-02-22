import jsPDF from 'jspdf';

interface BulletinPaieData {
  employe: {
    nom: string;
    prenom: string;
    matricule: string;
    poste?: string;
    categorie?: string;
    date_embauche?: string;
  };
  mois: number;
  annee: number;
  salaire_brut: number;
  primes: number;
  retenues: number;
  avances_deduites: number;
  salaire_net: number;
  commentaire?: string | null;
  schoolName?: string;
  schoolSubtitle?: string;
  schoolCity?: string;
  logoUrl?: string | null;
}

const MOIS_NOMS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

const fmt = (n: number) => n.toLocaleString('fr-FR');

export async function generateBulletinPaiePDF(data: BulletinPaieData) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const w = 210;
  const margin = 12;
  const contentW = w - margin * 2;
  let y = margin;

  const slate900: [number, number, number] = [15, 23, 42];
  const slate700: [number, number, number] = [51, 65, 85];
  const slate400: [number, number, number] = [148, 163, 184];
  const emerald600: [number, number, number] = [5, 150, 105];
  const emerald50: [number, number, number] = [236, 253, 245];
  const red500: [number, number, number] = [239, 68, 68];
  const amber600: [number, number, number] = [217, 119, 6];
  const lightBg: [number, number, number] = [248, 250, 252];
  const borderColor: [number, number, number] = [226, 232, 240];
  const white: [number, number, number] = [255, 255, 255];

  const schoolName = data.schoolName || 'GROUPE SCOLAIRE EXCELLENCE';
  const schoolCity = data.schoolCity || 'Conakry, Guinée';
  const periode = `${MOIS_NOMS[data.mois]} ${data.annee}`;
  const dateEdition = new Date().toLocaleDateString('fr-FR');

  // ─── Header Band ───
  pdf.setFillColor(...slate900);
  pdf.rect(0, 0, w, 42, 'F');

  // Logo circle or image
  let textStartX = margin + 20;
  if (data.logoUrl) {
    try {
      const img = await loadImage(data.logoUrl);
      const logoH = 16;
      const logoW = (img.width / img.height) * logoH;
      pdf.addImage(img, 'PNG', margin + 2, 6, logoW, logoH);
      textStartX = margin + logoW + 8;
    } catch {
      // Fallback: draw circle with initial
      drawLogoCircle(pdf, margin + 2, 6);
    }
  } else {
    drawLogoCircle(pdf, margin + 2, 6);
  }

  // School name
  pdf.setTextColor(...white);
  pdf.setFontSize(15);
  pdf.setFont('helvetica', 'bold');
  pdf.text(schoolName, textStartX, 15);

  // Address line
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(200, 210, 220);
  pdf.text(`Quartier Almamya, ${schoolCity}`, textStartX, 21);
  pdf.text('Tél : +224 622 00 00 00 | Email : drh@excellence.edu', textStartX, 26);

  // Right side: Bulletin label
  const rightX = w - margin;
  pdf.setFillColor(...emerald600);
  pdf.roundedRect(rightX - 42, 6, 42, 7, 2, 2, 'F');
  pdf.setTextColor(...white);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Bulletin Officiel', rightX - 21, 11, { align: 'center' });

  pdf.setTextColor(...white);
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'bold');
  pdf.text('BULLETIN DE PAIE', rightX, 22, { align: 'right' });

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(200, 210, 220);
  pdf.text(`Période : ${periode}`, rightX, 28, { align: 'right' });

  // Accent bar
  pdf.setFillColor(...emerald600);
  pdf.rect(0, 42, w, 2, 'F');

  y = 52;

  // ─── Employee Info Box ───
  pdf.setFillColor(...lightBg);
  pdf.roundedRect(margin, y, contentW, 34, 3, 3, 'F');
  pdf.setDrawColor(...borderColor);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(margin, y, contentW, 34, 3, 3, 'S');

  // Left: Employee info
  const infoX = margin + 6;
  pdf.setFillColor(...emerald600);
  pdf.circle(infoX + 3, y + 8, 3, 'F');
  pdf.setTextColor(...white);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  // User icon substitute
  pdf.text('E', infoX + 1.5, y + 9.5);

  pdf.setTextColor(...slate900);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Informations Employé', infoX + 9, y + 9);

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...slate900);
  pdf.text(`${data.employe.prenom} ${data.employe.nom}`, infoX, y + 17);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...slate700);
  if (data.employe.poste) {
    pdf.text(data.employe.poste, infoX, y + 22);
  }
  pdf.text(`Matricule : ${data.employe.matricule}`, infoX, y + 27);

  // Right: Grid info
  const gridX = margin + contentW / 2 + 5;
  const gridItems = [
    { label: 'Département', value: data.employe.categorie || 'N/A' },
    { label: 'Embauche', value: data.employe.date_embauche || 'N/A' },
    { label: "Date d'édition", value: dateEdition },
    { label: 'Mode Paiement', value: 'Virement Bancaire' },
  ];

  gridItems.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const gx = gridX + col * 42;
    const gy = y + 7 + row * 12;
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...slate400);
    pdf.text(item.label, gx, gy);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...slate900);
    pdf.text(item.value, gx, gy + 4);
  });

  y += 42;

  // ─── Details Table ───
  const colX = [margin, margin + 62, margin + 92, margin + 122, margin + contentW - 32];
  const rowH = 8;

  // Table header
  pdf.setFillColor(...slate900);
  pdf.roundedRect(margin, y, contentW, rowH + 2, 2, 2, 'F');
  pdf.setTextColor(...white);
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Désignation', colX[0] + 4, y + 6);
  pdf.text('Nombre/Base', colX[1] + 2, y + 6);
  pdf.text('Taux', colX[2] + 2, y + 6);
  pdf.text('Gains (+)', colX[3] + 2, y + 6);
  pdf.text('Retenues (-)', colX[4] - 2, y + 6);
  y += rowH + 2;

  // Build rows from data
  const details: { label: string; base: string; taux: number; gain: number; loss: number }[] = [];
  details.push({ label: 'Salaire de base', base: '1', taux: data.salaire_brut, gain: data.salaire_brut, loss: 0 });
  if (data.primes > 0) {
    details.push({ label: 'Primes & Indemnités', base: '1', taux: data.primes, gain: data.primes, loss: 0 });
  }
  if (data.retenues > 0) {
    details.push({ label: 'Retenues sur salaire', base: '1', taux: data.retenues, gain: 0, loss: data.retenues });
  }
  if (data.avances_deduites > 0) {
    details.push({ label: 'Avance sur salaire / Crédit', base: '1', taux: data.avances_deduites, gain: 0, loss: data.avances_deduites });
  }

  details.forEach((item, i) => {
    if (i % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(margin, y, contentW, rowH, 'F');
    }
    pdf.setDrawColor(...borderColor);
    pdf.setLineWidth(0.15);
    pdf.line(margin, y + rowH, margin + contentW, y + rowH);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...slate900);
    pdf.text(item.label, colX[0] + 4, y + 5.5);
    pdf.setTextColor(...slate700);
    pdf.text(String(item.base), colX[1] + 2, y + 5.5);
    pdf.text(item.taux > 0 ? fmt(item.taux) : '-', colX[2] + 2, y + 5.5);

    if (item.gain > 0) {
      pdf.setTextColor(...emerald600);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`+ ${fmt(item.gain)}`, colX[3] + 2, y + 5.5);
    }
    if (item.loss > 0) {
      pdf.setTextColor(...red500);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`- ${fmt(item.loss)}`, colX[4] - 2, y + 5.5);
    }
    y += rowH;
  });

  y += 6;

  // ─── Summary Box ───
  pdf.setFillColor(...lightBg);
  pdf.roundedRect(margin, y, contentW * 0.6, 38, 3, 3, 'F');
  pdf.setDrawColor(...borderColor);
  pdf.roundedRect(margin, y, contentW * 0.6, 38, 3, 3, 'S');

  const totalBrut = data.salaire_brut + data.primes;
  const totalRetenues = data.retenues + data.avances_deduites;
  const sumX = margin + 6;
  const sumValX = margin + contentW * 0.6 - 6;

  // Brut
  pdf.setTextColor(...slate700);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Total Salaire Brut', sumX, y + 9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...slate900);
  pdf.text(`${fmt(totalBrut)} GNF`, sumValX, y + 9, { align: 'right' });

  // Retenues
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...slate700);
  pdf.text('Total des Retenues', sumX, y + 18);
  pdf.setTextColor(...red500);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`-${fmt(totalRetenues)} GNF`, sumValX, y + 18, { align: 'right' });

  // Separator
  pdf.setDrawColor(...emerald600);
  pdf.setLineWidth(0.4);
  pdf.line(sumX, y + 22, sumValX, y + 22);

  // Net band
  pdf.setFillColor(...emerald600);
  pdf.roundedRect(sumX, y + 25, contentW * 0.6 - 12, 10, 2, 2, 'F');
  pdf.setTextColor(...white);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Net à Payer', sumX + 5, y + 32);
  pdf.text(`${fmt(data.salaire_net)} GNF`, sumValX - 2, y + 32, { align: 'right' });

  // ─── QR Code (right of summary) ───
  const qrBoxX = margin + contentW * 0.6 + 6;
  const qrBoxW = contentW * 0.4 - 6;

  try {
    const qrPayload = JSON.stringify({
      type: 'bulletin_paie',
      matricule: data.employe.matricule,
      nom: `${data.employe.prenom} ${data.employe.nom}`,
      mois: data.mois,
      annee: data.annee,
      net: data.salaire_net,
      hash: `BP-${data.employe.matricule}-${data.mois}-${data.annee}-${Date.now().toString(36)}`,
    });

    const { default: QRCode } = await import('qrcode');
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 200, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } });
    const qrImg = await loadImage(qrDataUrl);
    const qrSize = 24;
    const qrCenterX = qrBoxX + qrBoxW / 2 - qrSize / 2;
    pdf.addImage(qrImg, 'PNG', qrCenterX, y + 2, qrSize, qrSize);

    pdf.setTextColor(...slate400);
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Authentification', qrBoxX + qrBoxW / 2, y + qrSize + 5, { align: 'center' });
    pdf.text('Numérique Unique', qrBoxX + qrBoxW / 2, y + qrSize + 8, { align: 'center' });
  } catch {
    // QR generation failed
  }

  y += 46;

  // ─── Comment ───
  if (data.commentaire) {
    pdf.setTextColor(...slate400);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    pdf.text(`Note : ${data.commentaire}`, margin, y);
    y += 8;
  }

  // ─── Signatures & Legal ───
  y += 4;
  pdf.setFillColor(...lightBg);
  pdf.roundedRect(margin, y, contentW, 34, 3, 3, 'F');
  pdf.setDrawColor(...borderColor);
  pdf.roundedRect(margin, y, contentW, 34, 3, 3, 'S');

  // Left: Direction
  pdf.setTextColor(...slate900);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('La Direction Générale', margin + 10, y + 8);

  pdf.setDrawColor(...borderColor);
  pdf.setLineWidth(0.3);
  pdf.line(margin + 8, y + 12, margin + 60, y + 12);

  pdf.setTextColor(...emerald600);
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(12);
  pdf.text('Signature Digitale', margin + 12, y + 19);

  pdf.setTextColor(...slate400);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.text("Cachet de l'établissement", margin + 10, y + 25);

  // Right: Legal mention
  pdf.setDrawColor(...borderColor);
  pdf.setLineWidth(0.3);
  pdf.line(margin + contentW / 2, y + 4, margin + contentW / 2, y + 30);

  pdf.setTextColor(...amber600);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  const legalText = 'Ce bulletin de paie est généré électroniquement et vaut reçu de paiement. Les informations y figurant sont confidentielles et liées au contrat de travail.';
  pdf.text(legalText, margin + contentW / 2 + 6, y + 10, { maxWidth: contentW / 2 - 14 });

  y += 42;

  // ─── Footer Bar ───
  pdf.setFillColor(...slate900);
  pdf.rect(0, 287, w, 10, 'F');
  pdf.setTextColor(...slate400);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`© ${data.annee} Système de Gestion Scolaire Intégré - Module DRH`, w / 2, 293, { align: 'center' });

  const filename = `bulletin_paie_${data.employe.matricule}_${MOIS_NOMS[data.mois]}_${data.annee}.pdf`;
  pdf.save(filename);
}

function drawLogoCircle(pdf: jsPDF, x: number, y: number) {
  const cx = x + 8;
  const cy = y + 8;
  pdf.setFillColor(5, 150, 105);
  pdf.circle(cx, cy, 8, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('E', cx - 3.5, cy + 4);
}
