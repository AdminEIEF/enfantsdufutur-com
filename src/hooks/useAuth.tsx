import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export type AppRole = 'superviseur' | 'admin' | 'secretaire' | 'service_info' | 'comptable' | 'boutique' | 'cantine' | 'librairie' | 'coordinateur' | 'robotique';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchingRolesRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  const fetchRoles = useCallback(async (userId: string) => {
    // Prevent concurrent fetches for the same user
    if (fetchingRolesRef.current && lastUserIdRef.current === userId) return;
    fetchingRolesRef.current = true;
    lastUserIdRef.current = userId;
    try {
      const { data, error } = await supabase.rpc('get_my_roles');
      if (!error && data) {
        setRoles(data as AppRole[]);
      }
    } catch {
      setRoles([]);
    } finally {
      fetchingRolesRef.current = false;
    }
  }, []);

  // Track session for monitoring
  const trackSession = useCallback(async (userId: string, email?: string) => {
    try {
      await supabase.from('user_sessions').insert({
        user_id: userId,
        email: email || '',
      });
      // Also log to active_connections for unified monitoring
      await supabase.from('active_connections').insert({
        type: 'admin',
        ref_id: userId,
        display_name: email || 'Admin',
        email: email || '',
      });
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    let mounted = true;

    // onAuthStateChange is the SINGLE source of truth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return;

        // Ignore token refresh events entirely - session is already valid
        if (event === 'TOKEN_REFRESHED') {
          return;
        }

        const newUser = newSession?.user ?? null;
        setSession(newSession);
        setUser(newUser);

        if (newUser) {
          // Only fetch roles if user changed
          if (lastUserIdRef.current !== newUser.id) {
            setTimeout(() => {
              if (mounted) {
                fetchRoles(newUser.id);
                if (event === 'SIGNED_IN') {
                  trackSession(newUser.id, newUser.email);
                }
              }
            }, 0);
          }
        } else {
          setRoles([]);
          lastUserIdRef.current = null;
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchRoles, trackSession]);

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);
  const hasAnyRole = useCallback((r: AppRole[]) => r.some(role => roles.includes(role)), [roles]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRoles([]);
    lastUserIdRef.current = null;
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, roles, loading, hasRole, hasAnyRole, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
