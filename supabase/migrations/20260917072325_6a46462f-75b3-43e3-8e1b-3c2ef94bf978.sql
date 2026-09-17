CREATE TABLE public.study_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_level class_level NOT NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  kind text NOT NULL DEFAULT 'file' CHECK (kind IN ('file','youtube','link')),
  url text,
  file_path text,
  file_name text,
  file_size bigint,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_materials TO authenticated;
GRANT ALL ON public.study_materials TO service_role;

ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can view study materials"
  ON public.study_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert study materials"
  ON public.study_materials FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update study materials"
  ON public.study_materials FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete study materials"
  ON public.study_materials FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER study_materials_set_updated_at BEFORE UPDATE ON public.study_materials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_study_materials_class ON public.study_materials(class_level, created_at DESC);

CREATE POLICY "Signed-in users can read study material files"
  ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'study-materials');
CREATE POLICY "Admins can upload study material files"
  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'study-materials' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update study material files"
  ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'study-materials' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete study material files"
  ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'study-materials' AND public.has_role(auth.uid(), 'admin'));