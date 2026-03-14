import React, { useState } from 'react';
import { UserProfile, Goal, Zone, Equipment } from '../types';
import { storage } from '../services/storage';
import { getAccessToken, listBackups, downloadBackup, BackupData } from '../services/googleDrive';
import { ChevronRight, Check, Dumbbell, Target, User, Weight, MapPin, Cloud, RefreshCw, Loader2 } from 'lucide-react';

interface OnboardingWizardProps {
  onComplete: () => void;
}

const EQUIPMENT_CATEGORIES = [
  { title: "Grundläggande", items: [Equipment.BODYWEIGHT, Equipment.PULLUP_BAR, Equipment.BENCH, Equipment.DIP_STATION] },
  { title: "Fria Vikter", items: [Equipment.BARBELL, Equipment.DUMBBELL, Equipment.KETTLEBELL, Equipment.EZ_BAR] },
  { title: "Maskiner", items: [Equipment.LEG_PRESS, Equipment.LEG_EXTENSION, Equipment.LEG_CURL, Equipment.CABLES, Equipment.LAT_PULLDOWN, Equipment.CHEST_PRESS] }
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(-1); // Start with step -1 for Cloud Sync option
  
  // Temporärt state för wizard
  const [name, setName] = useState('');
  const [weight, setWeight] = useState<number>(80);
  const [goal, setGoal] = useState<Goal>(Goal.HYPERTROPHY);
  const [gymName, setGymName] = useState('Mitt Gym');
  const [gymInventory, setGymInventory] = useState<Equipment[]>([]);
  const [isSearchingCloud, setIsSearchingCloud] = useState(false);
  const [foundBackup, setFoundBackup] = useState<BackupData | null>(null);

  const totalSteps = 5; // -1, 0, 1, 2, 3

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      finishOnboarding();
    }
  };

  const handleConnectCloud = async () => {
    setIsSearchingCloud(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setStep(0); // Move to normal onboarding
        return;
      }
      
      const files = await listBackups();
      const fileId = files.length > 0 ? files[0].id : null;
      if (fileId) {
        const backup = await downloadBackup(fileId);
        if (backup) {
          setFoundBackup(backup);
          return; // Stay on cloud step to show "Restore" option
        }
      }
      setStep(0);
    } catch (e) {
      setStep(0);
    } finally {
      setIsSearchingCloud(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (foundBackup) {
      setIsSearchingCloud(true);
      // Ensure Google Drive is linked in settings after restore
      const restoredBackup: BackupData = {
        ...foundBackup,
        data: {
          ...foundBackup.data,
          profile: {
            ...foundBackup.data.profile,
            settings: {
              ...foundBackup.data.profile.settings,
              googleDriveLinked: true,
              restoreOnStartup: true,
              autoSyncMode: 'after_workout' as const
            }
          }
        }
      };
      await storage.importFullBackup(restoredBackup);
      alert("Återställning klar! Appen startas om.");
      window.location.reload();
    }
  };

  const finishOnboarding = async () => {
    // 1. Skapa och spara Profil
    const profile: UserProfile = {
      name,
      weight,
      height: 180, 
      level: 'Medel',
      goal,
      injuries: [],
      measurements: {}
    };
    await storage.setUserProfile(profile);

    // 2. Skapa och spara den första Zonen
    const firstZone: Zone = {
      id: `zone-${Date.now()}`,
      name: gymName,
      icon: 'dumbell',
      inventory: gymInventory.length > 0 ? gymInventory : [Equipment.BODYWEIGHT, Equipment.DUMBBELL]
    };
    await storage.saveZone(firstZone);

    // 3. Klar!
    onComplete();
  };

  const toggleEquipment = (eq: Equipment) => {
    if (gymInventory.includes(eq)) {
      setGymInventory(prev => prev.filter(i => i !== eq));
    } else {
      setGymInventory(prev => [...prev, eq]);
    }
  };

  const toggleAllEquipment = () => {
    const allEq = Object.values(Equipment);
    if (gymInventory.length === allEq.length) {
      setGymInventory([]);
    } else {
      setGymInventory(allEq);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0f0d15] z-[999] flex flex-col items-center justify-center p-6 text-white animate-in fade-in duration-500">
      
      {/* Progress Indicator */}
      <div className="w-full max-w-md flex gap-2 mb-12">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className={`h-1 flex-1 rounded-full transition-all duration-500 ${idx <= step ? 'bg-accent-pink' : 'bg-white/10'}`} />
        ))}
      </div>

      <div className="w-full max-w-md flex-1 flex flex-col">
        
        {/* STEP -1: CLOUD SYNC OPTION */}
        {step === -1 && (
          <div className="animate-in slide-in-from-right-8 duration-500 space-y-8 flex-1 flex flex-col justify-center">
            <div className="w-20 h-20 bg-accent-blue/10 rounded-full flex items-center justify-center text-accent-blue mb-4 mx-auto border border-accent-blue/20">
              <Cloud size={40} />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black italic uppercase">Välkommen tillbaka?</h2>
              <p className="text-text-dim text-sm">Har du redan ett konto eller en backup på Google Drive? Vi kan återställa din historik direkt.</p>
            </div>
            
            {foundBackup ? (
               <div className="bg-white/5 border border-accent-green/30 p-6 rounded-[32px] space-y-4 animate-in zoom-in-95">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-accent-green/20 rounded-2xl flex items-center justify-center text-accent-green">
                      <Check size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-accent-green tracking-widest">Backup Hittad</p>
                      <h4 className="text-xl font-black italic uppercase">{foundBackup.data.profile.name}</h4>
                    </div>
                 </div>
                 <p className="text-xs text-text-dim">Exporterad: {new Date(foundBackup.timestamp).toLocaleDateString('sv-SE')}</p>
                 <button 
                   onClick={handleRestoreBackup}
                   disabled={isSearchingCloud}
                   className="w-full py-4 bg-accent-green text-black rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all"
                 >
                   {isSearchingCloud ? <Loader2 className="animate-spin mx-auto" /> : 'Återställ All Data'}
                 </button>
               </div>
            ) : (
              <button 
                onClick={handleConnectCloud}
                disabled={isSearchingCloud}
                className="w-full py-5 bg-white/5 border border-white/10 rounded-2xl font-black italic uppercase flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                {isSearchingCloud ? <Loader2 className="animate-spin" size={20} /> : <Cloud size={20} />}
                {isSearchingCloud ? 'Söker efter backup...' : 'Hämta från Google Drive'}
              </button>
            )}

            <button onClick={() => setStep(0)} className="text-xs text-text-dim font-bold uppercase tracking-widest text-center hover:text-white transition-colors">
              {foundBackup ? 'Nej tack, starta på nytt' : 'Hoppa över, jag är ny här'}
            </button>
          </div>
        )}

        {/* STEP 0: NAMN */}
        {step === 0 && (
          <div className="animate-in slide-in-from-right-8 duration-500 space-y-8 flex-1 flex flex-col justify-center">
            <div className="w-20 h-20 bg-accent-pink/10 rounded-full flex items-center justify-center text-accent-pink mb-4 mx-auto border border-accent-pink/20">
              <User size={40} />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black italic uppercase">Välkommen!</h2>
              <p className="text-text-dim text-sm">Låt oss börja med det grundläggande. Vad ska vi kalla dig?</p>
            </div>
            <input 
              autoFocus
              type="text" 
              placeholder="Ditt namn..." 
              value={name}
              onChange={e => setName(e.target.value)}
              className="bg-transparent border-b-2 border-white/20 text-3xl font-bold text-center py-4 outline-none focus:border-accent-pink transition-colors placeholder:text-white/10"
            />
          </div>
        )}

        {/* STEP 1: VIKT */}
        {step === 1 && (
          <div className="animate-in slide-in-from-right-8 duration-500 space-y-8 flex-1 flex flex-col justify-center">
            <div className="w-20 h-20 bg-accent-blue/10 rounded-full flex items-center justify-center text-accent-blue mb-4 mx-auto border border-accent-blue/20">
              <Weight size={40} />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black italic uppercase">Din Startvikt</h2>
              <p className="text-text-dim text-sm">För att beräkna kroppsviktsövningar och kalorier.</p>
            </div>
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => setWeight(Math.max(30, weight - 1))} className="w-12 h-12 rounded-full bg-white/5 text-2xl font-bold">-</button>
              <div className="text-5xl font-black italic tracking-tighter">{weight} <span className="text-xl text-text-dim not-italic font-bold">kg</span></div>
              <button onClick={() => setWeight(weight + 1)} className="w-12 h-12 rounded-full bg-white/5 text-2xl font-bold">+</button>
            </div>
          </div>
        )}

        {/* STEP 2: MÅL */}
        {step === 2 && (
          <div className="animate-in slide-in-from-right-8 duration-500 space-y-6 flex-1 flex flex-col justify-center">
            <div className="w-20 h-20 bg-[var(--accent-green)]/10 rounded-full flex items-center justify-center text-[var(--accent-green)] mb-4 mx-auto border border-[var(--accent-green)]/20">
              <Target size={40} />
            </div>
            <div className="text-center space-y-2 mb-4">
              <h2 className="text-3xl font-black italic uppercase">Ditt Huvudmål</h2>
              <p className="text-text-dim text-sm">Detta påverkar volym och reps i dina genererade pass.</p>
            </div>
            <div className="grid gap-3">
              {Object.values(Goal).map((g) => (
                <button
                  key={g}
                  onClick={() => setGoal(g)}
                  className={`p-6 rounded-3xl border text-left transition-all ${
                    goal === g 
                      ? 'bg-white text-black border-white scale-105 shadow-xl' 
                      : 'bg-white/5 border-white/5 text-text-dim hover:bg-white/10'
                  }`}
                >
                  <span className="font-black uppercase italic text-lg">{g}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: GYM & UTRUSTNING */}
        {step === 3 && (
          <div className="animate-in slide-in-from-right-8 duration-500 space-y-4 flex-1 flex flex-col">
            <div className="text-center space-y-1 pt-4">
              <div className="flex items-center justify-center gap-2 text-accent-pink mb-2">
                 <MapPin size={20} />
                 <span className="text-xs font-black uppercase tracking-widest">Sista steget</span>
              </div>
              <h2 className="text-2xl font-black italic uppercase">Ditt Första Gym</h2>
              <p className="text-text-dim text-xs">Välj vilken utrustning du har tillgång till. Detta gör att vi kan bygga pass åt dig direkt.</p>
            </div>

            <input 
              type="text" 
              value={gymName} 
              onChange={e => setGymName(e.target.value)} 
              className="bg-white/5 border border-white/10 rounded-xl p-4 text-center font-bold text-white outline-none focus:border-white/30"
              placeholder="Vad heter gymmet?"
            />

            <div className="flex-1 overflow-y-auto min-h-0 bg-black/20 rounded-3xl p-4 border border-white/5 scrollbar-hide space-y-4">
               {EQUIPMENT_CATEGORIES.map(cat => (
                 <div key={cat.title}>
                   <h4 className="text-xs font-black uppercase tracking-widest text-text-dim mb-2">{cat.title}</h4>
                   <div className="grid grid-cols-2 gap-2">
                      {cat.items.map(eq => (
                        <button
                          key={eq}
                          onClick={() => toggleEquipment(eq)}
                          className={`p-3 rounded-xl border text-left flex items-center gap-2 transition-all ${
                            gymInventory.includes(eq)
                              ? 'bg-accent-pink/20 border-accent-pink text-white'
                              : 'bg-white/5 border-transparent text-text-dim opacity-70'
                          }`}
                        >
                           <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${gymInventory.includes(eq) ? 'border-accent-pink bg-accent-pink text-black' : 'border-white/20'}`}>
                              {gymInventory.includes(eq) && <Check size={10} strokeWidth={4} />}
                           </div>
                           <span className="text-[10px] font-bold uppercase">{eq}</span>
                        </button>
                      ))}
                   </div>
                 </div>
               ))}
            </div>
            
            <button onClick={toggleAllEquipment} className="text-xs text-text-dim underline text-center">
               {gymInventory.length > 0 ? 'Rensa val' : 'Välj alla (Fullt gym)'}
            </button>
          </div>
        )}

        {/* NAVIGATION BUTTON */}
        <div className="mt-8">
          <button 
            onClick={handleNext}
            disabled={(step === -1 && !foundBackup) || (step === 0 && !name) || (step === 3 && !gymName)}
            className="w-full py-5 bg-white text-black rounded-[24px] font-black italic text-xl uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
          >
            {step === 3 ? 'Kör igång!' : 'Nästa'} <ChevronRight size={20} strokeWidth={3} />
          </button>
        </div>

      </div>
    </div>
  );
};