-- Allow chauffeur role to insert parent and student notifications (for bus boarding/alighting alerts)
CREATE POLICY "Chauffeur can insert parent_notifications"
  ON public.parent_notifications FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'chauffeur'::app_role));

CREATE POLICY "Chauffeur can insert student_notifications"
  ON public.student_notifications FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'chauffeur'::app_role));

-- Also allow superviseur to insert parent_notifications (for transport operations)
CREATE POLICY "Superviseur can insert parent_notifications"
  ON public.parent_notifications FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'superviseur'::app_role));