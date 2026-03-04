import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Printer, Phone, UtensilsCrossed } from 'lucide-react';

export interface CarteCantineProps {
  nom: string;
  prenom: string;
  matricule: string;
  classe: string;
  photo_url?: string | null;
  allergies?: string[];
  regime?: string | null;
  telephone_pere?: string | null;
  telephone_mere?: string | null;
  qrValue: string;
  schoolName?: string;
  schoolLogo?: string | null;
}

export default function CarteCantine({
  nom,
  prenom,
  matricule,
  classe,
  photo_url,
  allergies = [],
  regime,
  telephone_pere,
  telephone_mere,
  qrValue,
  schoolName = 'École Internationale Les Enfants du Futur',
  schoolLogo,
}: CarteCantineProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const w = window.open('', '_blank', 'width=600,height=500');
    if (!w) return;

    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Carte Cantine - ${prenom} ${nom}</title>
<style>
  @page { size: 85mm 108mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #f5f5f5; font-family: 'Segoe UI', system-ui, sans-serif; gap: 4mm; }
  @media print {
    body { background: white; min-height: auto; gap: 2mm; }
  }
</style></head><body>${content.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  const hasAlerts = (allergies && allergies.length > 0) || regime;

  return (
    <div className="space-y-4">
      {/* Printable area */}
      <div ref={printRef}>
        <style>{`
          .carte-cantine {
            width: 85mm; height: 54mm; border-radius: 3mm; overflow: hidden;
            font-family: 'Segoe UI', system-ui, sans-serif; position: relative;
            page-break-after: always; page-break-inside: avoid;
          }
          /* === RECTO === */
          .carte-recto {
            background: linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%);
            color: white; display: flex; flex-direction: column;
          }
          .carte-recto .header {
            display: flex; align-items: center; padding: 2.5mm 3mm 1.5mm;
            border-bottom: 0.3mm solid rgba(255,255,255,0.2);
          }
          .carte-recto .header .logo {
            width: 9mm; height: 9mm; border-radius: 50%; background: white;
            display: flex; align-items: center; justify-content: center;
            overflow: hidden; flex-shrink: 0;
          }
          .carte-recto .header .logo img { width: 100%; height: 100%; object-fit: cover; }
          .carte-recto .header .logo .fallback { font-size: 5mm; }
          .carte-recto .header .school-name {
            flex: 1; text-align: center; font-size: 2.2mm; font-weight: 600;
            letter-spacing: 0.2mm; padding: 0 2mm; line-height: 1.3;
          }
          .carte-recto .header .badge-cantine {
            background: rgba(255,255,255,0.2); backdrop-filter: blur(4px);
            padding: 1mm 2.5mm; border-radius: 1.5mm; font-size: 2mm;
            font-weight: 700; letter-spacing: 0.5mm; text-transform: uppercase;
            flex-shrink: 0;
          }
          .carte-recto .body {
            flex: 1; display: flex; padding: 2mm 3mm; gap: 2.5mm; align-items: flex-start;
          }
          .carte-recto .photo-frame {
            width: 16mm; height: 20mm; border-radius: 1.5mm; border: 0.4mm solid rgba(255,255,255,0.5);
            overflow: hidden; flex-shrink: 0; background: rgba(255,255,255,0.15);
            display: flex; align-items: center; justify-content: center;
          }
          .carte-recto .photo-frame img { width: 100%; height: 100%; object-fit: cover; }
          .carte-recto .photo-frame .placeholder { font-size: 8mm; opacity: 0.5; }
          .carte-recto .info { flex: 1; display: flex; flex-direction: column; gap: 1mm; }
          .carte-recto .info .name { font-size: 3.2mm; font-weight: 700; letter-spacing: 0.1mm; line-height: 1.2; }
          .carte-recto .info .detail { font-size: 2.2mm; opacity: 0.85; }
          .carte-recto .info .detail span { font-weight: 600; opacity: 1; }
          .carte-recto .qr-zone {
            width: 16mm; height: 16mm; background: white; border-radius: 1.5mm;
            padding: 1mm; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
          }
          .carte-recto .alert-bar {
            background: rgba(255,255,255,0.95); color: #dc2626;
            padding: 1mm 3mm; font-size: 2mm; font-weight: 700;
            text-align: center; letter-spacing: 0.2mm; text-transform: uppercase;
            display: flex; align-items: center; justify-content: center; gap: 1.5mm;
          }
          .carte-recto .alert-bar .dot { width: 1.5mm; height: 1.5mm; border-radius: 50%; background: #dc2626; flex-shrink: 0; }

          /* === VERSO === */
          .carte-verso {
            background: #f0fdf4;
            background-image: radial-gradient(circle at 20% 80%, rgba(5,150,105,0.06) 0%, transparent 50%),
                              radial-gradient(circle at 80% 20%, rgba(5,150,105,0.06) 0%, transparent 50%);
            color: #1e293b; display: flex; flex-direction: column;
          }
          .carte-verso .verso-header {
            background: linear-gradient(90deg, #059669, #047857);
            color: white; padding: 2mm 3mm; text-align: center;
            font-size: 2.5mm; font-weight: 700; letter-spacing: 0.3mm;
          }
          .carte-verso .verso-body { flex: 1; padding: 3mm; display: flex; flex-direction: column; justify-content: space-between; }
          .carte-verso .contact-section h4 {
            font-size: 2.2mm; font-weight: 700; text-transform: uppercase;
            color: #059669; letter-spacing: 0.3mm; margin-bottom: 1.5mm;
          }
          .carte-verso .contact-row {
            display: flex; align-items: center; gap: 1.5mm; margin-bottom: 1mm;
            font-size: 2.2mm;
          }
          .carte-verso .contact-row .icon { width: 3mm; height: 3mm; color: #059669; }
          .carte-verso .contact-row .label { font-weight: 600; min-width: 10mm; }
          .carte-verso .mention {
            font-size: 1.8mm; text-align: center; color: #64748b;
            font-style: italic; border-top: 0.2mm solid #d1d5db; padding-top: 2mm; margin-top: 2mm;
          }
          .carte-verso .slogan {
            text-align: center; font-size: 2.4mm; font-weight: 700;
            color: #059669; font-style: italic; margin-top: 1.5mm;
          }
        `}</style>

        {/* RECTO */}
        <div className="carte-cantine carte-recto">
          <div className="header">
            <div className="logo">
              {schoolLogo ? <img src={schoolLogo} alt="Logo" /> : <span className="fallback">🎓</span>}
            </div>
            <div className="school-name">{schoolName}</div>
            <div className="badge-cantine">🍽 Cantine</div>
          </div>
          <div className="body">
            <div className="photo-frame">
              {photo_url ? <img src={photo_url} alt={`${prenom} ${nom}`} /> : <span className="placeholder">👤</span>}
            </div>
            <div className="info">
              <div className="name">{prenom} {nom}</div>
              <div className="detail"><span>Matricule :</span> {matricule || '—'}</div>
              <div className="detail"><span>Classe :</span> {classe}</div>
            </div>
            <div className="qr-zone">
              <QRCodeSVG value={qrValue} size={52} level="M" />
            </div>
          </div>
          {hasAlerts && (
            <div className="alert-bar">
              <span className="dot" />
              {regime && <span>{regime}</span>}
              {allergies.map((a, i) => (
                <span key={i}>ALLERGIE : {a}</span>
              ))}
              <span className="dot" />
            </div>
          )}
        </div>

        {/* VERSO */}
        <div className="carte-cantine carte-verso" style={{ marginTop: '2mm' }}>
          <div className="verso-header">🍽 CARTE DE CANTINE SCOLAIRE</div>
          <div className="verso-body">
            <div className="contact-section">
              <h4>📞 Contacts d'urgence</h4>
              {telephone_pere && (
                <div className="contact-row">
                  <span className="label">Père :</span>
                  <span>{telephone_pere}</span>
                </div>
              )}
              {telephone_mere && (
                <div className="contact-row">
                  <span className="label">Mère :</span>
                  <span>{telephone_mere}</span>
                </div>
              )}
              {!telephone_pere && !telephone_mere && (
                <div className="contact-row" style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                  Aucun contact renseigné
                </div>
              )}
            </div>
            <div>
              <div className="mention">
                Cette carte est personnelle et doit être présentée à chaque passage.
              </div>
              <div className="slogan">« Bien manger pour mieux apprendre »</div>
            </div>
          </div>
        </div>
      </div>

      {/* Print button */}
      <Button onClick={handlePrint} className="gap-2 no-print">
        <Printer className="h-4 w-4" />
        Imprimer la carte
      </Button>
    </div>
  );
}
