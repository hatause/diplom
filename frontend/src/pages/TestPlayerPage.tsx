import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '@/api/client';
import { errorText } from '@/api/companion';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Clock, Flag, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function TestPlayerPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [test, setTest] = useState<any>(location.state?.test || null);
  const [ready, setReady] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeSpent, setTimeSpent] = useState<Record<string, number>>({});
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const questionStartRef = useRef(Date.now());

  // Timer
  useEffect(() => {
    if (!ready || submitting) return;
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timer);
  }, [ready, submitting]);

  // Always restore the attempt, even when navigation supplies test metadata.
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    if (attemptId) {
      api.get(`/attempts/${attemptId}`).then(res => {
        if (cancelled) return;
        const attempt = res.data.data;
        if (attempt.status === 'COMPLETED') {
          navigate(`/test/${attemptId}/result`, { replace: true });
          return;
        }
        if (attempt.status !== 'IN_PROGRESS') {
          toast.error('Эта попытка отменена. Начните новый тест.');
          navigate('/history', { replace: true });
          return;
        }
        setTest(attempt.test);
        const saved = attempt.savedProgress;
        setAnswers(saved?.answers || {});
        setTimeSpent(saved?.timeSpent || {});
        setElapsed(Math.max(0, saved?.elapsed || 0));
        setCurrentIdx(Math.min(Math.max(0, saved?.currentIdx || 0), Math.max(0, attempt.test.questions.length - 1)));
        questionStartRef.current = Date.now();
        setReady(true);
      }).catch((err) => {
        if (cancelled) return;
        toast.error(errorText(err));
        navigate('/dashboard');
      });
    }
    return () => { cancelled = true; };
  }, [attemptId, navigate]);

  const progressRef = useRef({ answers, currentIdx, elapsed, timeSpent, test });
  progressRef.current = { answers, currentIdx, elapsed, timeSpent, test };

  // Keep one interval; answering a question must not restart the save countdown.
  useEffect(() => {
    if (!attemptId || !ready || submitting) return;
    const interval = setInterval(() => {
      const snapshot = progressRef.current;
      const times = { ...snapshot.timeSpent };
      const questionId = snapshot.test?.questions?.[snapshot.currentIdx]?.id;
      if (questionId) times[questionId] = (times[questionId] || 0) + Math.round((Date.now() - questionStartRef.current) / 1000);
      api.put(`/tests/${attemptId}/progress`, {
        answers: snapshot.answers, currentIdx: snapshot.currentIdx,
        elapsed: snapshot.elapsed, timeSpent: times,
      }).catch(() => toast.error('Не удалось сохранить прогресс. Проверьте соединение.', { id: 'test-autosave' }));
    }, 30000);
    return () => clearInterval(interval);
  }, [attemptId, ready, submitting]);

  // Track time per question
  useEffect(() => {
    questionStartRef.current = Date.now();
  }, [currentIdx]);

  const recordQuestionTime = useCallback(() => {
    const next = { ...timeSpent };
    const questionId = test?.questions?.[currentIdx]?.id;
    if (questionId) {
      const now = Date.now();
      next[questionId] = (next[questionId] || 0) + Math.round((now - questionStartRef.current) / 1000);
      questionStartRef.current = now;
      setTimeSpent(next);
    }
    return next;
  }, [currentIdx, test, timeSpent]);

  if (!test || !ready) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--border-subtle)', borderTopColor: 'var(--accent-1)' }} /></div>;

  const questions = test.questions || [];
  const current = questions[currentIdx];
  const totalQuestions = questions.length;
  const answeredCount = questions.filter((q: any) => {
    const value = answers[q.id];
    return Array.isArray(value) ? value.length > 0 : typeof value === 'string' ? value.trim().length > 0 : value != null;
  }).length;
  const progress = totalQuestions ? (answeredCount / totalQuestions) * 100 : 0;
  if (!current) return <p role="alert">В этом тесте нет вопросов.</p>;

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const setAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const goNext = () => { recordQuestionTime(); if (currentIdx < totalQuestions - 1) setCurrentIdx(i => i + 1); };
  const goPrev = () => { recordQuestionTime(); if (currentIdx > 0) setCurrentIdx(i => i - 1); };

  const handleSubmit = async () => {
    if (submitting) return;
    const finalTimes = recordQuestionTime();
    setSubmitting(true);
    try {
      const answerPayload = questions.map((q: any) => ({
        questionId: q.id,
        userAnswer: answers[q.id] ?? null,
        timeSpent: finalTimes[q.id] || 0,
      }));
      await api.post(`/tests/${attemptId}/submit`, { answers: answerPayload, totalTime: elapsed });
      toast.success('Тест завершён!');
      navigate(`/test/${attemptId}/result`);
    } catch (err: any) {
      toast.error(errorText(err));
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="glass-card p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{test.title}</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Вопрос {currentIdx + 1} из {totalQuestions}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
            <Clock size={16} /> {formatTime(elapsed)}
          </span>
          <button onClick={() => setShowConfirm(true)}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--accent-gradient)' }}>
            <Flag size={14} className="inline mr-1" /> Завершить
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
        <motion.div className="h-full rounded-full" style={{ background: 'var(--accent-gradient)' }}
          animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
      </div>

      {/* Question navigation dots */}
      <div className="flex flex-wrap gap-1.5 justify-center">
        {questions.map((_: any, i: number) => (
          <button key={i} onClick={() => { recordQuestionTime(); setCurrentIdx(i); }}
            className="w-8 h-8 rounded-lg text-xs font-medium transition-all"
            style={{
              background: i === currentIdx ? 'var(--accent)' : answers[questions[i].id] !== undefined ? 'var(--accent-bg)' : 'var(--bg-secondary)',
              color: i === currentIdx ? 'white' : answers[questions[i].id] !== undefined ? 'var(--accent)' : 'var(--text-tertiary)',
            }}>
            {i + 1}
          </button>
        ))}
      </div>

      {/* Question card */}
      <AnimatePresence mode="wait">
        <motion.div key={currentIdx} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }}
          className="glass-card p-6">
          <div className="flex items-start gap-3 mb-6">
            <span className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: 'var(--accent-bg)', color: 'var(--accent-1)' }}>
              {currentIdx + 1}
            </span>
            <p className="text-base font-medium leading-relaxed" style={{ color: 'var(--text-primary)' }}>{current?.question}</p>
          </div>

          {/* Answer options */}
          {(current?.type === 'single_choice' || current?.type === 'true_false') && (
            <div className="space-y-2">
              {(current.type === 'true_false' ? ['true', 'false'] : (current.options as string[] || [])).map((opt: string, i: number) => (
                <button key={i} onClick={() => setAnswer(current.id, opt)}
                  className="w-full p-4 rounded-xl text-left text-sm transition-all flex items-center gap-3"
                  style={{
                    background: answers[current.id] === opt ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                    border: answers[current.id] === opt ? '2px solid var(--accent)' : '2px solid transparent',
                    color: 'var(--text-primary)',
                  }}>
                  <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: answers[current.id] === opt ? 'var(--accent)' : 'var(--border-default)' }}>
                    {answers[current.id] === opt && <span className="w-3 h-3 rounded-full" style={{ background: 'var(--accent-gradient)' }} />}
                  </span>
                  {current.type === 'true_false' ? (opt === 'true' ? 'Верно' : 'Неверно') : opt}
                </button>
              ))}
            </div>
          )}

          {current?.type === 'multiple_choice' && (
            <div className="space-y-2">
              {(current.options as string[] || []).map((opt: string, i: number) => {
                const selected = Array.isArray(answers[current.id]) && answers[current.id].includes(opt);
                return (
                  <button key={i} onClick={() => {
                    const current_answers = Array.isArray(answers[current.id]) ? [...answers[current.id]] : [];
                    setAnswer(current.id, selected ? current_answers.filter((a: string) => a !== opt) : [...current_answers, opt]);
                  }}
                    className="w-full p-4 rounded-xl text-left text-sm transition-all flex items-center gap-3"
                    style={{
                      background: selected ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                      border: selected ? '2px solid var(--accent)' : '2px solid transparent',
                      color: 'var(--text-primary)',
                    }}>
                    <span className="w-6 h-6 rounded border-2 flex items-center justify-center shrink-0"
                      style={{ borderColor: selected ? 'var(--accent)' : 'var(--border-default)', borderRadius: '4px' }}>
                      {selected && <span className="text-xs font-bold" style={{ color: 'var(--accent-1)' }}>✓</span>}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {current?.type === 'short_answer' && (
            <input type="text" value={answers[current.id] || ''} onChange={e => setAnswer(current.id, e.target.value)}
              placeholder="Введите ответ..."
              className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={goPrev} disabled={currentIdx === 0}
          className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-30 transition-all"
          style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
          <ChevronLeft size={18} /> Назад
        </button>
        <button onClick={goNext} disabled={currentIdx === totalQuestions - 1}
          className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-30 transition-all"
          style={{ background: 'var(--accent-gradient)', color: 'white' }}>
          Далее <ChevronRight size={18} />
        </button>
      </div>

      {/* Confirm dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowConfirm(false)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-strong p-6 rounded-2xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <AlertTriangle size={32} className="mx-auto mb-3" style={{ color: '#F59E0B' }} />
            <h3 className="text-lg font-bold text-center mb-2" style={{ color: 'var(--text-primary)' }}>Завершить тест?</h3>
            <p className="text-sm text-center mb-4" style={{ color: 'var(--text-secondary)' }}>
              Отвечено: {answeredCount} из {totalQuestions}. Пропущенные будут засчитаны как неправильные.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Отмена</button>
              <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--accent-gradient)' }}>
                {submitting ? 'Отправка...' : 'Завершить'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
