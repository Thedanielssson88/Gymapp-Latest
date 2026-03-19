# 🏥 Health Data Integration Plan - MorphFit

## 📋 Executive Summary

Integration av Oura Ring, Apple Health, Google Health Connect och Android Health Connect för att skapa en omfattande recovery dashboard liknande Whoop och Athlytic.

**Din nuvarande app:** React + Capacitor hybrid (iOS/Android), Supabase backend, lokala Dexie databas
**Nuvarande recovery-data:** Muskelåterhämtning baserat på träningsbelastning
**Mål:** Lägga till sömndata, HRV, vilopuls, aktivitetsnivå, och andra biometriska mätvärden för holistisk recovery-analys

---

## 🎯 Vad du vill åstadkomma

### Recovery Dashboard Features (inspirerat av Whoop/Athlytic):
1. **Daily Readiness Score** - kombination av sömn, HRV, vilopuls, träningsbelastning
2. **Sleep Analysis** - sömnfaser, total sömntid, sömnkvalitet, sömncykler
3. **HRV Tracking** - hjärtvariabilitet som indikator på återhämtning
4. **Resting Heart Rate** - vilopuls trend över tid
5. **Strain Score** - daglig belastning från träning + aktivitet
6. **Activity Energy** - kalorier från aktivitet (inte basalmetabolism)
7. **Recovery Recommendations** - AI-driven råd baserat på all data

### Datakällor:
- **Oura Ring** - sömn, HRV, temperatur, aktivitet
- **Apple Health** - alla iOS health metrics
- **Google Fit / Health Connect** - Android health metrics
- **Din träningsdata** - befintlig workout tracking

---

## 🏗️ Teknisk Arkitektur

### Option A: Native Health API (REKOMMENDERAS)
**Fördelar:**
- Ingen extra backend-infrastruktur
- Direkt åtkomst till plattformens hälsodata
- Offline-first (synkar när tillgänglig)
- Gratis (inga API-kostnader)
- Fungerar med ALL hälsodata som användaren har (inte bara Oura)

**Nackdelar:**
- Måste hantera två olika API:er (iOS vs Android)
- Kräver native code (Capacitor plugin)

### Option B: Oura Cloud API + Google Fit REST API
**Fördelar:**
- Enhetlig API över plattformar
- Enklare att implementera (bara HTTP requests)
- Kan hämta historisk data från molnet

**Nackdelar:**
- Kräver OAuth-flöde för varje tjänst
- Kostar pengar (Oura API är beta, kan bli betalat)
- Begränsad till specifika tjänster (inte ALL hälsodata)
- Kräver internet-anslutning
- Mer privacy concerns (data går via deras servrar)

---

## 📦 Rekommenderad Lösning: Native Health API

### 1. iOS: HealthKit via Capacitor Plugin

#### Installation:
```bash
npm install @perfood/capacitor-healthkit
npx cap sync
```

#### Configuration (`ios/App/App/Info.plist`):
```xml
<key>NSHealthShareUsageDescription</key>
<string>MorphFit needs access to your health data to provide recovery insights and optimize your training.</string>
<key>NSHealthUpdateUsageDescription</key>
<string>MorphFit writes your workout data to Apple Health for complete tracking.</string>
```

#### iOS Implementation Strategy:
```typescript
// services/healthkit.ts
import { HealthKit } from '@perfood/capacitor-healthkit';

export interface HealthData {
  sleep: {
    totalMinutes: number;
    deepMinutes: number;
    remMinutes: number;
    lightMinutes: number;
    date: string;
  }[];
  hrv: {
    value: number; // milliseconds
    date: string;
  }[];
  restingHeartRate: {
    value: number; // bpm
    date: string;
  }[];
  activeEnergy: {
    calories: number;
    date: string;
  }[];
  steps: {
    count: number;
    date: string;
  }[];
}

export async function requestHealthKitPermissions(): Promise<boolean> {
  try {
    const permissions = {
      read: [
        'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
        'HKQuantityTypeIdentifierRestingHeartRate',
        'HKQuantityTypeIdentifierHeartRate',
        'HKQuantityTypeIdentifierActiveEnergyBurned',
        'HKQuantityTypeIdentifierStepCount',
        'HKCategoryTypeIdentifierSleepAnalysis',
        'HKQuantityTypeIdentifierOxygenSaturation',
        'HKQuantityTypeIdentifierBodyTemperature',
      ],
      write: [
        'HKWorkoutTypeIdentifier',
        'HKQuantityTypeIdentifierActiveEnergyBurned',
      ]
    };

    await HealthKit.requestAuthorization(permissions);
    return true;
  } catch (error) {
    console.error('HealthKit permission error:', error);
    return false;
  }
}

export async function getLastNightSleep(): Promise<SleepData | null> {
  // Hämta senaste nattens sömndata
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 1);

  const result = await HealthKit.querySampleType({
    sampleName: 'HKCategoryTypeIdentifierSleepAnalysis',
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });

  // Processar sömnfaser...
  return processSleepData(result);
}

export async function getHRVLast7Days(): Promise<HRVData[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  const result = await HealthKit.querySampleType({
    sampleName: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });

  return result.resultData.map(sample => ({
    value: sample.quantity,
    date: sample.startDate,
  }));
}
```

