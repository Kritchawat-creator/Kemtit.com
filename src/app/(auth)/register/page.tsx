import { RegisterForm } from "./register-form";

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { next, error } = await searchParams;
  return (
    <RegisterForm
      next={typeof next === "string" ? next : undefined}
      error={typeof error === "string" ? error : undefined}
    />
  );
}
