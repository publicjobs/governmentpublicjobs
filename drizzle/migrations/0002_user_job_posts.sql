ALTER TABLE public.jobs
  ADD COLUMN posted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN review_status text NOT NULL DEFAULT 'approved' CHECK (review_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX jobs_posted_by_idx ON public.jobs (posted_by);
CREATE INDEX jobs_review_status_idx ON public.jobs (review_status);

CREATE POLICY "Users submit jobs for review" ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (posted_by = auth.uid() AND is_active = false AND review_status = 'pending');

CREATE POLICY "Users view own posted jobs" ON public.jobs FOR SELECT TO authenticated
  USING (posted_by = auth.uid());