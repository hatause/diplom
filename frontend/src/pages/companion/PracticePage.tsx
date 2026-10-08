import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import {
  Layers,
  Brain,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Check,
  X,
  Plus,
} from "lucide-react";
import {
  Context,
  Deck,
  Quiz,
  defaultContext,
  getCompanion,
  postCompanion,
  errorText,
} from "@/api/companion";
import {
  ContextFields,
  EmptyState,
  ErrorNotice,
  Loading,
  PageHeader,
} from "@/components/CompanionUI";
export function PracticePage({ kind }: { kind: "decks" | "quizzes" }) {
  const location = useLocation();
  const flash = kind === "decks";
  const [context, setContext] = useState<Context>(
    location.state?.context || defaultContext,
  );
  const [source, setSource] = useState(location.state?.source || "");
  const [count, setCount] = useState(5);
  const [items, setItems] = useState<(Deck | Quiz)[]>([]);
  const [active, setActive] = useState<Deck | Quiz | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  function load() {
    const controller = new AbortController();
    setLoading(true);
    getCompanion<(Deck | Quiz)[]>(kind, controller.signal)
      .then((items) => { if (!controller.signal.aborted) setItems(items); })
      .catch((e) => { if (!controller.signal.aborted) setError(errorText(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }
  useEffect(load, [kind]);
  function open(item: Deck | Quiz) {
    setActive(item);
    setIndex(
      "answers" in item
        ? Math.min(item.answers.length, item.questions.length - 1)
        : 0,
    );
    setFlipped(false);
    setFeedback(false);
    setAnswer("");
    setError("");
  }
  async function resume(item: Deck | Quiz) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const latest = await getCompanion<Deck | Quiz>(`${kind}/${item.id}`);
      open(latest);
      update(latest);
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }
  async function generate() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await postCompanion<Deck | Quiz>(kind, {
        ...context,
        source,
        count,
      });
      open(result);
      setItems((old) => [result, ...old]);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  function update(item: Deck | Quiz) {
    setActive(item);
    setItems((old) => old.map((x) => (x.id === item.id ? item : x)));
  }
  async function review(known: boolean) {
    if (!active || busy) return;
    setBusy(true);
    setError("");
    try {
      update(
        await postCompanion<Deck>(`decks/${active.id}/review`, {
          index,
          known,
        }),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!active || !answer.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      update(
        await postCompanion<Quiz>(`quizzes/${active.id}/answer`, {
          index,
          answer,
        }),
      );
      setFeedback(true);
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        try {
          const latest = await getCompanion<Quiz>(`quizzes/${active.id}`);
          open(latest);
          update(latest);
          setError("Ответ уже сохранён в другой вкладке. Прогресс обновлён — можно продолжить.");
        } catch (refreshError) { setError(errorText(refreshError)); }
      } else setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const deck = active && "cards" in active ? active : null;
  const quiz = active && "questions" in active ? active : null;
  const q = quiz?.questions[index];
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="МАЛЕНЬКИЕ ШАГИ. ПРОЧНЫЕ ЗНАНИЯ."
        title={flash ? "Карточки" : "Проверь себя"}
        description={
          flash
            ? "Вспомни ответ, переверни карточку и отметь, что уже знаешь."
            : "Три формата вопросов. Обратная связь после каждого ответа."
        }
        action={
          active && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setActive(null)}
            >
              <Plus size={17} />
              Новый набор
            </button>
          )
        }
      />
      {error && <ErrorNotice message={error} />}
      {active ? (
        <section className="panel practice-panel">
          <div className="section-heading">
            <h2>{active.title}</h2>
            <span className="pill">
              {deck
                ? `${index + 1} / ${deck.cards.length}`
                : `${quiz!.answers.length} / ${quiz!.questions.length}`}
            </span>
          </div>
          {deck && (
            <>
              <div className="progress-track">
                <div
                  style={{
                    width: `${(100 * deck.known.length) / deck.cards.length}%`,
                  }}
                />
              </div>
              <p className="small muted">
                Знаю {deck.known.length} из {deck.cards.length}
              </p>
              <button
                className={"flashcard" + (flipped ? " flipped" : "")}
                onClick={() => setFlipped(!flipped)}
                aria-label={flipped ? "Показать вопрос" : "Показать ответ"}
              >
                <span className="eyebrow">{flipped ? "ОТВЕТ" : "ВОПРОС"}</span>
                <span>
                  {flipped
                    ? deck.cards[index].answer
                    : deck.cards[index].question}
                </span>
                <small>
                  <RotateCw size={15} /> Нажми, чтобы перевернуть
                </small>
              </button>
              <div className="practice-controls">
                <button
                  className="button secondary"
                  disabled={busy || index === 0}
                  onClick={() => {
                    setIndex(index - 1);
                    setFlipped(false);
                  }}
                >
                  <ChevronLeft size={18} />
                  Назад
                </button>
                <div className="row">
                  <button
                    className="button secondary"
                    disabled={busy || !flipped}
                    onClick={() => review(false)}
                  >
                    <RotateCw size={16} />
                    Повторить
                  </button>
                  <button
                    className="button primary"
                    disabled={busy || !flipped}
                    onClick={() => review(true)}
                  >
                    <Check size={16} />
                    {deck.known.includes(index) ? "Уже знаю" : "Знаю"}
                  </button>
                </div>
                <button
                  className="button secondary"
                  disabled={busy || index === deck.cards.length - 1}
                  onClick={() => {
                    setIndex(index + 1);
                    setFlipped(false);
                  }}
                >
                  Дальше
                  <ChevronRight size={18} />
                </button>
              </div>
            </>
          )}
          {quiz &&
            (quiz.completed ? (
              <>
                <div className="quiz-score">
                  <span className="welcome-icon">
                    <Check size={32} />
                  </span>
                  <h2>Есть результат!</h2>
                  <strong>{quiz.percentage}%</strong>
                  <p>
                    Верно {quiz.score} из {quiz.questions.length}
                  </p>
                </div>
                <h3>Что повторить</h3>
                <p className="muted">
                  {quiz.weakTopics?.join(" · ") ||
                    "Все ответы верны. Можно перейти к более сложной теме."}
                </p>
                <div className="answer-review">
                  {quiz.questions.map((item, i) => (
                    <article key={i}>
                      <span
                        className={
                          "pill " +
                          (quiz.answers[i].correct ? "positive" : "negative")
                        }
                      >
                        {quiz.answers[i].correct ? "Верно" : "Ошибка"}
                      </span>
                      <h3>{item.question}</h3>
                      <p>Твой ответ: {quiz.answers[i].answer}</p>
                      <p>Правильный ответ: {item.answer}</p>
                      <p className="muted">{item.explanation}</p>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              q && (
                <div className="quiz-question">
                  <p className="eyebrow">
                    ВОПРОС {index + 1} ·{" "}
                    {q.type === "short_answer"
                      ? "КОРОТКИЙ ОТВЕТ"
                      : q.type === "true_false"
                        ? "ВЕРНО ИЛИ НЕВЕРНО"
                        : "ВЫБЕРИ ОТВЕТ"}
                  </p>
                  <h2>{q.question}</h2>
                  {q.type === "short_answer" ? (
                    <label>
                      Твой ответ
                      <input
                        value={answer}
                        disabled={feedback || busy}
                        maxLength={2000}
                        onChange={(e) => setAnswer(e.target.value)}
                      />
                      <small className="muted">
                        Одно слово или число. Проверяется совпадение с эталоном
                        без учёта регистра.
                      </small>
                    </label>
                  ) : (
                    <fieldset className="quiz-options">
                      <legend className="sr-only">Варианты ответа</legend>
                      {q.options.map((option, i) => (
                        <label
                          className={answer === option ? "selected" : ""}
                          key={i}
                        >
                          <input
                            type="radio"
                            name="answer"
                            checked={answer === option}
                            value={option}
                            disabled={busy || feedback}
                            onChange={() => setAnswer(option)}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </fieldset>
                  )}
                  {feedback ? (
                    <div className="quiz-feedback" role="status">
                      <h3>
                        {quiz.answers[index]?.correct ? (
                          <>
                            <Check size={18} />
                            Верно
                          </>
                        ) : (
                          <>
                            <X size={18} />
                            Пока неверно
                          </>
                        )}
                      </h3>
                      <p>Правильный ответ: {q.answer}</p>
                      <p>{q.explanation}</p>
                      <button
                        className="button primary"
                        onClick={() => {
                          setIndex(index + 1);
                          setAnswer("");
                          setFeedback(false);
                        }}
                      >
                        Следующий вопрос
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="button primary"
                      disabled={!answer.trim() || busy}
                      onClick={submit}
                    >
                      Проверить ответ
                      <Check size={17} />
                    </button>
                  )}
                </div>
              )
            ))}
        </section>
      ) : (
        <form
          className="panel page-stack"
          onSubmit={(e) => {
            e.preventDefault();
            generate();
          }}
        >
          <ContextFields
            value={context}
            onChange={setContext}
            disabled={busy}
          />
          <label>
            Тема или материал
            <textarea
              value={source}
              maxLength={20000}
              rows={6}
              onChange={(e) => setSource(e.target.value)}
              required
              placeholder="Вставь текст, заметку или опиши тему…"
              disabled={busy}
            />
          </label>
          <div className="row spread">
            <label>
              Количество
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                disabled={busy}
              >
                {[3, 5, 8, 10, 15].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <button
              className="button primary"
              disabled={busy || !source.trim()}
            >
              {flash ? <Layers size={18} /> : <Brain size={18} />}Создать{" "}
              {flash ? "карточки" : "викторину"}
            </button>
          </div>
          {busy && <Loading label="Готовим материал по твоей теме…" />}
        </form>
      )}
      <section>
        <div className="section-heading">
          <h2>{flash ? "Твои наборы" : "Твои викторины"}</h2>
          <span className="small muted">Сохраняются автоматически</span>
        </div>
        {loading ? (
          <Loading />
        ) : items.length ? (
          <div className="material-grid">
            {items.map((item) => (
              <button
                className="panel material-card"
                disabled={busy}
                key={item.id}
                onClick={() => resume(item)}
              >
                {flash ? <Layers size={22} /> : <Brain size={22} />}
                <h3>{item.title}</h3>
                <p className="muted">
                  {"cards" in item
                    ? `${item.cards.length} карточек · ${item.known.length} знаю`
                    : item.completed
                      ? `${item.percentage}% · Завершена`
                      : `${item.answers.length} из ${item.questions.length} ответов`}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            title={
              flash
                ? "Твой первый набор ещё впереди"
                : "Начни с первой викторины"
            }
          >
            Выбери тему и создай материал выше.
          </EmptyState>
        )}
      </section>
    </div>
  );
}
