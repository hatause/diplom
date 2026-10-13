import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Sparkles,
  Send,
  Plus,
  Paperclip,
  X,
  FileText,
  Layers,
  Brain,
  ArrowUpRight,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import axios from "axios";
import { api } from "@/api/client";
import {
  Context,
  defaultContext,
  Conversation,
  getCompanion,
  postCompanion,
  errorText,
} from "@/api/companion";
import {
  ContextFields,
  ErrorNotice,
  Loading,
  PageHeader,
} from "@/components/CompanionUI";
const modes = {
  tutor: {
    title: "Любопытство — начало знаний.",
    description: "Задай вопрос. Найдём понятное объяснение вместе.",
    placeholder: "Что ты хочешь понять сегодня?",
    name: "AI Tutor",
  },
  homework: {
    title: "Не просто ответ. Понимание.",
    description:
      "Вставь задание или прикрепи фото — разберём решение по шагам.",
    placeholder: "Вставь условие задачи…",
    name: "Домашняя работа",
  },
  study: {
    title: "На тест — с уверенностью.",
    description:
      "Конспект, ключевые понятия и вопросы для повторения по твоей теме.",
    placeholder: "К какому тесту готовимся?",
    name: "Подготовка к тесту",
  },
  term: {
    title: "Сложное слово. Простое объяснение.",
    description: "Определение, пример и главное, что нужно запомнить.",
    placeholder: "Например, Absolutismus",
    name: "Объяснить термин",
  },
};
type Mode = keyof typeof modes;
export function AITutorPage({ mode = "tutor" }: { mode?: Mode }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const info = modes[mode];
  const [context, setContext] = useState<Context>({
    ...defaultContext,
    topic: params.get("topic") || "",
  });
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [history, setHistory] = useState<Conversation[]>([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const requestVersion = useRef(0);
  const id = params.get("conversation");
  const attemptId = params.get("attemptId");
  const topic = params.get("topic") || "";
  const loadHistory = () =>
    getCompanion<Conversation[]>("conversations")
      .then((items) => { setHistory(items); setHistoryError(""); })
      .catch((e) => setHistoryError(errorText(e)));
  useEffect(() => {
    loadHistory();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    requestVersion.current += 1;
    setBusy(false);
    setError("");
    setConversation(null);
    setInput("");
    setImage(null);
    setImageName("");
    if (!id) {
      setLoading(false);
      setContext((previous) => ({ ...previous, topic }));
      if (attemptId) {
        setLoading(true);
        api.get(`/attempts/${attemptId}/result`, { signal: controller.signal })
          .then(({ data }) => {
            if (controller.signal.aborted) return;
            const result = data.data;
            setContext(previous => ({ ...previous, subject: (result.test?.subject?.name || '').slice(0, 120), topic: (result.test?.topic || '').slice(0, 200) }));
            const mistakes = (result.answers || []).filter((answer: { isCorrect: boolean }) => !answer.isCorrect);
            const details = mistakes.map((answer: { question: string; userAnswer: unknown; correctAnswer: unknown }) =>
              `Вопрос: ${answer.question}\nМой ответ: ${JSON.stringify(answer.userAnswer)}\nПравильный ответ: ${JSON.stringify(answer.correctAnswer)}`
            ).join('\n\n');
            setInput(`Помоги разобрать результат теста «${result.test?.title || ''}»: ${result.percentage}%. Объясни ошибки и задай вопросы для закрепления.\n\n${details || 'Ошибок нет. Помоги закрепить тему.'}`.slice(0, 16000));
          })
          .catch(e => { if (!controller.signal.aborted) setError(errorText(e)); })
          .finally(() => { if (!controller.signal.aborted) setLoading(false); });
      }
    } else {
      setLoading(true);
      getCompanion<Conversation>(`conversations/${id}`, controller.signal)
      .then((c) => {
        if (controller.signal.aborted) return;
        setConversation(c);
        setContext(c.context);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorText(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    }
    return () => { controller.abort(); requestVersion.current += 1; };
  }, [id, topic, attemptId]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "auto", block: "nearest" });
  }, [conversation, busy]);
  async function send(text = input) {
    if (!text.trim() || busy || loading || (id && conversation?.id !== id)) return;
    const version = requestVersion.current;
    setBusy(true);
    setError("");
    try {
      const result = await postCompanion<Conversation>("chat", {
        ...context,
        mode: conversation?.mode || mode,
        message: text,
        conversationId: conversation?.id,
        image,
      });
      if (version !== requestVersion.current) return;
      setConversation(result);
      setInput("");
      setImage(null);
      setImageName("");
      setParams({ conversation: result.id }, { replace: true });
      loadHistory();
    } catch (e) {
      if (version !== requestVersion.current) return;
      setError(errorText(e));
      if (axios.isAxiosError(e) && e.response?.status === 409 && id) {
        try {
          const latest = await getCompanion<Conversation>(`conversations/${id}`);
          if (version === requestVersion.current) setConversation(latest);
        } catch { /* Keep the original conflict and the unsent draft visible. */ }
      }
    } finally {
      if (version === requestVersion.current) setBusy(false);
    }
  }
  async function addNote(text: string) {
    try {
      await postCompanion("notes", {
        title: context.topic || conversation?.title || "Заметка из AI Tutor",
        content: text,
      });
      toast.success("Сохранено в заметки");
    } catch (e) {
      toast.error(errorText(e));
    }
  }
  function material(path: string, text: string) {
    navigate(path, { state: { source: text, context } });
  }
  async function selectImage(f?: File) {
    if (!f) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
      f.size > 4 * 1024 * 1024
    ) {
      setError("Выберите PNG, JPEG или WebP до 4 МБ.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImage(String(reader.result));
      setImageName(f.name);
    };
    reader.onerror = () => setError("Не удалось прочитать изображение.");
    reader.readAsDataURL(f);
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="УЧИСЬ В СВОЁМ ТЕМПЕ"
        title={info.name}
        description={info.description}
        action={
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => {
              setParams({});
              setConversation(null);
              setError("");
              setInput("");
              setImage(null);
            }}
          >
            <Plus size={17} />
            Новый разговор
          </button>
        }
      />
      <div className="panel context-panel">
        <ContextFields value={context} onChange={setContext} disabled={busy || loading} />
      </div>
      <div className="chat-layout">
        <section className="chat-workspace panel">
          {loading ? (
            <Loading />
          ) : conversation ? (
            <div className="messages" aria-label="Переписка">
              {conversation.messages.map((m, i) => (
                <article key={i} className={"chat-message " + m.role}>
                  <div className="message-author">
                    {m.role === "assistant" ? (
                      <>
                        <Sparkles size={16} /> Aituto
                      </>
                    ) : (
                      "Ты"
                    )}
                    {m.hadImage && (
                      <span className="muted small"> · изображение</span>
                    )}
                  </div>
                  <div className="markdown">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                  {m.role === "assistant" && (
                    <div className="message-actions">
                      <button
                        disabled={busy}
                        onClick={() =>
                          send(`Объясни проще этот фрагмент:\n\n${m.content.slice(0, 14000)}`)
                        }
                      >
                        Проще
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          send(
                            `Приведи понятный пример к этому фрагменту:\n\n${m.content.slice(0, 14000)}`,
                          )
                        }
                      >
                        Пример
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          send(`Кратко перескажи этот фрагмент:\n\n${m.content.slice(0, 14000)}`)
                        }
                      >
                        Короче
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => material("/quiz", m.content)}
                      >
                        <Brain size={14} /> Проверить себя
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => material("/flashcards", m.content)}
                      >
                        <Layers size={14} />
                        Карточки
                      </button>
                      <button onClick={() => addNote(m.content)}>
                        <FileText size={14} />В заметки
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="chat-welcome">
              <span className="welcome-icon">
                <Sparkles size={30} />
              </span>
              <h2>{info.title}</h2>
              <p>
                На твоём языке, с понятными примерами.
                <br />
                Начни с темы или вопроса, который не даёт покоя.
              </p>
              <div className="suggestions">
                {(mode === "homework"
                  ? [
                      "Как решить квадратное уравнение?",
                      "Помоги разобраться в условии задачи",
                    ]
                  : mode === "study"
                    ? [
                        "Подготовь меня к тесту по дробям",
                        "Повторим причины Французской революции",
                      ]
                    : mode === "term"
                      ? ["Absolutismus", "Фотосинтез"]
                      : [
                          "Объясни тему простыми словами",
                          "Warum ist der Himmel blau? Объясни по-русски",
                        ]
                ).map((s) => (
                  <button key={s} onClick={() => setInput(s)}>
                    {s}
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {busy && <Loading label="Aituto готовит объяснение…" />}
          {error && <ErrorNotice message={error} />}
          <div ref={bottom} />
          <form
            className="chat-composer"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label className="sr-only" htmlFor="question">
              Твой вопрос
            </label>
            <textarea
              id="question"
              placeholder={info.placeholder}
              value={input}
              maxLength={16000}
              disabled={busy || loading}
              onChange={(e) => setInput(e.target.value)}
              rows={3}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            {image && (
              <div className="attachment">
                <img src={image} alt="Прикреплённое задание" />
                <span>{imageName}</span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Убрать изображение"
                  disabled={busy}
                  onClick={() => setImage(null)}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="composer-bottom">
              <div className="row">
                <input
                  ref={file}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(e) => {
                    selectImage(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="icon-button"
                  title="Прикрепить изображение до 4 МБ"
                  aria-label="Прикрепить изображение"
                  disabled={busy}
                  onClick={() => file.current?.click()}
                >
                  <Paperclip size={20} />
                </button>
                <span className="small muted">
                  Enter — отправить · Shift + Enter — новая строка
                </span>
              </div>
              <button
                className="button primary"
                type="submit"
                disabled={!input.trim() || busy || loading}
              >
                <Send size={17} />
                <span>Отправить</span>
              </button>
            </div>
          </form>
          <p className="ai-footnote">
            AI может ошибаться. Сверяй важные ответы с учебником. Фото
            отправляется для разбора и не сохраняется в истории.
          </p>
        </section>
        <aside className="chat-history">
          <h3>Твои разговоры</h3>
          {historyError && <ErrorNotice message={historyError} />}
          <div className="history-list">
            {history.map((c) => (
              <Link
                key={c.id}
                className={c.id === id ? "selected" : ""}
                to={`${c.mode === "tutor" ? "/ai-tutor" : ["homework", "study", "term"].includes(c.mode) ? `/${c.mode}` : "/ai-tutor"}?conversation=${encodeURIComponent(c.id)}`}
              >
                {c.title}
              </Link>
            ))}
          </div>
          {!history.length && !historyError && (
            <p className="muted small">Здесь появятся сохранённые разговоры.</p>
          )}
          <div className="study-tip">
            <span className="eyebrow">МАЛЕНЬКИЙ СОВЕТ</span>
            <p>
              Объясни новую тему своими словами. Так проще заметить, что
              осталось непонятным.
            </p>
            <Link className="text-link" to="/feynman">
              Попробовать метод Фейнмана <ArrowRightIcon />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
function ArrowRightIcon() {
  return <ArrowUpRight size={15} />;
}
