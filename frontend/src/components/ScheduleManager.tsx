import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { CalendarDays, Loader2, MapPin, Pencil, Plus, RefreshCw, Search, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { adminScheduleApi, scheduleError, type ScheduleFields, type ScheduleGroup, type ScheduleItem, type ScheduleSubject } from '@/api/schedule';
import { ErrorNotice, Loading } from './CompanionUI';
import '@/styles/schedule.css';

const DAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEK_LABELS = { odd: 'Нечётная неделя', even: 'Чётная неделя' };

export function ScheduleManager({ embedded = false }: { embedded?: boolean }) {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [groups, setGroups] = useState<ScheduleGroup[]>([]);
  const [subjects, setSubjects] = useState<ScheduleSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<ScheduleItem | 'new' | null>(null);
  const [deletion, setDeletion] = useState<ScheduleItem | 'all' | null>(null);
  const request = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    try {
      const data = await adminScheduleApi.load(controller.signal);
      if (!controller.signal.aborted) {
        setItems(data.items);
        setGroups(data.groups);
        setSubjects(data.subjects);
      }
    } catch (err) {
      if (!axios.isCancel(err)) setError(scheduleError(err));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); return () => request.current?.abort(); }, [load]);

  const query = search.trim().toLocaleLowerCase('ru');
  const filtered = items.filter(item => (!groupFilter || item.groupId === groupFilter)
    && (dayFilter === '' || item.dayOfWeek === Number(dayFilter))
    && (!query || [item.subject.name, item.group.name, item.group.code, item.room, item.teacherName]
      .some(value => value?.toLocaleLowerCase('ru').includes(query))));
  const Heading = embedded ? 'h2' : 'h1';

  async function save(fields: ScheduleFields, id?: string) {
    const saved = await adminScheduleApi.save(fields, id);
    setItems(previous => id ? previous.map(item => item.id === id ? saved : item) : [...previous, saved]);
    if (groupFilter) setGroupFilter(saved.groupId);
    if (dayFilter !== '') setDayFilter(String(saved.dayOfWeek));
    setSearch('');
    toast.success(id ? 'Изменения сохранены' : 'Занятие добавлено');
  }

  async function remove() {
    if (!deletion) return;
    if (deletion === 'all') {
      const count = await adminScheduleApi.clear();
      setItems([]);
      toast.success(`Расписание очищено. Удалено занятий: ${count}`);
    } else {
      await adminScheduleApi.remove(deletion.id);
      setItems(previous => previous.filter(item => item.id !== deletion.id));
      toast.success('Занятие удалено');
    }
  }

  return <div className="page-stack schedule-manager">
    <header className="page-heading schedule-heading">
      <div>
        <p className="eyebrow">УПРАВЛЕНИЕ РАСПИСАНИЕМ</p>
        <Heading>Расписание занятий</Heading>
        <p className="muted">Добавляйте занятия и меняйте расписание учебных групп.</p>
      </div>
      <button id="schedule-add" className="button primary" disabled={loading || !!error || !groups.length || !subjects.length} onClick={() => setEditor('new')}><Plus size={18} />Добавить занятие</button>
    </header>

    {error && <ErrorNotice message={error} retry={() => void load()} />}
    {!loading && !error && (!groups.length || !subjects.length) && <div className="panel small muted">
      Для создания занятия нужны предмет и группа. <Link className="text-link" to="/admin">Добавить их в админке</Link>
    </div>}

    <section className="panel schedule-toolbar" aria-label="Фильтры расписания">
      <div className="schedule-filters">
        <label>Группа<select value={groupFilter} onChange={event => setGroupFilter(event.target.value)} disabled={loading}>
          <option value="">Все группы</option>
          {groups.map(group => <option key={group.id} value={group.id}>{group.name} · {group.code}</option>)}
        </select></label>
        <label>День недели<select value={dayFilter} onChange={event => setDayFilter(event.target.value)} disabled={loading}>
          <option value="">Вся неделя</option>
          {DAY_ORDER.map(day => <option key={day} value={day}>{DAYS[day]}</option>)}
        </select></label>
        <label className="schedule-search">Поиск<div><Search size={17} aria-hidden="true" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Предмет, преподаватель, кабинет" type="search" /></div></label>
      </div>
      <div className="schedule-toolbar-bottom">
        <p className="small muted" role="status">{loading ? 'Загружаем расписание…' : `Показано ${filtered.length} из ${items.length} занятий`}</p>
        <div className="row wrap">
          {(groupFilter || dayFilter !== '' || search) && <button className="button secondary" onClick={() => { setGroupFilter(''); setDayFilter(''); setSearch(''); }}>Сбросить фильтры</button>}
          <button className="button secondary" disabled={loading} onClick={() => void load()}><RefreshCw size={16} />Обновить</button>
          <button className="button schedule-danger-outline" disabled={loading || !!error || !items.length} onClick={() => setDeletion('all')}><Trash2 size={16} />Очистить всё</button>
        </div>
      </div>
    </section>

    {loading ? <Loading label="Загружаем занятия…" /> : !error && (filtered.length ? <div className="schedule-days">
      {DAY_ORDER.map(day => {
        const lessons = filtered.filter(item => item.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id));
        if (!lessons.length) return null;
        return <section key={day} aria-label={DAYS[day]} className="schedule-day">
          <div className="section-heading"><h3>{DAYS[day]}</h3><span className="small muted">Занятий: {lessons.length}</span></div>
          <ul className="schedule-entries">{lessons.map(item => <li key={item.id} className={`panel schedule-entry${item.isActive ? '' : ' is-hidden'}`}>
            <div className="schedule-time"><strong>{item.startTime}</strong><span>{item.endTime}</span></div>
            <div className="schedule-lesson">
              <div className="row wrap"><h4>{item.subject.name}</h4>{!item.isActive && <span className="schedule-badge">Скрыто</span>}{item.weekType && <span className="schedule-badge">{WEEK_LABELS[item.weekType] || item.weekType}</span>}</div>
              <p className="muted small">{item.teacherName || 'Преподаватель не указан'}</p>
              <div className="schedule-meta"><span><Users size={14} />{item.group.name} · {item.group.code}</span><span><MapPin size={14} />{item.room || 'Кабинет не указан'}</span></div>
            </div>
            <div className="schedule-entry-actions">
              <button className="icon-button" title="Редактировать занятие" aria-label={`Редактировать: ${item.subject.name}, ${DAYS[day]}, ${item.startTime}`} onClick={() => setEditor(item)}><Pencil size={18} /></button>
              <button className="icon-button schedule-delete" title="Удалить занятие" aria-label={`Удалить: ${item.subject.name}, ${DAYS[day]}, ${item.startTime}`} onClick={() => setDeletion(item)}><Trash2 size={18} /></button>
            </div>
          </li>)}</ul>
        </section>;
      })}
    </div> : <div className="panel empty-state">
      <CalendarDays size={30} /><h3>{items.length ? 'Занятий по этим фильтрам нет' : 'Расписание пока пустое'}</h3>
      <p>{items.length ? 'Измените группу, день недели или поисковый запрос.' : 'Добавьте первое занятие — оно появится в расписании выбранной группы.'}</p>
    </div>)}

    {editor && <ScheduleEditor item={editor === 'new' ? null : editor} groups={groups} subjects={subjects}
      defaultGroup={groupFilter} defaultDay={dayFilter === '' ? 1 : Number(dayFilter)} onSave={save} onClose={() => setEditor(null)} />}
    {deletion && <DeleteScheduleDialog item={deletion} total={items.length} onDelete={remove} onClose={() => setDeletion(null)} />}
  </div>;
}

