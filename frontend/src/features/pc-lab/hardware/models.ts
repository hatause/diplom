import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { catalog, type PartId } from './catalog';
type Vec = [
    number,
    number,
    number
];
export interface Hardware {
    root: T.Group;
    layers: {
        group: T.Group;
        move: T.Vector3;
        name: string;
    }[];
    solids: number;
    dispose: () => void;
}
const COLORS = { pcb: '#163c35', dark: '#171c22', metal: '#b3bec9', silver: '#e0e5ea', black: '#0a1016', chip: '#252b32', gold: '#cda758', copper: '#bd7549', white: '#d5dedc', accent: '#77cfb8', slot: '#343c47', blue: '#304c70', red: '#853d3b' };
type Mat = keyof typeof COLORS;
/** Models use world-space solids and physical assemblies. Repeated details are merged
 * per material/assembly, retaining smooth depth-tested rotation with few draw calls. */
class Model {
    root = new T.Group();
    layers: Hardware['layers'] = [];
    solids = 0;
    private materials = new Map<Mat, T.MeshStandardMaterial>();
    private geometries: T.BufferGeometry[] = [];
    private textures: T.Texture[] = [];
    layer(name: string, move: Vec = [0, 0, 0]) { const g = new T.Group(); g.name = name; this.root.add(g); this.layers.push({ group: g, move: new T.Vector3(...move), name }); return g; }
    mat(key: Mat) {
        if (!this.materials.has(key))
            this.materials.set(key, new T.MeshStandardMaterial({ color: COLORS[key], roughness: ['metal', 'silver', 'gold', 'copper'].includes(key) ? .29 : .67, metalness: ['metal', 'silver', 'gold', 'copper'].includes(key) ? .8 : .12 }));
        return this.materials.get(key)!;
    }
    add(g: T.Group, geo: T.BufferGeometry, pos: Vec, mat: Mat, rot: Vec = [0, 0, 0]) { const mesh = new T.Mesh(geo, this.mat(mat)); mesh.position.set(...pos); mesh.rotation.set(...rot); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); this.solids++; return mesh; }
    box(g: T.Group, p: Vec, size: Vec, mat: Mat = 'dark', round = 0) { return this.add(g, round ? new RoundedBoxGeometry(...size, 2, Math.min(round, ...size.map(x => x / 3))) : new T.BoxGeometry(...size), p, mat); }
    pcb(g: T.Group, outline: [
        number,
        number
    ][], thickness: number, horizontal = false, holes: [
        number,
        number,
        number
    ][] = []) {
        const shape = new T.Shape(outline.map(([x, y]) => new T.Vector2(x, y)));
        shape.closePath();
        for (const [x, y, r] of holes) {
            const hole = new T.Path();
            hole.absarc(x, y, r, 0, Math.PI * 2, true);
            shape.holes.push(hole);
        }
        const geometry = new T.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1, curveSegments: 24 });
        geometry.translate(0, 0, -thickness / 2);
        return this.add(g, geometry, [0, 0, 0], 'pcb', horizontal ? [Math.PI / 2, 0, 0] : [0, 0, 0]);
    }
    cylinder(g: T.Group, p: Vec, r: number, h: number, mat: Mat = 'metal', rot: Vec = [0, 0, 0]) { return this.add(g, new T.CylinderGeometry(r, r, h, 24), p, mat, rot); }
    ring(g: T.Group, p: Vec, r: number, t: number, mat: Mat = 'metal', rot: Vec = [Math.PI / 2, 0, 0]) { return this.add(g, new T.TorusGeometry(r, t, 6, 40), p, mat, rot); }
    pipe(g: T.Group, points: Vec[], r = .035, mat: Mat = 'copper') { const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))); this.add(g, new T.TubeGeometry(curve, 32, r, 7, false), [0, 0, 0], mat); }
    screw(g: T.Group, x: number, y: number, z: number, r = .047) { this.cylinder(g, [x, y, z], r, .045, 'metal'); this.box(g, [x, y + .024, z], [r * 1.2, .005, .014], 'black'); this.box(g, [x, y + .025, z], [.014, .005, r * 1.2], 'black'); }
    chip(g: T.Group, x: number, y: number, z: number, w: number, d: number) {
        this.box(g, [x, y, z], [w, .09, d], 'chip', .018);
        for (let i = 0; i < 6; i++) {
            const a = x - w * .4 + i * w * .16;
            this.box(g, [a, y - .025, z - d * .55], [.025, .035, .075], 'metal');
            this.box(g, [a, y - .025, z + d * .55], [.025, .035, .075], 'metal');
        }
    }
    smd(g: T.Group, x: number, y: number, z: number) { this.box(g, [x, y, z], [.085, .035, .038], 'chip'); this.box(g, [x - .035, y, z], [.018, .038, .043], 'metal'); this.box(g, [x + .035, y, z], [.018, .038, .043], 'metal'); }
    label(g: T.Group, text: string, p: Vec, w: number, h: number, rotation: Vec = [-Math.PI / 2, 0, 0]) { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const ctx = c.getContext('2d')!; ctx.fillStyle = '#18222a'; ctx.fillRect(0, 0, c.width, c.height); ctx.fillStyle = '#d7dfdf'; ctx.font = 'bold 33px monospace'; ctx.textAlign = 'center'; ctx.fillText(text, 256, 60); ctx.strokeStyle = '#697477'; ctx.beginPath(); ctx.moveTo(38, 86); ctx.lineTo(474, 86); ctx.stroke(); const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4; this.textures.push(tex); const mesh = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({ map: tex, roughness: .65, polygonOffset: true, polygonOffsetFactor: -1 })); mesh.position.set(...p); mesh.rotation.set(...rotation); g.add(mesh); }
    fan(g: T.Group, p: Vec, r: number) {
        const f = new T.Group();
        f.position.set(...p);
        g.add(f);
        this.ring(f, [0, 0, 0], r, .055, 'dark');
        this.ring(f, [0, -.07, 0], r, .035, 'metal');
        this.cylinder(f, [0, .005, 0], r * .24, .16, 'dark');
        this.cylinder(f, [0, .09, 0], r * .16, .01, 'metal');
        for (let i = 0; i < 9; i++) {
            const s = new T.Shape();
            s.moveTo(.12, .08);
            s.bezierCurveTo(r * .36, r * .12, r * .88, r * .05, r * .95, -r * .18);
            s.bezierCurveTo(r * .76, -r * .42, r * .4, -r * .35, .11, -.09);
            s.closePath();
            const blade = this.add(f, new T.ExtrudeGeometry(s, { depth: .035, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .008, bevelThickness: .008 }), [0, 0, 0], 'slot', [Math.PI / 2, 0, 0]);
            blade.rotateZ(i * Math.PI * 2 / 9);
        }
        for (const x of [-1, 1])
            for (const z of [-1, 1]) {
                this.box(f, [x * r * .86, -.055, z * r * .86], [r * .3, .15, r * .3], 'dark', .035);
                this.screw(f, x * r * .86, .03, z * r * .86, .035);
            }
        return f;
    }
    traces(g: T.Group, w: number, d: number, y: number) {
        for (let i = 0; i < 22; i++) {
            const x = -w * .43 + i * w * .039;
            const z = (i % 2 ? 1 : -1) * d * .28;
            this.box(g, [x, y, z], [.009, .004, d * .24], 'accent');
            this.box(g, [x + .07, y, z + d * .12], [.15, .004, .009], 'accent');
        }
        for (let i = 0; i < 18; i++)
            this.smd(g, -w * .41 + (i % 9) * w * .1, y + .025, -d * .37 + Math.floor(i / 9) * d * .74);
    }
    finish(): Hardware {
        for (const { group } of this.layers) {
            group.updateMatrixWorld(true);
            const buckets = new Map<T.Material, T.BufferGeometry[]>();
            const removed: T.Object3D[] = [];
            group.traverse(obj => {
                if (obj instanceof T.Mesh && !Array.isArray(obj.material) && !obj.material.map) {
                    obj.updateMatrix();
                    const geo = obj.geometry.clone();
                    const relative = new T.Matrix4().copy(group.matrixWorld).invert().multiply(obj.matrixWorld);
                    geo.applyMatrix4(relative);
                    const non = geo.index ? geo.toNonIndexed() : geo;
                    if (non !== geo)
                        geo.dispose();
                    const list = buckets.get(obj.material) || [];
                    list.push(non);
                    buckets.set(obj.material, list);
                    obj.geometry.dispose();
                    removed.push(obj);
                }
            });
            for (const obj of removed)
                obj.removeFromParent();
            for (const [mat, geos] of buckets) {
                const merged = mergeGeometries(geos, false);
                geos.forEach(g => g.dispose());
                if (merged) {
                    const mesh = new T.Mesh(merged, mat);
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    group.add(mesh);
                    this.geometries.push(merged);
                }
            }
        }
        return { root: this.root, layers: this.layers, solids: this.solids, dispose: () => {
                this.root.traverse(o => {
                    if (o instanceof T.Mesh) {
                        o.geometry.dispose();
                        const mats = Array.isArray(o.material) ? o.material : [o.material];
                        mats.forEach(m => m.dispose());
                    }
                });
                this.textures.forEach(t => t.dispose());
            } };
    }
}
function cpu(m: Model) {
    const b = m.layer('Контактная подложка');
    m.box(b, [0, 0, 0], [2.2, .1, 2.2], 'pcb', .05);
    m.box(b, [0, .065, 0], [1.92, .025, 1.92], 'dark');
    for (let x = 0; x < 18; x++)
        for (let z = 0; z < 18; z++) {
            if (x > 5 && x < 12 && z > 5 && z < 12)
                continue;
            m.box(b, [-.96 + x * .113, -.058, -.96 + z * .113], [.073, .012, .073], 'gold', .008);
        }
    for (let i = 0; i < 9; i++) {
        m.smd(b, -.86 + i * .21, .09, .89);
        m.smd(b, -.86 + i * .21, .09, -.89);
    }
    const die = m.layer('Кремниевый кристалл', [0, .65, 0]);
    m.box(die, [0, .14, 0], [.95, .1, .65], 'silver', .02);
    for (let x = 0; x < 5; x++)
        for (let z = 0; z < 3; z++)
            m.box(die, [-.36 + x * .18, .197, -.2 + z * .2], [.15, .008, .16], (x + z) % 3 ? 'blue' : 'accent');
    const lid = m.layer('Теплораспределительная крышка', [0, 1.4, 0]);
    m.box(lid, [0, .28, 0], [1.96, .16, 1.96], 'silver', .13);
    m.box(lid, [0, .38, 0], [1.68, .05, 1.68], 'metal', .06);
    m.label(lid, 'CORE / LGA', [0, .407, 0], 1.15, .29);
}
function gpu(m: Model) {
    const back = m.layer('Задняя пластина', [0, -.7, 0]);
    m.box(back, [0, -.2, 0], [5.65, .11, 2.22], 'dark', .1);
    for (let i = 0; i < 12; i++)
        m.box(back, [1.35 + i * .075, -.263, .1], [.035, .009, 1.3], 'metal');
    for (const x of [-2.6, 2.6])
        for (const z of [-.98, .98])
            m.screw(back, x, -.13, z);
    const b = m.layer('Плата, GPU и видеопамять');
    m.box(b, [0, 0, 0], [5.5, .08, 2.25], 'pcb', .04);
    m.traces(b, 5.5, 2.25, .045);
    m.box(b, [-.25, .11, 0], [.95, .13, .92], 'chip', .035);
    m.box(b, [-.25, .19, 0], [.61, .035, .58], 'silver', .015);
    for (const x of [-1.05, -.32, .41])
        for (const z of [-.71, .71])
            m.chip(b, x, .11, z, .52, .35);
    for (let i = 0; i < 10; i++) {
        m.box(b, [1.28 + i * .12, .12, .1], [.085, .15, .18], 'metal', .015);
        m.chip(b, 1.3 + i * .12, .1, -.41, .09, .12);
    }
    for (let i = 0; i < 55; i++)
        m.box(b, [-1.9 + i * .064, -.015, 1.19], [.043, .04, .22], 'gold');
    m.box(b, [2.23, .16, -.96], [.65, .25, .3], 'black');
    for (let i = 0; i < 8; i++)
        m.box(b, [1.97 + i * .07, .295, -.96], [.035, .008, .12], 'gold');
    m.box(b, [-2.82, .35, 0], [.08, .95, 2.48], 'metal', .02);
    for (let i = 0; i < 3; i++) {
        m.box(b, [-2.868, .32, -.75 + i * .7], [.015, .22, .5], 'black');
        m.box(b, [-2.882, .32, -.75 + i * .7], [.014, .12, .35], 'gold');
    }
    const sink = m.layer('Радиатор и тепловые трубки', [0, 1.1, 0]);
    m.box(sink, [-.25, .29, 0], [1.05, .09, 1.0], 'copper', .03);
    for (let i = 0; i < 64; i++)
        m.box(sink, [-2.53 + i * .08, .53, 0], [.025, .46, 2.05], 'metal');
    for (let i = 0; i < 4; i++)
        m.pipe(sink, [[-2.35, .32, -.68 + i * .42], [-1.4, .31, -.68 + i * .42], [.3, .31, -.68 + i * .42], [2.3, .32, -.68 + i * .42]], .045, 'copper');
    const shroud = m.layer('Кожух и вентиляторы', [0, 2.2, 0]);
    for (const z of [-1.12, 1.12])
        m.box(shroud, [0, .9, z], [5.8, .32, .16], 'dark', .07);
    for (const x of [-2.82, 2.82])
        m.box(shroud, [x, .9, 0], [.18, .32, 2.2], 'dark', .05);
    for (const x of [-1.88, 0, 1.88])
        m.fan(shroud, [x, .95, 0], .87);
    m.box(shroud, [0, .97, 1.22], [3.5, .075, .045], 'accent');
    m.label(shroud, 'GRAPHICS / PCI EXPRESS', [.4, 1.07, 1.13], 2.2, .15);
}
function ram(m: Model) {
    const b = m.layer('Плата и микросхемы DRAM');
    m.pcb(b, [[-2.25, -.6], [-.36, -.6], [-.36, -.4], [-.21, -.4], [-.21, -.6], [2.25, -.6], [2.25, .6], [-2.25, .6]], .07);
    for (let i = 0; i < 8; i++) {
        m.box(b, [-1.89 + i * .54, .03, .095], [.42, .61, .11], 'chip', .025);
        m.box(b, [-1.89 + i * .54, .03, -.095], [.42, .61, .11], 'chip', .025);
        for (let j = 0; j < 4; j++)
            m.box(b, [-2.02 + i * .54 + j * .08, -.35, .062], [.02, .08, .025], 'metal');
    }
    for (let i = 0; i < 64; i++) {
        if (i === 27 || i === 28)
            continue;
        for (const z of [-.043, .043])
            m.box(b, [-2.16 + i * .068, -.53, z], [.044, .18, .012], 'gold');
    }
    m.box(b, [.2, .36, .095], [.22, .18, .07], 'chip');
    for (const direction of [-1, 1]) {
        const sink = m.layer(direction > 0 ? 'Передний теплораспределитель' : 'Задний теплораспределитель', [0, 0, direction * .85]);
        m.box(sink, [0, .08, direction * .19], [4.56, .92, .12], 'dark', .05);
        for (let i = 0; i < 17; i++) {
            if (i > 4 && i < 12)
                continue;
            const fin = m.box(sink, [-2 + i * .25, .03, direction * .265], [.035, .71, .027], 'metal');
            fin.rotation.z = -.25;
        }
        m.box(sink, [0, .59, direction * .1], [4.4, .12, .17], 'accent', .05);
        m.label(sink, 'DDR5 / PERFORMANCE', [.05, .09, direction * .255], 2.0, .28, direction > 0 ? [0, 0, 0] : [0, Math.PI, 0]);
    }
}
function ssd(m: Model) {
    const b = m.layer('Плата и контакты M-key');
    m.pcb(b, [[-2, -.55], [2, -.55], [2, .55], [-2, .55], [-2, .33], [-1.82, .33], [-1.82, .19], [-2, .19]], .07, true, [[1.88, 0, .085]]);
    m.traces(b, 4, 1.1, .038);
    for (let i = 0; i < 18; i++) {
        if (i === 13 || i === 14)
            continue;
        m.box(b, [-1.99, .045, -.48 + i * .055], [.23, .015, .032], 'gold');
        m.box(b, [-1.99, -.045, -.48 + i * .055], [.23, .015, .032], 'gold');
    }
    m.ring(b, [1.88, .04, 0], .11, .025, 'gold');
    const chips = m.layer('Контроллер и NAND-память', [0, .55, 0]);
    m.chip(chips, -1.28, .12, 0, .55, .6);
    for (const x of [-.45, .38, 1.19])
        m.chip(chips, x, .12, 0, .65, .8);
    for (const x of [-.45, .38, 1.19])
        m.label(chips, 'NAND', [x, .17, 0], .48, .17);
    const sink = m.layer('Термопрокладка и радиатор', [0, 1.2, 0]);
    m.box(sink, [0, .24, 0], [3.55, .045, .9], 'blue', .015);
    m.box(sink, [0, .31, 0], [3.68, .09, 1.1], 'dark', .04);
    for (let i = 0; i < 9; i++)
        m.box(sink, [0, .44, -.46 + i * .115], [3.61, .24, .045], 'metal', .012);
    for (const x of [-1.64, 1.64])
        m.screw(sink, x, .57, 0);
}
function mobo(m: Model) {
    const b = m.layer('Плата, разъёмы и контроллеры');
    m.pcb(b, [[-2.4, -2.625], [2.4, -2.625], [2.4, 2.625], [-2.4, 2.625]], .085, true, [-2.2, 2.15].flatMap(x => [-2.4, 0, 2.4].map(z => [x, z, .055] as [
        number,
        number,
        number
    ])));
    m.traces(b, 4.7, 5.1, .045);
    m.box(b, [-.55, .1, -.8], [1.55, .14, 1.6], 'slot', .03);
    m.box(b, [-.55, .18, -.8], [1.3, .025, 1.35], 'gold');
    for (let x = 0; x < 10; x++)
        for (let z = 0; z < 10; z++)
            m.box(b, [-1.12 + x * .125, .2, -1.36 + z * .125], [.034, .018, .034], 'silver');
    for (const x of [-1.35, .25])
        m.box(b, [x, .23, -.8], [.06, .1, 1.7], 'metal');
    m.pipe(b, [[.34, .2, -1.6], [.4, .22, -1.35], [.4, .22, 0], [.25, .23, .1]], .026, 'metal');
    for (let i = 0; i < 4; i++) {
        const x = .85 + i * .34;
        m.box(b, [x, .19, -.72], [.17, .28, 2.4], i % 2 ? 'dark' : 'slot', .02);
        m.box(b, [x, .335, -.72], [.035, .012, 2.14], 'black');
        for (const z of [-1.97, .54])
            m.box(b, [x, .22, z], [.21, .36, .13], 'metal');
    }
    for (let i = 0; i < 3; i++) {
        const z = .95 + i * .57;
        m.box(b, [-.55, .17, z], [2.8, .23, .19], 'slot', .015);
        m.box(b, [-.55, .291, z], [2.58, .01, .045], 'black');
        m.box(b, [.93, .2, z], [.18, .27, .25], 'metal');
    }
    m.cylinder(b, [1.37, .15, 1.2], .31, .14, 'silver');
    m.ring(b, [1.37, .23, 1.2], .24, .015, 'metal');
    for (let i = 0; i < 9; i++) {
        m.box(b, [-1.74, .13, -1.9 + i * .21], [.23, .2, .15], 'metal');
        m.cylinder(b, [-2.07, .13, -1.9 + i * .21], .07, .17, 'silver');
    }
    for (let i = 0; i < 4; i++) {
        m.box(b, [-2.29, .27, -1.85 + i * .75], [.22, .47, .61], 'metal', .02);
        m.box(b, [-2.414, .28, -1.85 + i * .75], [.012, .22, .42], i === 2 ? 'blue' : 'black');
    }
    m.box(b, [2.21, .2, 1.1], [.18, .32, 1.3], 'black');
    for (let i = 0; i < 12; i++)
        m.box(b, [2.21, .365, .55 + i * .1], [.08, .01, .04], 'gold');
    m.chip(b, .7, .1, 2.12, .28, .28);
    m.label(b, 'SPI / UEFI', [.7, .151, 2.12], .25, .09);
    for (const x of [-2.2, 2.15])
        for (const z of [-2.4, 0, 2.4])
            m.ring(b, [x, .052, z], .07, .025, 'gold');
    const sinks = m.layer('Радиаторы VRM и чипсета', [0, .85, 0]);
    m.box(sinks, [-1.85, .38, -.9], [.55, .4, 2.4], 'dark', .05);
    m.box(sinks, [-.7, .38, -2.1], [1.6, .4, .6], 'dark', .05);
    for (let i = 0; i < 15; i++)
        m.box(sinks, [-1.85, .61, -1.97 + i * .15], [.57, .06, .035], 'metal');
    m.box(sinks, [1.45, .23, 1.95], [1.3, .28, .92], 'dark', .06);
    m.label(sinks, 'ATX / CHIPSET', [1.45, .378, 1.95], 1.0, .2);
    const covers = m.layer('Крышки слотов M.2', [0, 1.55, 0]);
    for (const z of [.55, 1.35]) {
        m.box(covers, [-.58, .34, z], [2.65, .1, .29], 'dark', .025);
        for (const x of [-1.8, .65])
            m.screw(covers, x, .42, z, .035);
    }
}
function cooler(m: Model) {
    const base = m.layer('Основание и тепловые трубки');
    m.box(base, [0, -1.32, 0], [1.65, .18, 1.45], 'copper', .07);
    m.box(base, [0, -1.2, 0], [1.8, .07, 1.65], 'metal', .03);
    for (let i = 0; i < 6; i++) {
        const z = -.62 + i * .245;
        m.pipe(base, [[-.73, 1.4, z], [-.73, -.8, z], [-.5, -1.18, z], [.5, -1.18, z], [.73, -.8, z], [.73, 1.4, z]], .06, 'copper');
    }
    for (const x of [-1.0, 1.0]) {
        m.box(base, [x, -1.22, 0], [.32, .08, 1.9], 'metal');
        for (const z of [-.82, .82])
            m.screw(base, x, -1.14, z, .06);
    }
    const fins = m.layer('Пакет охлаждающих рёбер', [0, .65, 0]);
    for (let i = 0; i < 36; i++)
        m.box(fins, [0, -.8 + i * .06, 0], [2.2, .022, 1.8], 'metal', .02);
    m.box(fins, [0, 1.39, 0], [2.22, .06, 1.82], 'dark', .06);
    for (const x of [-.73, .73])
        for (let z = 0; z < 6; z++)
            m.cylinder(fins, [x, 1.445, -.62 + z * .245], .066, .055, 'copper');
    const fan = m.layer('Вентилятор и крепления', [0, 0, 1.35]);
    const f = m.fan(fan, [0, .15, 1.02], 1.05);
    f.rotation.x = Math.PI / 2;
    for (const x of [-1.12, 1.12])
        m.pipe(fan, [[x, -.7, 1], [x, -.6, .85], [x, .9, .85], [x, 1, 1]], .025, 'metal');
}
function psu(m: Model) {
    const body = m.layer('Шасси и выходные разъёмы');
    m.box(body, [0, -1, 0], [3.3, .1, 2.8], 'dark', .06);
    for (const x of [-1.61, 1.61])
        m.box(body, [x, -.05, 0], [.08, 1.9, 2.8], 'dark', .025);
    for (const z of [-1.36, 1.36])
        m.box(body, [0, -.05, z], [3.2, 1.9, .08], 'dark', .03);
    for (let row = 0; row < 3; row++)
        for (let col = 0; col < 4; col++) {
            m.box(body, [-1.14 + col * .74, -.6 + row * .54, 1.418], [.52, .35, .04], 'slot', .025);
            for (let pin = 0; pin < 6; pin++)
                m.box(body, [-1.29 + col * .74 + (pin % 3) * .15, -.69 + row * .54 + Math.floor(pin / 3) * .17, 1.444], [.06, .06, .02], 'gold');
        }
    for (let i = 0; i < 13; i++)
        m.box(body, [-1.44 + i * .24, .08, -1.413], [.1, 1.3, .012], 'slot', .025);
    m.label(body, '750 W / ATX 3.0', [1.66, 0, 0], 1.7, .55, [0, Math.PI / 2, 0]);
    const board = m.layer('Силовая плата', [0, 1.8, 0]);
    m.box(board, [0, -.85, 0], [3.02, .055, 2.5], 'pcb', .04);
    for (let i = 0; i < 3; i++) {
        m.cylinder(board, [-1 + i * .46, -.27, -.72], .18, 1.1, 'dark');
        m.cylinder(board, [-1 + i * .46, .29, -.72], .175, .015, 'silver');
        m.box(board, [-1 + i * .46, .301, -.72], [.26, .008, .012], 'slot');
    }
    m.box(board, [.4, -.48, .04], [.7, .67, .75], 'gold', .08);
    m.box(board, [.4, -.47, .04], [.33, .75, .8], 'dark', .02);
    for (let i = 0; i < 11; i++)
        m.box(board, [.97 + i * .04, -.3, -.6], [.018, .9, .55], 'metal');
    for (let i = 0; i < 5; i++) {
        m.ring(board, [-1 + i * .47, -.51, .66], .15, .055, 'copper');
        m.cylinder(board, [-1 + i * .47, -.65, .66], .13, .26, 'dark');
    }
    const cover = m.layer('Крышка и вентилятор', [0, 2.9, 0]);
    for (const z of [-1.3, 1.3])
        m.box(cover, [0, .94, z], [3.3, .09, .2], 'dark', .025);
    for (const x of [-1.55, 1.55])
        m.box(cover, [x, .94, 0], [.2, .09, 2.8], 'dark', .025);
    m.fan(cover, [0, .92, 0], 1.2);
    for (let i = 0; i < 6; i++)
        m.ring(cover, [0, 1.12, 0], .26 + i * .17, .012, 'metal');
    for (const x of [-1.4, 1.4])
        for (const z of [-1.17, 1.17])
            m.screw(cover, x, 1.01, z);
}
function chassis(m: Model) {
    const body = m.layer('Стальной каркас и монтажный поддон');
    m.box(body, [0, -3.15, 0], [4, .16, 4.6], 'dark', .06);
    m.box(body, [0, 3.15, 0], [4, .13, 4.6], 'dark', .06);
    for (const x of [-1.9, 1.9])
        for (const z of [-2.2, 2.2])
            m.box(body, [x, 0, z], [.15, 6.2, .15], 'metal', .03);
    m.box(body, [0, 0, -2.21], [3.8, 6.2, .09], 'dark', .03);
    m.box(body, [0, -1.7, 0], [3.8, .09, 4.4], 'dark');
    for (let i = 0; i < 6; i++)
        m.box(body, [1.65, -1.6 + i * .73, -2.14], [.18, .35, .02], 'black', .05);
    for (const x of [-1.5, 1.5])
        for (const z of [-1.8, 1.8]) {
            m.cylinder(body, [x, -3.3, z], .19, .22, 'black');
            m.cylinder(body, [x, -3.41, z], .16, .04, 'metal');
        }
    for (const x of [-1.574, 1.3405])
        for (const y of [-1.358, .25, 1.858])
            m.cylinder(body, [x, y, -2.08], .055, .19, 'gold', [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 18; i++)
        m.box(body, [-1.65 + i * .19, 3.23, -.5], [.065, .01, 2.7], 'slot');
    const front = m.layer('Передняя панель и вентиляторы', [2.2, 0, 0]);
    m.box(front, [1.94, 0, 0], [.09, 6.3, 4.55], 'dark', .04);
    for (let row = 0; row < 3; row++) {
        const f = m.fan(front, [2.01, -1.8 + row * 1.78, .2], .82);
        f.rotation.z = -Math.PI / 2;
    }
    m.box(front, [2.005, 2.85, .2], [.025, .12, 1.3], 'accent');
    const glass = m.layer('Съёмная боковая панель', [0, 0, 2.7]);
    for (const x of [-1.9, 1.9])
        m.box(glass, [x, 0, 2.28], [.1, 6.3, .08], 'metal', .03);
    for (const y of [-3.1, 3.1])
        m.box(glass, [0, y, 2.28], [3.8, .1, .08], 'metal', .03);
    const pane = m.box(glass, [0, 0, 2.27], [3.72, 6.1, .025], 'blue');
    pane.material = new T.MeshPhysicalMaterial({ color: '#8eafc1', metalness: .05, roughness: .12, transparent: true, opacity: .1, depthWrite: false });
}
export function buildHardware(id: PartId): Hardware { const m = new Model(); ({ 'part-cpu': cpu, 'part-gpu': gpu, 'part-ram': ram, 'part-ssd': ssd, 'part-mobo': mobo, 'part-cooler': cooler, 'part-psu': psu, 'pc-case': chassis }[id])(m); m.root.name = catalog[id].title; return m.finish(); }
