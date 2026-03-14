
import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Loader2, Sparkles, History, Trash2, ChevronRight, 
  TrendingUp, Zap, BarChart, BrainCircuit, MessageCircleQuestion, Edit 
} from 'lucide-react';
import { generateMagazineArticle } from '../services/geminiService';
import { WorkoutSession, BiometricLog, UserProfile, UserMission, AIProgram, Exercise, MagazineTone } from '../types';
import { analyzeConsistency, calculateVolumeByMuscleGroup } from '../utils/analysis';

interface AIArticleGeneratorProps {
  history: WorkoutSession[];
  biometricLogs: BiometricLog[];
  userProfile: UserProfile;
  userMissions: UserMission[];
  aiPrograms: AIProgram[];
  allExercises: Exercise[];
}

interface MagazineArticle {
  title: string;
  ingress: string;
  statusQuo: { title: string; analysis: string; tip: string; };
  deepDive: { title: string; analysis: string; };
  mvpExercise: { title: string; name: string; reason: string; };
  quickFix: { title: string; tip: string; };
  coachsCorner: { title: string; advice: string; };
  closingQuote: string;
  interactiveQuestion: string;
}

const HISTORY_KEY = 'morphfit_magazine_history_v2';
const MAX_HISTORY = 10;

// --- Sub-components for Magazine Layout ---

