"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { ArrowLeft, Compass } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { requestOtp, startGoogleSignIn, verifyOtp } from "@/core/auth/actions";
import { requestOtpSchema, type RequestOtpInput } from "@/core/auth/schema";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { FormMessageI18n } from "@/components/ui/form-i18n";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

// เท่ากับ minimum interval ของ Supabase Auth (60 วิ) — ถ้าสั้นกว่านี้ user จะเจอ 429 "ขอรหัสบ่อยเกินไป"
const RESEND_COOLDOWN_SECONDS = 60;
const OTP_LENGTH = 6;

type ErrorKey = Parameters<ReturnType<typeof useTranslations<"errors">>>[0];
type PendingAction = "sendOtp" | "verifyOtp" | "google" | null;

/** ขั้นเข้าสู่ระบบ: อีเมล → รหัส 6 หลัก auto-submit เมื่อครบ */
export function LoginForm({ next, error: initialError }: { next?: string; error?: string }) {
  const t = useTranslations("auth");
  const ta = useTranslations("app");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const otherAuthHref = next ? `/register?next=${encodeURIComponent(next)}` : "/register";

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [serverError, setServerError] = useState<string | null>(initialError ?? null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  const isSendingOtp = pending && pendingAction === "sendOtp";
  const isVerifyingOtp = pending && pendingAction === "verifyOtp";
  const isGooglePending = pending && pendingAction === "google";

  const form = useForm<RequestOtpInput>({
    resolver: zodResolver(requestOtpSchema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code" && !pending) otpRef.current?.focus();
  }, [pending, step]);

  const translateError = (key: string) =>
    te.has(key as ErrorKey) ? te(key as ErrorKey) : te("generic");

  function sendCode(values: RequestOtpInput) {
    setServerError(null);
    setPendingAction("sendOtp");
    startTransition(async () => {
      try {
        const result = await requestOtp(values);
        if (!result.ok) {
          setServerError(result.error);
          return;
        }
        setEmail(values.email);
        setCode("");
        setStep("code");
        setCooldown(RESEND_COOLDOWN_SECONDS);
        toast.success(t("codeSent"));
      } finally {
        setPendingAction(null);
      }
    });
  }

  function submitCode(value: string) {
    if (pending || value.length !== OTP_LENGTH) return;
    setServerError(null);
    setPendingAction("verifyOtp");
    startTransition(async () => {
      try {
        const result = await verifyOtp({ email, token: value, next });
        if (!result.ok) {
          setServerError(result.error);
          setCode("");
          otpRef.current?.focus();
          return;
        }
        router.replace(result.data.next);
        router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  function returnToEmail() {
    setServerError(null);
    setCode("");
    setStep("email");
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
      } finally {
        setPendingAction(null);
      }
    });
  }

  const introduction = (
    <aside className="flex min-w-0 flex-col justify-between gap-5 border-b border-brand-100 bg-brand-50 p-4 sm:p-6 md:min-h-[32rem] md:border-r md:border-b-0 md:p-8">
      <div>
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-neutral-0 shadow-xs">
            <Compass className="size-6" strokeWidth={1.6} aria-hidden="true" />
          </span>
          <p className="min-w-0 text-h2 text-brand-800">{ta("nameLatin")}</p>
        </div>

        <div className="mt-5 space-y-2 sm:mt-7">
          <h2 className="text-h2 text-text-primary md:text-h1">{t("loginIntroTitle")}</h2>
          <p className="max-w-md text-body text-text-secondary">{t("loginIntroDescription")}</p>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="hidden rounded-xl border border-brand-100 bg-bg-surface p-4 shadow-xs sm:block"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="h-2.5 w-28 rounded-full bg-brand-200" />
          <span className="size-7 rounded-lg bg-brand-50" />
        </div>
        <div className="mt-4 grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-3">
          <div className="space-y-3 rounded-xl bg-bg-subtle p-3">
            <span className="block h-2.5 w-2/3 rounded-full bg-brand-200" />
            <span className="block h-2 w-full rounded-full bg-neutral-200" />
            <span className="block h-2 w-4/5 rounded-full bg-neutral-200" />
          </div>
          <div className="flex flex-col justify-between rounded-xl bg-brand-50 p-3">
            <span className="size-6 rounded-lg bg-brand-100" />
            <div className="space-y-2">
              <span className="block h-2 w-full rounded-full bg-brand-200" />
              <span className="block h-2 w-2/3 rounded-full bg-brand-100" />
            </div>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <span className="block h-full w-3/5 rounded-full bg-brand-300" />
        </div>
      </div>
    </aside>
  );

  const loginContent =
    step === "code" ? (
      <section aria-labelledby="otp-title" className="space-y-5">
        <div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-ml-3 text-brand-800"
            aria-label={tc("back")}
            onClick={returnToEmail}
            disabled={pending}
          >
            <ArrowLeft className="size-6" strokeWidth={1.5} aria-hidden="true" />
          </Button>
          <h1 id="otp-title" className="mt-1 text-h1 text-text-primary">
            {t("codeTitleShort")}
            <span className="mt-0.5 block text-h3 break-all text-text-secondary">{email}</span>
          </h1>
          <p className="mt-1 text-body text-text-secondary">{t("codeHint")}</p>
        </div>

        <div className="space-y-4">
          <InputOTP
            ref={otpRef}
            maxLength={OTP_LENGTH}
            value={code}
            onChange={setCode}
            onComplete={submitCode}
            pattern={REGEXP_ONLY_DIGITS}
            inputMode="numeric"
            aria-label={t("codeLabel")}
            aria-invalid={serverError ? true : undefined}
            disabled={pending}
            containerClassName="justify-center"
          >
            <InputOTPGroup className="gap-1 sm:gap-2">
              {Array.from({ length: OTP_LENGTH }, (_, i) => (
                <InputOTPSlot key={i} index={i} className="h-12 text-h2" />
              ))}
            </InputOTPGroup>
          </InputOTP>
          {serverError ? (
            <p role="alert" aria-live="polite" className="text-center text-small text-danger-800">
              {translateError(serverError)}
            </p>
          ) : null}
          {isVerifyingOtp ? (
            <p className="text-center text-small text-text-muted" aria-live="polite">
              {t("verifying")}
            </p>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="w-full disabled:text-text-secondary disabled:opacity-100"
            disabled={cooldown > 0 || pending}
            onClick={() => sendCode({ email })}
          >
            {isSendingOtp
              ? t("sending")
              : cooldown > 0
                ? t("resendIn", { seconds: cooldown })
                : t("resend")}
          </Button>
        </div>

        <div className="flex justify-center">
          <Button type="button" variant="link" onClick={returnToEmail} disabled={pending}>
            {t("changeEmail")}
          </Button>
        </div>
      </section>
    ) : (
      <section aria-labelledby="login-title" className="space-y-5">
        <div>
          <h1 id="login-title" className="text-h1 text-text-primary">
            {t("title")}
          </h1>
          <p className="mt-1 text-body text-text-secondary">{t("subtitle")}</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(sendCode)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("emailLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
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
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {isSendingOtp ? t("sending") : t("sendCode")}
            </Button>
          </form>
        </Form>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-caption text-text-muted">
            <span className="h-px flex-1 bg-border" />
            <span>{t("or")}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="w-full"
            onClick={signInWithGoogle}
            disabled={pending}
          >
            <span aria-hidden="true" className="font-semibold text-accent-700">
              G
            </span>
            {isGooglePending ? t("googleSigningIn") : t("googleSignIn")}
          </Button>
        </div>

        <p className="text-center text-caption text-text-muted">{t("consent")}</p>
        <p className="text-center text-caption text-text-secondary">
          <span>{t("noAccount")} </span>
          {pending ? (
            <span aria-disabled="true" className="font-medium text-text-muted">
              {t("registerLink")}
            </span>
          ) : (
            <Link
              href={otherAuthHref}
              className="font-medium text-brand-700 underline underline-offset-4"
            >
              {t("registerLink")}
            </Link>
          )}
        </p>
      </section>
    );

  return (
    <div
      data-login-page
      className="grid min-w-0 grid-cols-1 overflow-hidden rounded-2xl border border-border bg-bg-surface shadow-md md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
    >
      {introduction}
      <div className="min-w-0 p-4 sm:p-6 md:p-8">{loginContent}</div>
    </div>
  );
}
