import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download, X, FileDown } from 'lucide-react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface EleveData {
  id: string;
  nom: string;
  prenom: string;
  matricule: string | null;
  sexe: string | null;
  date_naissance: string | null;
  photo_url?: string | null;
  classes?: {
    nom: string;
    niveaux?: {
      nom: string;
      cycles?: { nom: string };
    };
  };
}

interface Props {
  eleves: EleveData[];
  onClose: () => void;
  schoolName?: string;
  schoolLogo?: string | null;
  anneeScolaire?: string;
}

const CARDS_PER_PAGE = 10; // 2 cols x 5 rows

export default function PlancheBadgesScolaires({ eleves, onClose, schoolName, schoolLogo, anneeScolaire = '2025-2026' }: Props) {
  const rectoRef = useRef<HTMLDivElement>(null);
  const versoRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [qrCache, setQrCache] = useState<Record<string, { id: string; site: string }>>({});
  const [ready, setReady] = useState(false);

  const sName = schoolName || 'Groupe Scolaire Les Enfants du Futur';
  const logoUrl = schoolLogo || '';

  // Generate all QR codes on mount
  React.useEffect(() => {
    const gen = async () => {
      const cache: Record<string, { id: string; site: string }> = {};
      for (const e of eleves) {
        const qrValue = JSON.stringify({
          matricule: e.matricule || '',
          nom: e.nom, prenom: e.prenom,
          classe: e.classes?.nom || '',
          sexe: e.sexe || '',
        });
        const [idQr, siteQr] = await Promise.all([
          QRCode.toDataURL(qrValue, { width: 200, margin: 1, color: { dark: '#1a1a2e', light: '#ffffff' } }),
          QRCode.toDataURL('https://enfantsdufutur-com.lovable.app/eleve', { width: 150, margin: 1, color: { dark: '#1e8449', light: '#ffffff' } }),
        ]);
        cache[e.id] = { id: idQr, site: siteQr };
      }
      setQrCache(cache);
      setReady(true);
    };
    gen();
  }, [eleves]);

  const pages: EleveData[][] = [];
  for (let i = 0; i < eleves.length; i += CARDS_PER_PAGE) {
    pages.push(eleves.slice(i, i + CARDS_PER_PAGE));
  }

  const handleDownloadPDF = async () => {
    if (!rectoRef.current || !versoRef.current) return;
    setGenerating(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfW = 210;
      const pdfH = 297;

      // Capture all recto pages
      const rectoPages = rectoRef.current.querySelectorAll('.planche-page');
      const versoPages = versoRef.current.querySelectorAll('.planche-page');

      for (let i = 0; i < rectoPages.length; i++) {
        if (i > 0) pdf.addPage();
        
        // Recto
        const rectoCanvas = await html2canvas(rectoPages[i] as HTMLElement, {
          scale: 2, useCORS: true, backgroundColor: '#ffffff',
        });
        const rectoImg = rectoCanvas.toDataURL('image/png');
        const rectoH = (rectoCanvas.height * pdfW) / rectoCanvas.width;
        pdf.addImage(rectoImg, 'PNG', 0, 0, pdfW, Math.min(rectoH, pdfH));

        // Verso
        if (versoPages[i]) {
          pdf.addPage();
          const versoCanvas = await html2canvas(versoPages[i] as HTMLElement, {
            scale: 2, useCORS: true, backgroundColor: '#ffffff',
          });
          const versoImg = versoCanvas.toDataURL('image/png');
          const versoH = (versoCanvas.height * pdfW) / versoCanvas.width;
          pdf.addImage(versoImg, 'PNG', 0, 0, pdfW, Math.min(versoH, pdfH));
        }
      }

      pdf.save(`badges-scolaires-${eleves.length}-eleves.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    const content = document.getElementById('planche-badges-print');
    if (!content) return;
    const w = window.open('', '_blank', 'width=900,height=1200');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Planches Badges Scolaires</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:'Segoe UI',system-ui,sans-serif; }
  ${PLANCHE_STYLES}
</style></head><body>${content.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 800);
  };

  const renderCard = (e: EleveData, type: 'recto' | 'verso') => {
    const qr = qrCache[e.id];
    if (!qr) return null;
    const cycleName = e.classes?.niveaux?.cycles?.nom || '';
    const className = e.classes?.nom || '';
    const dateNaissance = e.date_naissance ? new Date(e.date_naissance).toLocaleDateString('fr-FR') : '—';

    if (type === 'verso') {
      return (
        <div key={e.id} className="badge-cell">
          <div className="badge-card badge-verso">
            <div className="verso-hdr">🎓 Carte Scolaire — Verso</div>
            <div className="verso-body">
              <div className="verso-qr-frame">
                <img src={qr.id} alt="QR" style={{ width: 80, height: 80 }} />
              </div>
              <span className="verso-qr-hint">Scanner pour identification</span>
              <p className="verso-mention">Cette carte est personnelle et obligatoire.</p>
            </div>
            <div className="verso-ftr">{sName} — {anneeScolaire}</div>
          </div>
        </div>
      );
    }

    return (
      <div key={e.id} className="badge-cell">
        <div className="badge-card badge-recto">
          <div className="top-banner">
            <div className="banner-pattern"></div>
            <div className="logo-circle">
              {logoUrl ? <img src={logoUrl} alt="Logo" /> : <span style={{ fontSize: 16 }}>🎓</span>}
            </div>
            <div className="school-info">
              <div className="school-name">{sName}</div>
              <div className="school-year">Année scolaire {anneeScolaire}</div>
            </div>
            <div className="card-type">Carte Scolaire</div>
          </div>
          <div className="card-body">
            <div className="photo-frame">
              {e.photo_url
                ? <img src={e.photo_url} alt={e.prenom} loading="lazy" decoding="async" />
                : <div className="photo-placeholder">👤</div>}
            </div>
            <div className="info-col">
              <div className="student-name">{e.nom.toUpperCase()} {e.prenom}</div>
              <div className="info-rows">
                <div className="info-row"><span className="lbl">Cycle</span><span className="val">{cycleName}</span></div>
                <div className="info-row"><span className="lbl">Classe</span><span className="val">{className}</span></div>
                <div className="info-row"><span className="lbl">Né(e) le</span><span className="val">{dateNaissance}</span></div>
              </div>
              <div className="matricule-box">
                <span className="m-label">N°</span>
                <span className="m-value">{e.matricule || '—'}</span>
              </div>
            </div>
            <div className="site-qr-zone">
              <img src={qr.site} className="site-qr-img" alt="QR" />
              <span className="site-qr-label">Espace Élève</span>
            </div>
          </div>
          <div className="motto-contact">
            <div className="motto-line">Faisons plus !</div>
            <div className="contact-line">📞 (+224) 628 84 84 37 / 625 54 95 79</div>
            <div className="contact-line">✉ eiefinfos@enfantsdufutur.com</div>
          </div>
          <div className="card-footer-bar">
            <span>Carte obligatoire — Accès aux services scolaires — www.enfantsdufutur.com</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 overflow-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b p-3 flex items-center justify-between no-print">
        <h2 className="font-semibold text-lg">
          Planche Badges Scolaires — {eleves.length} élève{eleves.length > 1 ? 's' : ''} ({pages.length} page{pages.length > 1 ? 's' : ''} recto + verso)
        </h2>
        <div className="flex gap-2">
          <Button onClick={handleDownloadPDF} disabled={!ready || generating} className="gap-2">
            <FileDown className="h-4 w-4" /> {generating ? 'Génération...' : 'Télécharger PDF'}
          </Button>
          <Button onClick={handlePrint} variant="outline" disabled={!ready} className="gap-2">
            <Printer className="h-4 w-4" /> Imprimer
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {!ready ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Génération des QR codes...
        </div>
      ) : (
        <div id="planche-badges-print">
          <style dangerouslySetInnerHTML={{ __html: PLANCHE_STYLES }} />

          {/* RECTO PAGES */}
          <div ref={rectoRef}>
            {pages.map((page, pi) => (
              <div key={`r-${pi}`} className="planche-page" style={pi > 0 ? { pageBreakBefore: 'always' } : undefined}>
                <div className="page-label no-print">▸ Recto — Page {pi + 1}</div>
                <div className="planche-grid">
                  {page.map(e => renderCard(e, 'recto'))}
                </div>
              </div>
            ))}
          </div>

          {/* VERSO PAGES */}
          <div ref={versoRef}>
            {pages.map((page, pi) => (
              <div key={`v-${pi}`} className="planche-page" style={{ pageBreakBefore: 'always' }}>
                <div className="page-label no-print">▸ Verso — Page {pi + 1}</div>
                <div className="planche-grid">
                  {page.map(e => renderCard(e, 'verso'))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const PLANCHE_STYLES = `
  .planche-page {
    width: 210mm;
    min-height: 297mm;
    padding: 8mm 10mm;
    margin: 0 auto;
    background: white;
    box-sizing: border-box;
  }
  .page-label {
    font-size: 10px; font-weight: 700; color: #999; text-transform: uppercase;
    letter-spacing: 1px; margin-bottom: 4mm; padding: 2px 8px;
    border-left: 3px solid #1e8449;
  }
  .planche-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3mm;
  }
  .badge-cell {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .badge-card {
    width: 85.6mm;
    height: 54mm;
    border-radius: 3mm;
    overflow: hidden;
    position: relative;
    font-family: 'Segoe UI', system-ui, sans-serif;
  }

  /* RECTO */
  .badge-recto {
    background: #ffffff;
    border: 0.3mm solid #ddd;
  }
  .top-banner {
    height: 15mm;
    background: linear-gradient(135deg, #c0392b 0%, #a93226 35%, #1e8449 65%, #196f3d 100%);
    display: flex; align-items: center; padding: 0 3mm;
    position: relative;
  }
  .top-banner::after {
    content: ''; position: absolute; bottom: -2mm; left: 0; right: 0; height: 4mm;
    background: linear-gradient(135deg, #c0392b 0%, #a93226 35%, #1e8449 65%, #196f3d 100%);
    clip-path: ellipse(55% 100% at 50% 0%);
  }
  .banner-pattern {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0; opacity: 0.06;
    background-image: repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.4) 4px, rgba(255,255,255,0.4) 8px);
  }
  .logo-circle {
    width: 10mm; height: 10mm; border-radius: 50%; background: #fff;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; overflow: hidden; border: 0.5mm solid rgba(255,255,255,0.9);
    box-shadow: 0 1px 4px rgba(0,0,0,0.2); z-index: 2;
  }
  .logo-circle img { width: 80%; height: 80%; object-fit: contain; }
  .school-info { flex: 1; margin-left: 2mm; z-index: 1; }
  .school-name { color: white; font-size: 6.5pt; font-weight: 800; letter-spacing: 0.3px; text-transform: uppercase; line-height: 1.3; }
  .school-year { color: rgba(255,255,255,0.85); font-size: 5.5pt; font-weight: 500; margin-top: 0.5mm; }
  .card-type {
    z-index: 1; background: rgba(255,255,255,0.25); color: white;
    padding: 1mm 2.5mm; border-radius: 2mm; font-size: 5pt;
    font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
    border: 0.3mm solid rgba(255,255,255,0.4); white-space: nowrap;
  }

  .card-body {
    display: flex; padding: 2mm 2.5mm 0; position: relative; z-index: 2; margin-top: -0.5mm;
    align-items: stretch;
  }
  .photo-frame {
    width: 17.8mm; height: 20.15mm; border-radius: 1.5mm; overflow: hidden; flex-shrink: 0;
    border: 0.3mm solid #1e8449; background: #f5f5f5;
  }
  .photo-frame img { width: 100%; height: 100%; object-fit: cover; }
  .photo-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #c5cee0; }
  .info-col { flex: 1; padding-left: 2.5mm; display: flex; flex-direction: column; }
  .student-name { font-size: 8pt; font-weight: 800; color: #1a1a2e; line-height: 1.2; text-transform: uppercase; }
  .info-rows { margin-top: 1.5mm; display: flex; flex-direction: column; gap: 0.8mm; }
  .info-row { display: flex; align-items: baseline; gap: 1mm; }
  .info-row .lbl { font-size: 5pt; font-weight: 700; color: #999; text-transform: uppercase; min-width: 10mm; }
  .info-row .val { font-size: 6.5pt; font-weight: 600; color: #2d3436; }
  .matricule-box {
    margin-top: 1.5mm; background: linear-gradient(135deg, #c0392b, #1e8449);
    color: white; padding: 0.8mm 2.5mm; border-radius: 1.2mm; display: inline-flex;
    align-items: center; gap: 1mm; width: fit-content;
  }
  .matricule-box .m-label { font-size: 5pt; font-weight: 600; opacity: 0.8; }
  .matricule-box .m-value { font-size: 7.5pt; font-weight: 800; font-family: 'Courier New', monospace; letter-spacing: 0.5px; }

  .site-qr-zone {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    flex-shrink: 0; margin-left: 1.5mm; padding: 0.8mm;
    background: rgba(30,132,73,0.04); border-radius: 1.5mm;
  }
  .site-qr-img {
    width: 15mm; height: 15mm; border-radius: 1mm; border: 0.4mm solid #1e8449;
    padding: 0.5mm; background: white;
  }
  .site-qr-label {
    font-size: 4.5pt; font-weight: 800; color: #1e8449; text-transform: uppercase;
    letter-spacing: 0.3px; margin-top: 0.5mm; text-align: center;
  }

  .motto-contact {
    padding: 0.5mm 3mm 0; text-align: center; position: relative; z-index: 2;
  }
  .motto-line { font-size: 7pt; font-weight: 800; color: #1e8449; font-style: italic; }
  .contact-line { font-size: 4.5pt; font-weight: 600; color: #555; margin-top: 0.3mm; }

  .card-footer-bar {
    position: absolute; bottom: 0; left: 0; right: 0; height: 4mm;
    background: linear-gradient(90deg, #c0392b, #a93226, #1e8449, #196f3d);
    display: flex; align-items: center; justify-content: center;
  }
  .card-footer-bar span { font-size: 4pt; color: rgba(255,255,255,0.85); font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase; }

  /* VERSO */
  .badge-verso {
    background: #f8faf8;
    border: 0.3mm solid #ddd;
    display: flex; flex-direction: column;
  }
  .verso-hdr {
    background: linear-gradient(90deg, #c0392b, #1e8449);
    color: white; padding: 1.5mm 0; text-align: center;
    font-size: 5.5pt; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;
  }
  .verso-body {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 1.5mm; padding: 2mm;
  }
  .verso-qr-frame {
    background: white; padding: 1.5mm; border-radius: 2mm;
    border: 0.4mm solid #1e8449;
  }
  .verso-qr-hint { font-size: 5pt; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .verso-mention { font-size: 4.5pt; text-align: center; color: #888; font-style: italic; max-width: 70mm; line-height: 1.5; }
  .verso-ftr {
    background: linear-gradient(90deg, #c0392b, #a93226, #1e8449, #196f3d);
    color: rgba(255,255,255,0.8); padding: 1mm 0; text-align: center;
    font-size: 4pt; font-weight: 600; letter-spacing: 0.5px;
  }

  @page { size: A4; margin: 8mm; }
  @media print {
    body { margin: 0; padding: 0; }
    .no-print { display: none !important; }
    .planche-page { padding: 0; box-shadow: none; }
  }
`;
