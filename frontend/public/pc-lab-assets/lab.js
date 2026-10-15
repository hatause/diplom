
  const appRoot = document.getElementById('appRoot');
  const singlePartSvg = document.getElementById('singlePartSvg');
  const mainPcSvg = document.getElementById('mainPcSvg');
  const cameraRig = document.getElementById('camera-rig');
  const builderBanner = document.getElementById('builderBanner');
  const virtualMonitor = document.getElementById('virtualMonitor');
  const monitorScreenContent = document.getElementById('monitorScreenContent');

  let currentMode = 'partlab'; // 'partlab' | 'explore' | 'builder' | 'bios' | 'windows'
  let activePartId = 'part-cpu';
  let isPartDissected = false;
  let isPartXray = false;

  // Переменные конструктора сборки ПК
  let partInHand = null;
  let installedParts = new Set(['pc-case']);
  const ORDERED_STEPS = [
    'part-psu', 'part-mobo', 'part-cpu', 'part-ram',
    'part-ssd', 'part-cooler', 'part-gpu', 'case-glass-panel'
  ];

  // Переменные BIOS и Конструктора Windows 11
  let biosStep = 1;
  let biosVersion = 'v1.02';
  let biosTimer = null;

  let winStep = 1;
  let winEdition = 'Windows 11 Pro (x64)';
  let setupLanguage = 'ru-RU';
  let setupRegion = 'KZ';
  let setupKeyboard = 'ru';
  let cDriveSizeGb = 200; // Регулируется ползунком в конструкторе разделов
  let cmdOpen = false;
  let cmdLog = [];

  // Флаги проблем установки Windows (управляются чекбоксами или решаются по ходу установки)
  let faultTpmActive = true;
  let faultVmdActive = true;
  let faultMbrActive = true;
  let faultOobeActive = true;
  let winTimer = null;

  /* ===================================================================== */
  /* ГЕНЕРАТОР ОТДЕЛЬНЫХ КРУПНЫХ 3D-МОДЕЛЕЙ КАЖДОЙ ДЕТАЛИ (ВКЛАДКА 1)      */
  /* Каждая деталь состоит из 3 изометрических слоев:                      */
  /* .layer-bottom (Нижний) | .layer-mid (Средний) | .layer-top (Верхний)  */
  /* ===================================================================== */
  const STANDALONE_3D_MODELS = {
    'part-cpu': () => `
      <defs>
        <linearGradient id="ihs-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f1f5f9"/><stop offset="50%" stop-color="#94a3b8"/><stop offset="100%" stop-color="#475569"/>
        </linearGradient>
        <linearGradient id="die-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#38bdf8"/><stop offset="50%" stop-color="#1d4ed8"/><stop offset="100%" stop-color="#312e81"/>
        </linearGradient>
      </defs>
      <!-- Направляющие оси послойного разбора -->
      <line class="dissect-guide" x1="430" y1="150" x2="430" y2="420" />
      <line class="dissect-guide" x1="270" y1="230" x2="270" y2="390" />
      <line class="dissect-guide" x1="590" y1="230" x2="590" y2="390" />

      <!-- СЛОЙ 1 (НИЖНИЙ): Многослойная текстолитовая подложка + 1700 золотых контактов LGA -->
      <g class="sub-layer layer-bottom">
        <!-- 3D борта текстолита -->
        <polygon points="250,310 430,400 610,310 610,328 430,418 250,328" fill="#064e3b" stroke="#10b981" stroke-width="1"/>
        <!-- Верхняя плоскость подложки -->
        <polygon points="430,220 610,310 430,400 250,310" fill="#065f46" stroke="#34d399" stroke-width="1.8"/>
        <!-- Матрица золотых контактных площадок LGA и SMD-конденсаторов -->
        <polygon points="430,238 575,310 430,382 285,310" fill="#047857" stroke="#facc15" stroke-width="1" stroke-dasharray="6 4"/>
        <!-- Золотой ключ ориентации в углу -->
        <polygon points="262,310 285,299 285,321" fill="#facc15"/>
        <text x="635" y="345" fill="#6ee7b7" font-size="12" font-weight="700">1. Подложка PCB + Матрица LGA1700</text>
      </g>

      <!-- СЛОЙ 2 (СРЕДНИЙ): Кремниевый кристалл процессора (Silicon Die: P-Cores + E-Cores) -->
      <g class="sub-layer layer-mid">
        <!-- 3D толщина кристалла -->
        <polygon points="340,285 430,330 520,285 520,298 430,343 340,298" fill="#1e3a8a" stroke="#60a5fa"/>
        <!-- Зеркальная поверхность кристалла -->
        <polygon points="430,240 520,285 430,330 340,285" fill="url(#die-grad)" stroke="#93c5fd" stroke-width="1.6"/>
        <!-- Сетка вычислительных ядер P-Cores и E-Cores внутри кристалла -->
        <g stroke="#e0f2fe" stroke-width="0.9" opacity="0.75">
          <line x1="385" y1="262" x2="475" y2="307"/><line x1="405" y1="252" x2="495" y2="297"/>
          <line x1="365" y1="272" x2="455" y2="317"/><line x1="475" y1="262" x2="385" y2="307"/>
          <line x1="455" y1="252" x2="365" y2="297"/><line x1="495" y1="272" x2="405" y2="317"/>
        </g>
        <text x="555" y="285" fill="#7dd3fc" font-size="12" font-weight="700">2. Кремниевый кристалл (P/E ядра + Кэш L3)</text>
      </g>

      <!-- СЛОЙ 3 (ВЕРХНИЙ): Никелированная медная крышка теплораспределителя (IHS) -->
      <g class="sub-layer layer-top">
        <!-- Боковые грани крышки IHS -->
        <polygon points="290,265 430,335 570,265 570,284 430,354 290,284" fill="#475569" stroke="#cbd5e1" stroke-width="1"/>
        <!-- Верхняя ступень крышки IHS -->
        <polygon points="430,195 570,265 430,335 290,265" fill="url(#ihs-grad)" stroke="#f8fafc" stroke-width="1.8"/>
        <polygon points="430,210 540,265 430,320 320,265" fill="none" stroke="#334155" stroke-width="1.2"/>
        <!-- Лазерная маркировка процессора -->
        <text x="430" y="262" fill="#0f172a" font-size="13" font-weight="800" text-anchor="middle">INTEL CORE i7 / i9</text>
        <text x="430" y="279" fill="#1e293b" font-size="10" font-weight="700" text-anchor="middle">LGA1700 • PCIe 5.0 • DDR5</text>
        <text x="595" y="245" fill="#f8fafc" font-size="12" font-weight="700">3. Крышка теплораспределителя (IHS)</text>
      </g>
    `,

    'part-gpu': () => `
      <line class="dissect-guide" x1="430" y1="120" x2="430" y2="450" />
      <!-- СЛОЙ 1 (НИЖНИЙ): Металлический защитный бэкплейт со сквозным окном продува -->
      <g class="sub-layer layer-bottom">
        <polygon points="210,320 470,440 650,350 390,230" fill="#1e293b" stroke="#94a3b8" stroke-width="1.6"/>
        <polygon points="450,340 580,400 620,380 490,320" fill="#090d16" stroke="#38bdf8" stroke-width="1.2"/>
        <text x="645" y="385" fill="#94a3b8" font-size="12" font-weight="700">1. Армированный бэкплейт (Backplate)</text>
      </g>

      <!-- СЛОЙ 2 (СРЕДНИЙ): Печатная плата видеокарты (GPU Die + 8x GDDR6X + 16-phase VRM + 12VHPWR) -->
      <g class="sub-layer layer-mid">
        <polygon points="220,280 460,390 620,310 380,200" fill="#0a1929" stroke="#0284c7" stroke-width="1.8"/>
        <!-- Золотой гребень PCIe 5.0 x16 -->
        <polygon points="270,305 390,360 382,368 262,313" fill="#facc15"/>
        <!-- Графический кристалл GPU в центре в рамке -->
        <polygon points="410,265 465,292 425,312 370,285" fill="#38bdf8" stroke="#f8fafc" stroke-width="1.4"/>
        <!-- Чипы памяти GDDR6X вокруг ГПУ -->
        <g fill="#1e293b" stroke="#6ee7b7" stroke-width="1">
          <polygon points="365,255 385,265 375,272 355,262"/>
          <polygon points="390,242 410,252 400,259 380,249"/>
          <polygon points="475,282 495,292 485,299 465,289"/>
          <polygon points="450,305 470,315 460,322 440,312"/>
        </g>
        <!-- Разъем питания 16-pin 12VHPWR -->
        <polygon points="515,342 545,356 555,348 525,334" fill="#f59e0b" stroke="#fff"/>
        <text x="630" y="305" fill="#38bdf8" font-size="12" font-weight="700">2. Плата PCB: Чип GPU + GDDR6X + VRM</text>
      </g>

      <!-- СЛОЙ 3 (ВЕРХНИЙ): Радиатор с медными теплотрубками и кожух с 3 вентиляторами -->
      <g class="sub-layer layer-top">
        <polygon points="210,220 470,340 650,250 390,130" fill="#0f172a" stroke="#38bdf8" stroke-width="1.8"/>
        <polygon points="210,220 470,340 470,372 210,252" fill="#1e293b" stroke="#64748b"/>
        <polygon points="470,340 650,250 650,282 470,372" fill="#090d16" stroke="#64748b"/>
        <!-- 3 осевых вентилятора охлаждения -->
        <ellipse cx="335" cy="215" rx="42" ry="22" transform="rotate(25 335 215)" fill="#020617" stroke="#38bdf8" stroke-width="1.5"/>
        <ellipse cx="430" cy="258" rx="42" ry="22" transform="rotate(25 430 258)" fill="#020617" stroke="#a855f7" stroke-width="1.5"/>
        <ellipse cx="525" cy="301" rx="42" ry="22" transform="rotate(25 525 301)" fill="#020617" stroke="#38bdf8" stroke-width="1.5"/>
        <text x="635" y="220" fill="#f8fafc" font-size="12" font-weight="700">3. Радиатор + 3 вентилятора Axial-Tech</text>
      </g>
    `,

    'part-mobo': () => `
      <line class="dissect-guide" x1="430" y1="120" x2="430" y2="450" />
      <!-- СЛОЙ 1 (НИЖНИЙ): 8-слойный медный текстолит ATX -->
      <g class="sub-layer layer-bottom">
        <polygon points="430,190 660,305 430,420 200,305" fill="#071324" stroke="#0284c7" stroke-width="2"/>
        <polygon points="200,305 430,420 430,434 200,319" fill="#0c2540"/>
        <polygon points="430,420 660,305 660,319 430,434" fill="#061526"/>
        <g stroke="#1e3a5f" stroke-width="1.5" fill="none">
          <polyline points="330,275 430,325 520,280"/><polyline points="360,310 450,355 540,310"/>
        </g>
        <text x="645" y="365" fill="#38bdf8" font-size="12" font-weight="700">1. 8-слойная печатная плата ATX (PCB)</text>
      </g>

      <!-- СЛОЙ 2 (СРЕДНИЙ): Сокет LGA, слоты DDR5, PCIe 5.0, чипсет и микросхема BIOS -->
      <g class="sub-layer layer-mid">
        <!-- Сокет CPU -->
        <polygon points="390,235 455,267 410,290 345,258" fill="#ca8a04" stroke="#fef08a" stroke-width="1.5"/>
        <!-- 4 слота DDR5 -->
        <line x1="445" y1="220" x2="525" y2="260" stroke="#38bdf8" stroke-width="4"/>
        <line x1="458" y1="213" x2="538" y2="253" stroke="#64748b" stroke-width="4"/>
        <!-- Армированный слот PCIe x16 -->
        <line x1="315" y1="295" x2="435" y2="355" stroke="#e2e8f0" stroke-width="6"/>
        <!-- Микросхема ПЗУ UEFI BIOS (#bios-chip) -->
        <polygon points="415,355 445,370 430,378 400,363" fill="#1e293b" stroke="#f59e0b" stroke-width="2"/>
        <text x="615" y="290" fill="#fde68a" font-size="12" font-weight="700">2. Сокет LGA + DDR5 + Чип UEFI BIOS</text>
      </g>

      <!-- СЛОЙ 3 (ВЕРХНИЙ): Массивные радиаторы VRM, Чипсета и M.2 Thermal Guard -->
      <g class="sub-layer layer-top">
        <!-- Радиатор VRM левый -->
        <polygon points="295,225 365,260 340,274 270,239" fill="#64748b" stroke="#f8fafc" stroke-width="1.2"/>
        <polygon points="270,239 340,274 340,296 270,261" fill="#334155" stroke="#94a3b8"/>
        <!-- Радиатор M.2 Shield -->
        <polygon points="355,280 455,330 435,340 335,290" fill="#475569" stroke="#38bdf8" stroke-width="1.2"/>
        <!-- Радиатор Чипсета Z790 -->
        <polygon points="465,315 545,355 510,373 430,333" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
        <text x="585" y="215" fill="#f8fafc" font-size="12" font-weight="700">3. Радиаторы VRM, PCH и броня M.2</text>
      </g>
    `,

    'part-ram': () => `
      <line class="dissect-guide" x1="430" y1="130" x2="430" y2="430" />
      <!-- СЛОЙ 1: Нижняя пластина радиатора -->
      <g class="sub-layer layer-bottom">
        <polygon points="230,300 550,380 590,350 270,270" fill="#1e293b" stroke="#64748b" stroke-width="1.5"/>
        <text x="595" y="385" fill="#94a3b8" font-size="12" font-weight="700">1. Тыльная теплоотводящая пластина</text>
      </g>
      <!-- СЛОЙ 2: Плата DDR5 с 8 чипами памяти и контроллером питания PMIC -->
      <g class="sub-layer layer-mid">
        <polygon points="235,265 545,342 580,315 270,238" fill="#064e3b" stroke="#10b981" stroke-width="1.6"/>
        <!-- Золотые контакты 288-pin -->
        <line x1="240" y1="270" x2="540" y2="345" stroke="#facc15" stroke-width="5" stroke-dasharray="14 3"/>
        <!-- 8 чипов памяти DDR5 + PMIC в центре -->
        <g fill="#0f172a" stroke="#38bdf8" stroke-width="1">
          <polygon points="280,255 310,263 322,253 292,245"/>
          <polygon points="325,266 355,274 367,264 337,256"/>
          <polygon points="370,277 400,285 412,275 382,267"/>
          <!-- Контроллер питания PMIC -->
          <polygon points="418,288 438,293 448,284 428,279" fill="#b45309" stroke="#fde68a"/>
          <polygon points="460,299 490,307 502,297 472,289"/>
          <polygon points="505,310 535,318 547,308 517,300"/>
        </g>
        <text x="590" y="310" fill="#6ee7b7" font-size="12" font-weight="700">2. Чипы DDR5 + Контроллер PMIC (On-Die ECC)</text>
      </g>
      <!-- СЛОЙ 3: Верхний радиатор и световод ARGB -->
      <g class="sub-layer layer-top">
        <polygon points="230,225 550,305 590,275 270,195" fill="#0f172a" stroke="#38bdf8" stroke-width="1.8"/>
        <polygon points="250,205 570,285 585,273 265,193" fill="url(#grad-rgb)"/>
        <text x="595" y="235" fill="#f8fafc" font-size="12" font-weight="700">3. Алюминиевый радиатор + Световод ARGB</text>
      </g>
    `,

    'part-ssd': () => `
      <line class="dissect-guide" x1="430" y1="140" x2="430" y2="420" />
      <!-- СЛОЙ 1: Текстолит M.2 2280 с разъемом M-Key -->
      <g class="sub-layer layer-bottom">
        <polygon points="240,295 540,375 585,340 285,260" fill="#090d16" stroke="#10b981" stroke-width="1.8"/>
        <!-- Золотой краевой разъем M-Key -->
        <polygon points="540,375 585,340 598,344 553,379" fill="#facc15"/>
        <!-- Выемка под крепежный винт M.2 -->
        <circle cx="262" cy="278" r="7" fill="#050811" stroke="#f59e0b" stroke-width="2"/>
        <text x="605" y="375" fill="#6ee7b7" font-size="12" font-weight="700">1. Плата M.2 2280 + Ключ PCIe 4.0 x4 (M-Key)</text>
      </g>
      <!-- СЛОЙ 2: Контроллер NVMe, буфер DRAM и чипы 3D TLC NAND -->
      <g class="sub-layer layer-mid">
        <!-- Контроллер в металлическом корпусе -->
        <polygon points="485,310 535,324 560,304 510,290" fill="#94a3b8" stroke="#f8fafc" stroke-width="1.4"/>
        <!-- Буфер DRAM кэша -->
        <polygon points="435,296 470,306 490,290 455,280" fill="#1e3a8a" stroke="#38bdf8" stroke-width="1.2"/>
        <!-- 2 больших банка флеш-памяти 3D NAND -->
        <polygon points="290,258 355,275 380,255 315,238" fill="#1e293b" stroke="#f59e0b" stroke-width="1.2"/>
        <polygon points="365,278 430,295 455,275 390,258" fill="#1e293b" stroke="#f59e0b" stroke-width="1.2"/>
        <text x="580" y="300" fill="#fde68a" font-size="12" font-weight="700">2. NVMe-контроллер + DRAM + Чипы 3D NAND</text>
      </g>
      <!-- СЛОЙ 3: Графеновый радиатор охлаждения -->
      <g class="sub-layer layer-top">
        <polygon points="255,235 535,310 575,278 295,203" fill="#1e293b" stroke="#38bdf8" stroke-width="1.6"/>
        <line x1="285" y1="225" x2="535" y2="292" stroke="#38bdf8" stroke-width="2" stroke-dasharray="10 5"/>
        <text x="585" y="235" fill="#f8fafc" font-size="12" font-weight="700">3. Графеновый радиатор охлаждения SSD</text>
      </g>
    `,

    'part-psu': () => `
      <line class="dissect-guide" x1="430" y1="120" x2="430" y2="440" />
      <!-- СЛОЙ 1: Нижнее шасси корпуса БП -->
      <g class="sub-layer layer-bottom">
        <polygon points="250,310 430,400 610,310 430,220" fill="#0f172a" stroke="#475569" stroke-width="1.8"/>
        <polygon points="250,310 430,400 430,445 250,355" fill="#1e293b" stroke="#64748b"/>
        <polygon points="430,400 610,310 610,355 430,445" fill="#090d16" stroke="#64748b"/>
        <text x="620" y="375" fill="#94a3b8" font-size="12" font-weight="700">1. Экранированное шасси ATX 3.0 + Модульные разъемы</text>
      </g>
      <!-- СЛОЙ 2: Силовая электроника (Трансформатор, конденсатор 450V, дроссели APFC) -->
      <g class="sub-layer layer-mid">
        <!-- Высоковольтный японский конденсатор 450V 105°C -->
        <ellipse cx="365" cy="285" rx="26" ry="38" fill="#1e3a8a" stroke="#60a5fa" stroke-width="1.5"/>
        <!-- Главный импульсный трансформатор -->
        <polygon points="415,255 475,285 440,305 380,275" fill="#ca8a04" stroke="#fef08a" stroke-width="1.5"/>
        <!-- Алюминиевые гребни радиаторов диодных сборок и MOSFET -->
        <polygon points="465,240 535,275 520,285 450,250" fill="#94a3b8" stroke="#f8fafc"/>
        <text x="580" y="285" fill="#fde68a" font-size="12" font-weight="700">2. Силовой трансформатор + Конденсатор 450V</text>
      </g>
      <!-- СЛОЙ 3: Верхняя крышка с 120-мм вентилятором и грилем -->
      <g class="sub-layer layer-top">
        <polygon points="250,235 430,325 610,235 430,145" fill="#1e293b" stroke="#38bdf8" stroke-width="1.6"/>
        <ellipse cx="430" cy="235" rx="78" ry="42" fill="#090d16" stroke="#64748b" stroke-width="2"/>
        <ellipse cx="430" cy="235" rx="55" ry="29" fill="none" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="6 4"/>
        <circle cx="430" cy="235" r="16" fill="#334155" stroke="#f8fafc"/>
        <text x="615" y="210" fill="#f8fafc" font-size="12" font-weight="700">3. Крышка с 120-мм FDB вентилятором</text>
      </g>
    `,

    'part-cooler': () => `
      <line class="dissect-guide" x1="430" y1="120" x2="430" y2="440" />
      <!-- СЛОЙ 1: Медное основание прямого контакта и 4 тепловые трубки -->
      <g class="sub-layer layer-bottom">
        <polygon points="365,335 430,368 495,335 430,302" fill="#b45309" stroke="#fef08a" stroke-width="1.6"/>
        <!-- U-образные медные теплотрубки -->
        <path d="M 385,335 L 385,230 M 410,345 L 410,235 M 450,345 L 450,235 M 475,335 L 475,230" stroke="#d97706" stroke-width="7" stroke-linecap="round"/>
        <text x="545" y="355" fill="#fde68a" font-size="12" font-weight="700">1. Медная подошва + 4 теплотрубки с хладагентом</text>
      </g>
      <!-- СЛОЙ 2: Массив из 52 алюминиевых ребер радиатора -->
      <g class="sub-layer layer-mid">
        <polygon points="310,250 430,310 550,250 430,190" fill="#94a3b8" stroke="#f8fafc" stroke-width="1.5"/>
        <polygon points="310,250 430,310 430,365 310,305" fill="#475569" stroke="#cbd5e1"/>
        <polygon points="430,310 550,250 550,305 430,365" fill="#334155" stroke="#94a3b8"/>
        <text x="575" y="285" fill="#7dd3fc" font-size="12" font-weight="700">2. Секция из 52 алюминиевых пластин</text>
      </g>
      <!-- СЛОЙ 3: Верхняя декоративная крышка и вентилятор 120мм PWM -->
      <g class="sub-layer layer-top">
        <polygon points="310,205 430,265 550,205 430,145" fill="#0f172a" stroke="#38bdf8" stroke-width="1.8"/>
        <circle cx="385" cy="205" r="4" fill="#d97706"/><circle cx="410" cy="217" r="4" fill="#d97706"/>
        <circle cx="450" cy="217" r="4" fill="#d97706"/><circle cx="475" cy="205" r="4" fill="#d97706"/>
        <text x="575" y="195" fill="#f8fafc" font-size="12" font-weight="700">3. Верхний кожух + Нагнетающий вентилятор PWM</text>
      </g>
    `,

    'pc-case': () => `
      <line class="dissect-guide" x1="430" y1="120" x2="430" y2="440" />
      <!-- СЛОЙ 1: Несущее стальное шасси с кожухом БП -->
      <g class="sub-layer layer-bottom">
        <polygon points="310,260 550,380 550,450 310,330" fill="#0f172a" stroke="#475569" stroke-width="1.6"/>
        <polygon points="310,260 450,190 690,310 550,380" fill="#1e293b" stroke="#64748b"/>
        <text x="615" y="395" fill="#94a3b8" font-size="12" font-weight="700">1. Несущая рама шасси + Кожух БП</text>
      </g>
      <!-- СЛОЙ 2: Передняя перфорированная Mesh-панель и пылевые фильтры -->
      <g class="sub-layer layer-mid">
        <polygon points="510,210 650,280 650,390 510,320" fill="#090d16" stroke="#10b981" stroke-width="1.6"/>
        <text x="665" y="305" fill="#6ee7b7" font-size="12" font-weight="700">2. Продуваемая панель Front Mesh + Фильтры</text>
      </g>
      <!-- СЛОЙ 3: Панель из закаленного стекла -->
      <g class="sub-layer layer-top">
        <polygon points="270,190 510,310 510,410 270,290" fill="rgba(56,189,248,0.18)" stroke="#38bdf8" stroke-width="1.8"/>
        <text x="545" y="215" fill="#f8fafc" font-size="12" font-weight="700">3. Съемная боковая панель из закаленного стекла</text>
      </g>
    `
  };

  // Подробное описание каждой детали
  const PARTS_DB = {
    'part-cpu': {
      badge: '#part-cpu • Отдельная 3D-Модель',
      title: 'Центральный процессор (CPU)',
      desc: 'Вычислительное ядро ПК. В режиме отдельной 3D-модели состоит из 3 слоев: подложки с контактами LGA1700, кремниевого кристалла с P/E-ядрами и никелированной крышки теплораспределителя (IHS).',
      specs: [['Сокет / Архитектура', 'LGA 1700 (Hybrid P+E Cores)'], ['Линии PCI Express', '20 линий PCIe 5.0 / 4.0'], ['Безопасность ОС', 'Intel PTT / fTPM 2.0']],
      subparts: ['Нижний слой: Подложка PCB + 1700 контактных площадок', 'Средний слой: Кремниевый кристалл + припой STIM', 'Верхний слой: Медная никелированная крышка IHS'],
      role: 'При установке Windows 11 установщик проверяет наличие в процессоре активного криптомодуля fTPM 2.0 и поддержку инструкций.'
    },
    'part-gpu': {
      badge: '#part-gpu • Отдельная 3D-Модель',
      title: 'Дискретная видеокарта (GPU)',
      desc: 'Высокопроизводительный 3D-ускоритель. При послойном разборе виден армированный бэкплейт, плата с графическим процессором, чипами памяти GDDR6X и разъемом 12VHPWR, а также радиатор с 3 вентиляторами.',
      specs: [['Интерфейс', 'PCI Express 5.0 / 4.0 x16'], ['Видеопамять', '16 ГБ GDDR6X (256-bit)'], ['Питание', '16-pin 12VHPWR (ATX 3.0)']],
      subparts: ['Нижний слой: Защитный бэкплейт со сквозным продувом', 'Средний слой: Плата PCB с чипом GPU и памятью GDDR6X', 'Верхний слой: Радиатор с теплотрубками и 3 вентиляторами'],
      role: 'Работает в режиме совместимости GOP UEFI при установке ОС, после чего требует установки проприетарного WDDM-драйвера.'
    },
    'part-mobo': {
      badge: '#part-mobo • Отдельная 3D-Модель',
      title: 'Материнская плата (ATX Z790)',
      desc: 'Центральная магистраль ПК. Объединяет 8-слойный текстолит, сокет процессора, слоты DDR5/PCIe/M.2, микросхему памяти UEFI BIOS и массивные радиаторы охлаждения VRM.',
      specs: [['Форм-фактор / Чипсет', 'ATX / Intel Z790'], ['Микросхема BIOS', '128 Мбит SPI Flash (#bios-chip)'], ['Контроллер дисков', 'NVMe PCIe 4.0 + Intel VMD']],
      subparts: ['Нижний слой: 8-слойная плата с медными дорожками', 'Средний слой: Сокет LGA, слоты DDR5, PCIe и чип BIOS', 'Верхний слой: Радиаторы VRM, чипсета и броня M.2'],
      role: 'Настройки UEFI этой платы (Secure Boot, fTPM 2.0, режим контроллера VMD/AHCI) напрямую определяют успешность установки Windows 11.'
    },
    'part-ram': {
      badge: '#part-ram • Отдельная 3D-Модель',
      title: 'Оперативная память (2x DDR5)',
      desc: 'Высокоскоростная энергозависимая память стандарта DDR5 с встроенным на плату контроллером управления питанием (PMIC) и коррекцией ошибок On-Die ECC.',
      specs: [['Объем / Стандарт', '32 ГБ (2x16 ГБ DDR5-6000)'], ['Канальность', 'Dual Channel (Слоты A2 / B2)'], ['Мин. требование Win 11', 'От 4 ГБ ОЗУ и выше']],
      subparts: ['Нижний слой: Тыльная пластина радиатора', 'Средний слой: Плата с 8 чипами DDR5 и чипом PMIC', 'Верхний слой: Передний радиатор и световод ARGB'],
      role: 'При загрузке с установочной флешки именно в ОЗУ разворачивается временная среда предустановки Windows PE (boot.wim).'
    },
    'part-ssd': {
      badge: '#part-ssd • Отдельная 3D-Модель',
      title: 'Накопитель M.2 NVMe SSD',
      desc: 'Твердотельный накопитель форм-фактора 2280. Состоит из платы с ключом M-Key, высокоскоростного 8-канального контроллера, буфера DRAM и банков памяти 3D TLC NAND под графеновым радиатором.',
      specs: [['Интерфейс', 'PCIe 4.0 x4 NVMe 1.4'], ['Объем накопителя', '512 ГБ'], ['Требуемая разметка UEFI', 'Таблица разделов GPT']],
      subparts: ['Нижний слой: Плата 2280 с золотым разъемом M-Key', 'Средний слой: Контроллер PCIe 4.0 + DRAM + 3D NAND', 'Верхний слой: Графеновый теплораспределитель'],
      role: 'Главный объект Конструктора Windows: требует драйвера контроллера (при включенном VMD) и конвертации из MBR в GPT.'
    },
    'part-psu': {
      badge: '#part-psu • Отдельная 3D-Модель',
      title: 'Блок питания (750W 80+ Gold)',
      desc: 'Импульсный источник питания стандарта ATX 3.0. Внутри экранированного корпуса расположены входной фильтр, высоковольтный конденсатор 450 В, силовой трансформатор и плата модульных разъемов.',
      specs: [['Мощность', '750 Вт (Сертификат 80+ Gold)'], ['Топология', 'Активный PFC + LLC резонансный'], ['Защиты', 'OVP / UVP / SCP / OPP / OTP']],
      subparts: ['Нижний слой: Стальное шасси и модульная панель', 'Средний слой: Трансформатор, конденсатор 450V и радиаторы', 'Верхний слой: Крышка с 120-мм FDB вентилятором'],
      role: 'Обеспечивает стабильность линии +12V во время прошивки микросхемы BIOS и записи системных разделов.'
    },
    'part-cooler': {
      badge: '#part-cooler • Отдельная 3D-Модель',
      title: 'Башенный кулер процессора',
      desc: 'Система воздушного охлаждения на базе 4 медных тепловых трубок прямого контакта, пакета из 52 алюминиевых пластин и 120-мм вентилятора с ШИМ-регулировкой оборотов.',
      specs: [['Теплоотвод (TDP)', 'До 220 Вт'], ['Тепловые трубки', '4 x 6 мм (Медь с хладагентом)'], ['Вентилятор', '120 мм PWM (600–1800 об/мин)']],
      subparts: ['Нижний слой: Медная подошва и 4 U-образные трубки', 'Средний слой: Массив из 52 алюминиевых ребер', 'Верхний слой: Декоративный кожух и вентилятор PWM'],
      role: 'Защищает процессор от перегрева (троттлинга) при распаковке архива install.wim в ходе установки ОС.'
    },
    'pc-case': {
      badge: '#pc-case • Отдельная 3D-Модель',
      title: 'Корпус ПК (Mid-Tower ATX)',
      desc: 'Шасси системного блока с продуваемой фронтальной сеткой (Mesh), нижним кожухом блока питания, кабель-каналами и боковой панелью из закаленного стекла.',
      specs: [['Форм-фактор', 'Mid-Tower (ATX / mATX)'], ['Порты I/O сверху', 'USB 3.2 Gen1 + Кнопка Power'], ['Боковая панель', 'Закаленное стекло 4 мм']],
      subparts: ['Нижний слой: Несущий стальной каркас со стойками ATX', 'Средний слой: Фронтальная Mesh-панель и пылевые фильтры', 'Верхний слой: Боковое закаленное стекло'],
      role: 'Через верхний порт USB 3.2 к системе подключается загрузочная флешка с прошивкой BIOS и образом Windows 11.'
    },
    'all': {
      badge: '#all • Общий стенд ПК',
      title: 'Полная 3D-сборка компьютера',
      desc: 'Все 8 узлов в единой изометрической проекции. Используйте вкладку 1 для детального послойного разбора каждого комплектующего по отдельности.',
      specs: [['Собрано узлов', '8 / 8'], ['Версия BIOS', 'v2.40 UEFI'], ['Статус ОС', 'Готов к установке']],
      subparts: ['Индивидуальные 3D-модели во вкладке 1', 'Конструктор сборки во вкладке 3', 'Конструктор Windows 11 и ошибок во вкладке 5'],
      role: 'Комплексный интерактивный тренажер для дипломного проекта.'
    }
  };

  const BUILD_RULES = {
    'part-psu': { name: 'Блок питания 750W', slotName: '[Отсек БП]', requires: [], hint: 'Выберите «Блок питания 750W» слева и кликните по контуру [Отсек БП].' },
    'part-mobo': { name: 'Материнская плата', slotName: '[Стойки ATX платы]', requires: ['part-psu'], missingMsg: 'Сначала установите Блок питания!', hint: 'Выберите «Материнская плата» и кликните на [Стойки ATX платы].' },
    'part-cpu': { name: 'Процессор (CPU)', slotName: '[Сокет CPU]', requires: ['part-mobo'], missingMsg: 'Сначала установите материнскую плату!', hint: 'Выберите «Процессор (CPU)» и кликните на [Сокет CPU].' },
    'part-ram': { name: 'Память 2x DDR5', slotName: '[DDR5]', requires: ['part-mobo'], missingMsg: 'Сначала установите материнскую плату!', hint: 'Выберите «Память 2x DDR5» и кликните по слотам [DDR5].' },
    'part-ssd': { name: 'Накопитель M.2 SSD', slotName: '[Слот M.2]', requires: ['part-mobo'], missingMsg: 'Сначала установите материнскую плату!', hint: 'Выберите «Накопитель M.2 SSD» и кликните на [Слот M.2].' },
    'part-cooler': { name: 'Башенный кулер', slotName: '[Кулер]', requires: ['part-mobo', 'part-cpu'], missingMsg: 'Сначала установите Процессор в сокет перед монтажом кулера!', hint: 'Выберите «Башенный кулер» и кликните по зоне [Кулер].' },
    'part-gpu': { name: 'Видеокарта (GPU)', slotName: '[PCIe x16]', requires: ['part-mobo', 'part-cpu', 'part-ram', 'part-ssd', 'part-cooler'], missingMsg: 'Сначала установите процессор, кулер, ОЗУ и M.2 SSD!', hint: 'Выберите «Видеокарта (GPU)» и кликните по слоту [PCIe x16].' },
    'case-glass-panel': { name: 'Боковое стекло', slotName: '[Закрыть стекло]', requires: ['part-psu', 'part-mobo', 'part-cpu', 'part-ram', 'part-ssd', 'part-cooler', 'part-gpu'], missingMsg: 'Сначала установите все 7 внутренних комплектующих!', hint: 'Выберите «Боковое стекло» и закройте крышку корпуса.' }
  };

  /* ===================================================================== */
  /* ПЕРЕКЛЮЧЕНИЕ МЕЖДУ 5 ВКЛАДКАМИ                                        */
  /* ===================================================================== */
  function switchMode(mode) {
    clearInterval(biosTimer);
    clearInterval(winTimer);
    biosTimer = winTimer = null;
    currentMode = mode;
    appRoot.dataset.mode = mode;
    document.getElementById('btnExplode').classList.remove('is-active');

    const tabMap = { partlab: 'tabPartLab', explore: 'tabExplore', builder: 'tabBuilder', bios: 'tabBios', windows: 'tabWindows' };
    Object.entries(tabMap).forEach(([k, id]) => {
      document.getElementById(id).classList.toggle('is-active', mode === k);
    });

    document.getElementById('partLabActions').style.display = mode === 'partlab' ? 'flex' : 'none';
    document.getElementById('exploreActions').style.display = mode === 'explore' ? 'flex' : 'none';
    document.getElementById('builderActions').style.display = mode === 'builder' ? 'flex' : 'none';
    document.getElementById('monitorActions').style.display = (mode === 'bios' || mode === 'windows') ? 'flex' : 'none';

    document.getElementById('btnAllParts').style.display = mode === 'explore' ? 'flex' : 'none';
    document.getElementById('btn-case-glass-panel').style.display = mode === 'builder' ? 'flex' : 'none';
    document.getElementById('winFaultConfig').classList.toggle('is-visible', mode === 'windows');

    // Переключение между холстом отдельной 3D-детали и общим холстом ПК
    singlePartSvg.style.display = mode === 'partlab' ? 'block' : 'none';
    mainPcSvg.style.display = mode === 'partlab' ? 'none' : 'block';

    appRoot.classList.remove('is-exploded', 'bios-pulse', 'ssd-pulse', 'is-builder-mode', 'usb-plugged');
    virtualMonitor.classList.remove('is-open', 'is-minimized');

    if (mode !== 'builder') ensureAllPartsInstalledVisually();

    if (mode === 'partlab') {
      document.getElementById('sidebarTitle').textContent = 'Выбери 3D-модель детали:';
      document.getElementById('progressLabel').textContent = 'Детализация 3D-узла';
      document.getElementById('buildCounter').textContent = '3 слоя';
      document.getElementById('buildProgressBar').style.width = '100%';
      if (activePartId === 'all' || activePartId === 'case-glass-panel') activePartId = 'part-cpu';
      renderSinglePart3D(activePartId);
    } else if (mode === 'explore') {
      document.getElementById('sidebarTitle').textContent = 'Обзор общего стенда:';
      cameraRig.style.transform = 'translate(0px, 0px) scale(1)';
      setBanner('🏢 Общий 3D-Стенд ПК: нажми «Разборка всего ПК (Exploded View)» сверху или выбери узел слева', 'normal');
      document.getElementById('progressLabel').textContent = 'Обзор архитектуры';
      document.getElementById('buildCounter').textContent = '8 узлов';
      document.getElementById('buildProgressBar').style.width = '100%';
      inspectPart('all');
    } else if (mode === 'builder') {
      appRoot.classList.add('is-builder-mode');
      document.getElementById('sidebarTitle').textContent = 'Склад комплектующих:';
      document.getElementById('progressLabel').textContent = 'Сборка ПК';
      cameraRig.style.transform = 'translate(0px, 0px) scale(1)';
      restoreBuilder();
    } else if (mode === 'bios') {
      appRoot.classList.add('usb-plugged');
      virtualMonitor.classList.add('is-open');
      cameraRig.style.transform = 'translate(185px, 10px) scale(1.06)';
      populateInspectorCard('part-mobo');
      startBiosSimulator();
    } else if (mode === 'windows') {
      appRoot.classList.add('usb-plugged');
      virtualMonitor.classList.add('is-open');
      cameraRig.style.transform = 'translate(185px, 10px) scale(1.06)';
      populateInspectorCard('part-ssd');
      renderWindowsStep();
    }
  }

  /* ===================================================================== */
  /* ВКЛАДКА 1: РЕНДЕР ОТДЕЛЬНОЙ 3D-МОДЕЛИ ДЕТАЛИ И ПОСЛОЙНЫЙ РАЗБОР       */
  /* ===================================================================== */
  function renderSinglePart3D(partId) {
    activePartId = partId;
    document.querySelectorAll('.part-Btn').forEach(btn => {
      btn.classList.toggle('is-selected', btn.dataset.part === partId);
    });

    const generator = STANDALONE_3D_MODELS[partId] || STANDALONE_3D_MODELS['part-cpu'];
    singlePartSvg.innerHTML = generator();
    fitPartViewport();
    isPartDissected = false;
    singlePartSvg.classList.remove("part-dissected");
    document.getElementById("btnDissectPart").classList.remove("is-active");
    populateInspectorCard(partId);

    const title = (PARTS_DB[partId] || PARTS_DB['part-cpu']).title;
    setBanner(`🔬 3D-Модель: ${title} — нажми «🧩 Разобрать деталь на слои» сверху, чтобы заглянуть внутрь!`, 'normal');
  }

  function togglePartDissect() {
    isPartDissected = !isPartDissected;
    if (isPartDissected && !labProgress.inspected_parts.includes(activePartId)) labProgress.inspected_parts.push(activePartId);
    singlePartSvg.classList.toggle('part-dissected', isPartDissected);
    document.getElementById('btnDissectPart').classList.toggle('is-active', isPartDissected);
    fitPartViewport();
  }

  function togglePartXray() {
    isPartXray = !isPartXray;
    singlePartSvg.classList.toggle('part-xray', isPartXray);
    document.getElementById('btnXrayPart').classList.toggle('is-active', isPartXray);
  }

  /* ===================================================================== */
  /* ВКЛАДКА 5: ПОЛНЫЙ КОНСТРУКТОР WINDOWS 11 + УСТРАНЕНИЕ 4 ПРОБЛЕМ       */
  /* ===================================================================== */
  function syncFaultToggles() {
    clearInterval(winTimer); winTimer = null;
    faultTpmActive = document.getElementById('chkFaultTpm').checked;
    faultVmdActive = document.getElementById('chkFaultVmd').checked;
    faultMbrActive = document.getElementById('chkFaultMbr').checked;
    faultOobeActive = document.getElementById('chkFaultOobe').checked;
    if (currentMode === 'windows') {
      labProgress.resolved_faults = labProgress.resolved_faults.filter(key => !document.getElementById(faultInputs[key]).checked);
      if (faultTpmActive) winStep = 1;
      else if (winStep > 2 && faultVmdActive) winStep = 2;
      else if (winStep > 3 && faultMbrActive) winStep = 3;
      else if (winStep > 4 && faultOobeActive) winStep = 4;
      if (winStep < 5) labProgress.windows_installed = false;
      appRoot.classList.remove('ssd-pulse');
      renderWindowsStep();
    }
  }

  function startWindowsConstructor() {
    clearInterval(winTimer);
    winTimer = null;
    labProgress.windows_installed = false;
    labProgress.resolved_faults = [];
    selectedDrivers = [];
    Object.values(faultInputs).forEach(id => document.getElementById(id).checked = true);
    winStep = 1;
    cmdOpen = false;
    cmdLog = [];
    syncFaultToggles();
    appRoot.classList.remove('bios-pulse');
    appRoot.classList.add('ssd-pulse');
    document.getElementById('iso-monitor-screen').setAttribute('fill', '#1e3a8a');
    document.getElementById('iso-monitor-status').textContent = 'WIN11 CONSTRUCTOR';
    renderWindowsStep();
  }

  function renderWindowsStep() {
    document.getElementById('progressLabel').textContent = 'Конструктор Windows 11';
    document.getElementById('buildCounter').textContent = `Этап ${winStep} / 5`;
    document.getElementById('buildProgressBar').style.width = `${(winStep / 5) * 100}%`;

    // ЭТАП 1: Загрузка с USB, выбор редакции и ПРОВЕРКА ПРОБЛЕМЫ #1 (TPM 2.0 & Secure Boot)
    if (winStep === 1) {
      if (faultTpmActive) {
        setBanner('❌ Проблема #1: Ошибка совместимости «Запуск Windows 11 на этом компьютере невозможен» (TPM 2.0 / Secure Boot)', 'error');
        monitorScreenContent.innerHTML = `
          <div class="win-Box">
            <div class="win-Title">
              <span>🪟 Установка Windows 11 — Проверка оборудования</span>
              <span style="font-size:11px; color:#fca5a5;">Код сбоя: LAB-TPM (учебный код)</span>
            </div>
            <div class="error-AlertBox">
              <strong>⛔ Запуск Windows 11 на этом компьютере невозможен</strong>
              Этот ПК не отвечает минимальным требованиям к системе:<br/>
              • <b>Доверенный платформенный модуль (TPM):</b> Не обнаружен (Требуется версия 2.0)<br/>
              • <b>Безопасная загрузка (Secure Boot):</b> Отключена или активен режим Legacy CSM
            </div>
            <p style="font-size:11px; color:#cbd5e1;">
              <b>Почему возникла проблема:</b> после сброса CMOS или на чистой плате модули <code>Intel PTT / AMD fTPM</code> и <code>Secure Boot</code> могут быть деактивированы. Выберите способ решения:
            </p>
            <div class="solution-Cards">
              <button class="sol-Btn" onclick="solveTpmViaBios()">
                ✅ <b>Решение А (Штатное):</b> Включить <code>fTPM 2.0</code> и <code>Secure Boot (UEFI)</code> в настройках BIOS
              </button>
              <button class="sol-Btn" onclick="solveTpmViaRegedit()">
                🛠️ <b>Решение Б (Инженерный обход Shift + F10):</b> Открыть консоль и прописать в реестр ключи <code>LabConfig\\BypassTPMCheck = 1</code>
              </button>
            </div>
            ${renderCmdBlock()}
          </div>
          <button class="sim-Btn" disabled>Далее (Заблокировано проверкой TPM 2.0)</button>
        `;
      } else {
        setBanner('✅ Проверка совместимости пройдена! Выберите редакцию и параметры образа Windows 11.', 'success');
        monitorScreenContent.innerHTML = `
          <div class="win-Box">
            <div class="win-Title">
              <span>🪟 Конструктор образа Windows 11 (TPM 2.0 + Secure Boot OK)</span>
              <span style="font-size:11px; color:#6ee7b7;">Проверка пройдена ✓</span>
            </div>
            <p style="font-size:11.5px; color:#cbd5e1; margin-bottom:8px;">
              Аппаратные требования удовлетворены. Выберите язык, регион и конфигурацию образа:
            </p>
            <div class="setup-locales">
              <label>Язык ОС <select aria-label="Язык ОС" onchange="setupLanguage=this.value"><option value="ru-RU" ${setupLanguage==='ru-RU'?'selected':''}>Русский</option><option value="en-US" ${setupLanguage==='en-US'?'selected':''}>English</option></select></label>
              <label>Формат времени <select aria-label="Формат времени" onchange="setupRegion=this.value"><option value="KZ" ${setupRegion==='KZ'?'selected':''}>Казахстан</option><option value="RU" ${setupRegion==='RU'?'selected':''}>Россия</option></select></label>
              <label>Клавиатура <select aria-label="Клавиатура" onchange="setupKeyboard=this.value"><option value="ru" ${setupKeyboard==='ru'?'selected':''}>Русская</option><option value="us" ${setupKeyboard==='us'?'selected':''}>США</option></select></label>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px; font-size:11.5px;">
              <label style="padding:7px 10px; background:rgba(56,189,248,0.16); border:1px solid #38bdf8; border-radius:6px; cursor:pointer;">
                <input type="radio" name="winEd" ${winEdition.includes("Pro") ? "checked" : ""} onchange="winEdition='Windows 11 Pro (x64)'" />
                <b>Windows 11 Pro (x64)</b> — Полный пакет (BitLocker, Hyper-V, RDP, Group Policy)
              </label>
              <label style="padding:7px 10px; background:rgba(30,41,59,0.65); border:1px solid rgba(148,163,184,0.2); border-radius:6px; cursor:pointer;">
                <input type="radio" name="winEd" ${winEdition.includes("Education") ? "checked" : ""} onchange="winEdition='Windows 11 Education (x64)'" />
                <b>Windows 11 Education (x64)</b> — Образовательная лицензия для вузов
              </label>
              <label style="padding:7px 10px; cursor:pointer;">
                <input type="radio" name="winEd" ${winEdition.includes("Home") ? "checked" : ""} onchange="winEdition='Windows 11 Home (x64)'" />
                <b>Windows 11 Home (x64)</b> — Домашняя редакция
              </label>
            </div>
            ${renderCmdBlock()}
          </div>
          <button class="sim-Btn is-emerald" onclick="winStep = 2; cmdOpen = false; renderWindowsStep();">
            Подтвердить редакцию и перейти к выбору накопителя →
          </button>
        `;
      }
    }

    // ЭТАП 2: Детектирование диска M.2 NVMe и ПРОВЕРКА ПРОБЛЕМЫ #2 (Intel VMD — список дисков пуст)
    else if (winStep === 2) {
      if (faultVmdActive) {
        setBanner('❌ Проблема #2: «Нам не удалось найти драйверы/диски» — установщик не видит M.2 NVMe SSD!', 'error');
        monitorScreenContent.innerHTML = `
          <div class="win-Box">
            <div class="win-Title">
              <span>💾 Где вы хотите установить Windows?</span>
              <span style="font-size:11px; color:#fca5a5;">0 дисков обнаружено</span>
            </div>
            <table class="partition-Table">
              <thead><tr><th>Имя</th><th>Общий размер</th><th>Свободно</th><th>Тип</th></tr></thead>
              <tbody>
                <tr><td colspan="4" style="text-align:center; color:#fca5a5; padding:14px;">⚠️ Диски не найдены. Нажмите «Загрузить драйвер», чтобы предоставить драйвер запоминающего устройства.</td></tr>
              </tbody>
            </table>
            <div class="error-AlertBox">
              <strong>⛔ Причина: Активен контроллер Intel VMD (Volume Management Device)</strong>
              Физически накопитель установлен в слот M.2, но в этом учебном образе отсутствует драйвер <code>Intel RST VMD</code>.
            </div>
            <div class="solution-Cards">
              <button class="sol-Btn" onclick="solveVmdLoadDriver()">
                📂 <b>Решение А («Загрузить драйвер»):</b> Указать папку <code>USB:\\Drivers\\IRST_VMD\\iaStorVD.inf</code> и подгрузить драйвер на лету
              </button>
              <button class="sol-Btn" onclick="solveVmdDisableInBios()">
                ⚙️ <b>Решение Б (Через UEFI BIOS):</b> Переключить контроллер хранения из режима <code>VMD RAID</code> в стандартный <code>AHCI / NVMe</code>
              </button>
            </div>
          </div>
          <button class="sim-Btn" disabled>Далее (Не выбран накопитель для установки)</button>
        `;
      } else {
        winStep = 3;
        renderWindowsStep();
      }
    }

    // ЭТАП 3: Таблица разделов и ПРОВЕРКА ПРОБЛЕМЫ #3 (Конфликт MBR против GPT + Конструктор томов C: и D:)
    else if (winStep === 3) {
      if (faultMbrActive) {
        setBanner('❌ Проблема #3: «Установка Windows на данный диск невозможна. Выбранный диск имеет таблицу разделов MBR»', 'error');
        monitorScreenContent.innerHTML = `
          <div class="win-Box">
            <div class="win-Title">
              <span>💾 Накопитель M.2 NVMe SSD 512 ГБ обнаружен</span>
              <span style="font-size:11px; color:#fca5a5;">Конфликт MBR / UEFI</span>
            </div>
            <table class="partition-Table">
              <thead><tr><th>Имя раздела</th><th>Размер</th><th>Стиль разделов</th><th>Статус</th></tr></thead>
              <tbody>
                <tr><td>Диск 0 Раздел 1 (Старая разметка)</td><td>512.0 ГБ</td><td style="color:#f87171; font-weight:700;">MBR (Legacy)</td><td>Блокирован</td></tr>
              </tbody>
            </table>
            <div class="error-AlertBox">
              <strong>⛔ В системах EFI установка Windows возможна только на GPT-диски!</strong>
              Так как мы загрузились в современном режиме UEFI, старая таблица разделов <code>MBR (Master Boot Record)</code> не подходит — требуется конвертация в <code>GPT (GUID Partition Table)</code>.
            </div>
            <p class="lab-note">В настоящем DiskPart команда clean удаляет разметку и доступ к данным выбранного диска. Здесь операции выполняются только на виртуальном учебном диске.</p>
            <div class="solution-Cards">
              <button class="sol-Btn" onclick="solveMbrViaDiskpart()">
                💻 <b>Решение (Консоль Shift + F10 → DISKPART):</b> Выполнить команды <code>select disk 0</code> → <code>clean</code> → <code>convert gpt</code>
              </button>
            </div>
            ${renderCmdBlock()}
          </div>
          <button class="sim-Btn" disabled>Далее (Требуется таблица разделов GPT)</button>
        `;
      } else {
        const dDriveSize = 511 - cDriveSizeGb;
        setBanner('🛠️ Конструктор разделов GPT: распредели объем SSD между системным диском C: и диском данных D:', 'normal');
        monitorScreenContent.innerHTML = `
          <div class="win-Box">
            <div class="win-Title">
              <span>🛠️ Конструктор разделов GPT на #part-ssd (512 ГБ)</span>
              <span style="font-size:11px; color:#6ee7b7;">Стиль диска: GPT ✓</span>
            </div>

            <div style="background:rgba(15,23,42,0.75); border:1px solid rgba(56,189,248,0.3); border-radius:7px; padding:9px 11px; margin-bottom:8px; font-size:11.5px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span>Ползунок объема системного тома <b>Диск C: (Windows)</b>: <b><span id="partitionC">${cDriveSizeGb}</span> ГБ</b></span>
                <span>Том <b>Диск D: (Данные)</b>: <b><span id="partitionD">${dDriveSize}</span> ГБ</b></span>
              </div>
              <input type="range" min="100" max="450" step="10" value="${cDriveSizeGb}" style="width:100%; cursor:pointer;"
                     aria-label="Размер системного раздела C" oninput="updatePartition(Number(this.value))" onchange="renderWindowsStep()" />
            </div>

            <table class="partition-Table">
              <thead><tr><th>Раздел GPT на #part-ssd</th><th>Размер</th><th>Файловая система</th><th>Назначение</th></tr></thead>
              <tbody>
                <tr><td>Диск 0 Раздел 1: EFI System</td><td>100 МБ</td><td>FAT32</td><td>Загрузчик Windows Boot Manager</td></tr>
                <tr><td>Диск 0 Раздел 2: MSR</td><td>16 МБ</td><td>Резерв</td><td>Служебный раздел Microsoft</td></tr>
                <tr style="background:rgba(16,185,129,0.2);"><td><b>Диск 0 Раздел 3: Системный (C:)</b></td><td><b>${cDriveSizeGb}.0 ГБ</b></td><td><b>NTFS</b></td><td><b>Ядро ОС и Программы (Выбран)</b></td></tr>
                <tr><td>Диск 0 Раздел 4: Данные (D:)</td><td>${dDriveSize}.0 ГБ</td><td>NTFS</td><td>Файлы пользователя и проекты</td></tr>
                <tr><td>Диск 0 Раздел 5: WinRE</td><td>884 МБ</td><td>NTFS</td><td>Среда восстановления системы</td></tr>
              </tbody>
            </table>
            ${renderCmdBlock()}
          </div>
          <button class="sim-Btn is-emerald" onclick="runWindowsCopyProcess()">
            Применить таблицу разделов GPT и установить ${winEdition} на Диск C: (${cDriveSizeGb} ГБ) →
          </button>
        `;
      }
    }

    // ЭТАП 4: Первичная настройка OOBE и ПРОВЕРКА ПРОБЛЕМЫ #4 (Требование интернета и аккаунта Microsoft)
    else if (winStep === 4) {
      if (faultOobeActive) {
        setBanner('❌ Проблема #4: Экран OOBE «Давайте подключим вас к сети» не пускает дальше без интернета и аккаунта Microsoft!', 'error');
        monitorScreenContent.innerHTML = `
          <div class="win-Box">
            <div class="win-Title">
              <span>🌐 Первичная настройка Windows 11 (OOBE)</span>
              <span style="font-size:11px; color:#fca5a5;">Требуется сеть</span>
            </div>
            <div class="error-AlertBox">
              <strong>⛔ «Давайте подключим вас к сети» — Кнопка «Далее» неактивна</strong>
              Установщик Windows 11 блокирует создание локальной учетной записи без активного подключения к интернету (а сетевой драйвер LAN/Wi-Fi еще не установлен).
            </div>
            <div class="solution-Cards">
              <button class="sol-Btn" onclick="solveOobeBypassNro()">
                💻 <b>Учебный сценарий старого образа (Команда Shift + F10 → OOBE\\BYPASSNRO):</b> Активировать кнопку «У меня нет интернета» и создать локальную учетную запись <code>Student-Admin</code>
              </button>
            </div>
            ${renderCmdBlock()}
          </div>
          <button class="sim-Btn" disabled>Далее (Подключение к сети не обнаружено)</button>
        `;
      } else {
        setBanner('✅ Автономная настройка доступна. Выберите пакет драйверов для завершения.', 'success');
        monitorScreenContent.innerHTML = `
          <div class="win-Box">
            <div class="win-Title">
              <span>👤 Локальный профиль «Student-Admin» и установка драйверов</span>
              <span style="font-size:11px; color:#6ee7b7;">${labProgress.resolved_faults.includes("OOBE_BYPASSNRO") ? "OOBE решено ✓" : "Сбой OOBE отключён"}</span>
            </div>
            <p style="font-size:11.5px; color:#cbd5e1; margin-bottom:8px;">
              В учебном образе доступен локальный профиль. Отметьте базовые драйверы для инсталляции перед запуском рабочего стола:
            </p>
            <div style="display:flex; flex-direction:column; gap:5px; font-size:11.5px; color:#e2e8f0;">
              <label><input type="checkbox" ${selectedDrivers.includes("chipset") ? "checked" : ""} onchange="toggleDriver('chipset',this.checked)" /> Драйвер чипсета Intel Z790 INF & Management Engine</label>
              <label><input type="checkbox" ${selectedDrivers.includes("gpu") ? "checked" : ""} onchange="toggleDriver('gpu',this.checked)" /> Графический драйвер WDDM 3.1 для дискретной видеокарты (#part-gpu)</label>
              <label><input type="checkbox" ${selectedDrivers.includes("network") ? "checked" : ""} onchange="toggleDriver('network',this.checked)" /> Драйвер контроллера NVMe PCIe 4.0 и сетевого адаптера 2.5G LAN</label>
            </div>
            ${renderCmdBlock()}
          </div>
          <button class="sim-Btn is-emerald" ${selectedDrivers.length < 3 ? "disabled" : ""} onclick="winStep = 5; renderWindowsStep();">
            Завершить настройку и загрузить рабочий стол Windows 11 →
          </button>
        `;
      }
    }

    // ЭТАП 5: Финальный рабочий стол и полный отчет по устраненным проблемам
    else if (winStep === 5) {
      labProgress.windows_installed = true;
      setBanner(`🎉 Windows установлена. Решено учебных неисправностей: ${labProgress.resolved_faults.length} / 4.`, 'success');
      monitorScreenContent.innerHTML = `
        <div class="win11-Desktop">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-size:13px; font-weight:700; color:#fff;">🪟 ${winEdition} • Пользователь: Student-Admin</span>
              <span style="font-size:10.5px; background:rgba(16,185,129,0.3); border:1px solid #10b981; padding:2px 8px; border-radius:99px; color:#a7f3d0;">Установка завершена ✓</span>
            </div>
            <div style="background:rgba(15,23,42,0.88); border:1px solid rgba(148,163,184,0.32); border-radius:8px; padding:10px; font-size:11px; line-height:1.5;">
              <b style="color:#38bdf8;">Отчет по устраненным проблемам и конфигурации системы:</b><br/>
              ${Object.entries(faultNames).map(([key, label]) => `${labProgress.resolved_faults.includes(key) ? '✓' : '○'} ${label}: ${labProgress.resolved_faults.includes(key) ? 'решено' : 'не отработано'}<br/>`).join('')}
              Системный раздел C: ${cDriveSizeGb} ГБ · Данные D: ${511 - cDriveSizeGb} ГБ<br/>
              Язык: ${setupLanguage === 'ru-RU' ? 'Русский' : 'English'} · Регион: ${setupRegion} · Клавиатура: ${setupKeyboard}<br/>
              Разбор узлов: ${labProgress.inspected_parts.length} / 8 · Сборка: ${labProgress.assembly_completed ? '8 / 8 ✓' : 'не завершена'} · BIOS: ${biosVersion}

            </div>
          </div>
          <div class="win11-Taskbar">
            <span>🟦 Пуск</span>
            <span>💻 Проводник (C: ${cDriveSizeGb}ГБ | D: ${511 - cDriveSizeGb}ГБ)</span>
            <span>⚙️ Диспетчер устройств (Без ошибок)</span>
            <span>🕒 14:30</span>
          </div>
        </div>
        <button class="sim-Btn" onclick="switchMode('partlab')">
          Вернуться к 3D-Лаборатории отдельных деталей ПК
        </button>
      `;
    }
  }

  /* Функции интерактивного решения 4 проблем установки Windows */
  function renderCmdBlock() {
    if (!cmdOpen) return '';
    return `
      <div class="cmd-Terminal">
        <div class="cmd-Header">
          <span>Администратор: X:\\Windows\\System32\\cmd.exe (Вызвана по Shift + F10)</span>
          <span>[Консоль восстановления]</span>
        </div>
        ${cmdLog.map(line => `<div>${line}</div>`).join('')}
      </div>
    `;
  }

  function solveTpmViaBios() {
    recordFault("TPM_BYPASS");
    faultTpmActive = false;
    document.getElementById('chkFaultTpm').checked = false;
    cmdOpen = true;
    cmdLog = [
      '<span class="cmd-Line">UEFI Setup > Security > PTT / fTPM 2.0 -> [Enabled]</span>',
      '<span class="cmd-Line">UEFI Setup > Boot > CSM Support -> [Disabled], Secure Boot -> [Enabled]</span>',
      '<span class="cmd-Success">✓ Аппаратный криптомодуль TPM 2.0 и Secure Boot успешно активированы!</span>'
    ];
    renderWindowsStep();
  }

  function solveTpmViaRegedit() {
    recordFault("TPM_BYPASS");
    faultTpmActive = false;
    document.getElementById('chkFaultTpm').checked = false;
    cmdOpen = true;
    cmdLog = [
      '<span class="cmd-Line">X:\\Sources> reg add "HKLM\\SYSTEM\\Setup\\LabConfig" /v BypassTPMCheck /t REG_DWORD /d 1 /f</span>',
      '<span class="cmd-Line">X:\\Sources> reg add "HKLM\\SYSTEM\\Setup\\LabConfig" /v BypassSecureBootCheck /t REG_DWORD /d 1 /f</span>',
      '<span class="cmd-Success">✓ Операция успешно завершена. Ограничения TPM 2.0 и Secure Boot обойдены через реестр!</span>'
    ];
    renderWindowsStep();
  }

  function solveVmdLoadDriver() {
    recordFault("INTEL_VMD_DRIVER");
    faultVmdActive = false;
    document.getElementById('chkFaultVmd').checked = false;
    cmdOpen = true;
    cmdLog = [
      '<span class="cmd-Line">X:\\Sources> drvload D:\\Drivers\\IRST_VMD\\iaStorVD.inf</span>',
      '<span class="cmd-Success">✓ Драйвер контроллера Intel RST VMD успешно загружен! Накопитель M.2 NVMe 512 ГБ обнаружен.</span>'
    ];
    winStep = 3;
    renderWindowsStep();
  }

  function solveVmdDisableInBios() {
    recordFault("INTEL_VMD_DRIVER");
    faultVmdActive = false;
    document.getElementById('chkFaultVmd').checked = false;
    winStep = 3;
    renderWindowsStep();
  }

  function solveMbrViaDiskpart() {
    recordFault("MBR_TO_GPT_DISKPART");
    faultMbrActive = false;
    document.getElementById('chkFaultMbr').checked = false;
    cmdOpen = true;
    cmdLog = [
      '<span class="cmd-Line">X:\\Sources> diskpart</span>',
      '<span class="cmd-Line">DISKPART> list disk  --> Диск 0 (512 ГБ NVMe SSD)</span>',
      '<span class="cmd-Line">DISKPART> select disk 0  --> Выбран диск 0</span>',
      '<span class="cmd-Line">DISKPART> clean  --> Все разделы виртуального диска удалены</span>',
      '<span class="cmd-Line">DISKPART> convert gpt</span>',
      '<span class="cmd-Success">✓ DiskPart успешно преобразовал выбранный диск в формат GPT!</span>'
    ];
    renderWindowsStep();
  }

  function runWindowsCopyProcess() {
    if (winTimer || faultMbrActive || faultVmdActive || faultTpmActive) return;
    let pct = 0;
    appRoot.classList.add('ssd-pulse');
    setBanner('⏳ Запись разделов GPT и распаковка образа Windows 11 по шине PCIe 4.0 на #part-ssd...', 'normal');

    monitorScreenContent.innerHTML = `
      <div class="win-Box">
        <div class="win-Title">⏳ Установка ${winEdition} на Диск C: (${cDriveSizeGb} ГБ)</div>
        <div style="font-size:11.5px; line-height:1.75; margin-bottom:10px; color:#cbd5e1;">
          <div>✓ 1. Форматирование разделов EFI (FAT32) и C:/D: (NTFS) — Выполнено</div>
          <div style="color:#38bdf8; font-weight:600;">↻ 2. Запись системных файлов на #part-ssd (<span id="winPctText">0%</span>)</div>
          <div>• 3. Регистрация загрузчика Windows Boot Manager в UEFI NVRAM</div>
        </div>
        <div class="progress-Track" style="height:12px;">
          <div class="progress-Fill" id="winCopyBar" style="width:0%;"></div>
        </div>
      </div>
      <button class="sim-Btn" disabled>Идет копирование на NVMe SSD...</button>
    `;

    winTimer = setInterval(() => {
      pct += 10;
      const bar = document.getElementById('winCopyBar');
      const txt = document.getElementById('winPctText');
      if (bar) bar.style.width = `${pct}%`;
      if (txt) txt.textContent = `${pct}%`;

      if (pct >= 100) {
        clearInterval(winTimer); winTimer = null;
        winStep = 4;
        appRoot.classList.remove('ssd-pulse');
        cmdOpen = false;
        renderWindowsStep();
        emitProgress();
      }
    }, 120);
  }

  function solveOobeBypassNro() {
    recordFault("OOBE_BYPASSNRO");
    faultOobeActive = false;
    document.getElementById('chkFaultOobe').checked = false;
    cmdOpen = true;
    cmdLog = [
      '<span class="cmd-Line">C:\\Windows\\System32> OOBE\\BYPASSNRO</span>',
      '<span class="cmd-Line">reg add HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\OOBE /v BypassNRO /t REG_DWORD /d 1 /f</span>',
      '<span class="cmd-Success">✓ Перезагрузка OOBE выполнена! Активирована кнопка «У меня нет интернета» и создан локальный профиль.</span>'
    ];
    renderWindowsStep();
  }

  /* ===================================================================== */
  /* ВКЛАДКА 4: СИМУЛЯТОР ПРОШИВКИ UEFI BIOS                               */
  /* ===================================================================== */
  function startBiosSimulator() {
    clearInterval(biosTimer);
    biosTimer = null;
    biosStep = biosVersion === 'v2.40' ? 3 : 0;
    appRoot.classList.remove('bios-pulse');
    renderBiosStep();
  }

  function renderBiosStep() {
    document.getElementById('progressLabel').textContent = 'Прошивка UEFI BIOS';
    document.getElementById('buildCounter').textContent = biosStep===3 ? 'Готово ✓' : `Шаг ${biosStep+1} / 4`;
    document.getElementById('buildProgressBar').style.width = `${(biosStep / 3) * 100}%`;

    if (biosStep === 0) {
      setBanner('POST: USB FAT32 подключён. Нажмите DEL для входа в UEFI.', 'normal');
      monitorScreenContent.innerHTML = '<div class="uefi-Box"><h3>POST · Система обнаружена</h3><p>Процессор, DDR5 и NVMe SSD готовы. USB FAT32 подключён.</p></div><button class="sim-Btn" onclick="biosStep=1; renderBiosStep()">Нажать DEL — войти в UEFI BIOS</button>';
    } else if (biosStep === 1) {
      setBanner('⚡ Прошивка BIOS (Шаг 1/3): Настройка параметров UEFI (TPM 2.0, Secure Boot, AHCI) и запуск M-Flash', 'normal');
      monitorScreenContent.innerHTML = `
        <div class="uefi-Box">
          <div class="uefi-Header">
            <span>UEFI BIOS UTILITY — ADVANCED & M-FLASH</span>
            <span>Версия: ${biosVersion}</span>
          </div>
          <div class="uefi-Grid">
            <div class="uefi-Card">
              <strong>Intel PTT / fTPM 2.0</strong>
              Enabled (Готов к Windows 11)
            </div>
            <div class="uefi-Card">
              <strong>Secure Boot Mode</strong>
              UEFI Standard (CSM Disabled)
            </div>
            <div class="uefi-Card">
              <strong>Носитель прошивки</strong>
              USB_FAT32: Z790_V240.ROM
            </div>
            <div class="uefi-Card" style="border-color:#f59e0b;">
              <strong>Целевая микросхема</strong>
              #bios-chip (SPI Flash 128 Мбит)
            </div>
          </div>
        </div>
        <button class="sim-Btn is-amber" onclick="selectFirmware()">
          Выбрать файл Z790_V240.ROM в M-Flash →
        </button>
      `;
    } else if (biosStep === 3) {
      setBanner('✅ Микрокод UEFI BIOS обновлен до версии v2.40! Переходите к Конструктору Windows 11.', 'success');
      monitorScreenContent.innerHTML = `
        <div class="uefi-Box">
          <div class="uefi-Header" style="color:#6ee7b7; border-color:#10b981;">
            <span>M-FLASH UPDATE COMPLETE (100%)</span>
            <span>BIOS v2.40</span>
          </div>
          <div class="uefi-Card" style="border-color:#10b981;">
            <strong style="color:#6ee7b7;">Микрокод успешно перезаписан:</strong>
            Шина <code>#data-bus-bios</code> передала образ прошивки с USB-флешки в энергонезависимую память <code>#bios-chip</code>.
          </div>
        </div>
        <button class="sim-Btn is-emerald" onclick="switchMode('windows')">
          Перейти в «🪟 5. Конструктор Windows 11 + Ошибки» →
        </button>
      `;
    }
  }

  function runBiosFlash() {
    if (biosTimer) return;
    biosStep = 2;
    document.getElementById('buildCounter').textContent = 'Шаг 4 / 4';
    let p = 0;
    appRoot.classList.add('bios-pulse');
    monitorScreenContent.innerHTML = `
      <div class="uefi-Box">
        <div class="uefi-Header"><span>ПЕРЕЗАПИСЬ SPI FLASH (#bios-chip)</span><span id="bPct">0%</span></div>
        <p style="font-size:11.5px; color:#fde68a; margin-bottom:10px;">⚠️ Не отключайте питание! Импульсы идут по шине #data-bus-bios на 3D-плате справа...</p>
        <div class="progress-Track" style="height:12px;"><div class="progress-Fill" id="bBar" style="width:0%;"></div></div>
      </div>
      <button class="sim-Btn" disabled>Прошивка...</button>
    `;
    biosTimer = setInterval(() => {
      p += 10;
      const b = document.getElementById('bBar');
      const t = document.getElementById('bPct');
      if (b) b.style.width = `${p}%`;
      if (t) t.textContent = `${p}%`;
      if (p >= 100) {
        clearInterval(biosTimer); biosTimer = null;
        labProgress.bios_flashed = true;
        biosVersion = 'v2.40';
        biosStep = 3;
        appRoot.classList.remove('bios-pulse');
        renderBiosStep();
        emitProgress();
      }
    }, 110);
  }

  /* ===================================================================== */
  /* ВКЛАДКА 3: КОНСТРУКТОР СБОРКИ ПК                                      */
  /* ===================================================================== */
  function resetBuilder() {
    labProgress.assembly_completed = false;
    labProgress.assembly_mistakes = 0;
    installedParts = new Set(['pc-case']);
    partInHand = null;
    ORDERED_STEPS.forEach(id => {
      const svgPart = document.getElementById(id);
      if (svgPart) { svgPart.classList.add('is-uninstalled'); svgPart.classList.remove('is-installed-part'); }
      const btn = document.getElementById(`btn-${id}`);
      if (btn) btn.classList.remove('is-installed', 'is-selected');
      const badge = document.getElementById(`badge-${id}`);
      if (badge) badge.textContent = 'Склад';
    });
    document.getElementById('btn-pc-case').classList.add('is-installed');
    updateDropzonesVisibility();
    updateBuildProgress();
    selectPartForBuild('part-psu');
  }

  function handleSidebarClick(partId) {
    if (currentMode === 'partlab') {
      renderSinglePart3D(partId);
      return;
    }
    if (currentMode === 'explore' || currentMode === 'bios' || currentMode === 'windows') {
      inspectPart(partId);
      return;
    }
    if (partId === 'all' || partId === 'pc-case') return;
    if (installedParts.has(partId)) {
      populateInspectorCard(partId);
      return;
    }
    selectPartForBuild(partId);
  }

  function selectPartForBuild(partId) {
    partInHand = partId;
    // The cooler slot overlaps the M.2 socket in projection. Keep the selected
    // target above sibling hit areas without changing any model geometry.
    const selectedZone = document.getElementById('zone-' + partId);
    if (selectedZone) selectedZone.parentNode.appendChild(selectedZone);
    document.querySelectorAll('.part-Btn').forEach(btn => {
      btn.classList.toggle('is-selected', btn.dataset.part === partId);
    });
    populateInspectorCard(partId);
    const rule = BUILD_RULES[partId];
    setBanner(`✋ В руках: ${rule.name} — кликните по слоту ${rule.slotName} на 3D-корпусе!`, 'normal');
  }

  function tryPlaceInSlot(targetSlotId, event) {
    if (event) event.stopPropagation();
    if (currentMode !== 'builder' || !partInHand) return;
    const zoneEl = document.getElementById(`zone-${targetSlotId}`);

    if (partInHand !== targetSlotId) {
      labProgress.assembly_mistakes++;
      zoneEl.classList.add('is-wrong');
      setTimeout(() => zoneEl.classList.remove('is-wrong'), 600);
      setBanner(`❌ Неверный разъем! Вы держите «${BUILD_RULES[partInHand].name}», а кликнули на ${BUILD_RULES[targetSlotId].slotName}.`, 'error');
      emitProgress();
      return;
    }

    const rule = BUILD_RULES[partInHand];
    const missingDep = rule.requires.find(reqId => !installedParts.has(reqId));
    if (missingDep) {
      labProgress.assembly_mistakes++;
      zoneEl.classList.add('is-wrong');
      setTimeout(() => zoneEl.classList.remove('is-wrong'), 600);
      setBanner(`⚠️ ${rule.missingMsg}`, 'error');
      emitProgress();
      return;
    }

    installedParts.add(partInHand);
    const svgPart = document.getElementById(partInHand);
    if (svgPart) { svgPart.classList.remove('is-uninstalled'); svgPart.classList.add('is-installed-part'); }
    const btn = document.getElementById(`btn-${partInHand}`);
    if (btn) { btn.classList.remove('is-selected'); btn.classList.add('is-installed'); }
    const badge = document.getElementById(`badge-${partInHand}`);
    if (badge) badge.textContent = 'Готово ✓';

    document.querySelectorAll('.slot-zone').forEach(z => z.classList.remove('is-hinted'));
    updateDropzonesVisibility();
    updateBuildProgress();

    const nextPart = ORDERED_STEPS.find(id => !installedParts.has(id));
    if (nextPart) {
      selectPartForBuild(nextPart);
    } else {
      partInHand = null;
      labProgress.assembly_completed = true;
      setBanner('🎉 Сборка ПК завершена (8/8)! Переходите к прошивке BIOS или Конструктору Windows 11.', 'success');
    }
    emitProgress();
  }

  function updateDropzonesVisibility() {
    const moboInstalled = installedParts.has('part-mobo');
    const cpuInstalled = installedParts.has('part-cpu');
    const allInternalDone = ['part-psu', 'part-mobo', 'part-cpu', 'part-ram', 'part-ssd', 'part-cooler', 'part-gpu']
      .every(id => installedParts.has(id));

    const setZ = (id, vis) => {
      const z = document.getElementById(`zone-${id}`);
      if (z) z.classList.toggle('is-hidden-zone', !vis);
    };
    setZ('part-psu', !installedParts.has('part-psu'));
    setZ('part-mobo', !installedParts.has('part-mobo'));
    setZ('part-cpu', moboInstalled && !installedParts.has('part-cpu'));
    setZ('part-ram', moboInstalled && !installedParts.has('part-ram'));
    setZ('part-ssd', moboInstalled && !installedParts.has('part-ssd'));
    setZ('part-cooler', moboInstalled && cpuInstalled && !installedParts.has('part-cooler'));
    setZ('part-gpu', moboInstalled && !installedParts.has('part-gpu'));
    setZ('case-glass-panel', allInternalDone && !installedParts.has('case-glass-panel'));
  }

  function updateBuildProgress() {
    const count = installedParts.size - 1;
    const total = ORDERED_STEPS.length;
    document.getElementById('buildCounter').textContent = `${count} / ${total}`;
    document.getElementById('buildProgressBar').style.width = `${(count / total) * 100}%`;
  }

  function showBuilderHint() {
    const nextCorrect = ORDERED_STEPS.find(id => !installedParts.has(id));
    if (!nextCorrect) return;
    selectPartForBuild(nextCorrect);
    const targetZone = document.getElementById(`zone-${nextCorrect}`);
    if (targetZone) targetZone.classList.add('is-hinted');
  }

  function installNextCorrectStep() {
    const target = ORDERED_STEPS.find(id => !installedParts.has(id));
    if (target) { selectPartForBuild(target); tryPlaceInSlot(target); }
  }

  function ensureAllPartsInstalledVisually() {
    ORDERED_STEPS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('is-uninstalled', 'is-installed-part');
      const btn = document.getElementById(`btn-${id}`);
      if (btn) btn.classList.remove('is-installed', 'is-selected');
      const badge = document.getElementById(`badge-${id}`);
      if (badge) badge.textContent = '3D Модель';
    });
  }

  function onSvgPartClick(partId, event) {
    if (event) event.stopPropagation();
    populateInspectorCard(partId);
  }

  function inspectPart(partId) {
    document.querySelectorAll('.part-Btn').forEach(btn => {
      btn.classList.toggle('is-selected', btn.dataset.part === partId);
    });
    populateInspectorCard(partId);
  }

  function populateInspectorCard(partId) {
    const data = PARTS_DB[partId] || PARTS_DB['part-cpu'];
    document.getElementById('inspBadge').textContent = data.badge;
    document.getElementById('inspTitle').textContent = data.title;
    document.getElementById('inspDesc').textContent = data.desc;
    document.getElementById('inspRole').textContent = data.role;

    const specs = partId === 'all' ? [['Узлов на стенде', '8 / 8'], ['Версия BIOS', biosVersion + ' UEFI'], ['Статус ОС', labProgress.windows_installed ? 'Установлена' : 'Готов к установке']] : data.specs;
    document.getElementById('inspSpecs').innerHTML = specs
      .map(([k, v]) => `<div class="spec-Row"><span class="spec-Key">${k}</span><span class="spec-Val">${v}</span></div>`)
      .join('');

    document.getElementById('inspSubparts').innerHTML = data.subparts
      .map(item => `<li>${item}</li>`)
      .join('');
  }

  function toggleExplode() {
    appRoot.classList.toggle('is-exploded');
    document.getElementById('btnExplode').classList.toggle('is-active');
  }

  function toggleMonitorMinimize() {
    virtualMonitor.classList.toggle('is-minimized');
  }

  function restartCurrentSim() {
    if (currentMode === 'bios') { labProgress.bios_flashed = false; biosVersion = 'v1.02'; startBiosSimulator(); }
    if (currentMode === 'windows') startWindowsConstructor();
  }

  function setBanner(text, status) {
    builderBanner.textContent = text;
    builderBanner.classList.remove('is-error', 'is-success');
    if (status === 'error') builderBanner.classList.add('is-error');
    if (status === 'success') builderBanner.classList.add('is-success');
  }


