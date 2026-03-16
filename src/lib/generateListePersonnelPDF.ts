import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PersonnelEntry {
  nom: string;
  prenom: string;
  poste: string;
  salaire_base: number;
  matricule?: string;
}

interface ListeOptions {
  title: string;
  schoolName: string;
  logoUrl?: string | null;
  employes: PersonnelEntry[];
  mois: string;
}

function fmtNum(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

async function loadImage(url: string): Promise<string | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d')?.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export async function generateListePersonnelPDF(options: ListeOptions) {
  const { title, schoolName, logoUrl, employes, mois } = options;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  let y = 12;

  // Logo
  if (logoUrl) {
    const logoData = await loadImage(logoUrl);
    if (logoData) {
      doc.addImage(logoData, 'PNG', 14, y - 4, 16, 16);
    }
  }

  // School name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 60);
  doc.text(schoolName.toUpperCase(), pageW / 2, y + 2, { align: 'center' });

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Enseignement Général et Technique', pageW / 2, y + 7, { align: 'center' });

  // Line
  y += 12;
  doc.setDrawColor(128, 0, 32);
  doc.setLineWidth(0.8);
  doc.line(14, y, pageW - 14, y);

  // Category title
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(128, 0, 32);
  doc.text(title, pageW / 2, y, { align: 'center' });

  // Month
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(mois, pageW / 2, y, { align: 'center' });

  y += 4;

  // Table
  const totalSalaire = employes.reduce((s, e) => s + Number(e.salaire_base), 0);

  autoTable(doc, {
    startY: y,
    head: [['N°', 'Matricule', 'Nom & Prénom', 'Poste', 'Salaire (GNF)']],
    body: [
      ...employes.map((e, i) => [
        (i + 1).toString(),
        e.matricule || '—',
        `${e.prenom} ${e.nom}`,
        e.poste || '—',
        fmtNum(e.salaire_base),
      ]),
      ['', '', '', { content: 'TOTAL', styles: { fontStyle: 'bold' } }, { content: fmtNum(totalSalaire) + ' GNF', styles: { fontStyle: 'bold' } }],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [128, 0, 32], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 25, font: 'courier' },
      4: { cellWidth: 30, halign: 'right', font: 'courier' },
    },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Effectif: ${employes.length} — Total: ${fmtNum(totalSalaire)} GNF`, 14, 290);
    doc.text(`Page ${i}/${pageCount}`, pageW - 14, 290, { align: 'right' });
  }

  return doc;
}

export async function downloadListePersonnelPDF(options: ListeOptions) {
  const doc = await generateListePersonnelPDF(options);
  const safeTitle = options.title.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`liste_${safeTitle}.pdf`);
}

export async function printListePersonnelPDF(options: ListeOptions) {
  const doc = await generateListePersonnelPDF(options);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 1000);
  };
}
