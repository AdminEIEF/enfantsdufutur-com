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
  avance_totale?: number;
  reste_avance?: number;
  commentaire?: string | null;
  schoolName?: string;
  schoolSubtitle?: string;
  schoolCity?: string;
  logoUrl?: string | null;
  signatureEmploye?: string;
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

const fmt = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// School brand colors (green & red from the logo)
const GREEN: [number, number, number] = [0, 128, 58];
const RED: [number, number, number] = [200, 30, 30];
const DARK: [number, number, number] = [33, 33, 33];
const GRAY: [number, number, number] = [120, 120, 120];
const LIGHT_GRAY: [number, number, number] = [200, 200, 200];
const WHITE: [number, number, number] = [255, 255, 255];
const BG_LIGHT: [number, number, number] = [245, 248, 245];

export async function generateBulletinPaiePDF(data: BulletinPaieData) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const w = 210;
  const m = 14;
  const cw = w - m * 2;
  let y = m;

  const schoolName = (data.schoolName || 'ECOLE INTERNATIONALE LES ENFANTS DU FUTUR').toUpperCase();
  const schoolSub = data.schoolSubtitle || 'Enseignement Général et Technique';
  const schoolCity = data.schoolCity || 'Conakry, Guinée';
  const periode = `${MOIS_NOMS[data.mois]} ${data.annee}`;
  const dateEdition = new Date().toLocaleDateString('fr-FR');

  // ═══════════════════════════════════════════
  // TOP GREEN BAR
  // ═══════════════════════════════════════════
  pdf.setFillColor(...GREEN);
  pdf.rect(0, 0, w, 4, 'F');

  y = 10;

  // ═══════════════════════════════════════════
  // HEADER: Logo + School Name
  // ═══════════════════════════════════════════
  let logoEndX = m;
  if (data.logoUrl) {
    try {
      const img = await loadImage(data.logoUrl);
      const logoH = 18;
      const logoW = (img.width / img.height) * logoH;
      pdf.addImage(img, 'PNG', m, y, logoW, logoH);
      logoEndX = m + logoW + 4;
    } catch { /* skip */ }
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(...GREEN);
  pdf.text(schoolName, logoEndX, y + 7);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...GRAY);
  pdf.text(schoolSub, logoEndX, y + 12);
  pdf.text(schoolCity, logoEndX, y + 16);

  y += 24;

  // ═══════════════════════════════════════════
  // TITLE
  // ═══════════════════════════════════════════
  pdf.setFillColor(...GREEN);
  pdf.roundedRect(m, y, cw, 12, 2, 2, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(...WHITE);
  pdf.text('BULLETIN DE PAIE', w / 2, y + 8.5, { align: 'center' });

  y += 16;

  // Period
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(...DARK);
  pdf.text(`Période : ${periode}`, m, y + 4);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...GRAY);
  pdf.text(`Édité le ${dateEdition}`, m + cw, y + 4, { align: 'right' });

  y += 10;

  // ═══════════════════════════════════════════
  // EMPLOYEE INFO BOX
  // ═══════════════════════════════════════════
  pdf.setFillColor(...BG_LIGHT);
  pdf.setDrawColor(...GREEN);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(m, y, cw, 24, 2, 2, 'FD');

  const infoCol1 = m + 5;
  const infoCol2 = m + cw / 2 + 5;
  let iy = y + 6;

  const drawInfo = (label: string, value: string, x: number, yy: number) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...GRAY);
    pdf.text(label, x, yy);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...DARK);
    pdf.text(value, x, yy + 4.5);
  };

  drawInfo('Nom & Prénom', `${data.employe.prenom} ${data.employe.nom}`, infoCol1, iy);
  drawInfo('Matricule', data.employe.matricule, infoCol2, iy);
  iy += 12;
  drawInfo('Poste', data.employe.poste || '—', infoCol1, iy);
  drawInfo('Catégorie', data.employe.categorie || '—', infoCol2, iy);

  y += 28;

  // ═══════════════════════════════════════════
  // TABLE
  // ═══════════════════════════════════════════
  const tableX = m;
  const colWidths = [cw * 0.55, cw * 0.22, cw * 0.23];
  const rowH = 9;

  // Table header
  pdf.setFillColor(...GREEN);
  pdf.rect(tableX, y, cw, rowH, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...WHITE);
  pdf.text('DÉSIGNATION', tableX + 4, y + 6);
  pdf.text('GAINS', tableX + colWidths[0] + colWidths[1] / 2, y + 6, { align: 'center' });
  pdf.text('RETENUES', tableX + colWidths[0] + colWidths[1] + colWidths[2] / 2, y + 6, { align: 'center' });
  y += rowH;

  // Table rows
  const rows: { label: string; gain: number; loss: number }[] = [
    { label: 'Salaire de base', gain: data.salaire_brut, loss: 0 },
  ];
  if (data.primes > 0) rows.push({ label: 'Primes & Indemnités', gain: data.primes, loss: 0 });
  if (data.retenues > 0) rows.push({ label: 'Retenues sur salaire', gain: 0, loss: data.retenues });
  if ((data.avance_totale || 0) > 0) rows.push({ label: `Avance totale accordée`, gain: 0, loss: 0 });
  if (data.avances_deduites > 0) rows.push({ label: 'Remboursement avance (déduit)', gain: 0, loss: data.avances_deduites });

  rows.forEach((row, i) => {
    const isAlt = i % 2 === 0;
    if (isAlt) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(tableX, y, cw, rowH, 'F');
    }

    // Bottom border
    pdf.setDrawColor(...LIGHT_GRAY);
    pdf.setLineWidth(0.15);
    pdf.line(tableX, y + rowH, tableX + cw, y + rowH);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...DARK);
    pdf.text(row.label, tableX + 4, y + 6);

    // Special row for avance totale info
    if (row.label.startsWith('Avance totale') && (data.avance_totale || 0) > 0) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(...RED);
      pdf.text(`${fmt(data.avance_totale || 0)} GNF`, tableX + colWidths[0] + colWidths[1] + colWidths[2] / 2, y + 6, { align: 'center' });
    } else {
      pdf.setFont('helvetica', 'bold');
      if (row.gain > 0) {
        pdf.setTextColor(...GREEN);
        pdf.text(`${fmt(row.gain)} GNF`, tableX + colWidths[0] + colWidths[1] / 2, y + 6, { align: 'center' });
      }
      if (row.loss > 0) {
        pdf.setTextColor(...RED);
        pdf.text(`-${fmt(row.loss)} GNF`, tableX + colWidths[0] + colWidths[1] + colWidths[2] / 2, y + 6, { align: 'center' });
      }
    }

    y += rowH;
  });

  // Totals row
  y += 2;
  pdf.setDrawColor(...GREEN);
  pdf.setLineWidth(0.6);
  pdf.line(tableX, y, tableX + cw, y);
  y += 1;

  pdf.setFillColor(240, 245, 240);
  pdf.rect(tableX, y, cw, rowH + 1, 'F');

  const totalGains = data.salaire_brut + data.primes;
  const totalRetenues = data.retenues + data.avances_deduites;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(...DARK);
  pdf.text('TOTAUX', tableX + 4, y + 6.5);
  pdf.setTextColor(...GREEN);
  pdf.text(`${fmt(totalGains)} GNF`, tableX + colWidths[0] + colWidths[1] / 2, y + 6.5, { align: 'center' });
  pdf.setTextColor(...RED);
  pdf.text(`-${fmt(totalRetenues)} GNF`, tableX + colWidths[0] + colWidths[1] + colWidths[2] / 2, y + 6.5, { align: 'center' });

  y += rowH + 5;

  // ═══════════════════════════════════════════
  // NET À PAYER BOX
  // ═══════════════════════════════════════════
  const netBoxW = 90;
  const netBoxH = 20;
  const netBoxX = m + cw - netBoxW;

  pdf.setFillColor(...GREEN);
  pdf.roundedRect(netBoxX, y, netBoxW, netBoxH, 3, 3, 'F');

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...WHITE);
  pdf.text('NET À PAYER', netBoxX + 8, y + 8);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text(`${fmt(data.salaire_net)} GNF`, netBoxX + netBoxW - 8, y + 15, { align: 'right' });

  y += netBoxH + 6;

  // ═══════════════════════════════════════════
  // COMMENT
  // ═══════════════════════════════════════════
  if (data.commentaire) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...GRAY);
    pdf.text(`Observation : ${data.commentaire}`, m, y);
    y += 8;
  }

  // ═══════════════════════════════════════════
  // QR CODE + FOOTER
  // ═══════════════════════════════════════════
  y = Math.max(y, 220);

  // QR Code of the employee
  try {
    const qrPayload = JSON.stringify({
      type: 'bulletin_paie',
      matricule: data.employe.matricule,
      nom: `${data.employe.prenom} ${data.employe.nom}`,
      mois: data.mois,
      annee: data.annee,
      net: data.salaire_net,
      hash: `BP-${data.employe.matricule}-${data.mois}-${data.annee}`,
    });

    const { default: QRCode } = await import('qrcode');
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 300, margin: 1, color: { dark: '#00803a', light: '#ffffff' } });
    const qrImg = await loadImage(qrDataUrl);
    pdf.addImage(qrImg, 'PNG', m, y, 24, 24);
  } catch { /* skip */ }

  // Text next to QR
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(...GRAY);
  pdf.text(`Document généré le ${dateEdition}`, m + 28, y + 6);
  pdf.text('Scannez le QR code pour vérifier l\'authenticité.', m + 28, y + 11);
  pdf.text(`${data.employe.matricule} — ${data.employe.prenom} ${data.employe.nom}`, m + 28, y + 16);

  // Signature zone - Employee
  if (data.signatureEmploye) {
    try {
      const sigImg = await loadImage(data.signatureEmploye);
      const sigW = 45;
      const sigH = (sigImg.height / sigImg.width) * sigW;
      pdf.addImage(sigImg, 'PNG', m + cw - sigW - 5, y - 2, sigW, Math.min(sigH, 20));
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(...DARK);
      pdf.text('Signature de l\'employé', m + cw, y + 20, { align: 'right' });
    } catch {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.setTextColor(...DARK);
      pdf.text('Signature & Cachet', m + cw, y + 4, { align: 'right' });
      pdf.setDrawColor(...LIGHT_GRAY);
      pdf.setLineWidth(0.3);
      pdf.line(m + cw - 50, y + 8, m + cw, y + 8);
    }
  } else {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(...DARK);
    pdf.text('Signature & Cachet', m + cw, y + 4, { align: 'right' });
    pdf.setDrawColor(...LIGHT_GRAY);
    pdf.setLineWidth(0.3);
    pdf.line(m + cw - 50, y + 8, m + cw, y + 8);
  }

  // ═══════════════════════════════════════════
  // BOTTOM BAR
  // ═══════════════════════════════════════════
  pdf.setFillColor(...GREEN);
  pdf.rect(0, 289, w, 8, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  pdf.setTextColor(...WHITE);
  pdf.text(`${schoolName}  •  Direction des Ressources Humaines  •  ${schoolCity}`, w / 2, 294, { align: 'center' });

  // Red accent line
  pdf.setFillColor(...RED);
  pdf.rect(0, 288, w, 1, 'F');

  const filename = `bulletin_paie_${data.employe.matricule}_${MOIS_NOMS[data.mois]}_${data.annee}.pdf`;
  pdf.save(filename);
}
