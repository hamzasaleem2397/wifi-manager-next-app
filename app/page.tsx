import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const authed = await isAuthenticated();
  if (authed) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
