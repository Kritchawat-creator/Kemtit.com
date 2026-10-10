-- Signup may set a password only when its email was not already registered
-- when the server began this challenge. Auth's encrypted_password is not a
-- reliable indicator: native OTP signup can create a non-empty internal hash.

ALTER TABLE private.login_challenges
  ADD COLUMN signup_allowed boolean NOT NULL DEFAULT false;

DROP FUNCTION public.begin_login_challenge(bytea, text, text, uuid, uuid);

CREATE FUNCTION public.begin_login_challenge(
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
  v_signup_allowed boolean := false;
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

  IF p_purpose = 'signup' THEN
    v_signup_allowed := NOT EXISTS (
      SELECT 1
      FROM auth.users AS u
      WHERE pg_catalog.lower(u.email) = pg_catalog.lower(pg_catalog.btrim(p_email))
    );
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
    signup_allowed,
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
    v_signup_allowed,
    v_now,
    v_now + INTERVAL '10 minutes',
    v_now
  );

  RETURN true;
END
$function$;

DROP FUNCTION public.consume_login_challenge(bytea, uuid, uuid, text);

CREATE FUNCTION public.consume_login_challenge(
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
    OR (v_challenge.user_id IS NOT NULL AND v_challenge.user_id <> p_user_id)
    OR (p_purpose = 'signup' AND NOT v_challenge.signup_allowed) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users AS u
    WHERE u.id = p_user_id
      AND private.login_email_hmac(u.email) = v_challenge.email_hash
      AND (p_purpose <> 'signup' OR u.email_confirmed_at IS NOT NULL)
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

REVOKE ALL ON FUNCTION public.begin_login_challenge(bytea, text, text, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_login_challenge(bytea, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_login_challenge(bytea, text, text, uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_login_challenge(bytea, uuid, uuid, text)
  TO service_role;

NOTIFY pgrst, 'reload schema';
