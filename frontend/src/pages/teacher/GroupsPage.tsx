import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Copy, Loader2, Search } from 'lucide-react';
import { groupsApi, type Group, type StudentInGroup } from '@/api/groups';
import { toast } from 'sonner';
import { errorText } from '@/api/companion';
import { useAuthStore } from '@/store/auth.store';

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', code: '' });
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const selectedGroupId = useRef<string | null>(null);
  const [students, setStudents] = useState<StudentInGroup[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [unassignedStudents, setUnassignedStudents] = useState<any[]>([]);
  const [addingStudent, setAddingStudent] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const fetchGroups = async () => {
    try {
      const data = await groupsApi.getMyGroups();
      setGroups(data);
    } catch (err) {
      toast.error('Ошибка загрузки групп');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnassignedStudents = async () => {
    try {
      const data = await groupsApi.getUnassignedStudents();
      setUnassignedStudents(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchUnassignedStudents();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await groupsApi.createGroup(newGroup);
      setGroups([created, ...groups]);
      setShowCreate(false);
      setNewGroup({ name: '', code: '' });
      toast.success('Группа создана!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка создания группы');
    }
  };

  const handleSelectGroup = async (group: Group) => {
    selectedGroupId.current = group.id;
    setSelectedGroup(group);
    setStudents([]);
    setSelectedStudentId('');
    setStudentsLoading(true);
    try {
      const data = await groupsApi.getGroupStudents(group.id);
      if (selectedGroupId.current === group.id) setStudents(data);
    } catch (err) {
      if (selectedGroupId.current === group.id) toast.error(errorText(err));
    } finally {
      if (selectedGroupId.current === group.id) setStudentsLoading(false);
    }
  };

  const copyCode = async (code: string) => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(code);
      toast.success('Код скопирован');
    } catch {
      toast.error('Не удалось скопировать автоматически. Выделите код и скопируйте его вручную.');
    }
  };

  const handleDeleteGroup = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Вы уверены, что хотите удалить эту группу? Это действие нельзя отменить.')) return;
    try {
      await groupsApi.deleteGroup(id);
      setGroups(previous => previous.filter(g => g.id !== id));
      if (selectedGroupId.current === id) { selectedGroupId.current = null; setSelectedGroup(null); }
      toast.success('Группа удалена');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка удаления группы');
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedGroup || addingStudent) return;
    try {
      setAddingStudent(true);
      await groupsApi.addStudent(selectedGroup.id, selectedStudentId);
      toast.success('Студент добавлен');
      if (selectedGroupId.current === selectedGroup.id) await handleSelectGroup(selectedGroup);
      await fetchGroups();
      await fetchUnassignedStudents();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setAddingStudent(false);
    }
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-accent" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold font-heading text-primary">Мои группы</h1>
          <p className="text-tertiary">Управляйте своими студентами и группами</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-gradient flex items-center gap-2 px-4 py-2 rounded-xl text-sm">
          <Plus size={16} /> Создать группу
        </button>
      </div>

      {showCreate && (
        <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} onSubmit={handleCreate} className="glass-panel p-6 rounded-2xl flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm text-tertiary mb-1">Название группы</label>
            <input type="text" className="input-glass w-full" placeholder="Например: ПИ-22-1" required value={newGroup.name} onChange={e => setNewGroup({ ...newGroup, name: e.target.value })} />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-tertiary mb-1">Код приглашения</label>
            <input type="text" className="input-glass w-full" placeholder="pi-22-1-secret" required value={newGroup.code} onChange={e => setNewGroup({ ...newGroup, code: e.target.value })} />
          </div>
          <button type="submit" className="btn-gradient px-6 py-3 rounded-xl whitespace-nowrap">
            Создать
          </button>
        </motion.form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 space-y-4">
          <h3 className="text-lg font-bold font-heading text-secondary">Список групп</h3>
          {groups.length === 0 ? (
            <div className="glass-panel p-6 text-center text-tertiary rounded-2xl">Групп пока нет</div>
          ) : (
            groups.map(group => (
              <motion.div
                key={group.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => handleSelectGroup(group)}
                className={`glass-panel p-4 rounded-xl cursor-pointer border ${selectedGroup?.id === group.id ? 'border-accent' : 'border-transparent'}`}
              >
                <div className="font-bold text-primary flex justify-between items-center">
                  {group.name}
                  {isAdmin && (
                    <button 
                      onClick={(e) => handleDeleteGroup(e, group.id)} 
                      className="text-red-500/50 hover:text-red-500 transition-colors px-2 py-1 rounded"
                      title="Удалить группу"
                    >
                      &times;
                    </button>
                  )}
                </div>
                <div className="flex justify-between items-center mt-2 text-sm">
                  <div className="flex items-center gap-1 text-tertiary bg-white/5 px-2 py-1 rounded-md">
                    <span className="font-mono text-accent">{group.code}</span>
                    <button onClick={(e) => { e.stopPropagation(); copyCode(group.code); }}><Copy size={12} /></button>
                  </div>
                  <span className="text-tertiary flex items-center gap-1"><Users size={14} /> {group._count?.students || 0}</span>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <div className="col-span-2 space-y-4">
          {selectedGroup ? (
            <>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold font-heading text-secondary">Студенты группы {selectedGroup.name}</h3>
              </div>
              
              <div className="glass-panel p-4 rounded-2xl mb-4 flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-xs text-tertiary mb-1">Добавить ученика в группу</label>
                  <select 
                    className="input-glass w-full text-sm py-2"
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                  >
                    <option value="">Выберите студента (без группы)...</option>
                    {unassignedStudents.map(s => (
                      <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.email})</option>
                    ))}
                  </select>
                </div>
                <button 
                  onClick={handleAddStudent} 
                  disabled={addingStudent || !selectedStudentId}
                  className="btn-gradient px-4 py-2 rounded-xl text-sm whitespace-nowrap disabled:opacity-50"
                >
                  {addingStudent ? 'Добавление...' : 'Добавить'}
                </button>
              </div>

              <div className="glass-panel rounded-2xl overflow-hidden">
                {studentsLoading ? (
                  <div className="flex justify-center p-10"><Loader2 className="animate-spin text-accent" /></div>
                ) : students.length === 0 ? (
                  <div className="p-10 text-center text-tertiary flex flex-col items-center gap-3">
                    <Users size={32} className="opacity-20" />
                    В этой группе пока нет студентов. Дайте им код <b>{selectedGroup.code}</b> при регистрации.
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {students.map(student => (
                      <div key={student.id} className="p-4 flex items-center gap-4 hover:bg-white/5 transition-colors">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent/20 to-purple-500/20 flex items-center justify-center text-accent font-bold">
                          {student.user.firstName[0]}
                        </div>
                        <div>
                          <div className="font-medium text-primary">{student.user.firstName} {student.user.lastName}</div>
                          <div className="text-sm text-tertiary">{student.user.email}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="glass-panel h-full rounded-2xl flex flex-col items-center justify-center text-tertiary p-10">
              <Search size={48} className="opacity-20 mb-4" />
              <p>Выберите группу слева для просмотра списка студентов</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
