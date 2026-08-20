import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { UserPlus, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function RegisterPage() {
  const { register } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 6 }}>
        Создать аккаунт
      </h2>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginBottom: 28 }}>
        Начните обучение с AI-помощником
      </p>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '12px 16px', borderRadius: 14, marginBottom: 20,
            background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)',
            color: 'var(--error)', fontSize: 13, fontWeight: 500,
          }}
        >
          {error}
        </motion.div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input type="text" placeholder="Имя" value={form.firstName} onChange={e => update('firstName', e.target.value)} className="input-glass" style={{ paddingLeft: 40 }} required />
          </div>
          <div style={{ position: 'relative' }}>
            <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input type="text" placeholder="Фамилия" value={form.lastName} onChange={e => update('lastName', e.target.value)} className="input-glass" style={{ paddingLeft: 40 }} required />
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <Mail size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input type="email" placeholder="Email" value={form.email} onChange={e => update('email', e.target.value)} className="input-glass" style={{ paddingLeft: 44 }} required />
        </div>
        <div style={{ position: 'relative' }}>
          <Lock size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input type="password" placeholder="Пароль (мин. 8 символов)" value={form.password} onChange={e => update('password', e.target.value)} className="input-glass" style={{ paddingLeft: 44 }} minLength={8} required />
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        type="submit"
        disabled={loading}
        className="btn-gradient"
        style={{
          width: '100%', padding: '15px 20px', borderRadius: 16,
          fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? (
          <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
        ) : (
          <>
            <UserPlus size={18} />
            Создать аккаунт
            <ArrowRight size={16} style={{ marginLeft: 'auto' }} />
          </>
        )}
      </motion.button>

      <p style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text-tertiary)' }}>
        Уже есть аккаунт?{' '}
        <Link to="/login" style={{ color: 'var(--text-accent)', fontWeight: 600, textDecoration: 'none' }}>
          Войти
        </Link>
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  );
}
