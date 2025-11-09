import { NextResponse } from 'next/server';

/**
 * NEW (v2) Helper Function: Parses duration from the activity string.
 * Uses regex to find numbers and units (hr, min, m, h).
 * @param activity The user's input string.
 * @returns The duration in hours (e.g., 0.5, 1, 2.5), or null if no time is found.
 */
function parseDuration(activity: string): number | null {
  // Regex to find a number followed by a unit (e.g., "10 hr", "45min", "1.5h")
  const timeRegex = /(\d+(\.\d+)?)\s*(hour|hr|h|min|m|minute|minutes)/g;
  
  let totalHours = 0;
  let matchFound = false;
  let match;

  while ((match = timeRegex.exec(activity)) !== null) {
    matchFound = true;
    const value = parseFloat(match[1]); // The number (e.g., 10, 45, 1.5)
    const unit = match[3].toLowerCase(); // The unit (e.g., hr, min, m)

    if (unit.startsWith('min') || unit === 'm') {
      totalHours += value / 60; // Convert minutes to hours
    } else if (unit.startsWith('hour') || unit === 'h') {
      totalHours += value; // Already in hours
    }
  }

  if (!matchFound) {
    // Check for just a number, e.g., "worked for 10"
    const numberOnlyRegex = /\b(\d+(\.\d+)?)\b/g;
    let numberMatch;
    let numbersFound = [];
    while ((numberMatch = numberOnlyRegex.exec(activity)) !== null) {
      // Avoid matching numbers that are part of other words (like '30m')
      // This is a simple check, we assume the *first* number found is the duration
      if (numbersFound.length === 0) {
        numbersFound.push(parseFloat(numberMatch[1]));
      }
    }
    
    if (numbersFound.length > 0) {
      // No unit found, assume hours as a default (e.g., "worked for 10")
      return numbersFound[0];
    }

    return null; // No duration found
  }

  return totalHours;
}


export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  const activity: string = String(body?.activity ?? "").toLowerCase();
  const current = body?.current ?? { mental: 50, physical: 50 };

  let dM = 0; // delta for mental
  let dP = 0; // delta for physical

  // Parse the duration from the string
  const durationInHours = parseDuration(activity);

  // --- NEW (v2) Scaled & Edge Case Logic ---

  // Mutually exclusive activities (use 'if...else if')
  // These are primary activities like sleeping or working.

  if (/nap|sleep|slept|rest(ed)?/.test(activity)) {
    // --- Special Sleep Logic ---
    // Use a default of 8 hours if user just types "sleep"
    const duration = durationInHours ?? 8; 

    if (duration > 14) {
      // Absurd sleep (e.g., 24 hours)
      dM -= 30; // Very groggy, disoriented
      dP -= 20; // Atrophied
    } else if (duration > 9.5) {
      // Overslept (e.g., 10 hours)
      dM -= 10; // Groggy
      dP -= 5;
    } else if (duration >= 7) {
      // Optimal sleep (7-9.5 hours)
      dM += 25; // Great mental boost
      dP += 20; // Great physical boost
    } else if (duration >= 1) {
      // Short sleep (1-6 hours)
      dM += duration * 3; // Proportional boost
      dP += duration * 2;
    } else {
      // Short nap (less than 1 hour)
      // Assume optimal 20-30 min nap
      dM += 15; // Good mental boost
      dP += 5;
    }
  } 
  else if (/study|stud(y|ied|ying)|deep work|cod(e|ing)|work(ed)?|meeting/.test(activity)) {
    // --- Work / Study Logic ---
    // Use a default of 1.5 hours if no time is specified
    const duration = durationInHours ?? 1.5;
    dM -= duration * 5; // Mental drain
    dP -= duration * 2; // Physical drain (sitting)
  } 
  else if (/run|ran|running|jog(ged)?|workout|gym/.test(activity)) {
    // --- High-Intensity Exercise Logic ---
    const duration = durationInHours ?? 1;
    dP += duration * 10; // Strong physical gain
    dM += duration * 4; // Good mental gain (endorphins)
  }
  else if (/walk(ed)?|stretch(ed)?/.test(activity)) {
    // --- Low-Intensity Exercise Logic ---
    const duration = durationInHours ?? 0.5;
    dP += duration * 5;
    dM += duration * 5;
  }
  else if (/yoga|meditat(e|ion|ing|ed)|mindful/.test(activity)) {
    // --- Mindfulness Logic ---
    const duration = durationInHours ?? 0.5;
    dM += duration * 15; // Strong mental gain
    dP += duration * 4;
  }

  // --- Stackable Modifiers ---
  // These are things that can be *added* to other activities.

  if (/coffee|caffeine|tea/.test(activity)) {
    dM += 10; // Flat boost
    dP += 2;
  }
  if (/heavy meal|fast food|sugar|eat|ate|eating/.test(activity)) {
    dP -= 10; // Food coma
    dM -= 5;
  }
  if (/drink|drank|drinking|alcohol/.test(activity)) {
    dP -= 15;
    dM -= 10;
  }
  if (/gam(e|ed|ing)|doomscroll(ed|ing)?|scroll(ed|ing)?|social media/.test(activity)) {
    // Assume duration-based drain
    const duration = durationInHours ?? 1;
    dM -= duration * 4;
  }
  
  // --- Calculate new values and clamp between 0-100 ---
  const newM = Math.max(0, Math.min(100, current.mental + dM));
  const newP = Math.max(0, Math.min(100, current.physical + dP));

  return NextResponse.json({
    delta: { mental: Math.round(dM), physical: Math.round(dP) },
    newVals: { mental: newM, physical: newP },
  });
}