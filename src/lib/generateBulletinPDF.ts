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
    scale: 3, // Higher resolution for crisp text
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    width: a4Container.scrollWidth,
    height: a4Container.scrollHeight,
    logging: false,
    imageTimeout: 15000,
    onclone: (clonedDoc) => {
      // Ensure fonts are rendered in the clone
      const clonedElement = clonedDoc.querySelector('[data-bulletin-a4]') as HTMLElement;
      if (clonedElement) {
        clonedElement.style.transform = 'none';
        clonedElement.style.width = '210mm';
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
