-- Feedback is a small, account-bound signal. The only supported write path is
-- submit_user_feedback(), which validates the approved Auth session and
-- serializes the idempotency and quota checks per account.
CREATE TABLE public.user_feedback (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  topic_code text NOT NULL
    CHECK (topic_code IN ('easy_to_use', 'hard_to_use', 'slow', 'error', 'more_features')),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT user_feedback_user_request_unique UNIQUE (user_id, request_id)
);

CREATE INDEX user_feedback_user_created_idx
  ON public.user_feedback (user_id, created_at DESC);

COMMENT ON TABLE public.user_feedback IS
  'One-topic account feedback; access and quota are enforced by submit_user_feedback().';

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_feedback FORCE ROW LEVEL SECURITY;

-- No authenticated/anonymous direct SELECT or DML is granted. The owner can
-- inspect aggregates with the service role or SQL editor.
REVOKE ALL ON TABLE public.user_feedback FROM PUBLIC, anon, authenticated, kemtit_pending;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_feedback TO service_role;

CREATE OR REPLACE FUNCTION public.submit_user_feedback(
  p_request_id uuid,
  p_topic_code text
)
RETURNS TABLE (
  feedback_id uuid,
  feedback_created_at timestamptz,
  was_duplicate boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_user_id uuid;
  v_now timestamptz;
  v_feedback_id uuid;
  v_created_at timestamptz;
  v_existing_topic text;
BEGIN
  v_user_id := auth.uid();
  IF auth.role() IS DISTINCT FROM 'authenticated'
    OR auth.jwt() ->> 'kemtit_session_state' IS DISTINCT FROM 'approved'
    OR auth.jwt() ->> 'kemtit_claim_version' IS DISTINCT FROM '1'
    OR v_user_id IS NULL
    OR v_user_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION USING MESSAGE = 'feedback_unauthorized', ERRCODE = '42501';
  END IF;

  IF p_request_id IS NULL
    OR p_topic_code IS NULL
    OR p_topic_code NOT IN ('easy_to_use', 'hard_to_use', 'slow', 'error', 'more_features') THEN
    RAISE EXCEPTION USING MESSAGE = 'feedback_validation', ERRCODE = '22023';
  END IF;

  -- Hash collisions can only serialize unrelated accounts; they cannot weaken
  -- a quota. The unique constraint remains the final idempotency guard.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('user_feedback:' || v_user_id::text, 0)
  );
  v_now := pg_catalog.clock_timestamp();

  -- Resolve a committed retry before applying either quota. A key cannot be
  -- reused for another topic, including after the original response is lost.
  SELECT f.id, f.created_at, f.topic_code
  INTO v_feedback_id, v_created_at, v_existing_topic
  FROM public.user_feedback AS f
  WHERE f.user_id = v_user_id
    AND f.request_id = p_request_id;

  IF FOUND THEN
    IF v_existing_topic IS DISTINCT FROM p_topic_code THEN
      RAISE EXCEPTION USING MESSAGE = 'feedback_request_conflict', ERRCODE = 'P0001';
    END IF;

    feedback_id := v_feedback_id;
    feedback_created_at := v_created_at;
    was_duplicate := true;
    RETURN NEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_feedback AS f
    WHERE f.user_id = v_user_id
      AND f.created_at > v_now - INTERVAL '1 minute'
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'feedback_rate_limited', ERRCODE = 'P0001';
  END IF;

  IF (
    SELECT pg_catalog.count(*)
    FROM public.user_feedback AS f
    WHERE f.user_id = v_user_id
      AND f.created_at > v_now - INTERVAL '24 hours'
  ) >= 10 THEN
    RAISE EXCEPTION USING MESSAGE = 'feedback_rate_limited', ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.user_feedback (user_id, request_id, topic_code, created_at)
  VALUES (v_user_id, p_request_id, p_topic_code, v_now)
  RETURNING id, created_at INTO feedback_id, feedback_created_at;

  was_duplicate := false;
  RETURN NEXT;
END
$function$;

