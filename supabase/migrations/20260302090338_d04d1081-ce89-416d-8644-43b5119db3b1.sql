
-- Table to track all connection types (students, parents, employees, admins)
CREATE TABLE IF NOT EXISTS public.active_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL, -- 'eleve', 'parent', 'employe', 'admin'
  ref_id text NOT NULL, -- ID of the entity
  display_name text NOT NULL,
  email text,
  classe_nom text,
  niveau_nom text,
  cycle_nom text,
  categorie text, -- for employees: enseignant, service, etc.
  poste text,
  extra_info jsonb DEFAULT '{}',
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.active_connections ENABLE ROW LEVEL SECURITY;

-- Admin can read all connections
CREATE POLICY "Admin can manage active_connections" ON public.active_connections
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow inserts from edge functions (they use service role, bypasses RLS)
-- But also allow authenticated users to insert their own
CREATE POLICY "Authenticated can insert active_connections" ON public.active_connections
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_connections;
