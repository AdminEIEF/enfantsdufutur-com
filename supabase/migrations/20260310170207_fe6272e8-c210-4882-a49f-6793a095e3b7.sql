-- Allow users to also read messages targeted at them
DROP POLICY IF EXISTS "Users can read own support_messages" ON public.support_messages;
CREATE POLICY "Users can read own support_messages"
ON public.support_messages FOR SELECT TO authenticated
USING (sender_id = auth.uid() OR target_user_id = auth.uid());

-- Allow users to update messages targeted at them (mark as read)
CREATE POLICY "Users can update targeted support_messages"
ON public.support_messages FOR UPDATE TO authenticated
USING (target_user_id = auth.uid())
WITH CHECK (target_user_id = auth.uid());