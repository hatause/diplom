/* Browser regressions for UI state and failed requests.
   Start Vite, then run PLAYWRIGHT_MODULE=/path/to/playwright node scripts/check-ui-regressions.cjs.
   API responses are intercepted: these checks never create or modify server records. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.UI_TEST_URL || 'http://localhost:5173';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Use a local development server');
const user = { id: 'ui-review-student', email: 'qa@example.test', firstName: 'QA', lastName: 'Student', role: 'STUDENT' };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const json = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: status < 400, data }) });
let checks = 0;
function check(condition, description) { assert.ok(condition, description); checks++; console.log('PASS', description); }
async function navigate(page, path) {
  await page.evaluate(next => { history.pushState({}, '', next); dispatchEvent(new PopStateEvent('popstate')); }, path);
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  async function setup(handler) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => localStorage.setItem('aitutor-token', 'ui-regression-token'));
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
      if (path === '/auth/me') return json(route, user);
      if (await handler(route, path)) return;
      return json(route, []);
    });
    return { page, context };
  }
  try {
    // Switching contacts must not carry one recipient's draft to another.
    {
      const sent = deferred(), release = deferred(), settled = deferred();
      const { page, context } = await setup(async (route, path) => {
        if (path === '/messages/contacts') await json(route, [{ id: 'alice', firstName: 'Alice', lastName: 'QA' }, { id: 'bob', firstName: 'Bob', lastName: 'QA' }]);
        else if (path === '/messages' && route.request().method() === 'POST') {
          sent.resolve(route.request().postDataJSON()); await release.promise;
          try { await json(route, null, 503); } finally { settled.resolve(); }
        } else if (path.startsWith('/messages/')) await json(route, []);
        else return false;
        return true;
      });
      await page.goto(base + '/messages');
      const alice = page.locator('[class*="border-l-4"]').filter({ hasText: 'Alice QA' });
      const bob = page.locator('[class*="border-l-4"]').filter({ hasText: 'Bob QA' });
      const input = page.getByPlaceholder('Введите сообщение...');
      await alice.click(); await input.fill('Только для Alice');
      await bob.click();
      check(await input.inputValue() === '', 'Changing recipient opens an independent empty draft');
      await input.fill('Только для Bob'); await alice.click();
      check(await input.inputValue() === 'Только для Alice', 'Returning to contact restores their draft');
      await page.getByRole('button', { name: 'Отправить сообщение' }).click();
      check((await sent.promise).receiverId === 'alice', 'Message submission preserves the intended recipient');
      check(await input.isDisabled(), 'Composer is locked while a message is being sent');
      await bob.click(); release.resolve(); await settled.promise;
      await page.getByText('Сервер временно недоступен. Попробуйте позже.').waitFor();
      check(await input.inputValue() === 'Только для Bob', 'Failed send leaves another contact draft intact');
      await alice.click();
      check(await input.inputValue() === 'Только для Alice', 'Failed send restores the original contact draft');
      await context.close();
    }
    // A server error is actionable, rather than an apparently empty lecture list.
    {
      let offline = true;
      const { page, context } = await setup(async (route, path) => {
        if (path !== '/lectures/public') return false;
        await json(route, [], offline ? 503 : 200); return true;
      });
      await page.goto(base + '/lectures');
      await page.getByRole('alert').waitFor();
      check(await page.getByText('Для вас пока нет доступных лекций').count() === 0, 'Lecture loading failure does not masquerade as an empty list');
      offline = false; await page.getByRole('button', { name: 'Повторить', exact: true }).click();
      await page.getByText('Для вас пока нет доступных лекций').waitFor();
      check(await page.getByRole('alert').count() === 0, 'Lecture retry recovers after service availability returns');
      await context.close();
    }
    // Navigation between attempt IDs must reset both the result and its analysis.
    {
      const started = deferred(), release = deferred(), settled = deferred();
      const result = id => ({ test: { title: `Attempt ${id}`, difficulty: 'medium', subject: { name: 'QA' } }, percentage: 80, correctCount: 1, wrongCount: 0, skippedCount: 0, answers: [] });
      const { page, context } = await setup(async (route, path) => {
        if (/^\/attempts\/[ab]\/result$/.test(path)) await json(route, result(path.split('/')[2]));
        else if (path === '/ai/analyze-result') {
          started.resolve(); await release.promise;
          try { await json(route, { analysis: { summary: 'Analysis from attempt a' } }); } catch { /* Navigation aborts the old request. */ }
          finally { settled.resolve(); }
        } else return false;
        return true;
      });
      await page.goto(base + '/test/a/result'); await page.getByRole('heading', { name: 'Attempt a' }).waitFor();
      await page.getByRole('button', { name: 'Получить AI анализ' }).click(); await started.promise;
      await navigate(page, '/test/b/result'); await page.getByRole('heading', { name: 'Attempt b' }).waitFor();
      release.resolve(); await settled.promise;
      check(await page.getByText('Analysis from attempt a').count() === 0, 'Obsolete AI analysis cannot appear on another test result');
      check(await page.getByRole('button', { name: 'Получить AI анализ' }).isEnabled(), 'New attempt resets analysis loading state');
      await context.close();
    }
    for (const mode of ['feynman', 'debate']) {
      const started = deferred(), release = deferred(), settled = deferred();
      const session = id => ({ id, topic: `Topic ${id}`, status: 'active', difficulty: 1, roundNumber: 1, userPosition: 'За', aiPosition: 'Против', conversationHistory: [] });
      const { page, context } = await setup(async (route, path) => {
        if (path === `/${mode}/sessions/a` || path === `/${mode}/sessions/b`) await json(route, session(path.split('/').at(-1)));
        else if (path === `/${mode}/sessions/a/${mode === 'debate' ? 'argue' : 'explain'}`) {
          started.resolve(); await release.promise;
          try { await json(route, session('a')); } catch { /* Navigation aborts the old request. */ }
          finally { settled.resolve(); }
        } else return false;
        return true;
      });
      await page.goto(`${base}/${mode}?session=a`); await page.getByText('Тема: Topic a', { exact: true }).waitFor();
      await page.getByPlaceholder(mode === 'debate' ? 'Ваш аргумент...' : 'Объясните...').fill('Подробное объяснение для тестирования');
      await page.getByRole('button', { name: mode === 'debate' ? 'Аргументировать' : 'Ответить', exact: true }).click(); await started.promise;
      await navigate(page, `/${mode}?session=b`); await page.getByText('Тема: Topic b', { exact: true }).waitFor();
      release.resolve(); await settled.promise;
      check(await page.getByText('Тема: Topic b', { exact: true }).isVisible(), `${mode}: stale mutation does not replace the newly opened session`);
      check(await page.getByText('Тема: Topic a', { exact: true }).count() === 0, `${mode}: previous session is removed after navigation`);
      await context.close();
    }
    // Editing during a save previously allowed text to disappear with the old response.
    {
      const started = deferred(), release = deferred();
      const note = { id: 'note-a', title: 'Existing note', content: 'Existing content' };
      const { page, context } = await setup(async (route, path) => {
        if (path === '/companion/notes') await json(route, [note]);
        else if (path === '/companion/notes/note-a' && route.request().method() === 'PUT') {
          const draft = route.request().postDataJSON(); started.resolve(); await release.promise;
          await json(route, { ...note, ...draft });
        } else return false;
        return true;
      });
      await page.goto(base + '/notes'); await page.getByRole('button', { name: /Existing note/ }).click();
      await page.getByRole('button', { name: 'Изменить', exact: true }).click();
      const title = page.getByLabel('Название', { exact: true });
      const content = page.locator('form textarea');
      await title.fill('Saved title'); await content.fill('Saved content');
      await page.getByRole('button', { name: 'Сохранить', exact: true }).click(); await started.promise;
      check(await title.isDisabled() && await content.isDisabled(), 'Note fields cannot lose edits while a save is pending');
      check(await page.getByRole('button', { name: 'Новая заметка', exact: true }).isDisabled(), 'New-note action cannot replace a pending draft');
      release.resolve(); await page.getByRole('heading', { name: 'Saved title', exact: true }).first().waitFor();
      check(await page.locator('article').getByText('Saved content', { exact: true }).isVisible(), 'Saved note displays the submitted content');
      await context.close();
    }
    // Submitting a test locks its answer snapshot and keeps the confirmation modal open.
    {
      const started = deferred(), release = deferred();
      const attempt = { status: 'IN_PROGRESS', test: { title: 'Submit snapshot', questions: [{ id: 'q1', type: 'short_answer', question: 'Ответ?', options: [] }] } };
      const { page, context } = await setup(async (route, path) => {
        if (path === '/attempts/attempt-submit') await json(route, attempt);
        else if (path === '/tests/attempt-submit/submit') {
          started.resolve(route.request().postDataJSON()); await release.promise; await json(route, {});
        } else if (path === '/attempts/attempt-submit/result') await json(route, { test: { title: 'Submitted result' }, answers: [], percentage: 100 });
        else return false;
        return true;
      });
      await page.goto(base + '/test/attempt-submit/play');
      await page.getByPlaceholder('Введите ответ...').fill('42');
      await page.getByRole('button', { name: 'Завершить', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      await dialog.getByRole('button', { name: 'Завершить', exact: true }).click();
      const submitted = await started.promise;
      check(submitted.answers[0].userAnswer === '42', 'Test submission sends the current answer snapshot');
      await page.keyboard.press('Escape');
      check(await dialog.isVisible(), 'Pending test submission cannot be dismissed with Escape');
      check(await dialog.getByRole('button', { name: 'Отмена', exact: true }).isDisabled(), 'Pending test submission cannot be cancelled');
      check(await page.getByPlaceholder('Введите ответ...').isDisabled(), 'Answer fields are locked until submission completes');
      release.resolve(); await page.getByRole('heading', { name: 'Submitted result', exact: true }).waitFor();
      check(true, 'Successful submission opens the saved result');
      await context.close();
    }
    // Answers of all four types survive a reload before the server autosave interval.
    {
      let completed = false, submitted;
      const questions = [
        { id: 'single', type: 'single_choice', question: 'Single choice?', options: ['Right', 'Wrong'] },
        { id: 'multiple', type: 'multiple_choice', question: 'Multiple choice?', options: ['First', 'Second', 'Wrong'] },
        { id: 'boolean', type: 'true_false', question: 'True or false?' },
        { id: 'short', type: 'short_answer', question: 'Short answer?' },
      ];
      const { page, context } = await setup(async (route, path) => {
        if (path === '/attempts/quick-reload') await json(route, { status: completed ? 'COMPLETED' : 'IN_PROGRESS', test: { title: 'Quick reload test', questions }, savedProgress: null });
        else if (path === '/tests/quick-reload/submit') {
          submitted = route.request().postDataJSON(); completed = true; await json(route, {});
        } else if (path === '/attempts/quick-reload/result') {
          const answers = Object.fromEntries(submitted.answers.map(answer => [answer.questionId, answer.userAnswer]));
          const correct = answers.single === 'Right' && JSON.stringify(answers.multiple) === JSON.stringify(['First', 'Second']) && answers.boolean === 'true' && answers.short === '42';
          await json(route, { test: { title: 'Reload result' }, percentage: correct ? 100 : 0, answers: [] });
        } else return false;
        return true;
      });
      await page.goto(base + '/test/quick-reload/play');
      await page.getByRole('button', { name: 'Right', exact: true }).click();
      await page.getByRole('button', { name: 'Далее', exact: true }).click();
      await page.getByRole('button', { name: 'First', exact: true }).click();
      await page.getByRole('button', { name: 'Second', exact: true }).click();
      await page.getByRole('button', { name: 'Далее', exact: true }).click();
      await page.getByRole('button', { name: 'Верно', exact: true }).click();
      await page.getByRole('button', { name: 'Далее', exact: true }).click();
      await page.getByPlaceholder('Введите ответ...').fill('42');
      await page.reload();
      await page.getByPlaceholder('Введите ответ...').waitFor();
      check(await page.getByPlaceholder('Введите ответ...').inputValue() === '42', 'Immediate reload restores the current question and typed answer');
      await page.getByRole('button', { name: 'Завершить', exact: true }).click();
      const dialog = page.getByRole('dialog');
      check((await dialog.innerText()).includes('Отвечено: 4 из 4'), 'Immediate reload restores answers of all four question types');
      await dialog.getByRole('button', { name: 'Завершить', exact: true }).click();
      await page.getByText('100%', { exact: true }).first().waitFor();
      check(true, 'Reloaded draft submits all answers and earns the expected result');
      await page.goto(base + '/test/quick-reload/play');
      await page.getByRole('heading', { name: 'Reload result', exact: true }).waitFor();
      check(page.url().endsWith('/result'), 'Completed attempts ignore old local drafts and open the saved result');
      await context.close();
    }
    {
      const { page, context } = await setup(async (route, path) => {
        if (path !== '/subjects') return false;
        await json(route, [{ id: 'subject-a', name: 'Предмет с длинным названием для проверки мобильной формы', topics: [] }]); return true;
      });
      for (const width of [320, 375, 768, 1440]) {
        await page.setViewportSize({ width, height: 950 });
        await page.goto(base + '/test/generate');
        await page.getByRole('heading', { name: 'Создать тест', exact: true }).waitFor();
        await page.getByRole('button', { name: /Эксперт/ }).waitFor();
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Test generation fits ${width}px without horizontal scrolling`);
      }
      await context.close();
    }
    check(errors.length === 0, `No browser JavaScript errors (${errors.join('; ')})`);
    console.log(`Completed ${checks} UI regression checks.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
