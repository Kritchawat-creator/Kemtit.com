// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    render(<LoginForm />);
    fillEmail("not-an-email");
    clickSendCode();

    expect(await screen.findByRole("alert", {}, { timeout: ASYNC_TIMEOUT_MS })).toHaveTextContent(
      "invalidEmail",
    );
    expect(mocks.requestOtp).not.toHaveBeenCalled();
  });

  it("shows the code step and recovers from an invalid OTP", async () => {
    mocks.requestOtp.mockResolvedValue({ ok: true, data: null });
    mocks.verifyOtp.mockResolvedValue({ ok: false, error: "otpInvalid" });
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
