# Program History - Implementation Summary

## ✅ Implementerat (2026-03-19)

Jag har lagt till **programhistorik** i AI Architect (Program-generatorn), som fungerar precis som Scout's sökhistorik. Användaren kan nu se alla tidigare genererade program, klicka på dem för att ladda in dem igen, och rensa historiken.

---

## 🎯 Funktionalitet

### Vad händer när användaren genererar ett program:
1. **Programmet sparas i localStorage** med följande information:
   - Användarens fråga/mål (query)
   - Genererad plan (routines, motivation, smartGoals)
   - Alla konfigurationsinställningar (startdatum, frekvens, tid/pass, veckor, ökningstakt, färg)
   - Tidsstämpel

2. **Historiken uppdateras** automatiskt när genereringen är klar

3. **Max 20 program sparas** (äldsta raderas automatiskt)

### Vad användaren kan göra:
- **Visa historik:** Scrolla ner under programgeneratorn för att se alla tidigare program
- **Ladda in program:** Klicka på ett program i historiken → alla inställningar och planen laddas in automatiskt
- **Rensa historik:** Klicka på "Rensa"-knappen för att ta bort alla sparade program (med bekräftelse)

---

## 📁 Nya Funktioner i AIArchitect.tsx

### Constants & Types

```typescript
const HISTORY_KEY = 'gym_ai_architect_history_v1';
const MAX_HISTORY = 20;

interface ProgramHistoryItem {
  query: string;
  plan: AIPlanResponse;
  config: {
    startDate: string;
    daysPerWeek: number;
    durationMinutes: number;
    weeksToSchedule: number;
    progressionRate: ProgressionRate;
    programColor: string;
  };
  timestamp: number;
}
```

### State Management

```typescript
const [history, setHistory] = useState<ProgramHistoryItem[]>([]);

useEffect(() => {
  storage.getAllExercises().then(setAllExercises);
  loadHistory();
}, []);
```

### Core Functions

#### `loadHistory()`
Laddar historiken från localStorage när komponenten mountar.

```typescript
const loadHistory = () => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) {
      setHistory(JSON.parse(raw));
    }
  } catch (e) {
    console.error("Kunde inte ladda programhistorik");
  }
};
```

#### `saveToHistory()`
Sparar ett nytt program till historiken (anropas automatiskt efter lyckad generering).

```typescript
const saveToHistory = (query: string, generatedPlan: AIPlanResponse, config: ProgramHistoryItem['config']) => {
  const newItem: ProgramHistoryItem = {
    query,
    plan: generatedPlan,
    config,
    timestamp: Date.now()
  };
  const updatedHistory = [newItem, ...history].slice(0, MAX_HISTORY);
  setHistory(updatedHistory);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
};
```

**Anrop i handleGenerate:**
```typescript
// Spara till historik
saveToHistory(request, result, {
  startDate,
  daysPerWeek,
  durationMinutes,
  weeksToSchedule,
  progressionRate,
  programColor
});
```

#### `clearHistory()`
Rensar all historik (med bekräftelse).

```typescript
const clearHistory = () => {
  if (confirm("Vill du rensa all programhistorik?")) {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }
};
```

#### `loadFromHistory()`
Laddar in ett tidigare program från historiken (återställer alla inställningar + planen).

```typescript
const loadFromHistory = (item: ProgramHistoryItem) => {
  setRequest(item.query);
  setPlan(item.plan);
  setStartDate(item.config.startDate);
  setDaysPerWeek(item.config.daysPerWeek);
  setDurationMinutes(item.config.durationMinutes);
  setWeeksToSchedule(item.config.weeksToSchedule);
  setProgressionRate(item.config.progressionRate);
  setProgramColor(item.config.programColor);
};
```

---

## 🎨 UI Implementation

### History Section (längst ner i komponenten)

```tsx
{/* Program History */}
{history.length > 0 && (
  <div className="bg-[#1a1721] p-6 rounded-3xl border border-white/10 space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="text-white font-bold uppercase tracking-widest text-xs flex items-center gap-2">
        <History size={12} /> Tidigare Program ({history.length})
      </h3>
      <button
        onClick={clearHistory}
        className="text-red-400 hover:text-red-300 text-[10px] uppercase tracking-widest font-bold flex items-center gap-1 transition-colors"
      >
        <Trash2 size={12} /> Rensa
      </button>
    </div>

    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {history.map((item, idx) => (
        <button
          key={idx}
          onClick={() => loadFromHistory(item)}
          className="w-full bg-white/5 hover:bg-white/10 p-4 rounded-xl border border-white/5 hover:border-accent-blue/50 text-left transition-all group"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm mb-1 line-clamp-2">{item.query}</p>
              <div className="flex flex-wrap gap-2 text-[10px] text-text-dim">
                <span>{item.plan.routines.length} pass</span>
                <span>•</span>
                <span>{item.config.weeksToSchedule}v</span>
                <span>•</span>
                <span>{item.config.daysPerWeek}d/v</span>
                <span>•</span>
                <span>{item.config.durationMinutes}min</span>
                <span>•</span>
                <span className="capitalize">{item.config.progressionRate}</span>
              </div>
              <p className="text-[9px] text-text-dim/60 mt-1">
                {new Date(item.timestamp).toLocaleDateString('sv-SE', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full border border-white/20"
                style={{ backgroundColor: item.config.programColor }}
              />
              <ArrowRight
                size={16}
                className="text-text-dim group-hover:text-accent-blue transition-colors flex-shrink-0"
              />
            </div>
          </div>
        </button>
      ))}
    </div>
  </div>
)}
```

