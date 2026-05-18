
DROP POLICY "supplies_insert_all" ON public.supplies;
CREATE POLICY "supplies_insert_authenticated" ON public.supplies
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
