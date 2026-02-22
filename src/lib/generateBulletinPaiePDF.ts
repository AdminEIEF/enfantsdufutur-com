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
  const m = 16; // margin
  const cw = w - m * 2; // content width
  let y = m;

  const slate900: [number, number, number] = [15, 23, 42];
  const slate800: [number, number, number] = [30, 41, 59];
  const slate600: [number, number, number] = [71, 85, 105];
  const slate500: [number, number, number] = [100, 116, 139];
  const slate400: [number, number, number] = [148, 163, 184];
  const slate300: [number, number, number] = [203, 213, 225];
  const slate200: [number, number, number] = [226, 232, 240];
  const slate100: [number, number, number] = [241, 245, 249];
  const slate50: [number, number, number] = [248, 250, 252];
  const emerald600: [number, number, number] = [5, 150, 105];

  const schoolName = (data.schoolName || 'GROUPE SCOLAIRE EXCELLENCE').toUpperCase();
  const schoolCity = data.schoolCity || 'Quartier Almamya, Conakry, Guinée';
  const periode = `${MOIS_NOMS[data.mois]} ${data.annee}`;
  const dateEdition = new Date().toLocaleDateString('fr-FR');

  // ─── Logo ───
  if (data.logoUrl) {
    try {
      const img = await loadImage(data.logoUrl);
      const logoH = 14;
      const logoW = (img.width / img.height) * logoH;
      pdf.addImage(img, 'PNG', m, y, logoW, logoH);
    } catch { /* skip */ }
  }

  // ─── En-tête minimaliste ───
  pdf.setTextColor(...slate900);
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'bold');
  pdf.text(schoolName, m, y + 6);

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...slate500);
  pdf.text(schoolCity, m, y + 11);

  pdf.setFontSize(6);
  pdf.setTextColor(...slate400);
  pdf.text('RCCM-GN-2022-B-12345', m, y + 15);

  // Right: title
  const rx = m + cw;
  pdf.setTextColor(...slate900);
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('BULLETIN DE PAIE', rx, y + 6, { align: 'right' });

  // Period badge
  pdf.setFillColor(...slate100);
  const periodText = `Période : ${periode}`;
  const ptw = pdf.getTextWidth(periodText) + 8;
  pdf.roundedRect(rx - ptw, y + 9, ptw, 7, 1.5, 1.5, 'F');
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...slate600);
  pdf.text(periodText, rx - ptw + 4, y + 14);

  y += 20;

  // Thick separator
  pdf.setDrawColor(...slate900);
  pdf.setLineWidth(0.8);
  pdf.line(m, y, m + cw, y);

  y += 10;

  // ─── Employee Info ───
  const halfW = cw / 2 - 4;

  // Left: Salarié
  pdf.setFontSize(6.5);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...slate400);
  pdf.text('SALARIÉ', m + 4, y);

  pdf.setDrawColor(...slate200);
  pdf.setLineWidth(0.2);
  pdf.line(m + 18, y - 1.5, m + halfW, y - 1.5);

  y += 5;
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...slate900);
  pdf.text(`${data.employe.prenom} ${data.employe.nom}`, m, y);

  y += 5;
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...slate600);
  if (data.employe.poste) pdf.text(data.employe.poste, m, y);

  y += 4;
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(...slate400);
  pdf.text(`Matricule : ${data.employe.matricule}`, m, y);

  // Right: Informations Contrat
  const ry = y - 14;
  const rcx = m + halfW + 8;

  pdf.setFontSize(6.5);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...slate400);
  pdf.text('INFORMATIONS CONTRAT', rcx, ry);

  pdf.setDrawColor(...slate200);
  pdf.line(rcx + 38, ry - 1.5, m + cw, ry - 1.5);

  // Grid 2x2
  const gridData = [
    { label: 'ANCIENNETÉ', value: data.employe.date_embauche || 'N/A' },
    { label: 'CATÉGORIE', value: data.employe.categorie || 'N/A' },
    { label: 'MODE PAIEMENT', value: 'Virement Bancaire' },
    { label: "DATE D'ÉDITION", value: dateEdition },
  ];

  gridData.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const gx = rcx + col * 42;
    const gy = ry + 5 + row * 10;

    pdf.setFontSize(5.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...slate400);
    pdf.text(item.label, gx, gy);

    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...slate800);
    pdf.text(item.value, gx, gy + 4);
  });

  y += 8;

  // ─── Tableau des rubriques ───
  const colPos = [m, m + cw * 0.50, m + cw * 0.60, m + cw * 0.75, m + cw * 0.88];
  const rowH = 9;

  // Header row
  pdf.setFillColor(...slate50);
  pdf.rect(m, y, cw, rowH, 'F');
  pdf.setDrawColor(...slate200);
  pdf.setLineWidth(0.2);
  pdf.line(m, y, m + cw, y);
  pdf.line(m, y + rowH, m + cw, y + rowH);

  pdf.setFontSize(6);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...slate600);
  pdf.text('LIBELLÉ DES RUBRIQUES', colPos[0] + 4, y + 6);
  pdf.text('BASE', colPos[1] + 2, y + 6);
  pdf.text('TAUX/PRIX', colPos[2] + 2, y + 6);
  pdf.text('GAINS', colPos[3] + 2, y + 6);
  pdf.text('RETENUES', colPos[4] + 2, y + 6);
  y += rowH;

  // Build rows
  const details: { label: string; base: string; taux: number; gain: number; loss: number }[] = [];
  details.push({ label: 'Salaire de base', base: '1', taux: data.salaire_brut, gain: data.salaire_brut, loss: 0 });
  if (data.primes > 0) {
    details.push({ label: 'Primes & Indemnités', base: '1', taux: data.primes, gain: data.primes, loss: 0 });
  }
  if (data.retenues > 0) {
    details.push({ label: 'Retenues sur salaire', base: '1', taux: data.retenues, gain: 0, loss: data.retenues });
  }
  if (data.avances_deduites > 0) {
    details.push({ label: 'Remboursement prêt / Avance', base: '1', taux: data.avances_deduites, gain: 0, loss: data.avances_deduites });
  }

  details.forEach((item, i) => {
    // Divider
    if (i > 0) {
      pdf.setDrawColor(...slate100);
      pdf.setLineWidth(0.15);
      pdf.line(m, y, m + cw, y);
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(...slate800);
    pdf.text(item.label.toUpperCase(), colPos[0] + 4, y + 6);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...slate500);
    pdf.text(String(item.base), colPos[1] + 2, y + 6);
    pdf.text(fmt(item.taux), colPos[2] + 2, y + 6);

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...slate900);
    if (item.gain > 0) {
      pdf.text(fmt(item.gain), colPos[3] + 2, y + 6);
    }
    if (item.loss > 0) {
      pdf.text(fmt(item.loss), colPos[4] + 2, y + 6);
    }

    y += rowH;
  });

  y += 6;

  // ─── Récapitulatif ───
  // Top thick border
  pdf.setDrawColor(...slate900);
  pdf.setLineWidth(0.8);
  pdf.line(m, y, m + cw, y);
  y += 6;

  // Left: totals
  const totalBrut = data.salaire_brut + data.primes;
  const totalRetenues = data.retenues + data.avances_deduites;

  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...slate400);
  pdf.text('TOTAL DES GAINS BRUT', m, y + 2);
  pdf.setTextColor(...slate800);
  pdf.text(`${fmt(totalBrut)} GNF`, m + cw / 2 - 10, y + 2, { align: 'right' });

  y += 7;
  pdf.setTextColor(...slate400);
  pdf.text('TOTAL DES PRÉLÈVEMENTS', m, y + 2);
  pdf.setTextColor(...slate800);
  pdf.text(`-${fmt(totalRetenues)} GNF`, m + cw / 2 - 10, y + 2, { align: 'right' });

  // Right: Net box
  const netBoxX = m + cw / 2 + 5;
  const netBoxW = cw / 2 - 5;
  const netBoxY = y - 9;

  pdf.setFillColor(...slate50);
  pdf.setDrawColor(...slate200);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(netBoxX, netBoxY, netBoxW, 18, 1, 1, 'FD');

  pdf.setFontSize(6);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...slate500);
  pdf.text('NET À PAYER', netBoxX + 6, netBoxY + 7);

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...slate900);
  pdf.text(`${fmt(data.salaire_net)}`, netBoxX + netBoxW - 6, netBoxY + 14, { align: 'right' });

  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.text('GNF', netBoxX + netBoxW - 4, netBoxY + 7);

  y += 20;

  // ─── Comment ───
  if (data.commentaire) {
    pdf.setTextColor(...slate400);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(7);
    pdf.text(`Note : ${data.commentaire}`, m, y);
    y += 8;
  }

  // ─── QR Code + Bas de page ───
  y += 10;

  // QR Code
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
    pdf.addImage(qrImg, 'PNG', m, y, 18, 18);
  } catch { /* skip */ }

  // Text next to QR
  pdf.setFontSize(6.5);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(...slate400);
  pdf.text(`Bulletin généré informatiquement le ${dateEdition}.`, m + 22, y + 6);
  pdf.text('Conservez ce document pour vos archives RH.', m + 22, y + 10);

  // Right: Signature & Cachet
  pdf.setFontSize(5.5);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...slate400);
  pdf.text("SIGNATURE & CACHET DE L'ÉCOLE", m + cw - 2, y + 2, { align: 'right' });

  // Underline for signature
  pdf.setDrawColor(...slate300);
  pdf.setLineWidth(0.2);
  pdf.line(m + cw - 55, y + 4, m + cw, y + 4);

  // Certified badge
  pdf.setTextColor(...emerald600);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DOCUMENT CERTIFIÉ', m + cw - 2, y + 16, { align: 'right' });

  // ─── Footer bar ───
  pdf.setFillColor(...slate900);
  pdf.rect(0, 287, w, 10, 'F');
  pdf.setTextColor(...slate400);
  pdf.setFontSize(6);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${schoolName} • Direction des Ressources Humaines`, w / 2, 293, { align: 'center' });

  const filename = `bulletin_paie_${data.employe.matricule}_${MOIS_NOMS[data.mois]}_${data.annee}.pdf`;
  pdf.save(filename);
}
