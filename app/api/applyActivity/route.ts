import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const activity: string = String(body?.activity ?? "").toLowerCase();
  const current = body?.current ?? { mental: 50, physical: 50 };

  let dM = 0; // delta for mental
  let dP = 0; // delta for physical

  // ---- 关键词规则示例，可自行扩展 ----
  if (/nap|sleep|rest/.test(activity)) {
    dM += 6;
    dP += 4;
  }
  if (/coffee|caffeine|tea/.test(activity)) {
    dM += 5;
  }
  if (/run|jog|workout|gym|walk/.test(activity)) {
    dP += 8;
    dM += 2;
  }
  if (/yoga|stretch|meditat(e|ion)|mindful/.test(activity)) {
    dM += 7;
    dP += 3;
  }
  if (/heavy meal|fast food|drink|alcohol/.test(activity)) {
    dP -= 6;
    dM -= 3;
  }
  if (/gaming|doomscroll|scroll/.test(activity)) {
    dM -= 5;
  }
  if (/study|deep work|coding/.test(activity)) {
    dM -= 3;
  }

  // ---- 计算新值并限制范围 ----
  const newM = Math.max(0, Math.min(100, current.mental + dM));
  const newP = Math.max(0, Math.min(100, current.physical + dP));

  return NextResponse.json({
    delta: { mental: dM, physical: dP },
    newVals: { mental: newM, physical: newP },
  });
}
