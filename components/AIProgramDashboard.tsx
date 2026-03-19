
import React, { useState, useEffect } from 'react';
import { AIProgram, ScheduledActivity, WorkoutSession, Exercise, PlannedExercise, SetType, UserProfile, BiometricLog, UserMission, AIPlanResponse, ProgressionRate } from '../types';
import { storage } from '../services/storage';
import { ChevronRight, Calendar, Activity, XCircle, PlusCircle, TrendingUp, CheckCircle, ArrowLeft, Sparkles, Loader2, Circle, CheckCircle2, Plus, List, Dumbbell, Trash2, BookOpen, Palette, History, ArrowRight } from 'lucide-react';
import { AIArchitect } from './AIArchitect';
import { WorkoutDetailsModal } from './WorkoutDetailsModal';
import { AIExerciseRecommender } from './AIExerciseRecommender';
import { registerBackHandler } from '../utils/backHandler';
import { NextPhaseModal } from './NextPhaseModal';
import { ConfirmModal } from './ConfirmModal';
import { AIArticleGenerator } from './AIArticleGenerator';
import { ColorPicker } from './ColorPicker';

const HISTORY_KEY = 'gym_ai_architect_history_v1';

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

interface AIProgramDashboardProps {
  onStartSession: (activity: ScheduledActivity) => void;
  onGoToExercise: (exerciseId: string) => void;
  onUpdate: () => void;
  onAIStartGenerating: (origin: 'programs' | 'exercises' | 'articles') => void;
  onAIGenerationComplete: () => void;
  bubbleOrigin: 'programs' | 'exercises' | 'articles';
}

