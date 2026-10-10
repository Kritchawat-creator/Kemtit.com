-- Keep unverified Auth sessions outside the public API until the application
-- has completed its server-verified sign-in policy.

DO $role$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'kemtit_pending'
  ) THEN
    RAISE EXCEPTION 'role kemtit_pending already exists; inspect it before applying this migration';
  END IF;

  CREATE ROLE kemtit_pending NOLOGIN NOINHERIT NOBYPASSRLS;
END
$role$;

GRANT kemtit_pending TO authenticator WITH INHERIT FALSE, SET TRUE;

-- Preserve existing explicit API-role grants while removing default PUBLIC
-- visibility. A pending token cannot inherit schema access through PUBLIC.
REVOKE USAGE ON SCHEMA public FROM PUBLIC;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA private TO supabase_auth_admin;

CREATE TABLE private.approved_login_sessions (
  session_id uuid PRIMARY KEY REFERENCES auth.sessions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  approved_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  approval_source text NOT NULL DEFAULT 'server_verified'
    CHECK (approval_source IN ('preexisting_session', 'server_verified'))
);

COMMENT ON TABLE private.approved_login_sessions IS
  'Server-owned allowlist of Auth sessions that may receive the normal authenticated JWT role.';

-- Existing active Auth sessions retain their current access when the hook is
-- enabled. The FK removes approvals automatically when Auth deletes a session.
INSERT INTO private.approved_login_sessions (session_id, user_id, approval_source)
SELECT s.id, s.user_id, 'preexisting_session'
FROM auth.sessions AS s
ON CONFLICT (session_id) DO NOTHING;

CREATE TABLE private.login_email_hmac_key (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  key_material bytea NOT NULL CHECK (pg_catalog.octet_length(key_material) = 32)
);

INSERT INTO private.login_email_hmac_key (singleton, key_material)
VALUES (true, extensions.gen_random_bytes(32))
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE private.login_challenges (
  challenge_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash bytea NOT NULL UNIQUE CHECK (pg_catalog.octet_length(token_hash) = 32),
  email_hash bytea NOT NULL CHECK (pg_catalog.octet_length(email_hash) = 32),
  purpose text NOT NULL CHECK (purpose IN ('login', 'signup', 'recovery')),
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  preauth_session_id uuid,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  expires_at timestamptz NOT NULL,
  attempt_count smallint NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  last_sent_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  consumed_at timestamptz,
  CHECK (
    (purpose = 'login' AND user_id IS NOT NULL AND preauth_session_id IS NOT NULL)
    OR (purpose IN ('signup', 'recovery') AND preauth_session_id IS NULL)
  )
);

CREATE INDEX login_challenges_email_created_idx
  ON private.login_challenges (email_hash, created_at DESC);

