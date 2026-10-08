import { Loader2, AlertCircle, BookOpen } from 'lucide-react';
import { Context } from '@/api/companion';
import type { ReactNode } from 'react';
export function PageHeader({eyebrow, title, description, action}: {eyebrow?: string; title: string; description?: string; action?: ReactNode}) {
  return <header className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{action}</header>;
}
export function ErrorNotice({message, retry}: {message: string; retry?: () => void}) { return <div className="error-notice" role="alert"><AlertCircle size={19}/><span>{message}</span>{retry && <button className="button secondary" onClick={retry}>Повторить</button>}</div>; }
export function EmptyState({title, children}: {title: string; children?: ReactNode}) { return <div className="empty-state"><BookOpen size={26}/><h3>{title}</h3>{children && <p>{children}</p>}</div>; }
export function Loading({label = 'Загрузка…'}: {label?: string}) { return <div className="loading-state" role="status"><Loader2 className="animate-spin" size={20}/>{label}</div>; }
export function ContextFields({value, onChange, disabled = false}: {value: Context; onChange: (value: Context) => void; disabled?: boolean}) {
  function update<K extends keyof Context>(key: K, item: Context[K]) { onChange({...value, [key]: item}); }
  return <fieldset className="context-fields" disabled={disabled}><legend className="sr-only">Контекст обучения</legend>
    <label>Класс<select value={value.grade} onChange={e => update('grade', Number(e.target.value))}>{Array.from({length:13}, (_, i) => <option key={i+1}>{i+1}</option>)}</select></label>
    <label>Предмет<input placeholder="Например, Geschichte" maxLength={120} value={value.subject} onChange={e => update('subject', e.target.value)}/></label>
    <label>Тема<input placeholder="Что изучаем?" maxLength={200} value={value.topic} onChange={e => update('topic', e.target.value)}/></label>
    <label>Язык объяснения<select value={value.language} onChange={e => update('language', e.target.value as Context['language'])}><option value="ru">Русский</option><option value="en">English</option><option value="de">Deutsch</option><option value="uk">Українська</option></select></label>
    <label>Сложность<select value={value.difficulty} onChange={e => update('difficulty', e.target.value as Context['difficulty'])}><option value="easy">Базовая</option><option value="medium">Средняя</option><option value="hard">Высокая</option></select></label>
  </fieldset>;
}
