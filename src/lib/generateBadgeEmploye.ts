import jsPDF from 'jspdf';

interface EmployeeBadgeData {
  matricule: string;
  nom: string;
  prenom: string;
  poste: string;
  categorie: string;
  photo_url?: string | null;
  telephone?: string | null;
}

const CARD_W = 85.6; // mm (ID-1 standard)
const CARD_H = 53.98;

const categorieLabel: Record<string, string> = {
  enseignant: 'Enseignant',
  administration: 'Administration',
  service: 'Service',
  direction: 'Direction',
};

export async function generateBadgeEmployePDF(emp: EmployeeBadgeData, qrDataUrl: string, schoolName?: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [CARD_W, CARD_H] });

  // Background gradient effect
  doc.setFillColor(15, 80, 60);
  doc.rect(0, 0, CARD_W, CARD_H, 'F');
  
  // Top accent bar
  doc.setFillColor(34, 197, 94);
  doc.rect(0, 0, CARD_W, 10, 'F');

  // School name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(255, 255, 255);
  doc.text(schoolName || 'Ecole Internationale Les Enfants du Futur', CARD_W / 2, 6, { align: 'center' });

  // Photo area
  const photoX = 5;
  const photoY = 14;
  const photoW = 20;
  const photoH = 24;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(photoX - 0.5, photoY - 0.5, photoW + 1, photoH + 1, 2, 2, 'F');

  if (emp.photo_url) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = emp.photo_url!;
      });
      doc.addImage(img, 'JPEG', photoX, photoY, photoW, photoH);
    } catch {
      doc.setFontSize(16);
      doc.setTextColor(15, 80, 60);
      doc.text(`${emp.prenom[0]}${emp.nom[0]}`, photoX + photoW / 2, photoY + photoH / 2 + 3, { align: 'center' });
    }
  } else {
    doc.setFontSize(16);
    doc.setTextColor(15, 80, 60);
    doc.text(`${emp.prenom[0]}${emp.nom[0]}`, photoX + photoW / 2, photoY + photoH / 2 + 3, { align: 'center' });
  }

  // Info section
  const infoX = 30;
  doc.setTextColor(255, 255, 255);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`${emp.prenom} ${emp.nom}`, infoX, 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(34, 197, 94);
  doc.text(categorieLabel[emp.categorie] || emp.categorie, infoX, 22);

  doc.setTextColor(220, 220, 220);
  doc.setFontSize(6);
  doc.text(`Poste: ${emp.poste || '—'}`, infoX, 27);
  
  if (emp.telephone) {
    doc.text(`Tél: ${emp.telephone}`, infoX, 31);
  }

  // Matricule badge
  doc.setFillColor(34, 197, 94);
  doc.roundedRect(infoX, 34, 26, 7, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(emp.matricule, infoX + 13, 39, { align: 'center' });

  // QR Code
  const qrSize = 18;
  const qrX = CARD_W - qrSize - 5;
  const qrY = 14;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 1.5, 1.5, 'F');
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

  doc.setFontSize(4);
  doc.setTextColor(180, 180, 180);
  doc.text('Scanner pour pointage', qrX + qrSize / 2, qrY + qrSize + 3, { align: 'center' });

  // Bottom bar
  doc.setFillColor(10, 60, 45);
  doc.rect(0, CARD_H - 6, CARD_W, 6, 'F');
  doc.setFontSize(4.5);
  doc.setTextColor(150, 150, 150);
  doc.text('BADGE EMPLOYÉ — NE PAS PRÊTER', CARD_W / 2, CARD_H - 2, { align: 'center' });

  doc.save(`badge_${emp.matricule}.pdf`);
}
