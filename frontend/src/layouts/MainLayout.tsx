import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/auth.store';
import { useThemeStore } from '@/store/theme.store';
import {
  LayoutDashboard, BookOpen, Calendar, History, BarChart3, Brain,
  Trophy, RefreshCcw, MessageSquare, User, LogOut, Sun, Moon,
  Menu, X, GraduationCap, Shield, Sparkles, Users, FileText,
} from 'lucide-react';
import { useState } from 'react';

const SIDEBAR_W = 270;

const navSections = [
  {
    title: 'Основное',
    links: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Дашборд' },
      { to: '/subjects', icon: BookOpen, label: 'Предметы' },
      { to: '/lectures', icon: FileText, label: 'Лекции' },
      { to: '/schedule', icon: Calendar, label: 'Расписание' },
    ],
  },
  {
    title: 'Обучение',
    links: [
      { to: '/test/generate', icon: Brain, label: 'Создать тест', accent: true },
      { to: '/feynman', icon: Sparkles, label: 'Метод Фейнмана', accent: true },
      { to: '/debate', icon: MessageSquare, label: 'Дебаты с AI', accent: true },
      { to: '/history', icon: History, label: 'История' },
      { to: '/analytics', icon: BarChart3, label: 'Аналитика' },
      { to: '/review', icon: RefreshCcw, label: 'Повторение' },
    ],
  },
  {
    title: 'Общение',
    links: [
      { to: '/messages', icon: MessageSquare, label: 'Мессенджер' },
    ],
  },
  {
    title: 'Прочее',
    links: [
      { to: '/achievements', icon: Trophy, label: 'Достижения' },
      { to: '/ai-tutor', icon: MessageSquare, label: 'AI Тьютор' },
    ],
  },
];

