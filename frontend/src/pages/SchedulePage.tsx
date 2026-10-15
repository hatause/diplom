import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText } from '@/api/companion';
import { ErrorNotice } from '@/components/CompanionUI';
import { api } from '@/api/client';
import { motion } from 'framer-motion';
import { Calendar, Clock, MapPin, User, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { ScheduleManager } from '@/components/ScheduleManager';

const DAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

export function SchedulePage() {
  const isAdmin = useAuthStore(state => state.user?.role === 'ADMIN');
  return isAdmin ? <ScheduleManager /> : <ScheduleView />;
}

function ScheduleView() {
  const user = useAuthStore(state => state.user);
  const hasGroup = user?.role !== 'STUDENT' || Boolean(user.studentProfile?.group);
  const [view, setView] = useState<'today' | 'week'>('week');
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    try {
      const endpoint = view === 'today' ? '/schedule/today' : '/schedule/week';
      const [schedRes, statusRes] = await Promise.all([
        api.get(endpoint, { signal: controller.signal }),
        api.get('/schedule/status', { signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      setData(schedRes.data.data);
      setStatus(statusRes.data.data);
    } catch (e) {
      if (!controller.signal.aborted) setError(errorText(e));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [view]);

  useEffect(() => { void load(); return () => request.current?.abort(); }, [load]);

  const handleSync = async () => {
    await load();
  };

  const today = new Date().getDay();
  const now = new Date().toTimeString().slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Расписание</h1>
          <div className="flex items-center gap-2 mt-1">
            {status?.status === 'connected' ? (
              <span className="flex items-center gap-1 text-xs" style={{ color: '#10B981' }}><Wifi size={12} /> Connected</span>
            ) : (
              <span className="flex items-center gap-1 text-xs" style={{ color: '#EF4444' }}><WifiOff size={12} /> {status?.status || 'Offline'}</span>
            )}
            {status?.lastSyncAt && (
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Обновлено: {new Date(status.lastSyncAt).toLocaleTimeString('ru-RU')}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
            {(['today', 'week'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-4 py-2 text-sm font-medium transition-all"
                style={{ background: view === v ? 'var(--accent)' : 'transparent', color: view === v ? 'white' : 'var(--text-secondary)' }}>
                {v === 'today' ? 'Сегодня' : 'Неделя'}
              </button>
            ))}
          </div>
          <button onClick={handleSync} disabled={loading} className="p-2 rounded-xl glass" title="Обновить расписание">
            <RefreshCw size={18} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </div>

      {!hasGroup ? <div className="glass-card p-8">Группа пока не назначена. Обратитесь к преподавателю или администратору, чтобы увидеть своё расписание.</div> : loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
      ) : error ? <ErrorNotice message={error} retry={load} /> : view === 'today' ? (
        <div className="space-y-3">
          {(data?.items || []).length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Calendar size={48} className="mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Сегодня нет занятий</p>
            </div>
          ) : (
            data.items.map((item: any, i: number) => {
              const isCurrent = today === item.dayOfWeek && now >= item.startTime && now <= item.endTime;
              return (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="glass-card p-5" style={isCurrent ? { borderColor: 'var(--accent)', borderWidth: '2px' } : {}}>
                  <div className="flex items-center gap-4">
                    <div className="w-1.5 h-14 rounded-full" style={{ background: item.subject?.color || 'var(--accent)' }} />
                    <div className="flex-1">
                      <p className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        {item.subject?.name}
                        {isCurrent && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--accent-bg)', color: 'var(--accent-1)' }}>Сейчас</span>}
                      </p>
                      <div className="flex items-center gap-3 text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        <span className="flex items-center gap-1"><Clock size={12} /> {item.startTime} — {item.endTime}</span>
                        {item.room && <span className="flex items-center gap-1"><MapPin size={12} /> {item.room}</span>}
                        {item.teacherName && <span className="flex items-center gap-1"><User size={12} /> {item.teacherName}</span>}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      ) : (
        /* Week view */
        <div className="space-y-6">
          {[1, 2, 3, 4, 5, 6, 0].map(day => {
            const dayItems = data?.week?.[day] || [];
            if (dayItems.length === 0) return null;
            return (
              <div key={day}>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"
                  style={{ color: day === today ? 'var(--accent)' : 'var(--text-secondary)' }}>
                  {DAYS[day]}
                  {day === today && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-bg)', color: 'var(--accent-1)' }}>Сегодня</span>}
                </h3>
                <div className="space-y-2">
                  {dayItems.map((item: any, i: number) => (
                    <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="glass-card p-4 flex items-center gap-4">
                      <div className="w-1 h-10 rounded-full" style={{ background: item.subject?.color || 'var(--accent)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{item.subject?.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{item.teacherName}</p>
                        {item.weekType && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.weekType === 'odd' ? 'Нечётная неделя' : 'Чётная неделя'}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.startTime}</p>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{item.room}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
