import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const secretKey = process.env.MOONPAY_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { error: "MoonPay signing is not configured. Set MOONPAY_SECRET_KEY in web/.env.local." },
      { status: 503 },
    );
  }

  let body: { url?: string };
  try {
    body = (await req.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const query = new URL(url).search;
    const signature = createHmac("sha256", secretKey)
      .update(query)
      .digest("base64");

    return NextResponse.json({ signature });
  } catch {
    return NextResponse.json({ error: "Invalid MoonPay widget URL" }, { status: 400 });
  }
}
