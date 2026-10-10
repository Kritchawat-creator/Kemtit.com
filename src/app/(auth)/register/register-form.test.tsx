// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestRegistrationOtp: vi.fn(),
  completeRegistrationOtp: vi.fn(),
  resendEmailOtp: vi.fn(),
  startGoogleSignIn: vi.fn(),
  updateDisplayName: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/core/auth/actions", () => ({
  requestRegistrationOtp: mocks.requestRegistrationOtp,
  completeRegistrationOtp: mocks.completeRegistrationOtp,
  resendEmailOtp: mocks.resendEmailOtp,
  startGoogleSignIn: mocks.startGoogleSignIn,
}));
vi.mock("@/core/profile/actions", () => ({ updateDisplayName: mocks.updateDisplayName }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("next-intl", () => {
  const translate = Object.assign((key: string) => key, { has: () => true });
  return { useTranslations: () => translate };
});

import { RegisterForm } from "./register-form";

const elementFromPointDescriptor = Object.getOwnPropertyDescriptor(document, "elementFromPoint");
Object.defineProperty(document, "elementFromPoint", {
  configurable: true,
  value: () => document.querySelector("[data-input-otp-container]"),
});

function fillRegistration(
  input: {
    displayName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  } = {},
) {
  fireEvent.change(screen.getByLabelText("registerNameLabel"), {
    target: { value: input.displayName ?? "May" },
  });
  fireEvent.change(screen.getByLabelText("emailLabel"), {
    target: { value: input.email ?? "may@example.com" },
  });
  fireEvent.change(screen.getByLabelText("passwordLabel"), {
    target: { value: input.password ?? "Strong-password-1" },
  });
  fireEvent.change(screen.getByLabelText("confirmPasswordLabel"), {
    target: { value: input.confirmPassword ?? input.password ?? "Strong-password-1" },
  });
}

beforeEach(() => Object.values(mocks).forEach((mock) => mock.mockReset()));
afterEach(() => vi.restoreAllMocks());
afterAll(() => {
  if (elementFromPointDescriptor) {
    Object.defineProperty(document, "elementFromPoint", elementFromPointDescriptor);
  } else {
    Reflect.deleteProperty(document, "elementFromPoint");
  }
});

describe("RegisterForm", () => {
  it("requires a valid email, display name, and matching new password before sending a code", async () => {
    render(<RegisterForm />);
    fillRegistration({ email: "not-an-email" });
    fireEvent.click(screen.getByRole("button", { name: "registerSendCode" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("invalidEmail");
    expect(mocks.requestRegistrationOtp).not.toHaveBeenCalled();

    fillRegistration({ password: "short", confirmPassword: "short" });
    fireEvent.click(screen.getByRole("button", { name: "registerSendCode" }));
    expect(await screen.findByText("passwordTooShort")).toBeInTheDocument();
    expect(mocks.requestRegistrationOtp).not.toHaveBeenCalled();

    fillRegistration({ confirmPassword: "different-password" });
    fireEvent.click(screen.getByRole("button", { name: "registerSendCode" }));
    expect(await screen.findByText("passwordMismatch")).toBeInTheDocument();
    expect(mocks.requestRegistrationOtp).not.toHaveBeenCalled();
  });

  it("keeps the new password only in memory until email verification, then saves the name", async () => {
    const user = userEvent.setup();
    mocks.requestRegistrationOtp.mockResolvedValue({ ok: true, data: { sent: true } });
    mocks.completeRegistrationOtp.mockResolvedValue({
      ok: true,
      data: { next: "/onboarding/persona", onboardingRequired: true },
    });
    mocks.updateDisplayName.mockResolvedValue({ ok: true, data: null });
    const next = "/today?from=register";
    render(<RegisterForm next={next} />);
    fillRegistration({ displayName: "May L.", email: " MAY@EXAMPLE.COM " });
    fireEvent.click(screen.getByRole("button", { name: "registerSendCode" }));

    const otpInput = await screen.findByLabelText("codeLabel");
    await waitFor(() => expect(otpInput).toBeEnabled());
    expect(mocks.requestRegistrationOtp).toHaveBeenCalledWith({ email: "may@example.com" });
    expect(screen.queryByLabelText("passwordLabel")).not.toBeInTheDocument();
    await user.type(otpInput, "123456");

    await waitFor(() =>
      expect(mocks.completeRegistrationOtp).toHaveBeenCalledWith({
        email: "may@example.com",
        token: "123456",
        password: "Strong-password-1",
        confirmPassword: "Strong-password-1",
        next,
      }),
    );
    await waitFor(() =>
      expect(mocks.updateDisplayName).toHaveBeenCalledWith({ displayName: "May L." }),
    );
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/onboarding/persona"));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("reuses the eligible signup challenge when details are edited for the same email", async () => {
    const user = userEvent.setup();
    mocks.requestRegistrationOtp.mockResolvedValue({ ok: true, data: { sent: true } });
    mocks.completeRegistrationOtp.mockResolvedValue({
      ok: true,
      data: { next: "/onboarding/persona", onboardingRequired: true },
    });
    mocks.updateDisplayName.mockResolvedValue({ ok: true, data: null });
    render(<RegisterForm />);
    fillRegistration({ email: "same@example.com" });
    fireEvent.click(screen.getByRole("button", { name: "registerSendCode" }));

    const otpInput = await screen.findByLabelText("codeLabel");
    await waitFor(() => expect(otpInput).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "changeEmail" }));
    fillRegistration({
      displayName: "Updated name",
      email: "same@example.com",
      password: "updated-password",
      confirmPassword: "updated-password",
    });
    fireEvent.click(screen.getByRole("button", { name: "registerSendCode" }));

    await waitFor(() => expect(screen.getByLabelText("codeLabel")).toBeEnabled());
    expect(mocks.requestRegistrationOtp).toHaveBeenCalledOnce();
    await user.type(screen.getByLabelText("codeLabel"), "123456");
    await waitFor(() =>
      expect(mocks.completeRegistrationOtp).toHaveBeenCalledWith({
        email: "same@example.com",
        token: "123456",
        password: "updated-password",
        confirmPassword: "updated-password",
        next: undefined,
      }),
    );
    await waitFor(() =>
      expect(mocks.updateDisplayName).toHaveBeenCalledWith({ displayName: "Updated name" }),
    );
  });

  it("allows a failed display-name save to be retried without verifying OTP again", async () => {
    const user = userEvent.setup();
    mocks.requestRegistrationOtp.mockResolvedValue({ ok: true, data: { sent: true } });
    mocks.completeRegistrationOtp.mockResolvedValue({
      ok: true,
      data: { next: "/onboarding/persona", onboardingRequired: true },
    });
    mocks.updateDisplayName
      .mockResolvedValueOnce({ ok: false, error: "generic" })
      .mockResolvedValueOnce({ ok: true, data: null });
    render(<RegisterForm />);
    fillRegistration();
    fireEvent.click(screen.getByRole("button", { name: "registerSendCode" }));
    const otpInput = await screen.findByLabelText("codeLabel");
    await waitFor(() => expect(otpInput).toBeEnabled());
    await user.type(otpInput, "123456");

    await screen.findByRole("heading", { name: "registerSaveFailureTitle" });
    fireEvent.click(screen.getByRole("button", { name: "registerRetrySave" }));
    await waitFor(() => expect(mocks.updateDisplayName).toHaveBeenCalledTimes(2));
    expect(mocks.completeRegistrationOtp).toHaveBeenCalledOnce();
    expect(mocks.replace).toHaveBeenCalledWith("/onboarding/persona");
  });

  it("shows server-side OTP errors and supports a server-throttled resend", async () => {
    const user = userEvent.setup();
    mocks.requestRegistrationOtp.mockResolvedValue({ ok: true, data: { sent: true } });
    mocks.completeRegistrationOtp.mockResolvedValue({ ok: false, error: "otpInvalid" });
    mocks.resendEmailOtp.mockResolvedValue({ ok: false, error: "otpRateLimited" });
    render(<RegisterForm />);
    fillRegistration();
    fireEvent.click(screen.getByRole("button", { name: "registerSendCode" }));
    const otpInput = await screen.findByLabelText("codeLabel");
    await waitFor(() => expect(otpInput).toBeEnabled());
    await user.type(otpInput, "123456");

    expect(await screen.findByRole("alert")).toHaveTextContent("otpInvalid");
    expect(mocks.updateDisplayName).not.toHaveBeenCalled();
    expect(mocks.resendEmailOtp).not.toHaveBeenCalled();
  });

  it("keeps safe next on the login link and preserves Google sign-in behavior", async () => {
    const next = "/today?source=register&view=focus";
    mocks.startGoogleSignIn.mockResolvedValue({ ok: false, error: "googleAuthFailed" });
    render(<RegisterForm next={next} />);

    expect(screen.getByRole("link", { name: "signInLink" })).toHaveAttribute(
      "href",
      `/login?next=${encodeURIComponent(next)}`,
    );
    fireEvent.click(screen.getByRole("button", { name: "registerGoogleSignIn" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("googleAuthFailed");
  });
});
