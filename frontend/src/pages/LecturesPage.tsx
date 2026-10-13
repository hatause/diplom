import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { motion } from 'framer-motion';
import { BookOpen, FileText, Loader2, ArrowRight, Paperclip } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';

export function LecturesPage() {
  const [lectures, setLectures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const groupId = user?.studentProfile?.group?.id;

  useEffect(() => {
    fetchLectures();
  }, [groupId]);

  const fetchLectures = async () => {
    try {
      // Fetch public lectures
      const resPublic = await api.get('/lectures/public');
      let allLectures = resPublic.data.data || [];
      
      // Fetch group lectures if student is in a group
      if (groupId) {
        const resGroup = await api.get(`/lectures/group/${groupId}`);
        allLectures = [...allLectures, ...(resGroup.data.data || [])];
      }
      
      // Remove duplicates by ID and sort by createdAt
      const uniqueLectures = Array.from(new Map(allLectures.map((item: any) => [item.id, item])).values());
      uniqueLectures.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setLectures(uniqueLectures);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-accent" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-primary flex items-center gap-2">
          <BookOpen size={24} className="text-accent" /> Лекции
        </h1>
        <p className="text-sm mt-1 text-tertiary">Учебные материалы от ваших преподавателей</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lectures.map((lec, i) => (
          <motion.div key={lec.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <div 
              onClick={() => navigate(`/lectures/${lec.id}`)} // Reusing the same lecture view page
              className="glass-card p-6 cursor-pointer hover:border-accent transition-colors group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-accent/10">
                  <FileText size={22} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-primary group-hover:text-accent transition-colors">{lec.title}</h3>
                  <p className="text-sm text-secondary">{lec.subject.name}</p>
                  <p className="text-xs text-tertiary mt-2 flex items-center gap-2">
                    <span>{lec.teacher.firstName} {lec.teacher.lastName}</span>
                    <span>•</span>
                    <span>{new Date(lec.createdAt).toLocaleDateString('ru-RU')}</span>
                    {lec.groupId === null && <span className="bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full">Общая</span>}
                    {lec.fileUrl && <span className="flex items-center gap-1 text-[var(--accent-1)]"><Paperclip size={12}/>Вложение</span>}
                  </p>
                </div>
                <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight size={20} className="text-accent" />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
        {lectures.length === 0 && (
          <div className="col-span-2 glass-panel p-10 text-center rounded-2xl">
            <FileText size={48} className="mx-auto text-tertiary opacity-20 mb-4" />
            <p className="text-secondary font-medium">Для вас пока нет доступных лекций</p>
            <p className="text-sm text-tertiary mt-1">
              {!groupId ? 'Присоединитесь к группе, чтобы видеть лекции вашего преподавателя' : 'Ваш преподаватель еще не загрузил материалы'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
