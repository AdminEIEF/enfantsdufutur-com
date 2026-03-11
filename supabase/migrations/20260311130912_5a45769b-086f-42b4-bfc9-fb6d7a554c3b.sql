-- Drop the overly broad admin policy
DROP POLICY IF EXISTS "Admin can manage all support_messages" ON public.support_messages;

-- Replace with admin policy that only allows own messages (like regular users)
CREATE POLICY "Admin can read own support_messages"
  ON public.support_messages FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND (sender_id = auth.uid() OR target_user_id = auth.uid())
  );

CREATE POLICY "Admin can insert own support_messages"
  ON public.support_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND sender_id = auth.uid()
  );

CREATE POLICY "Admin can update targeted support_messages"
  ON public.support_messages FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND target_user_id = auth.uid()
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND target_user_id = auth.uid()
  );