import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SchoolConfig {
  nom: string;
  soustitre: string;
  ville: string;
  telephone: string;
  logo_url: string | null;
}

const DEFAULT_CONFIG: SchoolConfig = {
  nom: 'Les Ecoles la Mame Plus',
  soustitre: 'Enseignement Général et Technique',
  ville: 'Conakry, Guinée',
  telephone: '',
  logo_url: null,
};

export function useSchoolConfig() {
  return useQuery({
    queryKey: ['school-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parametres')
        .select('cle, valeur')
        .eq('cle', 'school_config')
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_CONFIG;
      const val = data.valeur as Record<string, string>;
      return {
        nom: val.nom || DEFAULT_CONFIG.nom,
        soustitre: val.soustitre || DEFAULT_CONFIG.soustitre,
        ville: val.ville || DEFAULT_CONFIG.ville,
        telephone: val.telephone || DEFAULT_CONFIG.telephone,
        logo_url: val.logo_url || null,
      } as SchoolConfig;
    },
  });
}
