import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function generateBulletinPDF(
  elementId: string,
  filename: string = 'bulletin.pdf'
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Élément bulletin introuvable');
  }

  const a4Container = element.querySelector('[data-bulletin-a4]') as HTMLElement || element;

  // Temporarily ensure crisp rendering
  const originalTransform = a4Container.style.transform;
  const originalTransformOrigin = a4Container.style.transformOrigin;
  a4Container.style.transform = 'none';
  a4Container.style.transformOrigin = 'top left';

  const canvas = await html2canvas(a4Container, {
    scale: 3,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    imageTimeout: 15000,
    onclone: (clonedDoc) => {
      const clonedElement = clonedDoc.querySelector('[data-bulletin-a4]') as HTMLElement;
      if (clonedElement) {
        clonedElement.style.transform = 'none';
        clonedElement.style.width = '794px'; // 210mm ≈ 794px at 96dpi
        clonedElement.style.maxWidth = '794px';
        clonedElement.style.overflow = 'hidden';
        // Force all tables to fixed layout
        clonedElement.querySelectorAll('table').forEach((t: HTMLElement) => {
          t.style.tableLayout = 'fixed';
          t.style.width = '100%';
        });
        // Prevent any cell from overflowing
        clonedElement.querySelectorAll('td, th').forEach((c: HTMLElement) => {
          c.style.overflow = 'hidden';
          c.style.textOverflow = 'ellipsis';
        });
      }
    },
  });

  // Restore original styles
  a4Container.style.transform = originalTransform;
  a4Container.style.transformOrigin = originalTransformOrigin;

  const imgData = canvas.toDataURL('image/png', 1.0);
  
  // A4 dimensions in mm
  const pdfWidth = 210;
  const pdfHeight = 297;
  
  const pdf = new jsPDF('p', 'mm', 'a4');
  
  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * pdfWidth) / canvas.width;
  
  if (imgHeight <= pdfHeight) {
    // Fits on one page — center vertically
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
  } else {
    // Scale down to fit single page
    const scale = pdfHeight / imgHeight;
    const scaledWidth = imgWidth * scale;
    const scaledHeight = pdfHeight;
    const offsetX = (pdfWidth - scaledWidth) / 2;
    pdf.addImage(imgData, 'PNG', offsetX, 0, scaledWidth, scaledHeight, undefined, 'FAST');
  }
  
  pdf.save(filename);
}
