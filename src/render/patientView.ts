import * as THREE from 'three';
import type { Patient, Verdict } from '../sim/types';
import { AVERAGE_FACE, drawFace, eyeTexture, sculptHead, type FaceLook, type FaceState } from './faces';
import { buildBody, type Rig } from './humanoid';
import { bodyFor, buildHuman, humansReady, loadHumans, type HumanRig } from './human';
export type { HumanRig };
import { lookFor, type Look } from './looks';

export const FEMALE_NAMES = new Set(['Ada', 'Edith', 'Margit', 'Hester', 'Dorothea', 'Agnes', 'Winifred', 'Odette', 'Philippa', 'Mabel', 'Imelda', 'Dolores', 'Mae', 'Rosa', 'Sister']);

const puffTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(220,235,255,0.55)');
  gr.addColorStop(1, 'rgba(220,235,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

export type ViewPhase = 'none' | 'approaching' | 'present' | 'leaving';
type ArmPose = { sh: number; el: number; out: number };
const POSES: Record<string, ArmPose> = {
  rest: { sh: 0.06, el: -0.14, out: 0.13 },
  hold: { sh: -0.35, el: -1.0, out: -0.12 },
  hug: { sh: -0.45, el: -1.1, out: -0.3 },
  folded: { sh: -0.15, el: -1.25, out: -0.42 },
  bag: { sh: 0.04, el: -0.1, out: 0.16 },
  glass: { sh: -1.5, el: -0.12, out: -0.1 },
};

/**
 * The same poses for the authored body. Its forearms are longer than the old ones, so folded arms bend further
 * and the forearms turn inward (cross) instead of reaching up to the opposite shoulder.
 */
type HumanPose = ArmPose & { cross: number };
const POSES_H: Record<string, HumanPose> = {
  rest: { sh: 0.04, el: -0.12, out: 0.09, cross: 0 },
  hold: { sh: -0.22, el: -1.3, out: 0.02, cross: 0.35 },
  hug: { sh: -0.38, el: -1.55, out: -0.05, cross: 0.75 },
  folded: { sh: 0.02, el: -1.6, out: 0.02, cross: 1.05 },
  bag: { sh: 0.03, el: -0.1, out: 0.12, cross: 0 },
  glass: { sh: -1.5, el: -0.12, out: -0.1, cross: 0 },
};

const HEAD_SCALE = 0.84;
const REVEALS = ['unhinge', 'grin', 'rolled', 'hollow', 'neck', 'owl', 'split', 'melt', 'eyes', 'backbend', 'reach', 'stutter'] as const;

/**
 * One visitor at a time. Full jointed body from humanoid.ts, a sculpted painted head on top.
 * Behaviour that reaches out of the hall: a fake presses its hands and face to the glass when it stares,
 * stands in the corner of the hall after you turn it away, and comes through the window when kept waiting.
 */
export class PatientView {
  readonly group = new THREE.Group();
  /** Character lights live outside the group so hiding the group never changes the light count. */
  readonly rig = new THREE.Group();
  private rim = new THREE.PointLight(0x9ab8d0, 0, 2.4, 1.6);
  private under = new THREE.PointLight(0xffa860, 0, 1.7, 1.8);
  private body: Rig | null = null;
  /** The authored body, when the baked file loaded. Null means the old procedural body is in use. */
  private human: HumanRig | null = null;
  private head: THREE.Object3D = new THREE.Group();
  private headScale = HEAD_SCALE;
  private mouthZ = 0.16;
  private revealAge = 0;
  private eyeRoll = 0;
  private faceMat: THREE.MeshLambertMaterial | null = null;
  private faces: Record<FaceState, THREE.CanvasTexture> | null = null;
  private owned: { dispose: () => void }[] = [];
  private puffs: THREE.Sprite[] = [];
  private patient: Patient | null = null;
  private look: Look | null = null;
  private stage = 0;
  private t = 0;
  private walkPh = 0;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private verdict: Verdict | 'timeout' | null = null;
  private blinkIn = 3;
  private blinkT = 0;
  private stare = false;
  private shown: FaceState = 'open';
  private revealT = 0;
  private glimpseIn = 14;
  private lurk = false;
  private breach: 'crack' | 'inside' | null = null;
  private mouthY = 1.5;
  private eyes: { ball: THREE.Mesh; lid: THREE.Mesh | null; aim: THREE.Quaternion }[] = [];
  private lidOpen = -0.35;
  private saccadeT = 1;
  private saccade = new THREE.Vector3();
  private lookAway = 0;
  private press = 0;
  /** Set by the game for a few frames when a fake shows what it is. */
  revealing = 0;
  /** The admissions passage: way points, and the spot behind the officer's chair. */
  private path: THREE.Vector3[] | null = null;
  private backSpot: THREE.Vector3 | null = null;
  private walkPath: THREE.Vector3[] | null = null;
  private pathSeg = 0;
  private pathT = 0;
  private backWait = 0;
  private backDone = false;
  /** Called once when someone you let in reaches the window behind your chair. */
  onBackWindow: ((p: Patient) => void) | null = null;
  /** Called when a fake's face goes, with how it goes. */
  onReveal: ((kind: string) => void) | null = null;
  /** The officer is up close at the glass (face check). The visitor leans in too. */
  closeup = false;
  private extraEyes: THREE.Mesh[] = [];
  private pulse: THREE.Mesh | null = null;
  private stutterT = 0;
  private puffHold: number[] = [0, 0, 0];
  /** Where in the passage the visitor is, 0 to 1. The game opens doors with it. */
  passageK = -1;
  get atBack(): boolean {
    return this.backWait > 0;
  }
  setPassage(path: THREE.Vector3[], backSpot: THREE.Vector3): void {
    this.path = path;
    this.backSpot = backSpot;
  }
  /** Called when the face slips on its own for a frame or two. */
  onGlimpse: (() => void) | null = null;
  speaking = 0;
  progress = 0;
  /** Exposed for close-up checks. */
  get facesForTest(): Record<FaceState, THREE.CanvasTexture> | null {
    return this.faces;
  }
  /** True once the authored bodies have loaded. */
  get humanReady(): boolean {
    return humansReady();
  }

  constructor(public spawn: THREE.Vector3, public stand: THREE.Vector3) {
    this.rig.add(this.rim, this.under);
    this.group.visible = false;
    void loadHumans();
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, opacity: 0, depthWrite: false, fog: false }));
      s.scale.setScalar(0.05);
      this.puffs.push(s);
      this.group.add(s);
    }
  }

  // ------------------------------------------------------------------ build helpers
  private mat = (color: THREE.ColorRepresentation, map: THREE.Texture | null = null): THREE.MeshLambertMaterial => {
    const m = new THREE.MeshLambertMaterial({ color, map });
    this.owned.push(m);
    return m;
  };
  private mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Mesh => {
    this.owned.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  private clear(): void {
    for (const o of this.owned) o.dispose();
    this.owned = [];
    if (this.body) this.group.remove(this.body.root);
    this.body = null;
    this.human = null;
    this.head = new THREE.Group();
    this.eyes = [];
    this.extraEyes = [];
    this.pulse = null;
    this.walkPath = null;
    this.passageK = -1;
    this.backWait = 0;
    this.backDone = false;
    if (this.faces) for (const k of Object.keys(this.faces) as FaceState[]) this.faces[k].dispose();
    this.faces = null;
    this.faceMat = null;
  }

  setPatient(p: Patient | null, stage = 0): void {
    this.patient = p;
    this.verdict = null;
    this.t = 0;
    this.stage = stage;
    this.stare = false;
    this.lurk = false;
    this.breach = null;
    this.press = 0;
    // a reveal never carries over to the next person at the glass
    this.revealT = 0;
    this.revealing = 0;
    this.revealAge = 0;
    this.stutterT = 0;
    this.clear();
    if (!p) {
      this.look = null;
      this.group.visible = false;
      return;
    }
    const look = lookFor(p);
    this.look = look;
    const fake = p.truth === 'understudy';
    const skin = new THREE.Color(look.skin[0] / 255, look.skin[1] / 255, look.skin[2] / 255).multiplyScalar(0.8);
    if (fake) skin.lerp(new THREE.Color(0x9a9c98), 0.1 + stage * 0.03);
    if (humansReady()) {
      const hb = bodyFor(p.castId, p.registryId, p.archetype, look.female, look.age, p.hue);
      const h = buildHuman(look, { ...hb, skin, fake, stage, armLength: fake && stage >= 3 ? 1.1 : 1, seed: Math.floor(p.hue * 1e6) }, (d) => this.owned.push(d));
      this.human = h;
      this.body = h;
      this.group.add(h.root);
      this.head = h.head;
      this.headScale = 1;
      this.eyes = h.eyes.map((e) => ({ ball: e.ball, lid: null, aim: new THREE.Quaternion() }));
      this.buildProp(look);
      this.mouthY = h.mouthY;
      this.mouthZ = h.mouthZ + 0.035; // breath starts in front of the lips, never inside the mouth
      this.addMarks(h, p, skin);
      this.group.position.copy(this.spawn);
      this.group.rotation.y = 0;
      this.group.visible = true;
      this.blinkIn = 1.5 + Math.random() * 3;
      return;
    }
    this.headScale = HEAD_SCALE;
    this.mouthZ = 0.16;
    this.body = buildBody(
      {
        height: look.height,
        build: look.build,
        female: look.female,
        hunch: look.hunch,
        skin,
        outfit: look.outfit,
        top: new THREE.Color(look.top),
        bottom: new THREE.Color(look.bottom),
        shoes: new THREE.Color(look.shoes),
        accent: new THREE.Color(look.accent),
        barefoot: look.barefoot,
        armLength: fake && stage >= 3 ? 1.12 : 1,
      },
      { mat: (c, m) => this.mat(c, m ?? null), mesh: this.mesh, own: (x) => this.owned.push(x) },
    );
    this.group.add(this.body.root);
    this.buildHead(look, p, skin);
    this.buildProp(look);
    this.mouthY = (0.95 + 0.04 + 0.6) * this.body.scaleY + 0.08;
    this.group.position.copy(this.spawn);
    this.group.rotation.y = 0;
    this.group.visible = true;
    this.blinkIn = 1.5 + Math.random() * 3;
  }

  private buildHead(look: Look, p: Patient, skin: THREE.Color): void {
    const head = this.head;
    head.position.y = 0.075;
    head.scale.setScalar(HEAD_SCALE);
    this.body!.headMount.add(head);
    const skinMat = this.mat(skin);
    const hair = this.mat(look.hairColor);
    const sx = look.female ? 0.88 : 0.95;
    const shape = { ...AVERAGE_FACE, ...look.face };
    const skullGeo = new THREE.SphereGeometry(0.14, 48, 36);
    sculptHead(skullGeo, look.female, shape);
    this.mesh(skullGeo, skinMat, head).scale.set(sx, 1.14, 0.98);
    const fl: FaceLook = {
      female: look.female,
      age: look.age,
      skin: look.skin,
      hair: look.hair === 'bald' ? 'none' : look.hair,
      hairColor: look.hairColor,
      eye: look.eye,
      glasses: look.glasses,
      stubble: look.facial === 'stubble' || look.facial === 'beard',
      lipstick: look.lipstick,
      moustache: look.facial === 'moustache',
      grime: look.grime,
      realEyes: true,
    };
    this.faces = {
      open: drawFace(fl, p, this.stage, 'open'),
      blink: drawFace(fl, p, this.stage, 'blink'),
      talk: drawFace(fl, p, this.stage, 'talk'),
      stare: drawFace(fl, p, this.stage, 'stare'),
      reveal: drawFace(fl, p, Math.max(this.stage, 5), 'reveal'),
    };
    this.faceMat = new THREE.MeshLambertMaterial({ map: this.faces.open, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.owned.push(this.faceMat);
    const patchGeo = new THREE.SphereGeometry(0.1425, 48, 36, 0.57, 2.0, 0.55, 1.9);
    sculptHead(patchGeo, look.female, shape);
    const patch = this.mesh(patchGeo, this.faceMat, head);
    patch.scale.set(sx, 1.14, 0.98);
    this.shown = 'open';
    // real eyeballs in the sockets, with an upper lid that blinks and widens
    const fake = p.truth === 'understudy';
    const ballMat = new THREE.MeshStandardMaterial({ map: eyeTexture(look.eye, fake), roughness: 0.12, metalness: 0 });
    this.owned.push(ballMat);
    for (const sd of [-1, 1]) {
      const d = new THREE.Vector3(sd * 0.274, 0.13, 0.952).normalize();
      const r = 0.1425 * (0.925 - (shape.sunken ?? 0) * 0.02) - 0.006;
      const pos = d.multiplyScalar(r);
      const holder = new THREE.Group();
      holder.position.set(pos.x * sx, pos.y * 1.14, pos.z * 0.98);
      head.add(holder);
      const ball = this.mesh(new THREE.SphereGeometry(0.0165, 20, 14), ballMat, holder);
      ball.castShadow = false;
      const lid = this.mesh(new THREE.SphereGeometry(0.0178, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), skinMat, holder);
      lid.castShadow = false;
      const low = this.mesh(new THREE.SphereGeometry(0.0176, 18, 6, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38), skinMat, holder);
      low.castShadow = false;
      this.eyes.push({ ball, lid, aim: new THREE.Quaternion() });
    }
    // nose: a bridge and a tip, a little big, the way a caricature wants it
    const ns = look.nose ?? 1;
    const bridge = this.mesh(new THREE.CylinderGeometry(0.008, 0.015 * ns, 0.055, 10), skinMat, head, 0, -0.006, 0.137);
    bridge.rotation.x = -0.4;
    bridge.scale.z = 0.8;
    for (const sd of [-1, 1]) this.mesh(new THREE.SphereGeometry(0.0095 * ns, 10, 8), skinMat, head, sd * 0.012 * ns, -0.034, 0.138).scale.set(1, 0.8, 0.9); // nostril wings
    const tip = this.mesh(new THREE.SphereGeometry(0.0155, 12, 10), skinMat, head, 0, -0.03, 0.15);
    tip.scale.set(look.nose ?? 1, 0.9 * (look.nose ?? 1) ** 0.5, 0.95);
    for (const sd of [-1, 1]) {
      const ear = this.mesh(new THREE.SphereGeometry(0.032, 10, 8), skinMat, head, sd * 0.137 * sx, -0.004, -0.01);
      ear.scale.set(0.38, 1.05, 0.72);
      if (p.faceMark.includes('notched right ear') && sd === 1) ear.scale.y = 0.8;
    }
    // hair
    const cap = (r: number, theta: number, tilt: number, y = 0.02): THREE.Mesh => {
      const m = this.mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, theta), hair, head, 0, y, 0);
      m.scale.set(sx * 1.02, 1.14, 1.0);
      m.rotation.x = tilt;
      return m;
    };
    switch (look.hair) {
      case 'short':
        cap(0.148, 1.22, -0.18);
        break;
      case 'slick':
        cap(0.147, 1.2, -0.22);
        break;
      case 'bald':
        cap(0.146, 0.5, -1.4, 0.0).scale.multiplyScalar(1.01);
        break;
      case 'bun':
        cap(0.148, 1.24, -0.16);
        this.mesh(new THREE.SphereGeometry(0.058, 12, 10), hair, head, 0, 0.07, -0.135);
        break;
      case 'curls': {
        cap(0.15, 1.32, -0.14);
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const c = this.mesh(new THREE.SphereGeometry(0.035, 8, 6), hair, head, Math.cos(a) * 0.12 * sx, 0.04 + Math.sin(i * 1.7) * 0.03, Math.sin(a) * 0.12 - 0.02);
          if (Math.sin(a) > 0.6) c.position.y += 0.08;
        }
        break;
      }
      case 'long': {
        cap(0.149, 1.28, -0.16);
        const back = this.mesh(new THREE.CylinderGeometry(0.128, 0.105, 0.34, 16, 1, true), hair, head, 0, -0.1, -0.05);
        (back.material as THREE.MeshLambertMaterial).side = THREE.DoubleSide;
        for (const x of [-0.06, -0.02, 0.03, 0.065]) this.mesh(new THREE.BoxGeometry(0.014, 0.08, 0.008), hair, head, x, 0.075, 0.13).rotation.z = x * 3;
        break;
      }
      case 'scarf': {
        const cloth = this.mat(0x5d615c);
        const wrap = this.mesh(new THREE.SphereGeometry(0.159, 22, 12, Math.PI / 2 + 1.05, Math.PI * 2 - 2.1, 0, 2.05), cloth, head, 0, 0, -0.01);
        wrap.scale.set(sx * 1.04, 1.14, 1.0);
        this.mesh(new THREE.SphereGeometry(0.04, 8, 6), cloth, head, 0, -0.15, 0.09);
        break;
      }
      case 'habit': {
        const white = this.mat(0xe8e6de);
        const black = this.mat(0x0c0c10);
        const coif = this.mesh(new THREE.SphereGeometry(0.156, 20, 10, 0, Math.PI * 2, 0, 1.35), white, head, 0, 0.02, -0.01);
        coif.scale.set(sx * 1.04, 1.14, 1.0);
        coif.rotation.x = -0.25;
        const veil = this.mesh(new THREE.BoxGeometry(0.34, 0.52, 0.03), black, head, 0, -0.1, -0.14);
        veil.rotation.x = 0.06;
        break;
      }
      default:
        break;
    }
    const felt = this.mat(new THREE.Color(look.top).multiplyScalar(0.85));
    if (look.hat === 'trilby') {
      this.mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.012, 24), felt, head, 0, 0.11, 0).rotation.x = -0.1;
      this.mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.12, 16), felt, head, 0, 0.175, 0).rotation.x = -0.05;
    } else if (look.hat === 'flat') {
      const crown = this.mesh(new THREE.SphereGeometry(0.16, 18, 8, 0, Math.PI * 2, 0, 1.35), felt, head, 0, 0.075, 0);
      crown.scale.set(1.05, 0.55, 1.18);
      this.mesh(new THREE.BoxGeometry(0.17, 0.012, 0.1), felt, head, 0, 0.09, 0.16).rotation.x = 0.28;
    } else if (look.hat === 'cloche') {
      const bell = this.mesh(new THREE.SphereGeometry(0.16, 18, 10, 0, Math.PI * 2, 0, 1.22), felt, head, 0, 0.045, -0.01);
      bell.scale.set(sx * 1.08, 1.0, 1.04);
      this.mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.01, 20), felt, head, 0, 0.075, 0).scale.set(sx, 1, 1.05);
    } else if (look.hat === 'nurse') {
      this.mesh(new THREE.BoxGeometry(0.16, 0.06, 0.1), this.mat(0xf2f0ea), head, 0, 0.16, 0.02).rotation.x = -0.3;
    }
    if (look.glasses) {
      const frame = this.mat(0x14110e);
      for (const sd of [-1, 1]) this.mesh(new THREE.TorusGeometry(0.03, 0.0035, 5, 16), frame, head, sd * 0.042, 0.022, 0.142);
      this.mesh(new THREE.BoxGeometry(0.02, 0.004, 0.004), frame, head, 0, 0.026, 0.148);
    }
  }

  private buildProp(look: Look): void {
    const b = this.body!;
    const hand = b.arms[1].hand; // right hand
    const handL = b.arms[0].hand;
    switch (look.prop) {
      case 'umbrella': {
        const dark = this.mat(0x15130f);
        this.mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.9, 8), dark, hand, 0, -0.5, 0.02);
        this.mesh(new THREE.ConeGeometry(0.05, 0.5, 10), dark, hand, 0, -0.62, 0.02).rotation.x = Math.PI;
        break;
      }
      case 'goose': {
        const china = this.mat(0xe8e4d6);
        const g = new THREE.Group();
        g.position.set(0, 1.2 * b.scaleY, 0.24);
        b.root.add(g);
        this.mesh(new THREE.SphereGeometry(0.13, 16, 12), china, g).scale.set(0.85, 0.8, 1.2);
        const neck = this.mesh(new THREE.CylinderGeometry(0.033, 0.048, 0.22, 10), china, g, 0, 0.15, 0.07);
        neck.rotation.x = 0.35;
        this.mesh(new THREE.SphereGeometry(0.05, 12, 10), china, g, 0, 0.27, 0.11);
        this.mesh(new THREE.ConeGeometry(0.02, 0.07, 8), this.mat(0xd4802a), g, 0, 0.265, 0.17).rotation.x = Math.PI / 2;
        this.mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 14), this.mat(0x35507a), g, 0, 0.19, 0.09).rotation.x = Math.PI / 2 - 0.35;
        break;
      }
      case 'redcap': {
        const wool = this.mat(0xa02828);
        const c = this.mesh(new THREE.SphereGeometry(0.075, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.9), wool, hand, 0, -0.1, 0.06);
        c.rotation.x = -0.6;
        this.mesh(new THREE.SphereGeometry(0.02, 6, 5), this.mat(0xd8d0c0), hand, 0, -0.04, 0.06);
        break;
      }
      case 'folder':
        this.mesh(new THREE.BoxGeometry(0.24, 0.32, 0.015), this.mat(0xcfc29c), hand, 0, -0.12, 0.05);
        break;
      case 'slippers': {
        const pink = this.mat(0xd99aa6);
        for (const x of [-0.03, 0.03]) this.mesh(new THREE.SphereGeometry(1, 10, 6), pink, hand, x, -0.09, 0.04).scale.set(0.026, 0.02, 0.065);
        break;
      }
      case 'handbag': {
        const leather = this.mat(0x2a1a14);
        this.mesh(new THREE.BoxGeometry(0.22, 0.16, 0.08), leather, handL, 0, -0.16, 0);
        this.mesh(new THREE.TorusGeometry(0.06, 0.008, 5, 12, Math.PI), leather, handL, 0, -0.08, 0);
        break;
      }
      case 'bible':
        this.mesh(new THREE.BoxGeometry(0.14, 0.2, 0.04), this.mat(0x1a0f0c), hand, 0, -0.1, 0.06);
        this.mesh(new THREE.BoxGeometry(0.004, 0.06, 0.006), this.mat(0xb08a3e), hand, 0, -0.07, 0.083);
        break;
      case 'cigarette':
        this.mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.07, 6), this.mat(0xf2efe6), hand, 0.02, -0.1, 0.03).rotation.z = 1.2;
        this.mesh(new THREE.SphereGeometry(0.005, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff6a20 }), hand, 0.055, -0.087, 0.03);
        break;
      case 'lamp': {
        const tin = this.mat(0x4a4a44);
        this.mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.12, 10), tin, hand, 0, -0.15, 0.03);
        this.mesh(new THREE.TorusGeometry(0.04, 0.005, 5, 12, Math.PI), tin, hand, 0, -0.08, 0.03);
        break;
      }
      default:
        break;
    }
  }

  /**
   * The mark the photograph shows, painted onto the authored face so it can be checked close up:
   * a scar through a brow, a mole, a freckle, a burn, a nose that healed crooked. "Left" is the visitor's left.
   * Also a small throb at the side of the throat for anyone with a pulse.
   */
  private addMarks(h: HumanRig, p: Patient, skin: THREE.Color): void {
    h.root.updateWorldMatrix(true, true);
    const body = (o: THREE.Object3D): THREE.Vector3 => h.root.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
    const eyeR = body(h.eyes[0].holder); // visitor's right, x < 0
    const eyeL = body(h.eyes[h.eyes.length - 1].holder);
    const onHead = (m: THREE.Mesh, at: THREE.Vector3): void => {
      const w = h.root.localToWorld(at.clone());
      h.head.add(m);
      m.position.copy(h.head.worldToLocal(w));
      this.owned.push(m.geometry, m.material as THREE.Material);
    };
    const mk = p.faceMark;
    const side = mk.includes('left') ? eyeL : eyeR;
    const sx = side === eyeL ? 1 : -1;
    const dot = (r: number, color: number, flat = 0.4): THREE.Mesh => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshLambertMaterial({ color }));
      m.scale.z = flat;
      return m;
    };
    if (mk.includes('brow')) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.0035, 0.026, 0.004), new THREE.MeshLambertMaterial({ color: new THREE.Color(skin).lerp(new THREE.Color(0xe8c8c0), 0.6) }));
      m.rotation.z = 0.5 * sx;
      onHead(m, side.clone().add(new THREE.Vector3(sx * 0.004, 0.03, 0.016)));
    } else if (mk.includes('cheek')) {
      onHead(dot(0.0042, 0x3a1c14), side.clone().add(new THREE.Vector3(sx * 0.016, -0.042, 0.014)));
    } else if (mk.includes('eye')) {
      onHead(dot(0.0026, 0x6a3420), side.clone().add(new THREE.Vector3(sx * 0.006, -0.024, 0.016)));
    } else if (mk.includes('chin')) {
      const m = dot(0.016, 0x9a4a40, 0.25);
      m.scale.y = 0.6;
      onHead(m, new THREE.Vector3(0.006, h.mouthY - 0.045, h.mouthZ - 0.004));
    } else if (mk.includes('nose')) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.022, 0.004), new THREE.MeshLambertMaterial({ color: 0x5a2a20 }));
      m.rotation.z = 0.35;
      onHead(m, new THREE.Vector3((eyeL.x + eyeR.x) / 2 + 0.003, eyeR.y - 0.022, eyeR.z + 0.03));
    }
    // the pulse: a soft throb just under the jaw. People have one. Fakes have the shape of one, and it does not move.
    const pm = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), new THREE.MeshLambertMaterial({ color: skin.clone().multiplyScalar(0.92) }));
    pm.scale.set(0.6, 1.4, 0.5);
    const at = new THREE.Vector3(eyeR.x * 0.75, h.mouthY - 0.085, h.mouthZ - 0.055);
    const w = h.root.localToWorld(at.clone());
    h.neck.add(pm);
    pm.position.copy(h.neck.worldToLocal(w));
    this.owned.push(pm.geometry, pm.material as THREE.Material);
    this.pulse = pm;
  }

  setStare(on: boolean): void {
    this.stare = on;
  }

  /** The glass gives. 'crack': it is on the window. 'inside': it is in the booth with you. */
  setBreach(phase: 'crack' | 'inside' | 'over'): void {
    if (phase === 'over') {
      this.breach = null;
      this.group.visible = false;
      return;
    }
    this.breach = phase;
    if (phase === 'inside') {
      this.group.position.set(0.95, 0, -0.1);
      this.group.rotation.y = -Math.PI / 2 - 0.4;
    }
  }

  beginLeave(v: Verdict | 'timeout'): void {
    this.verdict = v;
    this.t = 0;
    this.from.copy(this.group.position);
    const fake = this.patient?.truth === 'understudy';
    this.lurk = fake && (v === 'refuse' || v === 'timeout') && !this.breach;
    if (this.breach) {
      this.group.visible = false;
      return;
    }
    if ((v === 'admit' || v === 'observe') && this.path) {
      // out of the hall by the admissions door, down the passage, and along behind the officer's chair
      this.walkPath = [this.group.position.clone(), ...this.path];
      this.pathSeg = 0;
      this.pathT = 0;
      this.passageK = 0;
      return;
    }
    if (v === 'admit' || v === 'observe') this.to.set(-3.2, 0, -3.2);
    else if (this.lurk) this.to.set(-3.3, 0, -6.6); // it does not leave. It goes to the corner and watches.
    else if (v === 'refuse' || v === 'timeout') this.to.copy(this.spawn).setZ(-9.5);
    else this.to.copy(this.group.position);
  }

  /** One step along the passage. Returns true while the feet are moving. */
  private walkStep(dt: number, p: Patient): boolean {
    const path = this.walkPath!;
    const g = this.group;
    if (this.backWait > 0) {
      this.backWait -= dt;
      g.rotation.y = Math.PI; // facing the booth: the back of the officer's head
      if (this.backWait <= 0) this.pathSeg++;
      return false;
    }
    const a = path[this.pathSeg];
    const b = path[this.pathSeg + 1];
    if (!b) {
      g.visible = false;
      this.walkPath = null;
      this.passageK = -1;
      return false;
    }
    const len = a.distanceTo(b);
    const speed = p.truth === 'understudy' ? 1.05 : 0.95;
    this.pathT += (dt * speed) / Math.max(0.01, len);
    if (this.pathT >= 1) {
      this.pathT = 0;
      g.position.copy(b);
      // stop at the window behind the chair: people say goodbye, fakes stand and look
      if (this.backSpot && b.distanceTo(this.backSpot) < 0.2 && !this.backDone) {
        this.backDone = true;
        this.backWait = p.truth === 'understudy' ? 6 : 4.2;
        this.onBackWindow?.(p);
        return false;
      }
      this.pathSeg++;
      return true;
    }
    g.position.lerpVectors(a, b, this.pathT);
    g.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    this.passageK = (this.pathSeg + this.pathT) / (path.length - 1);
    return true;
  }

  /**
   * Eyes. People look at you, glance at the form, look back, with small darting moves.
   * Fakes break the rules: the eyes lock on before the head turns, the right eye trails the left,
   * and from stage 3 they stop blinking and stop moving at all until you look away.
   */
  private updateEyes(dt: number, cam: THREE.Vector3, fake: boolean, hidden: boolean, blink: boolean): void {
    if (!this.eyes.length) return;
    this.saccadeT -= dt;
    if (this.saccadeT <= 0) {
      this.saccadeT = fake ? 3 + Math.random() * 4 : 0.4 + Math.random() * 1.6;
      this.saccade.set((Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.05, 0);
      if (!fake && Math.random() < 0.18) this.lookAway = 0.9; // glance down at their papers
    }
    this.lookAway = Math.max(0, this.lookAway - dt);
    const target = cam.clone();
    if (this.lookAway > 0) target.y -= 1.2;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const wp = new THREE.Vector3();
    const parentQ = new THREE.Quaternion();
    this.eyes.forEach((e, i) => {
      e.ball.visible = !hidden || !!this.human;
      if (e.lid) e.lid.visible = !hidden;
      const holder = e.ball.parent!;
      holder.getWorldPosition(wp);
      holder.getWorldQuaternion(parentQ);
      const t = target.clone().add(fake ? new THREE.Vector3() : this.saccade);
      m.lookAt(t, wp, new THREE.Vector3(0, 1, 0));
      q.setFromRotationMatrix(m);
      q.premultiply(parentQ.invert());
      const frozen = fake && this.stage >= 3 && !this.stare && Math.sin(this.t * 0.3 + i) > 0.2;
      const speed = fake ? (i === 1 ? 2.2 : 30) : 14;
      if (!frozen) e.aim.slerp(q, Math.min(1, dt * speed));
      e.ball.quaternion.copy(e.aim);
    });
    const want = blink ? 1.45 : this.stare ? -0.65 : fake ? -0.5 : -0.32;
    this.lidOpen += (want - this.lidOpen) * Math.min(1, dt * (blink ? 30 : 8));
    for (const e of this.eyes) if (e.lid) e.lid.rotation.x = this.lidOpen;
    if (this.human) {
      // the lids are part of the face now: close them, or pull them wide
      const close = THREE.MathUtils.clamp((this.lidOpen + 0.32) / 1.77, 0, 1);
      const wide = THREE.MathUtils.clamp((-0.32 - this.lidOpen) / 0.33, 0, 1);
      const h = this.human;
      // a fake's right lid lags the left by a fraction
      h.setExpr('blinkL', close);
      h.setExpr('blinkR', fake ? THREE.MathUtils.clamp(close * 0.85, 0, 1) : close);
      h.setExpr('wideL', wide);
      h.setExpr('wideR', wide);
    }
  }

  /** Expressions on the authored face: talking, the stare, grief, and what is underneath a fake. */
  /**
   * Expressions on the authored face: talking, the stare, grief, and what is underneath a fake.
   * Each fake shows itself its own way (chosen from its seed), and the wrongness builds over the first third of a
   * second rather than snapping to a pose: the jaw keeps going after it should have stopped.
   *  - unhinge: the jaw drops past where a jaw can go and skews to one side, the mouth stays slack
   *  - grin: the corners pull back beyond a smile and the teeth show, the head lays over on its side
   *  - rolled: the eyes turn up into the head, one lid half down, the mouth hangs open
   *  - hollow: nothing moves at all; the eyes go black, the skin goes grey, the head grows longer
   */
  /** Which way this fake comes apart. Written per fake in the night data; older fakes pick one from their seed. */
  private revealKind(): string {
    const p = this.patient!;
    return p.reveal ?? REVEALS[Math.floor(p.hue * 977 + (p.castId?.length ?? 0)) % REVEALS.length];
  }

  private drive(face: FaceState, fake: boolean): void {
    const h = this.human!;
    const p = this.patient!;
    const reveal = face === 'reveal';
    const talk = this.speaking > 0 && !reveal;
    const t = this.t;
    const syll = talk ? Math.max(0, Math.sin(t * 13) * 0.6 + Math.sin(t * 5.3) * 0.4) : 0;
    const kind = this.revealKind();
    // 0 to 1 over the first 0.35 s, then a slow creep that never quite settles
    const r = reveal ? Math.min(1, this.revealAge / 0.35) + Math.min(0.25, Math.max(0, this.revealAge - 0.35) * 0.1) : 0;
    const tremor = reveal ? Math.sin(t * 37) * 0.012 + Math.sin(t * 23.1) * 0.008 : 0;
    let mouth = talk ? 0.15 + syll * 0.55 : 0;
    let jaw = talk ? syll * 0.09 : 0;
    let jawZ = 0;
    let smile = fake ? (face === 'stare' ? 0.3 : 0.1) : 0;
    let wide = 0;
    let black = false;
    let pale = 0;
    let roll = 0;
    let sad = 0;
    let frown = 0;
    // body parts the reveals pull on; everything returns to rest when the face comes back
    let neckY = 1;
    let headTurn = 0;
    let headSX = 1;
    let headSY = 1;
    let spineBack = 0;
    let armStretch = 1;
    let eyesOut = 0;
    let eyeSize = 1;
    let headDip = 0;
    if (reveal) {
      pale = 0.35 + r * 0.3;
      switch (kind) {
        case 'unhinge':
          mouth = 0.75 * r;
          jaw = 0.8 * r + tremor; // well past where a jaw stops
          jawZ = 0.16 * r * (p.hue > 0.5 ? 1 : -1);
          smile = 0;
          black = true;
          break;
        case 'grin':
          // the smile keeps going past the cheeks, the head lies over on its side, the eyes never close
          mouth = 0.45 * r;
          jaw = 0.1 * r;
          smile = 2.6 * r;
          wide = 1.5 * r;
          headSX = 1 + 0.16 * r;
          eyeSize = 1 + 0.3 * r;
          this.head.rotation.z += (p.hue > 0.5 ? 1 : -1) * 0.75 * r;
          break;
        case 'rolled':
          mouth = 0.5 * r;
          jaw = 0.18 * r + tremor;
          smile = 0;
          roll = 1.15 * r;
          break;
        case 'neck':
          // the neck keeps going up, and the head comes with it, still looking at you
          neckY = 1 + 1.4 * r;
          mouth = 0.2 * r;
          smile = 0.6 * r;
          wide = 0.8 * r;
          break;
        case 'owl':
          // the head turns round on the neck, all the way, and the face is still facing you on the other side
          headTurn = Math.PI * Math.min(1, this.revealAge / 1.1);
          smile = 0.4;
          wide = 1;
          break;
        case 'split':
          // the face widens past the skull, the jaw drops, the eyes go out
          headSX = 1 + 0.38 * r;
          mouth = 0.9 * r;
          jaw = 0.55 * r + tremor;
          black = true;
          break;
        case 'melt':
          // everything slides down: brows, cheeks, the mouth, as if the face was only resting there
          headSY = 1 - 0.32 * r;
          headSX = 1 + 0.24 * r;
          sad = 1;
          frown = 1;
          mouth = 0.85 * r;
          jaw = 0.55 * r + tremor;
          roll = -0.9 * r;
          headDip = 0.45 * r;
          black = r > 0.6;
          break;
        case 'eyes':
          // more of them open, on the forehead and the cheeks, and all of them find you
          eyesOut = 1.25 * r;
          wide = 1.2 * r;
          smile = 0.3;
          break;
        case 'backbend':
          // it folds backwards at the waist and looks at you upside down
          spineBack = 1.25 * r;
          mouth = 0.4 * r;
          jaw = 0.3 * r;
          wide = 1;
          break;
        case 'reach':
          // the arms come up and keep getting longer
          armStretch = 1 + 0.9 * r;
          mouth = 0.3 * r;
          smile = 0.8 * r;
          break;
        case 'stutter':
          // a different wrong face every frame: the picture skips between them
          mouth = Math.random() * 0.9;
          jaw = Math.random() * 0.6;
          smile = Math.random() * 2;
          wide = Math.random() * 1.6;
          black = Math.random() > 0.5;
          headSX = 0.85 + Math.random() * 0.35;
          headSY = 0.85 + Math.random() * 0.45;
          neckY = 1 + Math.random() * 0.5;
          headDip = (Math.random() - 0.5) * 0.8;
          this.head.rotation.z += (Math.random() - 0.5) * 1.4;
          break;
        default:
          // hollow: nothing moves at all; the eyes go black, the skin goes grey, the head grows longer
          mouth = 0;
          jaw = 0;
          smile = 0;
          // the sockets are empty and too big, the face hangs long under them
          black = true;
          pale = 0.85;
          headSY = 1.45;
          headSX = 0.86;
          eyeSize = 1.7;
          mouth = 0.25;
          jaw = 0.22;
      }
    }
    h.setExpr('mouthOpen', mouth);
    h.jaw.rotation.x = jaw;
    h.jaw.rotation.z = jawZ;
    const tragic = !fake && (p.archetype === 'tragic' || p.castId === 'mae' || p.castId === 'hester');
    h.setExpr('sad', Math.max(sad, tragic ? 0.75 : 0));
    h.setExpr('frown', Math.max(frown, tragic ? 0.35 : face === 'stare' && !fake ? 0.2 : 0));
    h.setExpr('smile', smile);
    h.setExpr('browDown', !fake && face === 'stare' ? 0.4 : 0);
    if (wide > 0) {
      h.setExpr('wideL', wide);
      h.setExpr('wideR', wide * 0.8);
    }
    for (const e of h.eyes) e.ball.material = black ? h.blackEye : h.ballMat;
    this.eyeRoll = roll;
    h.setPale(pale);
    // the stretching reveals
    h.neck.scale.set(1, neckY, 1);
    this.head.scale.set(headSX, headSY / neckY, headSX);
    h.neck.rotation.y = headTurn;
    this.head.rotation.x += headDip;
    for (const e of h.eyes) e.ball.scale.setScalar(eyeSize);
    if (spineBack) {
      h.spine.rotation.x -= spineBack;
      h.neck.rotation.x -= spineBack * 0.6;
    }
    for (const a of this.body!.arms) {
      a.sh.scale.set(1, armStretch, 1);
      if (armStretch > 1.05) a.sh.rotation.x = -1.4;
    }
    if (eyesOut > 0 && !this.extraEyes.length) this.growEyes(h);
    for (const e of this.extraEyes) e.scale.setScalar(Math.max(0.001, eyesOut));
  }

  /** Extra eyes for the ones that show you how many they have. Built once, hidden until needed. */
  private growEyes(h: HumanRig): void {
    const src = h.eyes[0].ball;
    const r = (src.geometry as THREE.SphereGeometry).parameters.radius;
    const base = h.eyes[0].holder.position;
    const spots: [number, number][] = [[0, 0.055], [-0.03, 0.04], [0.03, 0.04], [-0.045, -0.035], [0.045, -0.035], [0, -0.012]];
    for (const [x, y] of spots) {
      const m = new THREE.Mesh(src.geometry, h.ballMat);
      m.position.set(x * 1.2, base.y + y, base.z + 0.004);
      m.scale.setScalar(0.001);
      m.lookAt(new THREE.Vector3(0, base.y + y, base.z + 5));
      h.head.add(m);
      this.extraEyes.push(m);
    }
    void r;
  }

  private setFace(s: FaceState): void {
    if (s === 'blink') s = 'open'; // real lids do the blinking now
    if (this.human) {
      this.shown = s;
      return;
    }
    if (!this.faceMat || !this.faces || s === this.shown) return;
    this.faceMat.map = this.faces[s];
    this.shown = s;
  }

  private pose(name: keyof typeof POSES | ArmPose, side: number, swing: number, fidget: number): void {
    const b = this.body!;
    const p = typeof name === 'string' ? (this.human ? POSES_H[name] : POSES[name]) : name;
    const a = b.arms[side < 0 ? 0 : 1];
    if (this.human) {
      // forearms turn in across the body after they bend
      a.el.rotation.order = 'YXZ';
      a.el.rotation.y = -side * ((p as HumanPose).cross ?? 0);
    }
    a.sh.rotation.x = p.sh + swing + fidget;
    a.sh.rotation.z = side * p.out;
    a.el.rotation.x = p.el - Math.abs(swing) * 0.3 - fidget * 0.5;
    const curl = p.el < -0.9 ? -0.8 : p.sh < -1.2 ? -0.05 : -0.25;
    for (const f of a.fingers) f.rotation.x = curl;
    for (const t of a.tips) t.rotation.x = curl * 0.8;
  }

  update(dt: number, phase: ViewPhase, cam: THREE.Vector3, quiet: boolean): void {
    const p = this.patient;
    const look = this.look;
    const on = !!p && !!look && this.group.visible;
    this.rig.position.copy(this.group.position);
    this.rim.position.set(0.35, 1.95, -0.55);
    this.under.position.set(0, 0.95, 0.6);
    this.rim.intensity = on ? 2.2 : 0;
    this.under.intensity = on ? (p!.truth === 'understudy' ? 1.7 : 0.9) : 0;
    if (!p || !look || !this.body || !this.group.visible) return;
    // when a fake comes apart, it moves at eight frames a second: the picture stutters and it jumps forward
    if (p.truth === 'understudy' && (this.revealT > 0 || this.revealing > 0) && this.breach !== 'inside') {
      this.stutterT += dt;
      if (this.stutterT < 0.125) {
        this.revealT = Math.max(0, this.revealT - dt);
        this.revealing = Math.max(0, this.revealing - dt);
        return;
      }
      dt = this.stutterT;
      this.stutterT = 0;
    }
    this.t += dt;
    const fake = p.truth === 'understudy';
    const g = this.group;
    const b = this.body;
    let walking = 0;
    let leanFwd = 0;

    if (this.breach === 'inside') {
      // in the booth, bent low, searching by sound. It turns its head toward every noise.
      g.position.y = 0;
      b.chest.rotation.x = 0.85;
      this.head.rotation.y = Math.sin(this.t * 0.9) * 0.9;
      this.head.rotation.z = Math.sin(this.t * 3.1) * 0.15;
      this.pose({ sh: -1.1, el: -0.3, out: 0.2 }, -1, Math.sin(this.t * 1.3) * 0.2, 0);
      this.pose({ sh: -1.1, el: -0.3, out: 0.2 }, 1, Math.cos(this.t * 1.1) * 0.2, 0);
      const f: FaceState = Math.sin(this.t * 7) > 0.6 ? 'reveal' : 'stare';
      this.setFace(f);
      this.revealAge = f === 'reveal' ? this.revealAge + dt : 0;
      if (this.human) this.drive(f, true);
      return;
    }

    if (phase === 'approaching') {
      const k = Math.min(1, this.t / 3.5);
      this.progress = k;
      g.position.lerpVectors(this.spawn, this.stand, k);
      g.rotation.y = 0;
      walking = k < 1 ? 1 : 0;
    } else if (phase === 'present') {
      this.progress = 1;
      // a fake leans in to the glass while it holds your eye, and stays on it while it breaks through
      const want = this.breach === 'crack' ? 1 : fake && this.stare ? 0.85 : this.closeup ? 0.55 : 0;
      this.press += (want - this.press) * Math.min(1, dt * (want > this.press ? 1.6 : 3));
      g.position.copy(this.stand);
      g.position.z += this.press * 0.92;
      if (this.breach === 'crack') g.position.x += Math.sin(this.t * 40) * 0.006;
      leanFwd = this.press * 0.18;
    } else if (this.walkPath) {
      walking = this.walkStep(dt, p) ? 1 : 0;
      if (this.backWait > 0) leanFwd = fake ? 0.18 : 0;
    } else if (phase === 'leaving') {
      const k = Math.min(1, this.t / (this.lurk ? 3.2 : 2.6));
      if (this.verdict === 'contain') {
        g.position.copy(this.stand);
        g.position.y = -Math.pow(k, 2) * 2.4;
      } else {
        g.position.lerpVectors(this.from, this.to, k);
        g.rotation.y = this.lurk ? (k < 1 ? Math.PI * 0.8 : 0.35) : this.to.x < -1 ? -1.2 : 0;
        walking = k < 1 ? 1 : 0;
      }
      if (k >= 1 && this.verdict !== null && !this.lurk) g.visible = false;
    }
    if (!this.breach && phase === 'present') g.position.y = 0;

    // walking: hips, knees, opposite arms. The fake glides a touch too smoothly.
    this.walkPh += dt * (walking ? 7.2 : 0);
    const amp = walking * (fake ? 0.32 : 0.45);
    for (const l of b.legs) {
      const s = Math.sin(this.walkPh + (l.side > 0 ? Math.PI : 0));
      l.hip.rotation.x = -s * amp;
      l.knee.rotation.x = Math.max(0, Math.sin(this.walkPh + (l.side > 0 ? Math.PI : 0) - 1.2)) * amp * 1.5;
    }
    b.pelvis.position.y = 0.95 * b.scaleY + (walking ? Math.abs(Math.sin(this.walkPh)) * (fake ? 0.008 : 0.025) : 0);
    b.chest.rotation.x = look.hunch * 0.35 + leanFwd + (fake && !walking ? -0.02 : 0);
    if (this.human) {
      // the bend starts lower down the back on the authored body, and the neck lifts the head back up to look at you
      this.human.spine.rotation.x = look.hunch * 0.3;
      this.human.neck.rotation.x = -(b.chest.rotation.x + this.human.spine.rotation.x) * 0.7;
    }
    if (b.skirt) {
      b.skirt.rotation.x = walking ? Math.sin(this.walkPh * 2) * 0.03 : 0;
      b.skirt.scale.set(1 + walking * 0.14, 1, 0.8 * (1 + walking * 0.25)); // the hem swings out over the knees
    }

    // breathing and weight shifts. The fake does neither.
    const breathe = fake ? 0 : Math.sin(this.t * 1.6 + p.hue * 4) * 0.012;
    b.chest.scale.set(1 + breathe, 1 + breathe * 0.6, 1 + breathe * 1.3);
    b.root.rotation.z = fake ? 0 : Math.sin(this.t * 0.45 + p.hue * 3) * 0.012;
    if (!fake && p.archetype === 'strange_innocent') b.root.rotation.z = Math.sin(this.t * 1.7) * 0.035;
    if (!fake && p.castId === 'gus') b.root.position.x = Math.sin(this.t * 31) * 0.003; // shaking

    // arms
    const atBack = this.backWait > 0;
    const pressing = this.press > 0.4 || (fake && atBack);
    for (const side of [-1, 1]) {
      const swing = walking ? Math.sin(this.walkPh + (side > 0 ? 0 : Math.PI)) * 0.35 : 0;
      let fidget = 0;
      if (!fake && !walking) {
        if (p.archetype === 'tragic') fidget = Math.sin(this.t * 2.2 + side) * 0.06;
        else if (this.speaking > 0) fidget = Math.sin(this.t * 6 + side * 2) * 0.08;
        else fidget = Math.sin(this.t * 0.8 + side) * 0.015;
      }
      const base = pressing ? 'glass' : walking && (look.pose === 'folded' || look.pose === 'hold') ? look.pose : walking ? 'rest' : look.pose === 'bag' && side > 0 ? 'rest' : look.pose;
      if (atBack && !fake && side > 0) {
        // a little wave through the wired glass
        this.pose({ sh: -2.3, el: -0.6 + Math.sin(this.t * 7) * 0.35, out: 0.25 }, side, 0, 0);
        continue;
      }
      this.pose(base as keyof typeof POSES, side, pressing ? Math.sin(this.t * 2 + side) * 0.03 : swing, fidget);
    }

    // head: people look at you a beat late; a fake looks at you a beat early and too still
    const dx = cam.x - g.position.x;
    const dz = cam.z - g.position.z;
    const yaw = Math.atan2(dx, dz) - g.rotation.y;
    const head = this.head;
    head.rotation.y += (THREE.MathUtils.clamp(yaw, -1, 1) - head.rotation.y) * Math.min(1, dt * (fake ? 14 : 4));
    const tilt = fake ? 0.06 + Math.min(this.stage, 7) * 0.015 : Math.sin(this.t * 0.7 + p.hue * 5) * 0.03;
    head.rotation.z = this.stare ? (fake ? 0.32 : 0.12) : tilt;
    head.rotation.x = this.speaking > 0 ? Math.sin(this.t * 11) * 0.04 : p.archetype === 'tragic' ? 0.14 : this.lurk ? 0.1 : 0;
    this.speaking = Math.max(0, this.speaking - dt);

    // faces: blink, talk, stare, and the one underneath
    let face: FaceState = 'open';
    if (fake && phase === 'present' && (this.stage >= 1 || this.closeup || this.stare)) {
      this.glimpseIn -= dt * (this.closeup ? 2.5 : 1);
      if (this.glimpseIn <= 0) {
        this.revealT = 0.18 + Math.random() * 0.25;
        this.glimpseIn = 12 + Math.random() * 16 - this.stage;
        this.onGlimpse?.();
        this.onReveal?.(this.revealKind());
      }
    }
    this.revealT = Math.max(this.revealT - dt, this.revealing);
    this.revealing = Math.max(0, this.revealing - dt);
    const showing = fake && (this.revealT > 0 || this.breach === 'crack');
    this.revealAge = showing ? this.revealAge + dt : 0;
    head.scale.set(this.headScale * (showing ? 0.93 : 1), this.headScale * (showing ? 1.2 : 1), this.headScale);
    if (showing) head.rotation.z += (Math.random() - 0.5) * 0.25;
    if (showing) face = 'reveal';
    else if (this.stare || this.lurk) face = 'stare';
    else if (this.speaking > 0 && Math.sin(this.t * 17) > -0.2) face = 'talk';
    else {
      this.blinkIn -= dt;
      const never = fake && (p.tells.includes('no_blink') || this.stage >= 5);
      if (!never && this.blinkIn <= 0) {
        this.blinkT = fake ? 0.38 : 0.12;
        this.blinkIn = fake ? 6 + Math.random() * 4 : 1.8 + Math.random() * 3.6;
      }
      if (this.blinkT > 0) {
        this.blinkT -= dt;
        face = 'blink';
      }
    }
    this.setFace(face);
    if (this.human) this.drive(face, fake);
    this.updateEyes(dt, cam, fake, face === 'reveal', this.blinkT > 0);
    if (this.human && this.eyeRoll > 0) {
      // the eyes turn up under the lids, the left lid sinks half closed
      for (const e of this.eyes) e.ball.rotateX(-this.eyeRoll);
      this.human.setExpr('blinkL', 0.45 * Math.min(1, this.eyeRoll));
    }

    // breath on the cold air. Fakes do not breathe.
    const breath = !p.tells.includes('no_breath') && !quiet && (!fake || !!p.breathes);
    const still = p.tells.includes('still_breath');
    this.puffs.forEach((s, i) => {
      const ph = ((this.t + i * 1.15) % 3.45) / 3.45;
      const mat = s.material as THREE.SpriteMaterial;
      if (!breath || phase !== 'present' || this.walkPath) {
        mat.opacity = 0;
        return;
      }
      if (still) {
        // it breathes out, and the breath stays exactly where it was put
        if (ph < 0.05) this.puffHold[i] = 0;
        this.puffHold[i] = Math.min(1, this.puffHold[i] + dt * 3);
        s.position.set(0, this.mouthY + 0.02, this.mouthZ + 0.12 + i * 0.002);
        s.scale.setScalar(0.12);
        mat.opacity = 0.42 * this.puffHold[i];
        return;
      }
      if (ph > 0.7) {
        mat.opacity = 0;
        return;
      }
      s.position.set(0, this.mouthY + ph * 0.08, this.mouthZ + ph * 0.28);
      s.scale.setScalar(0.04 + ph * 0.17);
      mat.opacity = (1 - ph / 0.7) * 0.55 * Math.min(1, ph * 8);
    });
    // a pulse in the throat for the living, nothing for the rest
    if (this.pulse) {
      const beat = !fake ? Math.pow(Math.max(0, Math.sin(this.t * 7.4)), 6) : 0;
      this.pulse.scale.set(0.6 + beat * 0.25, 1.4 + beat * 0.2, 0.5 + beat * 0.5);
    }
  }
}
