import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { errorText } from '@/api/companion';
import { ErrorNotice } from '@/components/CompanionUI';
import { motion } from 'framer-motion';
import { History, Clock, ChevronRight } from 'lucide-react';

export function HistoryPage() {
  const [attempts, setAttempts] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    api.get(`/attempts?page=${page}&status=COMPLETED`).then(res => {
      setAttempts(res.data.data.attempts || []);
      setPagination(res.data.data.pagination || {});
      setLoading(false);
    }).catch((err) => { setError(errorText(err)); setLoading(false); });
  }, [page]);

  const formatTime = (s: number) => s >= 60 ? `${Math.floor(s / 60)}м` : `${s}с`;

  if (error) return <ErrorNotice message={error} retry={() => window.location.reload()} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <History size={28} style={{ color: 'var(--accent-1)' }} /> История тестов
      </h1>
      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
      ) : attempts.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <History size={48} className="mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Нет пройденных тестов</p>
          <Link to="/test/generate" className="inline-block mt-4 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--accent-gradient)' }}>Создать тест</Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {attempts.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Link to={`/test/${a.id}/result`} className="glass-card p-4 flex items-center gap-4 block">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold" style={{
                    background: (a.percentage || 0) >= 80 ? '#10B98115' : (a.percentage || 0) >= 50 ? '#F59E0B15' : '#EF444415',
                    color: (a.percentage || 0) >= 80 ? '#10B981' : (a.percentage || 0) >= 50 ? '#F59E0B' : '#EF4444',
                  }}>
                    {Math.round(a.percentage || 0)}%
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{a.testTitle}</p>
                    <div className="flex items-center gap-3 text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                      <span>{a.subject?.name}</span>
                      <span>{a.difficulty}</span>
                      <span>{a.correctCount}/{a.questionCount}</span>
                      {a.totalTime && <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(a.totalTime)}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(a.completedAt).toLocaleDateString('ru-RU')}</p>
                    <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: pagination.pages }, (_, i) => (
                <button key={i} onClick={() => setPage(i + 1)}
                  className="w-8 h-8 rounded-lg text-xs font-medium"
                  style={{ background: page === i + 1 ? 'var(--accent)' : 'var(--bg-secondary)', color: page === i + 1 ? 'white' : 'var(--text-secondary)' }}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
