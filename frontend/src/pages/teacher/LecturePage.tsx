import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { errorText } from '@/api/companion';
import { Bot, FileText, ArrowLeft, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export function LecturePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lecture, setLecture] = useState<any>(null);
  const [explanation, setExplanation] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [generatedTest, setGeneratedTest] = useState<any>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setAiLoading(false);
    setLecture(null);
    setExplanation('');
    setExtractedText('');
    setGeneratedTest(null);
    setError('');
    api.get(`/lectures/${id}`, { signal: controller.signal }).then(res => {
      if (controller.signal.aborted) return;
      setLecture(res.data.data);
      setLoading(false);
    }).catch((e) => {
      if (controller.signal.aborted) return;
      setError(errorText(e));
      setLoading(false);
    });
    return () => controller.abort();
  }, [id]);

  const downloadFile = async () => {
    const signal = request.current?.signal;
    try {
      const { data } = await api.get(lecture.fileUrl.replace(/^\/api\/v1/, ''), { responseType: 'blob', signal });
      if (signal?.aborted) return;
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = lecture.fileName || 'lecture';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { if (!signal?.aborted) setError(errorText(e)); }
  };

  const explainLecture = async () => {
    if (aiLoading) return;
    const signal = request.current?.signal;
    setError('');
    setAiLoading(true);
    try {
      const res = await api.post(`/lectures/${id}/explain`, undefined, { signal });
      if (signal?.aborted) return;
      setExplanation(res.data.data.explanation);
    } catch (e) {
      if (!signal?.aborted) setError(errorText(e));
    } finally {
      if (!signal?.aborted) setAiLoading(false);
    }
  };

  const generateTest = async () => {
    if (aiLoading) return;
    const signal = request.current?.signal;
    setError('');
    setAiLoading(true);
    try {
      const test = generatedTest || (await api.post(`/lectures/${id}/generate-test`, undefined, { signal })).data.data;
      if (signal?.aborted) return;
      setGeneratedTest(test);
      const { data } = await api.post(`/tests/${test.id}/start`, undefined, { signal });
      if (signal?.aborted) return;
      navigate(`/test/${data.data.id}/play`, { state: { test } });
    } catch (e) {
      if (!signal?.aborted) setError(errorText(e));
    } finally {
      if (!signal?.aborted) setAiLoading(false);
    }
  };

  const extractText = async () => {
    if (aiLoading) return;
    const signal = request.current?.signal;
    setError('');
    setAiLoading(true);
    try {
      const { data } = await api.post(`/lectures/${id}/extract-text`, undefined, { signal });
      if (signal?.aborted) return;
      setExtractedText(data.data.text);
    } catch (e) {
      if (!signal?.aborted) setError(errorText(e));
    } finally {
      if (!signal?.aborted) setAiLoading(false);
    }
  };

  if (loading) return <div className="skeleton h-64 rounded-2xl" />;
  if (!lecture) return <p role="alert" className="glass-card p-6">{error || 'Лекция не найдена'}</p>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors">
        <ArrowLeft size={16} /> Назад
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

        {lecture.fileUrl && (
          <div className="mt-8 p-4 border border-[var(--border-subtle)] rounded-xl flex items-center justify-between bg-[var(--bg-elevated)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--accent-1)]/10 text-[var(--accent-1)] flex items-center justify-center">
                <FileText size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">Прикрепленный файл</p>
                <p className="text-xs text-[var(--text-secondary)]">{lecture.fileName || 'Файл'}</p>
              </div>
            </div>
            <button type="button" onClick={downloadFile}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-1)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              <Download size={16} /> Скачать
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        <button onClick={explainLecture} disabled={aiLoading} className="btn-primary flex-1 flex items-center justify-center gap-2 py-3">
          <Bot size={20} /> Объяснить ИИ
        </button>
        <button onClick={generateTest} disabled={aiLoading} className="btn-secondary flex-1 flex items-center justify-center gap-2 py-3">
          <FileText size={20} /> {generatedTest ? 'Открыть тест' : 'Сгенерировать тест'}
        </button>
      </div>

      {lecture.fileUrl && <button onClick={extractText} disabled={aiLoading} className="btn-secondary flex items-center gap-2 py-3"><FileText size={20} /> Извлечь текст из файла</button>}
      {error && <p role="alert" className="glass-card p-4" style={{ color: 'var(--error)' }}>{error}</p>}
      {extractedText && <section className="glass-card p-8"><h3 className="text-lg font-bold mb-4">Текст вложения</h3><div className="whitespace-pre-wrap">{extractedText}</div></section>}

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
