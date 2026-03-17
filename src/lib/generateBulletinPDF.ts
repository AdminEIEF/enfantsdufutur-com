import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Generate a high-quality print-ready PDF (300 DPI minimum).
 * 
 * Strategy:
 * - html2canvas scale=5 → captures at ~5× CSS pixels
 *   For A4 at 794px CSS width, this gives 3970px canvas width.
 *   At 210mm print width, that's 3970 / 8.27" ≈ 480 DPI — well above 300 DPI.
 * - PNG format for lossless text rendering (no JPEG artifacts on thin lines/text)
 * - jsPDF compression enabled for smaller file size
 * - FAST image compression in PDF for best quality
 */
export async function generateBulletinPDF(
  elementId: string,
  filename: string = 'bulletin.pdf'
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Élément bulletin introuvable');
  }

  const a4Container = element.querySelector('[data-bulletin-a4]') as HTMLElement || element;

  // Temporarily reset transform for pixel-perfect capture
  const originalTransform = a4Container.style.transform;
  const originalTransformOrigin = a4Container.style.transformOrigin;
  a4Container.style.transform = 'none';
  a4Container.style.transformOrigin = 'top left';

  const canvas = await html2canvas(a4Container, {
    scale: 5, // High DPI: 794 × 5 = 3970px → ~480 DPI on A4
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    imageTimeout: 20000,
    windowWidth: 794,
    onclone: (clonedDoc) => {
      const clonedElement = clonedDoc.querySelector('[data-bulletin-a4]') as HTMLElement;
      if (clonedElement) {
        clonedElement.style.transform = 'none';
        clonedElement.style.width = '794px';
        clonedElement.style.maxWidth = '794px';
        clonedElement.style.overflow = 'hidden';

        // Ensure crisp text rendering in the clone
        clonedElement.style.webkitFontSmoothing = 'antialiased';
        (clonedElement.style as any).textRendering = 'optimizeLegibility';

        // Force all tables to fixed layout for consistent column widths
        clonedElement.querySelectorAll('table').forEach((t: HTMLElement) => {
          t.style.tableLayout = 'fixed';
          t.style.width = '100%';
        });
        // Prevent any cell from overflowing
        clonedElement.querySelectorAll('td, th').forEach((c: HTMLElement) => {
          c.style.overflow = 'hidden';
          c.style.textOverflow = 'ellipsis';
        });
        // Ensure SVGs render crisply (QR code, icons)
        clonedElement.querySelectorAll('svg').forEach((svg: SVGElement) => {
          svg.setAttribute('shape-rendering', 'crispEdges');
        });
      }
    },
  });

  // Restore original styles
  a4Container.style.transform = originalTransform;
  a4Container.style.transformOrigin = originalTransformOrigin;

  // Use PNG for lossless quality — no compression artifacts on text/lines
  const imgData = canvas.toDataURL('image/png');

  // A4 dimensions in mm
  const pdfWidth = 210;
  const pdfHeight = 297;

  const pdf = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
    compress: true,
    putOnlyUsedFonts: true,
  });

  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * pdfWidth) / canvas.width;

  if (imgHeight <= pdfHeight) {
    // Fits on one page — center vertically if there's space
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
  } else {
    // Scale down to fit single A4 page
    const scale = pdfHeight / imgHeight;
    const scaledWidth = imgWidth * scale;
    const scaledHeight = pdfHeight;
    const offsetX = (pdfWidth - scaledWidth) / 2;
    pdf.addImage(imgData, 'PNG', offsetX, 0, scaledWidth, scaledHeight, undefined, 'FAST');
  }

  pdf.save(filename);
}
