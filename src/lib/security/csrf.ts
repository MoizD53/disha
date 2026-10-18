import { NextResponse } from "next/server";

export function validateOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");

  if (!origin || !host) {
    // Some native clients might not send origin. If this is a protected browser endpoint, we reject.
    // However, our policy will be: if it's a browser (has origin), it MUST match host.
    return false;
  }

  try {
    const originUrl = new URL(origin);
    if (originUrl.host !== host) {
      return false;
    }
  } catch (e) {
    return false;
  }

  return true;
}
