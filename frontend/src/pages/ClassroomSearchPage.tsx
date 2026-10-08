import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { DoorOpen, Search, Loader2, MapPin, Clock, Layers, Users, Video, SearchX, AlertTriangle, RefreshCw } from 'lucide-react';
import { classroomApi, type ClassroomLocation, type ClassroomRoom, type ClassroomSearchResponse } from '@/api/classroom';

const DURATION_OPTIONS = [30, 60, 80, 90, 120];

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; result: ClassroomSearchResponse }
  | { status: 'error'; message: string };

function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.code === 'ECONNABORTED') return 'Сервер не ответил вовремя, попробуйте ещё раз';
    if (!err.response) return 'Нет соединения с сервером';
    return err.response.data?.error || 'Не удалось выполнить поиск';
  }
  return 'Не удалось выполнить поиск';
}

export function ClassroomSearchPage() {
  const [locations, setLocations] = useState<ClassroomLocation[]>([]);
  const [locationsError, setLocationsError] = useState(false);
  const [locationId, setLocationId] = useState('');
  const [duration, setDuration] = useState(80);
  const [state, setState] = useState<SearchState>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  const loadLocations = () => {
    setLocationsError(false);
    classroomApi.getLocations()
      .then(data => {
        setLocations(data);
        setLocationId(prev => prev || data[0]?.id || '');
      })
      .catch(() => setLocationsError(true));
  };

  useEffect(() => {
    loadLocations();
    return () => abortRef.current?.abort();
  }, []);

  const search = async () => {
    if (!locationId || state.status === 'loading') return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: 'loading' });
    try {
      const result = await classroomApi.search({ locationId, durationMinutes: duration }, controller.signal);
      setState({ status: 'done', result });
    } catch (err) {
      if (axios.isCancel(err)) return;
      setState({ status: 'error', message: errorMessage(err) });
    }
  };

  const loading = state.status === 'loading';

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
          <DoorOpen size={26} style={{ color: 'var(--accent-1)' }} /> Поиск кабинета
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Найдём свободный кабинет на ближайшую пару. Выберите корпус и нужную длительность.
        </p>
      </div>

      <div className="glass-card p-5 sm:p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Корпус</label>
          {locationsError ? (
            <button onClick={loadLocations} className="text-sm flex items-center gap-2" style={{ color: '#EF4444' }}>
              <RefreshCw size={14} /> Не удалось загрузить список корпусов, повторить
            </button>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {locations.length === 0
                ? [...Array(3)].map((_, i) => <div key={i} className="skeleton h-11 rounded-xl" />)
                : locations.map(loc => (
                  <button key={loc.id} onClick={() => setLocationId(loc.id)} disabled={loading}
                    className="px-4 py-3 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: locationId === loc.id ? 'var(--accent)' : 'var(--bg-input)',
                      color: locationId === loc.id ? 'white' : 'var(--text-primary)',
                      border: '1px solid var(--border-default)',
                    }}>
                    {loc.name}
                  </button>
                ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Сколько нужен кабинет</label>
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map(d => (
              <button key={d} onClick={() => setDuration(d)} disabled={loading}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: duration === d ? 'var(--accent-bg)' : 'transparent',
                  color: duration === d ? 'var(--accent-1)' : 'var(--text-secondary)',
                  border: `1px solid ${duration === d ? 'var(--accent)' : 'var(--border-default)'}`,
                }}>
                {d} мин
              </button>
            ))}
          </div>
        </div>

        <button onClick={search} disabled={loading || !locationId}
          className="btn-gradient w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 disabled:opacity-60">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          {loading ? 'Ищем кабинет...' : 'Найти кабинет'}
        </button>
      </div>

      {loading && <div className="skeleton h-40 rounded-2xl" />}

      {state.status === 'error' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5 flex flex-col sm:flex-row sm:items-center gap-4" style={{ borderColor: '#EF4444' }}>
          <AlertTriangle size={28} style={{ color: '#EF4444' }} className="shrink-0" />
          <p className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{state.message}</p>
          <button onClick={search} className="btn-gradient flex items-center justify-center gap-2 px-4 py-2 text-sm">
            <RefreshCw size={14} /> Повторить
          </button>
        </motion.div>
      )}

      {state.status === 'done' && !state.result.success && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 text-center">
          <SearchX size={44} className="mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Кабинет не найден</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {state.result.message || 'Попробуйте другой корпус или меньшую длительность'}
          </p>
        </motion.div>
      )}

      {state.status === 'done' && state.result.success && (
        <FoundRoom classroom={state.result.classroom} data={state.result.additionalData} />
      )}
    </div>
  );
}

function FoundRoom({ classroom, data }: { classroom: string; data: ClassroomRoom & { otherRooms: ClassroomRoom[]; alternatives: ClassroomRoom[] } }) {
  const others = [...(data.otherRooms || []), ...(data.alternatives || [])];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6" style={{ borderColor: '#10B981' }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#10B981' }}>Свободный кабинет</p>
      <p className="text-4xl font-bold mt-1 break-words" style={{ color: 'var(--text-primary)' }}>{classroom}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
        {data.corpus && <span className="flex items-center gap-2"><MapPin size={15} /> Корпус {data.corpus}</span>}
        {data.floor != null && <span className="flex items-center gap-2"><Layers size={15} /> {data.floor} этаж</span>}
        {data.availableFrom && (
          <span className="flex items-center gap-2"><Clock size={15} /> {data.availableFrom}{data.availableUntil ? ` — ${data.availableUntil}` : ''}</span>
        )}
        {data.capacity != null && <span className="flex items-center gap-2"><Users size={15} /> до {data.capacity} человек</span>}
        {data.cameraStatus && <span className="flex items-center gap-2"><Video size={15} /> {data.cameraStatus}</span>}
      </div>
      {others.length > 0 && (
        <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--border-default)' }}>
          <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>Другие варианты</p>
          <div className="flex flex-wrap gap-2">
            {others.map((room, i) => (
              <span key={i} className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'var(--accent-bg)', color: 'var(--accent-1)' }}>
                {room.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