CREATE TABLE private.trusted_login_devices (
  token_hash bytea PRIMARY KEY CHECK (pg_catalog.octet_length(token_hash) = 32),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  password_fingerprint bytea NOT NULL CHECK (pg_catalog.octet_length(password_fingerprint) = 32),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX trusted_login_devices_user_idx
  ON private.trusted_login_devices (user_id, expires_at)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE private.login_challenges IS
  'Server-owned one-time app challenge state; only hashes are stored, and OTP values remain in Supabase Auth.';
COMMENT ON TABLE private.trusted_login_devices IS
  'Hash-only 30-day browser credentials bound to the current Supabase Auth password fingerprint.';

CREATE OR REPLACE FUNCTION private.login_email_hmac(p_email text)
RETURNS bytea
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_key bytea;
BEGIN
  IF p_email IS NULL OR pg_catalog.btrim(p_email) = '' THEN
    RETURN NULL;
  END IF;

  SELECT k.key_material
  INTO v_key
  FROM private.login_email_hmac_key AS k
  WHERE k.singleton;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'login email digest key is unavailable';
  END IF;

  RETURN extensions.hmac(
    pg_catalog.convert_to(pg_catalog.lower(pg_catalog.btrim(p_email)), 'UTF8'),
    v_key,
    'sha256'
  );
END
$function$;

CREATE OR REPLACE FUNCTION private.record_approved_login_session(
  p_user_id uuid,
  p_session_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF p_user_id IS NULL OR p_session_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM auth.sessions AS s
    WHERE s.id = p_session_id
      AND s.user_id = p_user_id
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO private.approved_login_sessions (session_id, user_id, approval_source)
  VALUES (p_session_id, p_user_id, 'server_verified')
  ON CONFLICT (session_id) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        approved_at = pg_catalog.clock_timestamp(),
        approval_source = 'server_verified'
    WHERE private.approved_login_sessions.user_id = EXCLUDED.user_id;

  RETURN FOUND;
END
$function$;

CREATE OR REPLACE FUNCTION private.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_user_id uuid;
  v_session_id uuid;
  v_claims jsonb;
  v_is_approved boolean;
BEGIN
  v_user_id := NULLIF(event->>'user_id', '')::uuid;
  v_session_id := NULLIF(event->'claims'->>'session_id', '')::uuid;
  v_claims := event->'claims';

  IF v_user_id IS NULL
    OR v_session_id IS NULL
    OR pg_catalog.jsonb_typeof(v_claims) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'custom access token hook received an invalid event';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM private.approved_login_sessions AS a
    WHERE a.session_id = v_session_id
      AND a.user_id = v_user_id
  )
  INTO v_is_approved;

  IF v_is_approved THEN
    v_claims := pg_catalog.jsonb_set(v_claims, '{sub}', pg_catalog.to_jsonb(v_user_id::text), true);
    v_claims := pg_catalog.jsonb_set(v_claims, '{role}', '"authenticated"'::jsonb, true);
    v_claims := pg_catalog.jsonb_set(v_claims, '{kemtit_session_state}', '"approved"'::jsonb, true);
  ELSE
    v_claims := pg_catalog.jsonb_set(
      v_claims,
      '{sub}',
      '"00000000-0000-0000-0000-000000000000"'::jsonb,
      true
    );
    v_claims := pg_catalog.jsonb_set(v_claims, '{role}', '"kemtit_pending"'::jsonb, true);
    v_claims := pg_catalog.jsonb_set(v_claims, '{kemtit_session_state}', '"pending"'::jsonb, true);
  END IF;

  v_claims := pg_catalog.jsonb_set(v_claims, '{kemtit_claim_version}', '1'::jsonb, true);
  RETURN pg_catalog.jsonb_build_object('claims', v_claims);
END
$function$;

CREATE OR REPLACE FUNCTION public.approve_login_session(
  p_user_id uuid,
  p_session_id uuid,
  p_device_token_hash bytea DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_encrypted_password text;
  v_password_fingerprint bytea;
  v_rows integer;
BEGIN
  IF p_device_token_hash IS NOT NULL THEN
    IF pg_catalog.octet_length(p_device_token_hash) <> 32 THEN
      RETURN false;
    END IF;

    SELECT u.encrypted_password
    INTO v_encrypted_password
    FROM auth.users AS u
    WHERE u.id = p_user_id;

    IF NOT FOUND OR v_encrypted_password IS NULL OR v_encrypted_password = '' THEN
      RETURN false;
    END IF;

    v_password_fingerprint := pg_catalog.sha256(
      pg_catalog.convert_to(v_encrypted_password, 'UTF8')
    );
  END IF;

  IF NOT private.record_approved_login_session(p_user_id, p_session_id) THEN
    RETURN false;
  END IF;

  IF p_device_token_hash IS NOT NULL THEN
    INSERT INTO private.trusted_login_devices (
      token_hash,
      user_id,
      password_fingerprint,
      expires_at,
      last_used_at,
      revoked_at
    )
    VALUES (
      p_device_token_hash,
      p_user_id,
      v_password_fingerprint,
      pg_catalog.clock_timestamp() + INTERVAL '30 days',
      pg_catalog.clock_timestamp(),
      NULL
    )
    ON CONFLICT (token_hash) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          password_fingerprint = EXCLUDED.password_fingerprint,
          expires_at = EXCLUDED.expires_at,
          last_used_at = EXCLUDED.last_used_at,
          revoked_at = NULL
      WHERE private.trusted_login_devices.user_id = EXCLUDED.user_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RAISE EXCEPTION 'trusted device token is already bound to another account'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN true;
END
$function$;

CREATE OR REPLACE FUNCTION public.begin_login_challenge(
  p_token_hash bytea,
  p_email text,
  p_purpose text,
  p_user_id uuid DEFAULT NULL,
  p_preauth_session_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_email_hash bytea;
  v_now timestamptz := pg_catalog.clock_timestamp();
BEGIN
  IF p_token_hash IS NULL
    OR pg_catalog.octet_length(p_token_hash) <> 32
    OR p_purpose IS NULL
    OR p_purpose NOT IN ('login', 'signup', 'recovery') THEN
    RETURN false;
  END IF;

  v_email_hash := private.login_email_hmac(p_email);
  IF v_email_hash IS NULL THEN
    RETURN false;
  END IF;

  IF p_purpose = 'login'
    AND (p_user_id IS NULL OR p_preauth_session_id IS NULL) THEN
    RETURN false;
  END IF;

  IF p_purpose <> 'login' AND p_preauth_session_id IS NOT NULL THEN
    RETURN false;
  END IF;

  IF p_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM auth.users AS u
    WHERE u.id = p_user_id
      AND private.login_email_hmac(u.email) = v_email_hash
  ) THEN
    RETURN false;
  END IF;

  IF p_preauth_session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM auth.sessions AS s
    WHERE s.id = p_preauth_session_id
      AND s.user_id = p_user_id
  ) THEN
    RETURN false;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pg_catalog.encode(v_email_hash, 'hex'), 0)
  );

  IF EXISTS (
    SELECT 1
    FROM private.login_challenges AS c
    WHERE c.email_hash = v_email_hash
      AND c.consumed_at IS NULL
      AND c.expires_at > v_now
      AND c.last_sent_at > v_now - INTERVAL '60 seconds'
  ) THEN
    RETURN false;
  END IF;

  UPDATE private.login_challenges AS c
  SET consumed_at = v_now
  WHERE c.email_hash = v_email_hash
    AND c.consumed_at IS NULL;

  INSERT INTO private.login_challenges (
    token_hash,
    email_hash,
    purpose,
    user_id,
    preauth_session_id,
    created_at,
    expires_at,
    last_sent_at
  )
  VALUES (
    p_token_hash,
    v_email_hash,
    p_purpose,
    p_user_id,
    p_preauth_session_id,
    v_now,
    v_now + INTERVAL '10 minutes',
    v_now
  );

  RETURN true;