function ScheduleModal({ title, description, busy, onClose, children, confirm = false }: {
  title: string; description: string; busy: boolean; onClose: () => void; children: ReactNode; confirm?: boolean;
}) {
  const previousFocus = useRef(document.activeElement as HTMLElement | null);
  return <Dialog.Root open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <Dialog.Portal><Dialog.Overlay className="schedule-dialog-overlay" />
      <Dialog.Content className="schedule-dialog" onPointerDownOutside={event => event.preventDefault()}
        onOpenAutoFocus={event => {
          if (confirm) { event.preventDefault(); document.getElementById('schedule-cancel-delete')?.focus(); }
        }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          const target = previousFocus.current?.isConnected ? previousFocus.current : document.getElementById('schedule-add');
          target?.focus();
        }}>
        <Dialog.Title className="schedule-dialog-title">{title}</Dialog.Title>
        <Dialog.Description className="muted small">{description}</Dialog.Description>
        <Dialog.Close className="icon-button schedule-dialog-close" disabled={busy} aria-label="Закрыть окно"><X size={20} /></Dialog.Close>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

function ScheduleEditor({ item, groups, subjects, defaultGroup, defaultDay, onSave, onClose }: {
  item: ScheduleItem | null; groups: ScheduleGroup[]; subjects: ScheduleSubject[]; defaultGroup: string; defaultDay: number;
  onSave: (fields: ScheduleFields, id?: string) => Promise<void>; onClose: () => void;
}) {
  const [form, setForm] = useState<ScheduleFields>(() => item ? {
    subjectId: item.subjectId, groupId: item.groupId, dayOfWeek: item.dayOfWeek, startTime: item.startTime,
    endTime: item.endTime, teacherName: item.teacherName, room: item.room, weekType: item.weekType, isActive: item.isActive,
  } : { subjectId: '', groupId: defaultGroup, dayOfWeek: defaultDay, startTime: '09:00', endTime: '10:30', teacherName: '', room: '', weekType: null, isActive: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function update<K extends keyof ScheduleFields>(key: K, value: ScheduleFields[K]) { setForm(previous => ({ ...previous, [key]: value })); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (form.endTime <= form.startTime) { setError('Время окончания должно быть позже времени начала.'); return; }
    setBusy(true); setError(null);
    try {
      await onSave({ ...form, teacherName: form.teacherName?.trim() || null, room: form.room?.trim() || null }, item?.id);
      onClose();
    } catch (err) { setError(scheduleError(err)); } finally { setBusy(false); }
  }

  return <ScheduleModal title={item ? 'Редактировать занятие' : 'Новое занятие'} description="Укажите группу, предмет и время. Изменения сохранятся в общем расписании." busy={busy} onClose={onClose}>
    <form onSubmit={submit} className="schedule-form">
      {error && <ErrorNotice message={error} />}
      <fieldset disabled={busy} className="schedule-form-grid">
        <legend className="sr-only">Параметры занятия</legend>
        <label>Предмет<select required value={form.subjectId} onChange={event => {
          const subject = subjects.find(entry => entry.id === event.target.value);
          setForm(previous => ({ ...previous, subjectId: event.target.value, teacherName: subject?.teacher ? `${subject.teacher.firstName} ${subject.teacher.lastName}` : '' }));
        }}><option value="">Выберите предмет</option>{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
        <label>Группа<select required value={form.groupId} onChange={event => update('groupId', event.target.value)}><option value="">Выберите группу</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name} · {group.code}</option>)}</select></label>
        <label>Преподаватель<input value={form.teacherName || ''} onChange={event => update('teacherName', event.target.value)} placeholder="Фамилия и имя" maxLength={200} /></label>
        <label>Кабинет<input value={form.room || ''} onChange={event => update('room', event.target.value)} placeholder="Например, А-301" maxLength={100} /></label>
        <label>День недели<select value={form.dayOfWeek} onChange={event => update('dayOfWeek', Number(event.target.value))}>{DAY_ORDER.map(day => <option key={day} value={day}>{DAYS[day]}</option>)}</select></label>
        <label>Повторение<select value={form.weekType || ''} onChange={event => update('weekType', (event.target.value || null) as ScheduleFields['weekType'])}><option value="">Каждую неделю</option><option value="odd">Нечётная неделя</option><option value="even">Чётная неделя</option></select><span className="muted small">Чётность по номеру календарной недели (ISO).</span></label>
        <label>Начало<input type="time" required value={form.startTime} onChange={event => update('startTime', event.target.value)} /></label>
        <label>Окончание<input type="time" required value={form.endTime} onChange={event => update('endTime', event.target.value)} /></label>
        <label className="schedule-checkbox"><input type="checkbox" checked={form.isActive} onChange={event => update('isActive', event.target.checked)} /><span>Показывать занятие в расписании</span></label>
      </fieldset>
      <div className="schedule-dialog-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Отмена</button><button className="button primary" disabled={busy}>{busy && <Loader2 size={17} className="animate-spin" />}{busy ? 'Сохраняем…' : item ? 'Сохранить изменения' : 'Добавить занятие'}</button></div>
    </form>
  </ScheduleModal>;
}

