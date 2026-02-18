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

  // Find the actual A4 container inside
  const a4Container = element.querySelector('[data-bulletin-a4]') as HTMLElement || element;

  const canvas = await html2canvas(a4Container, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    width: a4Container.scrollWidth,
    height: a4Container.scrollHeight,
  });

  const imgData = canvas.toDataURL('image/png');
  
  // A4 dimensions in mm
  const pdfWidth = 210;
  const pdfHeight = 297;
  
  const pdf = new jsPDF('p', 'mm', 'a4');
  
  // Scale image to fit A4
  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * pdfWidth) / canvas.width;
  
  if (imgHeight <= pdfHeight) {
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
  } else {
    // Multi-page if content overflows
    let remainingHeight = canvas.height;
    let position = 0;
    const pageCanvasHeight = (canvas.width * pdfHeight) / pdfWidth;
    
    while (remainingHeight > 0) {
      if (position > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, -(position * pdfWidth / canvas.width), imgWidth, imgHeight);
      remainingHeight -= pageCanvasHeight;
      position += pageCanvasHeight;
    }
  }
  
  pdf.save(filename);
}