END
$function$;

CREATE OR REPLACE FUNCTION public.reserve_login_challenge_attempt(p_token_hash bytea)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_attempt_count integer;
BEGIN
  IF p_token_hash IS NULL OR pg_catalog.octet_length(p_token_hash) <> 32 THEN
    RETURN 0;
  END IF;

  UPDATE private.login_challenges AS c
  SET attempt_count = c.attempt_count + 1
  WHERE c.token_hash = p_token_hash
    AND c.consumed_at IS NULL
    AND c.expires_at > pg_catalog.clock_timestamp()
    AND c.attempt_count < 5
  RETURNING c.attempt_count INTO v_attempt_count;

  RETURN COALESCE(v_attempt_count, 0);
END
$function$;

CREATE OR REPLACE FUNCTION public.reserve_login_challenge_resend(p_token_hash bytea)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF p_token_hash IS NULL OR pg_catalog.octet_length(p_token_hash) <> 32 THEN
    RETURN false;
  END IF;

  UPDATE private.login_challenges AS c
  SET last_sent_at = pg_catalog.clock_timestamp()
  WHERE c.token_hash = p_token_hash
    AND c.consumed_at IS NULL
    AND c.expires_at > pg_catalog.clock_timestamp()
    AND c.attempt_count < 5
    AND c.last_sent_at <= pg_catalog.clock_timestamp() - INTERVAL '60 seconds';

  RETURN FOUND;
END
$function$;

