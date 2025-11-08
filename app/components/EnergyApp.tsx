'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

// ---- Types ----
type WorkStyle = 'maker' | 'manager' | 'mixed' | null;

interface UserProfile {
  name: string;
  age?: number | null;
  sleepHours: number | null;
  workStyle: WorkStyle;
  goals: string;
  tags: string[];
}

interface AnalysisInput {
  profile: UserProfile;
  freeText: string;
}

export default function EnergyApp() {
  // Step control：1=输入资料/文本/Docx，2=显示柱状图，3=活动更新
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Profile
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    age: null,
    sleepHours: 7,
    workStyle: null,
    goals: '',
    tags: [],
  });

  // 文本 / docx
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [loadingDocx, setLoadingDocx] = useState(false);
  const [docxError, setDocxError] = useState<string | null>(null);

  // 两个百分数 + baseline
  const [mental, setMental] = useState<number | null>(null);
  const [physical, setPhysical] = useState<number | null>(null);
  const [baseline, setBaseline] = useState<{ mental: number; physical: number } | null>(null);

  const [analyzing, setAnalyzing] = useState(false);

  const canAnalyze = useMemo(
    () => Boolean(profile.name.trim()) && Boolean(profile.workStyle),
    [profile]
  );

  // 解析 docx：在客户端动态 import browser 版本，避免 SSR 报错
  const handleDocx = useCallback(async (files: FileList | null) => {
    if (!files || !files.length) return;
    const f = files[0];
    setDocxError(null);
    if (!f.name.toLowerCase().endsWith('.docx')) {
      setDocxError('仅支持 .docx 文件');
      return;
    }
    setLoadingDocx(true);
    setFileName(f.name);
    try {
      const mammoth = await
        import('mammoth/mammoth.browser'); // 动态加载
      const arrayBuffer = await f.arrayBuffer();
      const { value } = await mammoth.extractRawText({ arrayBuffer });
      const normalized = value.replace(/\r\n?/g, '\n').trim();
      setText((prev) => (prev ? prev + '\n\n' + normalized : normalized));
    } catch (e) {
      console.error(e);
      setDocxError('解析失败，请确认是否为有效的 .docx 文档');
    } finally {
      setLoadingDocx(false);
    }
  }, []);

  // 请求后端拿两个值
  const runAnalyze = async () => {
    setAnalyzing(true);
    try {
      const payload: AnalysisInput = { profile, freeText: text };
      const res = await fetch('/api/analyze2p', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: { mental: number; physical: number } = await res.json();
      setMental(data.mental);
      setPhysical(data.physical);
      setBaseline({ mental: data.mental, physical: data.physical });
      setStep(2);
    } catch (e) {
      console.error(e);
      alert('后端分析失败，请检查 /api/analyze2p 路由');
    } finally {
      setAnalyzing(false);
    }
  };

  // 活动上传并更新
  const [activity, setActivity] = useState('');
  const [applying, setApplying] = useState(false);
  const [lastDelta, setLastDelta] = useState<{ mental: number; physical: number } | null>(null);

  const applyActivity = async () => {
    if (mental == null || physical == null) return;
    setApplying(true);
    try {
      const res = await fetch('/api/applyActivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity, current: { mental, physical } }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: {
        delta: { mental: number; physical: number };
        newVals: { mental: number; physical: number };
      } = await res.json();
      setLastDelta(data.delta);
      setMental(data.newVals.mental);
      setPhysical(data.newVals.physical);
      setActivity('');
      setStep(3);
    } catch (e) {
      console.error(e);
      alert('后端 applyActivity 失败，请检查路由');
    } finally {
      setApplying(false);
    }
  };

  const barData = useMemo(
    () => [
      { kind: '精神', value: mental ?? 0, baseline: baseline?.mental ?? null },
      { kind: '身体', value: physical ?? 0, baseline: baseline?.physical ?? null },
    ],
    [mental, physical, baseline]
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Energy Manager（Next.js + TS 最小原型）</h1>

      {step === 1 && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label>称呼：</label>
            <br />
            <input
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </div>
          <div>
            <label>平均睡眠（小时）：</label>
            <br />
            <input
              type="number"
              step="0.5"
              value={profile.sleepHours ?? ''}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  sleepHours: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </div>
          <div>
            <label>工作风格：</label>
            <br />
            {(['maker', 'manager', 'mixed'] as const).map((k) => (
              <label key={k} style={{ marginRight: 12 }}>
                <input
                  type="radio"
                  name="workstyle"
                  checked={profile.workStyle === k}
                  onChange={() => setProfile({ ...profile, workStyle: k })}
                />
                {' '}{k}
              </label>
            ))}
          </div>

          <div>
            <label>自由文本（可粘贴日程/日志）</label>
            <br />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label>或上传 .docx：</label>{' '}
            <button onClick={() => fileRef.current?.click()} disabled={loadingDocx}>
              选择文件
            </button>
            {fileName && <span style={{ marginLeft: 8 }}>已选：{fileName}</span>}
            <input
              ref={fileRef}
              type="file"
              accept=".docx"
              hidden
              onChange={(e) => handleDocx(e.target.files)}
            />
            {loadingDocx && <div>解析中…</div>}
            {docxError && <div style={{ color: 'crimson' }}>{docxError}</div>}
          </div>

          <div>
            <button onClick={runAnalyze} disabled={!canAnalyze || analyzing}>
              {analyzing ? '分析中…' : '发送后端并获取两个能量值'}
            </button>
          </div>
        </div>
      )}

      {step >= 2 && (
        <div style={{ marginTop: 24 }}>
          <h3>当前能量（%）</h3>
          <div
            style={{
              width: '100%',
              height: 320,
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: 8,
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData as any}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="kind" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" name="当前值" />
                {baseline && <Bar dataKey="baseline" name="初始值" />}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {lastDelta && (
            <div style={{ marginTop: 8, color: '#666' }}>
              最近活动影响：精神 {lastDelta.mental >= 0 ? '+' : ''}
              {lastDelta.mental}，身体 {lastDelta.physical >= 0 ? '+' : ''}
              {lastDelta.physical}
            </div>
          )}
        </div>
      )}

      {step >= 2 && (
        <div style={{ marginTop: 16 }}>
          <label>输入活动（例：20min nap / coffee / 30min run / deep work 45m）</label>
          <br />
          <input
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            style={{ width: '70%' }}
          />
          <button
            onClick={applyActivity}
            disabled={!activity.trim() || applying}
            style={{ marginLeft: 8 }}
          >
            {applying ? '上传中…' : '上传到后端并更新'}
          </button>
        </div>
      )}
    </div>
  );
}