### 2. Android: Health Connect API

#### Installation:
```bash
npm install @capacitor-community/health
npx cap sync
```

#### Configuration (`android/app/src/main/AndroidManifest.xml`):
```xml
<uses-permission android:name="android.permission.health.READ_SLEEP" />
<uses-permission android:name="android.permission.health.READ_HEART_RATE" />
<uses-permission android:name="android.permission.health.READ_HEART_RATE_VARIABILITY" />
<uses-permission android:name="android.permission.health.READ_ACTIVE_CALORIES_BURNED" />
<uses-permission android:name="android.permission.health.READ_STEPS" />

<application>
  <activity android:name="androidx.health.connect.client.PermissionActivity" />
</application>
```

#### Android Implementation:
```typescript
// services/healthconnect.ts
import { Health, HealthDataType } from '@capacitor-community/health';

export async function requestHealthConnectPermissions(): Promise<boolean> {
  try {
    const result = await Health.requestAuthorization({
      read: [
        HealthDataType.SleepSession,
        HealthDataType.HeartRate,
        HealthDataType.HeartRateVariability,
        HealthDataType.RestingHeartRate,
        HealthDataType.Steps,
        HealthDataType.ActiveCaloriesBurned,
      ],
      write: [HealthDataType.ExerciseSession]
    });
    return result.granted;
  } catch (error) {
    console.error('Health Connect permission error:', error);
    return false;
  }
}

export async function getHealthConnectSleep(): Promise<SleepData | null> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 1);

  const result = await Health.query({
    dataType: HealthDataType.SleepSession,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });

  return processAndroidSleepData(result.data);
}
```

### 3. Unified Health Service (Platform Agnostic)

```typescript
// services/health.ts
import { Capacitor } from '@capacitor/core';
import * as HealthKit from './healthkit';
import * as HealthConnect from './healthconnect';

export class HealthService {
  private platform: 'ios' | 'android' | 'web';

  constructor() {
    this.platform = Capacitor.getPlatform() as any;
  }

  async requestPermissions(): Promise<boolean> {
    if (this.platform === 'ios') {
      return HealthKit.requestHealthKitPermissions();
    } else if (this.platform === 'android') {
      return HealthConnect.requestHealthConnectPermissions();
    }
    return false;
  }

  async getLastNightSleep(): Promise<SleepData | null> {
    if (this.platform === 'ios') {
      return HealthKit.getLastNightSleep();
    } else if (this.platform === 'android') {
      return HealthConnect.getHealthConnectSleep();
    }
    return null;
  }

  async getHRVLast7Days(): Promise<HRVData[]> {
    if (this.platform === 'ios') {
      return HealthKit.getHRVLast7Days();
    } else if (this.platform === 'android') {
      return HealthConnect.getHRVLast7Days();
    }
    return [];
  }

  async getRestingHeartRate(): Promise<number | null> {
    // Implementation...
  }

  async getActiveCalories(date: Date): Promise<number> {
    // Implementation...
  }

  async getDailySteps(date: Date): Promise<number> {
    // Implementation...
  }
}

export const healthService = new HealthService();
```

---

## 🗄️ Data Structure Updates

