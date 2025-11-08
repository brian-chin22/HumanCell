import { NextResponse } from "next/server";

// 便于在浏览器直接验证路由是否生效：GET http://localhost:3000/api/analyze2p
export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/analyze2p" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const sleep = Number(body?.profile?.sleepHours ?? 6);
    const workStyle = body?.profile?.workStyle as
      | "maker"
      | "manager"
      | "mixed"
      | undefined;

    const base = Math.min(100, Math.max(40, sleep * 10));
    let mental = Math.round(base + (workStyle === "maker" ? 10 : 0));
    let physical = Math.round(base - (workStyle === "manager" ? 5 : 0));
    mental = Math.max(0, Math.min(100, mental));
    physical = Math.max(0, Math.min(100, physical));

    return NextResponse.json({ mental, physical });
  } catch (e) {
    console.error("analyze2p error:", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
