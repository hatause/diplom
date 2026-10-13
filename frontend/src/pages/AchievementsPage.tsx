import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { errorText } from '@/api/companion';
import { ErrorNotice } from '@/components/CompanionUI';
import { motion } from 'framer-motion';
import { Trophy, Lock, Sparkles, Flame, Star } from 'lucide-react';

export function AchievementsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/achievements').then(res => { setData(res.data.data); setLoading(false); }).catch((err) => { setError(errorText(err)); setLoading(false); });
  }, []);

  if (loading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}</div>;

  if (error) return <ErrorNotice message={error} retry={() => window.location.reload()} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <Trophy size={28} style={{ color: '#F59E0B' }} /> Достижения
      </h1>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'XP', value: data?.stats?.xp || 0, icon: Sparkles, color: '#F59E0B' },
          { label: 'Серия', value: `${data?.stats?.streak || 0} дн.`, icon: Flame, color: '#EF4444' },
          { label: 'Лучшая серия', value: `${data?.stats?.bestStreak || 0} дн.`, icon: Star, color: '#6366F1' },
          { label: 'Разблокировано', value: `${data?.stats?.unlockedCount || 0}/${data?.stats?.totalCount || 0}`, icon: Trophy, color: '#10B981' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card p-4">
            <stat.icon size={18} style={{ color: stat.color }} className="mb-2" />
            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Achievements grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data?.achievements || []).map((ach: any, i: number) => (
          <motion.div key={ach.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }}
            className="glass-card p-5" style={{ opacity: ach.isUnlocked ? 1 : 0.5 }}>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl" style={{ background: ach.isUnlocked ? '#F59E0B15' : 'var(--bg-secondary)' }}>
                {ach.isUnlocked ? '🏆' : <Lock size={20} style={{ color: 'var(--text-tertiary)' }} />}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{ach.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{ach.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#F59E0B20', color: '#F59E0B' }}>+{ach.xpReward} XP</span>
                  {ach.isUnlocked && ach.unlockedAt && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(ach.unlockedAt).toLocaleDateString('ru-RU')}</span>}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
