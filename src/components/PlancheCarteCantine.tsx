import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { CARTE_CANTINE_STYLES } from './CarteCantine';
import html2canvas from 'html2canvas';

interface EleveData {
  id: string;
  nom: string;
  prenom: string;
  matricule: string | null;
  classe: string;
  photo_url?: string | null;
  telephone_pere?: string | null;
  telephone_mere?: string | null;
}

interface Props {
  eleves: EleveData[];
  onClose: () => void;
  schoolName?: string;
  schoolLogo?: string | null;
}

const PLANCHE_STYLES = `
  ${CARTE_CANTINE_STYLES}

  .planche-a4 {
    width: 210mm;
    padding: 10mm;
    margin: 0 auto;
    background: white;
    box-sizing: border-box;
  }
  .planche-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5mm;
  }
  .planche-cell {
    position: relative;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  /* Crop marks */
  .planche-cell::before,
  .planche-cell::after {
    content: '';
    position: absolute;
    width: 3mm; height: 3mm;
    border-color: #999;
    border-style: solid;
    border-width: 0;
    z-index: 2;
    pointer-events: none;
  }
  .planche-cell::before { top: -1.5mm; left: -1.5mm; border-top-width: 0.2mm; border-left-width: 0.2mm; }
  .planche-cell::after  { top: -1.5mm; right: -1.5mm; border-top-width: 0.2mm; border-right-width: 0.2mm; }
  .crop-bl, .crop-br {
    position: absolute;
    width: 3mm; height: 3mm;
    border-color: #999;
    border-style: solid;
    border-width: 0;
    z-index: 2;
    pointer-events: none;
  }
  .crop-bl { bottom: -1.5mm; left: -1.5mm; border-bottom-width: 0.2mm; border-left-width: 0.2mm; }
  .crop-br { bottom: -1.5mm; right: -1.5mm; border-bottom-width: 0.2mm; border-right-width: 0.2mm; }

  @page { size: A4; margin: 10mm; }
  @media print {
    body { margin: 0; padding: 0; }
    .no-print { display: none !important; }
    .planche-a4 { padding: 0; box-shadow: none; }
  }
`;

export default function PlancheCarteCantine({ eleves, onClose, schoolName, schoolLogo }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const CARDS_PER_PAGE = 10;
  const pages: EleveData[][] = [];
  for (let i = 0; i < eleves.length; i += CARDS_PER_PAGE) {
    pages.push(eleves.slice(i, i + CARDS_PER_PAGE));
  }

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const w = window.open('', '_blank', 'width=900,height=1200');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Planche Cartes Cantine</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:'Segoe UI',system-ui,sans-serif; }
  ${PLANCHE_STYLES}
</style></head><body>${content.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
  };

  const handleDownload = async () => {
    const el = printRef.current;
    if (!el) return;
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `planche-cartes-cantine-${eleves.length}-eleves.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 overflow-auto">
      <div className="no-print sticky top-0 z-10 bg-background/95 backdrop-blur border-b p-3 flex items-center justify-between">
        <h2 className="font-semibold text-lg">
          Planche d'impression A4 — {eleves.length} carte{eleves.length > 1 ? 's' : ''}
        </h2>
        <div className="flex gap-2">
          <Button onClick={handleDownload} variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Télécharger
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" /> Imprimer
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div ref={printRef} className="pb-10">
        <style>{PLANCHE_STYLES}</style>
        {pages.map((page, pi) => (
          <div key={pi} className="planche-a4" style={pi > 0 ? { pageBreakBefore: 'always' } : undefined}>
            <div className="planche-grid">
              {page.map((e) => {
                const qrValue = JSON.stringify({
                  matricule: e.matricule || '',
                  nom: e.nom, prenom: e.prenom,
                  classe: e.classe, type: 'cantine',
                });
                const parentPhone = e.telephone_pere || e.telephone_mere || null;
                return (
                  <div key={e.id} className="planche-cell">
                    <div className="crop-bl" />
                    <div className="crop-br" />
                    <div className="carte-cantine carte-recto">
                      <div className="header">
                        <div className="logo">
                          {schoolLogo ? <img src={schoolLogo} alt="Logo" /> : <span className="fallback">🎓</span>}
                        </div>
                        <div className="school-name">{schoolName || 'École Internationale Les Enfants du Futur'}</div>
                        <div className="badge-cantine">🍽 Cantine</div>
                      </div>
                      <div className="body">
                        <div className="photo-frame">
                          {e.photo_url ? <img src={e.photo_url} alt={`${e.prenom} ${e.nom}`} /> : <span className="placeholder">👤</span>}
                        </div>
                        <div className="info">
                          <div className="name">{e.prenom} {e.nom}</div>
                          <div className="detail"><span>Matricule :</span> {e.matricule || '—'}</div>
                          <div className="detail"><span>Classe :</span> {e.classe}</div>
                          {parentPhone && (
                            <div className="detail"><span>Tél. parent :</span> {parentPhone}</div>
                          )}
                        </div>
                        <div className="qr-zone" style={{ position: 'relative' }}>
                          <QRCodeSVG value={qrValue} size={68} level="M" />
                          {schoolLogo && (
                            <div className="qr-logo">
                              <img src={schoolLogo} alt="" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
