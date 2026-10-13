import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/api/client';
import { errorText } from '@/api/companion';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { User, Mail, Shield, Edit2, Save, Key } from 'lucide-react';

export function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: user?.firstName || '', lastName: user?.lastName || '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put('/auth/profile', form);
      setUser({ ...user!, ...res.data.data });
      setEditing(false);
      toast.success('Профиль обновлён');
    } catch (err) { toast.error(errorText(err)); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPassword.length < 8) { toast.error('Минимум 8 символов'); return; }
    try {
      await api.put('/auth/password', pwForm);
      setPwForm({ currentPassword: '', newPassword: '' });
      toast.success('Пароль изменён');
    } catch (err: any) { toast.error(errorText(err)); }
  };

  const inputStyle = { background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <User size={28} style={{ color: 'var(--accent-1)' }} /> Профиль
      </h1>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white" style={{ background: 'var(--accent-gradient)' }}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{user?.firstName} {user?.lastName}</h2>
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              <Mail size={14} /> {user?.email}
            </div>
            <span className="inline-flex items-center gap-1 mt-1 text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-bg)', color: 'var(--accent-1)' }}>
              <Shield size={12} /> {user?.role}
            </span>
          </div>
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                className="px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} placeholder="Имя" />
              <input type="text" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                className="px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} placeholder="Фамилия" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-medium text-white flex items-center gap-2" style={{ background: 'var(--accent-gradient)' }}>
                <Save size={16} /> Сохранить
              </button>
              <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-xl text-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>Отмена</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
            <Edit2 size={16} /> Редактировать
          </button>
        )}

        {user?.studentProfile && (
          <div className="mt-6 pt-6 grid grid-cols-3 gap-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div className="text-center">
              <p className="text-xl font-bold" style={{ color: '#F59E0B' }}>{user.studentProfile.xp}</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>XP</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold" style={{ color: '#EF4444' }}>{user.studentProfile.streak} 🔥</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Серия</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{user.studentProfile.group?.name || '—'}</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Группа</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Change password */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-4" style={{ color: 'var(--text-primary)' }}>
          <Key size={16} style={{ color: 'var(--accent-1)' }} /> Сменить пароль
        </h3>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <input type="password" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
            placeholder="Текущий пароль" className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} />
          <input type="password" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
            placeholder="Новый пароль (минимум 8 символов)" className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={inputStyle} />
          <button type="submit" className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--accent-gradient)' }}>Сменить</button>
        </form>
      </motion.div>
    </div>
  );
}
