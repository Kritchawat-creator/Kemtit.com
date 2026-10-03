"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { ArrowLeft, Compass } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { requestOtp, startGoogleSignIn, verifyOtp } from "@/core/auth/actions";
import { requestOtpSchema } from "@/core/auth/schema";
import { updateDisplayName } from "@/core/profile/actions";
import { updateDisplayNameSchema } from "@/core/profile/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { FormMessageI18n } from "@/components/ui/form-i18n";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const RESEND_COOLDOWN_SECONDS = 60;
const OTP_LENGTH = 6;

const registrationDetailsSchema = z.object({
  displayName: updateDisplayNameSchema.shape.displayName,
  email: requestOtpSchema.shape.email,
});

type RegistrationDetails = z.infer<typeof registrationDetailsSchema>;
type ErrorKey = Parameters<ReturnType<typeof useTranslations<"errors">>>[0];
type RegisterStep = "details" | "code" | "save";
type PendingAction = "sendOtp" | "verifyOtp" | "google" | "saveName" | null;

/** สมัครสมาชิกด้วยชื่อที่แสดงและอีเมล จากนั้นยืนยัน OTP ก่อนบันทึกโปรไฟล์ */
export function RegisterForm({ next, error: initialError }: { next?: string; error?: string }) {
  const t = useTranslations("auth");
  const ta = useTranslations("app");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const signInHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  const [step, setStep] = useState<RegisterStep>("details");
  const [registration, setRegistration] = useState<RegistrationDetails | null>(null);
  const [verifiedNext, setVerifiedNext] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [serverError, setServerError] = useState<string | null>(initialError ?? null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  const isSendingOtp = pending && pendingAction === "sendOtp";
  const isVerifyingOtp = pending && pendingAction === "verifyOtp";
  const isGooglePending = pending && pendingAction === "google";
  const isSavingName = pending && pendingAction === "saveName";
  const activeStep = step === "details" ? 0 : step === "code" ? 1 : 2;

  const form = useForm<RegistrationDetails>({
    resolver: zodResolver(registrationDetailsSchema),
    defaultValues: { displayName: "", email: "" },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((remaining) => remaining - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code" && !pending) otpRef.current?.focus();
  }, [pending, step]);

  const translateError = (key: string) =>
    te.has(key as ErrorKey) ? te(key as ErrorKey) : te("generic");

  function sendCode(values: RegistrationDetails) {
    setServerError(null);
    setPendingAction("sendOtp");
    startTransition(async () => {
      try {
        const result = await requestOtp({ email: values.email });
        if (!result.ok) {
          setServerError(result.error);
          return;
        }
        setRegistration(values);
        setCode("");
        setStep("code");
        setCooldown(RESEND_COOLDOWN_SECONDS);
      } finally {
        setPendingAction(null);
      }
    });
  }

  async function saveVerifiedName(nextRoute: string, displayName: string) {
    setPendingAction("saveName");
    try {
      const result = await updateDisplayName({ displayName });
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      router.replace(nextRoute);
      router.refresh();
    } catch {
      setServerError("generic");
    } finally {
      setPendingAction(null);
    }
  }

  function submitCode(value: string) {
    if (pending || value.length !== OTP_LENGTH || !registration) return;
    setServerError(null);
    setPendingAction("verifyOtp");
    startTransition(async () => {
      try {
        const result = await verifyOtp({ email: registration.email, token: value, next });
        if (!result.ok) {
          setServerError(result.error);
          setCode("");
          otpRef.current?.focus();
          return;
        }

        if (result.data.onboardingRequired) {
          setVerifiedNext(result.data.next);
          setStep("save");
          await saveVerifiedName(result.data.next, registration.displayName);
          return;
        }

        router.replace(result.data.next);
        router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  function retrySaveName() {
    if (!verifiedNext || !registration || pending) return;
    setServerError(null);
    startTransition(async () => {
      await saveVerifiedName(verifiedNext, registration.displayName);
    });
  }

  function returnToDetails() {
    if (pending || !registration) return;
    setServerError(null);
    setCode("");
    form.reset(registration);
    setStep("details");
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

  const steps = [t("registerStepDetails"), t("registerStepEmail"), t("registerStepPlanning")];

  const detailsContent = (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(sendCode)} className="space-y-5" noValidate>
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("registerNameLabel")}</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    autoComplete="nickname"
                    placeholder={t("registerNamePlaceholder")}
                    {...field}
                    disabled={pending}
                  />
                </FormControl>
                <FormDescription className="text-small text-text-muted">
                  {t("registerNameHint")}
                </FormDescription>
                <FormMessageI18n />
              </FormItem>
            )}
          />

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
                <FormDescription className="text-small text-text-muted">
                  {t("registerEmailHint")}
                </FormDescription>
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
            {isSendingOtp ? t("sending") : t("registerSendCode")}
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
          {isGooglePending ? t("googleSigningIn") : t("registerGoogleSignIn")}
        </Button>
      </div>
    </div>
  );

  const codeContent = (
    <section aria-labelledby="register-otp-title" className="space-y-5">
      <div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-ml-3 text-brand-800"
          aria-label={tc("back")}
          onClick={returnToDetails}
          disabled={pending}
        >
          <ArrowLeft className="size-6" strokeWidth={1.5} aria-hidden="true" />
        </Button>
        <h2 id="register-otp-title" className="mt-1 text-h2 text-text-primary">
          {t("registerCodeTitle")}
        </h2>
        <p className="mt-1 text-body text-text-secondary">{t("registerCodeRecipient")}</p>
        <p className="text-h3 break-all text-text-secondary">{registration?.email}</p>
        <p className="mt-1 text-body text-text-secondary">{t("registerCodeHint")}</p>
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
            {Array.from({ length: OTP_LENGTH }, (_, index) => (
              <InputOTPSlot key={index} index={index} className="h-12 text-h2" />
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
          onClick={() => registration && sendCode(registration)}
        >
          {isSendingOtp
            ? t("sending")
            : cooldown > 0
              ? t("resendIn", { seconds: cooldown })
              : t("resend")}
        </Button>
      </div>

      <div className="flex justify-center">
        <Button type="button" variant="link" onClick={returnToDetails} disabled={pending}>
          {t("changeEmail")}
        </Button>
      </div>
      <p className="text-center text-small text-text-muted">{t("registerOnboardingHint")}</p>
    </section>
  );

  const saveContent = (
    <section aria-labelledby="register-save-title" className="space-y-4">
      <h2 id="register-save-title" className="text-h2 text-text-primary">
        {serverError ? t("registerSaveFailureTitle") : t("registerSavingTitle")}
      </h2>
      <p className="text-body text-text-secondary">
        {serverError ? t("registerSaveFailureDescription") : t("registerSavingDescription")}
      </p>
      {serverError ? (
        <p role="alert" aria-live="polite" className="text-small text-danger-800">
          {translateError(serverError)}
        </p>
      ) : null}
      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={retrySaveName}
        disabled={pending || !verifiedNext || !registration}
      >
        {isSavingName ? t("registerSavingName") : t("registerRetrySave")}
      </Button>
    </section>
  );

  return (
    <div data-register-page className="w-full min-w-0">
      <section className="overflow-hidden rounded-2xl border border-border bg-bg-surface shadow-md">
        <header className="border-b border-border bg-bg-subtle px-4 py-5 sm:px-8 sm:py-7">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-neutral-0 shadow-xs">
              <Compass className="size-5" strokeWidth={1.6} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-h3 text-brand-800">{ta("nameLatin")}</p>
              <p className="text-small text-text-secondary">{t("registerWelcome")}</p>
            </div>
          </div>
          <div className="mt-5 space-y-1 sm:mt-6">
            <h1 className="text-h1 text-text-primary">{t("registerTitle")}</h1>
            <p className="max-w-2xl text-body text-text-secondary">
              {t("registerIntroDescription")}
            </p>
          </div>
          <ol aria-label={t("registerStepsLabel")} className="mt-6 grid grid-cols-3 gap-2 sm:gap-4">
            {steps.map((label, index) => (
              <li
                key={label}
                aria-current={activeStep === index ? "step" : undefined}
                className="min-w-0"
              >
                <div className="flex min-h-10 items-center gap-1.5 sm:gap-2">
                  <span
                    aria-hidden="true"
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-caption font-semibold ${
                      activeStep >= index
                        ? "bg-brand-500 text-neutral-0"
                        : "bg-brand-100 text-brand-700"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={`min-w-0 text-caption leading-snug ${
                      activeStep === index ? "font-semibold text-text-primary" : "text-text-muted"
                    }`}
                  >
                    {label}
                  </span>
                </div>
                <span
                  aria-hidden="true"
                  className={`mt-1 block h-1 rounded-full ${
                    activeStep >= index ? "bg-brand-400" : "bg-neutral-200"
                  }`}
                />
              </li>
            ))}
          </ol>
        </header>

        <div className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
          {step === "details" ? detailsContent : step === "code" ? codeContent : saveContent}
        </div>

        {step === "details" ? (
          <footer className="border-t border-border px-4 py-4 text-center text-caption text-text-secondary sm:px-8">
            <span>{t("haveAccount")} </span>
            {pending ? (
              <span aria-disabled="true" className="font-medium text-text-muted">
                {t("signInLink")}
              </span>
            ) : (
              <Link
                href={signInHref}
                className="font-medium text-brand-700 underline underline-offset-4"
              >
                {t("signInLink")}
              </Link>
            )}
          </footer>
        ) : null}
      </section>
    </div>
  );
}
