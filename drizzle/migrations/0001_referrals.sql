ALTER TABLE public.profiles
  ADD COLUMN referral_code text UNIQUE DEFAULT lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  ADD COLUMN referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

UPDATE public.profiles SET referral_code = lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)) WHERE referral_code IS NULL;

ALTER TABLE public.profiles ALTER COLUMN referral_code SET NOT NULL;

CREATE INDEX profiles_referred_by_idx ON public.profiles (referred_by);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  ref_id uuid;
BEGIN
  IF coalesce(m->>'ref', '') ~ '^[a-z0-9]{6,12}$' THEN
    SELECT id INTO ref_id FROM public.profiles WHERE referral_code = m->>'ref';
  END IF;

  INSERT INTO public.profiles (id, first_name, last_name, id_number, email, phone, county, sub_county, expected_daily_pay, expected_monthly_pay, allow_contact, referred_by)
  VALUES (
    new.id,
    left(coalesce(m->>'first_name', ''), 80),
    left(coalesce(m->>'last_name', ''), 80),
    nullif(left(coalesce(m->>'id_number', ''), 20), ''),
    new.email,
    nullif(left(coalesce(m->>'phone', ''), 20), ''),
    nullif(left(coalesce(m->>'county', ''), 60), ''),
    nullif(left(coalesce(m->>'sub_county', ''), 60), ''),
    CASE WHEN coalesce(m->>'expected_daily_pay', '') ~ '^[0-9]{1,8}$' THEN (m->>'expected_daily_pay')::integer END,
    CASE WHEN coalesce(m->>'expected_monthly_pay', '') ~ '^[0-9]{1,8}$' THEN (m->>'expected_monthly_pay')::integer END,
    coalesce(m->>'allow_contact', 'false') = 'true',
    ref_id
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'user');
  IF lower(new.email) = 'antonykhalix@gmail.com' AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'admin');
  END IF;
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.my_referrals()
RETURNS TABLE (first_name text, last_initial text, county text, sub_county text, joined_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.first_name, left(p.last_name, 1), p.county, p.sub_county, p.created_at
  FROM public.profiles p
  WHERE p.referred_by = auth.uid()
  ORDER BY p.created_at DESC
$$;

REVOKE ALL ON FUNCTION public.my_referrals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_referrals() TO authenticated;