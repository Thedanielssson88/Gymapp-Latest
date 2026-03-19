# 🎨 UX & Navigation Plan - Health Integration

## 📱 Nuvarande App-struktur

### Main Tabs (Bottom Navigation):
1. **Träning** (Dumbbell) - WorkoutView
2. **Kropp** (User2) - StatsView med sub-tabs ⭐
3. **AI PT** (Sparkles) - AIProgramDashboard
4. **Mål** (Trophy) - TargetsView
5. **Övningar** (BookOpen) - ExerciseLibrary
6. **Logg** (Calendar) - WorkoutLog

### Kropp Sub-tabs (nuvarande):
- **Återhämtning** - RecoveryMap (muskelåterhämtning)
- **Mått** - MeasurementsView (kroppsmått, vikt)
- **Statistik** - StatsView analytics (grafer, volym, 1RM)
- **Inställningar** (Settings icon)

---

## 🎯 REKOMMENDERAD LÖSNING: Utöka "Kropp"-tabben

### Option A: Lägg till ny sub-tab "Hälsa" (REKOMMENDERAD)

#### Ny struktur för Kropp-tabben:
```
Kropp (Main Tab)
├── Återhämtning (muskelåterhämtning - befintlig)
├── Hälsa (NY! - sleep, HRV, readiness) ⭐⭐⭐
├── Mått (kroppsmått, vikt)
├── Statistik (träningsstatistik)
└── Inställningar
```

**Fördelar:**
- ✅ Logisk placering (allt om kroppen på ett ställe)
- ✅ Inte för många tabs (5 sub-tabs är OK)
- ✅ Tydlig separation: "Återhämtning" = muskler, "Hälsa" = systemisk recovery
- ✅ Enkelt att implementera (lägg bara till en sub-tab)

**Nackdelar:**
- ⚠️ Kan bli trångt med 5 sub-tabs (men går att lösa med scrollbar)

---

### Option B: Slå ihop "Återhämtning" och ny health data

#### Modifierad struktur:
```
Kropp (Main Tab)
├── Recovery (kombinerad muskel + systemisk) ⭐
│   ├── Readiness Score (hero section)
│   ├── Sleep/HRV/HR cards
│   └── Muscle Recovery Map (befintlig)
├── Mått
├── Statistik
└── Inställningar
```

**Fördelar:**
- ✅ Holistisk recovery-vy (allt på ett ställe)
- ✅ Färre sub-tabs
- ✅ Whoop/Athlytic-liknande experience

**Nackdelar:**
- ⚠️ Mycket innehåll på en sida (risk för scroll-fatigue)
- ⚠️ Blandar två olika datakällor (workout vs health API)

---

## 🏆 MIN REKOMMENDATION: Option A med förbättrad UX

### Ny Navigation Structure:

```typescript
// App.tsx - Updated bodySubTab type
const [bodySubTab, setBodySubTab] = useState<
  'recovery' | 'health' | 'measurements' | 'analytics' | 'settings'
>('recovery');
```

### Visual Layout:

```
┌─────────────────────────────────────┐
│  KROPP                        [≡]   │ ← Header
├─────────────────────────────────────┤
│ [Återhämtning] [Hälsa] [Mått] [...] │ ← Sub-tab navigation (horizontal scroll)
├─────────────────────────────────────┤
│                                     │
│  [Content based on selected tab]   │
│                                     │
│                                     │
└─────────────────────────────────────┘
│ [Träning] [Kropp] [AI] [Mål] [Log] │ ← Bottom nav
└─────────────────────────────────────┘
```

---

## 📋 Detaljerad Layout för varje Sub-tab

### 1. "Återhämtning" (befintlig - ingen förändring)
**Innehåll:**
- Muscle Recovery Map (färgkodad kroppskarta)
- Per-muskel detaljvy
- Workload history

**Status:** Behåll som den är! ✅

---

### 2. "Hälsa" (NY TAB - Health Integration)

#### Layout (Mobile-first):

