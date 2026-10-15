import { PcLabCard } from '@/features/pc-lab/PcLabCard';
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  Layers,
  DoorOpen,
  BookOpen,
  Check,
  Moon,
  Sun,
  MoveUpRight,
  Globe2,
  CheckCheck,
  Plus,
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useThemeStore } from "@/store/theme.store";

const examples = [
  {
    label: "Разобраться",
    title: "Сложная тема. Простыми словами.",
    prompt: "Что такое Absolutismus? Объясни по-русски.",
    heading: "Вся власть — у монарха.",
    text: "Absolutismus (абсолютизм) — форма правления, при которой верховная власть сосредоточена в руках монарха.",
    note: "Представь государство, в котором главные решения принимает один правитель. Это поможет запомнить суть.",
    route: "/ai-tutor",
    tag: "История · 8 класс",
  },
  {
    label: "Решить задание",
    title: "Понять каждый шаг решения.",
    prompt: "Как решить уравнение 3x + 6 = 21?",
    heading: "Давай найдём x вместе.",
    text: "Сначала вычтем 6 из обеих частей: 3x = 15. Теперь разделим обе части на 3. Получаем x = 5.",
    note: "Проверим: 3 × 5 + 6 = 21. Обе части равны — решение верное.",
    route: "/homework",
    tag: "Математика · 6 класс",
  },
  {
    label: "Запомнить",
    title: "Маленькие карточки. Большая польза.",
    prompt: "Помоги запомнить, что такое фотосинтез.",
    heading: "Как растения получают энергию?",
    text: "Во время фотосинтеза растения используют свет, воду и углекислый газ, чтобы образовать органические вещества. При этом выделяется кислород.",
    note: "Сначала попробуй ответить сам. Затем переверни карточку и отметь, что уже знаешь.",
    route: "/flashcards",
    tag: "Биология · Карточки",
  },
  {
    label: "Проверить себя",
    title: "Ошибки — тоже часть обучения.",
    prompt: "Проверь, как я разобрался в дробях.",
    heading: "Что больше: ½ или ¼?",
    text: "Если разделить одинаковые пироги на 2 и на 4 части, половинка будет больше четвертинки. Поэтому ½ > ¼.",
    note: "После каждого вопроса — объяснение. В конце — результат и темы, которые стоит повторить.",
    route: "/quiz",
    tag: "Математика · Викторина",
  },
];

