"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import {
  ArrowLeft,
  CalendarRange,
  CheckCircle2,
  HeartPulse,
  Target,
} from "@/components/icons/ui-icons";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { BrandLogo } from "@/components/BrandLogo";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { FormMessageI18n } from "@/components/ui/form-i18n";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  completeRecoveryOtp,
  resendEmailOtp,
  requestRecoveryOtp,
  signInWithPassword,
  startGoogleSignIn,
  verifyLoginOtp,
} from "@/core/auth/actions";
import {
  emailSchema,
  newPasswordSchema,
  passwordSignInSchema,
  type EmailInput,
  type PasswordSignInInput,
} from "@/core/auth/schema";

import styles from "./login-form.module.css";

const RESEND_COOLDOWN_SECONDS = 60;
const OTP_LENGTH = 6;
type LoginStep = "credentials" | "login-code" | "recovery-email" | "recovery-code";
type ErrorKey = Parameters<ReturnType<typeof useTranslations<"errors">>>[0];
type PendingAction = "signIn" | "verifyOtp" | "recovery" | "resend" | "google" | null;

export function LoginForm({ next, error: initialError }: { next?: string; error?: string }) {
  const t = useTranslations("auth");
  const ta = useTranslations("app");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const otherAuthHref = next ? `/register?next=${encodeURIComponent(next)}` : "/register";

  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(initialError ?? null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  const isSending = pending && (pendingAction === "recovery" || pendingAction === "resend");
  const isVerifying = pending && pendingAction === "verifyOtp";
  const isGooglePending = pending && pendingAction === "google";

  const signInForm = useForm<PasswordSignInInput>({
    resolver: zodResolver(passwordSignInSchema),
    defaultValues: { email: "", password: "", next },
  });
  const recoveryForm = useForm<EmailInput>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((remaining) => remaining - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    if ((step === "login-code" || step === "recovery-code") && !pending) otpRef.current?.focus();
  }, [pending, step]);

  const translateError = (key: string) =>
    te.has(key as ErrorKey) ? te(key as ErrorKey) : te("generic");

  function handleSignIn(values: PasswordSignInInput) {
    setServerError(null);
    setPendingAction("signIn");
    startTransition(async () => {
      try {
        const result = await signInWithPassword({ ...values, next });
        if (!result.ok) {
          setServerError(result.error);
          return;
        }
        if (result.data.mode === "challenge") {
          setEmail(values.email);
          setCode("");
          setStep("login-code");
          setCooldown(RESEND_COOLDOWN_SECONDS);
          toast.success(t("codeSent"));
          return;
        }
        router.replace(result.data.next);
        router.refresh();
      } catch {
        setServerError("generic");
      } finally {
        setPendingAction(null);
      }
    });
  }

  function submitLoginCode(value: string) {
    if (pending || value.length !== OTP_LENGTH) return;
    setServerError(null);
    setPendingAction("verifyOtp");
    startTransition(async () => {
      try {
        const result = await verifyLoginOtp({ email, token: value, next });
        if (!result.ok) {
          setServerError(result.error);
          setCode("");
          otpRef.current?.focus();
          return;
        }
        router.replace(result.data.next);
        router.refresh();
      } catch {
        setServerError("generic");
      } finally {
        setPendingAction(null);
      }
    });
  }

  function startRecovery(values: EmailInput) {
    setServerError(null);
    setPendingAction("recovery");
    startTransition(async () => {
      try {
        const result = await requestRecoveryOtp(values);
        if (!result.ok) {
          setServerError(result.error);
          return;
        }
        setEmail(values.email);
        setCode("");
        setNewPassword("");
        setConfirmPassword("");
        setStep("recovery-code");
        setCooldown(RESEND_COOLDOWN_SECONDS);
        toast.success(t("recoveryCodeSent"));
      } catch {
        setServerError("generic");
      } finally {
        setPendingAction(null);
      }
    });
  }

  function completeRecovery() {
    if (pending) return;
    if (code.length !== OTP_LENGTH) {
      setServerError("otpFormat");
      return;
    }
    const passwordValidation = newPasswordSchema.safeParse(newPassword);
    if (!passwordValidation.success) {
      setServerError(passwordValidation.error.issues[0]?.message ?? "passwordTooShort");
      return;
    }
    if (newPassword !== confirmPassword) {
      setServerError("passwordMismatch");
      return;
    }

    setServerError(null);
    setPendingAction("verifyOtp");
    startTransition(async () => {
      try {
        const result = await completeRecoveryOtp({
          email,
          token: code,
          password: newPassword,
          confirmPassword,
          next,
        });
        if (!result.ok) {
          setServerError(result.error);
          setCode("");
          otpRef.current?.focus();
          return;
        }
        router.replace(result.data.next);
        router.refresh();
      } catch {
        setServerError("generic");
      } finally {
        setPendingAction(null);
      }
    });
  }

  function resendCode(purpose: "login" | "recovery") {
    if (pending || cooldown > 0) return;
    setServerError(null);
    setPendingAction("resend");
    startTransition(async () => {
      try {
        const result = await resendEmailOtp({ email, purpose });
        if (!result.ok) {
          setServerError(result.error);
          return;
        }
        setCode("");
        setCooldown(RESEND_COOLDOWN_SECONDS);
        toast.success(t("codeSent"));
      } catch {
        setServerError("generic");
      } finally {
        setPendingAction(null);
      }
    });
  }

  function returnToCredentials() {
    if (pending) return;
    setServerError(null);
    setCode("");
    setStep("credentials");
  }

  function returnToRecoveryEmail() {
    if (pending) return;
    setServerError(null);
    setCode("");
    recoveryForm.setValue("email", email);
    setStep("recovery-email");
  }

  function signInWithGoogle() {
    setServerError(null);
    setPendingAction("google");
    startTransition(async () => {
      try {
        const result = await startGoogleSignIn({ next });
        if (!result.ok) {
          setServerError(result.error);
          return;
        }
        window.location.assign(result.data.url);
      } catch {
        setServerError("generic");
      } finally {
        setPendingAction(null);
      }
    });
  }

  const introduction = (
    <aside className={styles.introduction}>
      <div className={styles.introductionContent}>
        <div className={styles.brandHeader}>
          <div className={styles.brand} data-login-brand-mark>
            <BrandLogo transparent className={styles.brandLogo} />
            <p className={styles.brandName} data-login-brand-name>
              {ta("nameLatin")}
            </p>
          </div>
        </div>
        <p className={styles.brandTagline} data-login-brand-tagline>
          {ta("tagline")}
        </p>

        <div className={styles.hero}>
          <p className={styles.heroEyebrow}>{t("loginHeroEyebrow")}</p>
          <h2 className={styles.heroTitle} data-login-hero-title>
            <span>{t("loginHeroTitleStart")}</span>
            <span className={styles.heroTitleAccent}>{t("loginHeroTitleAccent")}</span>
          </h2>
          <p className={styles.heroDescription}>{t("loginIntroDescription")}</p>
          <p className={styles.heroSupport} data-login-hero-support>
            {t("loginHeroSupport")}
          </p>
        </div>

        <ul className={styles.benefitList} data-login-benefits>
          <li className={styles.benefit}>
            <span className={styles.benefitIcon}>
              <CalendarRange aria-hidden="true" />
            </span>
            <span>{t("loginBenefitPlan")}</span>
          </li>
          <li className={styles.benefit}>
            <span className={styles.benefitIcon}>
              <HeartPulse aria-hidden="true" />
            </span>
            <span>{t("loginBenefitWellbeing")}</span>
          </li>
          <li className={styles.benefit}>
            <span className={styles.benefitIcon}>
              <Target aria-hidden="true" />
            </span>
            <span>{t("loginBenefitGoals")}</span>
          </li>
          <li className={styles.benefit}>
            <span className={styles.benefitIcon}>
              <CheckCircle2 aria-hidden="true" />
            </span>
            <span>{t("loginBenefitProgress")}</span>
          </li>
        </ul>
      </div>

      <div className={styles.artwork} data-login-artwork aria-hidden="true">
        <span className={styles.artworkSun} />
        <span className={styles.artworkHillBack} />
        <span className={styles.artworkHillFront} />
      </div>
    </aside>
  );

  const loginCodeContent = (
    <section aria-labelledby="otp-title" className="space-y-6">
      <div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`${styles.backButton} -ml-3 text-brand-800`}
          aria-label={tc("back")}
          onClick={returnToCredentials}
          disabled={pending}
        >
          <ArrowLeft className="size-6" strokeWidth={1.5} aria-hidden="true" />
        </Button>
        <h1 id="otp-title" data-login-title className={styles.loginTitle}>
          {t("codeTitleShort")}
          <span className="mt-0.5 block text-h3 break-all text-text-secondary">{email}</span>
        </h1>
        <p id="login-otp-hint" data-login-subtitle className={`${styles.loginSubtitle} mt-2`}>
          {t("codeHint")}
        </p>
      </div>

      <div className="space-y-4">
        <InputOTP
          ref={otpRef}
          maxLength={OTP_LENGTH}
          value={code}
          onChange={setCode}
          onComplete={submitLoginCode}
          pushPasswordManagerStrategy="none"
          pattern={REGEXP_ONLY_DIGITS}
          inputMode="numeric"
          aria-label={t("codeLabel")}
          aria-invalid={serverError ? true : undefined}
          aria-describedby={serverError ? "login-otp-hint login-otp-error" : "login-otp-hint"}
          disabled={pending}
          containerClassName="justify-center"
        >
          <InputOTPGroup className="gap-1 sm:gap-2">
            {Array.from({ length: OTP_LENGTH }, (_, index) => (
              <InputOTPSlot key={index} index={index} className="h-12 text-h2" />
            ))}
          </InputOTPGroup>
        </InputOTP>
        {serverError ? (
          <p
            id="login-otp-error"
            role="alert"
            aria-live="polite"
            className="text-center text-small text-danger-800"
          >
            {translateError(serverError)}
          </p>
        ) : null}
        {isVerifying ? (
          <p className="text-center text-small text-text-muted" aria-live="polite">
            {t("verifying")}
          </p>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className={`${styles.secondaryButton} w-full disabled:text-text-secondary disabled:opacity-100`}
          disabled={cooldown > 0 || pending}
          onClick={() => resendCode("login")}
        >
          {isSending
            ? t("sending")
            : cooldown > 0
              ? t("resendIn", { seconds: cooldown })
              : t("resend")}
        </Button>
      </div>

      <div className="flex justify-center">
        <Button
          type="button"
          variant="link"
          className={styles.secondaryButton}
          onClick={returnToCredentials}
          disabled={pending}
        >
          {t("changeEmail")}
        </Button>
      </div>
    </section>
  );

  const recoveryCodeContent = (
    <section aria-labelledby="recovery-code-title" className="space-y-6">
      <div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`${styles.backButton} -ml-3 text-brand-800`}
          aria-label={tc("back")}
          onClick={returnToRecoveryEmail}
          disabled={pending}
        >
          <ArrowLeft className="size-6" strokeWidth={1.5} aria-hidden="true" />
        </Button>
        <h1 id="recovery-code-title" data-login-title className={styles.loginTitle}>
          {t("passwordSetupTitle")}
        </h1>
        <p className="mt-1 text-body break-all text-text-secondary">{email}</p>
        <p id="recovery-otp-hint" data-login-subtitle className={`${styles.loginSubtitle} mt-2`}>
          {t("passwordSetupHint")}
        </p>
      </div>

      <div className="space-y-4">
        <InputOTP
          ref={otpRef}
          maxLength={OTP_LENGTH}
          value={code}
          onChange={setCode}
          pushPasswordManagerStrategy="none"
          pattern={REGEXP_ONLY_DIGITS}
          inputMode="numeric"
          aria-label={t("codeLabel")}
          aria-invalid={
            serverError === "otpFormat" || serverError === "otpInvalid" ? true : undefined
          }
          aria-describedby={
            serverError ? "recovery-otp-hint recovery-otp-error" : "recovery-otp-hint"
          }
          disabled={pending}
          containerClassName="justify-center"
        >
          <InputOTPGroup className="gap-1 sm:gap-2">
            {Array.from({ length: OTP_LENGTH }, (_, index) => (
              <InputOTPSlot key={index} index={index} className="h-12 text-h2" />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <div>
          <label
            htmlFor="recovery-new-password"
            className="text-small font-medium text-text-primary"
          >
            {t("newPasswordLabel")}
          </label>
          <Input
            id="recovery-new-password"
            className={styles.emailInput}
            type={showNewPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            disabled={pending}
          />
          <Button
            type="button"
            variant="link"
            className={styles.passwordToggle}
            onClick={() => setShowNewPassword((visible) => !visible)}
          >
            {showNewPassword ? t("hidePassword") : t("showPassword")}
          </Button>
        </div>
        <div>
          <label
            htmlFor="recovery-confirm-password"
            className="text-small font-medium text-text-primary"
          >
            {t("confirmPasswordLabel")}
          </label>
          <Input
            id="recovery-confirm-password"
            className={styles.emailInput}
            type={showNewPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={pending}
          />
        </div>
        {serverError ? (
          <p
            id="recovery-otp-error"
            role="alert"
            aria-live="polite"
            className="text-center text-small text-danger-800"
          >
            {translateError(serverError)}
          </p>
        ) : null}
        <Button
          type="button"
          className={`${styles.primaryButton} w-full`}
          onClick={completeRecovery}
          disabled={pending}
        >
          {isVerifying ? t("passwordSaving") : t("passwordSetupSubmit")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={`${styles.secondaryButton} w-full disabled:text-text-secondary disabled:opacity-100`}
          disabled={cooldown > 0 || pending}
          onClick={() => resendCode("recovery")}
        >
          {isSending
            ? t("sending")
            : cooldown > 0
              ? t("resendIn", { seconds: cooldown })
              : t("resend")}
        </Button>
      </div>
    </section>
  );

  const credentialsContent = (
    <section aria-labelledby="login-title" className="space-y-6">
      <div>
        <h1 id="login-title" data-login-title className={styles.loginTitle}>
          {t("title")}
        </h1>
        <p data-login-subtitle className={`${styles.loginSubtitle} mt-2`}>
          {t("subtitle")}
        </p>
      </div>

      <Form {...signInForm}>
        <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-4" noValidate>
          <FormField
            control={signInForm.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel data-login-email-label>{t("emailLabel")}</FormLabel>
                <FormControl>
                  <Input
                    className={styles.emailInput}
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    placeholder={t("emailPlaceholder")}
                    {...field}
                    disabled={pending}
                  />
                </FormControl>
                <FormMessageI18n />
              </FormItem>
            )}
          />
          <FormField
            control={signInForm.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("passwordLabel")}</FormLabel>
                <FormControl>
                  <Input
                    className={styles.emailInput}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder={t("passwordPlaceholder")}
                    {...field}
                    disabled={pending}
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="link"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? t("hidePassword") : t("showPassword")}
                </Button>
                <FormMessageI18n />
              </FormItem>
            )}
          />
          {serverError ? (
            <p role="alert" aria-live="polite" className="text-small text-danger-800">
              {translateError(serverError)}
            </p>
          ) : null}
          <Button
            type="submit"
            size="lg"
            className={`${styles.primaryButton} w-full`}
            disabled={pending}
          >
            {pendingAction === "signIn" ? t("signingIn") : t("signIn")}
          </Button>
        </form>
      </Form>

      <div className="flex justify-center">
        <Button
          type="button"
          variant="link"
          className={styles.secondaryButton}
          onClick={() => {
            setServerError(null);
            recoveryForm.setValue("email", signInForm.getValues("email"));
            setStep("recovery-email");
          }}
          disabled={pending}
        >
          {t("forgotPassword")}
        </Button>
      </div>

      <div className="space-y-5">
        <div className="flex items-center gap-3 text-caption text-text-muted">
          <span className="h-px flex-1 bg-border" />
          <span>{t("or")}</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className={`${styles.googleButton} w-full`}
          onClick={signInWithGoogle}
          disabled={pending}
        >
          <span aria-hidden="true" className="font-semibold text-accent-700">
            G
          </span>
          {isGooglePending ? t("googleSigningIn") : t("googleSignIn")}
        </Button>
      </div>

      <p
        data-login-metadata
        className={`${styles.metadata} text-center text-caption text-text-muted`}
      >
        {t("consent")}
      </p>
      <p className={`${styles.registerPrompt} text-caption text-text-secondary`}>
        <span>{t("noAccount")} </span>
        {pending ? (
          <span
            aria-disabled="true"
            className={`${styles.registerLink} font-medium text-text-muted`}
          >
            {t("registerLink")}
          </span>
        ) : (
          <Link
            href={otherAuthHref}
            className={`${styles.registerLink} font-medium text-brand-700 underline underline-offset-4`}
          >
            {t("registerLink")}
          </Link>
        )}
      </p>
    </section>
  );

  const recoveryEmailContent = (
    <section aria-labelledby="recovery-title" className="space-y-6">
      <div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`${styles.backButton} -ml-3 text-brand-800`}
          aria-label={tc("back")}
          onClick={returnToCredentials}
          disabled={pending}
        >
          <ArrowLeft className="size-6" strokeWidth={1.5} aria-hidden="true" />
        </Button>
        <h1 id="recovery-title" data-login-title className={styles.loginTitle}>
          {t("recoveryTitle")}
        </h1>
        <p data-login-subtitle className={`${styles.loginSubtitle} mt-2`}>
          {t("recoveryDescription")}
        </p>
      </div>
      <Form {...recoveryForm}>
        <form onSubmit={recoveryForm.handleSubmit(startRecovery)} className="space-y-4" noValidate>
          <FormField
            control={recoveryForm.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("emailLabel")}</FormLabel>
                <FormControl>
                  <Input
                    className={styles.emailInput}
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    placeholder={t("emailPlaceholder")}
                    {...field}
                    disabled={pending}
                  />
                </FormControl>
                <FormMessageI18n />
              </FormItem>
            )}
          />
          {serverError ? (
            <p role="alert" aria-live="polite" className="text-small text-danger-800">
              {translateError(serverError)}
            </p>
          ) : null}
          <Button
            type="submit"
            size="lg"
            className={`${styles.primaryButton} w-full`}
            disabled={pending}
          >
            {isSending ? t("sending") : t("recoverySendCode")}
          </Button>
        </form>
      </Form>
    </section>
  );

  return (
    <div data-login-page className={styles.page}>
      <div data-login-language-control className={styles.languageControl}>
        <LanguageSwitcher compact />
      </div>
      {introduction}
      <div data-login-card className={styles.formPanel}>
        {step === "credentials"
          ? credentialsContent
          : step === "login-code"
            ? loginCodeContent
            : step === "recovery-email"
              ? recoveryEmailContent
              : recoveryCodeContent}
      </div>
    </div>
  );
}
