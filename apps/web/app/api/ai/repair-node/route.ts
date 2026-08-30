import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: "Executable UI node repair is no longer supported" },
    { status: 410 },
  );
}