const FactBox: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; color: string; }> = ({ icon, title, children, color }) => (
    <div className={`p-5 rounded-2xl border bg-gradient-to-br from-white/5 to-transparent shadow-lg`} style={{ borderColor: color }}>
        <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}20` }}>{icon}</div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color }}>{title}</h3>
        </div>
        <div className="text-sm text-white/90">{children}</div>
    </div>
);

const ArticleSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="space-y-3">
        <h2 className="text-xl font-black italic uppercase text-accent-blue border-b-2 border-accent-blue/20 pb-2">
            {title}
        </h2>
        <div className="text-sm text-white/80 leading-relaxed space-y-3">
            {children}
        </div>
    </section>
);


const ArticleRenderer: React.FC<{ article: MagazineArticle }> = ({ article }) => {
  return (
    <div className="bg-[#1a1721] p-6 rounded-[32px] border border-white/10 animate-in fade-in space-y-8">
      <header className="text-center space-y-3 border-b border-white/5 pb-6">
        <h1 className="text-4xl font-black italic uppercase text-white tracking-tighter leading-tight">{article.title}</h1>
        <p className="text-base text-text-dim italic leading-relaxed max-w-prose mx-auto">{article.ingress}</p>
      </header>

      <div className="space-y-8">
        <ArticleSection title={article.statusQuo.title}>
            <p>{article.statusQuo.analysis}</p>
            <p className="p-4 bg-black/30 border-l-4 border-accent-blue rounded-lg italic font-medium">{article.statusQuo.tip}</p>
        </ArticleSection>

        <div className="grid md:grid-cols-2 gap-4">
            <FactBox icon={<TrendingUp size={16} />} title={article.mvpExercise.title} color="#ff2d55">
                <p className="font-bold text-lg italic">{article.mvpExercise.name}</p>
                <p className="text-xs text-white/70">{article.mvpExercise.reason}</p>
            </FactBox>
            <FactBox icon={<Zap size={16} />} title={article.quickFix.title} color="#3b82f6">
                <p className="italic">{article.quickFix.tip}</p>
            </FactBox>
        </div>

        <ArticleSection title={article.deepDive.title}>
            <p>{article.deepDive.analysis}</p>
        </ArticleSection>
        
        <ArticleSection title={article.coachsCorner.title}>
            <p>{article.coachsCorner.advice}</p>
        </ArticleSection>

        <blockquote className="border-l-4 border-accent-pink pl-4 italic text-white/90 my-6 bg-accent-pink/5 py-3">
            <p>{article.closingQuote}</p>
        </blockquote>
        
        <div className="mt-8 text-center bg-white/5 p-6 rounded-2xl border border-white/10">
            <MessageCircleQuestion className="mx-auto text-accent-blue mb-3" size={24}/>
            <p className="font-bold text-accent-blue uppercase text-xs tracking-widest mb-2">Reflektera</p>
            <p className="text-sm font-medium italic text-white/80">{article.interactiveQuestion}</p>
        </div>
      </div>
    </div>
  );
};


export const AIArticleGenerator: React.FC<AIArticleGeneratorProps> = (props) => {
    const [loading, setLoading] = useState(false);
    const [article, setArticle] = useState<MagazineArticle | null>(null);
    const [history, setHistory] = useState<MagazineArticle[]>([]);
    
    useEffect(() => {
        try {
            const raw = localStorage.getItem(HISTORY_KEY);
            if (raw) setHistory(JSON.parse(raw));
        } catch (e) { console.error("Could not load article history"); }
    }, []);

    const saveToHistory = (item: MagazineArticle) => {
        const updatedHistory = [item, ...history].slice(0, MAX_HISTORY);
        setHistory(updatedHistory);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
    };
    
    const clearHistory = () => {
        if (confirm("Är du säker på att du vill radera alla sparade artiklar?")) {
            setHistory([]);
            setArticle(null);
            localStorage.removeItem(HISTORY_KEY);
        }
    };

    const handleGenerate = async () => {
        setLoading(true);
        setArticle(null);
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const recentHistory = props.history.filter(h => new Date(h.date) >= thirtyDaysAgo);
            const recentBiometrics = props.biometricLogs.filter(b => new Date(b.date) >= thirtyDaysAgo);

            const result: MagazineArticle = await generateMagazineArticle(
                recentHistory,
                recentBiometrics,
                props.userMissions,
                props.userProfile,
                props.aiPrograms,
                props.allExercises
            );
            
            setArticle(result);
            saveToHistory(result);

        } catch (error) {
            alert((error as Error).message || "Kunde inte skapa artikeln.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-br from-[#1a1721] to-[#2a2435] p-6 rounded-[32px] border border-accent-blue/20 shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-accent-blue/10 rounded-full"><Edit className="text-accent-blue" size={24} /></div>
                    <h2 className="text-xl font-black uppercase italic text-white">AI-Redaktören</h2>
                </div>
                
                <p className="text-xs text-text-dim mb-4 leading-relaxed">
                    Få en skräddarsydd artikel som analyserar din träning, progression och ger dig konkreta tips, precis som en riktig coach.
                </p>

                <button onClick={handleGenerate} disabled={loading} className="w-full bg-accent-blue hover:bg-white text-white hover:text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50 uppercase tracking-widest text-sm shadow-lg shadow-accent-blue/20">
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} strokeWidth={3} />}
                    {loading ? 'ANALYS PÅGÅR...' : 'Skapa Artikel (Senaste 30d)'}
                </button>
            </div>

            {loading && (
                <div className="text-center py-16">
                    <Loader2 className="animate-spin text-accent-blue mx-auto" size={32} />
                    <p className="text-xs text-text-dim mt-4 font-bold uppercase tracking-widest">AI:n analyserar din data...</p>
                </div>
            )}

            {article && <ArticleRenderer article={article} />}
            
            <div className="space-y-4">
                <div className="flex justify-between items-center px-2 pt-2">
                    <h3 className="text-text-dim font-black text-xs uppercase tracking-[0.2em] flex items-center gap-2">
                        <History size={14}/> Arkiv
                    </h3>
                    {history.length > 0 && (
                        <button onClick={clearHistory} className="text-[10px] text-red-400 font-black uppercase hover:text-red-300 flex items-center gap-1 transition-colors">
                            <Trash2 size={12}/> Rensa
                        </button>
                    )}
                </div>

                {history.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-[28px] opacity-30">
                        <History size={32} className="mx-auto mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Inga sparade artiklar</p>
                    </div>
                ) : (
                    history.map((item, i) => (
                        <button key={i} onClick={() => setArticle(item)} className="w-full text-left p-4 bg-[#1a1721] rounded-2xl border border-white/5 flex justify-between items-center group active:scale-95 transition-all">
                            <div>
                                <p className="text-sm font-bold text-white truncate group-hover:text-accent-blue">{item.title}</p>
                                <p className="text-[9px] text-text-dim uppercase font-bold mt-1">
                                    {new Date(item.title.includes('Artikel') ? Date.now() : item.title).toLocaleDateString('sv-SE')}
                                </p>
                            </div>
                            <ChevronRight size={18} className="text-text-dim"/>
                        </button>
                    ))
                )}
            </div>

        </div>
    );
};
