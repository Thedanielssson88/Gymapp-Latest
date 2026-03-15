# 🧬 Könsbaserade Träningsanpassningar

## ✅ Implementerat

Systemet använder nu biologiskt kön (Man/Kvinna/Annan) för att anpassa träningsberäkningar baserat på fysiologiska skillnader.

---

## 📊 Skillnader mellan Män och Kvinnor

### 1. Återhämtningstid (Recovery Hours)

**Fysiologisk bakgrund:**
- Kvinnor har snabbare muskelåterhämtning pga lägre testosteronnivåer och bättre kapillärtäthet
- Män behöver längre tid för att återhämta sig från tung styrketräning

**Implementation:**
- **Män:** 72h återhämtningstid
- **Kvinnor:** 54h återhämtningstid (25% snabbare)
- **Annan:** 60h återhämtningstid (mitt emellan)

**Påverkan:**
- Muskelfördelningskarta visar snabbare återhämtning för kvinnor
- Kvinnor kan träna samma muskelgrupper oftare

---

### 2. Volymtolerans (Antal Set)

**Fysiologisk bakgrund:**
- Kvinnor tål mer volym (fler set) pga bättre uthållighet i typ I-muskelfibrer
- Män har större andel typ II-fibrer och tål högre absolut intensitet

**Implementation:**
- **Män:** Standard volym (t.ex. 4 set för Tier 1 Hypertrofi)
- **Kvinnor:** +1 extra set per övning
- **Annan:** +1 extra set per övning (samma som kvinnor)

**Exempel:**
```
Tier 1 Bänkpress (Hypertrofi):
- Man: 4 set x 8 reps
- Kvinna: 5 set x 8 reps
- Annan: 5 set x 8 reps
```

---

### 3. Belastningsberäkning (Fatigue & Strain Score)

**Fysiologisk bakgrund:**
- Kvinnor tål mer total arbetsvolym innan utmattning
- Systemet behöver vara känsligare för kvinnors högre volym

**Implementation:**

#### Fatigue Divisor (för återhämtningsberäkning):
- **Män:** 60
- **Kvinnor:** 50 (20% lägre = 20% högre känslighet)
- **Annan:** 55 (mitt emellan)

#### Strain Score Divisor:
- **Män:** 300 (60 * 5)
- **Kvinnor:** 250 (50 * 5)
- **Annan:** 275 (55 * 5)

**Påverkan:**
- Samma pass ger högre Strain Score för kvinnor (eftersom de gör fler set)
- Muskelfördelningen blir mer nyanserad för kvinnors högre volym

---

## 🛠️ Tekniska Detaljer

### Filer som ändrats:

#### 1. `utils/recovery.ts`
- Lagt till `getRecoveryHours(biologicalSex)` - Returnerar könsspecifik återhämtningstid
- Lagt till `getFatigueDivisor(biologicalSex)` - Returnerar könsspecifik belastningsdivisor
- Uppdaterat `calculateMuscleRecovery()` - Använder könsspecifik återhämtning
- Uppdaterat `applyFatigue()` - Tar emot recoveryHours som parameter

#### 2. `utils/fitness.ts`
- Uppdaterat `getTargetVolume()` - Lägger till extra set för kvinnor
- Uppdaterat `generateWorkoutSession()` - Skickar biologicalSex till getTargetVolume

#### 3. `components/WorkoutStats.tsx`
- Importerar `getFatigueDivisor` från recovery.ts
- Använder könsspecifik POINTS_DIVISOR för Strain Score

---

## 📈 Exempel på Påverkan

### Exempel: 4 övningar, 4 set vardera, 10 reps, 50kg

**Man:**
- Volym: 4 övningar x 4 set = 16 set
- Återhämtning: 72h
- Fatigue Divisor: 60
- Strain Score Divisor: 300

**Kvinna:**
- Volym: 4 övningar x 5 set = 20 set (+25% volym)
- Återhämtning: 54h (25% snabbare)
- Fatigue Divisor: 50 (20% känsligare)
- Strain Score Divisor: 250 (20% högre score för samma belastning)

**Annan:**
- Volym: 4 övningar x 5 set = 20 set (samma som kvinna)
- Återhämtning: 60h (mellan man och kvinna)
- Fatigue Divisor: 55
- Strain Score Divisor: 275

---

## 🎯 Framtida Förbättringar

Möjliga framtida anpassningar:

1. **Viktrekommendationer:**
   - Män: Högre startsvikter för samma 1RM-procent
   - Kvinnor: Mer gradvis progression

2. **RPE-tolkning:**
   - Kvinnor kan träna närmare failure oftare
   - Män bör vara försiktigare med failure-set

3. **Träningsfrekvens:**
   - Systemet kan rekommendera högre frekvens för kvinnor (pga snabbare återhämtning)

4. **Periodisering:**
   - Kvinnor: Högre volym-faser
   - Män: Högre intensitet-faser

---

## ✅ Testning

För att testa funktionaliteten:

1. Skapa två användare med olika biologiskt kön
2. Gör samma pass (samma övningar, vikttr, reps)
3. Jämför:
   - Antal set (kvinnor får +1 set per övning)
   - Strain Score (kvinnor får högre score)
   - Muskelfördelning efter 48-72h (kvinnor återhämtar snabbare)

---

## 📚 Vetenskaplig Bakgrund

**Källor:**
- Kvinnor har 30-40% lägre testosteronnivåer → Snabbare återhämtning
- Kvinnor har högre andel typ I-fibrer → Bättre uthållighet, mer volymtolerans
- Män har högre andel typ II-fibrer → Högre absolut styrka, tål tyngre vikter
- Studier visar att kvinnor kan träna samma muskelgrupp 2-3 ggr/vecka vs män 1-2 ggr/vecka

**Disclaimer:**
Detta är generella riktlinjer baserat på genomsnittliga fysiologiska skillnader. Individuell variation är stor och systemet bör ses som en utgångspunkt, inte absolut sanning.

---

**Implementerat:** 2026-03-15
**Baserat på:** Användarprofil → Biologiskt Kön (Man/Kvinna/Annan)
