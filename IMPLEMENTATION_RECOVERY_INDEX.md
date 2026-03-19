# Recovery Index & Training Load - Implementation Summary

## ✅ Implementerat (2026-03-19)

Jag har implementerat **Recovery Index** och **Training Load** som de två mest värdefulla quick-win-funktionerna för MorphFit. Dessa fungerar **helt utan externa hälso-API:er** och använder enbart befintlig träningsdata.

---

## 📁 Nya Filer

### 1. `/utils/trainingLoad.ts`
**Funktioner för träningsbelastning (Whoop-inspirerat)**

- `calculateDailyLoad(session)` - Beräknar daglig load (0-21) från duration, RPE och volym
- `calculateAcuteLoad(sessions)` - Senaste 7 dagars genomsnittliga load
- `calculateChronicLoad(sessions)` - Senaste 28 dagars genomsnittliga load
- `calculateAcuteChronicRatio(acute, chronic)` - Beräknar A:C ratio (optimal: 0.8-1.3)
- `analyzeTrainingLoad(ratio)` - Ger status och rekommendation baserat på ratio
- `getDailyLoadHistory(sessions, days)` - Returnerar daglig load-historik för grafer

**Algoritm för Daily Load:**
```typescript
durationFactor = duration_min / 60
rpeFactor = rpe / 10
volumeFactor = completed_sets / 20
dailyLoad = (durationFactor + rpeFactor + volumeFactor) * 7
// Max 21 (som Whoop Strain)
```

**Acute:Chronic Ratio Zones:**
- `< 0.8` → Undertränad (blå)
- `0.8-1.3` → Optimal (grön)
- `1.3-1.5` → Hög risk (orange)
- `> 1.5` → Mycket hög risk (röd)

---

### 2. `/utils/recoveryIndex.ts`
**Funktioner för Recovery Index-beräkning**

- `calculateRecoveryIndex(muscleRecovery, acuteChronicRatio, daysSinceWorkout)` - Huvudfunktion
- `calculateMuscleRecovery(sessions, daysToLookBack)` - Beräknar muskelåterhämtning 0-100
- `getDaysSinceLastWorkout(sessions)` - Antal dagar sedan senaste träning
- `getRecoveryHistory(sessions, days)` - Historik för visualisering

**Recovery Index Algoritm:**
```typescript
muscleScore = 100 - muscleRecovery  // 0-100 (100 = helt återhämtad)
loadScore = baserat på A:C ratio    // 0-100
timeScore = min(100, daysSince * 25) // 0-100 (4 dagar = 100%)

recoveryIndex =
  muscleScore * 50% +
  loadScore * 30% +
  timeScore * 20%
```

**Status Zones:**
- `85-100` → Excellent (grön) - "Redo för tung träning"
- `70-84` → Good (blå) - "Bra återhämtning - träna på"
- `50-69` → Fair (orange) - "Lättare pass rekommenderas"
- `0-49` → Poor (röd) - "Vila eller mycket lätt aktivitet"

---

### 3. `/components/RecoveryIndexHero.tsx`
**Visuell Hero-komponent för Recovery Dashboard**

**Features:**
- **Stor ringdiagram** (0-100 score) med animerad progress
- **Status badge** med färgkodning (🔥 Utmärkt, ✓ Bra, ⚠ Okej, ⛔ Dålig)
- **Breakdown-kort** för varje faktor:
  - Muskelåterhämtning (50% vikt) - röd progress bar
  - Träningsbelastning (30% vikt) - blå progress bar + A:C ratio
  - Vilotid (20% vikt) - grön progress bar
- **Training Load Summary** - Akut (7d) och Kronisk (28d) dagligt snitt
- **Info-box** som förklarar vad Recovery Index är

**Visuell Design:**
- Dark gradient bakgrund (slate-800 → slate-900)
- Animerade progress bars och ring
- Färgkodade ikoner (Heart, Activity, Clock, TrendingUp)
- Responsiv grid (1 kolumn mobil, 2 kolumner desktop)

---

## 🔧 Modifierade Filer

### `/components/StatsView.tsx`

**Nya imports:**
```typescript
import RecoveryIndexHero from './RecoveryIndexHero';
import {
  calculateRecoveryIndex,
  calculateMuscleRecovery as calculateMuscleRecoveryScore,
  getDaysSinceLastWorkout
} from '../utils/recoveryIndex';
import {
  calculateAcuteLoad,
  calculateChronicLoad,
  calculateAcuteChronicRatio
} from '../utils/trainingLoad';
```

