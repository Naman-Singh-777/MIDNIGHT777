import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Physics } from '../physics/world';
import { DrawSurface, StaticBatch, type Mats } from './materials';

/**
 * The new places, kept apart from the locked map in environment.ts:
 *  - the back wall of the intake hall, which used to be open to the dark beside the booth, with the admissions door in it
 *  - the admissions passage: everyone you let in walks from that door down the side of the booth and along behind your chair
 *  - the wired window in the booth's back wall that looks onto the passage
 *  - the vending machine in the booth
 *  - the things that make the hall a waiting room: chairs, posters, a clock, umbrellas, a notice board, wet footprints
 *  - two things that are only there for the camera: a figure that stands in the far corner of the hall, and a smile in the dark
 */
export interface Annex {
  hallDoor: THREE.Group; // swings into the passage
  passageLights: THREE.PointLight[];
  wardDoor: THREE.Group;
  vending: THREE.Group;
  vendScreen: DrawSurface;
  vendLight: THREE.PointLight;
  hallClock: DrawSurface;
  notice: DrawSurface;
  cornerFigure: THREE.Mesh;
  smile: THREE.Sprite;
  backGlass: THREE.Mesh;
  hits: THREE.Object3D[];
  /** Way points for a visitor you let in: from the glass, out of the hall, down the passage, behind your chair, gone. */
  passagePath: THREE.Vector3[];
  /** Where someone stands to talk to you through the back window. */
  backSpot: THREE.Vector3;
  /** Where a member of staff stands in the corridor. */
  corridorSpot: THREE.Vector3;
}

const T = 0.15;

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function grime(g: CanvasRenderingContext2D, w: number, h: number, n = 400, a = 0.08): void {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(60,45,30,${Math.random() * a})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
}

