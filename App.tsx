
import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, Zone, WorkoutSession, Exercise, BiometricLog, PlannedExercise, GoalTarget, WorkoutRoutine, ScheduledActivity, RecurringPlan, PlannedActivityForLogDisplay, UserMission, BodyMeasurements, SetType, Equipment } from './types';
import { WorkoutView } from './components/WorkoutView';
import { ExerciseLibrary } from './components/ExerciseLibrary';
import { WorkoutLog } from './components/WorkoutLog';
import { TargetsView } from './components/TargetsView';
import { RoutinePicker } from './components/RoutinePicker';
import { StatsView } from './components/StatsView';
import { MeasurementsView } from './components/MeasurementsView';
import { LocationManager } from './components/LocationManager';
import { storage, setCachedSession } from './services/storage';
import { db, importDatabase, exportDatabase } from './services/db'; 
import { OnboardingWizard } from './components/OnboardingWizard';
import { SettingsView } from './components/SettingsView';
import { AIProgramDashboard } from './components/AIProgramDashboard';
import { ZonePickerModal } from './components/ZonePickerModal';
import { supabase } from './services/supabase';
import Auth from './components/Auth';
import { autoMigrateOnStartup } from './services/migrateToSupabase';
import { listBackups, downloadBackup, uploadBackup, getAccessToken } from './services/googleDrive';
import { calculate1RM, getLastPerformance } from './utils/fitness';
import { suggestWeightForReps } from './utils/progression';
import { registerBackHandler, executeBackHandler } from './utils/backHandler';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { triggerHaptic } from './utils/haptics';
import { App as CapacitorApp } from '@capacitor/app';
import { Dumbbell, User2, Calendar, X, MapPin, Activity, Home, Trees, ChevronRight, Settings, Trophy, BookOpen, Cloud, Sparkles, Plus, Edit3 } from 'lucide-react';

