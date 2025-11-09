import { NextResponse } from "next/server";
import { saveInput } from "../storage";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "no body" }, { status: 400 });

    const payload = {
      route: "/api/saveInput",
      received: body,
      result: null,
      ts: new Date().toISOString(),
    };

    try {
      const id = await Promise.resolve(saveInput(payload));
      return NextResponse.json({ ok: true, id });
    } catch (e) {
      console.error("saveInput error:", e);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  } catch (e) {
    console.error("/api/saveInput error:", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
