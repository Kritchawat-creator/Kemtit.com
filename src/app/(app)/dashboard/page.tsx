import { redirect } from "next/navigation";

/** Compatibility route. V2 owns Today as the product home. */
export default async function LegacyDashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    }
  }

  const suffix = query.toString();
  redirect(suffix ? `/today?${suffix}` : "/today");
}
