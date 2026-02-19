import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileText, GraduationCap } from 'lucide-react';

interface DevisProps {
  eleves: Array<{
    id: string;
    nom: string;
    prenom: string;
    classes?: any;
    zones_transport?: any;
    zone_transport_id?: string;
    option_cantine?: boolean;
    solde_cantine?: number;
    uniforme_scolaire?: boolean;
    uniforme_sport?: boolean;
    uniforme_polo_lacoste?: boolean;
    uniforme_karate?: boolean;
    option_fournitures?: boolean;
  }>;
  paiements: any[];
  tarifs?: any[];
  nbEnfantsFamille: number;
}

export default function ParentDevisInscription({ eleves, paiements, tarifs = [], nbEnfantsFamille }: DevisProps) {
  const reduction = nbEnfantsFamille >= 3 ? 0.10 : 0;

  return (
    <div className="space-y-4">
      {eleves.map((enfant) => {
        const niveaux = enfant.classes?.niveaux;
        const fraisScolarite = niveaux?.frais_scolarite || 0;
        const fraisInscription = niveaux?.frais_inscription ?? 100000;
        const fraisDossier = niveaux?.frais_dossier ?? 0;
        const fraisAssurance = niveaux?.frais_assurance ?? 0;
        const fraisApresReduction = fraisScolarite * (1 - reduction);
        const transportMensuel = enfant.zones_transport?.prix_mensuel || 0;

        // Get uniform fees from tarifs
        const getUniformFee = (cat: string) => tarifs.find((t: any) => t.categorie === cat)?.montant || 0;
        const cycleName = niveaux?.cycles?.nom || '';
        const isPrimaire = ['Crèche', 'Maternelle', 'Primaire'].includes(cycleName);
        const tenueScolaireEntries = tarifs.filter((t: any) => t.categorie === 'uniforme_scolaire');
        const prixTenueScolaire = tenueScolaireEntries.length > 1
          ? (tenueScolaireEntries.find((t: any) =>
              isPrimaire ? t.label?.toLowerCase().includes('primaire') : (t.label?.toLowerCase().includes('collège') || t.label?.toLowerCase().includes('lycée'))
            )?.montant || tenueScolaireEntries[0]?.montant || 0)
          : (tenueScolaireEntries[0]?.montant || 0);

        const fraisUniformes =
          (enfant.uniforme_scolaire ? prixTenueScolaire : 0) +
          (enfant.uniforme_sport ? getUniformFee('uniforme_sport') : 0) +
          (enfant.uniforme_polo_lacoste ? getUniformFee('uniforme_polo_lacoste') : 0) +
          (enfant.uniforme_karate ? getUniformFee('uniforme_karate') : 0);

        const fraisFournitures = enfant.option_fournitures ? (tarifs.find((t: any) => t.categorie === 'fournitures')?.montant || 0) : 0;

        // Calculate what was paid at inscription
        const paiementsEnfant = paiements.filter((p: any) => p.eleve_id === enfant.id);
        const payeInscription = paiementsEnfant
          .filter((p: any) => p.type_paiement === 'inscription' || p.type_paiement === 'reinscription')
          .reduce((s: number, p: any) => s + p.montant, 0);
        const payeScolarite = paiementsEnfant
          .filter((p: any) => p.type_paiement === 'scolarite')
          .reduce((s: number, p: any) => s + p.montant, 0);
        const payeTransport = paiementsEnfant
          .filter((p: any) => p.type_paiement === 'transport')
          .reduce((s: number, p: any) => s + p.montant, 0);

        const totalImmediatInitial = fraisInscription + fraisDossier + fraisAssurance + fraisUniformes + fraisFournitures;
        const scolariteAnnuelle = fraisApresReduction; // frais_scolarite is already annual
        const transportAnnuel = transportMensuel * 10;
        const totalGlobal = totalImmediatInitial + scolariteAnnuelle + transportAnnuel;
        const totalPaye = payeInscription + payeScolarite + payeTransport;
        const resteAPayer = totalGlobal - totalPaye;

        const lignesDevis: Array<{ label: string; montant: number; type: 'immediat' | 'echeancier' }> = [];

        // Immediate fees
        lignesDevis.push({ label: "Frais d'inscription", montant: fraisInscription, type: 'immediat' });
        if (fraisDossier > 0) lignesDevis.push({ label: 'Frais de dossier', montant: fraisDossier, type: 'immediat' });
        if (fraisAssurance > 0) lignesDevis.push({ label: '🛡️ Assurance scolaire', montant: fraisAssurance, type: 'immediat' });
        if (fraisUniformes > 0) lignesDevis.push({ label: '👕 Uniformes', montant: fraisUniformes, type: 'immediat' });
        if (fraisFournitures > 0) lignesDevis.push({ label: '📦 Fournitures', montant: fraisFournitures, type: 'immediat' });

        // Tuition schedule
        lignesDevis.push({ label: `🎓 Scolarité annuelle`, montant: scolariteAnnuelle, type: 'echeancier' });
        if (transportAnnuel > 0) {
          lignesDevis.push({ label: `🚌 Transport annuel (${transportMensuel.toLocaleString()} × 10 mois)`, montant: transportAnnuel, type: 'echeancier' });
        }

        return (
          <Card key={enfant.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Devis — {enfant.prenom} {enfant.nom}
                {niveaux?.nom && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    <GraduationCap className="h-3 w-3 mr-1" />
                    {niveaux.nom}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Immediate fees table */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Frais d'inscription (payables immédiatement)</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Désignation</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lignesDevis.filter(l => l.type === 'immediat').map((ligne, i) => (
                      <TableRow key={i}>
                        <TableCell>{ligne.label}</TableCell>
                        <TableCell className="text-right font-medium">{ligne.montant.toLocaleString()} GNF</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>Sous-total inscription</TableCell>
                      <TableCell className="text-right">{totalImmediatInitial.toLocaleString()} GNF</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <Separator />

              {/* Tuition schedule */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Échéancier scolarité (paiements mensuels)</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Désignation</TableHead>
                      <TableHead className="text-right">Montant annuel</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lignesDevis.filter(l => l.type === 'echeancier').map((ligne, i) => (
                      <TableRow key={i}>
                        <TableCell>{ligne.label}</TableCell>
                        <TableCell className="text-right font-medium">{ligne.montant.toLocaleString()} GNF</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {reduction > 0 && (
                  <p className="text-xs text-accent mt-1">✨ Réduction fratrie de {reduction * 100}% appliquée ({nbEnfantsFamille} enfants)</p>
                )}
              </div>

              <Separator />

              {/* Grand total + balance */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total global annuel</span>
                  <span className="font-bold">{totalGlobal.toLocaleString()} GNF</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>✓ Déjà payé</span>
                  <span className="font-bold">{totalPaye.toLocaleString()} GNF</span>
                </div>
                <div className="flex justify-between text-base font-bold text-primary border-t pt-2">
                  <span>Reste à payer</span>
                  <span>{resteAPayer.toLocaleString()} GNF</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