const APP_VERSION = 'v2.0.0-build-' + Date.now();

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [isInitializingAuth, setIsInitializingAuth] = useState(true);
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
  const [editingZoneInStartMenu, setEditingZoneInStartMenu] = useState<Zone | null>(null);

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
      /* Inaktivera pull-to-refresh på mobila enheter */
      overscroll-behavior-y: contain;
    }

    /* Inaktivera pull-to-refresh specifikt för vissa webkit-browsers (Safari, Chrome iOS) */
    html, body {
      overscroll-behavior: none;
      -webkit-overflow-scrolling: touch;
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
    console.log('📥 refreshData - Hämtar alla data från Supabase...');
    const startTime = performance.now();
    try {
      // Kör queries sekventiellt med timing för att identifiera långsamma
      const t1 = performance.now();
      const p = await storage.getUserProfile();
      console.log(`⏱️ getUserProfile: ${Math.round(performance.now() - t1)}ms`);

      const t2 = performance.now();
      const z = await storage.getZones();
      console.log(`⏱️ getZones: ${Math.round(performance.now() - t2)}ms`);

      const t3 = performance.now();
      const h = await storage.getHistory();
      console.log(`⏱️ getHistory: ${Math.round(performance.now() - t3)}ms`);

      const t4 = performance.now();
      const logs = await storage.getBiometricLogs();
      console.log(`⏱️ getBiometricLogs: ${Math.round(performance.now() - t4)}ms`);

      const t5 = performance.now();
      const sess = await storage.getActiveSession();
      console.log(`⏱️ getActiveSession: ${Math.round(performance.now() - t5)}ms`);

      const t6 = performance.now();
      const ex = await storage.getAllExercises();
      console.log(`⏱️ getAllExercises: ${Math.round(performance.now() - t6)}ms`);

      const t7 = performance.now();
      const gt = await storage.getGoalTargets();
      console.log(`⏱️ getGoalTargets: ${Math.round(performance.now() - t7)}ms`);

      const t8 = performance.now();
      const r = await storage.getRoutines();
      console.log(`⏱️ getRoutines: ${Math.round(performance.now() - t8)}ms`);

      const t9 = performance.now();
      const scheduled = await storage.getScheduledActivities();
      console.log(`⏱️ getScheduledActivities: ${Math.round(performance.now() - t9)}ms`);

      const t10 = performance.now();
      const recurring = await storage.getRecurringPlans();
      console.log(`⏱️ getRecurringPlans: ${Math.round(performance.now() - t10)}ms`);

      const t11 = performance.now();
      const missions = await storage.getUserMissions();
      console.log(`⏱️ getUserMissions: ${Math.round(performance.now() - t11)}ms`);

      const totalTime = performance.now() - startTime;
      console.log(`⏱️ refreshData TOTALT: ${Math.round(totalTime)}ms`);
      console.log('🔍 refreshData - Profil:', p);
      console.log('🔍 refreshData - Zoner:', z.length);

    // ENKEL REGEL: Visa onboarding ENDAST om användaren har standardnamnet "Atlet"
    // Om de har bytt namn = de har konfigurerat sin profil = ingen onboarding!
    const shouldShowOnboarding = p.name === "Atlet";
    setShowOnboarding(shouldShowOnboarding);

    setUser(p);
    setZones(z);
    setHistory(h);
    setBiometricLogs(logs);
    setCurrentSession(sess || null);
    setAllExercises(ex);
    setGoalTargets(gt);
    setRoutines(r);
    
    const allPlansForDisplay: PlannedActivityForLogDisplay[] = [
      ...scheduled, // Include ALL scheduled activities (components will filter as needed)
      ...recurring.map(rp => ({
          id: rp.id,
          date: rp.startDate,
          type: rp.type,
          title: rp.title,
          isCompleted: false,
          exercises: rp.exercises,
          isTemplate: true,
          daysOfWeek: rp.daysOfWeek,
          color: rp.color // ✅ Inkludera färgen från recurring plan
      }))
    ];
    setPlannedActivities(allPlansForDisplay);
    setUserMissions(missions);
    } catch (error) {
      console.error('❌ refreshData fel:', error);
      throw error;
    }
  };

  useEffect(() => {
    // 1. Kolla om vi redan har en session när appen startar
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('🔐 getSession() returnerade:', session ? `SESSION FINNS (user: ${session.user?.id})` : 'SESSION NULL');
      setSession(session);
      setCachedSession(session); // Sätt memory-cache direkt!
      console.log('✅ setCachedSession() anropad');

      // 2. Om användaren är inloggad, kolla om migrering behövs INNAN vi laddar data
      if (session?.user) {
        setLoadingStatus('Kontrollerar datamigrering...');
        await autoMigrateOnStartup();
      }

      console.log('✅ setIsInitializingAuth(false) - Auth klar, initApp kan köra nu!');
      setIsInitializingAuth(false);
    });

    // 3. Lyssna på inloggningar/utloggningar i realtid
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log(`🔐 Auth event: ${_event}`);
      setSession(session);
      setCachedSession(session); // Uppdatera memory-cache för snabb access!

      // Om användaren precis loggat in (SIGNED_IN), ladda om data
      // Detta är viktigt för Incognito mode där appen startar INNAN inloggning
      if (_event === 'SIGNED_IN' && session?.user) {
        console.log('✅ SIGNED_IN event - laddar om data efter inloggning');
        try {
          // Timeout efter 10s - om det tar längre, fortsätt ändå
          const refreshPromise = refreshData();
          const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('SIGNED_IN refreshData timeout')), 10000)
          );
          await Promise.race([refreshPromise, timeout]);
        } catch (error) {
          console.error('⚠️ refreshData i SIGNED_IN misslyckades:', error);
          // Fortsätt ändå - appen kan starta med cached/default data
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Vänta tills auth är klar innan vi startar appen
    if (isInitializingAuth) {
      console.log('⏳ Väntar på auth...');
      return;
    }

    const initApp = async () => {
      console.log('🚀 initApp() startar (auth klar, session cachad)...');
      try {
        setLoadingStatus('Ansluter till databas...');
        console.log('📦 storage.init()...');
        await storage.init();
        console.log('✅ Storage initialiserad - hoppar över Google Drive (använder Supabase nu)');
        setLoadingStatus('Synkroniserar övningsbibliotek...');
        console.log('🔄 db.syncExercises() (max 10s)...');
        try {
          const syncPromise = db.syncExercises();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Sync timeout')), 10000)
          );
          await Promise.race([syncPromise, timeoutPromise]);
          console.log('✅ Synk klar');
        } catch (e) {
          console.warn("Kunde inte synka övningar vid start:", e);
          setLoadingStatus('Synk misslyckades, laddar lokalt...');
        }
        setLoadingStatus('Läser in användardata...');
        console.log('📊 refreshData()...');
        try {
          const refreshPromise = refreshData();
          const refreshTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('refreshData timeout efter 30s')), 30000)
          );
          await Promise.race([refreshPromise, refreshTimeout]);
          console.log('✅ refreshData klar!');
        } catch (refreshError) {
          console.error('⚠️ refreshData misslyckades, sätter default-user:', refreshError);
          // Sätt en minimal user så att appen kan starta
          setUser({
            id: session?.user?.id || 'temp',
            name: session?.user?.email?.split('@')[0] || 'Användare',
            email: session?.user?.email || '',
            settings: {},
            createdAt: new Date().toISOString()
          } as any);
        }
        const activeSess = await storage.getActiveSession();
        if (activeSess) setActiveTab('workout');
        setLoadingStatus('Slutför...');
      } catch (error) {
        console.error("Kritisk fel vid start:", error);
        setLoadingStatus(`Ett fel uppstod: ${error instanceof Error ? error.message : 'Okänt fel'}`);
      } finally {
        console.log('✅ setIsReady(true) - Appen ska nu visa innehåll');
        setIsReady(true);
      }
    };
    initApp();
  }, [isInitializingAuth]); // Kör när auth är klar!

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
        // Update scheduled activity in Supabase (not local db)
        await storage.updateScheduledActivity(session.sourceActivityId, {
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
      sourceActivityId: pendingActivity.id,
      sourceActivityColor: pendingActivity.color // Spara färgen från det planerade passet
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
    console.log('🔵 handleAddPlan called:', { activityId: activity.id, recurrenceId: activity.recurrenceId, date: activity.date, isRecurring, color: activity.color });
    if (isRecurring && days) {
      const plan: RecurringPlan = {
        id: `rec-${Date.now()}`,
        type: activity.type,
        title: activity.title,
        daysOfWeek: days,
        startDate: activity.date,
        exercises: activity.exercises,
        color: activity.color // Inkludera färgen!
      };
      await storage.addRecurringPlan(plan);
      await storage.generateRecurringActivities();
    } else {
      console.log('🟢 Adding scheduled activity to database...');
      await storage.addScheduledActivity(activity);
      console.log('✅ Scheduled activity added successfully');
    }
    await refreshData();
    console.log('🔄 RefreshData completed - recurring instance should now be hidden');
  };

  const handleDeletePlan = async (id: string, isTemplate: boolean) => {
    try {
      if (isTemplate) { await storage.deleteRecurringPlan(id); } else { await storage.deleteScheduledActivity(id); }
      await refreshData();
    } catch (error) { console.error("Could not delete plan:", error); }
  };

  const handleMovePlan = async (id: string, newDate: string) => {
    try {
      console.log("Moving plan to new date:", id, newDate);
      await storage.updateScheduledActivity(id, { date: newDate });
      await refreshData();
      console.log("Plan moved successfully!");
    } catch (error) {
      console.error("Could not move plan:", error);
      alert("Kunde inte flytta passet: " + (error as Error).message);
    }
  };

  const handleMoveRecurringInstance = async (templateId: string, currentDate: string, newDate: string) => {
    try {
      console.log("Moving recurring instance:", templateId, currentDate, "→", newDate);

      // Hämta recurring plans från storage
      const allRecurringPlans = await storage.getRecurringPlans();
      const template = allRecurringPlans.find(rp => rp.id === templateId);

      if (!template) {
        throw new Error("Recurring plan hittades inte");
      }

      // Skapa en konkret ScheduledActivity på det nya datumet
      const newActivity: ScheduledActivity = {
        id: `recurring-instance-${Date.now()}`,
        date: newDate,
        type: template.type,
        title: template.title,
        isCompleted: false,
        exercises: template.exercises,
        recurrenceId: templateId
      };

      await storage.addScheduledActivity(newActivity);
      await refreshData();
      console.log("Recurring instance flyttad!");
    } catch (error) {
      console.error("Could not move recurring instance:", error);
      alert("Kunde inte flytta passet: " + (error as Error).message);
    }
  };

  const handleSkipRecurringInstance = async (templateId: string, date: string) => {
    try {
      console.log("Skipping recurring instance:", templateId, "på", date);

      // Hämta recurring plans från storage
      const allRecurringPlans = await storage.getRecurringPlans();
      const template = allRecurringPlans.find(rp => rp.id === templateId);

      if (!template) {
        throw new Error("Recurring plan hittades inte");
      }

      // Skapa en "skippad" ScheduledActivity för detta datum
      // Detta gör att mallen inte visas längre för den dagen
      const skippedActivity: ScheduledActivity = {
        id: `skipped-${templateId}-${date}`,
        date: date,
        type: template.type,
        title: `[Skippad] ${template.title}`,
        isCompleted: true, // Markera som "klar" så den inte visas i listan
        exercises: [],
        recurrenceId: templateId
      };

      await storage.addScheduledActivity(skippedActivity);
      await refreshData();
      console.log("Recurring instance skippad!");
    } catch (error) {
      console.error("Could not skip recurring instance:", error);
      alert("Kunde inte ta bort passet: " + (error as Error).message);
    }
  };

  const handleUpdateScheduledActivity = async (id: string, updates: Partial<ScheduledActivity>) => {
    try {
      await storage.updateScheduledActivity(id, updates);
      // NOTE: refreshData() anropas av anroparen efter denna funktion
    } catch (error) {
      console.error("Could not update scheduled activity:", error);
      alert("Kunde inte uppdatera passet: " + (error as Error).message);
    }
  };

  const handleUpdateRecurringPlan = async (id: string, updates: Partial<RecurringPlan>) => {
    try {
      await storage.updateRecurringPlan(id, updates);
      // NOTE: refreshData() anropas av anroparen efter denna funktion
    } catch (error) {
      console.error("Could not update recurring plan:", error);
      alert("Kunde inte uppdatera återkommande pass: " + (error as Error).message);
    }
  };

  const handleAddMission = async (mission: UserMission) => {
    console.log("handleAddMission called with:", mission);
    try {
      await storage.addUserMission(mission);
      console.log("Mission added successfully, refreshing data...");
      await refreshData();
      console.log("Data refreshed!");
    } catch (error) {
      console.error("Failed to add mission:", error);
      alert("Kunde inte spara uppdraget: " + (error as Error).message);
    }
  };
  const handleDeleteMission = async (id: string) => { if (confirm("Are you sure you want to delete this mission?")) { await storage.deleteUserMission(id); await refreshData(); } };
  const handleGoToExercise = (exerciseId: string) => { setTargetExerciseId(exerciseId); navigateToTab('library'); };

  if (isInitializingAuth) {
    console.log('🔄 Loading screen - Version:', APP_VERSION);
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0f0d15] text-white p-6">
        <div className="relative"><div className="w-24 h-24 border-4 border-accent-pink/20 border-t-accent-pink rounded-full animate-spin"></div><Activity className="absolute inset-0 m-auto text-accent-pink animate-pulse" size={32} /></div>
        <h1 className="mt-8 text-2xl font-black uppercase italic tracking-[0.3em] animate-pulse">MorphFit</h1>
        <div className="mt-4 px-4 py-2 bg-white/5 rounded-xl border border-white/10"><p className="text-[10px] font-mono text-text-dim uppercase tracking-widest animate-pulse">Laddar MorphFit...</p></div>
        <div className="mt-2 px-2 py-1 bg-green-500/20 rounded border border-green-500/30"><p className="text-[8px] font-mono text-green-400">{APP_VERSION}</p></div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  if (!isReady || !user) {
    console.log('⏳ Väntar på ready...', { isReady, user: user ? 'finns' : 'null', version: APP_VERSION });
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0f0d15] text-white p-6">
        <div className="relative"><div className="w-24 h-24 border-4 border-accent-pink/20 border-t-accent-pink rounded-full animate-spin"></div><Activity className="absolute inset-0 m-auto text-accent-pink animate-pulse" size={32} /></div>
        <h1 className="mt-8 text-2xl font-black uppercase italic tracking-[0.3em] animate-pulse">MorphFit</h1>
        <div className="mt-4 px-4 py-2 bg-white/5 rounded-xl border border-white/10"><p className="text-[10px] font-mono text-text-dim uppercase tracking-widest animate-pulse">{loadingStatus}</p></div>
        <div className="mt-2 px-2 py-1 bg-green-500/20 rounded border border-green-500/30"><p className="text-[8px] font-mono text-green-400">{APP_VERSION}</p></div>
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
      case 'log': return <WorkoutLog history={history} plannedActivities={plannedActivities} routines={routines} allExercises={allExercises} onAddPlan={handleAddPlan} onDeletePlan={handleDeletePlan} onDeleteHistory={handleDeleteHistory} onMovePlan={handleMovePlan} onMoveRecurringInstance={handleMoveRecurringInstance} onSkipRecurringInstance={handleSkipRecurringInstance} onUpdateScheduledActivity={handleUpdateScheduledActivity} onUpdateRecurringPlan={handleUpdateRecurringPlan} onStartActivity={handleStartSession} onStartManualWorkout={handleStartManualWorkout} onStartLiveWorkout={handleStartEmptyWorkout} onUpdate={refreshData} />;
      case 'targets': return <TargetsView userMissions={userMissions} history={history} exercises={allExercises} userProfile={user} biometricLogs={biometricLogs} onAddMission={handleAddMission} onDeleteMission={handleDeleteMission} />;
      case 'library': return ( <ExerciseLibrary allExercises={allExercises} history={history} onUpdate={refreshData} userProfile={user} initialExerciseId={targetExerciseId} onClose={() => setTargetExerciseId(null)} /> );
      case 'gyms': return null; // Platser-fliken borttagen - allt hanteras från "Vart tränar du"
      case 'ai': return <AIProgramDashboard onStartSession={handleStartSession} onGoToExercise={handleGoToExercise} onUpdate={refreshData} />;
      default: return null;
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#0f0d15] selection:bg-accent-pink selection:text-white relative overflow-x-hidden">
      <style>{globalStyles}</style>
      {showOnboarding && isReady && ( <OnboardingWizard onComplete={() => {
        setShowOnboarding(false);
        // refreshData() kommer hämta den uppdaterade profilen med namn → onboarding visas inte igen!
        refreshData();
      }} /> )}
      {renderContent()}
      {showStartMenu && (
        <div className="fixed inset-0 bg-[#0f0d15] z-[150] p-8 pt-[calc(env(safe-area-inset-top)+2rem)] flex flex-col overflow-y-auto scrollbar-hide">
          <header className="flex justify-between items-center mb-10">
            <div className="flex items-center gap-4">
              <h3 className="text-3xl font-black italic uppercase tracking-tighter">{selectedZoneForStart ? 'Välj Rutin' : 'Vart tränar du?'}</h3>
              {!selectedZoneForStart && !editingZoneInStartMenu && (
                <button
                  onClick={() => {
                    setEditingZoneInStartMenu({
                      id: `zone-${Date.now()}`,
                      name: '',
                      icon: 'building',
                      inventory: [],
                      availablePlates: [25, 20, 15, 10, 5, 2.5, 1.25]
                    });
                  }}
                  className="p-3 bg-accent-pink text-white rounded-2xl shadow-lg active:scale-95 transition-all"
                  title="Lägg till plats"
                >
                  <Plus size={20} strokeWidth={3} />
                </button>
              )}
            </div>
            <button onClick={() => { setShowStartMenu(false); setSelectedZoneForStart(null); setPendingManualDate(null); }} className="text-text-dim p-2"><X size={32}/></button>
          </header>
          {editingZoneInStartMenu ? (
            <LocationManager
              zones={zones}
              onUpdate={refreshData}
              initialZoneToEdit={editingZoneInStartMenu}
              onClearInitialZone={() => {}}
              onEditClose={() => setEditingZoneInStartMenu(null)}
            />
          ) : !selectedZoneForStart ? (
            <div className="grid grid-cols-1 w-full gap-4">
              {zones.map(z => (
                <div key={z.id} className="relative group flex gap-2">
                  <button onClick={() => setSelectedZoneForStart(z)} className="flex-1 bg-white/5 p-8 rounded-[40px] border border-white/10 flex items-center justify-between active:scale-95 transition-all hover:bg-white/10">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-white/5 rounded-[24px] flex items-center justify-center">
                        {z.name.toLowerCase().includes('hem') ? <Home size={32} /> : z.name.toLowerCase().includes('ute') ? <Trees size={32} /> : <MapPin size={32} />}
                      </div>
                      <span className="text-2xl font-black uppercase italic tracking-tight">{z.name}</span>
                    </div>
                    <ChevronRight size={32} className="text-text-dim" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingZoneInStartMenu(z);
                    }}
                    className="p-6 bg-white/5 rounded-2xl text-text-dim hover:text-white hover:bg-white/10 transition-colors"
                    title="Redigera plats"
                  >
                    <Edit3 size={24} />
                  </button>
                </div>
              ))}
            </div>
          ) : ( <RoutinePicker onStart={handleStartWorkout} activeZone={selectedZoneForStart} allExercises={allExercises} userProfile={user} routines={routines} onUpdate={refreshData} history={history} /> )}
        </div>
      )}
      {showZonePicker && pendingActivity && (
          <ZonePickerModal onClose={() => setShowZonePicker(false)} zones={zones} plannedExercises={pendingActivity.exercises || []} allExercises={allExercises} onSelect={handleFinalizeSessionStart} />
      )}
      {!isWorkoutActive && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 px-2 sm:px-6 pt-4 bg-gradient-to-t from-[#0f0d15] via-[#0f0d15] to-transparent fixed-bottom-nav">
          <div className="max-w-md mx-auto flex w-full justify-between items-center bg-[#1a1721]/80 backdrop-blur-xl border border-white/10 p-2 rounded-[32px] shadow-2xl">
            <button onClick={() => navigateToTab('workout', { fromNav: true })} className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-2xl transition-all ${activeTab === 'workout' ? 'bg-white text-black' : 'text-text-dim'}`}>
              <Dumbbell size={18} />
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-center truncate w-full">Träning</span>
            </button>
            <button onClick={() => navigateToTab('body', { fromNav: true })} className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-2xl transition-all ${activeTab === 'body' ? 'bg-white text-black' : 'text-text-dim'}`}>
              <User2 size={18} />
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-center truncate w-full">Kropp</span>
            </button>
            <button onClick={() => navigateToTab('ai', { fromNav: true })} className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-2xl transition-all ${activeTab === 'ai' ? 'bg-white text-black' : 'text-text-dim'}`}>
              <Sparkles size={18} />
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-center truncate w-full">AI PT</span>
            </button>
            <button onClick={() => navigateToTab('targets', { fromNav: true })} className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-2xl transition-all ${activeTab === 'targets' ? 'bg-white text-black' : 'text-text-dim'}`}>
              <Trophy size={18} />
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-center truncate w-full">Mål</span>
            </button>
            <button onClick={() => navigateToTab('library', { fromNav: true })} className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-2xl transition-all ${activeTab === 'library' ? 'bg-white text-black' : 'text-text-dim'}`}>
              <BookOpen size={18} />
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-center truncate w-full">Övningar</span>
            </button>
            <button onClick={() => navigateToTab('log', { fromNav: true })} className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-2xl transition-all ${activeTab === 'log' ? 'bg-white text-black' : 'text-text-dim'}`}>
              <Calendar size={18} />
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-center truncate w-full">Logg</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
