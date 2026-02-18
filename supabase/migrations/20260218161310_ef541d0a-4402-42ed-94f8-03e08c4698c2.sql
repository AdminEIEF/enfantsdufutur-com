
-- Add student password to eleves table
ALTER TABLE public.eleves ADD COLUMN IF NOT EXISTS mot_de_passe_eleve text;

-- Table: cours (course materials posted by admin/service_info)
CREATE TABLE public.cours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titre text NOT NULL,
  description text,
  matiere_id uuid REFERENCES public.matieres(id) ON DELETE CASCADE NOT NULL,
  classe_id uuid REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  type_contenu text NOT NULL DEFAULT 'pdf', -- pdf, video_youtube, video_vimeo, lien
  contenu_url text NOT NULL,
  fichier_nom text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/ServiceInfo can manage cours" ON public.cours
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'service_info'::app_role));

CREATE POLICY "Authenticated can read cours" ON public.cours
  FOR SELECT USING (true);

-- Table: devoirs (assignments)
CREATE TABLE public.devoirs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titre text NOT NULL,
  description text,
  matiere_id uuid REFERENCES public.matieres(id) ON DELETE CASCADE NOT NULL,
  classe_id uuid REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  date_limite timestamptz NOT NULL,
  note_max numeric NOT NULL DEFAULT 20,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.devoirs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/ServiceInfo can manage devoirs" ON public.devoirs
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'service_info'::app_role));

CREATE POLICY "Authenticated can read devoirs" ON public.devoirs
  FOR SELECT USING (true);

-- Table: soumissions_devoirs (student submissions)
CREATE TABLE public.soumissions_devoirs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devoir_id uuid REFERENCES public.devoirs(id) ON DELETE CASCADE NOT NULL,
  eleve_id uuid REFERENCES public.eleves(id) ON DELETE CASCADE NOT NULL,
  fichier_url text NOT NULL,
  fichier_nom text NOT NULL,
  note numeric,
  commentaire text,
  soumis_at timestamptz NOT NULL DEFAULT now(),
  corrige_at timestamptz,
  corrige_par uuid,
  UNIQUE(devoir_id, eleve_id)
);

ALTER TABLE public.soumissions_devoirs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/ServiceInfo can manage soumissions" ON public.soumissions_devoirs
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'service_info'::app_role));

CREATE POLICY "Authenticated can read soumissions" ON public.soumissions_devoirs
  FOR SELECT USING (true);

-- Storage bucket for student submissions
INSERT INTO storage.buckets (id, name, public) VALUES ('devoirs', 'devoirs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read devoirs files" ON storage.objects
  FOR SELECT USING (bucket_id = 'devoirs');

CREATE POLICY "Anyone can upload devoirs files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'devoirs');

-- Storage bucket for course materials
INSERT INTO storage.buckets (id, name, public) VALUES ('cours', 'cours', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read cours files" ON storage.objects
  FOR SELECT USING (bucket_id = 'cours');

CREATE POLICY "Authenticated can upload cours files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'cours');
