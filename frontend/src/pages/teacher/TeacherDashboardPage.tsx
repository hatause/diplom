import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { motion } from 'framer-motion';
import { GraduationCap, Users, BarChart3, Clock, BookOpen, Plus, FileText } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export function TeacherDashboardPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [lectures, setLectures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dashRes, groupsRes] = await Promise.all([
        api.get('/teacher/dashboard'),
        api.get('/teacher/groups')
      ]);
      setData(dashRes.data.data);
      setGroups(groupsRes.data.data || []);
      
      // If we have groups, fetch lectures for the first one, or fetch all lectures.
      // For simplicity, let's just fetch lectures when a group is selected, or we can fetch for all groups.
      // But we need group-specific lectures. Let's add a function to load them.
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  if (loading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <GraduationCap size={28} style={{ color: 'var(--accent-1)' }} /> Панель преподавателя
      </h1>

      <div className="flex gap-2 overflow-x-auto pb-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${activeTab === 'dashboard' ? 'bg-[var(--primary)] text-white' : 'hover:bg-[var(--bg-card)]'}`}>
          <BarChart3 size={16} /> Обзор
        </button>
        <button onClick={() => setActiveTab('lectures')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${activeTab === 'lectures' ? 'bg-[var(--primary)] text-white' : 'hover:bg-[var(--bg-card)]'}`}>
          <FileText size={16} /> Лекции
        </button>
        <button onClick={() => setActiveTab('subjects')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${activeTab === 'subjects' ? 'bg-[var(--primary)] text-white' : 'hover:bg-[var(--bg-card)]'}`}>
          <BookOpen size={16} /> Мои предметы
        </button>
      </div>

      <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {activeTab === 'dashboard' && <DashboardTab data={data} />}
        {activeTab === 'lectures' && <LecturesTab groups={groups} subjects={data.subjects} />}
        {activeTab === 'subjects' && <SubjectsTab subjects={data.subjects} onRefresh={fetchData} />}
      </motion.div>
    </div>
  );
}

function DashboardTab({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Предметов', value: data?.subjects?.length || 0, icon: BookOpen, color: '#6366F1' },
          { label: 'Студентов', value: data?.totalStudents || 0, icon: Users, color: '#10B981' },
          { label: 'Средний балл', value: `${data?.avgScore || 0}%`, icon: BarChart3, color: '#F59E0B' },
        ].map((stat, i) => (
          <div key={stat.label} className="glass-card p-5">
            <stat.icon size={20} style={{ color: stat.color }} className="mb-2" />
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Clock size={16} style={{ color: 'var(--accent-1)' }} /> Последние результаты тестов
        </h3>
        <div className="space-y-2">
          {(data?.recentAttempts || []).slice(0, 10).map((a: any, i: number) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm" style={{
                background: a.score >= 80 ? '#10B98115' : a.score >= 50 ? '#F59E0B15' : '#EF444415',
                color: a.score >= 80 ? '#10B981' : a.score >= 50 ? '#F59E0B' : '#EF4444',
              }}>{Math.round(a.score || 0)}%</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{a.studentName}</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{a.testTitle} • {a.subject}</p>
              </div>
              <p className="text-xs shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                {a.completedAt ? new Date(a.completedAt).toLocaleDateString('ru-RU') : ''}
              </p>
            </div>
          ))}
          {(!data?.recentAttempts || data.recentAttempts.length === 0) && (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-tertiary)' }}>Нет результатов</p>
          )}
        </div>
      </div>
    </div>
  );
}

function LecturesTab({ groups, subjects }: { groups: any[], subjects: any[] }) {
  const [form, setForm] = useState({ title: '', content: '', groupId: '', subjectId: '' });
  const [lectures, setLectures] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    if (selectedGroup) {
      api.get(`/lectures/group/${selectedGroup}`).then(res => setLectures(res.data.data));
    } else {
      setLectures([]);
    }
  }, [selectedGroup]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/lectures', form);
    alert('Лекция добавлена!');
    setForm({ ...form, title: '', content: '' });
    if (form.groupId === selectedGroup) {
      api.get(`/lectures/group/${selectedGroup}`).then(res => setLectures(res.data.data));
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="glass-card p-6 h-fit">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Plus size={18}/> Добавить лекцию</h3>
        <form onSubmit={submit} className="space-y-4">
          <input className="input-field w-full" placeholder="Название лекции" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
          <select className="input-field w-full" required value={form.groupId} onChange={e => setForm({...form, groupId: e.target.value})}>
            <option value="">Выберите группу...</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="input-field w-full" required value={form.subjectId} onChange={e => setForm({...form, subjectId: e.target.value})}>
            <option value="">Выберите предмет...</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <textarea className="input-field w-full h-32" placeholder="Текст лекции..." required value={form.content} onChange={e => setForm({...form, content: e.target.value})} />
          <button className="btn-primary w-full">Сохранить лекцию</button>
        </form>
      </div>

      <div className="glass-card p-6">
        <h3 className="text-lg font-bold mb-4">Материалы групп</h3>
        <select className="input-field w-full mb-4" value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
          <option value="">Выберите группу для просмотра...</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        
        {selectedGroup && (
          <div className="space-y-3 mt-4 max-h-[500px] overflow-y-auto pr-2">
            {lectures.map(l => (
              <div key={l.id} className="p-4 border rounded-xl hover:border-[var(--primary)] transition-colors cursor-pointer group" style={{ borderColor: 'var(--border-subtle)' }} onClick={() => navigate(`/teacher/lectures/${l.id}`)}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-[var(--text-primary)] group-hover:text-[var(--primary)]">{l.title}</h4>
                    <p className="text-xs mt-1 text-[var(--text-secondary)]">{l.subject.name}</p>
                  </div>
                </div>
              </div>
            ))}
            {lectures.length === 0 && <p className="text-sm text-[var(--text-tertiary)]">Лекций пока нет</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function SubjectsTab({ subjects, onRefresh }: { subjects: any[], onRefresh: () => void }) {
  const [form, setForm] = useState({ name: '', code: '', description: '' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/teacher/subjects', form);
      setForm({ name: '', code: '', description: '' });
      onRefresh();
    } catch (e) {
      alert('Ошибка при создании предмета');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 glass-card p-6 h-fit">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Plus size={18}/> Добавить свой предмет</h3>
        <p className="text-xs text-[var(--text-secondary)] mb-4">Например: "Разработка ПО", "Настройки биоса" и т.д.</p>
        <form onSubmit={submit} className="space-y-4">
          <input className="input-field w-full" placeholder="Название (напр. Настройки биоса)" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          <input className="input-field w-full" placeholder="Код (напр. BIOS-101)" required value={form.code} onChange={e => setForm({...form, code: e.target.value})} />
          <textarea className="input-field w-full" placeholder="Описание..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          <button className="btn-primary w-full">Создать</button>
        </form>
      </div>
      
      <div className="md:col-span-2 glass-card p-6">
        <h3 className="text-lg font-bold mb-4">Мои предметы</h3>
        <div className="grid grid-cols-2 gap-4">
          {subjects.map(s => (
            <div key={s.id} className="p-4 rounded-xl border hover:border-[var(--primary)] transition-colors" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
              <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>{s.name}</h4>
              {s.description && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{s.description}</p>}
              <div className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                Код: {s.code}
              </div>
            </div>
          ))}
          {(!subjects || subjects.length === 0) && (
            <p className="text-sm text-[var(--text-tertiary)] col-span-2">У вас пока нет добавленных предметов.</p>
          )}
        </div>
      </div>
    </div>
  );
}
