/* Cross-role UI smoke/regression. Requires the disposable DB + browser_fixture_server.py. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_TEST_URL || 'http://127.0.0.1:5173';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname) || process.env.SITE_TEST_FIXTURES !== '1') {
  throw new Error('Use a local browser_fixture_server.py with SITE_TEST_FIXTURES=1 and a disposable database');
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(), errors = [], failures = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(12000);
  let checks = 0;
  const check = (ok, name) => { assert.ok(ok, name); checks++; console.log('PASS', name); };
  const go = async path => { await page.goto(base + path); await page.locator('main').waitFor(); };
  const button = name => page.getByRole('button', { name, exact: true });
  const login = async (email, password = 'password123') => {
    await page.goto(base + '/login');
    await page.getByPlaceholder('Email', { exact: true }).fill(email);
    await page.getByPlaceholder('Пароль', { exact: true }).fill(password);
    await button('Войти').click(); await page.waitForURL('**/dashboard');
  };
  const logout = async () => { await page.evaluate(() => localStorage.removeItem('aitutor-token')); await context.clearCookies(); };
  const run = async (name, fn) => {
    try { await fn(); } catch (error) { failures.push(name + ': ' + error.message); console.error('FAIL', name, error.message); }
  };
  try {
    await run('guest routing', async () => {
      await page.goto(base); await page.getByRole('link', { name: /Войти/ }).first().waitFor();
      await page.goto(base + '/admin'); await page.waitForURL('**/login'); check(true, 'Guest is redirected from protected pages');
    });
    await run('registration, profile and password', async () => {
      const email = `qa-browser-${Date.now()}@example.com`;
      await page.goto(base + '/register');
      await page.getByPlaceholder('Имя', { exact: true }).fill('QA');
      await page.getByPlaceholder('Фамилия', { exact: true }).fill('Student');
      await page.getByPlaceholder('Email', { exact: true }).fill(email);
      await page.getByPlaceholder('Пароль (мин. 8 символов)').fill('Testing-123!');
      await button('Создать аккаунт').click(); await page.waitForURL('**/dashboard');
      await go('/profile'); await button('Редактировать').click();
      await page.getByPlaceholder('Имя', { exact: true }).fill('Updated'); await button('Сохранить').click();
      await button('Редактировать').waitFor(); await page.reload();
      await page.getByRole('heading', { name: 'Updated Student' }).waitFor(); check(true, 'Registration and profile persistence');
      await page.getByLabel('Текущий пароль', { exact: true }).fill('Testing-123!');
      await page.getByLabel('Новый пароль', { exact: true }).fill('Testing-new-123!');
      await button('Сменить').click(); await page.getByText('Пароль изменён', { exact: true }).waitFor();
      await button('Выйти').click(); await page.waitForURL('**/login');
      await login(email, 'Testing-new-123!'); check(true, 'Password change and login with replacement password');
      await button('Выйти').click(); await page.waitForURL('**/login');
    });
    await login('student@aitutor.com');
    const routes = ['dashboard','subjects','lectures','messages','schedule','classroom','test/generate','history','analytics','review','achievements','ai-tutor','homework','study','term','flashcards','quiz','notes','planner','progress','feynman','debate','profile'];
    for (const route of routes) await run('route ' + route, async () => {
      await go('/' + route); await page.waitForTimeout(150);
      check((await page.locator('main').innerText()).trim().length > 0, 'Student route /' + route + ' renders');
    });
    await run('student permissions', async () => { await go('/admin'); await page.waitForURL('**/dashboard'); check(true, 'Student cannot open admin page'); });
    await run('schedule, theme and classroom failure', async () => {
      await go('/schedule'); await button('Сегодня').click(); await button('Неделя').click();
      await page.getByTitle('Обновить расписание').click(); check(true, 'Schedule view switching and refresh');
      const before = await page.locator('html').getAttribute('data-theme');
      await page.getByRole('button', { name: /^(Светлая|Тёмная) тема$/ }).click();
      check(before !== await page.locator('html').getAttribute('data-theme'), 'Theme button changes theme');
      await go('/classroom'); await button('Корпус А').click(); await button('60 мин').click(); await button('Найти кабинет').click();
      await button('Повторить').waitFor(); check(true, 'Offline classroom bridge shows retry instead of empty success');
    });
    await run('notes CRUD', async () => {
      await go('/notes'); await button('Новая заметка').click();
      await page.getByLabel('Название', { exact: true }).fill('QA заметка');
      await page.getByLabel('Текст · поддерживает Markdown').fill('Два плюс два равно четырём.');
      await button('Сохранить').click(); await button('Изменить').waitFor();
      await page.reload(); await page.getByRole('button', { name: /QA заметка/ }).first().click();
      await button('Изменить').click(); await page.getByLabel('Название', { exact: true }).fill('QA обновлена');
      await button('Сохранить').click(); await page.getByRole('heading', { name: 'QA обновлена', level: 2 }).waitFor();
      check(true, 'Notes create, reload, update');
      page.once('dialog', dialog => dialog.accept()); await button('Удалить').click();
      await page.getByRole('heading', { name: 'QA обновлена', level: 2 }).waitFor({ state: 'detached' }); check(true, 'Notes deletion');
    });
    await run('planner completion', async () => {
      await go('/planner'); await page.getByLabel('Что нужно сделать?').fill('QA подготовка');
      await page.getByLabel('Срок · местное время').fill('2026-12-01T15:00');
      await button('Добавить в план').click(); await page.getByText('QA подготовка', { exact: true }).first().waitFor();
      const row = page.locator('.task-row').filter({ hasText: 'QA подготовка' }).first();
      await row.getByRole('button', { name: 'Отметить выполненным' }).click();
      await row.getByRole('button', { name: 'Вернуть в план' }).waitFor();
      await page.reload(); await page.locator('.task-row.completed').filter({ hasText: 'QA подготовка' }).first().waitFor();
      check(true, 'Planner deadline, completion and persistence');
    });
    await run('messages', async () => {
      await go('/messages'); await page.getByRole('textbox', { name: 'Поиск пользователей' }).fill('petrov');
      await page.getByRole('button', { name: /Пётр Петров/ }).first().click();
      await page.getByRole('textbox', { name: 'Сообщение', exact: true }).fill('QA сообщение');
      await page.getByRole('button', { name: 'Отправить сообщение' }).click();
      await page.getByText('QA сообщение', { exact: true }).last().waitFor(); check(true, 'Contact search and message sending');
    });
    for (const mode of ['ai-tutor', 'homework', 'study', 'term']) await run(mode, async () => {
      await go('/' + mode); await page.getByLabel('Твой вопрос', { exact: true }).fill('Сколько будет два плюс два?');
      await button('Отправить').click(); await page.getByText(/QA ответ: два плюс два/).first().waitFor();
      await page.reload(); await page.locator(`.history-list a[href^="/${mode}?conversation="]`).first().click();
      await page.getByText(/QA ответ: два плюс два/).first().waitFor(); check(true, mode + ' responds and restores conversation');
    });
    await run('flashcards', async () => {
      await go('/flashcards'); await page.getByLabel('Тема или материал').fill('Арифметика');
      await page.getByLabel(/^Количество/).selectOption('3'); await button('Создать карточки').click();
      await page.getByRole('button', { name: 'Показать ответ' }).click(); await button('Знаю').click();
      await page.getByText('Знаю 1 из 3').waitFor(); await button('Дальше').click(); await button('Назад').click();
      check(true, 'Flashcard generation, flip, review and navigation');
    });
    await run('quiz', async () => {
      await go('/quiz'); await page.getByLabel('Тема или материал').fill('Арифметика');
      await page.getByLabel(/^Количество/).selectOption('3'); await button('Создать викторину').click();
      for (let i = 0; i < 3; i++) {
        if (i < 2) await page.getByRole('radio', { name: '4', exact: true }).check();
        else await page.getByLabel(/^Твой ответ/).fill('4');
        await button('Проверить ответ').click();
        if (i < 2) await button('Следующий вопрос').click();
      }
      await page.getByRole('heading', { name: 'Есть результат!' }).waitFor();
      await page.getByText('Верно 3 из 3', { exact: true }).waitFor(); check(true, 'Quiz: all question types and final grade');
    });
    for (const mode of ['feynman', 'debate']) await run(mode + ' session', async () => {
      await go('/' + mode);
      await page.getByPlaceholder(mode === 'feynman' ? 'Например: Фотосинтез, Производная...' : 'Например: Искусственный интеллект, Климат...').fill('Математика');
      if (mode === 'debate') await page.getByPlaceholder('Например: ИИ заменит программистов в течение 10 лет').fill('Математику нужно изучать');
      await button(mode === 'feynman' ? 'Начать обучение' : 'Начать дебаты').click();
      await page.getByText(/QA ответ: два плюс два/).first().waitFor();
      const input = page.getByPlaceholder(mode === 'feynman' ? 'Объясните...' : 'Ваш аргумент...');
      await input.fill('Это сумма двух пар объектов.'); await input.press('Enter');
      await page.getByText('Это сумма двух пар объектов.', { exact: true }).waitFor();
      await button('Завершить').click(); await page.getByText(/QA анализ: материал усвоен/).waitFor();
      check(true, mode + ' start, respond, complete and assessment');
    });
    await run('test lifecycle', async () => {
      await go('/test/generate'); const subject = page.locator('main select').first();
      await subject.selectOption({ label: 'Математический анализ' });
      await button('5').click();
      for (const type of ['Несколько ответов','Верно / Неверно','Краткий ответ']) await page.getByRole('button', { name: new RegExp(type) }).click();
      await button('Сгенерировать тест').click(); await page.waitForURL('**/play');
      await page.getByText('QA вопрос 1: два плюс два?', { exact: true }).waitFor();
      await button('4').last().click(); await button('Далее').click();
      await page.getByText('QA вопрос 2: два плюс два?', { exact: true }).waitFor();
      await button('4').last().click(); await button('6').click(); await button('Далее').click();
      await page.getByText('QA вопрос 3: два плюс два?', { exact: true }).waitFor();
      await page.getByRole('button', { name: /Верно/, exact: true }).click(); await button('Далее').click();
      await page.getByText('QA вопрос 4: два плюс два?', { exact: true }).waitFor();
      await page.getByPlaceholder('Введите ответ...').fill('4'); await button('Далее').click();
      await page.getByText('QA вопрос 5: два плюс два?', { exact: true }).waitFor();
      await button('4').last().click();
      await page.reload(); await page.getByRole('button', { name: 'Завершить', exact: true }).first().waitFor();
      await button('Завершить').first().click(); await page.getByRole('dialog').getByRole('button', { name: 'Завершить', exact: true }).click();
      await page.waitForURL('**/result'); await page.getByText('100%', { exact: true }).first().waitFor();
      await page.getByRole('button', { name: /Получить AI/ }).click(); await page.getByText(/QA анализ: материал усвоен/).waitFor();
      check(true, 'Test generation, four answer types, resume, grade and AI analysis');
    });
    for (const width of [375, 768, 1440]) for (const route of ['dashboard','test/generate','notes','planner','messages','schedule','ai-tutor','profile']) await run(`layout ${route} ${width}`, async () => {
      await page.setViewportSize({ width, height: 950 }); await go('/' + route); await page.waitForTimeout(100);
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route + ' fits ' + width + 'px');
    });
    await logout(); await login('petrov@aitutor.com'); await page.setViewportSize({ width: 1440, height: 1000 });
    await run('teacher pages', async () => {
      await go('/teacher'); await button('Мои предметы').click(); await button('Лекции').click();
      await page.locator('main form input').first().fill('QA лекция');
      await page.locator('main form select').last().selectOption({ label: 'Математический анализ' });
      await page.locator('main form textarea').fill('Два плюс два равно четырём.');
      await button('Сохранить лекцию').click();
      await page.getByText('QA лекция', { exact: true }).first().click();
      await page.getByRole('button', { name: /Объяснить/ }).click(); await page.getByText(/QA ответ: два плюс два/).first().waitFor();
      check(true, 'Teacher publishes and opens lecture; explanation works');
      await go('/teacher/groups'); await page.getByRole('heading', { name: 'Мои группы' }).waitFor(); check(true, 'Teacher groups load');
    });
    await logout(); await login('admin@aitutor.com');
    await run('admin creation forms', async () => {
      const suffix = Date.now(); await go('/admin'); await button('Пользователи').click();
      await page.getByPlaceholder('Имя', { exact: true }).fill('QA'); await page.getByPlaceholder('Фамилия', { exact: true }).fill('Created');
      await page.getByPlaceholder('Email', { exact: true }).fill(`qa-admin-${suffix}@example.com`);
      await page.getByPlaceholder('Пароль (минимум 8 символов)').fill('Testing-123!');
      await button('Создать').click(); await page.getByRole('cell', { name: `qa-admin-${suffix}@example.com`, exact: true }).waitFor(); check(true, 'Admin creates student account');
      await button('Группы').click(); await page.getByPlaceholder('Название (ПИ-20)').fill('QA группа ' + suffix);
      await page.getByPlaceholder('Код (PI-20)').fill('QA-' + suffix); await button('Создать').click();
      await page.locator('main li').filter({ hasText: 'QA группа ' + suffix }).waitFor();
      await page.locator('main form select').first().selectOption({ label: 'QA группа ' + suffix });
      await page.locator('main form select').last().selectOption({ label: 'Пётр Петров' });
      const assigned = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/teachers'));
      const refreshed = page.waitForResponse(response => response.request().method() === 'GET' && response.url().endsWith('/admin/groups'));
      await button('Назначить').click(); check((await assigned).ok(), 'Admin creates group and assigns teacher');
      await refreshed;
      await button('Предметы').waitFor();
      await button('Предметы').click(); await page.getByPlaceholder('Название', { exact: true }).fill('QA предмет ' + suffix);
      await page.getByPlaceholder('Код (CS-101)').fill('QA-SUB-' + suffix); await button('Создать').click();
      await page.getByRole('heading', { name: 'QA предмет ' + suffix }).waitFor(); check(true, 'Admin creates subject');
    });
    await run('admin tabs and schedule CRUD', async () => {
      const room = 'QA-' + Date.now(), edited = room + '-edit';
      await go('/admin');
      for (const tab of ['Пользователи','Группы','Предметы','Расписание']) { await button(tab).click(); await page.waitForTimeout(100); check((await page.locator('main').innerText()).length > 0, 'Admin tab ' + tab); }
      await button('Добавить занятие').click(); const dialog = page.getByRole('dialog');
      await dialog.getByLabel(/^Предмет/).selectOption({ label: 'Математический анализ' });
      await dialog.getByLabel(/^Группа/).selectOption({ index: 1 });
      await dialog.getByLabel('Кабинет', { exact: true }).fill(room);
      await dialog.getByLabel('Начало', { exact: true }).fill('18:00'); await dialog.getByLabel('Окончание', { exact: true }).fill('19:00');
      await dialog.getByRole('button', { name: 'Добавить занятие', exact: true }).click(); await dialog.waitFor({ state: 'detached' });
      const card = page.locator('.schedule-entry').filter({ hasText: room });
      await card.getByRole('button', { name: /Редактировать:/ }).click(); await page.getByRole('dialog').getByLabel('Кабинет', { exact: true }).fill(edited);
      await page.getByRole('dialog').getByRole('button', { name: 'Сохранить изменения' }).click(); await page.getByText(edited, { exact: true }).waitFor();
      await page.locator('.schedule-entry').filter({ hasText: edited }).getByRole('button', { name: /Удалить:/ }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Удалить занятие', exact: true }).click();
      await page.getByText(edited, { exact: true }).waitFor({ state: 'detached' }); check(true, 'Admin schedule create, edit, delete');
    });
    check(errors.length === 0, 'No browser JavaScript errors: ' + errors.join('; '));
    console.log(`${checks} site checks passed; ${failures.length} failed scenarios`);
    if (failures.length) throw new Error(failures.join('\n'));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