function poster(title: string, lines: string[], bg: string, ink: string, w = 256, h = 360): THREE.CanvasTexture {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = ink;
    g.textAlign = 'center';
    g.font = 'bold 30px "Special Elite", "Courier New", monospace';
    title.split('\n').forEach((t, i) => g.fillText(t, w / 2, 52 + i * 34));
    g.font = '17px "IM Fell English", Georgia, serif';
    lines.forEach((t, i) => g.fillText(t, w / 2, 150 + i * 26));
    g.strokeStyle = ink;
    g.lineWidth = 4;
    g.strokeRect(10, 10, w - 20, h - 20);
    grime(g, w, h, 900, 0.12);
    // water damage from the corner, and a torn pin hole
    const gr = g.createRadialGradient(w, 0, 10, w, 0, w * 0.7);
    gr.addColorStop(0, 'rgba(90,70,30,0.35)');
    gr.addColorStop(1, 'rgba(90,70,30,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
}

export function buildAnnex(scene: THREE.Scene, physics: Physics, mats: Mats): Annex {
  const batch = new StaticBatch();
  const solid = (m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, collide = true, uv = 0.5): void => {
    batch.box(m, w, h, d, x, y, z, uv);
    if (collide) physics.addStaticBox(x, y, z, w / 2, h / 2, d / 2);
  };
  const lino = new THREE.MeshLambertMaterial({ map: mats.tileHall.map, color: 0x9a9a88 });

  // ---------------------------------------------------------------- the hall's back wall, closing the dark gaps beside the booth
  const HZ = -1.25;
  solid(mats.cream, 1.0, 3.4, T, -3.5, 1.7, HZ); // left of the admissions door
  solid(mats.cream, 0.225, 3.4, T, -1.9875, 1.7, HZ); // between the door and the booth
  solid(mats.cream, 0.9, 1.2, T, -2.55, 2.8, HZ, false); // over the door
  solid(mats.cream, 2.125, 3.4, T, 2.9375, 1.7, HZ); // right of the booth
  solid(mats.cream, 3.75, 0.65, T, 0, 3.125, HZ, false); // the band over the booth, up to the hall ceiling
  solid(mats.woodDark, 0.05, 2.25, 0.2, -3.025, 1.125, HZ, false); // door frame
  solid(mats.woodDark, 0.05, 2.25, 0.2, -2.075, 1.125, HZ, false);
  solid(mats.woodDark, 1.0, 0.06, 0.2, -2.55, 2.22, HZ, false);

  // ---------------------------------------------------------------- the admissions passage
  // west leg: from the door down the side of the booth
  solid(lino, 1.4, 0.1, 3.1, -2.525, -0.05, 0.35); // floor
  solid(mats.ceiling, 1.4, 0.1, 3.1, -2.525, 2.85, 0.35, false);
  solid(mats.paintGreen, T, 2.8, 4.6, -3.275, 1.4, 0.95); // west wall, full length of both legs
  // back leg: behind the booth
  solid(lino, 5.1, 0.1, 1.35, -0.75, -0.05, 2.55);
  solid(mats.ceiling, 5.1, 0.1, 1.35, -0.75, 2.85, 2.55, false);
  solid(mats.paintGreen, 5.25, 2.8, T, -0.7, 1.4, 3.3); // south wall
  solid(mats.paintGreen, T, 2.8, 1.45, 1.8, 1.4, 2.6); // east end, where the ward door is
  // dado rail and a line of skirting so the walls read as a hospital passage
  solid(mats.woodDark, 0.04, 0.06, 4.6, -3.19, 1.0, 0.95, false);
  solid(mats.woodDark, 5.1, 0.06, 0.04, -0.75, 1.0, 3.215, false);
  // the outside of the booth's west and back walls, as the passage sees them
  solid(mats.paintGreen, 0.02, 2.8, 3.05, -1.885, 1.4, 0.32, false);
  // a pipe along the passage ceiling, dripping
  solid(mats.rust, 0.06, 0.06, 4.4, -3.1, 2.65, 0.95, false);
  solid(mats.rust, 5.0, 0.06, 0.06, -0.8, 2.65, 3.15, false);
  // a bench and an empty trolley in the passage
  solid(mats.woodDark, 0.4, 0.45, 1.2, -3.0, 0.225, -0.2, false);
  solid(mats.metal, 0.6, 0.05, 1.5, -0.95, 0.8, 2.95, false);
  solid(mats.metal, 0.04, 0.8, 0.04, -1.2, 0.4, 2.3, false);
  solid(mats.metal, 0.04, 0.8, 0.04, -0.7, 0.4, 2.3, false);
  solid(mats.metal, 0.04, 0.8, 0.04, -1.2, 0.4, 3.6, false);
  solid(mats.cloth, 0.55, 0.06, 1.4, -0.95, 0.85, 2.95, false); // a sheet, with something under it, flat

  // ---------------------------------------------------------------- the hall, as a waiting room
  // chairs along the east wall
  for (let i = 0; i < 4; i++) {
    const z = -4.0 - i * 0.62;
    solid(mats.woodDark, 0.45, 0.05, 0.45, 3.65, 0.46, z, false);
    solid(mats.woodDark, 0.05, 0.5, 0.45, 3.88, 0.72, z, false);
    for (const [dx, dz] of [[-0.18, -0.18], [-0.18, 0.18], [0.18, -0.18], [0.18, 0.18]]) solid(mats.metal, 0.03, 0.45, 0.03, 3.65 + dx, 0.225, z + dz, false);
  }
  physics.addStaticBox(3.65, 0.4, -4.95, 0.3, 0.4, 1.2);
  // a radiator under the west poster, painted over too many times
  for (let i = 0; i < 9; i++) solid(mats.metal, 0.12, 0.7, 0.05, -3.88, 0.45, -6.2 + i * 0.09, false);
  solid(mats.metal, 0.14, 0.05, 0.85, -3.88, 0.1, -5.84, false);
  // umbrella stand by the doors
  solid(mats.metal, 0.3, 0.55, 0.3, 1.25, 0.275, -7.75, false);
  // a bin by the bench
  solid(mats.metal, 0.3, 0.45, 0.3, -1.7, 0.225, -4.6, false);
  // a ticket dispenser on its post near the glass
  solid(mats.metal, 0.06, 1.2, 0.06, 1.75, 0.6, -2.0, false);
  solid(new THREE.MeshLambertMaterial({ color: 0x8c2a22 }), 0.22, 0.28, 0.14, 1.75, 1.3, -2.0, false);

  const world = batch.build((g) => mergeGeometries(g, false));
  scene.add(world);

  // ---------------------------------------------------------------- the cut in the booth's back wall: wired glass onto the passage
  const wired = canvasTex(256, 160, (g) => {
    g.clearRect(0, 0, 256, 160);
    g.strokeStyle = 'rgba(40,44,46,0.55)';
    g.lineWidth = 1.2;
    for (let x = 0; x <= 256; x += 16) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, 160);
      g.stroke();
    }
    for (let y = 0; y <= 160; y += 16) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(256, y);
      g.stroke();
    }
  });
  const backGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.75), new THREE.MeshPhongMaterial({ map: wired, color: 0xb8cccc, transparent: true, opacity: 0.32, shininess: 60, depthWrite: false, side: THREE.DoubleSide }));
  backGlass.position.set(0.25, 1.375, 1.8);
  scene.add(backGlass);
  physics.addStaticBox(0.25, 1.375, 1.8, 0.6, 0.375, 0.02);
  const frameMat = mats.woodDark;
  for (const [w, h, x, y] of [[1.3, 0.06, 0.25, 1.0], [1.3, 0.06, 0.25, 1.75], [0.06, 0.8, -0.35, 1.375], [0.06, 0.8, 0.85, 1.375]] as const) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), frameMat);
    f.position.set(x, y, 1.8);
    scene.add(f);
  }

  // ---------------------------------------------------------------- the admissions door in the hall
  const doorMat = new THREE.MeshLambertMaterial({ map: canvasTex(128, 256, (g) => {
    g.fillStyle = '#5b4a36';
    g.fillRect(0, 0, 128, 256);
    g.fillStyle = '#4a3b2a';
    g.fillRect(12, 14, 104, 100);
    g.fillRect(12, 130, 104, 112);
    g.fillStyle = '#d8d0b4';
    g.fillRect(24, 40, 80, 26);
    g.fillStyle = '#1d1a16';
    g.font = '13px "Special Elite", monospace';
    g.textAlign = 'center';
    g.fillText('ADMISSIONS', 64, 58);
    grime(g, 128, 256, 300, 0.15);
  }) });
  const hallDoor = new THREE.Group();
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.88, 2.18, 0.05), doorMat);
  leaf.position.set(0.44, 1.09, 0);
  hallDoor.add(leaf);
  hallDoor.position.set(-2.99, 0, HZ);
  scene.add(hallDoor);

  // the ward door at the far end of the passage
  const wardDoor = new THREE.Group();
  const wleaf = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.1, 0.9), new THREE.MeshLambertMaterial({ map: canvasTex(128, 256, (g) => {
    g.fillStyle = '#e2dccb';
    g.fillRect(0, 0, 128, 256);
    g.fillStyle = '#b9b19a';
    g.fillRect(30, 50, 68, 46);
    g.fillStyle = '#7a1f1a';
    g.font = 'bold 18px "Special Elite", monospace';
    g.textAlign = 'center';
    g.fillText('WARDS', 64, 140);
    g.font = '11px "Special Elite", monospace';
    g.fillText('STAFF AND PATIENTS', 64, 160);
    g.fillText('ONLY', 64, 174);
    grime(g, 128, 256, 600, 0.14);
  }) }));
  wleaf.position.set(0, 1.05, -0.45);
  wardDoor.add(wleaf);
  wardDoor.position.set(1.7, 0, 3.0);
  scene.add(wardDoor);

  // ---------------------------------------------------------------- passage lights: one bare bulb each leg
  const passageLights: THREE.PointLight[] = [];
  // one real light for the whole passage (lights are the expensive thing on a laptop); the second bulb only glows
  for (const [x, z] of [[-1.3, 1.9], [0.2, 2.6]] as const) {
    if (!passageLights.length) {
      const l = new THREE.PointLight(0xd8e4c0, 3.2, 6.5, 1.6);
      l.position.set(x, 2.55, z);
      scene.add(l);
      passageLights.push(l);
    }
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: 0xf0f0d8 }));
    bulb.position.set(x, 2.68, z);
    scene.add(bulb);
    const flex = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.15, 4), mats.black);
    flex.position.set(x, 2.78, z);
    scene.add(flex);
  }

  // ---------------------------------------------------------------- the vending machine in the booth
  const vending = new THREE.Group();
  vending.position.set(-0.77, 0, 1.4);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.6), new THREE.MeshLambertMaterial({ color: 0x7a1d18 }));
  body.position.y = 0.9;
  vending.add(body);
  const vendScreen = new DrawSurface(256, 512);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.12), new THREE.MeshBasicMaterial({ map: vendScreen.texture }));
  front.position.set(0, 1.12, -0.301);
  front.rotation.y = Math.PI;
  vending.add(front);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.16), new THREE.MeshBasicMaterial({ map: canvasTex(256, 64, (g) => {
    g.fillStyle = '#f2e6c8';
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#7a1d18';
    g.font = 'bold 30px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('REFRESH', 128, 42);
  }) }));
  sign.position.set(0, 1.78, -0.302);
  sign.rotation.y = Math.PI;
  vending.add(sign);
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.05), mats.black);
  tray.position.set(0, 0.25, -0.3);
  vending.add(tray);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.03), mats.brass);
  slot.position.set(0.22, 0.95, -0.31);
  vending.add(slot);
  scene.add(vending);
  physics.addStaticBox(-0.77, 0.9, 1.4, 0.35, 0.9, 0.3);
  // the machine's glow comes from its own lit front, not a light: no extra cost to every other surface
  const vendLight = new THREE.PointLight(0xffd2a0, 0, 0.01, 2);
  const vendHit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
  vendHit.position.set(-0.77, 0.9, 1.35);
  vendHit.userData.interact = { id: 'vending', prompt: 'Vending machine', range: 2.2 };
  scene.add(vendHit);

  // ---------------------------------------------------------------- posters, a clock and a notice board in the hall
  const wallPlane = (tex: THREE.Texture, w: number, h: number, x: number, y: number, z: number, ry: number): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    scene.add(m);
    return m;
  };
  wallPlane(poster('VISITING\nHOURS', ['Wards A and C', '2 p.m. to 4 p.m.', '', 'Ward B', 'By arrangement with', 'Dr. I. Abara only', '', 'NO VISITORS AFTER DARK'], '#e6dcc0', '#2a2620'), 0.6, 0.84, -3.92, 1.7, -5.6, Math.PI / 2);
  wallPlane(poster('HAVE YOU\nSEEN THIS MAN?', ['Dr. Orrin Vale, 63', 'General practitioner', 'Hollow End', '', 'Last seen Tuesday', 'evening. Please inform', 'the county constabulary.', '', 'DO NOT APPROACH'], '#efe9d8', '#1b1814'), 0.6, 0.84, 3.92, 1.7, -7.0, -Math.PI / 2);
  wallPlane(poster('QUIET\nPLEASE', ['Patients are sleeping', 'above you.', '', 'Speak only when', 'spoken to at', 'the window.'], '#d9e2d6', '#21352a'), 0.5, 0.7, -3.92, 1.6, -3.1, Math.PI / 2);
  wallPlane(poster('MIND\nTHE STEP', ['Wet floors', 'are slippery'], '#e8c94a', '#1d1a16', 192, 256), 0.36, 0.48, 0.0, 2.3, -8.12, 0);

  const hallClock = new DrawSurface(128, 128);
  const clockMesh = new THREE.Mesh(new THREE.CircleGeometry(0.22, 32), new THREE.MeshLambertMaterial({ map: hallClock.texture }));
  clockMesh.position.set(-3.92, 2.45, -4.6);
  clockMesh.rotation.y = Math.PI / 2;
  scene.add(clockMesh);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 6, 32), mats.brass);
  rim.position.copy(clockMesh.position);
  rim.rotation.y = Math.PI / 2;
  scene.add(rim);

  const notice = new DrawSurface(512, 320);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8), new THREE.MeshLambertMaterial({ map: notice.texture }));
  board.position.set(2.9, 1.65, HZ - 0.08);
  board.rotation.y = Math.PI;
  scene.add(board);

  // the hanging sign over the glass, printed on both faces so neither side reads backwards
  const signTex = canvasTex(256, 52, (g) => {
    g.fillStyle = '#1f2a26';
    g.fillRect(0, 0, 256, 52);
    g.fillStyle = '#e8e0c8';
    g.font = '19px "Special Elite", monospace';
    g.textAlign = 'center';
    g.fillText('PLEASE WAIT TO BE CALLED', 128, 33);
  });
  const signMat = new THREE.MeshLambertMaterial({ map: signTex });
  for (const ry of [0, Math.PI]) {
    const hang = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.22), signMat);
    hang.position.set(0, 2.85, -3.4 + (ry ? -0.004 : 0.004));
    hang.rotation.y = ry;
    scene.add(hang);
  }
  for (const x of [-0.5, 0.5]) {
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 4), mats.black);
    wire.position.set(x, 3.2, -3.4);
    scene.add(wire);
  }
  // a shade on the hall light so it reads as a fitting, not a glow
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.22, 20, 1, true), new THREE.MeshLambertMaterial({ color: 0x3a4a40, side: THREE.DoubleSide }));
  shade.position.set(0, 3.12, -4.6);
  scene.add(shade);

  // umbrellas in the stand, a wet floor sign, a plant that has given up
  const umb = new THREE.MeshLambertMaterial({ color: 0x15130f });
  for (let i = 0; i < 3; i++) {
    const u = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.05, 0.85, 8), umb);
    u.position.set(1.2 + i * 0.05, 0.6, -7.75 + (i - 1) * 0.06);
    u.rotation.z = (i - 1) * 0.12;
    scene.add(u);
  }
  const wet = new THREE.Group();
  const yellow = new THREE.MeshLambertMaterial({ color: 0xd8b21c });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.62, 0.015), yellow);
    p.position.set(0, 0.3, s * 0.1);
    p.rotation.x = s * 0.28;
    wet.add(p);
  }
  wet.position.set(-1.3, 0, -6.6);
  wet.rotation.y = 0.5;
  scene.add(wet);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.32, 12), new THREE.MeshLambertMaterial({ color: 0x6b3f2c }));
  pot.position.set(-3.55, 0.16, -7.7);
  scene.add(pot);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3d4a2a, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.5), leafMat);
    l.position.set(-3.55, 0.5, -7.7);
    l.rotation.set(0.6 + (i % 2) * 0.3, (i / 7) * Math.PI * 2, 0.2);
    l.translateY(0.15);
    scene.add(l);
  }

  // wet footprints from the doors to the glass, and the puddle where everybody stands
  const prints = canvasTex(256, 1024, (g) => {
    g.clearRect(0, 0, 256, 1024);
    for (let i = 0; i < 26; i++) {
      const y = 980 - i * 37;
      const x = 128 + (i % 2 ? 22 : -22) + Math.sin(i * 0.7) * 8;
      g.fillStyle = `rgba(20,24,28,${0.22 + Math.random() * 0.1})`;
      g.beginPath();
      g.ellipse(x, y, 9, 18, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(x, y - 24, 7, 8, 0, 0, Math.PI * 2);
      g.fill();
    }
    const gr = g.createRadialGradient(128, 70, 10, 128, 70, 110);
    gr.addColorStop(0, 'rgba(18,22,26,0.35)');
    gr.addColorStop(1, 'rgba(18,22,26,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 220);
  });
  const printMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 5.6), new THREE.MeshPhongMaterial({ map: prints, transparent: true, depthWrite: false, shininess: 90, specular: 0x445566, polygonOffset: true, polygonOffsetFactor: -2 }));
  printMesh.rotation.x = -Math.PI / 2;
  printMesh.position.set(0, 0.005, -5.0);
  scene.add(printMesh);

  // ---------------------------------------------------------------- for the camera only
  // a tall shape in the far corner of the hall. It is not always there. Nobody mentions it.
  const figMat = new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0, depthWrite: false });
  const cornerFigure = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 2.0, 4, 10), figMat);
  cornerFigure.position.set(-3.55, 1.25, -7.85);
  cornerFigure.scale.set(1, 1, 0.6);
  scene.add(cornerFigure);
  // a smile in the dark, for when the power goes
  const smileTex = canvasTex(256, 128, (g) => {
    g.clearRect(0, 0, 256, 128);
    g.fillStyle = 'rgba(232,226,210,0.95)';
    g.beginPath();
    g.moveTo(20, 50);
    g.quadraticCurveTo(128, 130, 236, 50);
    g.quadraticCurveTo(128, 92, 20, 50);
    g.fill();
    g.strokeStyle = 'rgba(30,10,8,0.9)';
    g.lineWidth = 2;
    for (let x = 34; x < 226; x += 11) {
      const y0 = 50 + (1 - Math.pow((x - 128) / 108, 2)) * 22;
      g.beginPath();
      g.moveTo(x, y0 - 2);
      g.lineTo(x + 1, y0 + 14 + (1 - Math.abs(x - 128) / 108) * 10);
      g.stroke();
    }
  });
  const smile = new THREE.Sprite(new THREE.SpriteMaterial({ map: smileTex, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  smile.scale.set(0.42, 0.21, 1);
  smile.position.set(1.4, 1.62, -5.6);
  scene.add(smile);

  return {
    hallDoor,
    passageLights,
    wardDoor,
    vending,
    vendScreen,
    vendLight,
    hallClock,
    notice,
    cornerFigure,
    smile,
    backGlass,
    hits: [vendHit],
    passagePath: [
      new THREE.Vector3(-0.9, 0, -2.3),
      new THREE.Vector3(-2.55, 0, -1.7),
      new THREE.Vector3(-2.55, 0, -0.9),
      new THREE.Vector3(-2.55, 0, 2.5),
      new THREE.Vector3(0.25, 0, 2.5),
      new THREE.Vector3(1.55, 0, 2.6),
    ],
    backSpot: new THREE.Vector3(0.25, 0, 2.45),
    corridorSpot: new THREE.Vector3(4.2, 0, 0.9),
  };
}

/** The hall clock, drawn to match the clock on the booth wall. */
export function drawHallClock(s: DrawSurface, minute: number): void {
  const total = 22 * 60 + minute * 1.6;
  const h = (total / 60) % 12;
  const m = total % 60;
  const g = s.ctx;
  g.fillStyle = '#ece4cc';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#1d1a16';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.fillRect(64 + Math.sin(a) * 52 - 2, 64 - Math.cos(a) * 52 - 2, 4, 4);
  }
  const hand = (a: number, len: number, w: number): void => {
    g.strokeStyle = '#1d1a16';
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(64, 64);
    g.lineTo(64 + Math.sin(a) * len, 64 - Math.cos(a) * len);
    g.stroke();
  };
  hand((h / 12) * Math.PI * 2, 30, 5);
  hand((m / 60) * Math.PI * 2, 46, 3);
  s.touch();
}

/** The notice board. A few things pinned up change from night to night. */
export function drawNotice(s: DrawSurface, night: number): void {
  const g = s.ctx;
  g.fillStyle = '#6b4a2e';
  g.fillRect(0, 0, 512, 320);
  g.fillStyle = '#a07a52';
  g.fillRect(12, 12, 488, 296);
  for (let i = 0; i < 700; i++) {
    g.fillStyle = `rgba(60,40,20,${Math.random() * 0.25})`;
    g.fillRect(12 + Math.random() * 488, 12 + Math.random() * 296, 2, 2);
  }
  const card = (x: number, y: number, w: number, h: number, rot: number, bg: string, lines: string[], font = '15px "Reenie Beanie", cursive'): void => {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.fillStyle = bg;
    g.fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle = '#2a2620';
    g.font = font;
    g.textAlign = 'center';
    lines.forEach((t, i) => g.fillText(t, 0, -h / 2 + 24 + i * 19));
    g.fillStyle = '#8c1d1a';
    g.beginPath();
    g.arc(0, -h / 2 + 6, 4, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  card(110, 90, 150, 110, -0.06, '#efe6cc', ['STAFF NOTICE', 'Night window: do not', 'open the glass for', 'anyone after 10 p.m.', 'NO EXCEPTIONS'], '13px "Special Elite", monospace');
  card(290, 80, 130, 90, 0.05, '#f4eecf', ['Lost: grey terrier,', 'answers to Biscuit.', 'Bites. Sister I.']);
  card(420, 120, 120, 150, -0.03, '#e8e0c8', ['Who keeps writing', 'in the admissions', 'book after I lock', 'it up?', '  - Matron']);
  card(150, 230, 170, 100, 0.04, '#efe6cc', ['Ward B count', 'Tue 11  Wed 11', 'Thu 11  Fri 12?', 'DO NOT RECOUNT'], '14px "Reenie Beanie", cursive');
  if (night >= 2) card(330, 230, 140, 110, -0.08, '#f2eadc', ['Has anybody seen', 'a little red cap?', 'Please hand in to', 'Ward C. - M. Calder']);
  if (night >= 3) card(460, 255, 80, 60, 0.12, '#ddd2b8', ['TEN', 'MINUTES']);
  if (night >= 4) card(240, 160, 90, 70, -0.15, '#efe6cc', ['bed 10?', 'whose?']);
  if (night >= 5) card(60, 280, 90, 60, 0.1, '#f4eecf', ['D. Pell', 'missing']);
  if (night >= 6) card(380, 30, 110, 40, 0.02, '#f2eadc', ['it has your face'], '15px "Reenie Beanie", cursive');
  s.touch();
}

/** The vending machine's glass front: what is in the coils tonight, and the price. */
export function drawVend(s: DrawSurface, items: { name: string; cost: number }[], tokens: number): void {
  const g = s.ctx;
  g.fillStyle = '#1a1210';
  g.fillRect(0, 0, 256, 512);
  const colours = ['#b8322a', '#d8a428', '#6aa0b8', '#4a2a1a', '#e8c070', '#5a3a2a', '#d0c8b8'];
  items.forEach((it, i) => {
    const y = 20 + i * 66;
    g.fillStyle = '#2a201c';
    g.fillRect(14, y, 228, 58);
    for (let k = 0; k < 4; k++) {
      g.fillStyle = colours[i % colours.length];
      g.fillRect(24 + k * 40, y + 6, 30, 34);
    }
    g.fillStyle = '#f2e6c8';
    g.font = '13px "Special Elite", monospace';
    g.fillText(it.name.slice(0, 22), 22, y + 52);
    g.fillStyle = '#ffcf6a';
    g.fillText(`${it.cost}`, 222, y + 26);
  });
  g.fillStyle = '#ffcf6a';
  g.font = '18px VT323, monospace';
  g.fillText(`TOKENS ${tokens}`, 24, 496);
  s.touch();
}
