"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { requestOtp, verifyOtp } from "@/core/auth/actions";
import { requestOtpSchema, type RequestOtpInput } from "@/core/auth/schema";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { FormMessageI18n } from "@/components/ui/form-i18n";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const RESEND_COOLDOWN_SECONDS = 30;
const OTP_LENGTH = 6;

type ErrorKey = Parameters<ReturnType<typeof useTranslations<"errors">>>[0];

/**
 * ขั้น 1 ของ onboarding (Design §8.3): อีเมล → รหัส 6 หลัก auto-submit เมื่อครบ
 * ข้อความทั้งหมดจาก th.json; error จาก action เป็น key ใน errors.*
 */
export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const router = useRouter();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();
  const otpRef = useRef<HTMLInputElement>(null);

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
    if (step === "code") otpRef.current?.focus();
  }, [step]);

  const translateError = (key: string) => (te.has(key as ErrorKey) ? te(key as ErrorKey) : te("generic"));

  function sendCode(values: RequestOtpInput) {
    setServerError(null);
    startTransition(async () => {
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
    });
  }

  function submitCode(value: string) {
    if (pending || value.length !== OTP_LENGTH) return;
    setServerError(null);
    startTransition(async () => {
      const result = await verifyOtp({ email, token: value, next });
      if (!result.ok) {
        setServerError(result.error);
        setCode("");
        otpRef.current?.focus();
        return;
      }
      router.replace(result.data.next);
      router.refresh();
    });
  }

  if (step === "code") {
    return (
      <section aria-labelledby="otp-title" className="space-y-6">
        <div>
          <h1 id="otp-title" className="text-h1 text-text-primary">
            {t("codeTitle", { email })}
          </h1>
          <p className="mt-1 text-body text-text-secondary">{t("codeHint")}</p>
        </div>

        <div className="space-y-3">
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
            <InputOTPGroup className="gap-2">
              {Array.from({ length: OTP_LENGTH }, (_, i) => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  className="size-12 rounded-sm border text-h2 first:rounded-l-sm last:rounded-r-sm"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
          {serverError ? (
            <p role="alert" aria-live="polite" className="text-center text-small text-danger-800">
              {translateError(serverError)}
            </p>
          ) : null}
          {pending ? (
            <p className="text-center text-small text-text-muted" aria-live="polite">
              {t("verifying")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={cooldown > 0 || pending}
            onClick={() => sendCode({ email })}
          >
            {cooldown > 0 ? t("resendIn", { seconds: cooldown }) : t("resend")}
          </Button>
          <Button type="button" variant="link" onClick={() => setStep("email")} disabled={pending}>
            {t("changeEmail")}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="login-title" className="space-y-6">
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
                    className="h-12 text-body"
                    {...field}
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
            {pending ? t("sending") : t("sendCode")}
          </Button>
        </form>
      </Form>

      <p className="text-caption text-text-muted">{t("consent")}</p>
    </section>
  );
}