### Utöka BiometricLog:
```typescript
// types.ts - BEFORE
export interface BiometricLog {
  id: string;
  date: string;
  weight: number;
  measurements: BodyMeasurements;
}

// types.ts - AFTER
export interface BiometricLog {
  id: string;
  date: string;
  weight: number;
  measurements: BodyMeasurements;

  // Nya recovery metrics
  sleep?: {
    totalMinutes: number;
    deepMinutes: number;
    remMinutes: number;
    lightMinutes: number;
    awakeMinutes: number;
    efficiency: number; // 0-100%
    sleepScore?: number; // 0-100, beräknad
  };

  hrv?: {
    value: number; // ms (SDNN)
    trend?: 'improving' | 'declining' | 'stable';
  };

  restingHeartRate?: {
    value: number; // bpm
    trend?: 'improving' | 'declining' | 'stable';
  };

  activity?: {
    activeCalories: number;
    steps: number;
    activeMinutes: number;
  };

  recovery?: {
    readinessScore: number; // 0-100, vårt egna beräknade värde
    strainScore: number; // 0-21, baserat på träningsbelastning
    recommendation: 'rest' | 'light' | 'moderate' | 'intense';
  };

  temperature?: {
    deviation: number; // °C från baseline
  };

  // Metadata
  dataSource?: 'manual' | 'apple_health' | 'health_connect' | 'oura' | 'whoop';
  syncedAt?: string;
}
```

### Ny UserProfile properties:
```typescript
export interface UserProfile {
  // ... existing fields

  // Health integration settings
  healthIntegration?: {
    enabled: boolean;
    lastSync?: string;
    preferredSource?: 'apple_health' | 'health_connect' | 'oura';

    // Baseline values (beräknas från första 2 veckor)
    baselineHRV?: number;
    baselineRestingHR?: number;
    baselineBodyTemp?: number;

    // Preferences
    syncFrequency?: 'realtime' | 'daily' | 'manual';
    notifyOnPoorRecovery?: boolean;
    autoAdjustWorkouts?: boolean; // Justera träning baserat på recovery
  };
}
```

---

## 🧮 Recovery Scoring Algorithm

### Readiness Score Calculation:
```typescript
// utils/recoveryScore.ts

export interface RecoveryFactors {
  sleepScore: number;       // 0-100
  hrvScore: number;         // 0-100
  restingHRScore: number;   // 0-100
  muscleRecovery: number;   // 0-100 (existing)
  strainBalance: number;    // 0-100
}

export function calculateReadinessScore(
  factors: RecoveryFactors,
  weights: { sleep: number; hrv: number; hr: number; muscle: number; strain: number } = {
    sleep: 0.30,
    hrv: 0.25,
    hr: 0.15,
    muscle: 0.20,
    strain: 0.10
  }
): number {
  const weightedScore =
    factors.sleepScore * weights.sleep +
    factors.hrvScore * weights.hrv +
    factors.restingHRScore * weights.hr +
    factors.muscleRecovery * weights.muscle +
    factors.strainBalance * weights.strain;

  return Math.round(weightedScore);
}

export function calculateSleepScore(sleep: SleepData): number {
  // Faktorer:
  // - Total sömntid (7-9h optimal)
  // - Djupsömn % (13-23% optimal)
  // - REM % (20-25% optimal)
  // - Sömneffektivitet (>85% bra)
  // - Uppvakningar

  const totalHours = sleep.totalMinutes / 60;
  const deepPercent = (sleep.deepMinutes / sleep.totalMinutes) * 100;
  const remPercent = (sleep.remMinutes / sleep.totalMinutes) * 100;

  let score = 100;

  // Total sömntid score (0-40 poäng)
  if (totalHours < 6) score -= 40;
  else if (totalHours < 7) score -= 25;
  else if (totalHours > 9) score -= 15;
  else if (totalHours >= 7 && totalHours <= 9) score += 0; // Optimal

  // Djupsömn score (0-30 poäng)
  if (deepPercent < 10) score -= 30;
  else if (deepPercent < 13) score -= 15;
  else if (deepPercent > 25) score -= 10;

  // REM score (0-20 poäng)
  if (remPercent < 15) score -= 20;
  else if (remPercent < 20) score -= 10;

  // Efficiency (0-10 poäng)
  if (sleep.efficiency < 75) score -= 10;
  else if (sleep.efficiency < 85) score -= 5;

  return Math.max(0, Math.min(100, score));
}

export function calculateHRVScore(
  currentHRV: number,
  baselineHRV: number,
  last7DaysHRV: number[]
): number {
  // HRV är individuellt - jämför mot personlig baseline
  const percentOfBaseline = (currentHRV / baselineHRV) * 100;

  // Trend över senaste veckan
  const weeklyAverage = last7DaysHRV.reduce((a, b) => a + b, 0) / last7DaysHRV.length;
  const trend = currentHRV > weeklyAverage ? 5 : -5;

  let score = 50; // Neutral

  if (percentOfBaseline >= 100) score = 100;
  else if (percentOfBaseline >= 90) score = 85 + trend;
  else if (percentOfBaseline >= 80) score = 70 + trend;
  else if (percentOfBaseline >= 70) score = 55 + trend;
  else score = 40 + trend;

  return Math.max(0, Math.min(100, score));
}

export function calculateStrainScore(
  workoutSessions: WorkoutSession[],
  activityCalories: number
): number {
  // Whoop-liknande strain score (0-21)
  // Baserat på hjärtfrekvens zones, men vi har bara träningsdata

  const last24Hours = workoutSessions.filter(s => {
    const sessionDate = new Date(s.date);
    const now = new Date();
    const hoursDiff = (now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 24;
  });

  let strain = 0;

  // Workout-baserad strain
  last24Hours.forEach(session => {
    const duration = session.duration || 60; // minutes
    const intensity = session.exercises.length > 8 ? 'high' : 'moderate';

    if (intensity === 'high') strain += duration * 0.15;
    else strain += duration * 0.08;
  });

  // Activity-baserad strain
  strain += (activityCalories / 500) * 2;

  return Math.min(21, Math.round(strain));
}

export function getRecoveryRecommendation(
  readinessScore: number,
  strainScore: number
): 'rest' | 'light' | 'moderate' | 'intense' {
  if (readinessScore >= 85 && strainScore < 10) return 'intense';
  if (readinessScore >= 70 && strainScore < 15) return 'moderate';
  if (readinessScore >= 50) return 'light';
  return 'rest';
}
```

