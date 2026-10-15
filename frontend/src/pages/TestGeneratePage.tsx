import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import { errorText } from '@/api/companion';
import { motion } from 'framer-motion';
import { Brain, Loader2, Sparkles, ChevronDown, Zap, CheckCircle2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const difficulties = [
  { value: 'easy', label: 'Лёгкий', emoji: '🌱', desc: 'Базовые понятия' },
  { value: 'medium', label: 'Средний', emoji: '⚡', desc: 'Практическое применение' },
  { value: 'hard', label: 'Сложный', emoji: '🔥', desc: 'Глубокий анализ' },
  { value: 'expert', label: 'Эксперт', emoji: '💎', desc: 'Олимпиадный уровень' },
];

const questionTypes = [
  { value: 'single_choice', label: 'Один ответ', icon: '○' },
  { value: 'multiple_choice', label: 'Несколько ответов', icon: '☐' },
  { value: 'true_false', label: 'Верно / Неверно', icon: '⇋' },
  { value: 'short_answer', label: 'Краткий ответ', icon: '✎' },
];

export function TestGeneratePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preSelectedSubject = searchParams.get('subjectId') || '';

  const [subjects, setSubjects] = useState<any[]>([]);
  const [form, setForm] = useState({
    subjectId: preSelectedSubject,
    topic: searchParams.get('topic') || '',
    difficulty: 'medium',
    questionCount: 10,
    questionTypes: ['single_choice'] as string[],
  });
  const [generating, setGenerating] = useState(false);
  const [generatedTest, setGeneratedTest] = useState<any>(null);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);

  useEffect(() => {
    api.get('/subjects').then(res => {
      const subs = res.data.data || [];
      setSubjects(subs);
      if (preSelectedSubject) {
        setSelectedSubject(subs.find((s: any) => s.id === preSelectedSubject));
      }
    }).catch(e => toast.error(errorText(e)));
  }, []);

  useEffect(() => {
    setSelectedSubject(subjects.find(s => s.id === form.subjectId) || null);
  }, [form.subjectId, subjects]);

  useEffect(() => { setGeneratedTest(null); }, [form]);

  const handleGenerate = async () => {
    if (generating) return;
    if (!form.subjectId) { toast.error('Выберите предмет'); return; }
    if (form.questionTypes.length === 0) { toast.error('Выберите хотя бы один тип вопросов'); return; }
    setGenerating(true);
    try {
      const test = generatedTest || (await api.post('/tests/generate', form)).data.data;
      setGeneratedTest(test);
      const { data: attemptRes } = await api.post(`/tests/${test.id}/start`);
      const attempt = attemptRes.data;
      toast.success('Тест сгенерирован!');
      navigate(`/test/${attempt.id}/play`, { state: { test } });
    } catch (err: any) {
      toast.error(errorText(err));
    } finally {
      setGenerating(false);
    }
  };

  const toggleType = (type: string) => {
    setForm(f => ({
      ...f,
      questionTypes: f.questionTypes.includes(type)
        ? f.questionTypes.filter(t => t !== type)
        : [...f.questionTypes, type],
    }));
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 28 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <div className="animate-glow" style={{
            width: 48, height: 48, borderRadius: 16, background: 'var(--accent-gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
          }}>
            <Brain size={24} />
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              Создать тест
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500 }}>
              AI создаст персонализированные вопросы по вашим слабым местам
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card"
        style={{ padding: '32px', borderRadius: 'var(--radius-xl)' }}
      >
        <fieldset disabled={generating} className="min-w-0">
        <legend className="sr-only">Параметры теста</legend>
        {/* Subject */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Предмет <span style={{ color: 'var(--error)' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <select
              value={form.subjectId}
              onChange={e => setForm(f => ({ ...f, subjectId: e.target.value, topic: '' }))}
              className="input-glass"
              style={{ paddingRight: 40, appearance: 'none', cursor: 'pointer' }}
            >
              <option value="">Выберите предмет</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <ChevronDown size={16} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
          </div>
        </div>

        {/* Topic */}
        {selectedSubject?.topics?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            style={{ marginBottom: 24 }}
          >
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Тема</label>
            <div style={{ position: 'relative' }}>
              <select value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} className="input-glass" style={{ paddingRight: 40, appearance: 'none', cursor: 'pointer' }}>
                <option value="">Все темы (смешанный)</option>
                {selectedSubject.topics.map((t: any) => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
              <ChevronDown size={16} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
            </div>
          </motion.div>
        )}

        {/* Difficulty */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>Сложность</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {difficulties.map(d => {
              const active = form.difficulty === d.value;
              return (
                <motion.button
                  key={d.value}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setForm(f => ({ ...f, difficulty: d.value }))}
                  style={{
                    padding: '14px 10px', borderRadius: 16, textAlign: 'center',
                    background: active ? 'var(--accent-bg)' : 'var(--bg-input)',
                    border: active ? '2px solid var(--accent-1)' : '2px solid var(--border-default)',
                    cursor: 'pointer', transition: 'all 0.25s',
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{d.emoji}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--text-accent)' : 'var(--text-primary)' }}>{d.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{d.desc}</div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Question count */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>Количество вопросов</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[5, 10, 15, 20, 30].map(n => {
              const active = form.questionCount === n;
              return (
                <motion.button
                  key={n}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setForm(f => ({ ...f, questionCount: n }))}
                  style={{
                    padding: '10px 20px', borderRadius: 14,
                    fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-heading)',
                    background: active ? 'var(--accent-gradient)' : 'var(--bg-input)',
                    color: active ? 'white' : 'var(--text-secondary)',
                    border: active ? 'none' : '1.5px solid var(--border-default)',
                    cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: active ? '0 4px 16px rgba(124,58,237,0.25)' : 'none',
                  }}
                >
                  {n}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Question types */}
        <div style={{ marginBottom: 32 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>Типы вопросов</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {questionTypes.map(t => {
              const active = form.questionTypes.includes(t.value);
              return (
                <motion.button
                  key={t.value}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => toggleType(t.value)}
                  style={{
                    padding: '14px 16px', borderRadius: 14,
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: active ? 'var(--accent-bg)' : 'var(--bg-input)',
                    border: active ? '2px solid var(--accent-1)' : '2px solid var(--border-default)',
                    cursor: 'pointer', transition: 'all 0.25s', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 18, opacity: 0.7, width: 24, textAlign: 'center' }}>{t.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: active ? 'var(--text-accent)' : 'var(--text-secondary)' }}>
                    {t.label}
                  </span>
                  {active && <CheckCircle2 size={16} style={{ marginLeft: 'auto', color: 'var(--accent-1)' }} />}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Generate */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleGenerate}
          disabled={generating || !form.subjectId || form.questionTypes.length === 0}
          className="btn-gradient"
          style={{
            width: '100%', padding: '16px 24px', borderRadius: 18,
            fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            opacity: (generating || !form.subjectId || form.questionTypes.length === 0) ? 0.6 : 1,
          }}
        >
          {generating ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              <span>{generatedTest ? 'Открываем тест...' : 'AI генерирует тест...'}</span>
              <Zap size={16} className="animate-float" />
            </>
          ) : (
            <>
              <Sparkles size={20} />
              {generatedTest ? 'Открыть готовый тест' : 'Сгенерировать тест'}
              <ArrowRight size={16} style={{ marginLeft: 4 }} />
            </>
          )}
        </motion.button>
        </fieldset>
      </motion.div>
    </div>
  );
}