export function LandingPage() {
  const { isAuthenticated } = useAuthStore();
  const { theme, toggle } = useThemeStore();
  const [selected, setSelected] = useState(0);
  const example = examples[selected];
  const start = isAuthenticated ? "/dashboard" : "/register";
  const studyLink = (path: string) => (isAuthenticated ? path : "/register");

  return (
    <div className="warm-landing">
      <div className="ambient-light ambient-one" aria-hidden="true" />
      <div className="ambient-light ambient-two" aria-hidden="true" />
      <header className="warm-nav glass-surface">
        <Link className="warm-wordmark" to="/" aria-label="Aituto — главная">
          <span className="logo-flower" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          aituto<span className="logo-period">.</span>
        </Link>
        <nav className="warm-nav-links" aria-label="Разделы главной">
          <a href="#possibilities">Возможности</a>
          <a href="#how-it-works">Как это работает</a>
          <Link to="/pc-lab">3D Тренажёр ПК и ОС</Link>
        </nav>
        <div className="row">
          <button
            className="icon-button theme-switch"
            onClick={toggle}
            aria-label={
              theme === "dark"
                ? "Включить светлую тему"
                : "Включить тёмную тему"
            }
          >
            {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <Link
            className="warm-nav-login"
            to={isAuthenticated ? "/dashboard" : "/login"}
          >
            {isAuthenticated ? "В приложение" : "Войти"}
            <ArrowUpRight size={17} />
          </Link>
        </div>
      </header>

      <main>
        <section className="warm-hero">
          <div className="hero-editorial">
            <span className="warm-kicker">
              <span className="tiny-star" /> ТВОЙ AI SCHOOL COMPANION
            </span>
            <h1>
              Учёба,
              <br />в которой
              <br />
              <span>всё понятно.</span>
            </h1>
            <p className="hero-intro">
              От первого «почему?» до уверенного «я понял».
              <br className="desktop-break" /> Твой AI-помощник для учёбы и
              школьного дня.
            </p>
            <div className="hero-actions">
              <Link className="warm-button" to={start}>
                Начать свой путь{" "}
                <span>
                  <ArrowUpRight size={20} />
                </span>
              </Link>
              <a className="hero-explore" href="#how-it-works">
                <span>
                  <ArrowDown size={17} />
                </span>
                Посмотреть ближе
              </a>
            </div>
            <div className="hero-caption">
              <span className="caption-line" /> В твоём темпе. На твоём языке.
            </div>
          </div>

          <div
            className="hero-sculpture"
            aria-label="Учебное пространство Aituto"
          >
            <div className="sculpture-halo" aria-hidden="true" />
            <div className="sculpture-orbit" aria-hidden="true" />
            <div className="glass-blossom" aria-hidden="true">
              <div className="glass-petal petal-1" />
              <div className="glass-petal petal-2" />
              <div className="glass-petal petal-3" />
              <div className="glass-petal petal-4" />
              <div className="glass-petal petal-5" />
              <div className="glass-petal petal-6" />
              <div className="blossom-heart">
                <Sparkles size={38} strokeWidth={1.2} />
              </div>
            </div>
            <div className="floating-note note-question glass-surface">
              <span className="note-avatar">
                <Sparkles size={19} />
              </span>
              <div>
                <small>ЛЮБОПЫТСТВО ПРИВЕТСТВУЕТСЯ</small>
                <strong>А почему это работает?</strong>
              </div>
              <span className="note-dot" />
            </div>
            <div className="floating-note note-concept glass-surface">
              <div className="note-concept-top">
                <span>ОДНА ИДЕЯ ЗА РАЗ</span>
                <BookOpen size={18} />
              </div>
              <div className="concept-formula">a² + b² = c²</div>
              <div className="concept-bottom">
                <span className="concept-check">
                  <Check size={13} />
                </span>
                Сложное становится понятным.
              </div>
            </div>
            <Link
              to={studyLink("/notes")}
              className="floating-note note-saved glass-surface"
            >
              <span className="saved-icon">
                <CheckCheck size={20} />
              </span>
              <span>
                Понять.
                <br />
                <strong>И сохранить.</strong>
              </span>
              <ArrowUpRight size={16} />
            </Link>
            <span className="sculpture-label">
              MADE FOR YOUR NEXT DISCOVERY
            </span>
          </div>
        </section>

        <div className="capabilities-ribbon">
          <span>
            МЕНЬШЕ СТРЕССА.
            <br />
            <strong>БОЛЬШЕ СМЫСЛА.</strong>
          </span>
          <div>
            <Sparkles size={18} />
            <span>Объясняет Gemini AI</span>
          </div>
          <div>
            <Globe2 size={18} />
            <span>4 языка обучения</span>
          </div>
          <div>
            <Layers size={18} />
            <span>От темы до практики</span>
          </div>
          <div>
            <DoorOpen size={18} />
            <span>Весь школьный день</span>
          </div>
        </div>

        <PcLabCard preview/>
        <section id="possibilities" className="warm-features">
          <div className="section-editorial">
            <span className="warm-kicker">01 / ВОЗМОЖНОСТИ</span>
            <div>
              <h2>
                Для всего, что
                <br />
                хочется <em>понять.</em>
              </h2>
              <p>
                Не нужно справляться со всем в одиночку.
                <br />
                Рядом — инструменты для каждого шага.
              </p>
            </div>
          </div>
          <div className="feature-bento">
            <Link
              to={studyLink("/ai-tutor")}
              className="bento-card bento-tutor glass-surface"
            >
              <div className="bento-top">
                <span className="feature-number">01</span>
                <span className="round-arrow">
                  <ArrowUpRight size={20} />
                </span>
              </div>
              <div className="tutor-card-art" aria-hidden="true">
                <span className="art-question">Почему?</span>
                <span className="art-answer">
                  <Sparkles size={16} /> Давай разберёмся.
                </span>
                <span className="art-line" />
              </div>
              <div className="bento-copy">
                <span className="warm-kicker">AI TUTOR</span>
                <h3>
                  Вопросы любые.
                  <br />
                  Объяснения — понятные.
                </h3>
                <p>
                  Класс, предмет, тема и твой язык.
                  <br />
                  Помощник подстраивается под тебя.
                </p>
              </div>
            </Link>
            <Link
              to={studyLink("/flashcards")}
              className="bento-card bento-practice glass-surface"
            >
              <div className="bento-top">
                <span className="feature-number">02</span>
                <span className="round-arrow">
                  <ArrowUpRight size={20} />
                </span>
              </div>
              <div className="mini-card-stack" aria-hidden="true">
                <div />
                <div />
                <div>
                  <Layers size={23} />
                  <span>Уже знаю.</span>
                  <Check size={18} />
                </div>
              </div>
              <div className="bento-copy">
                <span className="warm-kicker">ПРАКТИКА</span>
                <h3>
                  Не зазубрить.
                  <br />А запомнить.
                </h3>
                <p>
                  Карточки, короткие викторины
                  <br />и подготовка к тестам.
                </p>
              </div>
            </Link>
            <Link
              to={studyLink("/dashboard")}
              className="bento-card bento-school glass-surface"
            >
              <div className="bento-top">
                <span className="feature-number">03</span>
                <span className="round-arrow">
                  <ArrowUpRight size={20} />
                </span>
              </div>
              <div className="school-card-art" aria-hidden="true">
                <div className="school-pin">
                  <DoorOpen size={29} strokeWidth={1.3} />
                </div>
                <span className="map-path" />
                <span className="map-stop" />
              </div>
              <div className="bento-copy">
                <span className="warm-kicker">ТВОЙ ДЕНЬ</span>
                <h3>
                  Всё нужное.
                  <br />
                  На своём месте.
                </h3>
                <p>
                  Расписание, задания, заметки
                  <br />и поиск свободного кабинета.
                </p>
              </div>
            </Link>
          </div>
        </section>

        <section id="how-it-works" className="warm-demo">
          <div className="demo-editorial">
            <span className="warm-kicker">02 / УЧЁБА БЕЗ ЛИШНЕГО ШУМА</span>
            <h2>
              Твой вопрос.
              <br />
              Твой маленький
              <br />
              <em>прорыв.</em>
            </h2>
            <p>
              Иногда достаточно другого объяснения,
              <br />
              чтобы всё встало на свои места.
            </p>
            <div
              className="demo-tabs"
              role="tablist"
              aria-label="Примеры учебных режимов"
            >
              {examples.map((item, i) => (
                <button
                  key={item.label}
                  type="button"
                  role="tab"
                  id={`mode-tab-${i}`}
                  aria-controls="mode-example"
                  aria-selected={selected === i}
                  tabIndex={selected === i ? 0 : -1}
                  onClick={() => setSelected(i)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                      e.preventDefault();
                      const next =
                        (i +
                          (e.key === "ArrowRight" ? 1 : -1) +
                          examples.length) %
                        examples.length;
                      setSelected(next);
                      document.getElementById(`mode-tab-${next}`)?.focus();
                    }
                  }}
                >
                  {item.label}
                  {selected === i && <ArrowRight size={15} />}
                </button>
              ))}
            </div>
            <Link className="text-link" to={studyLink(example.route)}>
              Попробовать с моей темой <ArrowUpRight size={17} />
            </Link>
          </div>
          <div
            className="demo-window glass-surface"
            id="mode-example"
            role="tabpanel"
            aria-labelledby={`mode-tab-${selected}`}
          >
            <div className="demo-window-top">
              <span className="row">
                <Sparkles size={18} />
                <strong>aituto</strong>
              </span>
              <span className="example-label">Пример, не живой чат</span>
              <span className="window-dots">
                <i />
                <i />
                <i />
              </span>
            </div>
            <div className="demo-window-body" key={selected}>
              <span className="demo-subject">{example.tag}</span>
              <div className="demo-user-message">
                {example.prompt}
                <span>Ты</span>
              </div>
              <div className="demo-ai-message">
                <span className="demo-ai-icon">
                  <Sparkles size={18} />
                </span>
                <div>
                  <small>AITUTO</small>
                  <h3>{example.heading}</h3>
                  <p>{example.text}</p>
                  <div className="demo-insight">
                    <span>
                      <BookOpen size={16} />
                    </span>
                    {example.note}
                  </div>
                </div>
              </div>
              <Link className="demo-note-action" to={studyLink("/notes")}>
                <Plus size={14} />
                Собирай свою базу знаний
                <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="demo-composer">
              <span>А что хочешь понять ты?</span>
              <Link
                to={studyLink(example.route)}
                aria-label="Задать свой вопрос"
              >
                <ArrowUpRight size={20} />
              </Link>
            </div>
          </div>
        </section>

        <section id="your-space" className="warm-language-section">
          <span className="warm-kicker">03 / ОБЪЯСНЕНИЕ, КОТОРОЕ БЛИЗКО</span>
          <h2>
            На языке,
            <br />
            на котором <em>думаешь.</em>
          </h2>
          <p>
            Задание на немецком, объяснение на русском?
            <br />
            Легко. Важные термины останутся на языке оригинала.
          </p>
          <div className="language-chips">
            <span>
              Привет<span>RU</span>
            </span>
            <span>
              Hello<span>EN</span>
            </span>
            <span>
              Hallo<span>DE</span>
            </span>
            <span>
              Привіт<span>UK</span>
            </span>
          </div>
        </section>
        <section className="warm-final-cta">
          <span className="warm-kicker">НОВАЯ ТЕМА. НОВАЯ ВОЗМОЖНОСТЬ.</span>
          <h2>
            Всё начинается
            <br />с одного <em>вопроса.</em>
          </h2>
          <Link className="warm-button" to={start}>
            Задать свой{" "}
            <span>
              <ArrowUpRight size={20} />
            </span>
          </Link>
          <div className="cta-orbit" aria-hidden="true" />
          <Sparkles
            className="cta-star"
            size={70}
            strokeWidth={0.7}
            aria-hidden="true"
          />
        </section>
      </main>
      <footer className="warm-footer">
        <div className="footer-top">
          <Link className="warm-wordmark" to="/">
            aituto<span className="logo-period">.</span>
          </Link>
          <p>
            Место для твоего
            <br />
            следующего открытия.
          </p>
          <a href="#" className="back-top">
            Наверх
            <MoveUpRight size={17} />
          </a>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Aituto</span>
          <span>AI School Companion</span>
          <span>Создано для любопытных.</span>
        </div>
      </footer>
    </div>
  );
}
export default LandingPage;
