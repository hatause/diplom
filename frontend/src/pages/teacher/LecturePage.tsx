import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Bot, FileText, ArrowLeft, Play, LayoutDashboard } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export function LecturePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lecture, setLecture] = useState<any>(null);
  const [explanation, setExplanation] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    api.get(`/lectures/${id}`).then(res => {
      setLecture(res.data.data);
      setLoading(false);
    }).catch(() => {
      alert('Лекция не найдена');
      navigate('/teacher/dashboard');
    });
  }, [id, navigate]);

  const explainLecture = async () => {
    setAiLoading(true);
    try {
      const res = await api.post(`/lectures/${id}/explain`);
      setExplanation(res.data.data.explanation);
    } catch (e) {
      alert('Ошибка при генерации объяснения');
    }
    setAiLoading(false);
  };

  const generateTest = async () => {
    setAiLoading(true);
    try {
      const res = await api.post(`/lectures/${id}/generate-test`);
      alert('Тест успешно сгенерирован и добавлен в базу!');
    } catch (e) {
      alert('Ошибка при генерации теста');
    }
    setAiLoading(false);
  };

  if (loading) return <div className="skeleton h-64 rounded-2xl" />;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      <button onClick={() => navigate('/teacher/dashboard')} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors">
        <ArrowLeft size={16} /> Назад к панели
      </button>

      <div className="glass-card p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">{lecture.title}</h1>
          <p className="text-[var(--text-secondary)] flex items-center gap-2">
            <BookOpenIcon size={16} /> {lecture.subject.name}
          </p>
        </div>

        <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none text-[var(--text-primary)] whitespace-pre-wrap">
          {lecture.content}
        </div>
      </div>

      <div className="flex gap-4">
        <button onClick={explainLecture} disabled={aiLoading} className="btn-primary flex-1 flex items-center justify-center gap-2 py-3">
          <Bot size={20} /> Объяснить ИИ
        </button>
        <button onClick={generateTest} disabled={aiLoading} className="btn-secondary flex-1 flex items-center justify-center gap-2 py-3">
          <FileText size={20} /> Сгенерировать тест
        </button>
      </div>

      {aiLoading && (
        <div className="glass-card p-6 flex flex-col items-center justify-center text-center animate-pulse">
          <Bot size={32} className="text-[var(--primary)] mb-2" />
          <p className="text-[var(--text-secondary)]">AI Tutor работает над вашим запросом...</p>
        </div>
      )}

      {explanation && (
        <div className="glass-card p-8 border-l-4 border-l-[var(--primary)]">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-[var(--text-primary)]">
            <Bot size={20} className="text-[var(--primary)]" /> Объяснение AI Tutor
          </h3>
          <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
            <ReactMarkdown>{explanation}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

function BookOpenIcon({ size }: { size: number }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>;
}