```
┌──────────────────────────────────┐
│  HÄLSA                     [🔄]  │ ← Sync button top-right
├──────────────────────────────────┤
│                                  │
│    ┌────────────────────┐        │
│    │                    │        │ ← Hero: Readiness Ring
│    │       85%          │        │   Large, prominent
│    │    ────────        │        │
│    │   READINESS        │        │
│    │                    │        │
│    └────────────────────┘        │
│                                  │
│  🔥 GO HARD - Din kropp är redo │ ← Recommendation badge
│                                  │
├──────────────────────────────────┤
│  RECOVERY FACTORS                │ ← Section header
├──────────────────────────────────┤
│  ┌────────────┐ ┌──────────────┐│
│  │  🌙 Sleep  │ │  ❤️ HRV      ││ ← 2x2 grid of cards
│  │    92%     │ │    78%       ││
│  │  7h 32min  │ │   65ms ↗️    ││
│  └────────────┘ └──────────────┘│
│  ┌────────────┐ ┌──────────────┐│
│  │ 💓 Rest HR │ │ 💪 Muscle    ││
│  │    88%     │ │    65%       ││
│  │   58 bpm   │ │  Mostly OK   ││
│  └────────────┘ └──────────────┘│
├──────────────────────────────────┤
│  LAST NIGHT'S SLEEP              │ ← Expandable section
├──────────────────────────────────┤
│  ▓▓▓░░░▓▓▓▓░░▓▓▓▓▓              │ ← Sleep stages bar
│  Deep  Light  REM  Awake         │
│  2h 15m  4h 10m  1h 7m  12min   │
│                                  │
│  [View Details →]                │ ← Expands to modal
├──────────────────────────────────┤
│  STRAIN SCORE                    │
├──────────────────────────────────┤
│  ████████░░░░░░░░░░░░  12.4/21   │ ← Strain bar (Whoop-style)
│                                  │
│  Today: 2 workouts, 45min total │
│  Active calories: 650 kcal       │
├──────────────────────────────────┤
│  HRV TREND (7 DAYS)              │ ← Line chart
├──────────────────────────────────┤
│       •                          │
│     •   •     •                  │
│   •       • •   •                │
│  Mon Tue Wed Thu Fri Sat Sun     │
├──────────────────────────────────┤
│  [Connect Health Data] / [Sync] │ ← If not connected yet
└──────────────────────────────────┘
```

#### Interactions:
1. **Tap Readiness Ring** → Visar detaljerad breakdown modal
2. **Tap Recovery Factor Card** → Expanderad vy med trend och detaljer
3. **Tap Sleep Section** → Full sleep analysis modal
4. **Pull to Refresh** → Synkar ny data från Health API
5. **Sync Button (🔄)** → Manuell sync + visar senaste sync-tid

---

### 3. "Mått" (befintlig - eventuell enhancement)

**Nuvarande innehåll:**
- Kroppsvikt
- Kroppsmått (midja, bröst, armar, etc.)

**Möjlig enhancement:**
- Lägg till automatisk viktsynkning från Health API
- Visa vikttrend tillsammans med body composition (om tillgängligt från smart scales)
- Korrelera vikt med sleep/recovery metrics

---

### 4. "Statistik" (befintlig - ingen stor förändring)

**Nuvarande innehåll:**
- Volume trends
- 1RM progression
- Workout frequency

**Behåll som den är!** ✅

---

### 5. "Inställningar" (befintlig - lägg till Health Integration)

**Ny sektion: Health Data**

```
┌──────────────────────────────────┐
│  INSTÄLLNINGAR                   │
├──────────────────────────────────┤
│  ... (existing settings) ...     │
├──────────────────────────────────┤
│  HEALTH DATA INTEGRATION         │ ← New section
├──────────────────────────────────┤
│  ┌────────────────────────────┐  │
│  │ 🍎 Apple Health            │  │
│  │ Connected ✓                │  │
│  │ Last sync: 2 min ago       │  │
│  │ [Disconnect] [Sync Now]    │  │
│  └────────────────────────────┘  │
│                                  │
│  Auto-sync                       │
│  [Toggle: ON] ─────────────○    │
│                                  │
│  Sync frequency                  │
│  [ Daily ▼ ]                     │
│                                  │
│  Notify on poor recovery         │
│  [Toggle: ON] ─────────────○    │
│                                  │
│  Auto-adjust workouts            │
│  [Toggle: OFF] ────────────○    │
│                                  │
│  [View Permissions]              │
│  [Recalculate Baselines]         │
└──────────────────────────────────┘
```

