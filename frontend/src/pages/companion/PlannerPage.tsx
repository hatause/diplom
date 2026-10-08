import { useEffect, useState } from "react";
import { Plus, Check, PenLine, Brain } from "lucide-react";
import { api } from "@/api/client";
import { Task, getCompanion, postCompanion, errorText } from "@/api/companion";
import {
  EmptyState,
  ErrorNotice,
  Loading,
  PageHeader,
} from "@/components/CompanionUI";
export function PlannerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [kind, setKind] = useState<"homework" | "test">("homework");
  const [due, setDue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getCompanion<Task[]>("tasks")
      .then(setTasks)
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, []);
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const task = await postCompanion<Task>("tasks", {
        title,
        subject,
        kind,
        dueAt: new Date(due).toISOString(),
      });
      setTasks((old) => [task, ...old]);
      setTitle("");
      setDue("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function toggle(task: Task) {
    setBusy(true);
    setError("");
    try {
      const result = (
        await api.patch(`/companion/tasks/${task.id}`, { done: !task.done })
      ).data.data;
      setTasks((old) => old.map((t) => (t.id === task.id ? result : t)));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="ОСВОБОДИ МЕСТО В ГОЛОВЕ"
        title="Задания и тесты"
        description="Запиши сроки. Всё ближайшее появится на главной."
      />
      {error && <ErrorNotice message={error} />}
      <form
        className="panel page-stack"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="two-columns">
          <label>
            Что нужно сделать?
            <input
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например, подготовиться к контрольной"
            />
          </label>
          <label>
            Предмет
            <input
              value={subject}
              maxLength={120}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Математика"
            />
          </label>
        </div>
        <div className="two-columns">
          <label>
            Тип
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="homework">Домашнее задание</option>
              <option value="test">Тест / контрольная</option>
            </select>
          </label>
          <label>
            Срок · местное время
            <input
              type="datetime-local"
              required
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
        </div>
        <div>
          <button
            className="button primary"
            disabled={busy || !title.trim() || !due}
          >
            <Plus size={17} />
            Добавить в план
          </button>
        </div>
      </form>
      <section className="panel">
        <h2>Твой план</h2>
        {loading ? (
          <Loading />
        ) : tasks.length ? (
          [...tasks]
            .sort(
              (a, b) =>
                Number(a.done) - Number(b.done) ||
                Date.parse(a.dueAt) - Date.parse(b.dueAt),
            )
            .map((t) => (
              <div
                key={t.id}
                className={"task-row" + (t.done ? " completed" : "")}
              >
                <button
                  className="task-checkbox"
                  disabled={busy}
                  aria-label={
                    t.done ? "Вернуть в план" : "Отметить выполненным"
                  }
                  aria-pressed={t.done}
                  onClick={() => toggle(t)}
                >
                  {t.done ? (
                    <Check size={18} />
                  ) : t.kind === "test" ? (
                    <Brain size={18} />
                  ) : (
                    <PenLine size={18} />
                  )}
                </button>
                <div>
                  <strong>{t.title}</strong>
                  <small>
                    {t.subject} ·{" "}
                    {t.kind === "test" ? "Тест" : "Домашняя работа"}
                  </small>
                </div>
                <time
                  className={
                    !t.done && Date.parse(t.dueAt) < Date.now() ? "overdue" : ""
                  }
                >
                  {new Date(t.dueAt).toLocaleString("ru", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
            ))
        ) : (
          <EmptyState title="Пока никаких дедлайнов">
            Добавь первое задание выше.
          </EmptyState>
        )}
      </section>
    </div>
  );
}