export function MainLayout() {
  const { user, logout } = useAuthStore();
  const { theme, toggle } = useThemeStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="gradient-mesh" style={{ background: 'var(--bg-base)', minHeight: '100vh', position: 'relative' }}>
      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        id="mobile-menu-btn"
        style={{
          position: 'fixed', top: 16, left: 16, zIndex: 50,
          padding: 10, borderRadius: 14, color: 'var(--text-primary)',
          display: 'none', background: 'var(--bg-glass)',
          backdropFilter: 'blur(20px)', border: '1px solid var(--border-glass)',
          cursor: 'pointer',
        }}
        aria-label="Меню"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* ═══ SIDEBAR ═══ */}
      <aside
        id="sidebar"
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: SIDEBAR_W, zIndex: 40,
          background: 'var(--bg-sidebar)',
          backdropFilter: 'blur(40px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
          borderRight: '1px solid var(--border-glass)',
          display: 'flex', flexDirection: 'column',
          transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '28px 22px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <motion.div
            whileHover={{ scale: 1.08, rotate: 5 }}
            className="animate-glow"
            style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'var(--accent-gradient)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white',
            }}
          >
            <Sparkles size={22} />
          </motion.div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              AI Tutor
            </h1>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 1 }}>
              AI Platform
            </p>
          </div>
        </div>

        {/* Nav Sections */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
          {navSections.map((section) => (
            <div key={section.title} style={{ marginBottom: 20 }}>
              <p style={{
                fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                padding: '0 12px', marginBottom: 6,
              }}>
                {section.title}
              </p>
              {section.links.map((link) => {
                const isActive = location.pathname === link.to || (link.to !== '/dashboard' && location.pathname.startsWith(link.to));
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setSidebarOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '11px 14px', borderRadius: 14,
                      fontSize: 13.5, fontWeight: isActive ? 600 : 500,
                      color: isActive ? 'var(--text-accent)' : 'var(--text-secondary)',
                      background: isActive ? 'var(--accent-bg)' : 'transparent',
                      textDecoration: 'none',
                      transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                      position: 'relative',
                      marginBottom: 2,
                    }}
                    onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'var(--accent-bg)'; e.currentTarget.style.color = 'var(--text-accent)'; } }}
                    onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        style={{
                          position: 'absolute', left: 0, top: '50%',
                          transform: 'translateY(-50%)',
                          width: 3, height: 20, borderRadius: 100,
                          background: 'var(--accent-gradient)',
                        }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}
                    <link.icon size={17} style={{ opacity: isActive ? 1 : 0.6, flexShrink: 0 }} />
                    {link.label}
                    {(link as any).accent && !isActive && (
                      <span style={{
                        marginLeft: 'auto', fontSize: 9, fontWeight: 700,
                        padding: '2px 8px', borderRadius: 100,
                        background: 'var(--accent-gradient)', color: 'white',
                        letterSpacing: '0.04em',
                      }}>
                        AI
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}

          {/* Admin/Teacher */}
          {(user?.role === 'TEACHER' || user?.role === 'ADMIN') && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 12px', marginBottom: 6 }}>
                Управление
              </p>
              {user.role === 'TEACHER' || user.role === 'ADMIN' ? (
                <>
                  <Link to="/teacher" onClick={() => setSidebarOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 14, fontSize: 13.5, fontWeight: 500, color: location.pathname === '/teacher' ? 'var(--text-accent)' : 'var(--text-secondary)', background: location.pathname === '/teacher' ? 'var(--accent-bg)' : 'transparent', textDecoration: 'none', marginBottom: 2 }}>
                    <GraduationCap size={17} /> Дашборд
                  </Link>
                  <Link to="/teacher/groups" onClick={() => setSidebarOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 14, fontSize: 13.5, fontWeight: 500, color: location.pathname.startsWith('/teacher/groups') ? 'var(--text-accent)' : 'var(--text-secondary)', background: location.pathname.startsWith('/teacher/groups') ? 'var(--accent-bg)' : 'transparent', textDecoration: 'none', marginBottom: 2 }}>
                    <Users size={17} /> Группы
                  </Link>
                </>
              ) : null}
              {user.role === 'ADMIN' ? (
                <Link to="/admin" onClick={() => setSidebarOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 14, fontSize: 13.5, fontWeight: 500, color: location.pathname === '/admin' ? 'var(--text-accent)' : 'var(--text-secondary)', background: location.pathname === '/admin' ? 'var(--accent-bg)' : 'transparent', textDecoration: 'none' }}>
                  <Shield size={17} /> Админ
                </Link>
              ) : null}
            </div>
          )}
        </nav>

        {/* Bottom */}
        <div style={{ padding: '16px 12px 20px', borderTop: '1px solid var(--border-subtle)' }}>
          {/* Theme toggle */}
          <button
            onClick={toggle}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              padding: '10px 14px', borderRadius: 14,
              fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)',
              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-bg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            {theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
          </button>

          {/* User profile */}
          <Link
            to="/profile"
            onClick={() => setSidebarOpen(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 14,
              fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)',
              textDecoration: 'none', transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-bg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{
              width: 30, height: 30, borderRadius: 10,
              background: 'var(--accent-gradient)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-heading)',
            }}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{user?.firstName} {user?.lastName}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{user?.email}</div>
            </div>
          </Link>

          {/* Logout */}
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              padding: '10px 14px', borderRadius: 14,
              fontSize: 13, fontWeight: 500, color: 'var(--error)',
              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
          >
            <LogOut size={17} />
            Выйти
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ═══ MAIN CONTENT ═══ */}
      <main
        id="main-content"
        style={{ marginLeft: SIDEBAR_W, minHeight: '100vh', position: 'relative', zIndex: 1 }}
      >
        <div style={{ padding: '32px 36px', maxWidth: 1180, margin: '0 auto' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Responsive */}
      <style>{`
        @media (max-width: 768px) {
          #sidebar { transform: ${sidebarOpen ? 'translateX(0)' : 'translateX(-100%)'} !important; }
          #main-content { margin-left: 0 !important; }
          #mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
