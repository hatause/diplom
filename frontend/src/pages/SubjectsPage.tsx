import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { motion } from 'framer-motion';
import { BookOpen, Brain, TrendingUp, AlertTriangle } from 'lucide-react';

export function SubjectsPage() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/subjects').then(res => { setSubjects(res.data.data || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Предметы</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{subjects.length} предметов</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {subjects.map((sub, i) => (
          <motion.div key={sub.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <div className="glass-card p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${sub.color || '#10B981'}20` }}>
                  <BookOpen size={22} style={{ color: sub.color || '#10B981' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{sub.name}</h3>
                  {sub.teacher && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{sub.teacher}</p>}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold" style={{ color: sub.avgScore >= 70 ? '#10B981' : sub.avgScore >= 50 ? '#F59E0B' : 'var(--text-tertiary)' }}>
                    {sub.avgScore > 0 ? `${sub.avgScore}%` : '—'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>средний балл</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: 'var(--text-tertiary)' }}>Прогресс</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{sub.mastery}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${sub.mastery}%`, background: `linear-gradient(90deg, ${sub.color || '#10B981'}, ${sub.color || '#10B981'}80)` }} />
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-4 text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
                <span className="flex items-center gap-1"><TrendingUp size={14} /> {sub.attemptsCount} тестов</span>
                <span>{sub.topicCount} тем</span>
                {sub.lastActivity && <span>Последнее: {new Date(sub.lastActivity).toLocaleDateString('ru-RU')}</span>}
              </div>

              {/* Weak topics */}
              {sub.weakTopics?.length > 0 && (
                <div className="mb-4 p-3 rounded-xl" style={{ background: '#EF444410' }}>
                  <p className="text-xs font-medium flex items-center gap-1 mb-1" style={{ color: '#EF4444' }}>
                    <AlertTriangle size={12} /> Слабые темы
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {sub.weakTopics.map((t: any) => `${t.name} (${t.score}%)`).join(', ')}
                  </p>
                </div>
              )}

              <Link
                to={`/test/generate?subjectId=${sub.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
                style={{ background: `linear-gradient(135deg, ${sub.color || '#7C3AED'}, ${sub.color || '#06B6D4'}80)` }}
              >
                <Brain size={16} /> Создать тест
              </Link>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