function DeleteScheduleDialog({ item, total, onDelete, onClose }: {
  item: ScheduleItem | 'all'; total: number; onDelete: () => Promise<void>; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const all = item === 'all';
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || (all && confirmation.trim() !== 'ОЧИСТИТЬ')) return;
    setBusy(true); setError(null);
    try { await onDelete(); onClose(); } catch (err) { setError(scheduleError(err)); } finally { setBusy(false); }
  }
  return <ScheduleModal title={all ? 'Очистить всё расписание?' : 'Удалить занятие?'} busy={busy} onClose={onClose} confirm
    description={all ? `Будут удалены все ${total} занятий всех групп, включая скрытые. Выбранные фильтры не ограничивают удаление. Это действие нельзя отменить.` : `${item.subject.name} · ${item.group.name} · ${DAYS[item.dayOfWeek]}, ${item.startTime}–${item.endTime}. Это занятие будет удалено из расписания.`}>
    <form onSubmit={submit} className="schedule-form">
      {error && <ErrorNotice message={error} />}
      {all && <label>Для подтверждения введите ОЧИСТИТЬ<input autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} /></label>}
      <div className="schedule-dialog-actions"><button id="schedule-cancel-delete" type="button" className="button secondary" disabled={busy} onClick={onClose}>Отмена</button><button className="button schedule-danger" disabled={busy || (all && confirmation.trim() !== 'ОЧИСТИТЬ')}>{busy ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}{busy ? 'Удаляем…' : all ? 'Удалить всё расписание' : 'Удалить занятие'}</button></div>
    </form>
  </ScheduleModal>;
}
