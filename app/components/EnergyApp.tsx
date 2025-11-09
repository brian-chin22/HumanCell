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

// ---- Main Component ----
export default function EnergyApp() {
  // Step control
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    age: null,
    sleepHours: 7,
    workStyle: null,
    goals: '',
    tags: [],
  });
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Loading & Error State
  const [loadingDocx, setLoadingDocx] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null); // For UI errors

  // Energy State
  const [mental, setMental] = useState<number | null>(null);
  const [physical, setPhysical] = useState<number | null>(null);
  const [baseline, setBaseline] = useState<{ mental: number; physical: number } | null>(null);
  const [activity, setActivity] = useState('');
  const [lastDelta, setLastDelta] = useState<{ mental: number; physical: number } | null>(null);

  // Derived State
  const canAnalyze = useMemo(
    () => Boolean(profile.name.trim()) && Boolean(profile.workStyle),
    [profile]
  );

  // ---- Helper Functions ----

  /**
   * Gets mascot image URL and status color based on energy level
   */
  const getMascotData = (level: number | null) => {
    const score = level ?? 50; // Default to 50 if null

    // 🎨 MONOPOLY THEME: Color codes for status
    const colors = {
      high: '#3cb043', // Property Green
      mid: '#fde900',  // Chance Yellow
      low: '#d90429',   // Monopoly Red
    };

    // 🎨 REPLACE THESE URLs WITH YOUR PNGs/JPEGs
    // These paths assume a /public/mascots/ folder
    if (score >= 75) {
      return {
        //url: 'https://placehold.co/100x100/3cb043/white?text=HIGH',
        url: '/mascots/Energetic_Monopoly.png', // <-- Your image here
        color: colors.high,
        label: 'High Energy',
      };
    }
    if (score >= 50) {
      return {
        //url: 'https://placehold.co/100x100/fde900/black?text=MID',
        url: '/mascots/Neutral_Monopoly.png', // <-- Your image here
        color: colors.mid,
        label: 'Medium Energy',
      };
    }
    return {
      //url: 'https://placehold.co/100x100/d90429/white?text=LOW',
      url: '/mascots/Exhausted_Monopoly_eyebags.png', // <-- Your image here
      color: colors.low,
      label: 'Low Energy',
    };
  };

  const mentalMascot = useMemo(() => getMascotData(mental), [mental]);
  const physicalMascot = useMemo(() => getMascotData(physical), [physical]);

  // ---- Data Handling ----

  /**
   * Parse .docx file
   */
  const handleDocx = useCallback(async (files: FileList | null) => {
    if (!files || !files.length) return;
    const f = files[0];
    setError(null);
    if (!f.name.toLowerCase().endsWith('.docx')) {
      setError('Only .docx files are supported');
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
      setError('Failed to parse .docx file. Please make sure it is valid.');
    } finally {
      setLoadingDocx(false);
    }
  }, []);

  /**
   * Fetch initial energy values from backend
   */
  const runAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
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
    } catch (e: any) {
      console.error(e);
      setError(`Backend analysis failed: ${e.message || 'Check /api/analyze2p route.'}`);
    } finally {
      setAnalyzing(false);
    }
  };

  /**
   * Apply activity to update energy
   */
  const applyActivity = async () => {
    if (mental == null || physical == null) return;
    setApplying(true);
    setError(null);
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
    } catch (e: any) {
      console.error(e);
      setError(`Backend applyActivity failed: ${e.message || 'Check the route.'}`);
    } finally {
      setApplying(false);
    }
  };

  // Chart data
  const barData = useMemo(
    () => [
      { kind: 'Mental', value: mental ?? 0, baseline: baseline?.mental ?? null },
      { kind: 'Physical', value: physical ?? 0, baseline: baseline?.physical ?? null },
    ],
    [mental, physical, baseline]
  );

  // ---- Monopoly Color Palette ----
  const colors = {
    boardGreen: '#cde6d0',
    deedCream: '#f7f3e8',
    textBlack: '#212529',
    monopolyRed: '#d90429',
    chanceYellow: '#fde900',
    boardwalkBlue: '#0072bb',
    propertyGreen: '#3cb043',
    disabledGray: '#999',
    errorRed: '#d90429',
    errorBg: '#fbebee',
  };

  // ---- Component Return ----
  return (
    <div
      style={{
        maxWidth: 900,
        margin: '2rem auto',
        padding: '1rem', // Smaller padding on mobile
        fontFamily: "'Trebuchet MS', Helvetica, sans-serif",
        backgroundColor: colors.boardGreen,
        color: colors.textBlack,
        borderRadius: '16px',
        border: `3px solid ${colors.textBlack}`,
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
      }}
    >
      <style>{`
        ::placeholder { color: ${colors.disabledGray}; opacity: 1; }
      `}</style>
      
      <h1
        style={{
          fontSize: '2.5rem',
          marginBottom: '2rem',
          textAlign: 'center',
          fontWeight: '700',
          color: colors.monopolyRed,
          textShadow: `1px 1px 0 ${colors.deedCream}`,
        }}
      >
        Energy Manager
      </h1>

      {/* --- Global Error Display --- */}
      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: colors.errorBg,
          border: `2px solid ${colors.errorRed}`,
          color: colors.errorRed,
          borderRadius: '8px',
          marginBottom: '1rem',
          textAlign: 'center',
          fontWeight: '600'
        }}>
          {error}
        </div>
      )}

      {/* ------------------ */}
      {/* 🎨 STEP 1: INPUT  */}
      {/* ------------------ */}
      {step === 1 && (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          
          {/* --- Profile Card --- */}
          <div style={{
            padding: '1.5rem',
            backgroundColor: colors.deedCream,
            borderRadius: '12px',
            border: `2px solid ${colors.textBlack}`,
            display: 'grid',
            gap: '1.25rem'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', margin: '0 0 0.5rem 0', color: colors.monopolyRed }}>
              Your Profile
            </h3>
            <div>
              <label style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Name:</label>
              <input
                value={profile.name}
                placeholder="e.g., Mr. Monopoly"
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: `2px solid ${colors.textBlack}`,
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                  backgroundColor: '#fff',
                  color: colors.textBlack, // <-- FIX: Added text color
                }}
              />
            </div>
            <div>
              <label style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Average Sleep (hours):</label>
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
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: `2px solid ${colors.textBlack}`,
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                  backgroundColor: '#fff',
                  color: colors.textBlack, // <-- FIX: Added text color
                }}
              />
            </div>
            <div>
              <label style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Work Style:</label>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {(['maker', 'manager', 'mixed'] as const).map((k) => (
                  <label
                    key={k}
                    style={{
                      flex: 1,
                      minWidth: '80px',
                      padding: '0.75rem 1rem',
                      border: `2px solid ${colors.textBlack}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontWeight: '600',
                      backgroundColor: profile.workStyle === k ? colors.chanceYellow : '#fff',
                      boxShadow: profile.workStyle === k ? `0 0 5px ${colors.chanceYellow}` : 'none',
                    }}
                  >
                    <input
                      type="radio"
                      name="workstyle"
                      checked={profile.workStyle === k}
                      onChange={() => setProfile({ ...profile, workStyle: k })}
                      style={{ accentColor: colors.monopolyRed }}
                    />
                    {k.charAt(0).toUpperCase() + k.slice(1)}
                  </label>
                ))}
              </div>
            </div>
          </div>
          
          {/* --- Context Card --- */}
          <div style={{
            padding: '1.5rem',
            backgroundColor: colors.deedCream,
            borderRadius: '12px',
            border: `2px solid ${colors.textBlack}`,
            display: 'grid',
            gap: '1.25rem'
          }}>
             <h3 style={{ fontSize: '1.25rem', fontWeight: '700', margin: '0', color: colors.monopolyRed }}>
               Context (Optional)
             </h3>
            <div>
              <label style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>
                Paste schedule / journal / notes...
              </label>
              <textarea
                value={text}
                placeholder="e.g., 'Long meeting from 10-12, then ate fast food...'"
                onChange={(e) => setText(e.target.value)}
                rows={6}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: `2px solid ${colors.textBlack}`,
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  backgroundColor: '#fff',
                  color: colors.textBlack, // <-- FIX: Added text color
                }}
              />
            </div>

            <div>
              <label style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Or upload .docx:</label>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={loadingDocx}
                style={{
                  padding: '0.6rem 1.25rem',
                  border: `2px solid ${colors.textBlack}`,
                  backgroundColor: '#fff',
                  color: colors.textBlack,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'background-color 0.2s',
                }}
              >
                Choose File
              </button>
              {fileName && <span style={{ marginLeft: 8, color: '#555' }}>Selected: {fileName}</span>}
              <input
                ref={fileRef}
                type="file"
                accept=".docx"
                hidden
                onChange={(e) => handleDocx(e.target.files)}
              />
              {loadingDocx && <div style={{ color: colors.boardwalkBlue, fontWeight: '600' }}>Parsing…</div>}
            </div>
          </div>

          {/* --- Analyze Button --- */}
          <div>
            <button
              onClick={runAnalyze}
              disabled={!canAnalyze || analyzing}
              style={{
                width: '100%',
                padding: '1rem',
                border: `2px solid ${colors.textBlack}`,
                backgroundColor: !canAnalyze || analyzing ? colors.disabledGray : colors.monopolyRed,
                color: 'white',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '1.125rem',
                transition: 'all 0.2s',
                textShadow: `1px 1px 0 ${colors.textBlack}`,
              }}
            >
              {analyzing ? 'Analyzing…' : 'Analyze My Energy'}
            </button>
          </div>
        </div>
      )}

      {/* ---------------------- */}
      {/* 🎨 STEP 2/3: DASHBOARD */}
      {/* ---------------------- */}
      {step >= 2 && (
        <div style={{ marginTop: 24, display: 'grid', gap: '1.5rem' }}>
          
          {/* --- Mascot Display --- */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            gap: '1rem',
            padding: '1.5rem',
            backgroundColor: colors.deedCream,
            borderRadius: '12px',
            border: `2px solid ${colors.textBlack}`,
            flexWrap: 'wrap', // Added for better mobile view
          }}>
            {/* Mental Mascot */}
            <div style={{ textAlign: 'center' }}>
              <img
                src={mentalMascot.url}
                alt="Mental energy mascot"
                style={{ width: 100, height: 100, borderRadius: '8px', border: `3px solid ${mentalMascot.color}` }}
                onError={(e) => (e.currentTarget.src = 'https://placehold.co/100x100/ccc/black?text=Error')}
              />
              <h4 style={{ margin: '0.5rem 0 0 0', color: mentalMascot.color, fontWeight: '700' }}>
                Mental: {mentalMascot.label}
              </h4>
            </div>
            {/* Physical Mascot */}
            <div style={{ textAlign: 'center' }}>
              <img
                src={physicalMascot.url}
                alt="Physical energy mascot"
                style={{ width: 100, height: 100, borderRadius: '8px', border: `3px solid ${physicalMascot.color}` }}
                onError={(e) => (e.currentTarget.src = 'https://placehold.co/100x100/ccc/black?text=Error')}
              />
              <h4 style={{ margin: '0.5rem 0 0 0', color: physicalMascot.color, fontWeight: '700' }}>
                Physical: {physicalMascot.label}
              </h4>
            </div>
          </div>

          {/* --- Chart Card --- */}
          <div style={{
            padding: '1.5rem',
            backgroundColor: colors.deedCream,
            borderRadius: '12px',
            border: `2px solid ${colors.textBlack}`,
          }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', textAlign: 'center', marginBottom: '1.5rem', color: colors.monopolyRed }}>
              Current Energy (%)
            </h3>
            <div
              style={{
                width: '100%',
                height: 320,
                boxSizing: 'border-box'
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData as any} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ccc" />
                  <XAxis dataKey="kind" axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(0, 0, 0, 0.1)', radius: 8 }}
                    contentStyle={{
                      borderRadius: '8px',
                      border: `2px solid ${colors.textBlack}`,
                      backgroundColor: colors.deedCream,
                      color: colors.textBlack, // <-- FIX: Added text color
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '1rem' }} />
                  <Bar dataKey="value" name="Current" fill={colors.boardwalkBlue} radius={[8, 8, 0, 0]} />
                  {baseline && (
                    <Bar dataKey="baseline" name="Baseline" fill={colors.propertyGreen} radius={[8, 8, 0, 0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* --- Delta Message --- */}
          {lastDelta && (
            <div
              style={{
                color: colors.textBlack,
                backgroundColor: colors.chanceYellow,
                padding: '1rem',
                borderRadius: '8px',
                textAlign: 'center',
                fontWeight: '600',
                border: `2px solid ${colors.textBlack}`,
              }}
            >
              Recent Activity Impact: 
              <span style={{ color: lastDelta.mental >= 0 ? colors.propertyGreen : colors.monopolyRed, fontWeight: '700' }}>
                {' '}Mental {lastDelta.mental >= 0 ? '+' : ''}{lastDelta.mental}
              </span>,
              <span style={{ color: lastDelta.physical >= 0 ? colors.propertyGreen : colors.monopolyRed, fontWeight: '700' }}>
                {' '}Physical {lastDelta.physical >= 0 ? '+' : ''}{lastDelta.physical}
              </span>
            </div>
          )}

          {/* --- Activity Input Card --- */}
          <div 
            style={{
              padding: '1.5rem',
              backgroundColor: colors.deedCream,
              borderRadius: '12px',
              border: `2px solid ${colors.textBlack}`,
            }}
          >
            <label style={{ fontWeight: '700', fontSize: '1.25rem', display: 'block', marginBottom: '0.5rem', color: colors.monopolyRed }}>
              Apply an Activity
            </label>
            <p style={{ color: '#555', marginTop: 0, marginBottom: '1rem', fontSize: '0.9rem'}}>
              (e.g. 20min nap / coffee / 30min run / deep work 45m)
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                value={activity}
                placeholder="Type activity here..."
                onChange={(e) => setActivity(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: '200px',
                  padding: '0.75rem 1rem',
                  border: `2px solid ${colors.textBlack}`,
                  borderRadius: '8px',
                  backgroundColor: '#fff',
                  color: colors.textBlack, // <-- FIX: Added text color
                }}
              />
              <button
                onClick={applyActivity}
                disabled={!activity.trim() || applying}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: `2px solid ${colors.textBlack}`,
                  backgroundColor: !activity.trim() || applying ? colors.disabledGray : colors.monopolyRed,
                  color: 'white',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  textShadow: `1px 1px 0 ${colors.textBlack}`,
                }}
              >
                {applying ? 'Submitting…' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}