CREATE OR REPLACE FUNCTION public.consume_login_challenge(
  p_token_hash bytea,
  p_user_id uuid,
  p_session_id uuid,
  p_purpose text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_challenge private.login_challenges%ROWTYPE;
BEGIN
  IF p_token_hash IS NULL
    OR pg_catalog.octet_length(p_token_hash) <> 32
    OR p_user_id IS NULL
    OR p_session_id IS NULL
    OR p_purpose IS NULL
    OR p_purpose NOT IN ('login', 'signup', 'recovery') THEN
    RETURN false;
  END IF;

  SELECT c.*
  INTO v_challenge
  FROM private.login_challenges AS c
  WHERE c.token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND
    OR v_challenge.consumed_at IS NOT NULL
    OR v_challenge.expires_at <= pg_catalog.clock_timestamp()
    OR v_challenge.attempt_count < 1
    OR v_challenge.attempt_count > 5
    OR v_challenge.purpose <> p_purpose
    OR (v_challenge.user_id IS NOT NULL AND v_challenge.user_id <> p_user_id) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users AS u
    WHERE u.id = p_user_id
      AND private.login_email_hmac(u.email) = v_challenge.email_hash
  ) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.sessions AS s
    WHERE s.id = p_session_id
      AND s.user_id = p_user_id
  ) THEN
    RETURN false;
  END IF;

  IF v_challenge.purpose = 'login' AND NOT EXISTS (
    SELECT 1
    FROM auth.sessions AS s
    WHERE s.id = v_challenge.preauth_session_id
      AND s.user_id = p_user_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE private.login_challenges AS c
  SET consumed_at = pg_catalog.clock_timestamp()
  WHERE c.challenge_id = v_challenge.challenge_id
    AND c.consumed_at IS NULL;

  RETURN FOUND;
END
$function$;

CREATE OR REPLACE FUNCTION public.approve_trusted_device_session(
  p_user_id uuid,
  p_session_id uuid,
  p_device_token_hash bytea
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_encrypted_password text;
  v_password_fingerprint bytea;
BEGIN
  IF p_user_id IS NULL
    OR p_session_id IS NULL
    OR p_device_token_hash IS NULL
    OR pg_catalog.octet_length(p_device_token_hash) <> 32 THEN
    RETURN false;
  END IF;

  SELECT u.encrypted_password
  INTO v_encrypted_password
  FROM auth.users AS u
  WHERE u.id = p_user_id;

  IF NOT FOUND OR v_encrypted_password IS NULL OR v_encrypted_password = '' THEN
    RETURN false;
  END IF;

  v_password_fingerprint := pg_catalog.sha256(
    pg_catalog.convert_to(v_encrypted_password, 'UTF8')
  );

  PERFORM 1
  FROM private.trusted_login_devices AS d
  WHERE d.token_hash = p_device_token_hash
    AND d.user_id = p_user_id
    AND d.password_fingerprint = v_password_fingerprint
    AND d.revoked_at IS NULL
    AND d.expires_at > pg_catalog.clock_timestamp()
  FOR UPDATE;

  IF NOT FOUND OR NOT private.record_approved_login_session(p_user_id, p_session_id) THEN
    RETURN false;
  END IF;

  UPDATE private.trusted_login_devices AS d
  SET last_used_at = pg_catalog.clock_timestamp()
  WHERE d.token_hash = p_device_token_hash
    AND d.user_id = p_user_id;

  RETURN true;
END
$function$;

-- Private tables and helpers are accessible only to their owner, except for
-- the minimal read access required by the Auth hook.
REVOKE ALL ON TABLE private.approved_login_sessions FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin;
REVOKE ALL ON TABLE private.login_email_hmac_key FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin;
REVOKE ALL ON TABLE private.login_challenges FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin;
REVOKE ALL ON TABLE private.trusted_login_devices FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin;
REVOKE ALL ON FUNCTION private.login_email_hmac(text) FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin;
REVOKE ALL ON FUNCTION private.record_approved_login_session(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin;
REVOKE ALL ON FUNCTION private.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated, service_role, supabase_auth_admin;
GRANT SELECT ON private.approved_login_sessions TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION private.custom_access_token_hook(jsonb) TO supabase_auth_admin;

REVOKE ALL ON FUNCTION public.approve_login_session(uuid, uuid, bytea) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_login_challenge(bytea, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_login_challenge_attempt(bytea) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_login_challenge_resend(bytea) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_login_challenge(bytea, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_trusted_device_session(uuid, uuid, bytea) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.approve_login_session(uuid, uuid, bytea) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_login_challenge(bytea, text, text, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_login_challenge_attempt(bytea) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_login_challenge_resend(bytea) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_login_challenge(bytea, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_trusted_device_session(uuid, uuid, bytea) TO service_role;

NOTIFY pgrst, 'reload schema';
