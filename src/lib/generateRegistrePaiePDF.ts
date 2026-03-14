import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PaidEmployee {
  nom: string;
  prenom: string;
  poste: string;
  categorie: string;
  montant: number;
  datePaiement: string;
  signatureEmploye?: string;
}

const MOIS_NOMS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function fmtNum(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

export function generateRegistrePaiePDF(
  employees: PaidEmployee[],
  mois: number,
  annee: number,
  signatureDataUrl?: string
) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();

  // Header
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('REGISTRE DE PAIE', pageWidth / 2, 20, { align: 'center' });
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Mois : ${MOIS_NOMS[mois]} ${annee}`, pageWidth / 2, 28, { align: 'center' });

  const now = new Date();
  pdf.text(`Généré le : ${fmtDate(now.toISOString())}`, pageWidth / 2, 34, { align: 'center' });

  // Table
  const rows = employees.map((e, i) => [
    (i + 1).toString(),
    `${e.prenom} ${e.nom}`,
    e.poste,
    e.categorie,
    `${fmtNum(e.montant)} GNF`,
    fmtDate(e.datePaiement),
    e.signatureEmploye ? 'Signé' : 'Non signé',
  ]);

  const totalMontant = employees.reduce((s, e) => s + e.montant, 0);

  autoTable(pdf, {
    startY: 40,
    head: [['#', 'Nom & Prénom', 'Poste', 'Catégorie', 'Montant', 'Date/Heure', 'Signature']],
    body: rows,
    foot: [['', '', '', 'TOTAL', `${fmtNum(totalMontant)} GNF`, '', '']],
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [16, 85, 65], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 248] },
    theme: 'grid',
  });

  let finalY = (pdf as any).lastAutoTable?.finalY || 180;

  // Employee signatures section (if any signed)
  const signedEmployees = employees.filter(e => e.signatureEmploye);
  if (signedEmployees.length > 0) {
    finalY += 10;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Signatures des employés (preuve de réception) :', 15, finalY);
    finalY += 5;

    let col = 0;
    const colWidth = 55;
    const sigHeight = 18;
    const startX = 15;

    signedEmployees.forEach((e, i) => {
      const x = startX + col * (colWidth + 5);
      const y = finalY;

      if (y + sigHeight + 12 > pdf.internal.pageSize.getHeight() - 20) {
        pdf.addPage();
        finalY = 20;
      }

      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${e.prenom} ${e.nom}`, x, y);

      if (e.signatureEmploye) {
        try {
          pdf.addImage(e.signatureEmploye, 'PNG', x, y + 1, colWidth - 5, sigHeight);
        } catch {}
      }

      pdf.setDrawColor(150);
      pdf.line(x, y + sigHeight + 2, x + colWidth - 5, y + sigHeight + 2);

      col++;
      if (col >= 3) {
        col = 0;
        finalY += sigHeight + 15;
      }
    });

    if (col > 0) finalY += sigHeight + 15;
  } else {
    finalY += 10;
  }

  // Signatures section
  const sigY = finalY + 10;
  
  // Check if we need a new page
  if (sigY + 40 > pdf.internal.pageSize.getHeight()) {
    pdf.addPage();
    const newSigY = 30;
    renderOfficialSignatures(pdf, newSigY, signatureDataUrl);
  } else {
    renderOfficialSignatures(pdf, sigY, signatureDataUrl);
  }

  pdf.save(`Registre_Paie_${MOIS_NOMS[mois]}_${annee}.pdf`);
}

function renderOfficialSignatures(pdf: jsPDF, sigY: number, signatureDataUrl?: string) {
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');

  // Trésorier signature
  pdf.text('Signature du Trésorier :', 20, sigY);
  if (signatureDataUrl) {
    pdf.addImage(signatureDataUrl, 'PNG', 20, sigY + 3, 60, 25);
  }
  pdf.setDrawColor(150);
  pdf.line(20, sigY + 30, 80, sigY + 30);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text('Le Trésorier', 40, sigY + 35);

  // Director signature
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text('Signature du Directeur Général :', 120, sigY);
  pdf.setDrawColor(150);
  pdf.line(120, sigY + 30, 185, sigY + 30);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text('Le Directeur Général', 135, sigY + 35);
}
