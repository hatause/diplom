import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { errorText } from '@/api/companion';
import { api } from '@/api/client';
import { motion } from 'framer-motion';
import { Sparkles, Send, Loader2, Bot, User, Play, CheckCircle2, ChevronRight, XCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Session {
  id: string;
  topic: string;
  status: string;
  difficulty: number;
  conversationHistory: Message[];
  assessment?: any;
}

export function FeynmanPage() {
  const [params, setParams] = useSearchParams();
  const sessionId = params.get('session');
  const [session, setSession] = useState<Session | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState('');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/subjects').then(res => setSubjects(res.data.data || [])).catch(e => toast.error(errorText(e)));
  }, []);

  useEffect(() => {
    if (!sessionId) { setSession(null); return; }
    let cancelled = false;
    setLoading(true);
    api.get(`/feynman/sessions/${sessionId}`)
      .then(res => { if (!cancelled) setSession(res.data.data); })
      .catch(e => { if (!cancelled) toast.error(errorText(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.conversationHistory]);

  const startSession = async () => {
    if (loading) return;
    if (!topic.trim()) {
      toast.error('Введите тему для объяснения');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/feynman/sessions', {
        topic: topic.trim(),
        subjectId: selectedSubject || undefined,
      });
      setSession(res.data.data);
      setParams({ session: res.data.data.id });
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setLoading(false);
    }
  };

  const sendExplanation = async () => {
    if (!input.trim() || !session || loading) return;
    const userMsg = input.trim();
    setInput('');
    setLoading(true);

    // Optimistic update
    setSession(prev => prev ? {
      ...prev,
      conversationHistory: [...prev.conversationHistory, { role: 'user', content: userMsg }]
    } : null);

    try {
      const res = await api.post(`/feynman/sessions/${session.id}/explain`, {
        explanation: userMsg,
      });
      setSession(res.data.data);
    } catch (e) {
      toast.error(errorText(e));
      setSession(session);
      setInput(userMsg);
    } finally {
      setLoading(false);
    }
  };

  const completeSession = async () => {
    if (!session || loading) return;
    setLoading(true);
    try {
      const res = await api.post(`/feynman/sessions/${session.id}/complete`);
      setSession(res.data.data);
      toast.success('Сессия завершена!');
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 max-w-lg w-full text-center"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6" style={{ background: 'var(--accent-bg)' }}>
            <Sparkles size={32} style={{ color: 'var(--accent-1)' }} />
          </div>
          <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Метод Фейнмана
          </h1>
          <p className="mb-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Лучший способ проверить свои знания — попытаться объяснить тему 10-летнему ребенку. ИИ выступит в роли любопытного ученика.
          </p>
          
          <div className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Предмет (опционально)</label>
              <select 
                value={selectedSubject} 
                onChange={e => setSelectedSubject(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none" 
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
              >
                <option value="">Все предметы</option>
                {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Тема для объяснения</label>
              <input 
                type="text" 
                value={topic} 
                onChange={e => setTopic(e.target.value)}
                placeholder="Например: Фотосинтез, Производная..."
                className="w-full px-4 py-3 rounded-xl text-sm outline-none" 
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} 
                onKeyDown={e => e.key === 'Enter' && startSession()}
              />
            </div>
            
            <button 
              onClick={startSession} 
              disabled={loading || !topic.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white transition-all disabled:opacity-50 mt-4" 
              style={{ background: 'var(--accent-gradient)' }}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
              Начать обучение
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4 bg-glass p-4 rounded-2xl border border-glass">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Sparkles size={24} style={{ color: 'var(--accent-1)' }} /> Метод Фейнмана
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Тема: {session.topic}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'var(--accent-bg)', color: 'var(--text-accent)' }}>
            Сложность: {session.difficulty}/5
          </div>
          {session.status === 'active' && (
            <button 
              onClick={completeSession}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
              style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)' }}
            >
              <CheckCircle2 size={16} /> Завершить
            </button>
          )}
        </div>
      </div>

      {session.status === 'completed' && session.assessment ? (
        <div className="flex-1 overflow-y-auto mb-4">
          <div className="glass-card p-6 border-l-4 border-green-500">
            <h2 className="text-2xl font-bold mb-2">Анализ объяснения</h2>
            <p className="text-lg mb-6" style={{ color: 'var(--text-secondary)' }}>{session.assessment.summary}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-green-500/10 p-4 rounded-xl border border-green-500/20">
                <h3 className="font-semibold text-green-600 mb-3 flex items-center gap-2"><CheckCircle2 size={18}/> Хорошо объяснено</h3>
                <ul className="space-y-2">
                  {session.assessment.understoodWell?.map((item: string, i: number) => (
                    <li key={i} className="text-sm flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0"/> {item}</li>
                  ))}
                </ul>
              </div>
              
              <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                <h3 className="font-semibold text-red-600 mb-3 flex items-center gap-2"><XCircle size={18}/> Ошибки и пробелы</h3>
                <ul className="space-y-2">
                  {(session.assessment.knowledgeGaps || []).concat(session.assessment.mistakesFound || []).map((item: string, i: number) => (
                    <li key={i} className="text-sm flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0"/> {item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-4 rounded-xl mb-6" style={{ background: 'var(--bg-input)' }}>
              <h3 className="font-semibold mb-2">Оценки:</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {Object.entries(session.assessment.scores || {}).map(([key, val]) => (
                  <div key={key}>
                    <div className="text-xs text-gray-500 mb-1">{key}</div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${val}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="italic text-center font-medium" style={{ color: 'var(--accent-1)' }}>"{session.assessment.encouragement}"</p>
            
            <div className="mt-8 text-center">
              <button 
                onClick={() => { setSession(null); setParams({}); }}
                className="px-6 py-3 rounded-xl font-semibold text-white"
                style={{ background: 'var(--accent-gradient)' }}
              >
                Новая сессия
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pb-4">
            {session.conversationHistory.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--accent-bg)' }}>
                    <Bot size={16} style={{ color: 'var(--accent-1)' }} />
                  </div>
                )}
                <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${msg.role === 'user' ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                  style={{
                    background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-card)',
                    color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                    border: msg.role === 'assistant' ? '1px solid var(--border-glass)' : 'none',
                  }}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none" style={{ color: 'var(--text-primary)' }}>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--bg-input)' }}>
                    <User size={16} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                )}
              </motion.div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-bg)' }}>
                  <Bot size={16} style={{ color: 'var(--accent-1)' }} />
                </div>
                <div className="p-4 rounded-2xl rounded-bl-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)' }}>
                  <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent-1)' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="glass-card p-3 flex gap-3">
            <input type="text" value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendExplanation()}
              placeholder="Объясните..."
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl text-sm outline-none disabled:opacity-50" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
            <button onClick={sendExplanation} disabled={!input.trim() || loading}
              className="px-4 py-3 rounded-xl text-white disabled:opacity-50 transition-all flex items-center gap-2" style={{ background: 'var(--accent-gradient)' }}>
              Ответить <Send size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
