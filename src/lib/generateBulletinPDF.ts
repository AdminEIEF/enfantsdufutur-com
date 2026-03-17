import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Generate a high-quality print-ready PDF (300+ DPI).
 * 
 * - html2canvas scale=4 → 794×4 = 3176px → ~384 DPI on A4 (above 300 DPI threshold)
 * - PNG lossless format: no JPEG compression artifacts on text/thin lines
 * - addImage with 'NONE' compression: preserves full pixel quality in the PDF
 * - jsPDF compress: true for efficient PDF stream compression (lossless deflate)
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

  // Save original styles
  const originalTransform = a4Container.style.transform;
  const originalTransformOrigin = a4Container.style.transformOrigin;
  
  // Reset transform for pixel-perfect capture
  a4Container.style.transform = 'none';
  a4Container.style.transformOrigin = 'top left';

  const canvas = await html2canvas(a4Container, {
    scale: 4, // ~384 DPI on A4 — crisp for print
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    imageTimeout: 20000,
    windowWidth: 794,
    onclone: (clonedDoc) => {
      const el = clonedDoc.querySelector('[data-bulletin-a4]') as HTMLElement;
      if (!el) return;
      
      el.style.transform = 'none';
      el.style.width = '794px';
      el.style.maxWidth = '794px';
      el.style.overflow = 'hidden';
      (el.style as any).textRendering = 'optimizeLegibility';
      (el.style as any).webkitFontSmoothing = 'antialiased';

      // Fixed table layout for consistent columns
      el.querySelectorAll('table').forEach((t: HTMLElement) => {
        t.style.tableLayout = 'fixed';
        t.style.width = '100%';
      });
      // Prevent cell overflow
      el.querySelectorAll('td, th').forEach((c: HTMLElement) => {
        c.style.overflow = 'hidden';
        c.style.textOverflow = 'ellipsis';
      });
      // Crisp SVG rendering (QR code, icons)
      el.querySelectorAll('svg').forEach((svg: SVGElement) => {
        svg.setAttribute('shape-rendering', 'crispEdges');
      });
    },
  });

  // Restore original styles
  a4Container.style.transform = originalTransform;
  a4Container.style.transformOrigin = originalTransformOrigin;

  // PNG = lossless — no artifacts on text, lines, or table borders
  const imgData = canvas.toDataURL('image/png');

  const pdfWidth = 210;  // A4 width mm
  const pdfHeight = 297; // A4 height mm

  const pdf = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * pdfWidth) / canvas.width;

  if (imgHeight <= pdfHeight) {
    // Fits on one page
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight, undefined, 'NONE');
  } else {
    // Scale to fit single A4 page
    const ratio = pdfHeight / imgHeight;
    const scaledWidth = imgWidth * ratio;
    const offsetX = (pdfWidth - scaledWidth) / 2;
    pdf.addImage(imgData, 'PNG', offsetX, 0, scaledWidth, pdfHeight, undefined, 'NONE');
  }

  pdf.save(filename);
}