// Integration boundary: the host owns authentication and persistence. No tokens enter this document.
const faultInputs = {TPM_BYPASS:'chkFaultTpm',INTEL_VMD_DRIVER:'chkFaultVmd',MBR_TO_GPT_DISKPART:'chkFaultMbr',OOBE_BYPASSNRO:'chkFaultOobe'};
const faultNames = {TPM_BYPASS:'TPM / Secure Boot',INTEL_VMD_DRIVER:'Контроллер Intel VMD',MBR_TO_GPT_DISKPART:'Разметка GPT',OOBE_BYPASSNRO:'Автономная настройка OOBE'};
let labProgress = {inspected_parts:[],assembly_completed:false,assembly_mistakes:0,bios_flashed:false,windows_installed:false,resolved_faults:[],system_drive_gb:200};
let selectedDrivers = [];
let initialized = false;
function recordFault(fault) {
  if (!labProgress.resolved_faults.includes(fault)) labProgress.resolved_faults.push(fault);
}
function toggleDriver(driver, checked) {
  selectedDrivers = selectedDrivers.filter(d => d !== driver);
  if (checked) selectedDrivers.push(driver);
  renderWindowsStep();
}
function updatePartition(size) {
  cDriveSizeGb = size;
  document.getElementById('partitionC').textContent = size;
  document.getElementById('partitionD').textContent = 511 - size;
}
function selectFirmware() {
  document.getElementById('buildCounter').textContent = 'Шаг 3 / 4';
  document.getElementById('buildProgressBar').style.width = '50%';
  monitorScreenContent.innerHTML = `<div class="uefi-Box"><h3>USB_DRIVE · FAT32</h3><p>Выберите прошивку для учебной платы Z790.</p><label><input type="radio" name="firmware" checked/> Z790_V240.ROM · v2.40</label><p class="lab-note">На настоящем ПК образ должен точно соответствовать модели и ревизии платы.</p></div><button class="sim-Btn is-amber" onclick="runBiosFlash()">Подтвердить и обновить</button>`;
}
function restoreBuilder() {
  partInHand = null;
  ORDERED_STEPS.forEach(id => {
    const done = installedParts.has(id);
    const part = document.getElementById(id);
    part.classList.toggle('is-uninstalled', !done);
    part.classList.toggle('is-installed-part', done);
    const btn = document.getElementById('btn-' + id);
    btn?.classList.toggle('is-installed', done);
    document.getElementById('badge-' + id).textContent = done ? 'Готово ✓' : 'Склад';
  });
  updateDropzonesVisibility(); updateBuildProgress();
  const next = ORDERED_STEPS.find(id => !installedParts.has(id));
  if (next) selectPartForBuild(next);
  else setBanner('Сборка завершена: 8 / 8. Можно перейти к BIOS.', 'success');
}
function snapshot() {
  return {...labProgress, system_drive_gb:cDriveSizeGb, resume:{
    language:setupLanguage, region:setupRegion, keyboard:setupKeyboard,
    mode:currentMode, installed:ORDERED_STEPS.filter(id=>installedParts.has(id)),
    win_step:winStep, edition:winEdition, drivers:selectedDrivers,
    faults:Object.entries(faultInputs).filter(([,id])=>document.getElementById(id).checked).map(([key])=>key)
  }};
}
function emitProgress() {
  if (initialized) parent.postMessage({type:'pc-lab:progress',progress:snapshot()}, location.origin);
}
function restoreProgress(data) {
  labProgress = {...labProgress, ...data};
  const resume = data.resume || {};
  installedParts = new Set(['pc-case', ...(resume.installed || [])]);
  if (data.assembly_completed) ORDERED_STEPS.forEach(id=>installedParts.add(id));
  biosVersion = data.bios_flashed ? 'v2.40' : 'v1.02';
  winStep = data.windows_installed ? 5 : (resume.win_step || 1);
  cDriveSizeGb = data.system_drive_gb || 200;
  winEdition = resume.edition || 'Windows 11 Pro (x64)';
  setupLanguage = resume.language || 'ru-RU';
  setupRegion = resume.region || 'KZ';
  setupKeyboard = resume.keyboard || 'ru';
  selectedDrivers = resume.drivers || [];
  Object.entries(faultInputs).forEach(([key,id])=>document.getElementById(id).checked = (resume.faults || Object.keys(faultInputs)).includes(key));
  syncFaultToggles();
  switchMode(resume.mode || 'partlab');
  initialized = true;
  appRoot.inert = false;
}
window.addEventListener('message', event => {
  if (event.source !== parent || event.origin !== location.origin) return;
  if (event.data?.type === 'pc-lab:connect') parent.postMessage({type:'pc-lab:ready'},location.origin);
  if ((event.data?.type === 'pc-lab:init' && !initialized) || event.data?.type === 'pc-lab:restore') restoreProgress(event.data.progress);
});
window.addEventListener('pagehide',()=>{clearInterval(biosTimer);clearInterval(winTimer);});
document.addEventListener('visibilitychange',()=>appRoot.classList.toggle('is-paused',document.hidden));
document.addEventListener('click',()=>queueMicrotask(emitProgress));
document.addEventListener('change',()=>queueMicrotask(emitProgress));
document.addEventListener('keydown',event=>{
  if (currentMode === 'windows' && event.shiftKey && event.key === 'F10') {
    event.preventDefault(); cmdOpen = !cmdOpen; renderWindowsStep();
  }
});
document.querySelectorAll('.slot-zone').forEach(zone=>{
  zone.setAttribute('tabindex','0'); zone.setAttribute('role','button');
  zone.setAttribute('aria-label',BUILD_RULES[zone.id.replace('zone-','')]?.slotName || 'Слот компонента');
  zone.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();tryPlaceInSlot(zone.id.replace('zone-',''));emitProgress();}});
});
mainPcSvg.setAttribute('aria-label','Изометрический компьютер с интерактивными слотами');
singlePartSvg.setAttribute('aria-label','Послойная модель выбранной детали');
builderBanner.setAttribute('role','status');
appRoot.dataset.mode = 'partlab';
renderSinglePart3D('part-cpu');
if (parent !== window) {
  appRoot.inert = true;
  parent.postMessage({type:'pc-lab:ready'},location.origin);
} else {
  document.body.insertAdjacentHTML('afterbegin','<p class="lab-note">Откройте <a href="/pc-lab">практикум на сайте</a>, чтобы сохранять результаты.</p>');
  initialized = true;
}
new ResizeObserver(()=>parent.postMessage({type:'pc-lab:height',height:appRoot.getBoundingClientRect().height},location.origin)).observe(appRoot);

