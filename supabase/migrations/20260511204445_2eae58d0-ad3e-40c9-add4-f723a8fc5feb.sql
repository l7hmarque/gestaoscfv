CREATE TABLE IF NOT EXISTS public.drive_sync_state (
  id smallint PRIMARY KEY DEFAULT 1,
  is_running boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  CONSTRAINT drive_sync_state_singleton CHECK (id = 1)
);
INSERT INTO public.drive_sync_state (id, is_running) VALUES (1, false) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.drive_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.drive_sync_state FOR ALL USING (false) WITH CHECK (false);