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

  // 🎨 --- NEW MASCOT HELPER FUNCTION ---
  // This function returns a URL and color based on the energy level.
  // You can replace the URLs with your own mascot images.
  const getMascotData = (level: number | null) => {
    const score = level ?? 50; // Default to 'Okay' if null
    
    // 🎨 REPLACE THESE URLs WITH YOUR PNGs/JPEGs
    if (score >= 75) {
      return {
        // High Energy
        url: '/mascots/Energetic_Monopoly.png',
        color: '#4ade80'
      };
    }
    if (score >= 50) {
      // Medium Energy
      return {
        url: '/mascots/Neutral_Monopoly.png',
        color: '#facc15'
      };
    }
    if (score >= 25) {
      // Low Energy
      return {
        url: '/mascots/Exhausted_Monopoly_headlines.png',
        color: '#f87171'
      };
    }
    // < 25 (Very Low Energy)
    return {
      url: '/mascots/Exhausted_Monopoly_eyebags.png',
      color: '#ef4444'
    };
  };

  // 🎨 Get the mascot data objects before returning the JSX
  const mentalMascot = getMascotData(mental);
  const physicalMascot = getMascotData(physical);

  return (
    // 🎨 --- MAIN CONTAINER (Dark Theme) ---
    <div
      style={{
        maxWidth: 900,
        margin: '2rem auto',
        padding: '2rem',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        backgroundColor: '#1f2937', // 🎨 Dark slate background
        color: '#d1d5db', // 🎨 Light gray text
        borderRadius: '16px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)', // 🎨 Adjusted shadow for dark
      }}
    >
      {/* 🎨 --- HEADER --- */}
      <h1
        style={{
          fontSize: '2.25rem',
          marginBottom: '2rem',
          textAlign: 'center',
          fontWeight: '700',
          color: '#f9fafb', // 🎨 Bright white header
        }}
      >
        Energy Manager
      </h1>

      {/* 🎨 --- STEP 1: INPUT FORM --- */}
      {step === 1 && (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          
          {/* 🎨 --- CARD FOR PROFILE INFO (Dark) --- */}
          <div style={{
            padding: '1.5rem',
            backgroundColor: '#374151', // 🎨 Darker card
            borderRadius: '12px',
            display: 'grid',
            gap: '1.25rem'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', margin: '0 0 0.5rem 0', color: '#f9fafb' }}>Your Profile</h3>
            <div>
              <label style={{ fontWeight: '500', display: 'block', marginBottom: '0.5rem', color: '#d1d5db' }}>Name:</label>
              <input
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '1px solid #4b5563', // 🎨 Darker border
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                  backgroundColor: '#4b5563', // 🎨 Dark input
                  color: '#f9fafb', // 🎨 Light text
                }}
              />
            </div>
            <div>
              <label style={{ fontWeight: '500', display: 'block', marginBottom: '0.5rem', color: '#d1d5db' }}>Average Sleep (hours):</label>
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
                  border: '1px solid #4b5563',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                  backgroundColor: '#4b5563',
                  color: '#f9fafb',
                }}
              />
            </div>
            <div>
              <label style={{ fontWeight: '500', display: 'block', marginBottom: '0.5rem', color: '#d1d5db' }}>Work Style:</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {(['maker', 'manager', 'mixed'] as const).map((k) => (
                  <label
                    key={k}
                    style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      border: '1px solid #4b5563',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      // 🎨 Highlight selected radio in dark mode
                      backgroundColor: profile.workStyle === k ? '#4f46e5' : '#374151',
                      borderColor: profile.workStyle === k ? '#a5b4fc' : '#4b5563',
                      color: profile.workStyle === k ? '#ffffff' : '#d1d5db',
                      transition: 'all 0.2s',
                    }}
                  >
                    <input
                      type="radio"
                      name="workstyle"
                      checked={profile.workStyle === k}
                      onChange={() => setProfile({ ...profile, workStyle: k })}
                      style={{ accentColor: '#a5b4fc' }} // 🎨 Light indigo accent
                    />
                    {k.charAt(0).toUpperCase() + k.slice(1)}
                  </label>
                ))}
              </div>
            </div>
          </div>
          
          {/* 🎨 --- CARD FOR FREE TEXT / DOCX (Dark) --- */}
          <div style={{
            padding: '1.5rem',
            backgroundColor: '#374151', // 🎨 Darker card
            borderRadius: '12px',
            display: 'grid',
            gap: '1.25rem'
          }}>
             <h3 style={{ fontSize: '1.25rem', fontWeight: '600', margin: '0', color: '#f9fafb' }}>Context</h3>
            <div>
              <label style={{ fontWeight: '500', display: 'block', marginBottom: '0.5rem', color: '#d1d5db' }}>
                Free Text (paste schedule / journal / notes)
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '1px solid #4b5563',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  backgroundColor: '#4b5563',
                  color: '#f9fafb',
                }}
              />
            </div>

            <div>
              <label style={{ fontWeight: '500', display: 'block', marginBottom: '0.5rem', color: '#d1d5db' }}>Or upload .docx:</label>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={loadingDocx}
                // 🎨 Secondary button style (dark)
                style={{
                  padding: '0.6rem 1.25rem',
                  border: '1px solid #4f46e5',
                  backgroundColor: '#374151',
                  color: '#a5b4fc',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'background-color 0.2s',
                }}
              >
                Choose File
              </button>
              {fileName && <span style={{ marginLeft: 8, color: '#d1d5db' }}>Selected: {fileName}</span>}
              <input
                ref={fileRef}
                type="file"
                accept=".docx"
                hidden
                onChange={(e) => handleDocx(e.target.files)}
              />
              {loadingDocx && <div style={{ color: '#a5b4fc' }}>Parsing…</div>}
              {/* Display errors here */}
              {docxError && <div style={{ color: '#f87171', marginTop: '0.5rem' }}>{docxError}</div>}
            </div>
          </div>

          <div>
            {/* 🎨 Primary button style (unchanged, looks good on dark) */}
            <button
              onClick={runAnalyze}
              disabled={!canAnalyze || analyzing}
              style={{
                width: '100%',
                padding: '1rem',
                border: 'none',
                backgroundColor: !canAnalyze || analyzing ? '#4b5563' : '#4f46e5',
                color: !canAnalyze || analyzing ? '#9ca3af' : 'white',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '1.125rem',
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
          <h3 style={{ fontSize: '1.5rem', fontWeight: '600', textAlign: 'center', marginBottom: '1.5rem', color: '#f9fafb' }}>
            Current Energy
          </h3>
          
          {/* 🎨 --- NEW MASCOT CARD --- 🎨 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            marginBottom: '1.5rem',
            padding: '1.5rem',
            backgroundColor: '#374151', // Card background
            borderRadius: '12px',
            textAlign: 'center',
            color: '#d1d5db'
          }}>
            <div>
              <img 
                src={mentalMascot.url} 
                alt="Mental Energy Mascot" 
                style={{ 
                  width: 80, 
                  height: 80, 
                  borderRadius: '50%', 
                  margin: '0 auto',
                  border: `4px solid ${mentalMascot.color}` // Dynamic border color
                }} 
              />
              <p style={{ margin: '0.5rem 0 0 0', fontWeight: '600', fontSize: '1.1rem' }}>Mental: {mental}%</p>
            </div>
            <div>
              <img 
                src={physicalMascot.url} 
                alt="Physical Energy Mascot" 
                style={{ 
                  width: 80, 
                  height: 80, 
                  borderRadius: '50%', 
                  margin: '0 auto',
                  border: `4px solid ${physicalMascot.color}` // Dynamic border color
                }} 
              />
              <p style={{ margin: '0.5rem 0 0 0', fontWeight: '600', fontSize: '1.1rem' }}>Physical: {physical}%</p>
            </div>
          </div>
          {/* 🎨 --- END MASCOT CARD --- 🎨 */}


          {/* 🎨 --- CHART CARD (Dark) --- */}
          <div
            style={{
              width: '100%',
              height: 320,
              border: 'none',
              borderRadius: '12px',
              padding: '1.5rem',
              backgroundColor: '#374151', // Dark card
              boxSizing: 'border-box'
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData as any}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                <XAxis dataKey="kind" axisLine={false} tickLine={false} tick={{ fill: '#d1d5db' }} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#d1d5db' }} />
                <Tooltip
                  cursor={{ fill: '#4b5563', radius: 8 }}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #4b5563',
                    backgroundColor: '#1f2937', // Dark tooltip
                  }}
                  labelStyle={{ color: '#f9fafb' }}
                />
                <Legend wrapperStyle={{ paddingTop: '1rem' }} />
                <Bar dataKey="value" name="Current" fill="#4f46e5" radius={[8, 8, 0, 0]} />
                {baseline && (
                  <Bar dataKey="baseline" name="Baseline" fill="#a5b4fc" radius={[8, 8, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 🎨 --- DELTA MESSAGE (Dark) --- */}
          {lastDelta && (
            <div
              style={{
                marginTop: '1.5rem',
                color: '#d1d5db',
                backgroundColor: '#374151', // Dark card
                padding: '1rem',
                borderRadius: '8px',
                textAlign: 'center',
                fontWeight: '500'
              }}
            >
              Recent Activity Impact: 
              <span style={{ color: lastDelta.mental >= 0 ? '#4ade80' : '#f87171', fontWeight: '700' }}>
                {' '}Mental {lastDelta.mental >= 0 ? '+' : ''}{lastDelta.mental}
              </span>,
              <span style={{ color: lastDelta.physical >= 0 ? '#4ade80' : '#f87171', fontWeight: '700' }}>
                {' '}Physical {lastDelta.physical >= 0 ? '+' : ''}{lastDelta.physical}
              </span>
            </div>
          )}
          
          {/* Display errors from applyActivity here */}
          {docxError && step >= 2 && <div style={{ color: '#f87171', marginTop: '1rem', textAlign: 'center' }}>{docxError}</div>}
        </div>
      )}

      {/* 🎨 --- ACTIVITY INPUT (Dark) --- */}
      {step >= 2 && (
        <div 
          style={{
            marginTop: '2rem',
            padding: '1.5rem',
            backgroundColor: '#374151', // Dark card
            borderRadius: '12px',
          }}
        >
          <label style={{ fontWeight: '600', fontSize: '1.125rem', display: 'block', marginBottom: '1rem', color: '#f9fafb' }}>
            Apply an Activity
          </label>
          <p style={{ color: '#d1d5db', marginTop: 0, marginBottom: '1rem', fontSize: '0.9rem'}}>
            (e.g. 20min nap / coffee / 30min run / deep work 45m)
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                border: '1px solid #4b5563',
                borderRadius: '8px',
                backgroundColor: '#4b5563',
                color: '#f9fafb',
              }}
            />
            <button
              onClick={applyActivity}
              disabled={!activity.trim() || applying}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                backgroundColor: !activity.trim() || applying ? '#4b5563' : '#4f46e5',
                color: !activity.trim() || applying ? '#9ca3af' : 'white',
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