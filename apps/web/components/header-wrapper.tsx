"use client";

import { usePathname } from "next/navigation";

export function HeaderWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Hide the global header on pages that render their own nav.
  const SELF_NAVD = ["/app/editor"];
  if (SELF_NAVD.some(p => pathname === p || pathname.startsWith(p + "/"))) return null;
  
  return <>{children}</>;
}
