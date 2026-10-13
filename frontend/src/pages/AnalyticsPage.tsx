import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { errorText } from '@/api/companion';
import { ErrorNotice } from '@/components/CompanionUI';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

const COLORS = ['#10B981', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [subjectStats, setSubjectStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/analytics'),
      api.get('/analytics/subjects'),
    ]).then(([analyticsRes, subjectsRes]) => {
      setData(analyticsRes.data.data);
      setSubjectStats(subjectsRes.data.data || []);
      setLoading(false);
    }).catch((err) => { setError(errorText(err)); setLoading(false); });
  }, []);

  if (loading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-64 rounded-2xl" />)}</div>;
  if (!data) return null;

  const tooltipStyle = { background: 'var(--bg-glass-strong)', border: '1px solid var(--border-glass)', borderRadius: '12px', fontSize: '12px' };

  if (error) return <ErrorNotice message={error} retry={() => window.location.reload()} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <BarChart3 size={28} style={{ color: 'var(--accent-1)' }} /> Аналитика
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress over time */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <TrendingUp size={16} style={{ color: 'var(--accent-1)' }} /> Прогресс
          </h3>
          {data.progressOverTime?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.progressOverTime}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="score" stroke="#10B981" fill="url(#grad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-center py-12" style={{ color: 'var(--text-tertiary)' }}>Пройдите тесты для отображения графика</p>}
        </motion.div>

        {/* Accuracy by subject */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Результаты по предметам</h3>
          {subjectStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={subjectStats}>
                <XAxis dataKey="subjectName" tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="avgScore" radius={[6, 6, 0, 0]}>
                  {subjectStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-center py-12" style={{ color: 'var(--text-tertiary)' }}>Нет данных</p>}
        </motion.div>

        {/* Topic mastery */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Владение темами</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(data.topicProgress || []).slice(0, 12).map((tp: any, i: number) => (
              <div key={i} className="p-3 rounded-xl" style={{ background: 'var(--bg-input)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{tp.topicName}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{tp.subjectName}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
                    background: tp.masteryScore >= 80 ? '#10B98120' : tp.masteryScore >= 50 ? '#F59E0B20' : '#EF444420',
                    color: tp.masteryScore >= 80 ? '#10B981' : tp.masteryScore >= 50 ? '#F59E0B' : '#EF4444',
                  }}>
                    {tp.masteryLevel}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                  <div className="h-full rounded-full" style={{
                    width: `${tp.masteryScore}%`,
                    background: tp.masteryScore >= 80 ? '#10B981' : tp.masteryScore >= 50 ? '#F59E0B' : '#EF4444',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
