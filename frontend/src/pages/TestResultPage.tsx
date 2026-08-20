import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '@/api/client';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, MinusCircle, Clock, Brain, ArrowRight, Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

export function TestResultPage() {
  const { attemptId } = useParams();
  const [result, setResult] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!attemptId) return;
    api.get(`/attempts/${attemptId}/result`).then(res => {
      setResult(res.data.data);
      if (res.data.data.aiAnalysis) setAnalysis(res.data.data.aiAnalysis);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [attemptId]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await api.post('/ai/analyze-result', { attemptId });
      setAnalysis(res.data.data);
      toast.success('AI анализ готов!');
    } catch { toast.error('Ошибка AI анализа'); }
    finally { setAnalyzing(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--border-subtle)', borderTopColor: 'var(--accent-1)' }} /></div>;
  if (!result) return <div className="text-center py-20" style={{ color: 'var(--text-tertiary)' }}>Результат не найден</div>;

  const scoreColor = (result.percentage || 0) >= 80 ? '#10B981' : (result.percentage || 0) >= 50 ? '#F59E0B' : '#EF4444';
  const formatTime = (s: number) => s >= 60 ? `${Math.floor(s / 60)}м ${s % 60}с` : `${s}с`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Score hero */}
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card p-8 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }}
          className="inline-flex items-center justify-center w-32 h-32 rounded-full mb-4" style={{ border: `4px solid ${scoreColor}`, background: `${scoreColor}10` }}>
          <span className="text-4xl font-bold" style={{ color: scoreColor }}>{Math.round(result.percentage || 0)}%</span>
        </motion.div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{result.test?.title}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{result.test?.subject?.name} • {result.test?.difficulty}</p>

        <div className="flex items-center justify-center gap-6 mt-6">
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: '#10B981' }}>{result.correctCount}</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Правильно</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: '#EF4444' }}>{result.wrongCount}</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Ошибки</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: '#94A3B8' }}>{result.skippedCount}</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Пропущено</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold flex items-center gap-1" style={{ color: 'var(--text-primary)' }}><Clock size={16} /> {formatTime(result.totalTime || 0)}</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Время</p>
          </div>
        </div>
      </motion.div>

      {/* AI Analysis */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4" style={{ color: 'var(--text-primary)' }}>
          <Brain size={20} style={{ color: 'var(--accent-1)' }} /> AI Анализ
        </h3>
        {analysis ? (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{analysis.summary}</p>
            {analysis.strengths?.length > 0 && (
              <div><p className="text-xs font-semibold mb-1" style={{ color: '#10B981' }}>💪 Сильные стороны</p>
                <ul className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>{analysis.strengths.map((s: string, i: number) => <li key={i}>• {s}</li>)}</ul>
              </div>
            )}
            {analysis.weaknesses?.length > 0 && (
              <div><p className="text-xs font-semibold mb-1" style={{ color: '#EF4444' }}>📌 Над чем поработать</p>
                <ul className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>{analysis.weaknesses.map((w: string, i: number) => <li key={i}>• {w}</li>)}</ul>
              </div>
            )}
            {analysis.studyPlan?.length > 0 && (
              <div><p className="text-xs font-semibold mb-1" style={{ color: 'var(--accent-1)' }}>📋 План обучения</p>
                {analysis.studyPlan.map((step: any) => (
                  <div key={step.step} className="flex gap-3 p-2 rounded-lg" style={{ background: 'var(--bg-input)' }}>
                    <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--accent-bg)', color: 'var(--accent-1)' }}>{step.step}</span>
                    <div><p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{step.action}</p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {analysis.encouragement && <p className="text-sm italic p-3 rounded-xl" style={{ background: 'var(--accent-bg)', color: 'var(--accent-dark)' }}>✨ {analysis.encouragement}</p>}
          </div>
        ) : (
          <button onClick={handleAnalyze} disabled={analyzing} className="w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 text-white" style={{ background: 'var(--accent-gradient)' }}>
            {analyzing ? <><Loader2 size={18} className="animate-spin" /> Анализ...</> : <><Brain size={18} /> Получить AI анализ</>}
          </button>
        )}
      </motion.div>

      {/* Answers review */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Разбор ответов</h3>
        <div className="space-y-4">
          {(result.answers || []).map((ans: any, i: number) => (
            <div key={i} className="p-4 rounded-xl" style={{ background: 'var(--bg-input)' }}>
              <div className="flex items-start gap-3">
                {ans.isCorrect ? <CheckCircle size={20} style={{ color: '#10B981' }} className="shrink-0 mt-0.5" />
                  : ans.userAnswer === null ? <MinusCircle size={20} style={{ color: '#94A3B8' }} className="shrink-0 mt-0.5" />
                  : <XCircle size={20} style={{ color: '#EF4444' }} className="shrink-0 mt-0.5" />}
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{ans.question}</p>
                  {!ans.isCorrect && ans.userAnswer !== null && (
                    <p className="text-xs mt-1" style={{ color: '#EF4444' }}>Ваш ответ: {JSON.stringify(ans.userAnswer)}</p>
                  )}
                  {!ans.isCorrect && (
                    <p className="text-xs mt-1" style={{ color: '#10B981' }}>Правильный ответ: {JSON.stringify(ans.correctAnswer)}</p>
                  )}
                  {ans.explanation && <p className="text-xs mt-2 p-2 rounded-lg" style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>💡 {ans.explanation}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Link to="/test/generate" className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 text-white" style={{ background: 'var(--accent-gradient)' }}>
          Новый тест <ArrowRight size={16} />
        </Link>
        <Link to="/ai-tutor" className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
          <MessageSquare size={16} /> Разобрать ошибки с AI
        </Link>
        <Link to="/history" className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
          История
        </Link>
      </div>
    </div>
  );
}
