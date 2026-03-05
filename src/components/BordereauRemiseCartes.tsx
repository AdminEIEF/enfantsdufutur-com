import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';

interface EleveData {
  id: string;
  nom: string;
  prenom: string;
  matricule: string | null;
  classe: string;
  option_cantine?: boolean | null;
  transport_zone?: string | null;
}

interface Props {
  eleves: EleveData[];
  onClose: () => void;
  schoolName?: string;
  anneeScolaire?: string;
}

const BORDEREAU_STYLES = `
  .bordereau-page {
    width: 210mm;
    min-height: 297mm;
    padding: 10mm 12mm;
    margin: 0 auto;
    background: white;
    box-sizing: border-box;
    font-family: 'Segoe UI', 'Arial', system-ui, sans-serif;
    color: #111;
    font-size: 10pt;
  }

  .bordereau-header {
    text-align: center;
    margin-bottom: 6mm;
    border-bottom: 0.8mm solid #111;
    padding-bottom: 4mm;
  }
  .bordereau-header .school {
    font-size: 13pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5mm;
    margin-bottom: 1.5mm;
  }
  .bordereau-header .annee {
    font-size: 10pt;
    color: #444;
    margin-bottom: 3mm;
  }
  .bordereau-header .titre {
    font-size: 12pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3mm;
    background: #f3f4f6;
    display: inline-block;
    padding: 2mm 6mm;
    border: 0.3mm solid #d1d5db;
    border-radius: 1mm;
  }

  .bordereau-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 4mm;
    font-size: 9pt;
  }
  .bordereau-table th {
    background: #f9fafb;
    border: 0.3mm solid #333;
    padding: 2mm 2.5mm;
    text-align: left;
    font-weight: 700;
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.15mm;
    white-space: nowrap;
  }
  .bordereau-table td {
    border: 0.3mm solid #333;
    padding: 2.2mm 2.5mm;
    vertical-align: middle;
  }
  .bordereau-table tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .bordereau-table .col-no { width: 8mm; text-align: center; }
  .bordereau-table .col-mat { width: 28mm; font-family: 'Consolas', 'Courier New', monospace; font-size: 8.5pt; }
  .bordereau-table .col-nom { }
  .bordereau-table .col-classe { width: 22mm; text-align: center; }
  .bordereau-table .col-type { width: 28mm; text-align: center; font-size: 8pt; }
  .bordereau-table .col-date { width: 24mm; }
  .bordereau-table .col-sign { width: 34mm; }

  .bordereau-footer {
    margin-top: 8mm;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    font-size: 10pt;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .bordereau-footer .total {
    font-weight: 700;
    font-size: 10.5pt;
  }
  .bordereau-footer .cachet {
    text-align: center;
    border-top: 0.3mm solid #333;
    padding-top: 3mm;
    min-width: 55mm;
    font-weight: 600;
  }

  @page {
    size: A4 portrait;
    margin: 10mm;
  }
  @media print {
    body { margin: 0; padding: 0; }
    .no-print { display: none !important; }
    .bordereau-page { padding: 0; box-shadow: none; }
  }
`;

export default function BordereauRemiseCartes({
  eleves,
  onClose,
  schoolName = 'École Internationale Les Enfants du Futur',
  anneeScolaire = '2025-2026',
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  // Sort by classe then nom
  const sorted = [...eleves].sort((a, b) => {
    const cmp = a.classe.localeCompare(b.classe, 'fr');
    if (cmp !== 0) return cmp;
    return a.nom.localeCompare(b.nom, 'fr');
  });

  const getTypeCarte = (e: EleveData) => {
    const hasCantine = e.option_cantine;
    const hasTransport = !!e.transport_zone;
    if (hasCantine && hasTransport) return 'Cantine + Transport';
    if (hasCantine) return 'Cantine';
    if (hasTransport) return 'Transport';
    return 'Cantine';
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const w = window.open('', '_blank', 'width=900,height=1200');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Bordereau Remise Cartes</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family:'Segoe UI','Arial',system-ui,sans-serif; }
  ${BORDEREAU_STYLES}
</style></head><body>${content.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 overflow-auto">
      <div className="no-print sticky top-0 z-10 bg-background/95 backdrop-blur border-b p-3 flex items-center justify-between">
        <h2 className="font-semibold text-lg">
          Bordereau d'émargement — {sorted.length} élève{sorted.length > 1 ? 's' : ''}
        </h2>
        <div className="flex gap-2">
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" /> Imprimer
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div ref={printRef} className="pb-10">
        <style>{BORDEREAU_STYLES}</style>
        <div className="bordereau-page">
          <div className="bordereau-header">
            <div className="school">{schoolName}</div>
            <div className="annee">Année Scolaire {anneeScolaire}</div>
            <div className="titre">Bordereau d'émargement — Remise des Cartes (Cantine / Transport)</div>
          </div>

          <table className="bordereau-table">
            <thead>
              <tr>
                <th className="col-no">N°</th>
                <th className="col-mat">Matricule</th>
                <th className="col-nom">Nom et Prénom</th>
                <th className="col-classe">Classe</th>
                <th className="col-type">Type de Carte</th>
                <th className="col-date">Date de remise</th>
                <th className="col-sign">Signature</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e, i) => (
                <tr key={e.id}>
                  <td className="col-no">{i + 1}</td>
                  <td className="col-mat">{e.matricule || '—'}</td>
                  <td className="col-nom">{e.nom} {e.prenom}</td>
                  <td className="col-classe">{e.classe}</td>
                  <td className="col-type">{getTypeCarte(e)}</td>
                  <td className="col-date"></td>
                  <td className="col-sign"></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="bordereau-footer">
            <div className="total">
              Nombre total de cartes remises : _____ / {sorted.length}
            </div>
            <div className="cachet">
              Cachet de l'administration
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
