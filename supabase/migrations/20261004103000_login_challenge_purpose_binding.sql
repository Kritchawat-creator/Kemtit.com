-- Bind attempt/resend reservations to the email and purpose originally
-- challenged, and prevent the signup challenge from resetting an old account.

DROP FUNCTION public.reserve_login_challenge_attempt(bytea);
DROP FUNCTION public.reserve_login_challenge_resend(bytea);

CREATE OR REPLACE FUNCTION public.reserve_login_challenge_attempt(
  p_token_hash bytea,
  p_email text,
  p_purpose text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_attempt_count integer;
  v_email_hash bytea;
BEGIN
  IF p_token_hash IS NULL
    OR pg_catalog.octet_length(p_token_hash) <> 32
    OR p_purpose IS NULL
    OR p_purpose NOT IN ('login', 'signup', 'recovery') THEN
    RETURN 0;
  END IF;

  v_email_hash := private.login_email_hmac(p_email);
  IF v_email_hash IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE private.login_challenges AS c
  SET attempt_count = c.attempt_count + 1
  WHERE c.token_hash = p_token_hash
    AND c.email_hash = v_email_hash
    AND c.purpose = p_purpose
    AND c.consumed_at IS NULL
    AND c.expires_at > pg_catalog.clock_timestamp()
    AND c.attempt_count < 5
  RETURNING c.attempt_count INTO v_attempt_count;

  RETURN COALESCE(v_attempt_count, 0);
END
$function$;

CREATE OR REPLACE FUNCTION public.reserve_login_challenge_resend(
  p_token_hash bytea,
  p_email text,
  p_purpose text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_email_hash bytea;
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

  UPDATE private.login_challenges AS c
  SET last_sent_at = pg_catalog.clock_timestamp()
  WHERE c.token_hash = p_token_hash
    AND c.email_hash = v_email_hash
    AND c.purpose = p_purpose
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

  IF v_challenge.purpose = 'signup' AND NOT EXISTS (
    SELECT 1
    FROM auth.users AS u
    WHERE u.id = p_user_id
      AND private.login_email_hmac(u.email) = v_challenge.email_hash
      AND u.email_confirmed_at IS NOT NULL
      AND COALESCE(u.encrypted_password, '') = ''
      AND u.created_at >= v_challenge.created_at - INTERVAL '10 minutes'
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

REVOKE ALL ON FUNCTION public.reserve_login_challenge_attempt(bytea, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_login_challenge_resend(bytea, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_login_challenge(bytea, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_login_challenge_attempt(bytea, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_login_challenge_resend(bytea, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_login_challenge(bytea, uuid, uuid, text)
  TO service_role;

NOTIFY pgrst, 'reload schema';