export const AIProgramDashboard: React.FC<AIProgramDashboardProps> = ({ onStartSession, onGoToExercise, onUpdate, onAIStartGenerating, onAIGenerationComplete, bubbleOrigin }) => {
  const [programs, setPrograms] = useState<AIProgram[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledActivity[]>([]);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [biometricLogs, setBiometricLogs] = useState<BiometricLog[]>([]);
  const [userMissions, setUserMissions] = useState<UserMission[]>([]);

  const [selectedProgram, setSelectedProgram] = useState<AIProgram | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [activeTab, setActiveTab] = useState<'programs' | 'exercises' | 'articles'>('programs');

  const [viewingActivity, setViewingActivity] = useState<ScheduledActivity | null>(null);
  const [showNextPhaseModal, setShowNextPhaseModal] = useState(false);
  const [programToDelete, setProgramToDelete] = useState<AIProgram | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // AI state (local) - spara hela historik-objektet istället för bara planen
  const [generatedPlanData, setGeneratedPlanData] = useState<{ plan: AIPlanResponse; query: string; config: any } | null>(null);

  // Program history från localStorage (samma som i AIArchitect)
  const [programHistory, setProgramHistory] = useState<ProgramHistoryItem[]>([]);

  useEffect(() => {
    if (showGenerator) return registerBackHandler(() => setShowGenerator(false));
  }, [showGenerator]);

  useEffect(() => {
    if (selectedProgram && !viewingActivity && !showNextPhaseModal && !programToDelete) {
        return registerBackHandler(() => setSelectedProgram(null));
    }
  }, [selectedProgram, viewingActivity, showNextPhaseModal, programToDelete]);

  useEffect(() => {
    if (viewingActivity) return registerBackHandler(() => setViewingActivity(null));
  }, [viewingActivity]);
  
  useEffect(() => {
    if (showNextPhaseModal) return registerBackHandler(() => setShowNextPhaseModal(false));
  }, [showNextPhaseModal]);

  useEffect(() => {
    const isModalOpen = showGenerator || !!selectedProgram || !!viewingActivity;
    if (activeTab !== 'programs' && !isModalOpen) {
      return registerBackHandler(() => setActiveTab('programs'));
    }
  }, [activeTab, showGenerator, selectedProgram, viewingActivity]);

  const loadData = async () => {
    setPrograms(await storage.getAIPrograms());
    setScheduled(await storage.getScheduledActivities());
    setHistory(await storage.getHistory());
    setAllExercises(await storage.getAllExercises());
    setUserProfile(await storage.getUserProfile());
    setBiometricLogs(await storage.getBiometricLogs());
    setUserMissions(await storage.getUserMissions());
  };

  const loadProgramHistory = () => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        setProgramHistory(JSON.parse(raw));
      }
    } catch (e) {
      console.error("Kunde inte ladda programhistorik");
    }
  };

  const clearProgramHistory = () => {
    if (confirm("Vill du rensa all programhistorik?")) {
      setProgramHistory([]);
      localStorage.removeItem(HISTORY_KEY);
    }
  };

  const loadFromProgramHistory = (item: ProgramHistoryItem) => {
    // Ladda in programmet i generatorn
    setGeneratedPlanData({
      plan: item.plan,
      query: item.query,
      config: item.config
    });
    setShowGenerator(true);
  };

  useEffect(() => {
    loadData();
    loadProgramHistory();
    window.addEventListener('storage-update', loadData);
    return () => window.removeEventListener('storage-update', loadData);
  }, []);
  
  const handleStartActivity = (activity: ScheduledActivity) => {
    setViewingActivity(null);
    onStartSession(activity);
  };

  const handleDeleteRequest = (program: AIProgram) => {
    setProgramToDelete(program);
  };
  
  const confirmDeleteProgram = async () => {
      if (programToDelete) {
          await storage.deleteAIProgram(programToDelete.id);
          setSelectedProgram(null);
          setProgramToDelete(null);
          onUpdate();
          loadData();
      }
  };

  const handleUpdateProgramColor = async (newColor: string) => {
    if (!selectedProgram) return;

    try {
      // Uppdatera programmet
      const updatedProgram = { ...selectedProgram, color: newColor };
      await storage.saveAIProgram(updatedProgram);

      // Uppdatera alla scheduled activities som tillhör programmet
      const programActivities = scheduled.filter(a => a.programId === selectedProgram.id);
      for (const activity of programActivities) {
        await storage.updateScheduledActivity(activity.id, { color: newColor });
      }

      // Uppdatera local state
      setSelectedProgram(updatedProgram);
      setShowColorPicker(false);
      onUpdate();
      loadData();
    } catch (error) {
      console.error('Failed to update program color:', error);
    }
  };

  const handleStartGenerating = (origin: 'programs' | 'exercises' | 'articles' = 'programs') => {
    onAIStartGenerating(origin);
    if (origin === 'programs') {
      setShowGenerator(false);
    }
  };

  const handleGenerationComplete = (data?: { plan: AIPlanResponse; query: string; config: any }) => {
    if (data) {
      setGeneratedPlanData(data);
    }
    onAIGenerationComplete();
  };

  // När bubblan klickas och vi kommer tillbaka, kolla om vi ska öppna generator
  useEffect(() => {
    if (activeTab === 'programs' && bubbleOrigin === 'programs' && generatedPlanData && !showGenerator) {
      setShowGenerator(true);
    }
  }, [activeTab, bubbleOrigin, generatedPlanData, showGenerator]);

  if (showGenerator) {
    return (
        <div>
            <button onClick={() => { setShowGenerator(false); setGeneratedPlanData(null); }} className="px-4 py-4 text-text-dim flex items-center gap-2 font-bold text-xs uppercase hover:text-white transition-colors">
                <ArrowLeft size={16} /> Avbryt
            </button>
            <AIArchitect
              onClose={() => {
                setShowGenerator(false);
                setGeneratedPlanData(null);
                onUpdate();
              }}
              onStartGenerating={handleStartGenerating}
              onGenerationComplete={handleGenerationComplete}
              initialPlanData={generatedPlanData}
            />
        </div>
    );
  }

  if (selectedProgram) {
    const programActivities = scheduled
        .filter(r => r.programId === selectedProgram.id)
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const todayStr = new Date().toISOString().split('T')[0];
    const cancelledActivities = programActivities.filter(a => a.isCancelled);
    const completedActivities = programActivities.filter(a => !a.isCancelled && (a.isCompleted || (a.date < todayStr && a.linkedSessionId)));
    const upcomingActivities = programActivities.filter(a => !a.isCancelled && !completedActivities.some(c => c.id === a.id));

    return (
      <div className="pb-24 pt-8 px-4 space-y-6 animate-in fade-in">
        {programToDelete && (
            <ConfirmModal
                title="Radera Program?"
                message="Är du säker? Detta tar bort programmet, alla kommande pass och kopplade mål permanent."
                confirmLabel="Ja, Radera"
                isDestructive={true}
                onConfirm={confirmDeleteProgram}
                onCancel={() => setProgramToDelete(null)}
            />
        )}

        {showColorPicker && (
          <div className="fixed inset-0 z-[200] bg-[#0f0d15]/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-[#1a1721] w-full max-w-sm rounded-[40px] border border-white/10 shadow-2xl p-8 animate-in zoom-in-95">
              <h3 className="text-2xl font-black italic uppercase text-white tracking-tighter mb-6">Välj Färg</h3>
              <ColorPicker
                selectedColor={selectedProgram?.color || '#1a1721'}
                onSelectColor={handleUpdateProgramColor}
              />
              <button
                onClick={() => setShowColorPicker(false)}
                className="w-full mt-6 py-4 bg-white/5 text-white rounded-2xl font-bold uppercase hover:bg-white/10 transition-all"
              >
                Stäng
              </button>
            </div>
          </div>
        )}
        {viewingActivity && (
            <WorkoutDetailsModal 
                activity={viewingActivity}
                allExercises={allExercises}
                onClose={() => setViewingActivity(null)} 
                onStart={handleStartActivity} 
                onUpdate={onUpdate}
            />
        )}
        
        {showNextPhaseModal && (
          <NextPhaseModal 
            program={selectedProgram}
            history={history}
            allExercises={allExercises}
            scheduled={scheduled}
            onClose={() => setShowNextPhaseModal(false)}
            onGenerated={() => {
              setShowNextPhaseModal(false);
              onUpdate();
            }}
          />
        )}

        <div className="flex items-center justify-between">
            <button onClick={() => setSelectedProgram(null)} className="text-text-dim hover:text-white flex items-center gap-1 bg-white/5 px-3 py-2 rounded-xl text-xs font-bold uppercase transition-colors">
                <ArrowLeft size={16}/> Tillbaka
            </button>
            <div className="flex gap-2">
              <button onClick={() => setShowColorPicker(true)} className="p-3 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-colors">
                  <Palette size={20} />
              </button>
              <button onClick={() => handleDeleteRequest(selectedProgram)} className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors">
                  <Trash2 size={20} />
              </button>
            </div>
        </div>

        <div className="bg-gradient-to-br from-[#1a1721] to-[#2a2435] p-6 rounded-[32px] border border-accent-blue/20 shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-2xl font-black italic uppercase text-white leading-none pr-4">{selectedProgram.name}</h2>
              <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full tracking-widest border bg-accent-blue/10 text-accent-blue border-accent-blue/20`}>Aktiv</span>
            </div>
            <p className="text-sm text-text-dim italic border-l-2 border-accent-blue pl-3 mb-4 leading-relaxed">"{selectedProgram.motivation}"</p>
            {selectedProgram.status === 'active' && (
                <div className="flex gap-3 mt-4">
                    <button 
                      onClick={() => setShowNextPhaseModal(true)} 
                      className="flex-1 bg-[#2ed573] hover:bg-white text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-green-500/20"
                    >
                        <PlusCircle size={16} strokeWidth={3} /> Nästa Fas
                    </button>
                </div>
            )}
        </div>

        {upcomingActivities.length > 0 && (
            <div className="space-y-3">
                <h3 className="text-white font-black text-xs uppercase tracking-[0.2em] flex items-center gap-2 border-b border-white/5 pb-3">
                    <Circle size={12} className="text-accent-blue fill-current"/> Kommande Pass
                </h3>
                {upcomingActivities.map(activity => (
                    <div key={activity.id} onClick={() => setViewingActivity(activity)} className="bg-[#1a1721] p-5 rounded-[28px] border border-white/5 hover:border-accent-blue/50 transition-all cursor-pointer flex justify-between items-center group shadow-sm active:scale-[0.98]">
                        <div>
                            <span className="text-white font-black italic uppercase text-sm block group-hover:text-accent-blue transition-colors leading-tight">{activity.title}</span>
                            <div className="text-[10px] text-text-dim font-bold uppercase tracking-widest flex gap-3 mt-1.5 opacity-60"><span className="flex items-center gap-1"><Calendar size={10}/> {activity.date}</span><span>{activity.exercises?.length} övningar</span></div>
                        </div>
                        <ChevronRight className="text-white/20 group-hover:text-white" size={20} />
                    </div>
                ))}
            </div>
        )}

        {completedActivities.length > 0 && (
            <div className="space-y-3 opacity-60">
                <h3 className="text-text-dim font-black text-xs uppercase tracking-[0.2em] flex items-center gap-2 mt-8 border-b border-white/5 pb-3">
                    <CheckCircle2 size={12}/> Avklarat ({completedActivities.length})
                </h3>
                {completedActivities.slice().reverse().map(activity => (
                    <div key={activity.id} className="bg-green-500/5 p-5 rounded-[28px] border border-green-500/10 flex justify-between items-center">
                        <div>
                            <span className="text-green-400 font-black italic uppercase text-sm block line-through">{activity.title}</span>
                            <div className="text-[10px] text-green-400/50 font-bold uppercase tracking-widest flex gap-3 mt-1.5"><span className="flex items-center gap-1"><Calendar size={10}/> {activity.date}</span><span>{activity.exercises?.length} övningar</span></div>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {cancelledActivities.length > 0 && (
            <div className="space-y-3 opacity-40">
                <h3 className="text-text-dim font-black text-xs uppercase tracking-[0.2em] flex items-center gap-2 mt-8 border-b border-white/5 pb-3">
                    <XCircle size={12}/> Avbrutet ({cancelledActivities.length})
                </h3>
                {cancelledActivities.slice().reverse().map(activity => (
                    <div key={activity.id} className="bg-red-500/5 p-5 rounded-[28px] border border-red-500/10 flex justify-between items-center">
                        <div>
                            <span className="text-red-400 font-black italic uppercase text-sm block line-through">{activity.title}</span>
                            <div className="text-[10px] text-red-400/50 font-bold uppercase tracking-widest flex gap-3 mt-1.5"><span className="flex items-center gap-1"><Calendar size={10}/> {activity.date}</span><span>{activity.exercises?.length} övningar</span></div>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    );
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'programs':
        return (
          <>
            {programs.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-white/5 rounded-[40px] bg-[#1a1721]/30">
                    <div className="relative inline-block mb-6">
                      <Sparkles size={48} className="text-accent-blue animate-pulse"/>
                      <div className="absolute inset-0 bg-accent-blue/10 blur-2xl rounded-full" />
                    </div>
                    <p className="text-text-dim font-bold text-sm mb-6 max-w-[200px] mx-auto uppercase tracking-widest leading-relaxed">Inga aktiva planeringsfasen ännu.</p>
                    <button onClick={() => setShowGenerator(true)} className="text-accent-blue font-black uppercase text-xs tracking-[0.2em] hover:brightness-125 border-b-2 border-accent-blue/20 pb-1">Starta Arkitekten</button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {programs.filter(p => p.status !== 'cancelled').sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(p => (
                        <button key={p.id} onClick={() => setSelectedProgram(p)} className="bg-[#1a1721] p-6 rounded-[32px] border border-white/5 text-left group hover:border-accent-blue/40 transition-all relative overflow-hidden shadow-xl active:scale-[0.98]">
                            <div className="flex justify-between items-start mb-3 relative z-10">
                                <h3 className="text-xl font-black italic uppercase text-white group-hover:text-accent-blue transition-colors leading-tight pr-4">{p.name}</h3>
                                <span className={`text-[8px] font-black uppercase px-2.5 py-1 rounded-full tracking-widest border ${p.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-white/5 text-text-dim border-white/10'}`}>{p.status === 'active' ? 'Pågående' : 'Avslutad'}</span>
                            </div>
                            <p className="text-xs text-text-dim line-clamp-2 mb-5 relative z-10 leading-relaxed italic opacity-80">"{p.motivation}"</p>
                            <div className="flex items-center gap-2 text-[9px] text-accent-blue font-black uppercase tracking-[0.2em] relative z-10 group-hover:translate-x-1 transition-transform"><Activity size={12} strokeWidth={3} /> Se utveckling</div>
                            
                            <div className="absolute -bottom-6 -right-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity rotate-12">
                                <Sparkles size={120} />
                            </div>
                        </button>
                    ))}

                    <button
                        onClick={() => setShowGenerator(true)}
                        className="w-full bg-[#1a1721] border-2 border-dashed border-white/10 p-8 rounded-[32px] flex flex-col items-center justify-center gap-3 text-text-dim hover:text-white hover:border-accent-blue/30 hover:bg-accent-blue/5 transition-all group mt-2"
                    >
                        <div className="bg-white/5 p-4 rounded-2xl group-hover:bg-accent-blue/20 transition-colors shadow-inner">
                            <PlusCircle size={28} className="group-hover:text-accent-blue" strokeWidth={3} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Nytt Program</span>
                    </button>
                </div>
            )}

            {/* Program History Section */}
            {programHistory.length > 0 && (
              <div className="mt-8">
                <div className="bg-[#1a1721] p-6 rounded-3xl border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                      <History size={12} /> Historik ({programHistory.length})
                    </h3>
                    <button
                      onClick={clearProgramHistory}
                      className="text-red-400 hover:text-red-300 text-[10px] uppercase tracking-widest font-bold flex items-center gap-1 transition-colors"
                    >
                      <Trash2 size={12} /> Rensa
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {programHistory.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => loadFromProgramHistory(item)}
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
              </div>
            )}
          </>
        );
      case 'exercises':
        return (
          <AIExerciseRecommender
            allExercises={allExercises}
            history={history}
            onUpdate={onUpdate}
            onEditExercise={onGoToExercise}
            onStartSession={onStartSession}
            onStartGenerating={() => handleStartGenerating('exercises')}
            onGenerationComplete={() => handleGenerationComplete()}
          />
        );
      case 'articles':
        return userProfile && (
            <AIArticleGenerator
                history={history}
                biometricLogs={biometricLogs}
                userProfile={userProfile}
                userMissions={userMissions}
                aiPrograms={programs}
                allExercises={allExercises}
                onStartGenerating={() => handleStartGenerating('articles')}
                onGenerationComplete={() => handleGenerationComplete()}
            />
        );
      default:
        return null;
    }
  };

  return (
    <div className="pb-24 pt-8 px-4 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-5">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter">AI PT</h2>
            {activeTab === 'programs' && (
                <button onClick={() => setShowGenerator(true)} className="bg-accent-blue text-black p-3.5 rounded-full hover:bg-white transition-all shadow-lg shadow-accent-blue/30 active:scale-90">
                    <Plus size={24} strokeWidth={3} />
                </button>
            )}
          </div>

          <div className="flex bg-[#1a1721] p-1.5 rounded-2xl border border-white/5 shadow-inner">
              <button onClick={() => setActiveTab('programs')} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all ${activeTab === 'programs' ? 'bg-white text-black shadow-lg' : 'text-text-dim hover:text-white'}`}><List size={16} strokeWidth={3} /> Program</button>
              <button onClick={() => setActiveTab('exercises')} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all ${activeTab === 'exercises' ? 'bg-white text-black shadow-lg' : 'text-text-dim hover:text-white'}`}><Dumbbell size={16} strokeWidth={3} /> Scout</button>
              <button onClick={() => setActiveTab('articles')} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all ${activeTab === 'articles' ? 'bg-white text-black shadow-lg' : 'text-text-dim hover:text-white'}`}><BookOpen size={16} strokeWidth={3} /> Artiklar</button>
          </div>
      </div>
      
      <div className="animate-in fade-in duration-300">
        {renderActiveTab()}
      </div>
    </div>
  );
};
