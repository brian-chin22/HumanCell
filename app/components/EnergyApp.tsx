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
  // Step control: 1 = input, 2 = show chart, 3 = activity update
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

  // Free text / docx upload
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [loadingDocx, setLoadingDocx] = useState(false);
  const [docxError, setDocxError] = useState<string | null>(null);

  // Two percentage values + baseline
  const [mental, setMental] = useState<number | null>(null);
  const [physical, setPhysical] = useState<number | null>(null);
  const [baseline, setBaseline] = useState<{ mental: number; physical: number } | null>(null);

  const [analyzing, setAnalyzing] = useState(false);

  const canAnalyze = useMemo(
    () => Boolean(profile.name.trim()) && Boolean(profile.workStyle),
    [profile]
  );

  // Parse docx: dynamic import for browser-only behavior
  const handleDocx = useCallback(async (files: FileList | null) => {
    if (!files || !files.length) return;
    const f = files[0];
    setDocxError(null);
    if (!f.name.toLowerCase().endsWith('.docx')) {
      setDocxError('Only .docx files are supported');
      return;
    }
    setLoadingDocx(true);
    setFileName(f.name);
    try {
      const mammoth = await import('mammoth/mammoth.browser');
      const arrayBuffer = await f.arrayBuffer();
      const { value } = await mammoth.extractRawText({ arrayBuffer });
      const normalized = value.replace(/\r\n?/g, '\n').trim();
      setText((prev) => (prev ? prev + '\n\n' + normalized : normalized));
    } catch (e) {
      console.error(e);
      setDocxError('Failed to parse .docx file. Please make sure it is valid.');
    } finally {
      setLoadingDocx(false);
    }
  }, []);

  // Fetch two energy values from backend
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
      // also save the raw input to storage (best-effort)
      try {
        await fetch('/api/saveInput', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile, freeText: text }),
        });
      } catch (e) {
        // non-fatal: just log
        console.error('saveInput failed:', e);
      }
    } catch (e) {
      console.error(e);
      alert('Backend analysis failed. Please check /api/analyze2p route.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Apply activity to update energy
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
      alert('Backend applyActivity failed. Please check the route.');
    } finally {
      setApplying(false);
    }
  };

  const barData = useMemo(
    () => [
      { kind: 'Mental', value: mental ?? 0, baseline: baseline?.mental ?? null },
      { kind: 'Physical', value: physical ?? 0, baseline: baseline?.physical ?? null },
    ],
    [mental, physical, baseline]
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Energy Manager (Next.js + TS Minimal Prototype)</h1>

      {step === 1 && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label>Name:</label>
            <br />
            <input
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </div>
          <div>
            <label>Average Sleep (hours):</label>
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
            <label>Work Style:</label>
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
            <label>Free Text (paste schedule / journal / notes)</label>
            <br />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label>Or upload .docx:</label>{' '}
            <button onClick={() => fileRef.current?.click()} disabled={loadingDocx}>
              Choose File
            </button>
            {fileName && <span style={{ marginLeft: 8 }}>Selected: {fileName}</span>}
            <input
              ref={fileRef}
              type="file"
              accept=".docx"
              hidden
              onChange={(e) => handleDocx(e.target.files)}
            />
            {loadingDocx && <div>Parsing…</div>}
            {docxError && <div style={{ color: 'crimson' }}>{docxError}</div>}
          </div>

          <div>
            <button onClick={runAnalyze} disabled={!canAnalyze || analyzing}>
              {analyzing ? 'Analyzing…' : 'Send to backend and get two energy values'}
            </button>
          </div>
        </div>
      )}

      {step >= 2 && (
        <div style={{ marginTop: 24 }}>
          <h3>Current Energy (%)</h3>
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
                <Bar dataKey="value" name="Current" />
                {baseline && <Bar dataKey="baseline" name="Baseline" />}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {lastDelta && (
            <div style={{ marginTop: 8, color: '#666' }}>
              Recent Activity Impact: Mental {lastDelta.mental >= 0 ? '+' : ''}
              {lastDelta.mental}, Physical {lastDelta.physical >= 0 ? '+' : ''}
              {lastDelta.physical}
            </div>
          )}
        </div>
      )}

      {step >= 2 && (
        <div style={{ marginTop: 16 }}>
          <label>Enter Activity (e.g. 20min nap / coffee / 30min run / deep work 45m)</label>
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
            {applying ? 'Submitting…' : 'Send to backend and update'}
          </button>
        </div>
      )}
    </div>
  );
}
