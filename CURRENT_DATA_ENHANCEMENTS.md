# 💪 Vad kan du lägga till i "Kropp" med befintlig data?

## 📊 Din Nuvarande Data (utan health API):

### ✅ Du har redan:
1. **BiometricLog[]** - Vikt och kroppsmått över tid
2. **WorkoutSession[]** - Träningshistorik (datum, övningar, sets, RPE, feeling, duration)
3. **UserProfile** - Nuvarande vikt, längd, kön, skador, mål
4. **Exercise[]** - Alla övningar med muskelgrupper
5. **Muscle Recovery** - Beräknad muskelåterhämtning baserat på träning

### Nuvarande "Kropp"-tabs:
```
├── Återhämtning (muskel recovery map) ✅
├── Mått (kroppsmått, vikt) ✅
├── Statistik (volym, 1RM, frekvens) ✅
└── Inställningar ✅
```

---

## 🎯 VAD DU KAN LÄGGA TILL DIREKT (utan health API)

### 1. **Training Load & Fatigue Score** ⭐⭐⭐

**Vad:** Beräknad träningsbelastning och trötthet baserat på workout history

**Data du har:**
- WorkoutSession.duration (minuter)
- WorkoutSession.rpe (1-10 hur hårt det kändes)
- Sets per övning (volym)
- Frequency (hur ofta du tränar)

**Beräkning:**
```typescript
// Training Load Score (Whoop-liknande, fast utan puls)
interface TrainingLoad {
  daily: number;        // 0-21 (baserat på volym + RPE)
  weekly: number;       // Summa senaste 7 dagarna
  acute: number;        // Snitt senaste 7 dagarna
  chronic: number;      // Snitt senaste 28 dagarna
  acuteChronicRatio: number; // Acute/Chronic (ska vara 0.8-1.3)
}

function calculateDailyLoad(session: WorkoutSession): number {
  const durationFactor = (session.duration || 60) / 60; // Normalisera till timmar
  const rpeFactor = (session.rpe || 5) / 10; // 0-1
  const volumeFactor = session.exercises.reduce((sum, ex) => {
    return sum + ex.sets.filter(s => s.completed).length;
  }, 0) / 20; // Normalisera (20 sets = 1.0)

  // Kombinerad score (0-21)
  return Math.min(21, (durationFactor + rpeFactor + volumeFactor) * 7);
}

function calculateAcuteChronic(history: WorkoutSession[]): number {
  const last7Days = getLastNDays(history, 7);
  const last28Days = getLastNDays(history, 28);

  const acute = average(last7Days.map(calculateDailyLoad));
  const chronic = average(last28Days.map(calculateDailyLoad));

  return acute / chronic; // Optimal: 0.8-1.3
}
```

**UI:**
```
┌────────────────────────────────┐
│  TRAINING LOAD                 │
├────────────────────────────────┤
│  ████████████░░░░░░  14.2/21   │ ← Load bar
│                                │
│  Status: Moderate Load         │
│                                │
│  Weekly: 84.3                  │
│  Acute/Chronic: 1.12 ✓         │ ← Optimal range
│                                │
│  💡 Din träningsbelastning är  │
│     balanserad. Du kan öka     │
│     intensiteten något.        │
└────────────────────────────────┘
```

**Var:** Ny sektion i "Återhämtning" TAB (under muscle recovery map)

---

### 2. **Workout Recovery Index** ⭐⭐⭐

**Vad:** Kombination av muskelåterhämtning + träningsbelastning = övergripande recovery score