---

## 🎨 UI Components

### 1. Recovery Dashboard Component:
```typescript
// components/RecoveryDashboard.tsx

interface RecoveryDashboardProps {
  biometricLog: BiometricLog;
  workoutHistory: WorkoutSession[];
  userProfile: UserProfile;
}

export const RecoveryDashboard: React.FC<RecoveryDashboardProps> = ({
  biometricLog,
  workoutHistory,
  userProfile
}) => {
  const readinessScore = biometricLog.recovery?.readinessScore || 0;
  const recommendation = biometricLog.recovery?.recommendation || 'moderate';

  return (
    <div className="space-y-6">
      {/* Main Readiness Ring */}
      <div className="flex flex-col items-center justify-center py-8">
        <ReadinessRing score={readinessScore} size={200} />
        <h2 className="text-3xl font-black mt-4">{readinessScore}%</h2>
        <p className="text-text-dim text-sm">Readiness Score</p>

        <div className="mt-4 px-4 py-2 rounded-full bg-accent-blue/20">
          <span className="text-accent-blue font-bold uppercase text-xs">
            {recommendation === 'rest' ? '🛌 Rest Day' :
             recommendation === 'light' ? '🚶 Light Activity' :
             recommendation === 'moderate' ? '💪 Moderate Training' :
             '🔥 Go Hard'}
          </span>
        </div>
      </div>

      {/* Recovery Factors Grid */}
      <div className="grid grid-cols-2 gap-4">
        <RecoveryFactorCard
          title="Sleep"
          value={biometricLog.sleep?.sleepScore || 0}
          icon="🌙"
          details={`${Math.round((biometricLog.sleep?.totalMinutes || 0) / 60)}h ${Math.round((biometricLog.sleep?.totalMinutes || 0) % 60)}min`}
        />

        <RecoveryFactorCard
          title="HRV"
          value={calculateHRVScore(
            biometricLog.hrv?.value || 0,
            userProfile.healthIntegration?.baselineHRV || 50,
            []
          )}
          icon="❤️"
          details={`${biometricLog.hrv?.value || 0}ms`}
          trend={biometricLog.hrv?.trend}
        />

        <RecoveryFactorCard
          title="Resting HR"
          value={calculateRestingHRScore(biometricLog.restingHeartRate?.value || 60)}
          icon="💓"
          details={`${biometricLog.restingHeartRate?.value || 0} bpm`}
          trend={biometricLog.restingHeartRate?.trend}
        />

        <RecoveryFactorCard
          title="Muscle Recovery"
          value={biometricLog.recovery?.muscleRecoveryScore || 0}
          icon="💪"
          details="All muscles"
        />
      </div>

      {/* Sleep Breakdown */}
      {biometricLog.sleep && (
        <SleepBreakdown sleep={biometricLog.sleep} />
      )}

      {/* Strain Score */}
      <StrainCard
        strainScore={biometricLog.recovery?.strainScore || 0}
        workouts={workoutHistory}
      />
    </div>
  );
};
```

