import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SchoolConfig {
  nom: string;
  soustitre: string;
  ville: string;
  logo_url: string | null;
}

const DEFAULT_CONFIG: SchoolConfig = {
  nom: 'Ecole Internationale Les Enfants du Futur',
  soustitre: 'Enseignement Général et Technique',
  ville: 'Conakry, Guinée',
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
        logo_url: val.logo_url || null,
      } as SchoolConfig;
    },
  });
}
