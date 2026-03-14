
import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, Zone, WorkoutSession, Exercise, BiometricLog, PlannedExercise, GoalTarget, WorkoutRoutine, ScheduledActivity, RecurringPlan, PlannedActivityForLogDisplay, UserMission, BodyMeasurements, SetType } from './types';
import { WorkoutView } from './components/WorkoutView';
import { ExerciseLibrary } from './components/ExerciseLibrary';
import { WorkoutLog } from './components/WorkoutLog';
import { TargetsView } from './components/TargetsView';
import { RoutinePicker } from './components/RoutinePicker';
import { StatsView } from './components/StatsView';
import { MeasurementsView } from './components/MeasurementsView';
import { LocationManager } from './components/LocationManager';
import { storage } from './services/storage';
import { db, importDatabase, exportDatabase } from './services/db'; 
import { OnboardingWizard } from './components/OnboardingWizard';
import { SettingsView } from './components/SettingsView';
import { AIProgramDashboard } from './components/AIProgramDashboard';
import { ZonePickerModal } from './components/ZonePickerModal';
import { listBackups, downloadBackup, uploadBackup, getAccessToken } from './services/googleDrive';
import { calculate1RM, getLastPerformance } from './utils/fitness';
import { suggestWeightForReps } from './utils/progression';
import { registerBackHandler, executeBackHandler } from './utils/backHandler';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { triggerHaptic } from './utils/haptics';
import { App as CapacitorApp } from '@capacitor/app';
import { Dumbbell, User2, Calendar, X, MapPin, Activity, Home, Trees, ChevronRight, Settings, Trophy, BookOpen, Cloud, Sparkles } from 'lucide-react';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('Initierar...');
  const [activeTab, setActiveTab] = useState<'workout' | 'body' | 'targets' | 'log' | 'library' | 'gyms' | 'ai'>('workout');
  const [bodySubTab, setBodySubTab] = useState<'recovery' | 'measurements' | 'analytics' | 'settings'>('recovery');
  
  const [tabHistory, setTabHistory] = useState<string[]>([]);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [biometricLogs, setBiometricLogs] = useState<BiometricLog[]>([]);
  const [currentSession, setCurrentSession] = useState<WorkoutSession | null>(null);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [goalTargets, setGoalTargets] = useState<GoalTarget[]>([]); 
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [plannedActivities, setPlannedActivities] = useState<PlannedActivityForLogDisplay[]>([]); 
  const [userMissions, setUserMissions] = useState<UserMission[]>([]); 

  const [showStartMenu, setShowStartMenu] = useState(false);
  const [selectedZoneForStart, setSelectedZoneForStart] = useState<Zone | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  const [pendingManualDate, setPendingManualDate] = useState<string | null>(null);
  const [targetExerciseId, setTargetExerciseId] = useState<string | null>(null);

  const [pendingActivity, setPendingActivity] = useState<ScheduledActivity | null>(null);
  const [showZonePicker, setShowZonePicker] = useState(false);

  const globalStyles = `
    :root {
      --safe-area-top: env(safe-area-inset-top);
      --safe-area-bottom: env(safe-area-inset-bottom);
    }

    body {
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
      min-height: 100vh;
      box-sizing: border-box;
      background-color: #0f0d15;
    }

    .fixed-bottom-nav {
      padding-bottom: calc(env(safe-area-inset-bottom) + 1rem);
    }
  `;

  const navigateToTab = (newTab: typeof activeTab, options?: { fromNav?: boolean }) => {
    if (newTab === activeTab && newTab !== 'library') return;
    if (newTab === 'library' && options?.fromNav) {
        setTargetExerciseId(null);
    }
    if (newTab !== activeTab) {
      setTabHistory(prev => [...prev, activeTab]);
      setActiveTab(newTab);
    }
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handleBackButton = async () => {
      if (executeBackHandler()) return;
      if (showStartMenu) {
        if (selectedZoneForStart) {
          setSelectedZoneForStart(null);
        } else {
          setShowStartMenu(false);
        }
        return;
      }
      if (tabHistory.length > 0) {
        const historyCopy = [...tabHistory];
        const prevTab = historyCopy.pop();
        setTabHistory(historyCopy);
        if (prevTab) setActiveTab(prevTab as any);
        return;
      }
      if (activeTab !== 'workout') {
        setActiveTab('workout');
      } else {
        CapacitorApp.exitApp();
      }
    };
    const listener = CapacitorApp.addListener('backButton', handleBackButton);
    return () => { listener.then(l => l.remove()); };
  }, [showStartMenu, selectedZoneForStart, activeTab, tabHistory]);

  useEffect(() => {
    if (activeTab === 'body' && bodySubTab !== 'recovery') {
      return registerBackHandler(() => setBodySubTab('recovery'));
    }
  }, [activeTab, bodySubTab]);

  useEffect(() => {
    const initNativeHardware = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await StatusBar.setOverlaysWebView({ overlay: false });
          await StatusBar.setBackgroundColor({ color: '#000000' });
          await StatusBar.setStyle({ style: Style.Dark });
        } catch (e) {
          console.warn('Statusbar kunde inte konfigureras:', e);
        }
      }
    };
    initNativeHardware();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const isVibrationEnabled = user?.settings?.vibrateButtons ?? true;
      if (!isVibrationEnabled) return;
      
      const target = e.target as HTMLElement;
      const button = target.closest('button, a, [role="button"]');
      
      // Kontrollera om knappen är disabled
      const isDisabled = button && ((button as HTMLButtonElement).disabled || button.getAttribute('aria-disabled') === 'true');

      if (button && !isDisabled) {
        triggerHaptic.light();
      }
    };
    
    // Använd capture: true för att fånga eventet innan stopPropagation() kan stoppa det i barn-komponenter
    window.addEventListener('click', handleGlobalClick, true);
    return () => window.removeEventListener('click', handleGlobalClick, true);
  }, [user?.settings?.vibrateButtons]);

  const refreshData = async () => {
    const [p, z, h, logs, sess, ex, gt, r, scheduled, recurring, missions] = await Promise.all([
      storage.getUserProfile(),
      storage.getZones(),
      storage.getHistory(),
      storage.getBiometricLogs(),
      storage.getActiveSession(),
      storage.getAllExercises(),
      storage.getGoalTargets(),
      storage.getRoutines(),
      storage.getScheduledActivities(),
      storage.getRecurringPlans(),
      storage.getUserMissions() 
    ]);

    if (z.length === 0 || p.name === "Atlet") {
       setShowOnboarding(true);
    } else {
       setShowOnboarding(false);
    }

    setUser(p);
    setZones(z);
    setHistory(h);
    setBiometricLogs(logs);
    setCurrentSession(sess || null);
    setAllExercises(ex);
    setGoalTargets(gt);
    setRoutines(r);
    
    const allPlansForDisplay: PlannedActivityForLogDisplay[] = [
      ...scheduled,
      ...recurring.map(rp => ({
          id: rp.id,
          date: rp.startDate,
          type: rp.type,
          title: rp.title,
          isCompleted: false,
          exercises: rp.exercises,
          isTemplate: true,
          daysOfWeek: rp.daysOfWeek
      }))
    ];
    setPlannedActivities(allPlansForDisplay);
    setUserMissions(missions); 
  };

  useEffect(() => {
    const initApp = async () => {
      try {
        setLoadingStatus('Ansluter till databas...');
        await storage.init();
        setLoadingStatus('Kollar molnsynkronisering...');
        const initialProfile = await storage.getUserProfile();
        if (initialProfile.settings?.googleDriveLinked && initialProfile.settings?.restoreOnStartup) {
           try {
             const files = await listBackups();
             if (files && files.length > 0) {
               const backupFile = await downloadBackup(files[0].id);
               if (backupFile?.data) {
                  const localExportedAt = initialProfile.settings.lastCloudSync || "0";
                  if (new Date(backupFile.timestamp) > new Date(localExportedAt)) {
                     await importDatabase(backupFile.data);
                     alert("Nyare data hittades i molnet och har återställts. Appen startas om.");
                     window.location.reload();
                     return;
                  }
               }
             }
           } catch (e) {
             console.warn("Startup cloud restore failed:", e);
           }
        }
        setLoadingStatus('Synkroniserar övningsbibliotek...');
        try {
          await db.syncExercises(); 
        } catch (e) {
          console.warn("Kunde inte synka övningar vid start:", e);
          setLoadingStatus('Synk misslyckades, laddar lokalt...');
        }
        setLoadingStatus('Läser in användardata...');
        await refreshData();
        const activeSess = await storage.getActiveSession();
        if (activeSess) setActiveTab('workout');
        setLoadingStatus('Slutför...');
      } catch (error) {
        console.error("Kritisk fel vid start:", error);
        setLoadingStatus(`Ett fel uppstod: ${error instanceof Error ? error.message : 'Okänt fel'}`);
      } finally {
        setIsReady(true);
      }
    };
    initApp();
  }, []);

  useEffect(() => {
    const checkMissions = async () => {
        if (!history.length || !userMissions.length || !user) return;
        let missionsUpdated = false;
        const updatedMissions = await Promise.all(userMissions.map(async (mission) => {
            if (mission.isCompleted || mission.type !== 'smart_goal' || !mission.smartConfig) return mission;
            const { targetType, exerciseId, measurementKey, startValue, targetValue } = mission.smartConfig;
            let currentProgress = startValue;
            if (targetType === 'exercise' && exerciseId) {
                const exData = allExercises.find(e => e.id === exerciseId);
                const lastPerf = getLastPerformance(exerciseId, history);
                if (lastPerf) {
                    switch (exData?.trackingType) {
                        case 'time_distance': currentProgress = Math.max(...lastPerf.map(s => s.distance || 0)); break;
                        case 'reps_only': currentProgress = Math.max(...lastPerf.map(s => s.reps || 0)); break;
                        case 'time_only': currentProgress = Math.max(...lastPerf.map(s => s.duration || 0)); break;
                        default: currentProgress = Math.max(...lastPerf.map(s => calculate1RM(s.weight || 0, s.reps || 0)), 0); break;
                    }
                }
            } else if (targetType === 'body_weight' || (targetType === 'body_measurement' && measurementKey)) {
                 const key = targetType === 'body_weight' ? 'weight' : measurementKey;
                 if (key === 'weight') {
                     const sortedLogs = [...biometricLogs].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                     const latestLog = sortedLogs.find(log => log.weight !== undefined);
                     currentProgress = latestLog?.weight || user.weight || 0;
                 } else if (key) {
                     const sortedLogs = [...biometricLogs].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                     const latestLog = sortedLogs.find(log => log.measurements[key as keyof BodyMeasurements]);
                     currentProgress = latestLog?.measurements[key as keyof BodyMeasurements] || user.measurements[key as keyof BodyMeasurements] || 0;
                 }
            }
            const isGoalMet = targetValue > startValue ? currentProgress >= targetValue : currentProgress <= targetValue;
            if (isGoalMet) {
                missionsUpdated = true;
                return { ...mission, isCompleted: true, completedAt: new Date().toISOString() };
            }
            return mission;
        }));
        if (missionsUpdated) {
            const missionsToUpdateInDb = updatedMissions.filter(m => m.isCompleted && !userMissions.find(oldM => oldM.id === m.id && oldM.isCompleted));
            for (const mission of missionsToUpdateInDb) {
                await storage.updateUserMission(mission);
            }
            setUserMissions(updatedMissions);
        }
    };
    if (isReady && user) { checkMissions(); }
  }, [history, userMissions, user, biometricLogs, isReady, allExercises]); 

  const activeZone = useMemo(() => zones.find(z => z.id === (currentSession?.zoneId || selectedZoneForStart?.id)) || zones[0], [zones, currentSession, selectedZoneForStart]);

  const handleFinishWorkout = async (session: WorkoutSession, duration: number) => {
    try {
      const historySession = { ...session, isCompleted: true, duration, locationName: activeZone.name };
      await storage.saveToHistory(historySession);

      if (session.sourceActivityId) {
        await db.scheduledActivities.update(session.sourceActivityId, {
          isCompleted: true,
          linkedSessionId: historySession.id
        });
        console.log("Marked source activity as complete:", session.sourceActivityId);
      }

      storage.setActiveSession(null);
      setCurrentSession(null);
      
      if (user?.settings?.googleDriveLinked && user?.settings?.autoSyncMode === 'after_workout') {
        const syncToCloud = async (isRetry = false) => {
          try {
            if (isRetry) {
                await getAccessToken(true); // Force login prompt
            }
            const allData = await exportDatabase();
            await uploadBackup(allData);
            console.log("Auto-sync to Google Drive successful after workout.");
            const profile = await storage.getUserProfile();
            await storage.setUserProfile({ ...profile, settings: { ...profile.settings, lastCloudSync: new Date().toISOString() }});
          } catch (err) {
            console.warn("Auto-sync failed:", err);
            if (!isRetry) {
                const retry = window.confirm("Kunde inte spara till Google Drive (du kan vara utloggad). Vill du logga in och försöka igen?");
                if (retry) {
                    await syncToCloud(true);
                }
            } else {
                alert("Synkroniseringen misslyckades igen. Du kan försöka manuellt från Inställningar senare.");
            }
          }
        };
        syncToCloud();
      }

      await refreshData(); 
      navigateToTab('log');
    } catch (error) {
      console.error("Failed to save workout session:", error);
      alert("An error occurred while saving the workout. Please try again.");
    }
  };

  const handleCancelWorkout = () => {
    storage.setActiveSession(null);
    setCurrentSession(null);
    setActiveTab('workout');
  };

  const handleStartSession = (activity: ScheduledActivity) => {
    setPendingActivity(activity);
    setShowZonePicker(true);
  };

  const handleFinalizeSessionStart = async (zone: Zone, filteredExercises?: PlannedExercise[]) => {
    if (!pendingActivity) return;
    setShowZonePicker(false);
    let finalExercises = (filteredExercises || pendingActivity.exercises || []).map(pe => ({
      ...pe,
      sets: pe.sets.map(s => ({...s, completed: false}))
    }));

    // KONTROLL: Hade ursprungspasset övningar?
    const originalHasExercises = pendingActivity.exercises && pendingActivity.exercises.length > 0;

    // Om ursprungspasset hade övningar, men alla filtrerades bort => Varna.
    // Om ursprungspasset var tomt (0 övningar) => Tillåt start (finalExercises är tomt).
    if (originalHasExercises && finalExercises.length === 0) {
        alert("Inga övningar kvar efter filtrering för denna zon. Passet startades inte.");
        setPendingActivity(null);
        return;
    }

    const isScoutOrManual = !pendingActivity.programId;
    if (isScoutOrManual) {
        const historyData = await storage.getHistory();
        finalExercises = finalExercises.map(ex => {
            const targetReps = ex.sets[0]?.reps || 10;
            const suggestedWeight = suggestWeightForReps(ex.exerciseId, targetReps, historyData);
            return { ...ex, sets: ex.sets.map(s => ({ ...s, reps: targetReps, weight: suggestedWeight > 0 ? suggestedWeight : (s.weight || 0), completed: false })) };
        });
    }
    const newSess: WorkoutSession = { 
      id: 'w-' + Date.now(), 
      date: new Date().toISOString(),
      name: pendingActivity.title, 
      zoneId: zone.id, 
      locationName: zone.name,
      exercises: finalExercises, 
      isCompleted: false, 
      isManual: false,
      sourceActivityId: pendingActivity.id 
    };
    storage.setActiveSession(newSess);
    setCurrentSession(newSess);
    setActiveTab('workout');
    setPendingActivity(null);
  };

  const handleStartWorkout = (exercises: PlannedExercise[], name: string) => {
    const zone = selectedZoneForStart || zones[0];
    const sessionDate = pendingManualDate ? new Date(pendingManualDate).toISOString() : new Date().toISOString();
    const newSess: WorkoutSession = { id: 'w-' + Date.now(), date: sessionDate, name, zoneId: zone.id, exercises, isCompleted: false, isManual: !!pendingManualDate };
    storage.setActiveSession(newSess);
    setCurrentSession(newSess);
    setActiveTab('workout');
    setShowStartMenu(false);
    setSelectedZoneForStart(null);
    setPendingManualDate(null);
  };

  const handleStartEmptyWorkout = () => { setShowStartMenu(true); };
  const handleStartManualWorkout = (date: string) => { setPendingManualDate(date); setShowStartMenu(true); };

  const handleDeleteHistory = async (sessionId: string) => {
    try {
      await storage.deleteWorkoutFromHistory(sessionId);
      setHistory(prev => prev.filter(s => s.id !== sessionId));
    } catch (error) { console.error("Could not delete workout:", error); }
  };

  const handleAddPlan = async (activity: ScheduledActivity, isRecurring: boolean, days?: number[]) => {
    if (isRecurring && days) {
      const plan: RecurringPlan = { id: `rec-${Date.now()}`, type: activity.type, title: activity.title, daysOfWeek: days, startDate: activity.date, exercises: activity.exercises };
      await storage.addRecurringPlan(plan);
      await storage.generateRecurringActivities();
    } else { await storage.addScheduledActivity(activity); }
    await refreshData();
  };

  const handleDeletePlan = async (id: string, isTemplate: boolean) => {
    try {
      if (isTemplate) { await storage.deleteRecurringPlan(id); } else { await storage.deleteScheduledActivity(id); }
      await refreshData();
    } catch (error) { console.error("Could not delete plan:", error); }
  };

  const handleMovePlan = async (id: string, newDate: string) => {
    try {
      const plan = await db.scheduledActivities.get(id);
      if (plan) {
        await db.scheduledActivities.update(id, { date: newDate });
        await refreshData();
      }
    } catch (error) { console.error("Could not move plan:", error); }
  };

  const handleAddMission = async (mission: UserMission) => { await storage.addUserMission(mission); await refreshData(); };
  const handleDeleteMission = async (id: string) => { if (confirm("Are you sure you want to delete this mission?")) { await storage.deleteUserMission(id); await refreshData(); } };
  const handleGoToExercise = (exerciseId: string) => { setTargetExerciseId(exerciseId); navigateToTab('library'); };

  if (!isReady || !user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0f0d15] text-white p-6">
        <div className="relative"><div className="w-24 h-24 border-4 border-accent-pink/20 border-t-accent-pink rounded-full animate-spin"></div><Activity className="absolute inset-0 m-auto text-accent-pink animate-pulse" size={32} /></div>
        <h1 className="mt-8 text-2xl font-black uppercase italic tracking-[0.3em] animate-pulse">MorphFit</h1>
        <div className="mt-4 px-4 py-2 bg-white/5 rounded-xl border border-white/10"><p className="text-[10px] font-mono text-text-dim uppercase tracking-widest animate-pulse">{loadingStatus}</p></div>
      </div>
    );
  }

  const isWorkoutActive = currentSession !== null;

  const renderContent = () => {
    switch (activeTab) {
      case 'workout':
        return <WorkoutView key={currentSession?.id || 'no-session'} session={currentSession} allExercises={allExercises} userProfile={user} allZones={zones} history={history} activeZone={activeZone} onZoneChange={(z) => { if (currentSession) { const newSession = {...currentSession, zoneId: z.id}; setCurrentSession(newSession); storage.setActiveSession(newSession); } }} onComplete={handleFinishWorkout} onCancel={handleCancelWorkout} plannedActivities={plannedActivities} onStartActivity={handleStartSession} onStartEmptyWorkout={handleStartEmptyWorkout} onUpdate={refreshData} isManualMode={currentSession?.isManual} userMissions={userMissions} onGoToExercise={handleGoToExercise} />;
      case 'body':
        return (
          <div className="space-y-6 animate-in fade-in px-2 pb-32 min-h-screen pt-[calc(env(safe-area-inset-top)+2rem)]">
            <nav className="flex items-center justify-center gap-4 border-b border-white/5 pb-4 px-2">
              <button onClick={() => setBodySubTab('recovery')} className={`text-[10px] font-black uppercase tracking-[0.15em] transition-all ${bodySubTab === 'recovery' ? 'text-accent-pink scale-110' : 'text-text-dim'}`}>Återhämtning</button>
              <button onClick={() => setBodySubTab('measurements')} className={`text-[10px] font-black uppercase tracking-[0.15em] transition-all ${bodySubTab === 'measurements' ? 'text-accent-pink scale-110' : 'text-text-dim'}`}>Mått</button>
              <button onClick={() => setBodySubTab('analytics')} className={`text-[10px] font-black uppercase tracking-[0.15em] transition-all ${bodySubTab === 'analytics' ? 'text-accent-pink scale-110' : 'text-text-dim'}`}>Statistik</button>
              <button onClick={() => setBodySubTab('settings')} className={`text-[10px] font-black uppercase tracking-[0.15em] transition-all ${bodySubTab === 'settings' ? 'text-accent-pink scale-110' : 'text-text-dim'}`}><Settings size={16} /></button>
            </nav>
            {(bodySubTab === 'recovery' || bodySubTab === 'analytics') && ( <StatsView logs={biometricLogs} history={history} allExercises={allExercises} userProfile={user} onUpdateProfile={refreshData} initialMode={bodySubTab === 'analytics' ? 'analytics' : 'recovery'} /> )}
            {bodySubTab === 'measurements' && <MeasurementsView profile={user} onUpdate={refreshData} />}
            {bodySubTab === 'settings' && user && ( <SettingsView userProfile={user} onUpdate={refreshData} /> )}
          </div>
        );
      case 'log': return <WorkoutLog history={history} plannedActivities={plannedActivities} routines={routines} allExercises={allExercises} onAddPlan={handleAddPlan} onDeletePlan={handleDeletePlan} onDeleteHistory={handleDeleteHistory} onMovePlan={handleMovePlan} onStartActivity={handleStartSession} onStartManualWorkout={handleStartManualWorkout} onStartLiveWorkout={handleStartEmptyWorkout} onUpdate={refreshData} />;
      case 'targets': return <TargetsView userMissions={userMissions} history={history} exercises={allExercises} userProfile={user} biometricLogs={biometricLogs} onAddMission={handleAddMission} onDeleteMission={handleDeleteMission} />;
      case 'library': return ( <ExerciseLibrary allExercises={allExercises} history={history} onUpdate={refreshData} userProfile={user} initialExerciseId={targetExerciseId} onClose={() => setTargetExerciseId(null)} /> );
      case 'gyms': return <LocationManager zones={zones} onUpdate={refreshData} />;
      case 'ai': return <AIProgramDashboard onStartSession={handleStartSession} onGoToExercise={handleGoToExercise} onUpdate={refreshData} />;
      default: return null;
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#0f0d15] selection:bg-accent-pink selection:text-white relative overflow-x-hidden">
      <style>{globalStyles}</style>
      {showOnboarding && isReady && ( <OnboardingWizard onComplete={() => { setShowOnboarding(false); refreshData(); }} /> )}
      {renderContent()}
      {showStartMenu && (
        <div className="fixed inset-0 bg-[#0f0d15] z-[150] p-8 pt-[calc(env(safe-area-inset-top)+2rem)] flex flex-col overflow-y-auto scrollbar-hide">
          <header className="flex justify-between items-center mb-10"><h3 className="text-3xl font-black italic uppercase tracking-tighter">{selectedZoneForStart ? 'Välj Rutin' : 'Vart tränar du?'}</h3><button onClick={() => { setShowStartMenu(false); setSelectedZoneForStart(null); setPendingManualDate(null); }} className="text-text-dim p-2"><X size={32}/></button></header>
          {!selectedZoneForStart ? (
            <div className="grid grid-cols-1 w-full gap-4">
              {zones.map(z => (<button key={z.id} onClick={() => setSelectedZoneForStart(z)} className="bg-white/5 p-8 rounded-[40px] border border-white/10 flex items-center justify-between group active:scale-95 transition-all"><div className="flex items-center gap-6"><div className="w-16 h-16 bg-white/5 rounded-[24px] flex items-center justify-center">{z.name.toLowerCase().includes('hem') ? <Home size={32} /> : z.name.toLowerCase().includes('ute') ? <Trees size={32} /> : <MapPin size={32} />}</div><span className="text-2xl font-black uppercase italic tracking-tight">{z.name}</span></div><ChevronRight size={32} className="text-text-dim" /></button>))}
            </div>
          ) : ( <RoutinePicker onStart={handleStartWorkout} activeZone={selectedZoneForStart} allExercises={allExercises} userProfile={user} routines={routines} onUpdate={refreshData} history={history} /> )}
        </div>
      )}
      {showZonePicker && pendingActivity && (
          <ZonePickerModal onClose={() => setShowZonePicker(false)} zones={zones} plannedExercises={pendingActivity.exercises || []} allExercises={allExercises} onSelect={handleFinalizeSessionStart} />
      )}
      {!isWorkoutActive && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 px-6 pt-4 bg-gradient-to-t from-[#0f0d15] via-[#0f0d15] to-transparent fixed-bottom-nav">
          <div className="max-w-md mx-auto flex gap-1 items-center bg-[#1a1721]/80 backdrop-blur-xl border border-white/10 p-2 rounded-[32px] shadow-2xl overflow-x-auto scrollbar-hide">
            <button onClick={() => navigateToTab('workout', { fromNav: true })} className={`flex-shrink-0 px-5 flex flex-col items-center gap-1 p-3 rounded-2xl transition-all ${activeTab === 'workout' ? 'bg-white text-black' : 'text-text-dim'}`}><Dumbbell size={20} /><span className="text-[10px] font-black uppercase tracking-widest">Träning</span></button>
            <button onClick={() => navigateToTab('gyms', { fromNav: true })} className={`flex-shrink-0 px-5 flex flex-col items-center gap-1 p-3 rounded-2xl transition-all ${activeTab === 'gyms' ? 'bg-white text-black' : 'text-text-dim'}`}><MapPin size={20} /><span className="text-[10px] font-black uppercase tracking-widest">Platser</span></button>
            <button onClick={() => navigateToTab('body', { fromNav: true })} className={`flex-shrink-0 px-5 flex flex-col items-center gap-1 p-3 rounded-2xl transition-all ${activeTab === 'body' ? 'bg-white text-black' : 'text-text-dim'}`}><User2 size={20} /><span className="text-[10px] font-black uppercase tracking-widest">Kropp</span></button>
            <button onClick={() => navigateToTab('ai', { fromNav: true })} className={`flex-shrink-0 px-5 flex flex-col items-center gap-1 p-3 rounded-2xl transition-all ${activeTab === 'ai' ? 'bg-white text-black' : 'text-text-dim'}`}><Sparkles size={20} /><span className="text-[10px] font-black uppercase tracking-widest">AI PT</span></button>
            <button onClick={() => navigateToTab('targets', { fromNav: true })} className={`flex-shrink-0 px-5 flex flex-col items-center gap-1 p-3 rounded-2xl transition-all ${activeTab === 'targets' ? 'bg-white text-black' : 'text-text-dim'}`}><Trophy size={20} /><span className="text-[10px] font-black uppercase tracking-widest">Mål</span></button>
            <button onClick={() => navigateToTab('library', { fromNav: true })} className={`flex-shrink-0 px-5 flex flex-col items-center gap-1 p-3 rounded-2xl transition-all ${activeTab === 'library' ? 'bg-white text-black' : 'text-text-dim'}`}><BookOpen size={20} /><span className="text-[10px] font-black uppercase tracking-widest">Övningar</span></button>
            <button onClick={() => navigateToTab('log', { fromNav: true })} className={`flex-shrink-0 px-5 flex flex-col items-center gap-1 p-3 rounded-2xl transition-all ${activeTab === 'log' ? 'bg-white text-black' : 'text-text-dim'}`}><Calendar size={20} /><span className="text-[10px] font-black uppercase tracking-widest">Logg</span></button>
          </div>
        </nav>
      )}
    </div>
  );
}
