import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

// ✅ GET：用于测试路由是否存在
export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/analyze2p" });
}

// ✅ POST：处理请求 + 记录日志 + 返回能量数值
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    // -------- 写入日志（带时间戳） --------
    const logDir = path.join(process.cwd(), "data");
    const logFile = path.join(logDir, "user-input.log");
    await fs.mkdir(logDir, { recursive: true });

    const entry = {
      timestamp: new Date().toISOString(),
      profile: body?.profile ?? null,
      freeText: body?.freeText ?? "",
      userAgent: req.headers.get("user-agent"),
      ip: req.headers.get("x-forwarded-for"),
    };

    await fs.appendFile(logFile, JSON.stringify(entry) + "\n", "utf8");
    // -------- 日志结束 --------

    // -------- 计算两个能量 --------
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
