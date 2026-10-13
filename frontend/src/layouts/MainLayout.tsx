import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useThemeStore } from '@/store/theme.store';
import { LayoutDashboard, BookOpen, Calendar, History, BarChart3, Brain, Trophy, RefreshCcw, MessageSquare, LogOut, Sun, Moon, Menu, X, GraduationCap, Shield, Sparkles, Users, FileText, DoorOpen, Layers, NotebookPen, ArrowUpRight, Lightbulb } from 'lucide-react';
const sections = [
  {title: 'ТВОЙ ДЕНЬ', links: [ ['/dashboard', LayoutDashboard, 'Обзор'], ['/schedule', Calendar, 'Расписание'], ['/classroom', DoorOpen, 'Найти кабинет'], ['/planner', NotebookPen, 'Задания и тесты'] ]},
  {title: 'УЧИСЬ С AI', links: [ ['/ai-tutor', Sparkles, 'AI Tutor'], ['/study', BookOpen, 'Подготовка к тесту'], ['/flashcards', Layers, 'Карточки'], ['/quiz', Brain, 'Викторина'], ['/term', Lightbulb, 'Объяснить термин'], ['/notes', FileText, 'Заметки'], ['/progress', BarChart3, 'Мой прогресс'] ]},
];
const more = [['/subjects',BookOpen,'Предметы'],['/lectures',FileText,'Лекции'],['/test/generate',Brain,'Тесты по предметам'],['/history',History,'История тестов'],['/analytics',BarChart3,'Аналитика'],['/review',RefreshCcw,'Повторение'],['/feynman',Lightbulb,'Метод Фейнмана'],['/debate',MessageSquare,'Дебаты'],['/messages',MessageSquare,'Сообщения'],['/achievements',Trophy,'Достижения']];
export function MainLayout() {
  const {user, logout} = useAuthStore(); const {theme, toggle} = useThemeStore();
  const [open, setOpen] = useState(false); const location = useLocation(); const navigate = useNavigate();
  const aside = useRef<HTMLElement>(null); const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    aside.current?.querySelector<HTMLButtonElement>('button')?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); menuButton.current?.focus(); }
      if (e.key === 'Tab') {
        const nodes = Array.from(aside.current?.querySelectorAll<HTMLElement>('a, button, summary') || []).filter(n => n.offsetParent !== null);
        const first = nodes[0], last = nodes[nodes.length-1];
        if (e.shiftKey && document.activeElement === first) {e.preventDefault(); last?.focus();}
        if (!e.shiftKey && document.activeElement === last) {e.preventDefault(); first?.focus();}
      }
    }
    document.addEventListener('keydown', key); return () => {document.body.style.overflow = previous; document.removeEventListener('keydown',key);};
  },[open]);
  const nav = (items: typeof more) => items.map(([to, Icon, label]) => { const I = Icon as typeof Sparkles; return <NavLink key={String(to)} to={String(to)} className={({isActive}) => 'nav-item' + (isActive ? ' active' : '')}><I size={18}/><span>{String(label)}</span></NavLink>; });
  return <div className="app-shell"><a className="skip-link" href="#main-content">Перейти к содержимому</a>
    <header className="mobile-bar"><button ref={menuButton} className="icon-button" aria-label="Открыть меню" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={22}/></button><Link className="brand" to="/dashboard">aituto<span>.</span></Link><button className="icon-button" onClick={toggle} aria-label="Сменить тему">{theme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}</button></header>
    {open && <div className="sidebar-backdrop" onClick={() => {setOpen(false); menuButton.current?.focus();}}/>}
    <aside ref={aside} className={'app-sidebar' + (open ? ' is-open' : '')} aria-label="Главная навигация">
      <div className="sidebar-brand"><Link className="brand" to="/dashboard"><span className="brand-symbol"><Sparkles size={20}/></span>aituto<span>.</span></Link><button className="icon-button mobile-only" aria-label="Закрыть меню" onClick={() => {setOpen(false); menuButton.current?.focus();}}><X size={20}/></button></div>
      <nav>{sections.map(s => <div className="nav-section" key={s.title}><p className="nav-label">{s.title}</p>{nav(s.links)}</div>)}<details className="nav-section"><summary className="nav-label">ЕЩЁ В AITUTO</summary>{nav(more)}</details>
      {(user?.role === 'TEACHER' || user?.role === 'ADMIN') && <div className="nav-section"><p className="nav-label">ПРЕПОДАВАНИЕ</p>{nav([['/teacher',GraduationCap,'Панель преподавателя'],['/teacher/groups',Users,'Группы']])}{user.role === 'ADMIN' && nav([['/admin',Shield,'Администрирование']])}</div>}</nav>
      <div className="sidebar-bottom"><button className="nav-item" onClick={toggle}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}<span>{theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}</span></button><div className="profile-row"><Link to="/profile"><span className="avatar">{user?.firstName?.[0]}{user?.lastName?.[0]}</span><span><strong>{user?.firstName} {user?.lastName}</strong><small>Твой учебный профиль</small></span></Link><button className="icon-button" aria-label="Выйти" onClick={async () => {await logout(); navigate('/login');}}><LogOut size={17}/></button></div></div>
    </aside>
    <div className="app-main"><div className="app-topbar"><span><span className="status-dot"/> Место для новых открытий</span><Link to="/ai-tutor">Спросить AI <ArrowUpRight size={15}/></Link></div><main id="main-content" tabIndex={-1} className="page-container"><Outlet/></main></div>
  </div>;
}
