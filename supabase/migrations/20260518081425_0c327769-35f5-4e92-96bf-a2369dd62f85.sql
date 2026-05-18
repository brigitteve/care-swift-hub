
-- 1. ROLES
CREATE TYPE public.app_role AS ENUM ('nurse', 'supervisor', 'admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "users_read_own_roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "admins_manage_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-assign nurse role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'nurse'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Backfill: give existing users the nurse role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'nurse'::app_role FROM auth.users
ON CONFLICT DO NOTHING;

-- 2. PATIENTS: assigned_to
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS assigned_to uuid;
UPDATE public.patients SET assigned_to = user_id WHERE assigned_to IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_assigned_to ON public.patients(assigned_to);

DROP POLICY IF EXISTS patients_own_all ON public.patients;
CREATE POLICY "patients_read" ON public.patients FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id OR auth.uid() = assigned_to
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "patients_insert" ON public.patients FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "patients_update" ON public.patients FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id OR auth.uid() = assigned_to
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "patients_delete" ON public.patients FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 3. SHIFTS: assignment + cached counts
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS assigned_nurse_id uuid;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS total_checklist int NOT NULL DEFAULT 0;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS done_checklist int NOT NULL DEFAULT 0;

DROP POLICY IF EXISTS shifts_own_all ON public.shifts;
CREATE POLICY "shifts_read" ON public.shifts FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id OR auth.uid() = assigned_nurse_id
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "shifts_write" ON public.shifts FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'admin'));

-- 4. ALERTS: seen + priority_score
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS seen boolean NOT NULL DEFAULT false;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS priority_score int NOT NULL DEFAULT 50;

DROP POLICY IF EXISTS alerts_own_all ON public.alerts;
CREATE POLICY "alerts_all" ON public.alerts FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'supervisor')
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = alerts.patient_id AND (p.assigned_to = auth.uid() OR p.user_id = auth.uid()))
  )
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'admin'));

-- 5. SUPPLIES: stock
ALTER TABLE public.supplies ADD COLUMN IF NOT EXISTS stock int NOT NULL DEFAULT 50;
ALTER TABLE public.supplies ADD COLUMN IF NOT EXISTS min_stock int NOT NULL DEFAULT 10;

-- 6. ACHIEVEMENTS
CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  shift_id uuid,
  patient_id uuid,
  type text NOT NULL,
  label text NOT NULL,
  points int NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements_own" ON public.achievements FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);

-- 7. Vitals + Checklist + Usages: allow assigned nurses & supervisors to read
DROP POLICY IF EXISTS vitals_own_all ON public.vital_signs;
CREATE POLICY "vitals_read" ON public.vital_signs FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = vital_signs.patient_id AND (p.assigned_to = auth.uid() OR p.user_id = auth.uid()))
  );
CREATE POLICY "vitals_write" ON public.vital_signs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS checklist_own_all ON public.checklist_items;
CREATE POLICY "checklist_read" ON public.checklist_items FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = checklist_items.patient_id AND (p.assigned_to = auth.uid() OR p.user_id = auth.uid()))
  );
CREATE POLICY "checklist_insert" ON public.checklist_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "checklist_update" ON public.checklist_items FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = checklist_items.patient_id AND p.assigned_to = auth.uid())
    OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "checklist_delete" ON public.checklist_items FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS usages_own_all ON public.supply_usages;
CREATE POLICY "usages_read" ON public.supply_usages FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'supervisor') OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = supply_usages.patient_id AND (p.assigned_to = auth.uid() OR p.user_id = auth.uid()))
  );
CREATE POLICY "usages_write" ON public.supply_usages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 8. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.achievements;