**Data du har:**
- Muscle recovery scores (du har redan!)
- Training load (från #1)
- Days since last workout

**Beräkning:**
```typescript
interface RecoveryIndex {
  score: number;              // 0-100
  muscleScore: number;        // Från befintlig muscle recovery
  loadScore: number;          // Från training load (inverterad)
  timeScore: number;          // Dagar sedan senaste träning
  recommendation: 'rest' | 'light' | 'moderate' | 'intense';
}

function calculateRecoveryIndex(
  muscleRecovery: number,    // 0-100 (0 = helt återhämtad)
  acuteChronic: number,      // 0.8-1.3 optimal
  daysSinceWorkout: number
): RecoveryIndex {
  // Muscle score: inverterad (100 = helt återhämtad)
  const muscleScore = 100 - muscleRecovery;

  // Load score: optimal vid 0.8-1.3 AC ratio
  let loadScore = 100;
  if (acuteChronic > 1.5) loadScore = 50; // Övertränad
  else if (acuteChronic < 0.8) loadScore = 85; // Undertränad
  else loadScore = 100;

  // Time score: fler dagar = bättre recovery
  const timeScore = Math.min(100, daysSinceWorkout * 25);

  // Weighted average
  const score = Math.round(
    muscleScore * 0.50 +
    loadScore * 0.30 +
    timeScore * 0.20
  );

  return {
    score,
    muscleScore,
    loadScore,
    timeScore,
    recommendation: getRecommendation(score)
  };
}

function getRecommendation(score: number): string {
  if (score >= 85) return 'intense';
  if (score >= 70) return 'moderate';
  if (score >= 50) return 'light';
  return 'rest';
}
```

**UI (Hero-section i "Återhämtning"):**
```
┌────────────────────────────────┐
│                                │
│        ╭─────────╮             │
│       │    78    │             │ ← Large ring
│       │   ─────  │             │   (animated)
│       │ RECOVERY │             │
│        ╰─────────╯             │
│                                │
│   💪 MODERATE TRAINING         │ ← Recommendation
│                                │
├────────────────────────────────┤
│  BREAKDOWN                     │
├────────────────────────────────┤
│  Muscle Recovery     65%  ⚠️  │
│  Training Load       90%  ✓   │
│  Rest Days           85%  ✓   │
└────────────────────────────────┘
```

---

### 3. **Body Composition Tracking** ⭐⭐

**Vad:** Visuell trend av kroppsvikt + mått över tid

**Data du har:**
- BiometricLog.weight
- BiometricLog.measurements (alla kroppsmått)

**UI förbättring för "Mått"-tab:**

#### A. Weight Trend med Kontext:
```
┌────────────────────────────────┐
│  VIKT                          │
├────────────────────────────────┤
│              •                 │
│            •   •               │ ← Line chart
│          •       •   •         │   med trend
│        •             •         │
│  Jan  Feb  Mar  Apr  May       │
│                                │
│  Nuvarande: 82.5 kg            │
│  Start: 85.0 kg (-2.5 kg) ✓   │
│  Mål: 80.0 kg (2.5 kg kvar)    │
│                                │
│  Trend: -0.3 kg/vecka          │
│  ETA till mål: ~8 veckor       │
└────────────────────────────────┘
```

#### B. Multi-Measurement Comparison:
```
┌────────────────────────────────┐
│  KROPPSMÅTT UTVECKLING         │
├────────────────────────────────┤
│  Midja                         │
│  ██████░░░░░░ 85cm → 82cm ✓   │
│  -3cm sedan start              │
│                                │
│  Bröst                         │
│  ████████████ 105cm → 108cm ✓ │
│  +3cm sedan start              │
│                                │
│  Biceps (V)                    │
│  ██████████░░ 38cm → 40cm ✓   │
│  +2cm sedan start              │
└────────────────────────────────┘
```

#### C. Body Composition Estimate (utan scale):
```typescript
// Navy Method (för män)
function estimateBodyFat(
  waist: number,   // cm
  neck: number,    // cm
  height: number   // cm
): number {
  return 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450;
}

// Visa estimate i mått-tabben
```

**UI:**
```
┌────────────────────────────────┐
│  BODY COMPOSITION ESTIMATE     │
├────────────────────────────────┤
│  Kroppsfett: ~15.2%            │
│  (Uppskattat från midja/nacke) │
│                                │
│  Trend: -1.5% sedan start ✓    │
│                                │
│  💡 Detta är en uppskattning.  │
│     Mät med kroppsfettsvåg för │
│     exakt värde.               │
└────────────────────────────────┘
```

---

### 4. **Workout Feeling Trends** ⭐⭐

**Vad:** Analys av hur du KÄNNER dig över tid

**Data du har:**
- WorkoutSession.rpe (1-10)
- WorkoutSession.feeling (fritext)
- WorkoutSession.date

**Beräkning:**
```typescript
interface FeelingTrend {
  averageRPE: number;
  trend: 'improving' | 'declining' | 'stable';
  commonWords: string[];     // Från feeling-text
  consistencyScore: number;  // Hur konsekvent känner du dig
}

function analyzeFeelingTrends(history: WorkoutSession[]): FeelingTrend {
  const last30Days = getLastNDays(history, 30);

  // RPE trend
  const first15 = last30Days.slice(0, 15);
  const last15 = last30Days.slice(-15);
  const avgFirst = average(first15.map(s => s.rpe || 5));
  const avgLast = average(last15.map(s => s.rpe || 5));

  const trend =
    avgLast < avgFirst - 1 ? 'improving' :
    avgLast > avgFirst + 1 ? 'declining' :
    'stable';

  // Text analysis (simple)
  const words = last30Days
    .map(s => s.feeling?.toLowerCase().split(' '))
    .flat()
    .filter(w => ['bra', 'trött', 'stark', 'svag', 'energisk', 'utmattad'].includes(w || ''));

  const commonWords = getMostCommon(words, 3);

  return { averageRPE: avgLast, trend, commonWords, consistencyScore: calculateConsistency(last30Days) };
}
```

**UI (i "Statistik"-tab eller ny sub-section):**
```
┌────────────────────────────────┐
│  HUR KÄNNER DU DIG?            │
├────────────────────────────────┤
│  Snitt RPE (30 dagar): 6.2     │
│  Trend: ↗️ Förbättras          │
│                                │
│  Vanligaste ord:               │
│  • "bra" (12 pass)             │
│  • "stark" (8 pass)            │
│  • "trött" (5 pass)            │
│                                │
│  Konsistens: 82% ✓             │
│  (Du känner dig stabilt)       │
└────────────────────────────────┘
```

---

### 5. **Training Frequency & Patterns** ⭐⭐

**Vad:** Analys av dina träningsmönster

**Data du har:**
- WorkoutSession.date
- WorkoutSession.duration
- Day of week

**Beräkning:**
```typescript
interface TrainingPattern {
  weeklyFrequency: number;
  averageSessionDuration: number;
  restDayPattern: number[];  // Dagar mellan träningar
  mostActiveDay: string;
  consistency: number;       // 0-100
}

function analyzeTrainingPattern(history: WorkoutSession[]): TrainingPattern {
  const last90Days = getLastNDays(history, 90);

  // Frequency
  const weeksInPeriod = 90 / 7;
  const weeklyFrequency = last90Days.length / weeksInPeriod;

  // Duration
  const avgDuration = average(last90Days.map(s => s.duration || 60));

  // Rest days
  const sortedDates = last90Days.map(s => new Date(s.date)).sort();
  const restDays = sortedDates.slice(1).map((date, i) => {
    const diff = date.getTime() - sortedDates[i].getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  });

  // Most active day
  const dayCount: Record<string, number> = {};
  last90Days.forEach(s => {
    const day = new Date(s.date).toLocaleDateString('sv-SE', { weekday: 'long' });
    dayCount[day] = (dayCount[day] || 0) + 1;
  });
  const mostActiveDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0][0];

  // Consistency (standard deviation of rest days)
  const consistency = 100 - Math.min(100, standardDeviation(restDays) * 10);

  return {
    weeklyFrequency,
    averageSessionDuration: avgDuration,
    restDayPattern: restDays,
    mostActiveDay,
    consistency
  };
}
```

**UI:**
```
┌────────────────────────────────┐
│  TRÄNINGSMÖNSTER               │
├────────────────────────────────┤
│  Frekvens: 4.2 pass/vecka ✓   │
│  Snitt-längd: 68 min           │
│                                │
│  Mest aktiv dag: Måndag        │
│  Genomsnittlig vila: 1.8 dagar │
│                                │
│  Konsistens: 87% ✓             │
│  (Du tränar regelbundet!)      │
│                                │
│  ┌─┬─┬─┬─┬─┬─┬─┐              │
│  │█│ │█│ │█│█│ │ Mån-Sön      │ ← Week heatmap
│  └─┴─┴─┴─┴─┴─┴─┘              │
└────────────────────────────────┘
```

---

### 6. **Volume Load per Muscle Group** ⭐⭐

**Vad:** Hur mycket volym tränar du per muskelgrupp över tid?

**Data du har:**
- WorkoutSession.exercises
- Exercise.primaryMuscles
- Sets per övning (reps * weight)

**UI (förbättring av befintlig radar chart i Statistik):**
```
┌────────────────────────────────┐
│  VOLYM PER MUSKELGRUPP         │
├────────────────────────────────┤
│  Senaste 30 dagarna:           │
│                                │
│  Bröst     ████████░░ 14,500kg │
│  Rygg      ██████████ 18,200kg │
│  Ben       ███████░░░ 12,800kg │
│  Axlar     █████░░░░░ 9,400kg  │
│  Armar     ████░░░░░░ 7,200kg  │
│                                │
│  ⚠️ Obalans upptäckt:          │
│     Ben har 30% mindre volym   │
│     än överkropp. Överväg att  │
│     lägga till ett benpass.    │
└────────────────────────────────┘
```

---

### 7. **Estimated Calories Burned** ⭐

**Vad:** Uppskattade kalorier från träning (utan puls)

**Data du har:**
- WorkoutSession.duration
- Sets * reps * weight (arbete utfört)
- UserProfile.weight
- UserProfile.biologicalSex

**Beräkning:**
```typescript
function estimateCaloriesBurned(
  session: WorkoutSession,
  userWeight: number,
  sex: 'Man' | 'Kvinna'
): number {
  // MET values for resistance training: 3-6 depending on intensity
  const duration = session.duration || 60; // minutes

  // Estimate intensity from RPE
  const rpe = session.rpe || 5;
  const met = 3 + (rpe / 10) * 3; // 3-6 MET range

  // Formula: Calories = MET * weight(kg) * duration(hours)
  const calories = met * userWeight * (duration / 60);

  // Adjust for sex (women burn ~10% less on average)
  return sex === 'Kvinna' ? calories * 0.9 : calories;
}
```

**UI (i passets detaljer eller summering):**
```
┌────────────────────────────────┐
│  PASS SUMMERING                │
├────────────────────────────────┤
│  Datum: 2026-03-19             │
│  Duration: 75 min              │
│  RPE: 7/10                     │
│                                │
│  🔥 Uppskattade kalorier:      │
│     ~425 kcal                  │
│                                │
│  (Baserat på din vikt, kön     │
│   och RPE)                     │
└────────────────────────────────┘
```

---

## 🎨 REKOMMENDERAD UI-FÖRÄNDRING (med befintlig data)

### Option A: Lägg till "Load & Recovery" i Återhämtning-tab

```
Kropp → Återhämtning
├── Recovery Index (NY! Hero section) ⭐
│   ├── 78% Ring
│   ├── Recommendation badge
│   └── Breakdown (muscle/load/time)
│
├── Training Load (NY!) ⭐
│   ├── Daily load bar
│   ├── Weekly total
│   └── Acute/Chronic ratio
│
└── Muscle Recovery Map (befintlig)
    ├── Body map
    └── Per-muscle details
```

**Scroll-ordning:**
1. Recovery Index (hero)
2. Training Load bar
3. Muscle Recovery Map

---

### Option B: Lägg till ny sub-tab "Prestanda"

```
Kropp
├── Återhämtning (muscle + recovery index)
├── Prestanda (NY! - load, patterns, feeling) ⭐
├── Mått (weight + composition)
├── Statistik (befintlig)
└── Inställningar
```

**"Prestanda"-innehåll:**
- Training load & acute/chronic
- Feeling trends
- Frequency & patterns
- Calories estimate
- Volume per muscle group (förbättrad)

---

## 🚀 PRIORITERAD IMPLEMENTATION

### Phase 1: Quick Wins (1-2 dagar)
1. ✅ **Training Load Calculation**
   - Enkelt att beräkna från befintlig data
   - Stort värde för användaren

2. ✅ **Recovery Index (Hero)**
   - Kombinera muscle recovery + load
   - Visual impact (stort ring-diagram)

3. ✅ **Body Composition Trend**
   - Förbättra befintlig "Mått"-tab
   - Bara visualisering, ingen ny data

### Phase 2: Medium Effort (3-5 dagar)
4. ✅ **Feeling Trends**
   - Kräver text-parsing
   - Värdefullt för user insights

5. ✅ **Training Patterns**
   - Frequency analysis
   - Consistency score

6. ✅ **Volume per Muscle**
   - Förbättrad visualisering
   - Obalans-warnings

### Phase 3: Polish (1 vecka)
7. ✅ **Calories Estimate**
   - Nice-to-have
   - Visuell förbättring

8. ✅ **Animations & Polish**
   - Ring animations
   - Smooth transitions
   - Micro-interactions

---

## 💡 EXEMPEL: Recovery Index Hero Component

```typescript
// components/RecoveryIndexHero.tsx

interface RecoveryIndexHeroProps {
  recoveryIndex: RecoveryIndex;
  trainingLoad: TrainingLoad;
}

export const RecoveryIndexHero: React.FC<RecoveryIndexHeroProps> = ({
  recoveryIndex,
  trainingLoad
}) => {
  return (
    <div className="p-6 space-y-6">
      {/* Hero Ring */}
      <div className="flex flex-col items-center">
        <RecoveryRing score={recoveryIndex.score} size={180} />
        <h2 className="text-4xl font-black mt-4">{recoveryIndex.score}%</h2>
        <p className="text-text-dim text-sm">Recovery Index</p>

        <RecommendationBadge recommendation={recoveryIndex.recommendation} />
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-3 gap-3">
        <BreakdownCard
          title="Muskler"
          value={recoveryIndex.muscleScore}
          icon="💪"
        />
        <BreakdownCard
          title="Belastning"
          value={recoveryIndex.loadScore}
          icon="⚡"
        />
        <BreakdownCard
          title="Vila"
          value={recoveryIndex.timeScore}
          icon="😴"
        />
      </div>

      {/* Training Load */}
      <div className="bg-white/5 p-4 rounded-2xl">
        <h4 className="text-xs font-black uppercase text-text-dim mb-2">
          Träningsbelastning
        </h4>
        <LoadBar value={trainingLoad.daily} max={21} />
        <div className="flex justify-between mt-2 text-xs text-text-dim">
          <span>Vecka: {trainingLoad.weekly.toFixed(1)}</span>
          <span>A/C: {trainingLoad.acuteChronicRatio.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};
```

---

## ✅ SLUTSATS

**Du kan lägga till MYCKET värde DIREKT utan health API!**

### Mest Impact:
1. **Recovery Index** (kombination av muscle + load + time)
2. **Training Load** (Whoop-liknande utan puls)
3. **Body Composition Trends** (förbättrad visualisering)

### Bästa UI-struktur:
```
Kropp → Återhämtning
├── Recovery Index Hero (78% ring)
├── Training Load (bar + stats)
└── Muscle Recovery Map (befintlig)
```

**Implementationstid:** 3-5 dagar för full grundfunktionalitet

Vill du att jag implementerar **Recovery Index + Training Load** först? Det ger störst bang-for-the-buck! 🚀
