import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/api/client';
import {
  Brain, Sparkles, Trophy, Flame, BookOpen, Clock, TrendingUp,
  ArrowRight, Target, Zap, Star,
} from 'lucide-react';

const MotionLink = motion.create(Link);

const card = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.4, 0, 0.2, 1] },
});

const statCards = [
  { icon: BookOpen, label: 'Тестов пройдено', key: 'completedAttempts', color: '#DC2626' },
  { icon: Target, label: 'Средний балл', key: 'avgScore', suffix: '%', color: '#06B6D4' },
  { icon: Flame, label: 'Серия дней', key: 'streak', suffix: ' дн.', color: '#F59E0B' },
  { icon: Zap, label: 'Очки XP', key: 'xp', color: '#10B981' },
];

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, subjectsRes] = await Promise.all([
          api.get('/analytics').catch(() => ({ data: { data: null } })),
          api.get('/subjects').catch(() => ({ data: { data: [] } })),
        ]);
        setStats(statsRes.data.data);
        setSubjects(subjectsRes.data.data || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Доброе утро';
    if (h < 18) return 'Добрый день';
    return 'Добрый вечер';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: i === 1 ? 180 : 120, borderRadius: 'var(--radius-lg)' }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Hero Welcome */}
      <motion.div
        {...card(0)}
        className="glass-card"
        style={{
          padding: '36px 40px', borderRadius: 'var(--radius-xl)',
          position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Background accent */}
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 250, height: 250,
          borderRadius: '50%', opacity: 0.08,
          background: 'radial-gradient(circle, var(--accent-1), transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: -30, left: '40%', width: 200, height: 200,
          borderRadius: '50%', opacity: 0.05,
          background: 'radial-gradient(circle, var(--accent-2), transparent 70%)',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <motion.p
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            style={{ fontSize: 14, color: 'var(--text-tertiary)', fontWeight: 500, marginBottom: 6 }}
          >
            {greeting()} 👋
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            style={{
              fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 700,
              color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 10,
            }}
          >
            {user?.firstName} {user?.lastName}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 500, lineHeight: 1.6 }}
          >
            Продолжайте обучение — ваш AI-помощник готов сгенерировать персональные тесты и помочь с трудными темами.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            style={{ display: 'flex', gap: 12, marginTop: 24 }}
          >
            <MotionLink
              to="/test/generate"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="btn-gradient"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '13px 24px', borderRadius: 16, fontSize: 14,
                textDecoration: 'none',
              }}
            >
              <Brain size={18} />
              Создать тест
              <ArrowRight size={16} />
            </MotionLink>
            <MotionLink
              to="/ai-tutor"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="glass"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '13px 24px', borderRadius: 16, fontSize: 14,
                color: 'var(--text-accent)', fontWeight: 600,
                fontFamily: 'var(--font-heading)', textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              <Sparkles size={18} />
              AI Тьютор
            </MotionLink>
          </motion.div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {statCards.map((s, i) => (
          <motion.div
            key={s.key}
            {...card(0.1 + i * 0.08)}
            className="glass-card"
            style={{ padding: '24px 22px', borderRadius: 'var(--radius-lg)', cursor: 'default' }}
            whileHover={{ scale: 1.02 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${s.color}14`, color: s.color,
              }}>
                <s.icon size={20} />
              </div>
              <TrendingUp size={16} style={{ color: 'var(--success)', opacity: 0.6 }} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              {stats?.overview?.[s.key] != null ? `${Math.round(stats.overview[s.key])}${s.suffix || ''}` : '—'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 4 }}>
              {s.label}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Subjects & Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Subjects */}
        <motion.div {...card(0.4)} className="glass-card" style={{ padding: '28px', borderRadius: 'var(--radius-xl)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              Мои предметы
            </h2>
            <Link to="/subjects" style={{ fontSize: 12, color: 'var(--text-accent)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              Все <ArrowRight size={12} />
            </Link>
          </div>
          {subjects.length === 0 ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Предметы загружаются...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {subjects.slice(0, 5).map((sub: any) => (
                <Link
                  key={sub.id}
                  to={`/test/generate?subjectId=${sub.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 16px', borderRadius: 14,
                    background: 'var(--accent-bg)', textDecoration: 'none',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(4px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateX(0)'; }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `linear-gradient(135deg, ${sub.color || '#7C3AED'}, ${sub.color || '#06B6D4'}88)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: 14,
                  }}>
                    <BookOpen size={16} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{sub.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{sub.topics?.length || 0} тем</div>
                  </div>
                  <ArrowRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                </Link>
              ))}
            </div>
          )}
        </motion.div>

        {/* Achievements & Streak */}
        <motion.div {...card(0.5)} className="glass-card" style={{ padding: '28px', borderRadius: 'var(--radius-xl)' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
            Достижения
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* XP Progress */}
            <div style={{
              padding: '20px', borderRadius: 16,
              background: 'var(--accent-gradient-subtle)',
              border: '1px solid var(--border-glass)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <Star size={20} style={{ color: 'var(--accent-1)' }} />
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Уровень прогресса</span>
              </div>
              <div style={{ background: 'var(--bg-input)', borderRadius: 100, height: 8, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(((stats?.overview?.xp || 0) % 1000) / 10, 100)}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                  style={{ height: '100%', borderRadius: 100, background: 'var(--accent-gradient)' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{stats?.overview?.xp || 0} XP</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Уровень {Math.floor((stats?.overview?.xp || 0) / 1000) + 1}</span>
              </div>
            </div>

            {/* Quick stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{
                padding: '16px', borderRadius: 14, textAlign: 'center',
                background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.1)',
              }}>
                <Flame size={20} style={{ color: '#F59E0B', margin: '0 auto 6px' }} />
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>{stats?.overview?.streak || 0}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500 }}>Серия дней</div>
              </div>
              <div style={{
                padding: '16px', borderRadius: 14, textAlign: 'center',
                background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.1)',
              }}>
                <Trophy size={20} style={{ color: '#10B981', margin: '0 auto 6px' }} />
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>{stats?.achievementsCount || 0}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500 }}>Достижений</div>
              </div>
            </div>

            <Link
              to="/achievements"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px', borderRadius: 14, fontSize: 13, fontWeight: 600,
                color: 'var(--text-accent)', background: 'var(--accent-bg)',
                textDecoration: 'none', transition: 'all 0.2s',
              }}
            >
              <Trophy size={15} /> Все достижения <ArrowRight size={14} />
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
