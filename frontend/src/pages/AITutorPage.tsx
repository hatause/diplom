import { useState, useRef, useEffect } from 'react';
import { api } from '@/api/client';
import { motion } from 'framer-motion';
import { MessageSquare, Send, Loader2, Bot, User, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function AITutorPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/subjects').then(res => setSubjects(res.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', {
        message: userMsg,
        subjectId: selectedSubject || undefined,
        conversationHistory: messages.slice(-10),
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.data.message }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Извините, произошла ошибка. Попробуйте позже.' }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'Объясни тему "Производные"',
    'Почему мой ответ неправильный?',
    'Дай пример интеграла',
    'Подготовь меня к экзамену',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <MessageSquare size={28} style={{ color: 'var(--accent-1)' }} /> AI Тьютор
        </h1>
        <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
          <option value="">Все предметы</option>
          {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--accent-bg)' }}>
              <Sparkles size={28} style={{ color: 'var(--accent-1)' }} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Здравствуйте! Я AI Тьютор</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>Задайте вопрос по вашим предметам</p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map(s => (
                <button key={s} onClick={() => { setInput(s); }} className="px-3 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
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
          ))
        )}
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

      {/* Input */}
      <div className="glass-card p-3 flex gap-3">
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Задайте вопрос..."
          className="flex-1 px-4 py-3 rounded-xl text-sm outline-none" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
        <button onClick={send} disabled={!input.trim() || loading}
          className="px-4 py-3 rounded-xl text-white disabled:opacity-50 transition-all" style={{ background: 'var(--accent-gradient)' }}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
