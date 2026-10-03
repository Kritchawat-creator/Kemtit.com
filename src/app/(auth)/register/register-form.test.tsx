// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestOtp: vi.fn(),
  startGoogleSignIn: vi.fn(),
  verifyOtp: vi.fn(),
  updateDisplayName: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/core/auth/actions", () => ({
  requestOtp: mocks.requestOtp,
  startGoogleSignIn: mocks.startGoogleSignIn,
  verifyOtp: mocks.verifyOtp,
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

const ASYNC_TIMEOUT_MS = 10_000;
const elementFromPointDescriptor = Object.getOwnPropertyDescriptor(document, "elementFromPoint");

Object.defineProperty(document, "elementFromPoint", {
  configurable: true,
  value: () => document.querySelector("[data-input-otp-container]"),
});

function fillDetails(displayName: string, email: string) {
  fireEvent.change(screen.getByLabelText("registerNameLabel"), {
    target: { value: displayName },
  });
  fireEvent.change(screen.getByLabelText("emailLabel"), { target: { value: email } });
}

function clickSendCode() {
  fireEvent.click(screen.getByRole("button", { name: "registerSendCode" }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function reachCodeStep(displayName = "New Member", email = "new-member@example.com") {
  mocks.requestOtp.mockResolvedValue({ ok: true, data: null });
  render(<RegisterForm next="/onboarding/persona" />);
  fillDetails(displayName, email);
  clickSendCode();
  const otpInput = await screen.findByLabelText("codeLabel", {}, { timeout: ASYNC_TIMEOUT_MS });
  await waitFor(
    () => {
      expect(otpInput).toBeEnabled();
      expect(otpInput).toHaveFocus();
    },
    { timeout: ASYNC_TIMEOUT_MS },
  );
  return otpInput;
}

beforeEach(() => {
  mocks.requestOtp.mockReset();
  mocks.startGoogleSignIn.mockReset();
  mocks.verifyOtp.mockReset();
  mocks.updateDisplayName.mockReset();
  mocks.replace.mockReset();
  mocks.refresh.mockReset();
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

describe("RegisterForm", () => {
  it("renders its own signup card and encodes next on the sign-in link", () => {
    const next = "/today?source=register&view=focus";
    render(<RegisterForm next={next} />);

    expect(document.querySelector("[data-register-page]")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "registerTitle" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "registerStepsLabel" }).children).toHaveLength(3);
    expect(screen.getByRole("link", { name: "signInLink" })).toHaveAttribute(
      "href",
      `/login?next=${encodeURIComponent(next)}`,
    );
    expect(screen.getByLabelText("registerNameLabel")).toHaveAttribute("autocomplete", "nickname");
    expect(screen.queryByLabelText("passwordLabel")).not.toBeInTheDocument();
  });

  it("requires a non-empty display name before requesting a code", async () => {
    render(<RegisterForm />);
    fillDetails("   ", "new-member@example.com");
    clickSendCode();

    expect(await screen.findByRole("alert", {}, { timeout: ASYNC_TIMEOUT_MS })).toHaveTextContent(
      "required",
    );
    expect(mocks.requestOtp).not.toHaveBeenCalled();
  });

  it("validates the email before requesting a code", async () => {
    render(<RegisterForm />);
    fillDetails("New Member", "not-an-email");
    clickSendCode();

    expect(await screen.findByRole("alert", {}, { timeout: ASYNC_TIMEOUT_MS })).toHaveTextContent(
      "invalidEmail",
    );
    expect(mocks.requestOtp).not.toHaveBeenCalled();
  });

  it("captures the validated name and email while sending and disables other actions", async () => {
    const otpRequest = deferred<{ ok: true; data: null }>();
    mocks.requestOtp.mockReturnValue(otpRequest.promise);
    const next = "/today?source=register&view=focus";
    render(<RegisterForm next={next} />);
    fillDetails("  May  ", "MAY@EXAMPLE.COM");
    clickSendCode();

    await waitFor(() =>
      expect(mocks.requestOtp).toHaveBeenCalledWith({ email: "may@example.com" }),
    );
    expect(screen.getByRole("button", { name: "sending" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "registerGoogleSignIn" })).toBeDisabled();
    expect(screen.getByLabelText("registerNameLabel")).toBeDisabled();
    expect(screen.getByLabelText("emailLabel")).toBeDisabled();

    await act(async () => {
      otpRequest.resolve({ ok: true, data: null });
      await otpRequest.promise;
    });

    expect(await screen.findByRole("heading", { name: "registerCodeTitle" })).toBeInTheDocument();
    expect(screen.getByText("may@example.com")).toBeInTheDocument();
    expect(screen.getByText("registerCodeHint")).toBeInTheDocument();
    expect(screen.getByText("registerOnboardingHint")).toBeInTheDocument();
  });

  it("saves the display name only after OTP verification succeeds", async () => {
    const verifyRequest = deferred<{
      ok: true;
      data: { next: string; onboardingRequired: boolean };
    }>();
    const saveRequest = deferred<{ ok: true; data: null }>();
    mocks.requestOtp.mockResolvedValue({ ok: true, data: null });
    mocks.verifyOtp.mockReturnValue(verifyRequest.promise);
    mocks.updateDisplayName.mockReturnValue(saveRequest.promise);
    render(<RegisterForm next="/onboarding/persona" />);
    fillDetails("  New Member  ", "new-member@example.com");
    clickSendCode();

    const otpInput = await screen.findByLabelText("codeLabel", {}, { timeout: ASYNC_TIMEOUT_MS });
    await waitFor(() => expect(otpInput).toHaveFocus(), { timeout: ASYNC_TIMEOUT_MS });
    fireEvent.change(otpInput, { target: { value: "123456" } });

    await waitFor(() =>
      expect(mocks.verifyOtp).toHaveBeenCalledWith({
        email: "new-member@example.com",
        token: "123456",
        next: "/onboarding/persona",
      }),
    );
    expect(mocks.updateDisplayName).not.toHaveBeenCalled();

    await act(async () => {
      verifyRequest.resolve({
        ok: true,
        data: { next: "/onboarding/persona", onboardingRequired: true },
      });
      await verifyRequest.promise;
    });

    await waitFor(() =>
      expect(mocks.updateDisplayName).toHaveBeenCalledWith({ displayName: "New Member" }),
    );
    expect(screen.getByRole("heading", { name: "registerSavingTitle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "registerSavingName" })).toBeDisabled();

    await act(async () => {
      saveRequest.resolve({ ok: true, data: null });
      await saveRequest.promise;
    });

    expect(mocks.replace).toHaveBeenCalledWith("/onboarding/persona");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("retries a failed profile save without verifying or sending another code", async () => {
    mocks.requestOtp.mockResolvedValue({ ok: true, data: null });
    mocks.verifyOtp.mockResolvedValue({
      ok: true,
      data: { next: "/onboarding/persona", onboardingRequired: true },
    });
    mocks.updateDisplayName
      .mockResolvedValueOnce({ ok: false, error: "generic" })
      .mockResolvedValueOnce({ ok: true, data: null });
    const otpInput = await reachCodeStep();
    fireEvent.change(otpInput, { target: { value: "123456" } });

    const retryButton = await screen.findByRole(
      "button",
      { name: "registerRetrySave" },
      { timeout: ASYNC_TIMEOUT_MS },
    );
    expect(screen.getByRole("heading", { name: "registerSaveFailureTitle" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("generic");
    fireEvent.click(retryButton);

    await waitFor(() => expect(mocks.updateDisplayName).toHaveBeenCalledTimes(2));
    expect(mocks.updateDisplayName).toHaveBeenLastCalledWith({ displayName: "New Member" });
    expect(mocks.verifyOtp).toHaveBeenCalledOnce();
    expect(mocks.requestOtp).toHaveBeenCalledOnce();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/onboarding/persona"));
  });

  it("does not overwrite an existing member's name when next points to onboarding", async () => {
    mocks.requestOtp.mockResolvedValue({ ok: true, data: null });
    mocks.verifyOtp.mockResolvedValue({
      ok: true,
      data: { next: "/onboarding/persona", onboardingRequired: false },
    });
    const otpInput = await reachCodeStep("Existing Member");
    fireEvent.change(otpInput, { target: { value: "123456" } });

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/onboarding/persona"));
    expect(mocks.updateDisplayName).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("clears an invalid OTP, focuses the code field, and preserves both details when changing email", async () => {
    mocks.requestOtp.mockResolvedValue({ ok: true, data: null });
    mocks.verifyOtp.mockResolvedValue({ ok: false, error: "otpInvalid" });
    render(<RegisterForm />);
    fillDetails("May Member", "may@example.com");
    clickSendCode();

    const otpInput = await screen.findByLabelText("codeLabel", {}, { timeout: ASYNC_TIMEOUT_MS });
    await waitFor(() => expect(otpInput).toHaveFocus(), { timeout: ASYNC_TIMEOUT_MS });
    fireEvent.change(otpInput, { target: { value: "123456" } });

    expect(await screen.findByRole("alert", {}, { timeout: ASYNC_TIMEOUT_MS })).toHaveTextContent(
      "otpInvalid",
    );
    await waitFor(() => {
      expect(otpInput).toHaveValue("");
      expect(otpInput).toHaveFocus();
    });
    fireEvent.click(screen.getByRole("button", { name: "changeEmail" }));

    expect(screen.getByLabelText("registerNameLabel")).toHaveValue("May Member");
    expect(screen.getByLabelText("emailLabel")).toHaveValue("may@example.com");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("delegates Google signup with the requested next route and recovers from provider errors", async () => {
    const googleRequest = deferred<{ ok: false; error: "googleAuthFailed" }>();
    mocks.startGoogleSignIn.mockReturnValue(googleRequest.promise);
    const next = "/today?source=register&view=focus";
    render(<RegisterForm next={next} />);

    fireEvent.click(screen.getByRole("button", { name: "registerGoogleSignIn" }));

    await waitFor(() => expect(mocks.startGoogleSignIn).toHaveBeenCalledWith({ next }));
    expect(screen.getByRole("button", { name: "googleSigningIn" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "registerSendCode" })).toBeDisabled();
    expect(screen.getByLabelText("registerNameLabel")).toBeDisabled();
    expect(screen.getByLabelText("emailLabel")).toBeDisabled();

    await act(async () => {
      googleRequest.resolve({ ok: false, error: "googleAuthFailed" });
      await googleRequest.promise;
    });

    expect(await screen.findByRole("alert", {}, { timeout: ASYNC_TIMEOUT_MS })).toHaveTextContent(
      "googleAuthFailed",
    );
  });

  it("shows the saving status and disables retry while the profile action is pending", async () => {
    const saveRequest = deferred<{ ok: true; data: null }>();
    mocks.verifyOtp.mockResolvedValue({
      ok: true,
      data: { next: "/onboarding/persona", onboardingRequired: true },
    });
    mocks.updateDisplayName.mockReturnValue(saveRequest.promise);
    const otpInput = await reachCodeStep();
    fireEvent.change(otpInput, { target: { value: "123456" } });

    await waitFor(() => expect(mocks.updateDisplayName).toHaveBeenCalledOnce());
    expect(screen.getByRole("heading", { name: "registerSavingTitle" })).toBeInTheDocument();
    expect(screen.getByText("registerSavingDescription")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "registerSaveFailureTitle" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "registerSavingName" })).toBeDisabled();

    await act(async () => {
      saveRequest.resolve({ ok: true, data: null });
      await saveRequest.promise;
    });
  });

  it("keeps resend disabled until the 60-second cooldown ends", async () => {
    const initialRequest = deferred<{ ok: true; data: null }>();
    const resendRequest = deferred<{ ok: true; data: null }>();
    mocks.requestOtp
      .mockReturnValueOnce(initialRequest.promise)
      .mockReturnValueOnce(resendRequest.promise);
    const { unmount } = render(<RegisterForm />);
    fillDetails("New Member", "new-member@example.com");
    clickSendCode();
    await waitFor(() =>
      expect(mocks.requestOtp).toHaveBeenNthCalledWith(1, { email: "new-member@example.com" }),
    );

    vi.useFakeTimers();
    try {
      await act(async () => {
        initialRequest.resolve({ ok: true, data: null });
        await initialRequest.promise;
      });

      const resendButton = screen.getByRole("button", { name: "resendIn" });
      expect(resendButton).toBeDisabled();
      for (let second = 0; second < 60; second += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1000);
        });
      }

      fireEvent.click(screen.getByRole("button", { name: "resend" }));
      expect(mocks.requestOtp).toHaveBeenCalledTimes(2);
      expect(mocks.requestOtp).toHaveBeenNthCalledWith(2, { email: "new-member@example.com" });
      expect(screen.getByRole("button", { name: "sending" })).toBeDisabled();
      expect(screen.queryByText("verifying")).not.toBeInTheDocument();
      expect(screen.getByLabelText("codeLabel")).toBeDisabled();
      expect(mocks.verifyOtp).not.toHaveBeenCalled();
      expect(mocks.updateDisplayName).not.toHaveBeenCalled();

      await act(async () => {
        resendRequest.resolve({ ok: true, data: null });
        await resendRequest.promise;
      });

      fireEvent.click(screen.getByRole("button", { name: "changeEmail" }));
      expect(screen.getByLabelText("registerNameLabel")).toHaveValue("New Member");
      expect(screen.getByLabelText("emailLabel")).toHaveValue("new-member@example.com");
    } finally {
      await act(async () => {
        initialRequest.resolve({ ok: true, data: null });
        resendRequest.resolve({ ok: true, data: null });
      });
      unmount();
      vi.useRealTimers();
    }
  });
});