### 2. Health Integration Settings:
```typescript
// components/HealthIntegrationSettings.tsx

export const HealthIntegrationSettings: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleConnect = async () => {
    const hasPermission = await healthService.requestPermissions();
    if (hasPermission) {
      setEnabled(true);
      await syncHealthData();
    }
  };

  const syncHealthData = async () => {
    setSyncing(true);
    try {
      const [sleep, hrv, restingHR, steps, calories] = await Promise.all([
        healthService.getLastNightSleep(),
        healthService.getHRVLast7Days(),
        healthService.getRestingHeartRate(),
        healthService.getDailySteps(new Date()),
        healthService.getActiveCalories(new Date()),
      ]);

      // Update biometric log med ny data
      await storage.addOrUpdateBiometricLog({
        date: new Date().toISOString().split('T')[0],
        sleep,
        hrv: hrv[hrv.length - 1], // Senaste
        restingHeartRate: { value: restingHR },
        activity: { steps, activeCalories: calories },
        // ... calculate recovery scores
      });

    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold">Health Data Integration</h3>
          <p className="text-sm text-text-dim">
            {Capacitor.getPlatform() === 'ios' ? 'Apple Health' : 'Google Health Connect'}
          </p>
        </div>

        {!enabled ? (
          <button onClick={handleConnect} className="btn-primary">
            Connect
          </button>
        ) : (
          <button onClick={syncHealthData} disabled={syncing} className="btn-secondary">
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        )}
      </div>

      {enabled && (
        <>
          <div className="text-sm text-text-dim">
            Last synced: {new Date().toLocaleString()}
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-sm">Data Sources</h4>
            <DataSourceList />
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-sm">Auto-sync</h4>
            <select className="w-full p-3 rounded-lg bg-white/5">
              <option value="realtime">Real-time</option>
              <option value="daily">Daily</option>
              <option value="manual">Manual only</option>
            </select>
          </div>
        </>
      )}
    </div>
  );
};
```

---

## 🔄 Background Sync Strategy

### Option 1: On-demand (enklast att börja med)
- Användaren öppnar appen → automatisk sync
- Manuell sync-knapp i inställningar
- Synkar när användare navigerar till Recovery-tab

### Option 2: Background Tasks (mer avancerat)
```typescript
// services/backgroundSync.ts
import { BackgroundTask } from '@capawesome/capacitor-background-task';

export async function setupBackgroundSync() {
  await BackgroundTask.beforeExit(async () => {
    // Synka hälsodata innan appen stängs
    await healthService.syncAll();
    BackgroundTask.finish();
  });
}

// iOS: Background App Refresh
// Android: WorkManager for periodic sync
```

---

## 📊 Database Schema Updates

### Supabase Tables (om du vill synka till cloud):
```sql
-- Utöka biometric_logs table
ALTER TABLE biometric_logs
ADD COLUMN sleep_data JSONB,
ADD COLUMN hrv_data JSONB,
ADD COLUMN resting_hr_data JSONB,
ADD COLUMN activity_data JSONB,
ADD COLUMN recovery_scores JSONB,
ADD COLUMN data_source TEXT,
ADD COLUMN synced_at TIMESTAMP;

-- Ny tabell för rådata från health APIs (optional)
CREATE TABLE health_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  sync_date TIMESTAMP DEFAULT NOW(),
  data_type TEXT, -- 'sleep', 'hrv', 'heart_rate', etc.
  raw_data JSONB,
  processed BOOLEAN DEFAULT FALSE,
  source TEXT -- 'apple_health', 'health_connect', 'oura'
);
```

### Dexie Schema Update:
```typescript
// services/db.ts
export const db = new Dexie('MorphFitDB');
db.version(3).stores({
  // ... existing tables
  biometricLogs: '++id, date, userId, syncedAt',
  healthSyncQueue: '++id, date, type, synced', // För offline queue
});
```

---

## 🎯 Implementation Roadmap

### Phase 1: Foundation (Vecka 1-2)
- [ ] Installera och konfigurera Capacitor Health plugins
- [ ] Skapa unified HealthService abstraction layer
- [ ] Implementera permissions flow (iOS + Android)
- [ ] Testa basic data fetch (sleep, HRV)
- [ ] Uppdatera BiometricLog type definition

