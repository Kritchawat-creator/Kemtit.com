// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestOtp: vi.fn(),
  startGoogleSignIn: vi.fn(),
  verifyOtp: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/core/auth/actions", () => ({
  requestOtp: mocks.requestOtp,
  startGoogleSignIn: mocks.startGoogleSignIn,
  verifyOtp: mocks.verifyOtp,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

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

function fillEmail(email: string) {
  fireEvent.change(screen.getByLabelText("emailLabel"), { target: { value: email } });
}

function clickSendCode() {
  fireEvent.click(screen.getByRole("button", { name: "sendCode" }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

beforeEach(() => {
  mocks.requestOtp.mockReset();
  mocks.startGoogleSignIn.mockReset();
  mocks.verifyOtp.mockReset();
  mocks.replace.mockReset();
  mocks.refresh.mockReset();
  mocks.toastSuccess.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  if (elementFromPointDescriptor) {
    Object.defineProperty(document, "elementFromPoint", elementFromPointDescriptor);
  } else {
    Reflect.deleteProperty(document, "elementFromPoint");
  }
});

describe("LoginForm", () => {
  it("validates the email before requesting a code", async () => {
    const next = "/goals?filter=week&sort=desc";
    render(<LoginForm next={next} />);
    expect(screen.getByRole("link", { name: "registerLink" })).toHaveAttribute(
      "href",
      `/register?next=${encodeURIComponent(next)}`,
    );
    fillEmail("not-an-email");
    clickSendCode();

    expect(await screen.findByRole("alert", {}, { timeout: ASYNC_TIMEOUT_MS })).toHaveTextContent(
      "invalidEmail",
    );
    expect(mocks.requestOtp).not.toHaveBeenCalled();
  });

  it("renders registration copy, encodes next on the sign-in link, and requests the same OTP", async () => {
    const otpRequest = deferred<{ ok: true; data: null }>();
    mocks.requestOtp.mockReturnValue(otpRequest.promise);
    const next = "/today?source=register&view=focus";
    render(<LoginForm mode="register" next={next} />);

    expect(screen.getByRole("heading", { name: "registerTitle" })).toBeInTheDocument();
    expect(screen.getByText("registerSubtitle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "registerSendCode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "registerGoogleSignIn" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "signInLink" })).toHaveAttribute(
      "href",
      `/login?next=${encodeURIComponent(next)}`,
    );

    fillEmail("new-person@example.com");
    fireEvent.click(screen.getByRole("button", { name: "registerSendCode" }));
    await waitFor(() =>
      expect(mocks.requestOtp).toHaveBeenCalledWith({ email: "new-person@example.com" }),
    );

    expect(screen.getByRole("button", { name: "sending" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "registerGoogleSignIn" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "googleSigningIn" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("emailLabel")).toBeDisabled();

    await act(async () => {
      otpRequest.resolve({ ok: true, data: null });
      await otpRequest.promise;
    });

    const otpInput = await screen.findByLabelText("codeLabel", {}, { timeout: ASYNC_TIMEOUT_MS });
    await waitFor(() => expect(otpInput).toBeEnabled(), { timeout: ASYNC_TIMEOUT_MS });
    expect(screen.getByRole("heading", { name: "registerCodeTitle" })).toBeInTheDocument();
    expect(screen.getByText("registerCodeRecipient")).toBeInTheDocument();
    expect(screen.getByText("new-person@example.com")).toBeInTheDocument();
    expect(screen.getByText("registerCodeHint")).toBeInTheDocument();
    expect(screen.getByText("registerOnboardingHint")).toBeInTheDocument();

    expect(mocks.requestOtp).toHaveBeenCalledWith({ email: "new-person@example.com" });
  });

  it("uses the existing Google sign-in action from registration", async () => {
    const googleRequest = deferred<{ ok: false; error: "generic" }>();
    mocks.startGoogleSignIn.mockReturnValue(googleRequest.promise);
    render(<LoginForm mode="register" next="/today" />);

    fireEvent.click(screen.getByRole("button", { name: "registerGoogleSignIn" }));

    await waitFor(() => expect(mocks.startGoogleSignIn).toHaveBeenCalledWith({ next: "/today" }), {
      timeout: ASYNC_TIMEOUT_MS,
    });
    expect(screen.getByRole("button", { name: "googleSigningIn" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "registerSendCode" })).toBeDisabled();
    expect(screen.getByLabelText("emailLabel")).toBeDisabled();

    await act(async () => {
      googleRequest.resolve({ ok: false, error: "generic" });
      await googleRequest.promise;
    });
    expect(await screen.findByRole("alert", {}, { timeout: ASYNC_TIMEOUT_MS })).toHaveTextContent(
      "generic",
    );
  });

  it("shows the send status, not verification status, while resending a code", async () => {
    const initialRequest = deferred<{ ok: true; data: null }>();
    const resendRequest = deferred<{ ok: true; data: null }>();
    mocks.requestOtp
      .mockReturnValueOnce(initialRequest.promise)
      .mockReturnValueOnce(resendRequest.promise);
    const { unmount } = render(<LoginForm />);

    fillEmail("person@example.com");
    clickSendCode();
    await waitFor(
      () => expect(mocks.requestOtp).toHaveBeenCalledWith({ email: "person@example.com" }),
      { timeout: ASYNC_TIMEOUT_MS },
    );

    vi.useFakeTimers();
    try {
      await act(async () => {
        initialRequest.resolve({ ok: true, data: null });
        await initialRequest.promise;
      });

      const otpInput = screen.getByLabelText("codeLabel");
      for (let second = 0; second < 60; second += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
      }

      const resendButton = screen.getByRole("button", { name: "resend" });
      expect(resendButton).toBeEnabled();
      fireEvent.click(resendButton);

      expect(mocks.requestOtp).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("button", { name: "sending" })).toBeDisabled();
      expect(screen.queryByText("verifying")).not.toBeInTheDocument();
      expect(otpInput).toBeDisabled();

      await act(async () => {
        resendRequest.resolve({ ok: true, data: null });
        await resendRequest.promise;
      });
    } finally {
      await act(async () => {
        initialRequest.resolve({ ok: true, data: null });
        resendRequest.resolve({ ok: true, data: null });
      });
      unmount();
      vi.useRealTimers();
    }
  });

  it("shows the code step and recovers from an invalid OTP", async () => {
    mocks.requestOtp.mockResolvedValue({ ok: true, data: null });
    const verifyRequest = deferred<{ ok: false; error: "otpInvalid" }>();
    mocks.verifyOtp.mockReturnValue(verifyRequest.promise);
    render(<LoginForm next="/today" />);

    fillEmail("person@example.com");
    clickSendCode();

    const otpInput = await screen.findByLabelText("codeLabel", {}, { timeout: ASYNC_TIMEOUT_MS });
    expect(
      await screen.findByRole("heading", { name: /codeTitleShort/ }, { timeout: ASYNC_TIMEOUT_MS }),
    ).toBeInTheDocument();
    expect(mocks.requestOtp).toHaveBeenCalledWith({ email: "person@example.com" });
    await waitFor(
      () => {
        expect(otpInput).toBeEnabled();
        expect(otpInput).toHaveFocus();
      },
      { timeout: ASYNC_TIMEOUT_MS },
    );

    fireEvent.change(otpInput, { target: { value: "123456" } });

    await waitFor(
      () =>
        expect(mocks.verifyOtp).toHaveBeenCalledWith({
          email: "person@example.com",
          token: "123456",
          next: "/today",
        }),
      { timeout: ASYNC_TIMEOUT_MS },
    );
    expect(screen.getByText("verifying")).toBeInTheDocument();
    expect(otpInput).toBeDisabled();

    await act(async () => {
      verifyRequest.resolve({ ok: false, error: "otpInvalid" });
      await verifyRequest.promise;
    });

    expect(await screen.findByRole("alert", {}, { timeout: ASYNC_TIMEOUT_MS })).toHaveTextContent(
      "otpInvalid",
    );
    await waitFor(
      () => {
        expect(otpInput).toHaveValue("");
        expect(otpInput).toBeEnabled();
        expect(otpInput).toHaveFocus();
      },
      { timeout: ASYNC_TIMEOUT_MS },
    );

    fireEvent.click(screen.getByRole("button", { name: "changeEmail" }));
    expect(screen.getByLabelText("emailLabel")).toHaveValue("person@example.com");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("lets the user return to the email step after a code was sent", async () => {
    mocks.requestOtp.mockResolvedValue({ ok: true, data: null });
    render(<LoginForm />);

    fillEmail("person@example.com");
    clickSendCode();
    await screen.findByLabelText("codeLabel", {}, { timeout: ASYNC_TIMEOUT_MS });

    const changeEmailButton = screen.getByRole("button", { name: "changeEmail" });
    await waitFor(() => expect(changeEmailButton).toBeEnabled(), {
      timeout: ASYNC_TIMEOUT_MS,
    });
    fireEvent.click(changeEmailButton);

    expect(screen.getByLabelText("emailLabel")).toHaveValue("person@example.com");
    expect(screen.getByRole("button", { name: "sendCode" })).toBeInTheDocument();
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });
});
