// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  verifyLoginOtp: vi.fn(),
  requestRecoveryOtp: vi.fn(),
  completeRecoveryOtp: vi.fn(),
  resendEmailOtp: vi.fn(),
  startGoogleSignIn: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/core/auth/actions", () => ({
  signInWithPassword: mocks.signInWithPassword,
  verifyLoginOtp: mocks.verifyLoginOtp,
  requestRecoveryOtp: mocks.requestRecoveryOtp,
  completeRecoveryOtp: mocks.completeRecoveryOtp,
  resendEmailOtp: mocks.resendEmailOtp,
  startGoogleSignIn: mocks.startGoogleSignIn,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

vi.mock("@/components/i18n/LanguageSwitcher", () => ({ LanguageSwitcher: () => null }));

vi.mock("next-intl", () => {
  const translate = Object.assign((key: string) => key, { has: () => true });
  return { useTranslations: () => translate };
});

vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess } }));

import { LoginForm } from "./login-form";

const ASYNC_TIMEOUT_MS = 10_000;
const elementFromPointDescriptor = Object.getOwnPropertyDescriptor(document, "elementFromPoint");

Object.defineProperty(document, "elementFromPoint", {
  configurable: true,
  value: () => document.querySelector("[data-input-otp-container]"),
});

function fillCredentials(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("emailLabel"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("passwordLabel"), { target: { value: password } });
}

function clickSignIn() {
  fireEvent.click(screen.getByRole("button", { name: "signIn" }));
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
});

afterEach(() => vi.restoreAllMocks());

afterAll(() => {
  if (elementFromPointDescriptor) {
    Object.defineProperty(document, "elementFromPoint", elementFromPointDescriptor);
  } else {
    Reflect.deleteProperty(document, "elementFromPoint");
  }
});

describe("LoginForm", () => {
  it("renders the email-as-username password form and keeps the requested next route", () => {
    const next = "/goals?filter=week&sort=desc";
    render(<LoginForm next={next} />);

    expect(screen.getByRole("heading", { name: "title" })).toBeInTheDocument();
    expect(screen.getByLabelText("emailLabel")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("passwordLabel")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(screen.getByRole("button", { name: "forgotPassword" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "registerLink" })).toHaveAttribute(
      "href",
      `/register?next=${encodeURIComponent(next)}`,
    );
  });

  it("normalizes email before validation and allows existing short passwords", async () => {
    mocks.signInWithPassword.mockResolvedValue({ ok: false, error: "invalidCredentials" });
    render(<LoginForm />);
    fillCredentials("  MAY@EXAMPLE.COM  ", "old");
    clickSignIn();

    await waitFor(() =>
      expect(mocks.signInWithPassword).toHaveBeenCalledWith({
        email: "may@example.com",
        password: "old",
        next: undefined,
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("invalidCredentials");
    expect(mocks.verifyLoginOtp).not.toHaveBeenCalled();
  });

  it("does not start email OTP after a failed password check", async () => {
    mocks.signInWithPassword.mockResolvedValue({ ok: false, error: "invalidCredentials" });
    render(<LoginForm />);
    fillCredentials("person@example.com", "wrong-pass");
    clickSignIn();

    expect(await screen.findByRole("alert")).toHaveTextContent("invalidCredentials");
    expect(screen.queryByLabelText("codeLabel")).not.toBeInTheDocument();
    expect(mocks.verifyLoginOtp).not.toHaveBeenCalled();
  });

  it("moves to the OTP step only after password success and redirects after verification", async () => {
    const user = userEvent.setup();
    const next = "/today?source=login";
    mocks.signInWithPassword.mockResolvedValue({ ok: true, data: { mode: "challenge" } });
    mocks.verifyLoginOtp.mockResolvedValue({
      ok: true,
      data: { next: "/today", onboardingRequired: false },
    });
    render(<LoginForm next={next} />);
    fillCredentials("person@example.com", "correct-password");
    clickSignIn();

    const otpInput = await screen.findByLabelText("codeLabel", {}, { timeout: ASYNC_TIMEOUT_MS });
    await waitFor(() => expect(otpInput).toBeEnabled());
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "correct-password",
      next,
    });
    await user.type(otpInput, "123456");

    await waitFor(() =>
      expect(mocks.verifyLoginOtp).toHaveBeenCalledWith({
        email: "person@example.com",
        token: "123456",
        next,
      }),
    );
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/today"));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("uses a trusted-device password result without asking for OTP", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      ok: true,
      data: { mode: "authenticated", next: "/today", onboardingRequired: false },
    });
    render(<LoginForm />);
    fillCredentials("person@example.com", "correct-password");
    clickSignIn();

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/today"));
    expect(screen.queryByLabelText("codeLabel")).not.toBeInTheDocument();
    expect(mocks.verifyLoginOtp).not.toHaveBeenCalled();
  });

  it("allows a password reset without revealing whether the email is registered", async () => {
    mocks.requestRecoveryOtp.mockResolvedValue({ ok: true, data: { sent: true } });
    mocks.completeRecoveryOtp.mockResolvedValue({
      ok: true,
      data: { next: "/onboarding/persona", onboardingRequired: true },
    });
    render(<LoginForm />);
    fireEvent.click(screen.getByRole("button", { name: "forgotPassword" }));
    fireEvent.change(screen.getByLabelText("emailLabel"), {
      target: { value: "old-member@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "recoverySendCode" }));

    const otpInput = await screen.findByLabelText("codeLabel", {}, { timeout: ASYNC_TIMEOUT_MS });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("recoveryCodeSent");
    expect(mocks.requestRecoveryOtp).toHaveBeenCalledWith({ email: "old-member@example.com" });

    fireEvent.change(otpInput, { target: { value: "123456" } });
    fireEvent.change(screen.getByLabelText("newPasswordLabel"), {
      target: { value: "a-strong-password" },
    });
    fireEvent.change(screen.getByLabelText("confirmPasswordLabel"), {
      target: { value: "a-different-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "passwordSetupSubmit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("passwordMismatch");
    expect(mocks.completeRecoveryOtp).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("confirmPasswordLabel"), {
      target: { value: "a-strong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "passwordSetupSubmit" }));
    await waitFor(() =>
      expect(mocks.completeRecoveryOtp).toHaveBeenCalledWith({
        email: "old-member@example.com",
        token: "123456",
        password: "a-strong-password",
        confirmPassword: "a-strong-password",
        next: undefined,
      }),
    );
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/onboarding/persona"));
  });

  it("recovers cleanly from Google and network errors", async () => {
    mocks.startGoogleSignIn.mockRejectedValueOnce(new Error("network down"));
    render(<LoginForm />);
    fireEvent.click(screen.getByRole("button", { name: "googleSignIn" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("generic");
  });
});
