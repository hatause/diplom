import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { motion } from 'framer-motion';
import { RefreshCcw, Brain, Clock, AlertCircle } from 'lucide-react';

export function ReviewPage() {
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/review').then(res => { setTopics(res.data.data || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <RefreshCcw size={28} style={{ color: 'var(--accent-1)' }} /> Повторение
      </h1>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Темы, которые нужно повторить на основе интервального повторения</p>

      {loading ? <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div> :
        topics.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <RefreshCcw size={48} className="mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Нет тем для повторения</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>Все темы в порядке!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topics.map((tp, i) => (
              <motion.div key={tp.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="glass-card p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${tp.subjectColor || '#10B981'}20` }}>
                  {tp.isOverdue ? <AlertCircle size={20} style={{ color: '#EF4444' }} /> : <Clock size={20} style={{ color: tp.subjectColor || '#10B981' }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{tp.topicName}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{tp.subjectName} • {tp.masteryLevel} ({tp.masteryScore}%)</p>
                  {tp.lastStudiedAt && <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Последнее изучение: {new Date(tp.lastStudiedAt).toLocaleDateString('ru-RU')}</p>}
                </div>
                <Link to={`/test/generate?subjectId=${tp.subjectId}`} className="px-4 py-2 rounded-xl text-xs font-medium text-white shrink-0" style={{ background: 'var(--accent-gradient)' }}>
                  <Brain size={14} className="inline mr-1" /> Повторить
                </Link>
              </motion.div>
            ))}
          </div>
        )}
    </div>
  );
}