---

## 🎨 Visual Design Recommendations

### Color Coding (konsekvent med Whoop/Athlytic):

```typescript
// colors.ts
export const RECOVERY_COLORS = {
  excellent: '#22c55e', // Green (85-100%)
  good: '#84cc16',      // Light green (70-84%)
  fair: '#eab308',      // Yellow (50-69%)
  poor: '#f97316',      // Orange (30-49%)
  critical: '#ef4444'   // Red (0-29%)
};

export const STRAIN_COLORS = {
  light: '#3b82f6',     // Blue (0-7)
  moderate: '#a855f7',  // Purple (8-14)
  high: '#f97316',      // Orange (15-18)
  extreme: '#ef4444'    // Red (19-21)
};
```

### Readiness Ring Component:
```typescript
// Cirkeldiagram med gradient baserat på score
// Animerad när data uppdateras
// Pulserar lätt för att dra uppmärksamhet
```

### Micro-interactions:
- ✅ Readiness ring "fyller på" med animation när sidan laddar
- ✅ Factor cards "flip in" en efter en (staggered animation)
- ✅ Haptic feedback när användaren trycker på cards
- ✅ Smooth transitions mellan sub-tabs
- ✅ Pull-to-refresh with custom spinner (ring that fills)

---

## 📱 First-time User Experience (Onboarding)

### När användaren först öppnar "Hälsa"-tabben:

```
┌──────────────────────────────────┐
│                                  │
│         🏥                       │
│                                  │
│    Connect Your Health Data      │
│                                  │
│  Get personalized recovery       │
│  insights by connecting your     │
│  health data from Apple Health   │
│  or Google Health Connect.       │
│                                  │
│  We'll track:                    │
│  • Sleep quality & stages        │
│  • Heart Rate Variability (HRV) │
│  • Resting Heart Rate            │
│  • Daily activity                │
│                                  │
│  [Connect Apple Health]          │
│  [Connect Health Connect]        │
│                                  │
│  [Skip for now]                  │
│                                  │
└──────────────────────────────────┘
```

Efter connection:
```
┌──────────────────────────────────┐
│         ⏳                       │
│                                  │
│    Building Your Baseline        │
│                                  │
│  We're collecting your health    │
│  data from the last 14 days to   │
│  establish your personal         │
│  baseline.                       │
│                                  │
│  [████████░░░░░░░░] 60%          │
│                                  │
│  This helps us give you          │
│  accurate, personalized          │
│  recovery scores.                │
│                                  │
└──────────────────────────────────┘
```

Efter baseline etablerad:
```
┌──────────────────────────────────┐
│         ✅                       │
│                                  │
│    Baseline Established!         │
│                                  │
│  Your personal health baseline:  │
│                                  │
│  Average HRV: 65ms               │
│  Average Resting HR: 58 bpm      │
│  Average Sleep: 7h 15min         │
│                                  │
│  We'll now compare your daily    │
│  metrics to these baselines.     │
│                                  │
│  [View My Recovery Dashboard]    │
│                                  │
└──────────────────────────────────┘
```

---

## 🔄 Data Flow & Sync Strategy

### When User Opens "Hälsa" Tab:

```typescript
// Pseudo-code flow
onHealthTabOpen = async () => {
  // 1. Check if health integration enabled
  if (!user.healthIntegration?.enabled) {
    showOnboardingPrompt();
    return;
  }

  // 2. Check last sync time
  const lastSync = user.healthIntegration.lastSync;
  const now = Date.now();
  const timeSinceSync = now - new Date(lastSync).getTime();

  // 3. Auto-sync if > 15 minutes
  if (timeSinceSync > 15 * 60 * 1000) {
    await syncHealthData();
  }

  // 4. Load today's biometric log (with health data)
  const todayLog = await storage.getTodayBiometricLog();

  // 5. If no data for today, prompt sync
  if (!todayLog?.sleep || !todayLog?.hrv) {
    showSyncPrompt();
  }

  // 6. Render dashboard with available data
  renderHealthDashboard(todayLog);
};
```

### Sync Indicator States:

```
┌────────────────┐
│ 🔄 Syncing...  │ ← Animated spinner
└────────────────┘

┌────────────────┐
│ ✓ Synced       │ ← Success (2 seconds, then fade)
└────────────────┘

┌────────────────┐
│ ⚠️ Sync Failed │ ← Error with retry button
│ [Retry]        │
└────────────────┘
```

---

## 🎯 Priority Implementation Order

### Phase 1: Basic Layout (Week 1)
1. ✅ Lägg till "Hälsa" sub-tab i Kropp-tabben
2. ✅ Skapa basic layout med placeholder data
3. ✅ Readiness Ring component (static)
4. ✅ 4x Factor cards layout (static)
5. ✅ Onboarding prompt screen

### Phase 2: Data Integration (Week 2)
1. ✅ Implement HealthService (iOS + Android)
2. ✅ Request permissions flow
3. ✅ Fetch basic data (sleep, HRV)
4. ✅ Display real data in cards
5. ✅ Sync button functionality

### Phase 3: Scoring & Calculations (Week 3)
1. ✅ Implement recovery scoring algorithms
2. ✅ Calculate baselines
3. ✅ Display dynamic Readiness Ring
4. ✅ Show recommendations based on score
5. ✅ Add trend indicators (↗️ ↘️)

### Phase 4: Polish & Details (Week 4)
1. ✅ Sleep breakdown visualization
2. ✅ HRV trend chart
3. ✅ Strain score display
4. ✅ Detailed modals (tap on cards)
5. ✅ Animations & micro-interactions
6. ✅ Pull-to-refresh

---

## 🚀 Alternative: Quick Win - Start Simple

### Minimalist Version 1.0 (Week 1 only):

**Simplest possible implementation:**
```
Kropp → Hälsa (NY TAB)
├── "Connect Health Data" button (if not connected)
└── Simple stats when connected:
    ├── Last night's sleep: 7h 32min
    ├── Sleep quality: Good (85%)
    ├── HRV: 65ms (Normal)
    └── Resting HR: 58 bpm
```

**No fancy algorithms, no readiness score, just RAW DATA.**

Then iterate from there! 📈

---

## 💡 Bonus Ideas for Later

### Integration with Existing Features:

1. **"Träning"-tab enhancement:**
   - Show today's readiness score at the top
   - "⚠️ Low recovery - consider light workout" warning
   - Suggest deload based on strain history

2. **"AI PT"-tab enhancement:**
   - Use readiness score in program generation
   - "Based on your recovery, I recommend..."
   - Auto-adjust intensity based on HRV

3. **"Mål"-tab enhancement:**
   - Track correlation between recovery and goal progress
   - "Your best PRs happen when recovery > 85%"

4. **Smart Notifications:**
   - "🌟 Great recovery today (92%) - time to go hard!"
   - "😴 Poor sleep detected - take it easy today"
   - "📈 HRV trending up - you're adapting well!"

---

## 📊 Example: Complete "Hälsa" Tab Code Structure

