import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ChevronDown } from 'lucide-react';

interface ImpayeFamille {
  nom: string;
  reste: number;
  niveau: string;
}

interface Props {
  impayesFamilles: ImpayeFamille[];
  impayesParNiveau: [string, ImpayeFamille[]][];
}

function NiveauGroup({ niveau, families }: { niveau: string; families: ImpayeFamille[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 5;
  const totalNiveau = families.reduce((s, f) => s + f.reste, 0);
  const visible = showAll ? families : families.slice(0, LIMIT);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          <span className="font-medium text-sm">{niveau}</span>
          <Badge variant="secondary" className="text-xs">{families.length} famille{families.length > 1 ? 's' : ''}</Badge>
        </div>
        <Badge variant="destructive">{totalNiveau.toLocaleString()} GNF</Badge>
      </button>
      {isOpen && (
        <div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Famille</TableHead>
                <TableHead className="text-right">Reste à payer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((f, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{f.nom}</TableCell>
                  <TableCell className="text-right"><Badge variant="destructive">{f.reste.toLocaleString()} GNF</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {families.length > LIMIT && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full text-xs text-primary hover:underline py-2"
            >
              {showAll ? 'Voir moins' : `Voir les ${families.length - LIMIT} autre(s)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function DashboardImpayesSection({ impayesFamilles, impayesParNiveau }: Props) {
  const [showAllNiveaux, setShowAllNiveaux] = useState(false);
  const INITIAL = 3;
  const visible = showAllNiveaux ? impayesParNiveau : impayesParNiveau.slice(0, INITIAL);

  if (impayesFamilles.length === 0) return null;

  return (
    <Card className="border-destructive/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" /> Impayés par famille ({impayesFamilles.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {visible.map(([niveau, families]) => (
          <NiveauGroup key={niveau} niveau={niveau} families={families} />
        ))}
        {impayesParNiveau.length > INITIAL && (
          <button
            onClick={() => setShowAllNiveaux(!showAllNiveaux)}
            className="w-full text-sm text-primary hover:underline py-2"
          >
            {showAllNiveaux ? 'Voir moins de niveaux' : `Voir les ${impayesParNiveau.length - INITIAL} autre(s) niveau(x)`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
