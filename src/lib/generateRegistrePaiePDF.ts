import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PaidEmployee {
  nom: string;
  prenom: string;
  poste: string;
  categorie: string;
  montant: number;
  datePaiement: string;
}

const MOIS_NOMS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

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
  pdf.text(`Généré le : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, pageWidth / 2, 34, { align: 'center' });

  // Table
  const rows = employees.map((e, i) => {
    const d = new Date(e.datePaiement);
    return [
      (i + 1).toString(),
      `${e.prenom} ${e.nom}`,
      e.poste,
      e.categorie,
      `${e.montant.toLocaleString()} GNF`,
      `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR')}`,
    ];
  });

  const totalMontant = employees.reduce((s, e) => s + e.montant, 0);

  autoTable(pdf, {
    startY: 40,
    head: [['#', 'Nom & Prénom', 'Poste', 'Catégorie', 'Montant', 'Date/Heure']],
    body: rows,
    foot: [['', '', '', 'TOTAL', `${totalMontant.toLocaleString()} GNF`, '']],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [16, 85, 65], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 248] },
    theme: 'grid',
  });

  const finalY = (pdf as any).lastAutoTable?.finalY || 180;

  // Signatures section
  const sigY = finalY + 20;
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

  pdf.save(`Registre_Paie_${MOIS_NOMS[mois]}_${annee}.pdf`);
}
