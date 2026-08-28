import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TemplatesClient } from "./templates-client";

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login?callbackUrl=" + encodeURIComponent("/app/templates"));
  }

  return (
    <div style={{ background: "var(--cream)", minHeight: "100vh" }}>
      <TemplatesClient />
    </div>
  );
}
