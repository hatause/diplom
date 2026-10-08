import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Plus, Save, Layers, Trash2, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { Note, getCompanion, postCompanion, errorText } from "@/api/companion";
import {
  EmptyState,
  ErrorNotice,
  Loading,
  PageHeader,
} from "@/components/CompanionUI";
export function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState<Note | null>(null);
  const [selected, setSelected] = useState<Note | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    getCompanion<Note[]>("notes")
      .then(setNotes)
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  }, []);
  async function save() {
    if (!draft || busy) return;
    setBusy(true);
    setError("");
    try {
      const note = draft.id
        ? (
            await api.put(`/companion/notes/${draft.id}`, {
              title: draft.title,
              content: draft.content,
            })
          ).data.data
        : await postCompanion<Note>("notes", {
            title: draft.title,
            content: draft.content,
          });
      setNotes((old) =>
        draft.id
          ? old.map((n) => (n.id === note.id ? note : n))
          : [note, ...old],
      );
      setSelected(note);
      setDraft(null);
      toast.success("Заметка сохранена");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!selected || !window.confirm("Удалить эту заметку?")) return;
    setBusy(true);
    try {
      await api.delete(`/companion/notes/${selected.id}`);
      setNotes((old) => old.filter((n) => n.id !== selected.id));
      setSelected(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="СОХРАНИ ТО, ЧТО ВАЖНО"
        title="Твои заметки"
        description="Объяснения, идеи и маленькие открытия — в одном месте."
        action={
          <button
            disabled={busy}
            className="button primary"
            onClick={() => {
              setDraft({ id: "", title: "", content: "" });
              setSelected(null);
            }}
          >
            <Plus size={17} />
            Новая заметка
          </button>
        }
      />
      {error && <ErrorNotice message={error} />}
      {draft ? (
        <form
          className="panel page-stack"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label>
            Название
            <input
              value={draft.title}
              maxLength={200}
              required
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label>
            Текст · поддерживает Markdown
            <textarea
              rows={14}
              maxLength={30000}
              required
              value={draft.content}
              onChange={(e) => setDraft({ ...draft, content: e.target.value })}
            />
          </label>
          <div className="row">
            <button className="button primary" disabled={busy}>
              <Save size={17} />
              Сохранить
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              <X size={17} />
              Отмена
            </button>
          </div>
        </form>
      ) : selected ? (
        <article className="panel page-stack">
          <div className="section-heading">
            <h2>{selected.title}</h2>
            <button
              className="icon-button"
              aria-label="Закрыть заметку"
              onClick={() => setSelected(null)}
            >
              <X size={19} />
            </button>
          </div>
          <div className="markdown">
            <ReactMarkdown>{selected.content}</ReactMarkdown>
          </div>
          <div className="row wrap">
            <button
              className="button secondary"
              onClick={() => setDraft(selected)}
            >
              <Pencil size={16} />
              Изменить
            </button>
            <button
              className="button secondary"
              onClick={() =>
                navigate("/flashcards", { state: { source: selected.content } })
              }
            >
              <Layers size={16} />
              Создать карточки
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={remove}
            >
              <Trash2 size={16} />
              Удалить
            </button>
          </div>
        </article>
      ) : null}
      {loading ? (
        <Loading />
      ) : notes.length ? (
        <div className="material-grid">
          {notes.map((n) => (
            <button
              className="panel note-card"
              key={n.id}
              disabled={busy}
              onClick={() => {
                setSelected(n);
                setDraft(null);
              }}
            >
              <span className="eyebrow">ЗАМЕТКА</span>
              <h3>{n.title}</h3>
              <p>{n.content.slice(0, 180)}</p>
            </button>
          ))}
        </div>
      ) : (
        !draft && (
          <EmptyState title="Здесь будет твоя база знаний">
            Создай заметку или сохрани полезный ответ AI Tutor.
          </EmptyState>
        )
      )}
    </div>
  );
}