REVOKE ALL ON FUNCTION public.submit_user_feedback(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role, kemtit_pending;
GRANT EXECUTE ON FUNCTION public.submit_user_feedback(uuid, text) TO authenticated;

-- Release content is owner-managed plain text with separately stored Thai and
-- English copy. The application renders these values as text nodes.
CREATE TABLE public.release_notes (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  version text NOT NULL,
  build_id text NOT NULL,
  title_th text NOT NULL,
  title_en text NOT NULL,
  new_items_th text[] NOT NULL DEFAULT ARRAY[]::text[],
  new_items_en text[] NOT NULL DEFAULT ARRAY[]::text[],
  improved_items_th text[] NOT NULL DEFAULT ARRAY[]::text[],
  improved_items_en text[] NOT NULL DEFAULT ARRAY[]::text[],
  fixed_items_th text[] NOT NULL DEFAULT ARRAY[]::text[],
  fixed_items_en text[] NOT NULL DEFAULT ARRAY[]::text[],
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT release_notes_version_unique UNIQUE (version),
  CONSTRAINT release_notes_version_valid CHECK (
    pg_catalog.btrim(version) <> '' AND pg_catalog.length(version) <= 64
  ),
  CONSTRAINT release_notes_build_id_valid CHECK (
    pg_catalog.btrim(build_id) <> '' AND pg_catalog.length(build_id) <= 128
  ),
  CONSTRAINT release_notes_titles_valid CHECK (
    pg_catalog.btrim(title_th) <> ''
    AND pg_catalog.btrim(title_en) <> ''
    AND pg_catalog.length(title_th) <= 200
    AND pg_catalog.length(title_en) <= 200
  ),
  CONSTRAINT release_notes_localized_items_aligned CHECK (
    pg_catalog.cardinality(new_items_th) = pg_catalog.cardinality(new_items_en)
    AND pg_catalog.cardinality(improved_items_th) = pg_catalog.cardinality(improved_items_en)
    AND pg_catalog.cardinality(fixed_items_th) = pg_catalog.cardinality(fixed_items_en)
  ),
  CONSTRAINT release_notes_items_bounded CHECK (
    pg_catalog.cardinality(new_items_th) <= 20
    AND pg_catalog.cardinality(improved_items_th) <= 20
    AND pg_catalog.cardinality(fixed_items_th) <= 20
    AND pg_catalog.cardinality(new_items_th)
      + pg_catalog.cardinality(improved_items_th)
      + pg_catalog.cardinality(fixed_items_th) >= 1
    AND pg_catalog.length(
      pg_catalog.array_to_string(new_items_th, '')
      || pg_catalog.array_to_string(new_items_en, '')
      || pg_catalog.array_to_string(improved_items_th, '')
      || pg_catalog.array_to_string(improved_items_en, '')
      || pg_catalog.array_to_string(fixed_items_th, '')
      || pg_catalog.array_to_string(fixed_items_en, '')
    ) <= 12000
  ),
  CONSTRAINT release_notes_items_no_nulls CHECK (
    pg_catalog.array_position(new_items_th, NULL::text) IS NULL
    AND pg_catalog.array_position(new_items_en, NULL::text) IS NULL
    AND pg_catalog.array_position(improved_items_th, NULL::text) IS NULL
    AND pg_catalog.array_position(improved_items_en, NULL::text) IS NULL
    AND pg_catalog.array_position(fixed_items_th, NULL::text) IS NULL
    AND pg_catalog.array_position(fixed_items_en, NULL::text) IS NULL
  )
);

CREATE INDEX release_notes_published_idx
  ON public.release_notes (published_at DESC, id DESC)
  WHERE published_at IS NOT NULL;

COMMENT ON TABLE public.release_notes IS
  'Owner-published bilingual plain-text releases. Only due published rows are visible to approved users.';

ALTER TABLE public.release_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_notes FORCE ROW LEVEL SECURITY;

CREATE POLICY release_notes_read_published
  ON public.release_notes
  FOR SELECT
  TO authenticated
  USING (
    auth.role() = 'authenticated'
    AND auth.jwt() ->> 'kemtit_session_state' = 'approved'
    AND auth.jwt() ->> 'kemtit_claim_version' = '1'
    AND auth.uid() IS NOT NULL
    AND published_at IS NOT NULL
    AND published_at <= pg_catalog.statement_timestamp()
  );

REVOKE ALL ON TABLE public.release_notes FROM PUBLIC, anon, authenticated, kemtit_pending;
GRANT SELECT ON TABLE public.release_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.release_notes TO service_role;

CREATE TABLE public.release_note_reads (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  release_note_id uuid NOT NULL REFERENCES public.release_notes (id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  PRIMARY KEY (user_id, release_note_id)
);

CREATE INDEX release_note_reads_note_idx
  ON public.release_note_reads (release_note_id, user_id);

ALTER TABLE public.release_note_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_note_reads FORCE ROW LEVEL SECURITY;

CREATE POLICY release_note_reads_select_own
  ON public.release_note_reads
  FOR SELECT
  TO authenticated
  USING (
    auth.role() = 'authenticated'
    AND auth.jwt() ->> 'kemtit_session_state' = 'approved'
    AND auth.jwt() ->> 'kemtit_claim_version' = '1'
    AND auth.uid() IS NOT NULL
    AND user_id = auth.uid()
  );

REVOKE ALL ON TABLE public.release_note_reads FROM PUBLIC, anon, authenticated, kemtit_pending;
GRANT SELECT ON TABLE public.release_note_reads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.release_note_reads TO service_role;

CREATE OR REPLACE FUNCTION public.acknowledge_release_note(p_release_note_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_user_id uuid;
  v_read_at timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF auth.role() IS DISTINCT FROM 'authenticated'
    OR auth.jwt() ->> 'kemtit_session_state' IS DISTINCT FROM 'approved'
    OR auth.jwt() ->> 'kemtit_claim_version' IS DISTINCT FROM '1'
    OR v_user_id IS NULL
    OR v_user_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION USING MESSAGE = 'release_note_unauthorized', ERRCODE = '42501';
  END IF;

  IF p_release_note_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.release_notes AS r
    WHERE r.id = p_release_note_id
      AND r.published_at IS NOT NULL
      AND r.published_at <= pg_catalog.clock_timestamp()
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'release_note_unavailable', ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.release_note_reads (user_id, release_note_id)
  VALUES (v_user_id, p_release_note_id)
  ON CONFLICT (user_id, release_note_id) DO NOTHING;

  SELECT rr.read_at
  INTO v_read_at
  FROM public.release_note_reads AS rr
  WHERE rr.user_id = v_user_id
    AND rr.release_note_id = p_release_note_id;

  RETURN v_read_at;
END
$function$;

REVOKE ALL ON FUNCTION public.acknowledge_release_note(uuid)
  FROM PUBLIC, anon, authenticated, service_role, kemtit_pending;
GRANT EXECUTE ON FUNCTION public.acknowledge_release_note(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
