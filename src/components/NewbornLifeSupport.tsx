import React, { useState, useEffect, useRef } from 'react';
import {
  Heart,
  Wind,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clipboard,
  RotateCw,
  ChevronRight,
  XSquare,
  Syringe,
  Volume2,
  VolumeX,
  ArrowLeft,
  Undo,
  Zap,
  Activity,
  Square,
} from 'lucide-react';
import {
  getFirestore,
  collection,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import { getApps } from 'firebase/app';

// ============================================================================
// NLS TYPES — matches iOS NLSState enum exactly
// ============================================================================

enum NLSState {
  InitialAssessment = "INITIAL_ASSESSMENT",
  InflationBreaths = "INFLATION_BREATHS",
  OptimiseAirway = "OPTIMISE_AIRWAY",
  AdvancedAirway = "ADVANCED_AIRWAY",
  Ventilation = "VENTILATION",
  ContinueVentilation = "CONTINUE_VENTILATION",
  Compressions = "COMPRESSIONS",
}

enum NLSBirthType {
  Preterm = "PRETERM",
  Term = "TERM",
}

enum NLSArrestState {
  Pending = "PENDING",
  Active = "ACTIVE",
  Rosc = "ROSC",
  Ended = "ENDED",
}

interface NLSEvent {
  timestamp: number;
  message: string;
  category: string;
}

// ============================================================================
// HELPERS
// ============================================================================
const formatTime = (seconds: number): string => {
  const t = Math.max(0, seconds);
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const formatTimeSplit = (seconds: number): { mins: string; secs: string } => {
  const t = Math.max(0, seconds);
  return {
    mins: String(Math.floor(t / 60)).padStart(2, '0'),
    secs: String(Math.floor(t % 60)).padStart(2, '0'),
  };
};

const NLS_SESSION_KEY = 'eresus_nls_session';

const getFirebaseDb = () => {
  const apps = getApps();
  if (apps.length > 0) return getFirestore(apps[0]);
  return null;
};

const getUserId = (): string => {
  const stored = localStorage.getItem('eresus_user_id');
  if (stored) return stored;
  const newId = crypto.randomUUID();
  localStorage.setItem('eresus_user_id', newId);
  return newId;
};

const getSpO2Targets = () => [
  { time: '2 min', target: '60%' },
  { time: '3 min', target: '70-75%' },
  { time: '5 min', target: '80-85%' },
  { time: '10 min', target: '85-95%' },
];

// ============================================================================
// METRONOME (3:1 ratio for NLS — 120 events/min)
// ============================================================================
class NLSMetronome {
  private audioContext: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private _isPlaying = false;
  private beatCount = 0;

  async start() {
    if (this._isPlaying) return;
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this.audioContext.state === 'suspended') await this.audioContext.resume();
    } catch { return; }
    
    this._isPlaying = true;
    this.beatCount = 0;
    const interval = 500; // 120 events/min = 500ms each
    this.playBeat();
    this.timer = setInterval(() => this.playBeat(), interval);
  }

  private playBeat() {
    if (!this.audioContext || this.audioContext.state !== 'running') return;
    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    // Every 4th beat is the breath (higher pitch)
    const isBreath = this.beatCount % 4 === 3;
    osc.frequency.setValueAtTime(isBreath ? 1200 : 800, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
    this.beatCount++;
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this._isPlaying = false;
    if (this.audioContext) { this.audioContext.close().catch(() => {}); this.audioContext = null; }
  }

  get isPlaying() { return this._isPlaying; }
}

const nlsMetronome = new NLSMetronome();

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface NewbornLifeSupportProps {
  onBack: () => void;
}

const NewbornLifeSupport: React.FC<NewbornLifeSupportProps> = ({ onBack }) => {
  // --- Restore saved session ---
  const savedNls = useRef<any>(null);
  const didRestore = useRef(false);
  if (!didRestore.current) {
    try {
      const raw = localStorage.getItem(NLS_SESSION_KEY);
      if (raw) savedNls.current = JSON.parse(raw);
    } catch { /* ignore */ }
    didRestore.current = true;
  }
  const ns = savedNls.current;
  const hasRecoverableSession = ns != null && ns.arrestState === NLSArrestState.Active;

  // --- Core state (matching iOS ArrestViewModel) ---
  const [arrestState, setArrestState] = useState<NLSArrestState>(hasRecoverableSession ? NLSArrestState.Pending : NLSArrestState.Pending);
  const [nlsState, setNlsState] = useState<NLSState>(ns?.nlsState ?? NLSState.InitialAssessment);
  const [birthType, setBirthType] = useState<NLSBirthType | null>(ns?.birthType ?? null);
  const [isPreterm, setIsPreterm] = useState(ns?.isPreterm ?? false);
  const [masterTime, setMasterTime] = useState(0);
  const [timeOffset, setTimeOffset] = useState(ns?.timeOffset ?? 0);
  const [nlsCycleDuration, setNlsCycleDuration] = useState(ns?.nlsCycleDuration ?? 60);
  const [cprTime, setCprTime] = useState(ns?.cprTime ?? 60);
  const [isRhythmCheckDue, setIsRhythmCheckDue] = useState(false);
  const [events, setEvents] = useState<NLSEvent[]>(ns?.events ?? []);

  // Counters
  const [adrenalineCount, setAdrenalineCount] = useState(ns?.adrenalineCount ?? 0);
  const [inflationBreathsGiven, setInflationBreathsGiven] = useState(ns?.inflationBreathsGiven ?? 0);
  const [compressionCycles, setCompressionCycles] = useState(ns?.compressionCycles ?? 0);
  const [fio2, setFio2] = useState(ns?.fio2 ?? '21');
  const [vascularAccess, setVascularAccess] = useState(ns?.vascularAccess ?? false);
  const [volumeGiven, setVolumeGiven] = useState(ns?.volumeGiven ?? false);

  // Timer refs
  const startTimeRef = useRef<Date | null>(ns?.startTime ? new Date(ns.startTime) : null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cprCycleStartTimeRef = useRef(ns?.cprCycleStartTime ?? 0);

  // Metronome
  const [metronomeOn, setMetronomeOn] = useState(false);

  // Undo
  const [undoStack, setUndoStack] = useState<any[]>([]);

  // Modals
  const [showSummary, setShowSummary] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showConfirmBack, setShowConfirmBack] = useState(false);
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(hasRecoverableSession);

  // Computed
  const totalArrestTime = masterTime + timeOffset;

  // --- Session Persistence ---
  useEffect(() => {
    if (arrestState === NLSArrestState.Pending) {
      if (!showRecoveryPrompt) localStorage.removeItem(NLS_SESSION_KEY);
      return;
    }
    const session = {
      arrestState, nlsState, birthType, isPreterm, events, timeOffset,
      nlsCycleDuration, cprTime, adrenalineCount, inflationBreathsGiven,
      compressionCycles, fio2, vascularAccess, volumeGiven,
      startTime: startTimeRef.current?.toISOString() ?? null,
      cprCycleStartTime: cprCycleStartTimeRef.current,
    };
    try { localStorage.setItem(NLS_SESSION_KEY, JSON.stringify(session)); } catch { }
  }, [arrestState, nlsState, birthType, isPreterm, events, timeOffset,
      nlsCycleDuration, cprTime, adrenalineCount, inflationBreathsGiven,
      compressionCycles, fio2, vascularAccess, volumeGiven, showRecoveryPrompt]);

  // --- Timer ---
  useEffect(() => {
    if (arrestState === NLSArrestState.Active && startTimeRef.current) {
      timerRef.current = setInterval(() => {
        if (!startTimeRef.current) return;
        const newMaster = (Date.now() - startTimeRef.current.getTime()) / 1000;
        setMasterTime(newMaster);
        
        // Update CPR/reassess timer
        const total = newMaster + timeOffset;
        const cycleDur = nlsCycleDuration;
        const newCpr = cycleDur - (total - cprCycleStartTimeRef.current);
        setCprTime(newCpr);
        
        if (newCpr <= 0) {
          setIsRhythmCheckDue(true);
        }
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [arrestState, timeOffset, nlsCycleDuration]);

  // --- Undo ---
  const saveUndo = () => {
    setUndoStack(prev => [...prev.slice(-19), {
      arrestState, nlsState, events: [...events], adrenalineCount,
      inflationBreathsGiven, compressionCycles, fio2, vascularAccess,
      volumeGiven, isRhythmCheckDue, nlsCycleDuration,
      cprCycleStartTime: cprCycleStartTimeRef.current,
    }]);
  };

  const undo = () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setNlsState(last.nlsState);
    setEvents(last.events);
    setAdrenalineCount(last.adrenalineCount);
    setInflationBreathsGiven(last.inflationBreathsGiven);
    setCompressionCycles(last.compressionCycles);
    setFio2(last.fio2);
    setVascularAccess(last.vascularAccess);
    setVolumeGiven(last.volumeGiven);
    setIsRhythmCheckDue(last.isRhythmCheckDue);
    setNlsCycleDuration(last.nlsCycleDuration);
    cprCycleStartTimeRef.current = last.cprCycleStartTime;
    setUndoStack(prev => prev.slice(0, -1));
    if (navigator.vibrate) navigator.vibrate(10);
  };

  // --- Event Logger ---
  const logEvent = (message: string, category: string = 'status') => {
    setEvents(prev => [{ timestamp: totalArrestTime, message, category }, ...prev]);
    if (navigator.vibrate) navigator.vibrate(10);
  };

  // --- Reset NLS Timer ---
  const resetNLSTimer = () => {
    cprCycleStartTimeRef.current = totalArrestTime;
    setCprTime(nlsCycleDuration);
    setIsRhythmCheckDue(false);
  };

  // --- Advance NLS (matches iOS exactly) ---
  const advanceNLS = (state: NLSState) => {
    saveUndo();
    setNlsState(state);
    setIsRhythmCheckDue(false);

    let dur = 30;
    switch (state) {
      case NLSState.InitialAssessment:
        dur = 60;
        logEvent("Returned to Initial Assessment");
        break;
      case NLSState.InflationBreaths:
        logEvent("Moved to Airway & Inflation Breaths", "airway");
        break;
      case NLSState.OptimiseAirway:
        logEvent("Moved to Optimise Airway Troubleshooting", "airway");
        break;
      case NLSState.AdvancedAirway:
        logEvent("Moved to Advanced Airway interventions", "airway");
        break;
      case NLSState.Ventilation:
        logEvent("Started Ventilation Breaths (30/min)", "airway");
        break;
      case NLSState.ContinueVentilation:
        logEvent("Continuing Ventilation (HR ≥ 60)", "airway");
        break;
      case NLSState.Compressions:
        logEvent("Started Chest Compressions (3:1 Ratio, 100% O₂)", "cpr");
        setFio2('100');
        break;
    }

    setNlsCycleDuration(dur);
    setCprTime(dur);
    cprCycleStartTimeRef.current = totalArrestTime;
  };

  // --- Core Actions ---
  const startNewborn = (preterm: boolean) => {
    startTimeRef.current = new Date();
    setIsPreterm(preterm);
    setBirthType(preterm ? NLSBirthType.Preterm : NLSBirthType.Term);
    setArrestState(NLSArrestState.Active);
    setNlsState(NLSState.InitialAssessment);
    setNlsCycleDuration(60);
    setCprTime(60);
    cprCycleStartTimeRef.current = 0;

    const typeStr = preterm ? "Preterm (<32w) Life Support" : "Newborn (Term) Life Support";
    logEvent(`${typeStr} Started at ${new Date().toLocaleTimeString()}`);
    if (preterm) {
      logEvent("Placed in plastic bag + radiant heat.");
    } else {
      logEvent("Dried and wrapped. Stimulated.");
    }
  };

  const achieveROSC = () => {
    saveUndo();
    setArrestState(NLSArrestState.Rosc);
    setIsRhythmCheckDue(false);
    nlsMetronome.stop();
    setMetronomeOn(false);
    logEvent("HR > 100 / Spontaneous Breathing Established");
  };

  const endResuscitation = () => {
    saveUndo();
    setArrestState(NLSArrestState.Ended);
    if (timerRef.current) clearInterval(timerRef.current);
    nlsMetronome.stop();
    setMetronomeOn(false);
    logEvent("Resuscitation Ended");
  };

  const reassessPatient = () => {
    saveUndo();
    resetNLSTimer();
    logEvent("Reassessed Patient HR and Chest Rise");
  };

  const addTimeOffset = (seconds: number) => {
    saveUndo();
    setTimeOffset(prev => prev + seconds);
    logEvent(`Time offset added: +${Math.round(seconds / 60)} min`);
  };

  const toggleMetronome = async () => {
    if (metronomeOn) {
      nlsMetronome.stop();
      setMetronomeOn(false);
    } else {
      await nlsMetronome.start();
      setMetronomeOn(nlsMetronome.isPlaying);
    }
  };

  // --- Save to logbook ---
  const saveToLogbook = async () => {
    if (!startTimeRef.current) return;
    try {
      const db = getFirebaseDb();
      if (!db) return;
      const userId = getUserId();
      const appId = 'eresus-6e65e';
      const path = `/artifacts/${appId}/users/${userId}/logs`;
      const outcome = arrestState === NLSArrestState.Rosc ? 'ROSC' :
                      arrestState === NLSArrestState.Ended ? 'Complete' : 'Incomplete';
      const logDoc = {
        startTime: Timestamp.fromDate(startTimeRef.current),
        totalDuration: totalArrestTime,
        finalOutcome: outcome,
        userId, type: 'NLS', birthType,
      };
      const logDocRef = await addDoc(collection(db, path), logDoc);
      const eventsRef = collection(db, `${path}/${logDocRef.id}/events`);
      for (const event of events) {
        await addDoc(eventsRef, { timestamp: event.timestamp, message: event.message, type: event.category });
      }
    } catch (e) { console.error("Error saving NLS log:", e); }
  };

  const copySummary = () => {
    const sorted = [...events].reverse();
    const text = `eResus — Newborn Life Support Summary\nTotal Time: ${formatTime(totalArrestTime)}\nBirth Type: ${isPreterm ? 'Preterm (<32 weeks)' : 'Term/Near-term'}\n\n--- Event Log ---\n${sorted.map(e => `[${formatTime(e.timestamp)}] ${e.message}`).join('\n')}`;
    navigator.clipboard.writeText(text.trim()).catch(console.error);
    if (navigator.vibrate) navigator.vibrate([10, 50, 10]);
  };

  const performReset = async (shouldSave: boolean, shouldCopy: boolean) => {
    if (shouldSave) await saveToLogbook();
    if (shouldCopy) copySummary();
    if (timerRef.current) clearInterval(timerRef.current);
    nlsMetronome.stop();
    setMetronomeOn(false);
    setArrestState(NLSArrestState.Pending);
    setNlsState(NLSState.InitialAssessment);
    setBirthType(null);
    setIsPreterm(false);
    setMasterTime(0);
    setTimeOffset(0);
    setCprTime(60);
    setNlsCycleDuration(60);
    setIsRhythmCheckDue(false);
    setEvents([]);
    setUndoStack([]);
    setAdrenalineCount(0);
    setInflationBreathsGiven(0);
    setCompressionCycles(0);
    setFio2('21');
    setVascularAccess(false);
    setVolumeGiven(false);
    startTimeRef.current = null;
    cprCycleStartTimeRef.current = 0;
    localStorage.removeItem(NLS_SESSION_KEY);
  };

  // Recovery
  const resumeSession = () => {
    setShowRecoveryPrompt(false);
    if (ns) {
      setArrestState(NLSArrestState.Active);
      setNlsState(ns.nlsState);
    }
  };

  const discardSession = async () => {
    setShowRecoveryPrompt(false);
    if (startTimeRef.current && events.length > 0) {
      try {
        const db = getFirebaseDb();
        if (db) {
          const userId = getUserId();
          const appId = 'eresus-6e65e';
          const path = `/artifacts/${appId}/users/${userId}/logs`;
          const logDocRef = await addDoc(collection(db, path), {
            startTime: Timestamp.fromDate(startTimeRef.current),
            totalDuration: totalArrestTime,
            finalOutcome: 'NLS Incomplete (recovered)',
            userId, type: 'NLS', birthType,
          });
          const eventsRef = collection(db, `${path}/${logDocRef.id}/events`);
          for (const event of events) {
            await addDoc(eventsRef, { timestamp: event.timestamp, message: event.message, type: event.category });
          }
        }
      } catch (e) { console.error(e); }
    }
    await performReset(false, false);
  };

  const handleBack = () => {
    if (arrestState === NLSArrestState.Active) {
      setShowConfirmBack(true);
    } else {
      localStorage.removeItem(NLS_SESSION_KEY);
      onBack();
    }
  };

  const confirmBack = async () => {
    await saveToLogbook();
    if (timerRef.current) clearInterval(timerRef.current);
    nlsMetronome.stop();
    setShowConfirmBack(false);
    localStorage.removeItem(NLS_SESSION_KEY);
    onBack();
  };

  // Cleanup metronome on unmount
  useEffect(() => {
    return () => { nlsMetronome.stop(); };
  }, []);

  // --- Computed display ---
  const mainTimeSplit = formatTimeSplit(totalArrestTime);
  const reassessTimeSplit = formatTimeSplit(Math.max(0, cprTime));
  const isActive = arrestState === NLSArrestState.Active;

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="flex flex-col h-full bg-black text-white">
      {/* ===== HEADER — matches iOS eResus header ===== */}
      <div className={`p-4 transition-colors duration-300 ${
        isRhythmCheckDue && isActive ? 'bg-red-700 animate-pulse' : ''
      }`}>
        <div className="flex justify-between items-start mb-1">
          <div className="flex items-center space-x-2">
            <button onClick={handleBack} className="p-1 text-gray-400 hover:text-white">
              <ArrowLeft size={22} />
            </button>
            <div>
              <h1 className="text-3xl font-black tracking-tight">eResus</h1>
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                arrestState === NLSArrestState.Active ? 'bg-red-600 text-white' :
                arrestState === NLSArrestState.Rosc ? 'bg-green-600 text-white' :
                arrestState === NLSArrestState.Ended ? 'bg-gray-600 text-white' :
                'bg-gray-600 text-gray-300'
              }`}>
                {arrestState === NLSArrestState.Active ? 'ACTIVE' :
                 arrestState === NLSArrestState.Rosc ? 'ROSC' :
                 arrestState === NLSArrestState.Ended ? 'ENDED' : 'PENDING'}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-4xl font-bold text-cyan-400">
              {mainTimeSplit.mins}<span className="mx-0.5">:</span>{mainTimeSplit.secs}
            </div>
            {isActive && (
              <div className="flex justify-end space-x-1 mt-1">
                {[1, 5, 10].map(m => (
                  <button key={m} onClick={() => addTimeOffset(m * 60)}
                    className="px-2 py-0.5 text-xs font-semibold rounded border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400">
                    +{m}m
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-grow overflow-y-auto px-4 pb-40 space-y-4">
        
        {/* REASSESS IN timer (only when active and not pending) */}
        {isActive && (
          <div className="flex justify-center">
            <div className="px-6 py-3 rounded-2xl border-2 border-cyan-800 bg-gray-900 text-center">
              <div className={`font-mono text-3xl font-bold ${cprTime <= 5 ? 'text-red-400' : 'text-white'}`}>
                {reassessTimeSplit.mins}:{reassessTimeSplit.secs}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                Reassess In
              </div>
            </div>
          </div>
        )}

        {/* ===== PENDING — Birth type selection ===== */}
        {arrestState === NLSArrestState.Pending && !showRecoveryPrompt && (
          <div className="space-y-4 pt-4">
            <p className="text-center text-gray-500 text-sm">Select Newborn Type</p>
            <button onClick={() => startNewborn(false)}
              className="w-full py-5 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xl font-bold active:scale-95 transition-transform">
              Term (≥32 Weeks)
            </button>
            <button onClick={() => startNewborn(true)}
              className="w-full py-5 rounded-2xl bg-gradient-to-r from-indigo-400 to-purple-400 text-white text-xl font-bold active:scale-95 transition-transform">
              Preterm (&lt;32 Weeks)
            </button>
            <button onClick={onBack} className="w-full text-center text-blue-400 font-semibold py-2">
              Cancel
            </button>
          </div>
        )}

        {/* Recovery prompt */}
        {showRecoveryPrompt && (
          <div className="p-4 bg-orange-900/30 border-2 border-orange-600 rounded-2xl space-y-3 mt-2">
            <div className="flex items-center space-x-2">
              <AlertTriangle size={24} className="text-orange-400 flex-shrink-0" />
              <h3 className="font-bold">Session Recovery</h3>
            </div>
            <p className="text-sm text-gray-300">An active NLS session was interrupted. Resume?</p>
            <div className="flex space-x-3">
              <button onClick={resumeSession} className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold active:scale-95 transition-transform">Resume</button>
              <button onClick={discardSession} className="flex-1 py-3 rounded-xl bg-gray-700 text-white font-bold active:scale-95 transition-transform">Save & Discard</button>
            </div>
          </div>
        )}

        {/* ===== INITIAL ASSESSMENT (matches iOS screenshot 2 & 3) ===== */}
        {isActive && nlsState === NLSState.InitialAssessment && (
          <NLSCard
            label="INITIAL ASSESSMENT"
            title="Assess tone, breathing and heart rate."
            bullets={isPreterm ? [
              "Place undried body in a plastic bag + radiant heat.",
              "If breathing consider: CPAP 5–8 cm H₂O and ≥ 30% FiO₂.",
              "Ensure an open airway.",
            ] : [
              "Delay cord clamping. Stimulate. Thermal care.",
              "Ensure an open airway.",
            ]}
            question="Is the baby breathing adequately?"
            actions={
              <div className="grid grid-cols-2 gap-3">
                <NLSButton color="bg-blue-600" icon={<Wind size={18} />} label="No" sublabel="(Inadequate)"
                  onClick={() => advanceNLS(NLSState.InflationBreaths)} />
                <NLSButton color="bg-green-500" icon={<Heart size={18} />} label="Yes (Adequate)" sublabel=""
                  onClick={achieveROSC} />
              </div>
            }
          />
        )}

        {/* ===== INFLATION BREATHS (matches iOS screenshot 4) ===== */}
        {isActive && nlsState === NLSState.InflationBreaths && (
          <NLSCard
            label="AIRWAY & INFLATION BREATHS"
            title="Give 5 inflation breaths."
            bullets={isPreterm ? [
              "25 cm H₂O, ≥ 30% FiO₂.",
              "PEEP 6 cm H₂O, if possible.",
              "SpO₂ +/- ECG monitoring.",
            ] : [
              `30 cm H₂O, air (21%).`,
              "PEEP 6 cm H₂O, if possible.",
              "SpO₂ +/- ECG monitoring.",
            ]}
            question="Reassess heart rate and chest rise. Is the chest moving?"
            actions={
              <div className="grid grid-cols-2 gap-3">
                <NLSButton color="bg-amber-500" icon={<AlertTriangle size={18} />} label="Chest NOT" sublabel="Moving"
                  onClick={() => advanceNLS(NLSState.OptimiseAirway)} />
                <NLSButton color="bg-blue-500" icon={<Wind size={18} />} label="Chest Moving" sublabel=""
                  onClick={() => advanceNLS(NLSState.Ventilation)} />
              </div>
            }
          />
        )}

        {/* ===== OPTIMISE AIRWAY (matches iOS screenshot 5) ===== */}
        {isActive && nlsState === NLSState.OptimiseAirway && (
          <NLSCard
            label="TROUBLESHOOT AIRWAY"
            title="Troubleshoot airway and repeat 5 inflation breaths."
            bullets={[
              "Check mask, head and jaw position.",
              "2 person support.",
            ]}
            question="Reassess heart rate and chest rise. Is the chest moving now?"
            actions={
              <div className="grid grid-cols-2 gap-3">
                <NLSButton color="bg-amber-500" icon={<RotateCw size={18} />} label="Chest NOT" sublabel="Moving"
                  onClick={() => advanceNLS(NLSState.AdvancedAirway)} />
                <NLSButton color="bg-blue-500" icon={<Wind size={18} />} label="Chest Moving" sublabel=""
                  onClick={() => advanceNLS(NLSState.Ventilation)} />
              </div>
            }
          />
        )}

        {/* ===== ADVANCED AIRWAY (matches iOS screenshot 6) ===== */}
        {isActive && nlsState === NLSState.AdvancedAirway && (
          <NLSCard
            label="ADVANCED AIRWAY"
            title="Consider advanced airway interventions and repeat 5 inflation breaths."
            bullets={[
              "Consider: SGA, Suction, Tracheal tube.",
              "Consider increasing Inflation pressures.",
            ]}
            question="Reassess heart rate and chest rise. Is the chest moving now?"
            actions={
              <div className="grid grid-cols-2 gap-3">
                <NLSButton color="bg-amber-500" icon={<RotateCw size={18} />} label="Chest NOT" sublabel="Moving"
                  onClick={() => {
                    // Loop back to optimise airway
                    advanceNLS(NLSState.OptimiseAirway);
                  }} />
                <NLSButton color="bg-blue-500" icon={<Wind size={18} />} label="Chest Moving" sublabel=""
                  onClick={() => advanceNLS(NLSState.Ventilation)} />
              </div>
            }
          />
        )}

        {/* ===== VENTILATION (matches iOS screenshot 7) ===== */}
        {isActive && nlsState === NLSState.Ventilation && (
          <NLSCard
            label="VENTILATION"
            title="Start ventilation breaths (30 min⁻¹)."
            bullets={[]}
            question="Reassess after 30 seconds. What is the Heart Rate?"
            actions={
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <NLSButton color="bg-red-600" icon={<Heart size={18} />} label="HR < 60 min⁻¹" sublabel="(Start CPR)"
                    onClick={() => advanceNLS(NLSState.Compressions)} />
                  <NLSButton color="bg-blue-500" icon={<Wind size={18} />} label="HR ≥ 60 min⁻¹" sublabel="(Continue Vent.)"
                    onClick={() => advanceNLS(NLSState.ContinueVentilation)} />
                </div>
                <button onClick={achieveROSC}
                  className="w-full py-4 rounded-2xl bg-green-500 text-white font-bold text-base flex items-center justify-center space-x-2 active:scale-95 transition-transform">
                  <Heart size={18} />
                  <span>Breathing normally</span>
                </button>
              </div>
            }
          />
        )}

        {/* ===== CONTINUE VENTILATION (matches iOS screenshot 10) ===== */}
        {isActive && nlsState === NLSState.ContinueVentilation && (
          <NLSCard
            label="CONTINUE VENTILATION"
            title="Continue ventilations until confident baby is breathing adequately and HR is stable."
            bullets={[
              "Maintain ventilation rate at 30 min⁻¹.",
              "Assess breathing and heart rate regularly.",
            ]}
            question="Reassess every 30 seconds."
            actions={
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <NLSButton color="bg-red-600" icon={<Heart size={18} />} label="HR < 60 min⁻¹" sublabel="(Start CPR)"
                    onClick={() => advanceNLS(NLSState.Compressions)} />
                  <NLSButton color="bg-blue-500" icon={<Wind size={18} />} label="Not Breathing Adequately" sublabel="(Cont. Vent)"
                    onClick={() => {
                      saveUndo();
                      resetNLSTimer();
                      logEvent("Continuing ventilation — not yet adequate");
                    }} />
                </div>
                <button onClick={achieveROSC}
                  className="w-full py-4 rounded-2xl bg-green-500 text-white font-bold text-base flex items-center justify-center space-x-2 active:scale-95 transition-transform">
                  <Heart size={18} />
                  <span>Breathing normally</span>
                </button>
              </div>
            }
          />
        )}

        {/* ===== CHEST COMPRESSIONS (matches iOS screenshot 8) ===== */}
        {isActive && nlsState === NLSState.Compressions && (
          <NLSCard
            label="CHEST COMPRESSIONS"
            title="Start chest compressions (3:1 ratio)."
            bullets={[
              "Synchronise compressions and ventilation.",
              "100% Oxygen.",
              "Consider SGA or intubation.",
              "If HR remains < 60: Vascular access, drugs, check blood glucose, consider other factors.",
            ]}
            question="Reassess every 30 seconds. Does HR remain < 60 min⁻¹?"
            actions={
              <div className="space-y-3">
                {/* Metronome */}
                <button onClick={toggleMetronome}
                  className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center space-x-2 active:scale-95 transition-transform ${
                    metronomeOn ? 'bg-amber-500 text-white' : 'bg-gray-800 border border-gray-600 text-white'
                  }`}>
                  {metronomeOn ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  <span>{metronomeOn ? 'STOP 3:1 METRONOME' : 'START 3:1 METRONOME'}</span>
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <NLSButton color="bg-red-600" icon={<Square size={18} />} label="Yes (HR < 60)" sublabel="(Continue CPR)"
                    onClick={() => {
                      saveUndo();
                      resetNLSTimer();
                      logEvent("HR remains < 60 — continuing CPR", "cpr");
                    }} />
                  <NLSButton color="bg-blue-500" icon={<Wind size={18} />} label="No (HR ≥ 60)" sublabel="(Stop CPR)"
                    onClick={() => advanceNLS(NLSState.ContinueVentilation)} />
                </div>

                {/* Drug access section */}
                <div className="p-3 bg-gray-800 rounded-2xl space-y-3 mt-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Drugs & Vascular Access</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { saveUndo(); setVascularAccess(true); logEvent("Vascular access (UVC/IO)"); }}
                      disabled={vascularAccess}
                      className={`py-3 rounded-xl text-sm font-bold flex items-center justify-center space-x-1 active:scale-95 transition-transform ${
                        vascularAccess ? 'bg-green-700 text-green-200' : 'bg-blue-700 text-white'
                      } disabled:opacity-60`}>
                      <Zap size={14} />
                      <span>{vascularAccess ? 'Access ✓' : 'Vascular Access'}</span>
                    </button>
                    <button onClick={() => { saveUndo(); setAdrenalineCount(p => p + 1); logEvent(`Adrenaline dose ${adrenalineCount + 1} (10-30 mcg/kg IV)`, "drug"); }}
                      className="py-3 rounded-xl bg-pink-700 text-white text-sm font-bold flex items-center justify-center space-x-1 active:scale-95 transition-transform">
                      <Syringe size={14} />
                      <span>Adrenaline ({adrenalineCount})</span>
                    </button>
                    <button onClick={() => { saveUndo(); setVolumeGiven(true); logEvent("Volume 10ml/kg 0.9% NaCl", "drug"); }}
                      disabled={volumeGiven}
                      className={`py-3 rounded-xl text-sm font-bold flex items-center justify-center space-x-1 active:scale-95 transition-transform ${
                        volumeGiven ? 'bg-green-700 text-green-200' : 'bg-indigo-700 text-white'
                      } disabled:opacity-60`}>
                      <Activity size={14} />
                      <span>{volumeGiven ? 'Volume ✓' : 'Volume 10ml/kg'}</span>
                    </button>
                  </div>
                </div>
              </div>
            }
          />
        )}

        {/* ===== ROSC / ENDED ===== */}
        {(arrestState === NLSArrestState.Rosc || arrestState === NLSArrestState.Ended) && (
          <div className="space-y-4 mt-2">
            <div className={`p-6 rounded-2xl text-center ${
              arrestState === NLSArrestState.Ended ? 'bg-gray-800' : 'bg-green-900/40 border border-green-700'
            }`}>
              <CheckCircle2 size={48} className={`mx-auto mb-3 ${
                arrestState === NLSArrestState.Ended ? 'text-gray-500' : 'text-green-400'
              }`} />
              <h2 className="text-2xl font-bold">
                {arrestState === NLSArrestState.Ended ? 'Resuscitation Ended' : 'Baby Stabilised'}
              </h2>
              <p className="text-sm text-gray-400 mt-1">Total time: {formatTime(totalArrestTime)}</p>
            </div>
            
            {arrestState === NLSArrestState.Rosc && (
              <button onClick={endResuscitation}
                className="w-full py-4 rounded-2xl bg-red-600 text-white font-bold flex items-center justify-center space-x-2 active:scale-95 transition-transform">
                <XSquare size={18} />
                <span>End Resuscitation</span>
              </button>
            )}
          </div>
        )}

        {/* ===== SpO₂ Reference Table (matches iOS purple table) ===== */}
        {arrestState !== NLSArrestState.Pending && (
          <div className="rounded-2xl overflow-hidden">
            <div className="bg-purple-600 py-2 text-center text-sm font-bold">
              Acceptable Pre-ductal SpO₂
            </div>
            <div className="bg-gray-800">
              {getSpO2Targets().map((t, i) => (
                <div key={t.time} className={`flex ${i < getSpO2Targets().length - 1 ? 'border-b border-gray-700' : ''}`}>
                  <div className="flex-1 py-2 text-center text-sm text-gray-300 border-r border-gray-700">{t.time}</div>
                  <div className="flex-1 py-2 text-center text-sm text-gray-300">{t.target}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ===== BOTTOM CONTROLS (matches iOS footer: Undo, Summary, Stop) ===== */}
      {arrestState !== NLSArrestState.Pending && (
        <div className="fixed bottom-0 left-0 right-0 p-3 pb-[72px] bg-black/80 backdrop-blur-md border-t border-gray-800 z-10">
          <div className="flex space-x-3">
            <button onClick={undo} disabled={undoStack.length === 0}
              className="flex-1 py-3 rounded-2xl bg-blue-600 text-white font-bold flex items-center justify-center space-x-2 active:scale-95 transition-transform disabled:opacity-40">
              <Undo size={18} />
              <span>Undo</span>
            </button>
            <button onClick={() => setShowSummary(true)}
              className="flex-1 py-3 rounded-2xl bg-purple-600 text-white font-bold flex items-center justify-center space-x-2 active:scale-95 transition-transform">
              <Clipboard size={18} />
              <span>Summary</span>
            </button>
            <button onClick={() => setShowReset(true)}
              className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-bold flex items-center justify-center space-x-2 active:scale-95 transition-transform">
              <Square size={18} />
              <span>Stop</span>
            </button>
          </div>
        </div>
      )}

      {/* ===== MODALS ===== */}
      <NLSModal isOpen={showSummary} onClose={() => setShowSummary(false)} title="NLS Event Summary">
        <div className="space-y-4">
          <p className="text-lg font-semibold">Total Time: {formatTime(totalArrestTime)}</p>
          <div className="space-y-2 max-h-60 overflow-y-auto p-2 bg-gray-700 rounded-lg font-mono text-sm">
            {[...events].reverse().map((e, i) => (
              <div key={i} className="flex">
                <span className="font-bold w-16 flex-shrink-0 text-cyan-400">[{formatTime(e.timestamp)}]</span>
                <span className="ml-2 text-gray-200">{e.message}</span>
              </div>
            ))}
          </div>
          <button onClick={() => { copySummary(); setShowSummary(false); }}
            className="w-full py-3 rounded-2xl bg-blue-600 text-white font-bold flex items-center justify-center space-x-2 active:scale-95 transition-transform">
            <Clipboard size={18} />
            <span>Copy to Clipboard</span>
          </button>
        </div>
      </NLSModal>

      <NLSModal isOpen={showReset} onClose={() => setShowReset(false)} title="Reset NLS?">
        <div className="flex flex-col items-center text-center space-y-4">
          <RotateCw size={48} className="text-red-400" />
          <p className="text-gray-300">This will save the current log. Cannot be undone.</p>
          <button onClick={() => { performReset(true, true); setShowReset(false); }}
            className="w-full py-3 rounded-2xl bg-blue-600 text-white font-bold active:scale-95 transition-transform">
            Copy, Save & Reset
          </button>
          <button onClick={() => { performReset(true, false); setShowReset(false); }}
            className="w-full py-3 rounded-2xl bg-red-600 text-white font-bold active:scale-95 transition-transform">
            Reset & Save
          </button>
          <button onClick={() => setShowReset(false)} className="text-gray-500 font-medium py-2">Cancel</button>
        </div>
      </NLSModal>

      <NLSModal isOpen={showConfirmBack} onClose={() => setShowConfirmBack(false)} title="Leave NLS?">
        <div className="text-center space-y-4">
          <p className="text-gray-300">Session will be saved to logbook.</p>
          <div className="flex space-x-3">
            <button onClick={() => setShowConfirmBack(false)}
              className="flex-1 py-3 rounded-2xl bg-gray-700 text-white font-bold active:scale-95 transition-transform">Stay</button>
            <button onClick={confirmBack}
              className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-bold active:scale-95 transition-transform">Save & Leave</button>
          </div>
        </div>
      </NLSModal>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const NLSCard: React.FC<{
  label: string;
  title: string;
  bullets: string[];
  question: string;
  actions: React.ReactNode;
}> = ({ label, title, bullets, question, actions }) => (
  <div className="p-4 bg-gray-800 rounded-2xl space-y-3">
    <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</p>
    <h2 className="text-xl font-bold leading-tight">{title}</h2>
    {bullets.length > 0 && (
      <div className="space-y-1.5">
        {bullets.map((b, i) => (
          <div key={i} className="flex items-start space-x-2 text-sm text-gray-300">
            <span className="text-gray-500 mt-0.5">›</span>
            <span dangerouslySetInnerHTML={{ __html: b.replace(/H₂O/g, 'H₂O').replace(/FiO₂/g, 'FiO₂').replace(/SpO₂/g, 'SpO₂') }} />
          </div>
        ))}
      </div>
    )}
    <div className="border-t border-gray-700 pt-3">
      <p className="text-sm font-semibold text-center mb-3">{question}</p>
      {actions}
    </div>
  </div>
);

const NLSButton: React.FC<{
  color: string;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  onClick: () => void;
}> = ({ color, icon, label, sublabel, onClick }) => (
  <button onClick={onClick}
    className={`${color} text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center space-x-1.5 active:scale-95 transition-transform`}>
    {icon}
    <div className="text-center leading-tight">
      <div>{label}</div>
      {sublabel && <div className="text-xs font-normal opacity-80">{sublabel}</div>}
    </div>
  </button>
);

const NLSModal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-auto overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><XSquare size={24} /></button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[70vh]">{children}</div>
      </div>
    </div>
  );
};

export default NewbornLifeSupport;
