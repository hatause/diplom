import { Outlet, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth.store';
import { Sparkles } from 'lucide-react';

export function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div className="gradient-mesh" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, background: 'var(--bg-base)', position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative floating orbs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <motion.div
          animate={{ y: [0, -30, 0], x: [0, 15, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', top: '15%', right: '15%',
            width: 300, height: 300, borderRadius: '50%', opacity: 0.2,
            background: 'radial-gradient(circle, rgba(124,58,237,0.4) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <motion.div
          animate={{ y: [0, 20, 0], x: [0, -10, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          style={{
            position: 'absolute', bottom: '10%', left: '10%',
            width: 400, height: 400, borderRadius: '50%', opacity: 0.15,
            background: 'radial-gradient(circle, rgba(6,182,212,0.4) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        <motion.div
          animate={{ y: [0, -15, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 250, height: 250, borderRadius: '50%', opacity: 0.1,
            background: 'radial-gradient(circle, rgba(236,72,153,0.4) 0%, transparent 70%)',
            filter: 'blur(50px)', transform: 'translate(-50%, -50%)',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        style={{ position: 'relative', width: '100%', maxWidth: 440, zIndex: 1 }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <motion.div
            whileHover={{ scale: 1.1, rotate: 10 }}
            className="animate-glow"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 64, height: 64, borderRadius: 20,
              background: 'var(--accent-gradient)', color: 'white', marginBottom: 16,
            }}
          >
            <Sparkles size={30} />
          </motion.div>
          <h1 style={{
            fontFamily: 'var(--font-heading)', fontSize: 34, fontWeight: 700,
            color: 'var(--text-primary)', letterSpacing: '-0.04em',
          }}>
            AI Tutor
          </h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 500, marginTop: 6 }}>
            AI-платформа для обучения нового поколения
          </p>
        </div>

        {/* Form card */}
        <div className="glass-card" style={{ padding: '40px 36px', borderRadius: 'var(--radius-xl)' }}>
          <Outlet />
        </div>

        {/* Bottom decorative line */}
        <div style={{
          marginTop: 24, height: 2, borderRadius: 100, opacity: 0.5,
          background: 'var(--accent-gradient)',
          maxWidth: 120, margin: '24px auto 0',
        }} />
      </motion.div>
    </div>
  );
}
