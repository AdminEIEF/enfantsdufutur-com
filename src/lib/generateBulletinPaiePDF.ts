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

export async function generateBulletinPaiePDF(data: BulletinPaieData) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const w = 210;
  const margin = 15;
  const contentW = w - margin * 2;
  let y = margin;

  const primaryColor: [number, number, number] = [15, 23, 42];
  const accentColor: [number, number, number] = [16, 185, 129];
  const lightBg: [number, number, number] = [248, 250, 252];
  const borderColor: [number, number, number] = [226, 232, 240];

  const schoolName = data.schoolName || 'ECOLE INTERNATIONALE LES ENFANTS DU FUTUR';
  const schoolCity = data.schoolCity || 'Conakry, Guinée';
  const periode = `${MOIS_NOMS[data.mois]} ${data.annee}`;
  const dateEdition = new Date().toLocaleDateString('fr-FR');

  // ─── Header band ───
  pdf.setFillColor(...primaryColor);
  pdf.rect(0, 0, w, 38, 'F');

  // Logo
  let textStartX = margin;
  if (data.logoUrl) {
    try {
      const img = await loadImage(data.logoUrl);
      const logoH = 16;
      const logoW = (img.width / img.height) * logoH;
      pdf.addImage(img, 'PNG', margin, 4, logoW, logoH);
      textStartX = margin + logoW + 4;
    } catch {
      // Logo failed to load, continue without it
    }
  }

  // School name
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(schoolName, textStartX, 14);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(schoolCity, textStartX, 20);

  // Right side: Bulletin title
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('BULLETIN DE PAIE', w - margin, 14, { align: 'right' });
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Période : ${periode}`, w - margin, 20, { align: 'right' });

  // Accent bar
  pdf.setFillColor(...accentColor);
  pdf.rect(0, 38, w, 2, 'F');

  y = 48;

  // ─── Employee Info Box ───
  pdf.setFillColor(...lightBg);
  pdf.roundedRect(margin, y, contentW, 30, 2, 2, 'F');
  pdf.setDrawColor(...borderColor);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(margin, y, contentW, 30, 2, 2, 'S');

  pdf.setTextColor(...primaryColor);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`${data.employe.prenom} ${data.employe.nom}`, margin + 5, y + 8);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100, 116, 139);
  if (data.employe.poste) {
    pdf.text(data.employe.poste, margin + 5, y + 14);
  }
  pdf.text(`Matricule : ${data.employe.matricule}`, margin + 5, y + 20);
  if (data.employe.categorie) {
    pdf.text(`Catégorie : ${data.employe.categorie}`, margin + 5, y + 26);
  }

  // Right column info
  const rightX = margin + contentW - 60;
  pdf.text(`Date d'édition : ${dateEdition}`, rightX, y + 8);
  if (data.employe.date_embauche) {
    pdf.text(`Embauche : ${data.employe.date_embauche}`, rightX, y + 14);
  }
  pdf.text('Mode : Virement Bancaire', rightX, y + 20);

  y += 38;

  // ─── Details Table ───
  const cols = [margin, margin + 70, margin + 100, margin + 135, margin + contentW - 30];
  const colWidths = [70, 30, 35, 35, 30];
  const rowH = 8;

  // Table header
  pdf.setFillColor(...primaryColor);
  pdf.rect(margin, y, contentW, rowH + 2, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Désignation', cols[0] + 3, y + 6);
  pdf.text('Base', cols[1] + 3, y + 6);
  pdf.text('Taux', cols[2] + 3, y + 6);
  pdf.text('Gains (+)', cols[3] + 3, y + 6);
  pdf.text('Retenues (-)', cols[4] - 5, y + 6);
  y += rowH + 2;

  // Table rows
  const details: { label: string; base: string; taux: number; gain: number; loss: number }[] = [];

  details.push({ label: 'Salaire de base', base: '1', taux: data.salaire_brut, gain: data.salaire_brut, loss: 0 });
  if (data.primes > 0) {
    details.push({ label: 'Primes', base: '1', taux: data.primes, gain: data.primes, loss: 0 });
  }
  if (data.retenues > 0) {
    details.push({ label: 'Retenues', base: '1', taux: data.retenues, gain: 0, loss: data.retenues });
  }
  if (data.avances_deduites > 0) {
    details.push({ label: 'Avances déduites sur salaire', base: '1', taux: data.avances_deduites, gain: 0, loss: data.avances_deduites });
  }

  const fmt = (n: number) => n.toLocaleString('fr-FR');

  details.forEach((item, i) => {
    if (i % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(margin, y, contentW, rowH, 'F');
    }
    pdf.setDrawColor(...borderColor);
    pdf.setLineWidth(0.2);
    pdf.line(margin, y + rowH, margin + contentW, y + rowH);

    pdf.setTextColor(...primaryColor);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(item.label, cols[0] + 3, y + 5.5);
    pdf.text(item.base, cols[1] + 3, y + 5.5);
    pdf.text(item.taux > 0 ? fmt(item.taux) : '-', cols[2] + 3, y + 5.5);

    if (item.gain > 0) {
      pdf.setTextColor(16, 185, 129);
      pdf.text(`+ ${fmt(item.gain)}`, cols[3] + 3, y + 5.5);
    }
    if (item.loss > 0) {
      pdf.setTextColor(239, 68, 68);
      pdf.text(`- ${fmt(item.loss)}`, cols[4] - 5, y + 5.5);
    }
    y += rowH;
  });

  y += 4;

  // ─── Summary Box ───
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(margin, y, contentW, 36, 2, 2, 'F');
  pdf.setDrawColor(...borderColor);
  pdf.roundedRect(margin, y, contentW, 36, 2, 2, 'S');

  const totalBrut = data.salaire_brut + data.primes;
  const totalRetenues = data.retenues + data.avances_deduites;

  pdf.setTextColor(...primaryColor);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Total Salaire Brut', margin + 5, y + 9);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`${fmt(totalBrut)} GNF`, margin + contentW - 5, y + 9, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.text('Total des Retenues', margin + 5, y + 18);
  pdf.setTextColor(239, 68, 68);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`-${fmt(totalRetenues)} GNF`, margin + contentW - 5, y + 18, { align: 'right' });

  // Net line
  pdf.setDrawColor(...accentColor);
  pdf.setLineWidth(0.5);
  pdf.line(margin + 5, y + 22, margin + contentW - 5, y + 22);

  pdf.setFillColor(16, 185, 129);
  pdf.roundedRect(margin + 5, y + 24, contentW - 10, 10, 1, 1, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Net à Payer', margin + 10, y + 31);
  pdf.text(`${fmt(data.salaire_net)} GNF`, margin + contentW - 10, y + 31, { align: 'right' });

  y += 44;

  // ─── Comment ───
  if (data.commentaire) {
    pdf.setTextColor(100, 116, 139);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    pdf.text(`Note : ${data.commentaire}`, margin, y);
    y += 8;
  }

  // ─── Signatures ───
  y += 10;
  pdf.setTextColor(...primaryColor);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('La Direction Générale', margin + 10, y);
  pdf.text("Signature de l'employé", margin + contentW - 50, y);
  y += 4;
  pdf.setDrawColor(...borderColor);
  pdf.setLineWidth(0.3);
  pdf.line(margin + 5, y, margin + 60, y);
  pdf.line(margin + contentW - 60, y, margin + contentW - 5, y);

  y += 6;
  pdf.setFontSize(7);
  pdf.setTextColor(148, 163, 184);
  pdf.text("Cachet de l'établissement", margin + 10, y);

  // ─── Footer ───
  y += 15;
  pdf.setFillColor(...lightBg);
  pdf.rect(margin, y, contentW, 14, 'F');
  pdf.setDrawColor(...borderColor);
  pdf.rect(margin, y, contentW, 14, 'S');
  pdf.setTextColor(100, 116, 139);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'italic');
  const footerText = 'Ce bulletin de paie est généré électroniquement et vaut reçu de paiement. Les informations y figurant sont confidentielles.';
  pdf.text(footerText, margin + 5, y + 5, { maxWidth: contentW - 10 });

  // Bottom bar
  pdf.setFillColor(...primaryColor);
  pdf.rect(0, 287, w, 10, 'F');
  pdf.setTextColor(148, 163, 184);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`© ${data.annee} Système de Gestion Scolaire Intégré - Module DRH`, w / 2, 293, { align: 'center' });

  const filename = `bulletin_paie_${data.employe.matricule}_${MOIS_NOMS[data.mois]}_${data.annee}.pdf`;
  pdf.save(filename);
}