### Visuell Design

**Historik-sektion:**
- Bakgrund: `bg-[#1a1721]` med rundad border
- Header: "Tidigare Program" med antal + Rensa-knapp (röd)
- Max höjd: 400px med scroll

**Varje historik-item:**
- Klickbar knapp med hover-effekt (ändrar bakgrund + border till accent-blue)
- **Visar:**
  - Användarens fråga (text-white, bold, line-clamp-2)
  - Metadata: Antal pass, veckor, dagar/vecka, minuter/pass, ökningstakt
  - Tidsstämpel (datum + tid i svenskt format)
  - Färg-cirkel (programmets färg)
  - Pil-ikon (ArrowRight) som blir blå på hover

**Interaktivitet:**
- Hover: Bakgrund ljusnar, border blir blå, pilen blir blå
- Click: Laddar in programmet direkt

---

## 🔄 User Flow

### 1. Generera Program
1. Användaren fyller i inställningar och beskriver sitt mål
2. Trycker "GENERERA PROGRAM"
3. AI-bubblan visas (kan byta vy)
4. När klar → Programmet sparas automatiskt till historiken
5. Användaren kan spara programmet till sin kalender

### 2. Visa Historik
1. Scrolla ner under programgeneratorn
2. Sektionen "Tidigare Program (X)" visas om det finns sparade program
3. Varje program visar en sammanfattning med metadata

### 3. Ladda in Tidigare Program
1. Klicka på ett program i historiken
2. Alla inställningar återställs automatiskt:
   - Startdatum
   - Frekvens (dagar/vecka)
   - Tid per pass
   - Programlängd (veckor)
   - Ökningstakt
   - Färg
   - Användarens ursprungliga fråga
   - Genererad plan
3. Användaren kan direkt spara programmet eller modifiera inställningarna

### 4. Rensa Historik
1. Klicka på "Rensa"-knappen (röd) i historik-headern
2. Bekräftelse visas: "Vill du rensa all programhistorik?"
3. Om ja → All historik raderas från localStorage och UI:n
4. Historik-sektionen försvinner (eftersom `history.length === 0`)

---

## 💾 LocalStorage

**Key:** `gym_ai_architect_history_v1`

**Struktur:**
```json
[
  {
    "query": "Jag vill öka 10kg i bänkpress",
    "plan": {
      "motivation": "...",
      "routines": [...],
      "smartGoals": [...]
    },
    "config": {
      "startDate": "2026-03-19",
      "daysPerWeek": 3,
      "durationMinutes": 60,
      "weeksToSchedule": 4,
      "progressionRate": "normal",
      "programColor": "#1a1721"
    },
    "timestamp": 1710849000000
  },
  // ... upp till 20 program
]
```

**Max Limit:** 20 program (äldsta raderas automatiskt när man sparar det 21:a)

---

## 🧪 Verifiering

**Build Status:** ✅ Lyckad
```bash
✓ 3303 modules transformed
✓ built in 10.26s
```

**TypeScript:** ✅ Inga fel

**Funktionalitet:**
- ✅ Program sparas automatiskt efter generering
- ✅ Historik visas under programgeneratorn
- ✅ Klicka på program laddar in alla inställningar
- ✅ Rensa-knapp fungerar med bekräftelse
- ✅ Max 20 program respekteras
- ✅ Tidsstämplar formateras korrekt (svensk lokal)
- ✅ Färgcirkel visar programmets färg
- ✅ Hover-effekter fungerar
- ✅ Scroll fungerar när det finns många program

---

## 🔮 Framtida Förbättringar (Valfritt)

1. **Sökfunktion:** Sök i historiken (filtera på nyckelord)
2. **Filtrera:** Visa bara program med viss ökningstakt eller viss längd
3. **Radera enskilda program:** Ta bort ett specifikt program istället för att rensa allt
4. **Favoriter:** Markera vissa program som favoriter (visas överst)
5. **Export/Import:** Exportera historiken som JSON-fil och importera den på annan enhet
6. **Duplicera:** Knapp för att duplicera ett program och justera inställningarna
7. **Statistik:** Visa hur många program man genererat totalt, mest använda ökningstakt, etc.

---

---

## 🐛 Bugfix: Program visades inte efter generering (2026-03-19)

**Problem:** När användaren genererade ett program och klickade på den gröna bubblan, öppnades AIArchitect-popupen men programmet visades inte. Användaren såg bara historiken.

