import jsPDF from 'jspdf';

interface BulletinPaieData {
  employe: {
    nom: string;
    prenom: string;
    matricule: string;
    poste?: string;
    categorie?: string;
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
}

const MOIS_NOMS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export function generateBulletinPaiePDF(data: BulletinPaieData) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const w = 210;
  let y = 20;

  // Header
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(data.schoolName || 'LES ENFANTS DU FUTUR', w / 2, y, { align: 'center' });
  y += 10;

  pdf.setFontSize(13);
  pdf.text('BULLETIN DE PAIE', w / 2, y, { align: 'center' });
  y += 8;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${MOIS_NOMS[data.mois]} ${data.annee}`, w / 2, y, { align: 'center' });
  y += 12;

  // Separator
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.5);
  pdf.line(20, y, w - 20, y);
  y += 10;

  // Employee info
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Informations Employé', 20, y);
  y += 7;
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Nom : ${data.employe.prenom} ${data.employe.nom}`, 20, y); y += 5;
  pdf.text(`Matricule : ${data.employe.matricule}`, 20, y); y += 5;
  if (data.employe.poste) { pdf.text(`Poste : ${data.employe.poste}`, 20, y); y += 5; }
  y += 8;

  // Table
  pdf.setDrawColor(100);
  pdf.setLineWidth(0.3);

  const col1 = 20, col2 = 140, rowH = 8;
  const drawRow = (label: string, value: string, bold = false) => {
    pdf.line(col1, y, w - 20, y);
    if (bold) pdf.setFont('helvetica', 'bold');
    else pdf.setFont('helvetica', 'normal');
    pdf.text(label, col1 + 3, y + 5.5);
    pdf.text(value, col2 + 3, y + 5.5);
    y += rowH;
  };

  // Header row
  pdf.setFillColor(240, 240, 240);
  pdf.rect(col1, y, w - 40, rowH, 'F');
  drawRow('Désignation', 'Montant (GNF)', true);
  
  drawRow('Salaire de base (brut)', Number(data.salaire_brut).toLocaleString());
  if (data.primes > 0) drawRow('Primes', '+' + Number(data.primes).toLocaleString());
  if (data.retenues > 0) drawRow('Retenues', '-' + Number(data.retenues).toLocaleString());
  if (data.avances_deduites > 0) drawRow('Avances déduites', '-' + Number(data.avances_deduites).toLocaleString());
  
  // Net row
  pdf.setFillColor(220, 255, 220);
  pdf.rect(col1, y, w - 40, rowH, 'F');
  drawRow('SALAIRE NET', Number(data.salaire_net).toLocaleString() + ' GNF', true);
  pdf.line(col1, y, w - 20, y);

  y += 10;
  if (data.commentaire) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9);
    pdf.text(`Note : ${data.commentaire}`, 20, y);
    y += 10;
  }

  // Footer
  y += 15;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text('Signature de l\'employé', 30, y);
  pdf.text('Signature de la direction', 140, y);
  y += 3;
  pdf.line(25, y, 80, y);
  pdf.line(135, y, 190, y);

  const filename = `bulletin_paie_${data.employe.matricule}_${MOIS_NOMS[data.mois]}_${data.annee}.pdf`;
  pdf.save(filename);
}
