import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildHardware, type Hardware } from './models';
import { catalog, PART_IDS, type PartId } from './catalog';
import './viewer.css';
interface State {
    mode: string;
    part: PartId;
    dissect: boolean;
    xray: boolean;
    exploded: boolean;
    installed: string[];
    held: string | null;
}
const initial: State = { mode: 'partlab', part: 'part-cpu', dissect: false, xray: false, exploded: false, installed: [], held: null };
let state = initial, extracted: PartId | null = null, extracting: PartId | null = null, extraction = 0;
const root = document.getElementById('hardware-viewer')!;
root.innerHTML = `<section class="hardware-card" aria-label="Трёхмерный осмотр компонентов">
<header><div><span class="eyebrow">HARDWARE ANATOMY / 01</span><h2 id="modelTitle"></h2><p id="modelSubtitle"></p></div><span class="live-badge">● LIVE 3D</span></header>
<div class="stage" id="stage" tabindex="0" role="group" aria-label="3D-модель: потяните для вращения; стрелки поворачивают, плюс и минус меняют масштаб"><div class="stage-hint" id="stageHint">Потяни, чтобы повернуть · Колесо — масштаб</div><div id="renderError" role="status" hidden></div><div class="view-axis" aria-hidden="true">Y ↑<br/>Z ↙ X ↗</div><div class="scale-mark" aria-hidden="true">УЧЕБНАЯ МОДЕЛЬ · НЕ В МАСШТАБЕ</div></div>
<div class="viewer-tools"><button id="returnPC" hidden>← Вернуть в компьютер</button><button id="explode">Разобрать по слоям</button><button id="xray">Рентген</button><button id="resetView">Сбросить вид</button><button id="frontView">Спереди</button><button id="backView">Сзади</button><button id="topView">Сверху</button><button id="bottomView">Снизу</button><button id="zoomIn" aria-label="Увеличить модель">＋</button><button id="zoomOut" aria-label="Уменьшить модель">−</button><button id="theme">Светлый фон</button></div>
<div class="slot-list" id="slots" aria-label="Посадочные места сборки"></div><div class="layer-list" id="layers" aria-label="Слои модели"></div><footer><p id="modelNote"></p><span id="readout" role="status"></span></footer></section>`;
const el = (id: string) => document.getElementById(id)!;
const post = (action: string, data: object = {}) => {
    if (parent !== window)
        parent.postMessage({ type: 'hardware:action', action, ...data }, location.origin);
};
function mountViewer() {
    let renderer: T.WebGLRenderer;
    try {
        renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    }
    catch {
        el('renderError').hidden = false;
        el('renderError').textContent = '3D недоступно: включите аппаратное ускорение браузера. Можно продолжить практикум в режиме схемы.';
        post('unavailable');
        return;
    }
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    const stage = el('stage');
    stage.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(36, 1, .05, 150);
    const pmrem = new T.PMREMGenerator(renderer), room = new RoomEnvironment();
    const env = pmrem.fromScene(room, .04);
    scene.environment = env.texture;
    scene.environmentIntensity = .7;
    room.dispose();
    pmrem.dispose();
    const ambient = new T.HemisphereLight('#e0eaf8', '#263544', .8);
    scene.add(ambient);
    const key = new T.DirectionalLight('#f7ead9', 2.2);
    key.position.set(5, 10, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -9;
    key.shadow.camera.right = key.shadow.camera.top = 9;
    key.shadow.normalBias = .025;
    key.shadow.bias = -.0001;
    key.shadow.radius = 3;
    scene.add(key);
    const rim = new T.DirectionalLight('#8dd4df', 1.2);
    rim.position.set(-5, 3, -4);
    scene.add(rim);
    const content = new T.Group();
    scene.add(content);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .09;
    controls.enablePan = false;
    controls.minDistance = 2;
    controls.maxDistance = 24;
    controls.maxPolarAngle = Math.PI * .95;
    controls.target.set(0, 0, 0);
    const grid = new T.GridHelper(20, 40, '#354450', '#1d2a32');
    grid.position.y = -3.5;
    grid.material.transparent = true;
    grid.material.opacity = .3;
    scene.add(grid);
    let cameraGoal: T.Vector3 | null = null, targetGoal: T.Vector3 | null = null;
    const ground = new T.Mesh(new T.PlaneGeometry(100, 100), new T.ShadowMaterial({ opacity: .18 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const raycaster = new T.Raycaster(), pointer = new T.Vector2();
    let models: {
        id: PartId;
        hardware: Hardware;
        home: T.Vector3;
        move: T.Vector3;
    }[] = [], slots: T.Mesh[] = [];
    let radius = 4, distance = 12, visible = true, hidden = document.hidden, frame = 0, last = 0, dirty = true, light = false, failed = false;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let focusLayer: number | null = null;
    const layouts: Record<PartId, {
        p: [
            number,
            number,
            number
        ];
        r: [
            number,
            number,
            number
        ];
        s: number;
        out: [
            number,
            number,
            number
        ];
    }> = {
        'pc-case': { p: [0, 0, 0], r: [0, 0, 0], s: 1, out: [0, 0, 0] },
        'part-mobo': { p: [-.1, .25, -1.96], r: [Math.PI / 2, 0, 0], s: .67, out: [-3.5, 0, -.8] },
        'part-cpu': { p: [-.468, .786, -1.78], r: [Math.PI / 2, 0, 0], s: .42, out: [-2.8, 2.0, 1.4] },
        'part-ram': { p: [.697, .732, -1.54], r: [Math.PI / 2, Math.PI / 2, 0], s: .35, out: [2.7, 1.6, .4] },
        'part-ssd': { p: [-.488, -.118, -1.69], r: [Math.PI / 2, 0, 0], s: .4, out: [2.7, -.3, 1.6] },
        'part-cooler': { p: [-.468, .786, -.83], r: [Math.PI / 2, Math.PI / 2, 0], s: .59, out: [-.3, 2.4, 2.4] },
        'part-gpu': { p: [-.468, -.386, -1.16], r: [Math.PI, 0, 0], s: .49, out: [-2.6, -.2, 2.9] },
        'part-psu': { p: [0, -2.4, -.2], r: [0, 0, 0], s: .62, out: [.5, -.4, 3.9] },
    };
    function clear() {
        for (const m of models) {
            m.hardware.dispose();
        }
        models = [];
        for (const s of slots) {
            s.geometry.dispose();
            (s.material as T.Material).dispose();
        }
        slots = [];
        content.clear();
    }
    function partView() { return state.mode === 'partlab' || !!extracted; }
    function currentPart() { return extracted || state.part; }
    function rebuild() {
        clear();
        content.position.set(0, 0, 0);
        focusLayer = null;
        const solo = partView();
        const ids = solo ? [currentPart()] : [...PART_IDS];
        for (const id of ids) {
            const hardware = buildHardware(id);
            hardware.root.userData.part = id;
            content.add(hardware.root);
            const l = layouts[id];
            if (!solo) {
                hardware.root.position.set(...l.p);
                hardware.root.rotation.set(...l.r);
                hardware.root.scale.setScalar(l.s);
                if (id === 'part-ram') {
                    for (const layer of hardware.layers) {
                        const twin = layer.group.clone();
                        twin.position.z += .456 / l.s;
                        layer.group.add(twin);
                    }
                    hardware.solids *= 2;
                }
                if (id === 'part-mobo')
                    hardware.layers[2].group.visible = false;
            }
            models.push({ id, hardware, home: hardware.root.position.clone(), move: new T.Vector3(...l.out) });
        }
        if (!solo && state.mode === 'builder')
            for (const id of [...PART_IDS.filter(p => p !== 'pc-case'), 'case-glass-panel']) {
                const layout = id === 'case-glass-panel' ? { p: [0, 0, 2.5], s: 1 } : layouts[id as PartId];
                const source = models.find(m => m.id === id);
                const size = source ? new T.Box3().setFromObject(source.hardware.root).getSize(new T.Vector3()).max(new T.Vector3(.4, .35, .35)) : new T.Vector3(3.7, 5.9, .1);
                const geo = new T.BoxGeometry(size.x, size.y, size.z);
                const mat = new T.MeshBasicMaterial({ color: '#78d8c0', transparent: true, opacity: .13, depthWrite: false });
                const slot = new T.Mesh(geo, mat);
                slot.position.set(...layout.p as [
                    number,
                    number,
                    number
                ]);
                slot.userData.slot = id;
                slots.push(slot);
                content.add(slot);
            }
        updateVisibility();
        const bounds = new T.Box3().setFromObject(content);
        const center = bounds.getCenter(new T.Vector3());
        if (solo) {
            content.position.copy(center).negate();
        }
        else
            content.position.set(0, 0, 0);
        radius = Math.max(2, bounds.getSize(new T.Vector3()).length() / 2);
        distance = solo ? radius * 2.75 : 14;
        grid.position.y = solo ? -bounds.getSize(new T.Vector3()).y / 2 - .35 : -3.5;
        ground.position.y = grid.position.y + .005;
        resetCamera();
        updateText();
        invalidate();
    }
    function updateVisibility() {
        for (const m of models) {
            m.hardware.root.visible = state.mode !== 'builder' || m.id === 'pc-case' || state.installed.includes(m.id);
            if (!partView() && m.id === 'pc-case')
                m.hardware.layers[2].group.visible = state.mode !== 'builder' || state.installed.includes('case-glass-panel');
            for (const layer of m.hardware.layers) {
                layer.group.traverse(o => {
                    if (o instanceof T.Mesh) {
                        const mat = o.material as T.MeshStandardMaterial;
                        if (!('map' in mat && mat.map) && mat.color) {
                            const isGlass = mat instanceof T.MeshPhysicalMaterial;
                            mat.transparent = state.xray || isGlass;
                            mat.opacity = state.xray ? .32 : isGlass ? .1 : 1;
                            mat.depthWrite = !state.xray && !isGlass;
                        }
                    }
                });
            }
        }
        for (const slot of slots) {
            slot.visible = !state.installed.includes(slot.userData.slot);
            const mat = slot.material as T.MeshBasicMaterial;
            mat.opacity = slot.userData.slot === state.held ? .26 : .055;
            mat.color.set(slot.userData.slot === state.held ? '#84efc8' : '#67798b');
        }
    }
    function updateText() {
        const solo = partView(), part = currentPart(), info = catalog[part];
        el('modelTitle').textContent = solo ? info.title : 'Компьютер · открытая архитектура';
        el('modelSubtitle').textContent = solo ? info.subtitle : state.mode === 'builder' ? 'Выбери компонент и нажми на его посадочное место' : 'Нажми на деталь, чтобы вынуть её и рассмотреть';
        el('modelNote').textContent = solo ? info.note : 'Поверни компьютер, выбери компонент на сцене или в списке слева. Деталь выдвинется из корпуса и откроется для осмотра со всех сторон.';
        el('returnPC').hidden = !extracted && !extracting;
        el('explode').textContent = solo ? (state.dissect ? 'Собрать деталь' : 'Разобрать по слоям') : (state.exploded ? 'Собрать компьютер' : 'Разнести компоненты');
        el('explode').classList.toggle('active', solo ? state.dissect : state.exploded);
        el('xray').classList.toggle('active', state.xray);
        el('layers').innerHTML = solo ? models[0].hardware.layers.map((l, i) => `<button data-layer="${i}" aria-pressed="${focusLayer === i}"><i></i>${l.name}</button>`).join('') : '';
        el('slots').innerHTML = state.mode === 'builder' ? slots.filter(s => s.visible).map(s => `<button data-slot="${s.userData.slot}" class="${state.held === s.userData.slot ? 'active' : ''}">Установить: ${s.userData.slot === 'case-glass-panel' ? 'боковое стекло' : catalog[s.userData.slot as PartId].title}</button>`).join('') : '';
        el('readout').textContent = extracting ? 'Извлекаем компонент…' : solo ? `${models[0].hardware.solids} деталей · ${state.dissect ? 'разобрано' : 'собрано'}` : `${state.mode === 'builder' ? state.installed.filter(id => id !== 'pc-case').length : 8} / 8 компонентов`;
        root.dataset.part = solo ? part : 'all';
        root.dataset.mode = state.mode;
        root.dataset.extracted = extracted || '';
        root.dataset.dissect = String(state.dissect);
        root.dataset.ready = 'true';
    }
    function resetCamera(v = 'iso') {
        const dirs: Record<string, [
            number,
            number,
            number
        ]> = { iso: partView() ? [1, .72, 1.25] : [-.8, .5, 1.6], front: [0, .13, 1], back: [0, .13, -1], top: [.001, 1, .001], bottom: [.001, -1, .001] };
        camera.position.copy(new T.Vector3(...dirs[v]).normalize().multiplyScalar(distance));
        controls.target.set(0, 0, 0);
        fitPose(true);
        controls.update();
        invalidate();
    }
    function layerOffset(id: PartId, index: number, move: T.Vector3) {
        const target = move.clone().multiplyScalar(partView() && state.dissect ? 1 : 0);
        if (!partView() && id === 'pc-case' && index === 2 && state.exploded)
            target.z = 3;
        return target;
    }
    function fitPose(immediate = false) {
        const saved: {
            obj: T.Object3D;
            p: T.Vector3;
        }[] = [];
        for (const m of models) {
            saved.push({ obj: m.hardware.root, p: m.hardware.root.position.clone() });
            m.hardware.root.position.copy(m.home).addScaledVector(m.move, !partView() && state.exploded ? 1 : 0);
            m.hardware.layers.forEach((l, i) => {
                saved.push({ obj: l.group, p: l.group.position.clone() });
                l.group.position.copy(layerOffset(m.id, i, l.move));
                if (partView())
                    l.group.visible = focusLayer === null || focusLayer === i;
            });
        }
        content.updateMatrixWorld(true);
        const box = new T.Box3();
        content.traverse(o => {
            if (o instanceof T.Mesh) {
                let shown = true;
                let parent: T.Object3D | null = o;
                while (parent) {
                    shown = shown && parent.visible;
                    parent = parent.parent;
                }
                if (shown)
                    box.expandByObject(o);
            }
        });
        for (const { obj, p } of saved)
            obj.position.copy(p);
        content.updateMatrixWorld(true);
        if (box.isEmpty())
            return;
        const center = box.getCenter(new T.Vector3()), dir = camera.position.clone().sub(controls.target).normalize(), right = new T.Vector3().crossVectors(camera.up, dir).normalize(), up = new T.Vector3().crossVectors(dir, right).normalize(), tan = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
        let fit = 0;
        for (const x of [box.min.x, box.max.x])
            for (const y of [box.min.y, box.max.y])
                for (const z of [box.min.z, box.max.z]) {
                    const offset = new T.Vector3(x, y, z).sub(center);
                    fit = Math.max(fit, Math.abs(offset.dot(right)) / (tan * camera.aspect) + offset.dot(dir), Math.abs(offset.dot(up)) / tan + offset.dot(dir));
                }
        distance = Math.max(2, fit * 1.14);
        controls.maxDistance = Math.max(24, distance * 2);
        targetGoal = center;
        cameraGoal = center.clone().addScaledVector(dir, distance);
        if (immediate || motion.matches) {
            camera.position.copy(cameraGoal);
            controls.target.copy(center);
            cameraGoal = targetGoal = null;
        }
        invalidate();
    }
    function invalidate() {
        dirty = true;
        if (!frame && visible && !hidden && !failed)
            frame = requestAnimationFrame(tick);
    }
    function tick(now: number) {
        frame = 0;
        if (!visible || hidden || failed)
            return;
        const dt = Math.min(.05, last ? (now - last) / 1000 : .016);
        last = now;
        let moving = false;
        const alpha = motion.matches ? 1 : 1 - Math.exp(-dt * 8);
        for (const m of models) {
            const solo = partView();
            const out = !solo && state.exploded ? 1 : 0;
            const target = m.home.clone().addScaledVector(m.move, out);
            if (extracting === m.id)
                target.add(new T.Vector3(0, .25, 4));
            if (m.hardware.root.position.distanceTo(target) > .001) {
                m.hardware.root.position.lerp(target, alpha);
                moving = true;
            }
            m.hardware.layers.forEach((l, i) => {
                const dst = layerOffset(m.id, i, l.move);
                if (l.group.position.distanceTo(dst) > .001) {
                    l.group.position.lerp(dst, alpha);
                    moving = true;
                }
                if (solo)
                    l.group.visible = focusLayer === null || focusLayer === i;
            });
        }
        if (extracting) {
            extraction += dt;
            if (extraction > .65 || motion.matches) {
                extracted = extracting;
                extracting = null;
                state = { ...state, dissect: false };
                rebuild();
            }
            else
                moving = true;
        }
        if (cameraGoal && targetGoal) {
            camera.position.lerp(cameraGoal, alpha);
            controls.target.lerp(targetGoal, alpha);
            moving = true;
            if (camera.position.distanceTo(cameraGoal) < .002) {
                cameraGoal = targetGoal = null;
            }
        }
        const changed = controls.update();
        if (dirty || moving || changed) {
            renderer.render(scene, camera);
            dirty = false;
            root.dataset.calls = String(renderer.info.render.calls);
            root.dataset.geometries = String(renderer.info.memory.geometries);
            root.dataset.triangles = String(renderer.info.render.triangles);
            root.dataset.frame = String(Number(root.dataset.frame || 0) + 1);
        }
        if (moving || changed)
            invalidate();
    }
    function extract(id: PartId) {
        if (state.mode !== 'explore')
            return;
        state = { ...state, part: id, exploded: false, dissect: false };
        extracted = null;
        extracting = id;
        extraction = 0;
        post('select', { part: id });
        if (models.length === 1)
            rebuild();
        updateText();
        invalidate();
    }
    function update(next: State) {
        const oldMode = state.mode, oldPart = state.part, poseChanged = state.dissect !== next.dissect || state.exploded !== next.exploded;
        state = next;
        if (oldMode !== next.mode) {
            extracted = extracting = null;
            rebuild();
        }
        else if (next.mode === 'partlab' && oldPart !== next.part)
            rebuild();
        else {
            updateVisibility();
            updateText();
            if (poseChanged)
                fitPose();
            invalidate();
        }
    }
    window.addEventListener('message', event => {
        if (event.origin !== location.origin || event.source !== parent)
            return;
        const d = event.data;
        if (d?.type === 'hardware:state' && PART_IDS.includes(d.state?.part) && ['partlab', 'explore', 'builder', 'bios', 'windows'].includes(d.state?.mode))
            update(d.state);
        if (d?.type === 'hardware:extract' && PART_IDS.includes(d.part))
            extract(d.part);
        if (d?.type === 'hardware:reset') {
            extracted = extracting = null;
            rebuild();
        }
    });
    let down = { x: 0, y: 0 };
    renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; cameraGoal = targetGoal = null; });
    renderer.domElement.addEventListener('pointerup', e => {
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || partView())
            return;
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const candidates = state.mode === 'builder' ? slots.filter(s => s.visible) : models.filter(m => m.id !== 'pc-case').map(m => m.hardware.root);
        const hits = raycaster.intersectObjects(candidates, true);
        const hit = (state.mode === 'builder' ? hits.find(h => h.object.userData.slot === state.held) : null) || hits[0];
        if (!hit)
            return;
        if (state.mode === 'builder') {
            post('place', { slot: hit.object.userData.slot });
            return;
        }
        let o: T.Object3D | null = hit.object;
        while (o && !o.userData.part)
            o = o.parent;
        if (o)
            extract(o.userData.part);
    });
    el('explode').onclick = () => {
        if (partView()) {
            state = { ...state, dissect: !state.dissect };
            focusLayer = null;
            post('dissect', { part: currentPart(), value: state.dissect });
        }
        else {
            state = { ...state, exploded: !state.exploded };
            post('explode', { value: state.exploded });
        }
        updateText();
        fitPose();
        invalidate();
    };
    el('xray').onclick = () => { state = { ...state, xray: !state.xray }; post('xray', { value: state.xray }); updateVisibility(); updateText(); invalidate(); };
    el('slots').onclick = event => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-slot]');
        if (button)
            post('place', { slot: button.dataset.slot });
    };
    el('returnPC').onclick = () => { extracted = extracting = null; state = { ...state, dissect: false }; post('return'); rebuild(); };
    el('resetView').onclick = () => { focusLayer = null; resetCamera(); updateText(); };
    for (const view of ['front', 'back', 'top', 'bottom'])
        el(view + 'View').onclick = () => resetCamera(view);
    function zoom(scale: number) { cameraGoal = targetGoal = null; camera.position.sub(controls.target).multiplyScalar(scale).clampLength(controls.minDistance, controls.maxDistance).add(controls.target); invalidate(); }
    el('zoomIn').onclick = () => zoom(.82);
    el('zoomOut').onclick = () => zoom(1.2);
    el('theme').onclick = () => { light = !light; root.classList.toggle('light', light); el('theme').textContent = light ? 'Тёмный фон' : 'Светлый фон'; grid.material.opacity = light ? .15 : .3; invalidate(); };
    renderer.domElement.addEventListener('wheel', () => { cameraGoal = targetGoal = null; }, { passive: true });
    el('layers').onclick = event => {
        const b = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-layer]');
        if (!b)
            return;
        const index = Number(b.dataset.layer);
        focusLayer = focusLayer === index ? null : index;
        updateText();
        el('layers').querySelector<HTMLButtonElement>(`[data-layer="${index}"]`)?.focus({ preventScroll: true });
        invalidate();
    };
    stage.addEventListener('keydown', e => {
        const offset = camera.position.clone().sub(controls.target);
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            offset.applyAxisAngle(new T.Vector3(0, 1, 0), (e.key === 'ArrowLeft' ? -1 : 1) * .15);
            camera.position.copy(controls.target).add(offset);
            invalidate();
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            cameraGoal = targetGoal = null;
            const axis = new T.Vector3().crossVectors(camera.up, offset).normalize();
            offset.applyAxisAngle(axis, (e.key === 'ArrowUp' ? -1 : 1) * .15);
            camera.position.copy(controls.target).add(offset);
            invalidate();
        }
        if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            zoom(.85);
        }
        if (e.key === '-') {
            e.preventDefault();
            zoom(1.15);
        }
        if (e.key === 'Home') {
            e.preventDefault();
            resetCamera();
        }
        if (e.key === 'Escape' && extracted) {
            el('returnPC').click();
        }
    });
    controls.addEventListener('change', () => { root.dataset.angle = camera.position.toArray().map(n => n.toFixed(2)).join(','); invalidate(); });
    const resize = new ResizeObserver(() => {
        const { width, height } = stage.getBoundingClientRect();
        if (width && height) {
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            fitPose(true);
            invalidate();
        }
    });
    resize.observe(stage);
    const observer = new IntersectionObserver(entries => {
        visible = entries[entries.length - 1].isIntersecting;
        if (visible) {
            last = 0;
            invalidate();
        }
    }, { rootMargin: '80px' });
    observer.observe(stage);
    document.addEventListener('visibilitychange', () => {
        hidden = document.hidden;
        if (!hidden) {
            last = 0;
            invalidate();
        }
    });
    renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); failed = true; el('renderError').hidden = false; el('renderError').textContent = '3D-контекст потерян. Обнови страницу, чтобы восстановить сцену. Прогресс сохранён.'; post('unavailable'); });
    window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect(); controls.dispose(); clear(); env.dispose(); grid.geometry.dispose(); grid.material.dispose(); ground.geometry.dispose(); ground.material.dispose(); renderer.dispose(); });
    rebuild();
    post('ready');
    new ResizeObserver(() => post('height', { height: root.getBoundingClientRect().height })).observe(root);
}
mountViewer();