```typescript
// components/HealthDashboard.tsx

interface HealthDashboardProps {
  biometricLog: BiometricLog | null;
  userProfile: UserProfile;
  onSync: () => Promise<void>;
  onConnect: () => Promise<void>;
}

export const HealthDashboard: React.FC<HealthDashboardProps> = ({
  biometricLog,
  userProfile,
  onSync,
  onConnect
}) => {
  const [syncing, setSyncing] = useState(false);

  // Check if health integration enabled
  const isConnected = userProfile.healthIntegration?.enabled;

  // If not connected, show onboarding
  if (!isConnected) {
    return <HealthOnboarding onConnect={onConnect} />;
  }

  // If connected but no data, show sync prompt
  if (!biometricLog?.sleep && !biometricLog?.hrv) {
    return <SyncPrompt onSync={onSync} />;
  }

  // Calculate readiness score
  const readinessScore = biometricLog?.recovery?.readinessScore || 0;
  const recommendation = biometricLog?.recovery?.recommendation || 'moderate';

  return (
    <div className="space-y-6 pb-32">
      {/* Hero: Readiness Ring */}
      <div className="flex flex-col items-center py-8">
        <ReadinessRing score={readinessScore} size={200} />
        <h2 className="text-4xl font-black mt-4">{readinessScore}%</h2>
        <p className="text-text-dim text-sm">Readiness Score</p>
        <RecommendationBadge recommendation={recommendation} />
      </div>

      {/* Recovery Factors Grid */}
      <div className="px-4">
        <h3 className="text-xs font-black uppercase text-text-dim mb-4">Recovery Factors</h3>
        <div className="grid grid-cols-2 gap-4">
          <FactorCard
            title="Sleep"
            value={biometricLog?.sleep?.sleepScore || 0}
            icon="🌙"
            subtitle={formatSleepDuration(biometricLog?.sleep)}
          />
          <FactorCard
            title="HRV"
            value={calculateHRVScore(biometricLog?.hrv)}
            icon="❤️"
            subtitle={`${biometricLog?.hrv?.value || 0}ms`}
            trend={biometricLog?.hrv?.trend}
          />
          <FactorCard
            title="Resting HR"
            value={calculateHRScore(biometricLog?.restingHeartRate)}
            icon="💓"
            subtitle={`${biometricLog?.restingHeartRate?.value || 0} bpm`}
          />
          <FactorCard
            title="Muscles"
            value={biometricLog?.recovery?.muscleRecoveryScore || 0}
            icon="💪"
            subtitle="Overall"
          />
        </div>
      </div>

      {/* Sleep Breakdown */}
      {biometricLog?.sleep && (
        <SleepBreakdown sleep={biometricLog.sleep} />
      )}

      {/* Strain Score */}
      <StrainCard strainScore={biometricLog?.recovery?.strainScore || 0} />

      {/* HRV Trend */}
      <HRVTrendChart />

      {/* Sync Button (sticky at bottom) */}
      <button
        onClick={async () => {
          setSyncing(true);
          await onSync();
          setSyncing(false);
        }}
        disabled={syncing}
        className="fixed bottom-24 right-4 bg-accent-blue text-white p-4 rounded-full shadow-lg"
      >
        {syncing ? '🔄' : '↻'}
      </button>
    </div>
  );
};
```

---

## ✅ FINAL RECOMMENDATION

**Implementera Option A:**
1. Lägg till "Hälsa" som ny sub-tab under Kropp
2. Börja med minimalist version (bara visa raw data)
3. Iterera och lägg till readiness scoring
4. Successivt förbättra UX med animations och details

**Navigation blir:**
```
Kropp
├── Återhämtning (muskler)
├── Hälsa (systemisk recovery) ← NY! ⭐
├── Mått (kroppsmått)
├── Statistik (träningsstatistik)
└── Inställningar
```

**Varför detta är bäst:**
- ✅ Logisk organisation
- ✅ Tydlig separation mellan olika typer av recovery-data
- ✅ Enkelt att implementera stegvis
- ✅ Skapar inte röra i befintliga features
- ✅ Rum för framtida expansion

Vill du att jag börjar implementera? Jag kan skapa:
1. **Updated App.tsx** med ny sub-tab
2. **HealthDashboard.tsx** component (minimalist version först)
3. **HealthOnboarding.tsx** component (connection flow)
4. **ReadinessRing.tsx** component (visual)

Säg till! 🚀
