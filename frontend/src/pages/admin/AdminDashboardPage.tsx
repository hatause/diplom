import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { motion } from 'framer-motion';
import { Shield, Users, BookOpen, BarChart3, FileText, GraduationCap, Plus, Calendar } from 'lucide-react';

export function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Stats
  const [stats, setStats] = useState<any>(null);
  
  // Data
  const [usersList, setUsersList] = useState<any[]>([]);
  const [groupsList, setGroupsList] = useState<any[]>([]);
  const [subjectsList, setSubjectsList] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dashRes, usersRes, groupsRes, subjRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/users?limit=100'),
        api.get('/admin/groups'),
        api.get('/admin/subjects'),
      ]);
      setStats(dashRes.data.data);
      setUsersList(usersRes.data.data.users || []);
      setGroupsList(groupsRes.data.data || []);
      setSubjectsList(subjRes.data.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  if (loading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}</div>;

  const tabs = [
    { id: 'dashboard', label: 'Обзор', icon: BarChart3 },
    { id: 'users', label: 'Пользователи', icon: Users },
    { id: 'groups', label: 'Группы', icon: GraduationCap },
    { id: 'subjects', label: 'Предметы', icon: BookOpen },
    { id: 'schedule', label: 'Расписание', icon: Calendar },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Shield size={28} style={{ color: '#EF4444' }} /> Панель Администратора
        </h1>
        <button onClick={fetchData} className="btn-secondary text-sm px-3 py-1">Обновить данные</button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === t.id ? 'bg-[var(--primary)] text-white shadow-lg' : 'hover:bg-[var(--bg-card)]'
            }`}
            style={{ color: activeTab !== t.id ? 'var(--text-secondary)' : undefined }}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'dashboard' && <DashboardTab stats={stats} users={usersList.slice(0, 5)} />}
        {activeTab === 'users' && <UsersTab users={usersList} groups={groupsList} onRefresh={fetchData} />}
        {activeTab === 'groups' && <GroupsTab groups={groupsList} users={usersList} onRefresh={fetchData} />}
        {activeTab === 'subjects' && <SubjectsTab subjects={subjectsList} users={usersList} onRefresh={fetchData} />}
        {activeTab === 'schedule' && <ScheduleTab groups={groupsList} subjects={subjectsList} onRefresh={fetchData} />}
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Tabs Components
// ─────────────────────────────────────────────────────────────────

function DashboardTab({ stats, users }: { stats: any; users: any[] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Пользователей', value: stats?.userCount || 0, icon: Users, color: '#10B981' },
          { label: 'Студентов', value: stats?.studentCount || 0, icon: GraduationCap, color: '#6366F1' },
          { label: 'Преподавателей', value: stats?.teacherCount || 0, icon: BookOpen, color: '#F59E0B' },
          { label: 'Предметов', value: stats?.subjectCount || 0, icon: BookOpen, color: '#8B5CF6' },
          { label: 'Тестов', value: stats?.testCount || 0, icon: FileText, color: '#EC4899' },
          { label: 'Попыток', value: stats?.attemptCount || 0, icon: BarChart3, color: '#14B8A6' },
        ].map((stat, i) => (
          <div key={stat.label} className="glass-card p-4">
            <stat.icon size={18} style={{ color: stat.color }} className="mb-2" />
            <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Последние пользователи</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-tertiary)' }}>
                <th className="text-left py-2 px-3">Имя</th>
                <th className="text-left py-2 px-3">Email</th>
                <th className="text-left py-2 px-3">Роль</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <td className="py-3 px-3 font-medium" style={{ color: 'var(--text-primary)' }}>{u.firstName} {u.lastName}</td>
                  <td className="py-3 px-3" style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                  <td className="py-3 px-3">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{
                      background: u.role === 'ADMIN' ? '#EF444420' : u.role === 'TEACHER' ? '#F59E0B20' : '#10B98120',
                      color: u.role === 'ADMIN' ? '#EF4444' : u.role === 'TEACHER' ? '#F59E0B' : '#10B981',
                    }}>{u.role}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UsersTab({ users, groups, onRefresh }: { users: any[], groups: any[], onRefresh: () => void }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'STUDENT', groupId: '' });
  
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/admin/users', form);
      setForm({ firstName: '', lastName: '', email: '', password: '', role: 'STUDENT', groupId: '' });
      onRefresh();
    } catch (e) {
      alert('Ошибка при создании');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 glass-card p-6 h-fit">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Plus size={18}/> Новый пользователь</h3>
        <form onSubmit={submit} className="space-y-4">
          <input className="input-field w-full" placeholder="Имя" required value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} />
          <input className="input-field w-full" placeholder="Фамилия" required value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} />
          <input className="input-field w-full" type="email" placeholder="Email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          <input className="input-field w-full" type="password" placeholder="Пароль" required value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
          <select className="input-field w-full" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
            <option value="STUDENT">Студент</option>
            <option value="TEACHER">Преподаватель</option>
            <option value="ADMIN">Админ</option>
          </select>
          {form.role === 'STUDENT' && (
            <select className="input-field w-full" value={form.groupId} onChange={e => setForm({...form, groupId: e.target.value})}>
              <option value="">Без группы</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          <button className="btn-primary w-full">Создать</button>
        </form>
      </div>
      <div className="md:col-span-2 glass-card p-6">
        <h3 className="text-lg font-bold mb-4">Все пользователи ({users.length})</h3>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-tertiary)' }}>
                <th className="text-left py-2 px-2">ФИО</th>
                <th className="text-left py-2 px-2">Email</th>
                <th className="text-left py-2 px-2">Роль</th>
                <th className="text-left py-2 px-2">Группа</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <td className="py-2 px-2" style={{ color: 'var(--text-primary)' }}>{u.firstName} {u.lastName}</td>
                  <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                  <td className="py-2 px-2 text-xs">{u.role}</td>
                  <td className="py-2 px-2 text-xs text-[var(--text-tertiary)]">{u.studentProfile?.group?.name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GroupsTab({ groups, users, onRefresh }: { groups: any[], users: any[], onRefresh: () => void }) {
  const [form, setForm] = useState({ name: '', code: '' });
  const [assignForm, setAssignForm] = useState({ groupId: '', teacherId: '' });
  const teachers = users.filter(u => u.role === 'TEACHER');

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/admin/groups', form);
    setForm({ name: '', code: '' });
    onRefresh();
  };

  const assignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!assignForm.groupId || !assignForm.teacherId) return;
    await api.post(`/admin/groups/${assignForm.groupId}/teachers`, { teacherId: assignForm.teacherId });
    setAssignForm({ groupId: '', teacherId: '' });
    onRefresh();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold mb-4">Новая группа</h3>
          <form onSubmit={createGroup} className="space-y-4">
            <input className="input-field w-full" placeholder="Название (ПИ-20)" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <input className="input-field w-full" placeholder="Код (PI-20)" required value={form.code} onChange={e => setForm({...form, code: e.target.value})} />
            <button className="btn-primary w-full">Создать</button>
          </form>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-lg font-bold mb-4">Назначить преподавателя</h3>
          <form onSubmit={assignTeacher} className="space-y-4">
            <select className="input-field w-full" required value={assignForm.groupId} onChange={e => setAssignForm({...assignForm, groupId: e.target.value})}>
              <option value="">Выберите группу...</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select className="input-field w-full" required value={assignForm.teacherId} onChange={e => setAssignForm({...assignForm, teacherId: e.target.value})}>
              <option value="">Выберите преподавателя...</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
            </select>
            <button className="btn-primary w-full">Назначить</button>
          </form>
        </div>
      </div>

      <div className="glass-card p-6">
        <h3 className="text-lg font-bold mb-4">Список групп</h3>
        <ul className="space-y-2">
          {groups.map(g => (
            <li key={g.id} className="p-3 rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="font-bold" style={{ color: 'var(--text-primary)' }}>{g.name} <span className="text-xs font-normal text-[var(--text-tertiary)]">({g.code})</span></div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Студентов: {g._count?.students || 0}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SubjectsTab({ subjects, users, onRefresh }: { subjects: any[], users: any[], onRefresh: () => void }) {
  const [form, setForm] = useState({ name: '', code: '', description: '', teacherId: '' });
  const teachers = users.filter(u => u.role === 'TEACHER');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/admin/subjects', form);
    setForm({ name: '', code: '', description: '', teacherId: '' });
    onRefresh();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 glass-card p-6 h-fit">
        <h3 className="text-lg font-bold mb-4">Новый предмет</h3>
        <form onSubmit={submit} className="space-y-4">
          <input className="input-field w-full" placeholder="Название" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <input className="input-field w-full" placeholder="Код (CS-101)" required value={form.code} onChange={e => setForm({...form, code: e.target.value})} />
          <textarea className="input-field w-full" placeholder="Описание" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          <select className="input-field w-full" value={form.teacherId} onChange={e => setForm({...form, teacherId: e.target.value})}>
            <option value="">Без преподавателя (Общий)</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
          </select>
          <button className="btn-primary w-full">Создать</button>
        </form>
      </div>
      <div className="md:col-span-2 glass-card p-6">
        <h3 className="text-lg font-bold mb-4">База предметов</h3>
        <div className="grid grid-cols-2 gap-4">
          {subjects.map(s => (
            <div key={s.id} className="p-4 rounded-xl border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
              <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>{s.name}</h4>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{s.description}</p>
              <div className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                Код: {s.code} <br/>
                Преподаватель: {s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : 'Нет'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScheduleTab({ groups, subjects, onRefresh }: { groups: any[], subjects: any[], onRefresh: () => void }) {
  const [form, setForm] = useState({ groupId: '', subjectId: '', dayOfWeek: 1, startTime: '09:00', endTime: '10:30', room: '' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/admin/schedule', {
      ...form,
      dayOfWeek: parseInt(form.dayOfWeek.toString())
    });
    alert('Расписание добавлено!');
    setForm({ groupId: '', subjectId: '', dayOfWeek: 1, startTime: '09:00', endTime: '10:30', room: '' });
  };

  return (
    <div className="glass-card p-6 max-w-2xl">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Calendar size={20}/> Добавить занятие в расписание</h3>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <select className="input-field w-full" required value={form.groupId} onChange={e => setForm({...form, groupId: e.target.value})}>
            <option value="">Группа...</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="input-field w-full" required value={form.subjectId} onChange={e => setForm({...form, subjectId: e.target.value})}>
            <option value="">Предмет...</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <select className="input-field w-full" required value={form.dayOfWeek} onChange={e => setForm({...form, dayOfWeek: parseInt(e.target.value)})}>
            <option value={1}>Понедельник</option>
            <option value={2}>Вторник</option>
            <option value={3}>Среда</option>
            <option value={4}>Четверг</option>
            <option value={5}>Пятница</option>
            <option value={6}>Суббота</option>
          </select>
          <input className="input-field w-full" type="time" required value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} />
          <input className="input-field w-full" type="time" required value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} />
        </div>

        <input className="input-field w-full" placeholder="Аудитория (Напр. А-301)" value={form.room} onChange={e => setForm({...form, room: e.target.value})} />
        
        <button className="btn-primary w-full mt-4">Добавить занятие</button>
      </form>
    </div>
  );
}