### Phase 2: Data Collection (Vecka 3-4)
- [ ] Implementera all data fetching (sleep, HRV, resting HR, steps, calories)
- [ ] Skapa data processing och normalisering
- [ ] Implementera baseline calculation (första 2 veckor)
- [ ] Lägg till data storage (Dexie + Supabase)
- [ ] Skapa manual sync UI

### Phase 3: Recovery Scoring (Vecka 5-6)
- [ ] Implementera sleep score algorithm
- [ ] Implementera HRV score algorithm
- [ ] Implementera strain score calculation
- [ ] Skapa overall readiness score
- [ ] Generera recovery recommendations

### Phase 4: UI & UX (Vecka 7-8)
- [ ] Skapa RecoveryDashboard component
- [ ] Skapa ReadinessRing visualization
- [ ] Skapa SleepBreakdown chart
- [ ] Skapa HRV trend graph
- [ ] Skapa StrainScore display
- [ ] Lägg till recovery insights/tips

### Phase 5: Advanced Features (Vecka 9-12)
- [ ] Background sync (iOS Background App Refresh)
- [ ] Auto-adjust workouts baserat på recovery
- [ ] Push notifications för dålig recovery
- [ ] Historical trends och insights
- [ ] AI-driven recommendations (Gemini integration)
- [ ] Export/share recovery reports

---

## 🚨 Viktiga Överväganden

### Privacy & GDPR:
- ✅ All hälsodata lagras lokalt först (Dexie)
- ✅ Användaren väljer om data ska synkas till Supabase
- ✅ Transparent om vilken data som samlas in
- ✅ Enkel export/radera all data
- ⚠️ Se till att hantera känslig data enligt GDPR

### Battery Impact:
- ⚠️ Frequent health queries kan dra batteri
- ✅ Batcha requests (hämta all data samtidigt)
- ✅ Cacha data lokalt (uppdatera bara när nödvändigt)
- ✅ Låt användaren välja sync-frekvens

### Oura Ring Specifikt:
Om du vill ha DIREKT Oura-integration:
```typescript
// Oura Cloud API (kräver OAuth)
const OURA_BASE_URL = 'https://api.ouraring.com/v2/usercollection';

async function fetchOuraSleep(accessToken: string, date: string) {
  const response = await fetch(`${OURA_BASE_URL}/sleep?start_date=${date}&end_date=${date}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  return await response.json();
}
```

**Men:** Oura synkar automatiskt till Apple Health/Health Connect, så genom att läsa därifrån får du Oura-data UTAN att behöva Oura API! 🎉

---

## 💰 Cost Analysis

### Native Health API (REKOMMENDERAD):
- **Kostnad:** $0 (gratis)
- **Utvecklingstid:** 2-3 veckor
- **Underhåll:** Lågt

### Oura Cloud API:
- **Kostnad:** TBD (API i beta, kan bli betalat)
- **Utvecklingstid:** 1 vecka
- **Underhåll:** Medel (OAuth-refresh, API changes)

### Google Fit REST API:
- **Kostnad:** $0 (gratis)
- **Utvecklingstid:** 1 vecka
- **Underhåll:** Medel

---

## 🎓 Resources & Documentation

### Capacitor Plugins:
- **iOS HealthKit:** https://github.com/perfood/capacitor-healthkit
- **Android Health Connect:** https://github.com/capacitor-community/health
- **Background Tasks:** https://github.com/capawesome-team/capacitor-background-task

### APIs:
- **Apple HealthKit:** https://developer.apple.com/documentation/healthkit
- **Health Connect:** https://developer.android.com/health-and-fitness/guides/health-connect
- **Oura API:** https://cloud.ouraring.com/docs
- **Google Fit:** https://developers.google.com/fit

### Inspiration:
- **Whoop Recovery Scoring:** https://www.whoop.com/thelocker/recovery-score/
- **Athlytic App:** iOS-only app för Apple Watch recovery
- **HRV4Training:** App focused on HRV tracking

---

## 🎯 Next Steps

1. **Beslut:** Native API (rekommenderat) eller Cloud API?
2. **Prototype:** Börja med iOS HealthKit basic data fetch
3. **Test:** Verifiera att du kan läsa sleep + HRV
4. **Iterate:** Bygg ut UI och scoring algorithm
5. **Polish:** Lägg till advanced features

Vill du att jag implementerar någon specifik del av detta? T.ex:
- Basic HealthService setup
- Recovery scoring algorithm
- RecoveryDashboard UI component
- Integration settings screen

Säg till så skapar jag koden! 🚀
