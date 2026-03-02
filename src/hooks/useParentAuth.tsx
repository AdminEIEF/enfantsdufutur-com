import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ParentFamille {
  id: string;
  nom_famille: string;
  telephone_pere: string | null;
  telephone_mere: string | null;
  email_parent: string | null;
  adresse: string | null;
  code_acces: string;
}

interface ParentEleve {
  id: string;
  nom: string;
  prenom: string;
  matricule: string | null;
  sexe: string | null;
  date_naissance: string | null;
  photo_url: string | null;
  statut: string;
  solde_cantine: number | null;
  option_cantine: boolean | null;
  option_fournitures: boolean | null;
  classe_id: string | null;
  classes: any;
  zone_transport_id: string | null;
  zones_transport: any;
}

interface ParentSession {
  famille: ParentFamille;
  eleves: ParentEleve[];
  token: string;
}

interface ParentAuthContextType {
  session: ParentSession | null;
  loading: boolean;
  login: (code: string) => Promise<void>;
  logout: () => void;
}

const ParentAuthContext = createContext<ParentAuthContextType | null>(null);

const STORAGE_KEY = 'parent_session';

export function ParentAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ParentSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSession(JSON.parse(stored));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  // Listen for forced disconnect by admin
  useEffect(() => {
    if (!session?.famille?.id) return;
    const channel = supabase
      .channel(`parent-disconnect-${session.famille.id}`)
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'active_connections',
        filter: `ref_id=eq.${session.famille.id}`,
      }, () => {
        setSession(null);
        localStorage.removeItem(STORAGE_KEY);
        window.location.href = '/parent/login';
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.famille?.id]);

  const login = async (code: string) => {
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parent-auth`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      }
    );

    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Erreur de connexion');

    const newSession: ParentSession = {
      famille: data.famille,
      eleves: data.eleves,
      token: data.token || code.trim().toUpperCase(),
    };
    setSession(newSession);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
  };

  const logout = () => {
    setSession(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <ParentAuthContext.Provider value={{ session, loading, login, logout }}>
      {children}
    </ParentAuthContext.Provider>
  );
}

export function useParentAuth() {
  const ctx = useContext(ParentAuthContext);
  if (!ctx) throw new Error('useParentAuth must be used within ParentAuthProvider');
  return ctx;
}