// Explicit exports for the static document’s inline event handlers.
Object.assign(window, {togglePartDissect, togglePartXray, solveTpmViaBios, solveTpmViaRegedit, solveVmdLoadDriver, solveVmdDisableInBios, solveMbrViaDiskpart, runWindowsCopyProcess, solveOobeBypassNro, runBiosFlash, resetBuilder, handleSidebarClick, showBuilderHint, installNextCorrectStep, onSvgPartClick, toggleExplode, toggleMonitorMinimize, restartCurrentSim, toggleDriver, updatePartition, selectFirmware});

function fitPartViewport() {
  // Reserve room for original text labels and the 3-layer exploded offsets.
  const box = singlePartSvg.getBBox();
  const left = Math.min(0, box.x - 24), right = Math.max(860, box.x + box.width + 24);
  singlePartSvg.setAttribute('viewBox', `${left} -80 ${right - left} 720`);
}

function previousSetupStep() {
  clearInterval(winTimer); winTimer = null;
  clearInterval(biosTimer); biosTimer = null;
  appRoot.classList.remove('bios-pulse', 'ssd-pulse');
  if (currentMode === 'windows') {
    winStep = Math.max(1, winStep - 1);
    if (winStep < 5) labProgress.windows_installed = false;
    cmdOpen = false; renderWindowsStep();
  } else if (currentMode === 'bios') {
    biosStep = biosStep > 1 ? 1 : 0; renderBiosStep();
  }
}
window.previousSetupStep = previousSetupStep;
