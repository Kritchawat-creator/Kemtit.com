import { LoginForm } from "../login/login-form";

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { next, error } = await searchParams;
  return (
    <LoginForm
      mode="register"
      next={typeof next === "string" ? next : undefined}
      error={typeof error === "string" ? error : undefined}
    />
  );
}