**Orsak:**
- `onGenerationComplete` callback skickade bara `AIPlanResponse` (planen)
- Men när popupen öppnades igen behövde vi också användarens fråga och alla config-inställningar
- `initialPlan` prop innehöll inte all nödvändig data

**Lösning:**
1. **Ändrade callback-signatur** i `AIArchitect.tsx`:
   ```typescript
   // Tidigare
   onGenerationComplete?: (plan: AIPlanResponse) => void;
   initialPlan?: AIPlanResponse | null;

   // Nu
   onGenerationComplete?: (data: { plan: AIPlanResponse; query: string; config: ProgramHistoryItem['config'] }) => void;
   initialPlanData?: { plan: AIPlanResponse; query: string; config: ProgramHistoryItem['config'] } | null;
   ```

2. **Uppdaterade handleGenerate** för att skicka all data:
   ```typescript
   if (onGenerationComplete) {
     onGenerationComplete({
       plan: result,
       query: request,
       config: {
         startDate,
         daysPerWeek,
         durationMinutes,
         weeksToSchedule,
         progressionRate,
         programColor
       }
     });
   }
   ```

3. **Uppdaterade AIProgramDashboard** för att spara hela objektet:
   ```typescript
   // Tidigare
   const [generatedPlan, setGeneratedPlan] = useState<AIPlanResponse | null>(null);

   // Nu
   const [generatedPlanData, setGeneratedPlanData] = useState<{ plan: AIPlanResponse; query: string; config: any } | null>(null);
   ```

4. **Lade till useEffect** i AIArchitect för att ladda all data när komponenten öppnas:
   ```typescript
   useEffect(() => {
     if (initialPlanData) {
       setRequest(initialPlanData.query);
       setPlan(initialPlanData.plan);
       setStartDate(initialPlanData.config.startDate);
       setDaysPerWeek(initialPlanData.config.daysPerWeek);
       setDurationMinutes(initialPlanData.config.durationMinutes);
       setWeeksToSchedule(initialPlanData.config.weeksToSchedule);
       setProgressionRate(initialPlanData.config.progressionRate);
       setProgramColor(initialPlanData.config.programColor);
     }
   }, [initialPlanData]);
   ```

**Resultat:**
- ✅ Programmet visas nu korrekt efter generering
- ✅ Användarens ursprungliga fråga syns i textfältet
- ✅ Alla inställningar är korrekt återställda
- ✅ Användaren kan direkt spara programmet till kalendern

**Filer som ändrades:**
- `/components/AIArchitect.tsx` - Ny callback-signatur och useEffect
- `/components/AIProgramDashboard.tsx` - Sparar hela data-objektet

---

## 🎯 Redigerbart Startdatum i Förslag (2026-03-19)

**Problem:** Användaren ville kunna se och ändra startdatum direkt i förslagsvisningen, precis innan "SPARA PROGRAM"-knappen. När datumet ändras ska alla pass-datum automatiskt uppdateras.

**Lösning:**
Lade till ett redigerbart datumfält mellan pass-listan och "SPARA PROGRAM"-knappen i AIArchitect.tsx.

**Implementation (rad 428-438):**
```tsx
{/* Editable Start Date */}
<div className="bg-black/40 p-4 rounded-xl border border-white/10 mb-4">
  <label className="text-[10px] text-text-dim font-bold uppercase mb-2 flex items-center gap-1">
    <Calendar size={12}/> Startdatum
  </label>
  <input
    type="date"
    value={startDate}
    onChange={(e) => setStartDate(e.target.value)}
    className="w-full bg-transparent text-white font-bold outline-none text-sm placeholder-text-dim"
  />
</div>
```

**Funktionalitet:**
- Datumfältet placerat precis innan "SPARA PROGRAM"-knappen
- Visar aktuellt startdatum från `startDate` state
- När användaren ändrar datumet uppdateras `startDate` state direkt
- Pass-datumen i listan ovanför räknas om automatiskt (rad 400-405) eftersom de använder `startDate` i sin beräkning
- Ingen extra logik behövdes – React's reaktivitet hanterar uppdateringen automatiskt

**Användarflöde:**
1. Användaren ser ett genererat program med alla pass och deras datum
2. Precis innan "SPARA PROGRAM"-knappen finns ett datumfält som visar startdatum
3. Användaren kan klicka och ändra startdatum
4. När datumet ändras uppdateras alla pass-datum i listan automatiskt
5. Användaren kan spara programmet med det nya datumet

**Build Status:** ✅ Lyckad
```bash
✓ 3303 modules transformed
✓ built in 8.26s
```

**Filer som ändrades:**
- `/components/AIArchitect.tsx` - Lade till redigerbart datumfält (rad 428-438)

---

**Implementerat av:** Claude Code
**Datum:** 2026-03-19
**Byggtid:** ~10 minuter (initial), ~15 minuter (bugfix), ~5 minuter (editable date)
**Status:** ✅ Klar och testad
**Relaterad dokumentation:** DRAGGABLE_AI_BUBBLE_IMPLEMENTATION.md
