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
    setDocxError(null); // Clear previous errors
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

      // --- MERGED FEATURE: Save to cloud storage ---
      // This is the new code you added.
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
      // --- END MERGED FEATURE ---

    } catch (e) {
      console.error(e);
      // Use the UI error state instead of alert()
      setDocxError(`Backend analysis failed. Please check the API. (${(e as Error).message})`);
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
    setDocxError(null); // Clear previous errors
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
      setStep(3); // setStep(2) would also be fine, as step >= 2 shows the chart
    } catch (e) {
      console.error(e);
      // Use the UI error state instead of alert()
      setDocxError(`Backend applyActivity failed. Please check the API. (${(e as Error).message})`);
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
    // 🎨 --- MAIN CONTAINER ---
    // Change the background, text color, and font for the whole app.
    <div
      style={{
        maxWidth: 900,
        margin: '2rem auto', // 🎨 Added more vertical margin
        padding: '2rem', // 🎨 Added overall padding
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        backgroundColor: '#f9fafb', // 🎨 Light gray background
        color: '#1f2937', // 🎨 Darker text
        borderRadius: '16px', // 🎨 Rounded corners for the whole container
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.05)', // 🎨 Soft shadow
      }}
    >
      {/* 🎨 --- HEADER --- */}
      <h1
        style={{
          fontSize: '2.25rem', // 🎨 Bigger font
          marginBottom: '2rem', // 🎨 More space below header
          textAlign: 'center', // 🎨 Centered text
          fontWeight: '700', // 🎨 Bolder
          color: '#374151', // 🎨 Slightly lighter header color
        }}
      >
        Energy Manager
      </h1>

      {/* 🎨 --- STEP 1: INPUT FORM --- */}
      {step === 1 && (
        <div style={{ display: 'grid', gap: '1.5rem' }}> {/* 🎨 Increased gap */}
          
          {/* 🎨 --- CARD FOR PROFILE INFO --- */}
          <div style={{
            padding: '1.5rem',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.03)',
            display: 'grid',
            gap: '1.25rem'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', margin: '0 0 0.5rem 0' }}>Your Profile</h3>
            <div>
              {/* 🎨 Style the <label> */}
              <label style={{ fontWeight: '500', display: 'block', marginBottom: '0.5rem' }}>Name:</label>
              <input
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                // 🎨 Style the <input>
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  boxSizing: 'border-box', // 🎨 Fixes padding issue
                }}
              />
            </div>
            <div>
              <label style={{ fontWeight: '500', display: 'block', marginBottom: '0.5rem' }}>Average Sleep (hours):</label>
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
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontWeight: '500', display: 'block', marginBottom: '0.5rem' }}>Work Style:</label>
              {/* 🎨 Make radio buttons more appealing */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                {(['maker', 'manager', 'mixed'] as const).map((k) => (
                  <label
                    key={k}
                    style={{
                      flex: 1, // 🎨 Make them stretch
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      // 🎨 Highlight the selected one
                      backgroundColor: profile.workStyle === k ? '#e0e7ff' : '#ffffff',
                      borderColor: profile.workStyle === k ? '#4f46e5' : '#d1d5db',
                    }}
                  >
                    <input
                      type="radio"
                      name="workstyle"
                      checked={profile.workStyle === k}
                      onChange={() => setProfile({ ...profile, workStyle: k })}
                      style={{ accentColor: '#4f46e5' }} // 🎨 Changes radio button color
                    />
                    {k.charAt(0).toUpperCase() + k.slice(1)} {/* 🎨 Capitalized */}
                  </label>
                ))}
              </div>
            </div>
          </div>
          
          {/* 🎨 --- CARD FOR FREE TEXT / DOCX --- */}
          <div style={{
            padding: '1.5rem',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.03)',
            display: 'grid',
            gap: '1.25rem'
          }}>
             <h3 style={{ fontSize: '1.25rem', fontWeight: '600', margin: '0' }}>Context</h3>
            <div>
              <label style={{ fontWeight: '500', display: 'block', marginBottom: '0.5rem' }}>
                Free Text (paste schedule / journal / notes)
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit', // 🎨 Use the app's font
                }}
              />
            </div>

            <div>
              <label style={{ fontWeight: '500', display: 'block', marginBottom: '0.5rem' }}>Or upload .docx:</label>
              {/* 🎨 --- STYLE THE BUTTONS --- */}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={loadingDocx}
                // 🎨 Secondary button style
                style={{
                  padding: '0.6rem 1.25rem',
                  border: '1px solid #4f46e5',
                  backgroundColor: '#ffffff',
                  color: '#4f46e5',
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
              {loadingDocx && <div style={{ color: '#4f46e5' }}>Parsing…</div>}
              {/* Display errors here */}
              {docxError && <div style={{ color: '#dc2626', marginTop: '0.5rem' }}>{docxError}</div>}
            </div>
          </div>

          <div>
            {/* 🎨 Primary button style */}
            <button
              onClick={runAnalyze}
              disabled={!canAnalyze || analyzing}
              style={{
                width: '100%', // 🎨 Make it full width
                padding: '1rem',
                border: 'none',
                backgroundColor: !canAnalyze || analyzing ? '#d1d5db' : '#4f46e5', // 🎨 Indigo color, gray when disabled
                color: 'white',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '1.125rem', // 🎨 Larger text
                transition: 'background-color 0.2s',
              }}
            >
              {analyzing ? 'Analyzing…' : 'Analyze My Energy'}
            </button>
          </div>
        </div>
      )}

      {/* 🎨 --- STEP 2 & 3: DASHBOARD --- */}
      {step >= 2 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '600', textAlign: 'center', marginBottom: '1.5rem' }}>
            Current Energy (%)
          </h3>
          <div
            // 🎨 --- STYLE THE CHART CONTAINER (make it a "card") ---
            style={{
              width: '100%',
              height: 320,
              border: 'none', // 🎨 Remove default border
              borderRadius: '12px',
              padding: '1.5rem', // 🎨 Add padding
              backgroundColor: '#ffffff',
              boxShadow: '0 4px 10px rgba(0, 0, 0, 0.03)',
              boxSizing: 'border-box'
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData as any}>
                {/* 🎨 Style the chart grid */}
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="kind" axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} />
                {/* 🎨 Style the tooltip */}
                <Tooltip
                  cursor={{ fill: '#f3f4f6', radius: 8 }}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.05)',
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: '1rem' }} />
                {/* 🎨 --- CHANGE BAR COLORS HERE --- */}
                <Bar dataKey="value" name="Current" fill="#4f46e5" radius={[8, 8, 0, 0]} />
                {baseline && (
                  <Bar dataKey="baseline" name="Baseline" fill="#a5b4fc" radius={[8, 8, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 🎨 --- STYLE THE DELTA MESSAGE --- */}
          {lastDelta && (
            <div
              style={{
                marginTop: '1.5rem',
                color: '#374151',
                backgroundColor: '#f3f4f6',
                padding: '1rem',
                borderRadius: '8px',
                textAlign: 'center',
                fontWeight: '500'
              }}
            >
              {/* 🎨 Add color to the deltas */}
              Recent Activity Impact: 
              <span style={{ color: lastDelta.mental >= 0 ? '#10b981' : '#ef4444', fontWeight: '700' }}>
                {' '}Mental {lastDelta.mental >= 0 ? '+' : ''}{lastDelta.mental}
              </span>,
              <span style={{ color: lastDelta.physical >= 0 ? '#10b981' : '#ef4444', fontWeight: '700' }}>
                {' '}Physical {lastDelta.physical >= 0 ? '+' : ''}{lastDelta.physical}
              </span>
            </div>
          )}
          
          {/* Display errorss from applyActivity here */}
          {docxError && step >= 2 && <div style={{ color: '#dc2626', marginTop: '1rem', textAlign: 'center' }}>{docxError}</div>}
        </div>
      )}

      {/* 🎨 --- STEP 2 & 3: ACTIVITY INPUT --- */}
      {step >= 2 && (
        <div 
          // 🎨 Style this section as a card
          style={{
            marginTop: '2rem',
            padding: '1.5rem',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.03)',
          }}
        >
          <label style={{ fontWeight: '600', fontSize: '1.125rem', display: 'block', marginBottom: '1rem' }}>
            Apply an Activity
          </label>
          <p style={{ color: '#555', marginTop: 0, marginBottom: '1rem', fontSize: '0.9rem'}}>
            (e.g. 20min nap / coffee / 30min run / deep work 45m)
          </p>
          {/* 🎨 Use a flex container to align input and button */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              // 🎨 Style the input
              style={{
                flex: 1, // 🎨 Make it grow
                padding: '0.75rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
              }}
            />
            <button
              onClick={applyActivity}
              disabled={!activity.trim() || applying}
              // 🎨 Style the button
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                backgroundColor: !activity.trim() || applying ? '#d1d5db' : '#4f46e5',
                color: 'white',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'background-color 0.2s',
              }}
            >
              {applying ? 'Submitting…' : 'Update'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}