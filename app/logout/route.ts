import { NextResponse } from "next/server";

import { logoutCurrentSession } from "@/lib/auth";

export async function POST(request: Request) {
  await logoutCurrentSession();
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