**Ny useMemo-beräkning:**
```typescript
const recoveryIndexData = useMemo(() => {
  const muscleRecoveryScore = calculateMuscleRecoveryScore(history, 7);
  const acuteLoad = calculateAcuteLoad(history);
  const chronicLoad = calculateChronicLoad(history);
  const acuteChronicRatio = calculateAcuteChronicRatio(acuteLoad, chronicLoad);
  const daysSinceWorkout = getDaysSinceLastWorkout(history);

  const recoveryIndex = calculateRecoveryIndex(
    muscleRecoveryScore,
    acuteChronicRatio,
    daysSinceWorkout
  );

  return { recoveryIndex, acuteLoad, chronicLoad, acuteChronicRatio };
}, [history]);
```

**Integration i UI:**
- RecoveryIndexHero visas högst upp i "Återhämtning"-fliken
- Placerad ovanför befintlig RecoveryMap
- Endast synlig när `activeTab === 'recovery'`

---

## 🎯 Vad Användaren Får

### Direkt synligt i appen:
1. **Ett tydligt Recovery Score (0-100)** med ringdiagram högst upp i "Kropp → Återhämtning"
2. **Klar rekommendation** ("Redo för tung träning" / "Lättare pass rekommenderas" etc.)
3. **Breakdown av faktorer:**
   - Hur mycket musklerna är belastade
   - Om träningsbelastningen är balanserad (A:C ratio)
   - Hur länge sedan senaste träning
4. **Training Load metrics:**
   - Akut belastning (senaste 7 dagarna)
   - Kronisk belastning (senaste 28 dagarna)
   - A:C ratio för överträningsdetektering

### Värde för användaren:
✅ **Förebygger överträning** - Varnar när belastningen blir för hög
✅ **Optimerar träning** - Vet när kroppen är redo för tung träning
✅ **Whoop-liknande insikter** - Utan att behöva köpa Whoop ($30/mån)
✅ **Data-driven träning** - Beslut baserade på faktisk belastning istället för "känsla"
✅ **Fungerar direkt** - Inget API-integration behövs, använder befintlig data

---

## 🧪 Verifiering

Build körd framgångsrikt:
```bash
✓ built in 7.50s
✓ 3302 modules transformed
```

Inga TypeScript-fel, appen kompilerar utan problem.

---

## 🚀 Nästa Steg (Valfritt)

Om du vill bygga vidare på detta kan du:

1. **Lägga till graf** för Training Load över tid (använd `getDailyLoadHistory()`)
2. **Push-notifikationer** när A:C ratio > 1.5 ("Risk för överträning!")
3. **Historik-view** med `getRecoveryHistory()` för att se recovery-trender
4. **Integration med Health API** för att lägga till:
   - HRV → Förbättra loadScore
   - Resting HR → Förbättra muscleScore
   - Sömn → Ny faktor (sleep recovery)

Men det behövs inte - du har nu ett fullt fungerande Recovery Index-system! 🎉

---

## 📊 Exempel Beräkning

**Scenario:** Användare tränade hårt för 3 dagar sedan, har gjort 5 pass senaste veckan.

```
Muskelåterhämtning: 60/100 (decay över tid)
→ muscleScore = 40 (invertera: 100-60)

A:C Ratio: 1.2 (inom optimal zone 0.8-1.3)
→ loadScore = 100

Dagar sedan träning: 3
→ timeScore = 75 (3 * 25)

Recovery Index = 40*0.5 + 100*0.3 + 75*0.2 = 20 + 30 + 15 = 65
→ Status: Fair (Orange)
→ Rekommendation: "Lättare pass rekommenderas"
```

---

## 🎨 UI Screenshot (Konceptuell beskrivning)

```
┌─────────────────────────────────────────────┐
│  Återhämtningsindex           🔥 Utmärkt    │
├─────────────────────────────────────────────┤
│                                              │
│         ╱───────╲                            │
│       ╱           ╲         Muskelåterhämtning│
│      │     92      │        ▓▓▓▓▓▓▓▓▓░ 85    │
│      │    / 100    │        Vikt: 50%        │
│       ╲           ╱                           │
│         ╲───────╱          Träningsbelastning │
│                             ▓▓▓▓▓▓▓▓▓▓ 100    │
│   Redo för tung träning     Vikt: 30% A:C 1.1│
│                                              │
│                             Vilotid          │
│                             ▓▓▓▓▓░░░░░ 50    │
│                             Vikt: 20%        │
│                                              │
│  Akut (7d): 12.3          Kronisk (28d): 11.2│
│  Dagligt snitt            Dagligt snitt     │
└─────────────────────────────────────────────┘
```

---

**Implementerat av:** Claude Code
**Datum:** 2026-03-19
**Byggtid:** ~15 minuter
**Status:** ✅ Klar för testning
