
import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, Goal, UserSettings, MagazineTone } from '../types';
import { storage, exportExerciseLibrary, importExerciseLibrary } from '../services/storage';
import { db, exportDatabase, importDatabase } from '../services/db';
import { uploadBackup, listBackups, downloadBackup } from '../services/googleDrive';
import { Save, Download, Upload, Smartphone, LayoutList, Map, Thermometer, Dumbbell, Scale, Cloud, RefreshCw, CloudOff, AlertCircle, CheckCircle2, Loader2, Timer, Key, Edit, Users, BarChart, BrainCircuit } from 'lucide-react';

interface SettingsViewProps {
  userProfile: UserProfile;
  onUpdate: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ userProfile, onUpdate }) => {
  const [localProfile, setLocalProfile] = useState<UserProfile>(userProfile);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [connectionError, setConnectionError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSettingChange = (key: keyof UserSettings, value: any) => {
    setLocalProfile(prev => ({
        ...prev,
        settings: {
            // Provide defaults for all settings to ensure type safety
            includeWarmupInStats: prev.settings?.includeWarmupInStats ?? false,
            restTimer: prev.settings?.restTimer,
            keepAwake: prev.settings?.keepAwake,
            bodyViewMode: prev.settings?.bodyViewMode ?? 'list',
            barbellWeight: prev.settings?.barbellWeight ?? 20,
            dumbbellBaseWeight: prev.settings?.dumbbellBaseWeight ?? 2,
            vibrateButtons: prev.settings?.vibrateButtons ?? true,
            vibrateTimer: prev.settings?.vibrateTimer ?? true,
            googleDriveLinked: prev.settings?.googleDriveLinked ?? false,
            autoSyncMode: prev.settings?.autoSyncMode,
            restoreOnStartup: prev.settings?.restoreOnStartup,
            lastCloudSync: prev.settings?.lastCloudSync,
            geminiApiKey: prev.settings?.geminiApiKey,
            magazineTone: prev.settings?.magazineTone ?? 'friend',
            // Then spread the existing settings to keep any other values
            ...prev.settings,
            // Finally, apply the new value
            [key]: value
        }
    }));
  };

  const handleSave = async () => {
    await storage.setUserProfile(localProfile);
    onUpdate();
    alert("Inställningar sparade!");
  };
  
  const handleCloudBackup = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');
    setSyncMessage('Ansluter & exporterar data...');
    try {
      const data = await exportDatabase();
      setSyncMessage('Laddar upp till Google Drive...');
      await uploadBackup(data);
      setSyncStatus('success');
      setSyncMessage('Backup lyckades!');
      const updatedProfile = {
        ...localProfile,
        settings: {
          ...localProfile.settings!,
          googleDriveLinked: true,
          lastCloudSync: new Date().toISOString()
        }
      };
      await storage.setUserProfile(updatedProfile);
      setLocalProfile(updatedProfile);
      onUpdate();
    } catch (error) {
      console.error(error);
      setSyncStatus('error');
      setSyncMessage('Kunde inte göra backup.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  const handleCloudRestore = async () => {
    if (!confirm("Är du säker? Detta kommer skriva över all din nuvarande lokala data med datan från din backup.")) {
        return;
    }
    setIsSyncing(true);
    setSyncStatus('idle');
    setSyncMessage('Letar efter backup...');
    try {
      const files = await listBackups();
      if (files.length === 0) {
        setSyncStatus('error');
        setSyncMessage('Ingen backup hittades');
        return;
      }
  
      setSyncMessage('Laddar ner...');
      const backupFile = await downloadBackup(files[0].id);
  
      if (backupFile?.data) {
        setSyncMessage('Återställer databas...');
        await importDatabase(backupFile.data);
        setSyncStatus('success');
        setSyncMessage('Klart! Startar om...');
        
        setTimeout(() => window.location.reload(), 1500);
      } else {
          throw new Error("Backup-filen var korrupt eller tom.");
      }
    } catch (error) {
      console.error(error);
      setSyncStatus('error');
      setSyncMessage('Fel vid återställning.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  const handleExport = async () => {
    try {
      // Use the new robust export function in storage service
      const success = await storage.exportFullBackup();
      if (!success) {
        alert("Kunde inte exportera data.");
      }
    } catch(err) {
      console.error("Export failed:", err);
      alert("Kunde inte exportera data.");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("Är du säker? Detta kommer att skriva över all din nuvarande data.")) {
        if(e.target) e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const content = event.target?.result as string;
            const data = JSON.parse(content);
            if (!data.data || !data.data.profile) {
              throw new Error("Filen verkar inte vara en giltig backup.");
            }
            await importDatabase(data.data);
            alert("Återställning klar! Appen startas om.");
            window.location.reload();
        } catch (error) {
            alert("Kunde inte läsa backup-filen: " + (error as Error).message);
            console.error("Import failed:", error);
        } finally {
            if(e.target) e.target.value = '';
        }
    };
    reader.readAsText(file);
  };
  
  const handleExportLibrary = async () => {
    const success = await exportExerciseLibrary();
    // Success/fail message is handled by native share sheet or the function itself in some cases,
    // but for web fallback we might want a confirm.
    // In Native mode, the share sheet IS the confirmation.
  };

  const handleImportLibrary = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const count = await importExerciseLibrary(file);
      alert(`Import lyckades! ${count} övningar har lagts till eller uppdaterats.`);
      onUpdate();
    } catch (err: any) {
      alert("Ett fel uppstod vid importen: " + err.message);
    }
  };
  
  const currentTone = localProfile.settings?.magazineTone || 'friend';

  return (
    <div className="space-y-8 pb-32 px-2 animate-in fade-in">
      
      <section className="bg-[#1a1721] p-6 rounded-[32px] border border-white/5 space-y-4">
         <h3 className="text-xl font-black italic uppercase text-white flex items-center gap-2">
            Profil
         </h3>
         <div className="space-y-4">
            <div className="flex flex-col gap-1">
               <label className="text-[10px] font-black uppercase text-text-dim">Namn</label>
               <input 
                 type="text" 
                 value={localProfile.name} 
                 onChange={e => setLocalProfile({...localProfile, name: e.target.value})}
                 className="bg-white/5 border border-white/10 rounded-xl p-3 text-white font-bold outline-none focus:border-accent-pink"
               />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase text-text-dim">Vikt (kg)</label>
                  <input 
                    type="number" 
                    onFocus={(e) => e.target.select()}
                    value={localProfile.weight} 
                    onChange={e => setLocalProfile({...localProfile, weight: Number(e.target.value)})}
                    className="bg-white/5 border border-white/10 rounded-xl p-3 text-white font-bold outline-none focus:border-accent-pink"
                  />
               </div>
               <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase text-text-dim">Mål</label>
                  <select 
                    value={localProfile.goal} 
                    onChange={e => setLocalProfile({...localProfile, goal: e.target.value as Goal})}
                    className="bg-white/5 border border-white/10 rounded-xl p-3 text-white font-bold outline-none focus:border-accent-pink"
                  >
                     {Object.values(Goal).map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
               </div>
            </div>
         </div>
      </section>

      {/* CLOUD SYNC SECTION */}
      <section className="bg-gradient-to-br from-[#1a1721] to-[#1c1a26] p-6 rounded-[32px] border border-white/10 space-y-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
             <Cloud className="text-accent-blue" size={24} />
             <div>
                <h3 className="text-xl font-black italic uppercase text-white leading-none">Cloud Sync</h3>
                <p className="text-[10px] text-text-dim uppercase tracking-widest mt-1">Google Drive Backup</p>
             </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${localProfile.settings?.googleDriveLinked ? 'bg-accent-green/10 border-accent-green text-accent-green' : 'bg-white/5 border-white/10 text-text-dim'}`}>
            {localProfile.settings?.googleDriveLinked ? 'Ansluten' : 'Ej Ansluten'}
          </div>
        </div>

        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={handleCloudBackup}
                disabled={isSyncing}
                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-xs transition-all active:scale-95 bg-accent-blue/80 text-white shadow-lg shadow-accent-blue/20 disabled:opacity-50`}
              >
                  <Upload size={16}/> Spara i molnet
              </button>
              <button 
                onClick={handleCloudRestore}
                disabled={isSyncing}
                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black uppercase tracking-widest text-xs transition-all active:scale-95 bg-white/5 text-white disabled:opacity-50`}
              >
                  <Download size={16}/> Hämta från molnet
              </button>
            </div>
          
            {isSyncing && (
                <div className="flex items-center gap-2 text-xs font-bold justify-center text-text-dim"><Loader2 className="animate-spin" size={14}/> {syncMessage}</div>
            )}
            {syncStatus === 'success' && !isSyncing && (
                <div className="flex items-center gap-2 text-xs font-bold justify-center text-accent-green"><CheckCircle2 size={14}/> {syncMessage}</div>
            )}
            {syncStatus === 'error' && !isSyncing && (
                <div className="flex items-center gap-2 text-xs font-bold justify-center text-red-500"><AlertCircle size={14}/> {syncMessage}</div>
            )}

          {localProfile.settings?.lastCloudSync && !connectionError && (
            <p className="text-[9px] text-center text-text-dim uppercase font-bold">
              Senaste synk: {new Date(localProfile.settings.lastCloudSync).toLocaleString('sv-SE')}
            </p>
          )}

          {localProfile.settings?.googleDriveLinked && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between py-2 border-t border-white/5">
                <div className="flex items-center gap-3">
                  <Upload size={16} className="text-text-dim" />
                  <div>
                    <p className="text-sm font-bold text-white">Spara automatiskt</p>
                    <p className="text-[9px] text-text-dim uppercase">Backup efter varje pass</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleSettingChange('autoSyncMode', (localProfile.settings?.autoSyncMode === 'after_workout') ? 'manual' : 'after_workout')}
                  className={`w-10 h-5 rounded-full relative transition-colors ${(localProfile.settings?.autoSyncMode === 'after_workout') ? 'bg-accent-blue' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${(localProfile.settings?.autoSyncMode === 'after_workout') ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-white/5">
                <div className="flex items-center gap-3">
                  <RefreshCw size={16} className="text-text-dim" />
                  <div>
                    <p className="text-sm font-bold text-white">Återställ vid start</p>
                    <p className="text-[9px] text-text-dim uppercase">Kolla efter nyare data</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleSettingChange('restoreOnStartup', !(localProfile.settings?.restoreOnStartup ?? false))}
                  className={`w-10 h-5 rounded-full relative transition-colors ${(localProfile.settings?.restoreOnStartup ?? false) ? 'bg-accent-blue' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${(localProfile.settings?.restoreOnStartup ?? false) ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* AI INSTÄLLNINGAR SEKTION */}
      <section className="bg-[#1a1721] p-6 rounded-[32px] border border-white/5 space-y-6">
        <h3 className="text-xl font-black italic uppercase text-white flex items-center gap-2">
          <Key size={18} className="text-accent-blue" /> AI Konfiguration
        </h3>
        
        <div>
          <label className="text-[10px] text-text-dim font-bold uppercase block mb-2">Gemini API Nyckel</label>
          <input 
            type="password"
            value={localProfile.settings?.geminiApiKey || ''}
            onChange={(e) => handleSettingChange('geminiApiKey', e.target.value)}
            placeholder="Klistra in din nyckel här..."
            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-accent-blue outline-none"
          />
          <p className="text-[10px] text-text-dim mt-2">
            Krävs för att använda AI-coachen i appen. 
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-accent-blue underline ml-1">
              Hämta nyckel här
            </a>
          </p>
        </div>
        <div>
            <label className="text-[10px] text-text-dim font-bold uppercase block mb-3">AI-Redaktör Ton</label>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => handleSettingChange('magazineTone', 'friend')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${currentTone === 'friend' ? 'bg-white/10 border-white/20 text-white' : 'border-transparent text-text-dim'}`}>
                  <Users size={20} /> <span className="text-[9px] font-black uppercase">Peppig Vän</span>
              </button>
              <button onClick={() => handleSettingChange('magazineTone', 'coach')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${currentTone === 'coach' ? 'bg-white/10 border-white/20 text-white' : 'border-transparent text-text-dim'}`}>
                  <BarChart size={20} /> <span className="text-[9px] font-black uppercase">Hård Coach</span>
              </button>
              <button onClick={() => handleSettingChange('magazineTone', 'scientist')} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${currentTone === 'scientist' ? 'bg-white/10 border-white/20 text-white' : 'border-transparent text-text-dim'}`}>
                  <BrainCircuit size={20} /> <span className="text-[9px] font-black uppercase">Analytiker</span>
              </button>
            </div>
        </div>
      </section>

      <section className="bg-[#1a1721] p-6 rounded-[32px] border border-white/10 space-y-6">
        <h3 className="text-xl font-black italic uppercase text-white flex items-center gap-2">
          <Smartphone className="text-accent-blue" /> Appbeteende
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Vibration (Haptik)</p>
              <p className="text-xs text-text-dim">Vibrera vid knapptryck</p>
            </div>
            <button
              onClick={() => handleSettingChange('vibrateButtons', !(localProfile.settings?.vibrateButtons ?? true))}
              className={`w-12 h-6 rounded-full transition-colors relative ${localProfile.settings?.vibrateButtons ?? true ? 'bg-accent-blue' : 'bg-white/10'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-all absolute top-1 ${localProfile.settings?.vibrateButtons ?? true ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Timer-vibration</p>
              <p className="text-xs text-text-dim">Vibrera vid nedräkning</p>
            </div>
            <button
              onClick={() => handleSettingChange('vibrateTimer', !(localProfile.settings?.vibrateTimer ?? true))}
              className={`w-12 h-6 rounded-full transition-colors relative ${localProfile.settings?.vibrateTimer ?? true ? 'bg-accent-blue' : 'bg-white/10'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-all absolute top-1 ${localProfile.settings?.vibrateTimer ?? true ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </div>
      </section>

      <section className="bg-[#1a1721] p-6 rounded-[32px] border border-white/10 space-y-6">
        <h3 className="text-xl font-black italic uppercase text-white flex items-center gap-2">
          <Dumbbell className="text-accent-blue" /> Utrustning
        </h3>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent-blue/10 rounded-xl flex items-center justify-center text-accent-blue">
                <Scale size={20} />
              </div>
              <div>
                <p className="text-sm font-black uppercase italic text-white">Skivstång</p>
                <p className="text-[10px] text-text-dim font-bold uppercase">Standardvikt (kg)</p>
              </div>
            </div>
            <input 
              type="number"
              onFocus={(e) => e.target.select()}
              value={localProfile.settings?.barbellWeight || 20}
              onChange={(e) => handleSettingChange('barbellWeight', Number(e.target.value))}
              className="w-20 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-right font-black text-accent-blue outline-none focus:border-accent-blue"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent-pink/10 rounded-xl flex items-center justify-center text-accent-pink">
                <Dumbbell size={20} />
              </div>
              <div>
                <p className="text-sm font-black uppercase italic text-white">Justerbar Hantel</p>
                <p className="text-[10px] text-text-dim font-bold uppercase">Greppvikt per st (kg)</p>
              </div>
            </div>
            <input 
              type="number"
              onFocus={(e) => e.target.select()}
              value={localProfile.settings?.dumbbellBaseWeight || 2}
              onChange={(e) => handleSettingChange('dumbbellBaseWeight', Number(e.target.value))}
              className="w-20 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-right font-black text-accent-pink outline-none focus:border-accent-pink"
            />
          </div>
        </div>
      </section>

      <section className="bg-[#1a1721] p-6 rounded-[32px] border border-white/5 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-accent-blue/20 rounded-xl flex items-center justify-center text-accent-blue">
            <Dumbbell size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase italic text-white">Övningsbibliotek</h3>
            <p className="text-[9px] text-text-dim uppercase font-bold tracking-widest">Exportera/Importera enbart övningar</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={handleExportLibrary}
            className="flex items-center justify-center gap-2 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
          >
            <Download size={16} /> Exportera
          </button>
          
          <label className="flex items-center justify-center gap-2 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors cursor-pointer">
            <Upload size={16} /> Importera
            <input type="file" className="hidden" accept=".json" onChange={handleImportLibrary} />
          </label>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={handleExport} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center gap-2">
          <Download size={20} className="text-accent-blue" />
          <span className="text-[10px] font-black uppercase tracking-widest">Lokal Backup</span>
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center gap-2">
          <Upload size={20} className="text-accent-green" />
          <span className="text-[10px] font-black uppercase tracking-widest">Lokal Återställning</span>
        </button>
      </div>
      <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />

      <button 
        onClick={handleSave} 
        className="w-full py-5 bg-white text-black rounded-[24px] font-black italic text-xl uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"
      >
        <Save size={24} /> Spara Inställningar
      </button>
    </div>
  );
};
