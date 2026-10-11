import * as THREE from 'three';
import { AudioEngine } from './audio/engine';
import { FixedClock } from './core/clock';
import { PAUSE_HTML, SPEAKER_VOICE, deathHtml, demoEndHtml, endHtml, shiftCardHtml, titleHtml } from './data/dialogue';
import { COMMON } from './data/common';
import type { L } from './data/nightTypes';
import { NIGHTS } from './data/nights';
import { PERSON_BY_ID } from './data/persons';
import { VEND_BY_ID, type VendId } from './data/vending';
import { lineText } from './data/voiceStyle';
import { VoiceBank } from './audio/voices';
import { drawHallClock, drawNotice, drawVend } from './render/annex';
import { CameraFx } from './render/camfx';
import { Tutorial } from './ui/tutorial';
import { CreatureView } from './render/creature';
import { Physics } from './physics/world';
import { PlayerController, type InputState } from './player/controller';
import { buildEnvironment, type Env, type Interact } from './render/environment';
import { FEMALE_NAMES, PatientView } from './render/patientView';
import { FilingGame, WardView } from './ui/minigames';
import { drawFace } from './render/faces';
import { Post } from './render/post';
import { loadSave, writeSave } from './save/save';
import { Simulation } from './sim/simulation';
import { QUESTION_TEXT } from './sim/patients';
import type { DeathCause, DirectorCue, Ending, Patient, QuestionId, TodoItem, Verdict } from './sim/types';
import { Hud, formatClock } from './ui/hud';

const WINDOW_POS = { x: 0, y: 1.4, z: -1.5 };
const WARD_B_DOOR = { x: 8.6, y: 1.5, z: 1.7 };
const STAIN_POS = { x: 6.7, z: 1.0 };
const FEMALE_STAFF = new Set(['Sister Imogen', 'Night Nurse Kessler', "Matron's Office", 'Ada Wren', 'Matron Agatha Thorne', 'Dr. Ines Abara']);

/** Builds a canvas texture of something dark that was dragged toward the Ward B door. */
function stainTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  let seed = 77;
  const R = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) {
    const x = 120 + R() * 110, y = 90 + R() * 80, r = 14 + R() * 40;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(48,8,6,0.9)');
    gr.addColorStop(0.7, 'rgba(60,12,8,0.75)');
    gr.addColorStop(1, 'rgba(60,12,8,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // drag marks toward the ward door, fading
  for (let k = 0; k < 4; k++) {
    g.strokeStyle = `rgba(55,10,8,${0.5 - k * 0.08})`;
    g.lineWidth = 6 + R() * 8;
    g.beginPath();
    g.moveTo(200, 110 + k * 12);
    g.bezierCurveTo(300, 100 + k * 14, 380, 130 + k * 10, 500, 120 + k * 16);
    g.stroke();
  }
  // a hand, flat, where someone tried to hold on
  g.fillStyle = 'rgba(40,6,4,0.85)';
  g.beginPath();
  g.ellipse(330, 70, 16, 20, 0.3, 0, 7);
  g.fill();
  for (let f = 0; f < 4; f++) {
    g.beginPath();
    g.ellipse(316 + f * 9, 44 - Math.abs(f - 1.5) * 4, 3.5, 11, 0.15 * (f - 1.5), 0, 7);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Cracks spreading from where its hands were. */
function crackTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.strokeStyle = 'rgba(235,245,255,0.85)';
  for (const [cx, cy] of [
    [210, 120],
    [300, 110],
    [256, 150],
  ]) {
    for (let i = 0; i < 14; i++) {
      let x = cx, y = cy;
      const a = Math.random() * Math.PI * 2;
      g.lineWidth = 0.6 + Math.random() * 1.4;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 7; k++) {
        x += Math.cos(a + (Math.random() - 0.5) * 0.8) * (10 + Math.random() * 22);
        y += Math.sin(a + (Math.random() - 0.5) * 0.8) * (10 + Math.random() * 22);
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.lineWidth = 0.6;
    for (let r = 8; r < 40; r += 9) {
      g.beginPath();
      g.arc(cx, cy, r + Math.random() * 4, 0, Math.PI * 2);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d9d0b4';
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = 'rgba(60,40,20,0.25)';
  for (let i = 0; i < 300; i++) g.fillRect(Math.random() * 256, Math.random() * 64, 2, 2);
  g.fillStyle = '#1d1a16';
  g.font = '34px "Special Elite", "Courier New", monospace';
  g.textAlign = 'center';
  g.fillText(text, 128, 44);
  g.strokeStyle = '#1d1a16';
  g.lineWidth = 3;
  g.strokeRect(5, 5, 246, 54);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Game {
  readonly sim: Simulation;
  private renderer: THREE.WebGLRenderer;
  private post: Post;
  private env: Env;
  private physics: Physics;
  private player: PlayerController;
  private view: PatientView;
  private audio = new AudioEngine();
  private hud: Hud;
  private input: InputState = { keys: new Set(), mouseDX: 0, mouseDY: 0, mouseNX: 0.5, mouseNY: 0.5 };
  private clock = new FixedClock(1 / 60);
  private ray = new THREE.Raycaster();
  private flashlight!: THREE.SpotLight;
  private save = loadSave();

  private running = false;
  private began = false;
  private ended = false;
  private time = 0;
  private lastPhase = 'none';
  private patientsSeen = 0;
  private flickerT = 0;
  private lightningT = 12;
  private flashV = 0;
  private figureT = 0;
  private leverT = 0;
  private breakerHold = 0;
  private hovered: Interact | null = null;
  private perfOn = false;
  private perfAcc = 0;
  private frameMs = 16;
  private speedUp = 1;
  private pendingTimers: number[] = [];
  readonly night: number;
  private cardShown = false;
  private staffView!: PatientView;
  private staffHit!: THREE.Mesh;
  private staffT = 0;
  private staffTalk: { person: string; lines: L[] } | null = null;
  private voices!: VoiceBank;
  private camfx!: CameraFx;
  private tutorial!: Tutorial;
  private leanT = 0;
  private admitted = 0;
  private backFake: { t: number; hit: boolean } | null = null;
  private cornerT = 0;
  private cornerDone = false;
  private smileDone = false;
  private smileT = 0;
  private creatureBreathT = 4;
  private vendOpen = false;
  /** Dev hook for automated checks. */
  debug = { frames: 0 };

  private constructor(private readonly canvas: HTMLCanvasElement, root: HTMLElement, physics: Physics, seed: number) {
    this.physics = physics;
    const qs0 = new URLSearchParams(location.search);
    this.night = Math.max(1, Math.min(NIGHTS.length, Number(qs0.get('night')) || this.save.reached || 1));
    this.sim = new Simulation(seed, { night: this.night, tokens: this.save.tokens });
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setPixelRatio(1);
    this.post = new Post(this.renderer);
    this.env = buildEnvironment(physics);
    this.player = new PlayerController(physics);
    this.view = new PatientView(this.env.patientSpawn, this.env.patientStand);
    this.env.scene.add(this.view.group, this.view.rig);
    const ax = this.env.annex;
    this.view.setPassage(ax.passagePath, ax.backSpot);
    this.view.onGlimpse = () => {
      this.audio.glitch();
      this.flashV = Math.max(this.flashV, 0.15);
    };
    this.view.onReveal = (kind) => this.audio.entityReveal(kind, { x: this.view.group.position.x, y: 1.6, z: this.view.group.position.z });
    this.view.onBackWindow = (p) => this.atBackWindow(p);
    // staff in person: one body, moved to wherever they are needed
    this.staffView = new PatientView(ax.backSpot.clone().add(new THREE.Vector3(-1.6, 0, 0)), ax.backSpot.clone());
    this.env.scene.add(this.staffView.group); // no rig lights for staff: lights are the expensive part on a laptop
    this.staffHit = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.9, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
    this.staffHit.userData.interact = { id: 'staff', prompt: 'Talk', range: 3.4 } satisfies Interact;
    this.staffHit.visible = false;
    this.env.scene.add(this.staffHit);
    this.env.interactables.push(this.staffHit);
    this.voices = new VoiceBank(() => this.audio.context, () => this.audio.voiceOut, () => this.audio.reverbSend);
    this.camfx = new CameraFx(this.player);
    this.tutorial = new Tutorial({
      say: (line, from) => this.speakAs('pell', line, from === 'window' ? { pos: WINDOW_POS, glass: true, queue: true } : { pos: { x: ax.backSpot.x, y: 1.6, z: ax.backSpot.z }, glass: true, queue: true }, 'Orderly Pell'),
      coach: (text, key) => this.hud.coach(text, key),
    });
    this.buildTaskProps();
    this.env.scene.add(this.creature.group);
    // the mop, held low in front of you while you carry it
    this.mopMesh = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.2, 8), new THREE.MeshLambertMaterial({ color: 0x6b4a2a }));
    handle.rotation.x = 1.0;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.18, 10), new THREE.MeshLambertMaterial({ color: 0x8a7a72 }));
    head.position.set(0, -0.3, -0.48);
    this.mopMesh.add(handle, head);
    this.mopMesh.position.set(0.32, -0.35, -0.5);
    this.mopMesh.visible = false;
    this.player.camera.add(this.mopMesh);
    this.crack = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.25), new THREE.MeshBasicMaterial({ map: crackTexture(), transparent: true, opacity: 0, depthWrite: false }));
    this.crack.position.set(0, 1.575, -1.205);
    this.env.scene.add(this.crack);
    this.env.scene.add(this.player.camera);

    this.flashlight = new THREE.SpotLight(0xfff0d8, 0, 14, 0.42, 0.55, 1.6);
    this.env.scene.add(this.flashlight, this.flashlight.target);

    this.audio.muted = this.save.muted;
    this.hud = new Hud(root, {
      ask: (q) => this.ask(q),
      lookup: () => this.lookup(),
      face: () => this.face(),
      verdict: (v) => this.doVerdict(v),
      begin: () => this.begin(),
    });
    this.hud.setTodo(this.sim.state.todo);
    this.hud.setTokens(this.sim.state.tokens);
    this.hud.overlay(titleHtml(this.save.reached, false));
    this.bindNightButtons();
    this.hud.setMode(true);
    drawNotice(ax.notice, this.night);
    drawHallClock(ax.hallClock, 0);
    this.drawVendFront();
    this.bindSim();
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.drawCrt();
    this.drawSlip(null);
    // the canvas textures need the fonts loaded before they can use them
    void Promise.all([
      document.fonts.load('26px VT323'),
      document.fonts.load('14px "Special Elite"'),
      document.fonts.load('italic 12px "IM Fell English"'),
    ]).then(() => {
      this.drawCrt();
      this.drawSlip(this.sim.state.current);
    });

    const qs = new URLSearchParams(location.search);
    this.speedUp = Math.max(1, Number(qs.get('fast')) || 1);
    if (qs.has('autostart')) this.begin();
  }

  static async create(canvas: HTMLCanvasElement, root: HTMLElement): Promise<Game> {
    const physics = await Physics.create();
    const qs = new URLSearchParams(location.search);
    const seed = qs.has('seed') ? Number(qs.get('seed')) : (Math.random() * 2 ** 31) | 0;
    const g = new Game(canvas, root, physics, seed);
    requestAnimationFrame((t) => g.frame(t));
    return g;
  }

  // ------------------------------------------------------------------ lifecycle
  private begin(): void {
    this.audio.start();
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.getVoices();
    // the title says which night to continue; if it is not the one loaded, load it
    const qs = new URLSearchParams(location.search);
    if (!this.began && !qs.has('night') && this.night !== this.save.reached) return this.goNight(this.save.reached);
    if (!this.began && !this.cardShown && !qs.has('autostart')) {
      this.cardShown = true;
      const fresh = this.sim.def.vending.map((id) => VEND_BY_ID[id as VendId]).filter(Boolean);
      this.hud.overlay(shiftCardHtml(this.sim.def, fresh, this.sim.state.tokens));
      return;
    }
    this.hud.overlay(null);
    this.running = true;
    if (!this.began) {
      this.began = true;
      this.hud.setTask('Check each form against the records. Get to six.');
      // the night opens with one slow turn round the booth. A click skips it.
      if (!qs.has('autostart')) this.camfx.orbit(new THREE.Vector3(0, 1.3, 0.5), 9);
    }
    if (this.player.mode === 'floor') this.canvas.requestPointerLock?.();
  }

  private goNight(n: number): void {
    const qs = new URLSearchParams(location.search);
    qs.set('night', String(n));
    qs.delete('seed');
    qs.delete('autostart');
    location.search = qs.toString();
  }

  private bindNightButtons(): void {
    for (const b of document.querySelectorAll<HTMLButtonElement>('#overlay button[data-night]')) b.onclick = () => this.goNight(Number(b.dataset.night));
  }

  private pause(): void {
    if (!this.running || this.ended) return;
    this.running = false;
    this.audio.stopVoice();
    this.hud.overlay(PAUSE_HTML);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.post.resize(w, h);
    this.player.setAspect(w / h);
  }

  // ------------------------------------------------------------------ sim events
  private bindSim(): void {
    const b = this.sim.bus;
    b.on('patientArrived', ({ patient }) => {
      this.patientsSeen++;
      this.view.setPatient(patient, this.sim.state.stage);
      this.audio.knock({ x: 0, y: 1.3, z: -8.2 }, 2);
      setTimeout(() => this.audio.paper(), 4200);
      this.lightningT = Math.min(this.lightningT, 3);
    });
    b.on('patientLeft', ({ verdict }) => {
      this.breachTimers.forEach((t) => clearTimeout(t));
      this.breachTimers = [];
      this.view.beginLeave(verdict);
      this.hud.showPatient(null);
      this.drawSlip(null);
      this.drawCrt();
    });
    b.on('verdictResult', ({ verdict, patient }) => {
      if (verdict === 'admit') this.audio.stamp();
      else if (verdict === 'contain') {
        this.leverT = 1.4;
        this.audio.lever();
      } else this.audio.click();
      // you watch them go: the camera follows them out of the hall toward the admissions door
      if ((verdict === 'admit' || verdict === 'observe') && this.player.mode === 'desk' && !this.camfx.busy) {
        this.admitted++;
        this.camfx.follow(() => this.view.group.position.clone(), 2.0);
      }
      void patient;
    });
    b.on('cue', ({ cue, intensity }) => this.onCue(cue, intensity));
    b.on('powerChanged', ({ on }) => {
      if (on) this.audio.powerUp();
      else this.audio.powerDown();
      this.drawCrt();
      this.hud.setLedger(null, true, on);
    });
    b.on('taskChanged', ({ text, done }) => {
      this.hud.setTask(done ? '' : text);
      if (done) {
        this.hud.subtitle('Task', text, 2500);
        this.refreshTaskLine(this.sim.state.todo);
      }
    });
    b.on('story', ({ text, speaker, call, wrong, person, line, where, talk }) => {
      const who = speaker ?? 'Intercom';
      const per = person ?? 'pell';
      const l: L = line ?? text;
      const ax = this.env.annex;
      const speak = (): void => {
        if (where === 'back' || where === 'corridor') {
          // in person: they walk up to you, and they are there to talk to for a while after
          const spot = where === 'back' ? ax.backSpot : ax.corridorSpot;
          this.showStaff(per, spot, where, talk ?? []);
          this.pendingTimers.push(window.setTimeout(() => this.speakAs(per, l, { pos: { x: spot.x, y: 1.6, z: spot.z }, glass: where === 'back', mimic: wrong ? 0.55 : 0, queue: true }, who), 2600));
          return;
        }
        this.speakAs(per, l, { radio: true, mimic: wrong ? 0.55 : 0, queue: !call }, who);
      };
      if (call) this.ring(speak);
      else speak();
    });
    b.on('tokens', ({ tokens, gained, why }) => {
      this.hud.setTokens(tokens);
      this.drawVendFront();
      if (gained > 0) this.hud.coachFlash(`+${gained} token: ${why}`);
    });
    b.on('hint', ({ text }) => this.hud.subtitle('Hollow Mints', text, 6500));
    b.on('buff', ({ id, on }) => {
      if (!on && id === 'tonic') this.hud.subtitle("Sister's Tonic", 'Your hand moves before you decide. The stamp comes down on its own.', 4000);
    });
    b.on('saved', () => {
      // sweet tea: everything goes black, and you come round at the desk
      this.flashV = 1;
      this.audio.deathSting();
      this.player.sit();
      this.hud.setMode(true);
      document.exitPointerLock?.();
      this.hud.subtitle('', 'You black out. You come round at the desk with the taste of sugar in your mouth. Whatever it was, it has gone. For now.', 6000);
    });
    b.on('stalker', ({ event }) => {
      const st = this.sim.stalker;
      const pos = { x: st.x, y: 1.9, z: st.z };
      if (event === 'appear') {
        this.audio.presence();
        this.pendingTimers.push(window.setTimeout(() => this.audio.creatureStep(pos), 1500));
      } else if (event === 'growl') this.audio.growl(pos);
      else if (event === 'shriek') {
        this.audio.shriek(pos);
        this.flickerT = Math.max(this.flickerT, 0.8);
      } else if (event === 'bang') {
        this.audio.doorBang({ x: 1.85, y: 1.2, z: 0.85 });
        this.flickerT = Math.max(this.flickerT, 0.3);
      }
    });
    b.on('breach', ({ phase }) => {
      this.view.setBreach(phase);
      if (phase === 'crack') {
        this.hud.subtitle('', 'It is coming through the glass. Drop it through the trapdoor (T), or get under the desk (C) and stay there.', 6000);
        for (let i = 0; i < 6; i++)
          this.breachTimers.push(
            window.setTimeout(() => {
              this.crackLevel = Math.min(1, this.crackLevel + 0.17);
              this.audio.glassHit(i / 5);
              this.flashV = Math.max(this.flashV, 0.1);
            }, 600 + i * 1250),
          );
      } else if (phase === 'inside') {
        this.crackLevel = 1;
        this.audio.glassShatter();
        this.flickerT = 1.2;
      } else {
        this.audio.creatureStep({ x: 1.85, y: 0, z: 0.85 });
        this.audio.creak({ x: 1.8, y: 1, z: 0.9 });
      }
    });
    b.on('death', ({ cause }) => this.die(cause));
    b.on('fear', ({ event, real }) => this.onFear(event, real));
    b.on('dawn', ({ phase }) => {
      if (phase === 'start') {
        this.dawnT = 0.001;
        this.audio.presence();
      }
    });
    b.on('choice', () => {
      this.choiceT = 16;
      this.pendingTimers.push(window.setTimeout(() => this.hud.subtitle('Decide', 'Ring Pell and report the count? Press 1 to report it: he will lock Ward B from the inside. Press 2 to say nothing.', 15000), 5600));
    });
    b.on('todo', ({ items }) => {
      this.hud.setTodo(items);
      this.refreshTaskLine(items);
    });
    b.on('wardCounted', ({ id, count }) => {
      if (id === 'count1') this.hud.subtitle('Your own handwriting', `Ward B, 02:00. Register ${count.register}. I counted ${this.lastTally}.`, 5200);
    });
    b.on('stare', ({ on, hit }) => {
      this.view.setStare(on);
      if (on && hit) {
        this.audio.stareHit();
        this.audio.glitch();
        this.view.revealing = 1.3;
        this.flashV = Math.max(this.flashV, 0.35);
      }
      else if (on) {
        this.audio.stareOn();
        if (!this.stareHinted) {
          this.stareHinted = true;
          this.hud.subtitle('Your own handwriting', 'It is holding my eye. Look down. Or get under the desk.', 5200);
        }
      } else this.audio.stareOff(hit);
    });
    b.on('hallucination', ({ kind }) => {
      const behind = { x: this.player.camera.position.x, y: 1.5, z: this.player.camera.position.z + 2 };
      if (kind === 'phantom_step') this.audio.distantStep(behind);
      else if (kind === 'phantom_knock') this.audio.knock({ x: this.player.camera.position.x + 1.5, y: 1.4, z: this.player.camera.position.z }, 2);
      else if (kind === 'whisper_name') this.audio.whisper(behind, 0.22);
      else if (kind === 'shadow_figure') this.figureT = 2.2;
    });
    b.on('shiftEnded', ({ score }) => {
      this.ended = true;
      this.running = false;
      document.exitPointerLock?.();
      this.save.nights++;
      this.save.bestCorrect = Math.max(this.save.bestCorrect, score.correct);
      if (this.deathCause) {
        writeSave(this.save);
        return;
      }
      this.save.reached = Math.max(this.save.reached, Math.min(NIGHTS.length, this.night + 1));
      this.save.tokens = score.tokens;
      writeSave(this.save);
      const def = this.sim.def;
      const showEnd = (): void => {
        this.hud.overlay(endHtml(score, 'Night officer', def.endings[score.ending], this.night === NIGHTS.length));
        this.bindRestart();
      };
      if (def.demoEnd) this.demoScare(() => {
        this.hud.overlay(endHtml(score, 'Night officer', def.endings[score.ending]) + `<div class="demoend">${demoEndHtml()}</div>`);
        this.bindRestart();
      });
      else showEnd();
    });
  }

  /**
   * The end of Night 1, and of the demo. As you turn away from the ward, the thing that wore your mother is right there.
   * It looks straight into the lens, holds it, and comes through it.
   */
  private demoScare(after: () => void): void {
    this.scare = true;
    this.mini?.close(false);
    const cam = this.player.camera;
    const fwd = this.player.forward().setY(0).normalize();
    const spot = cam.position.clone().addScaledVector(fwd, 1.0).setY(0);
    const mum = { id: 'END', archetype: 'fluent_mimic', truth: 'understudy', registryId: 'R209', displayName: 'Ada Wren', docs: { slipName: '', slipDob: '', slipSender: '', wristband: '', photoMark: '' }, faceMark: 'a freckle under the left eye', answers: { name: '', dob: '', sender: '', kin: '', memory: '' }, tells: ['no_breath'], quirk: '', hue: 0.31, height: 0.95, sprite: 0, castId: 'ada', reveal: 'hollow', mother: true } as Patient;
    this.view.spawn = spot.clone();
    this.view.stand = spot.clone();
    this.view.setPatient(mum, 7);
    this.view.group.rotation.y = Math.atan2(cam.position.x - spot.x, cam.position.z - spot.z);
    this.audio.stopVoice();
    this.audio.presence();
    // silence, then her face goes, then it comes for the lens
    this.pendingTimers.push(window.setTimeout(() => this.speakAs('ada', ['There you are.', 'warm'], { pos: { x: spot.x, y: 1.5, z: spot.z } }, 'Ada Wren'), 500));
    this.pendingTimers.push(window.setTimeout(() => {
      this.view.revealing = 3;
      this.camfx.lunge(() => this.view.group.position.clone().setY(cam.position.y - 0.05), 1.6);
    }, 2300));
    this.pendingTimers.push(window.setTimeout(() => {
      this.audio.jumpscare();
      this.flashV = 1;
    }, 3300));
    this.pendingTimers.push(window.setTimeout(() => {
      this.scare = false;
      this.view.setPatient(null);
      this.hud.subtitle('', '', 1);
      after();
    }, 4100));
  }

  private onCue(cue: DirectorCue, intensity: number): void {
    const camX = this.player.camera.position.x;
    const inBooth = this.sim.state.zone === 'booth';
    switch (cue) {
      case 'flicker':
        this.flickerT = 0.6 + intensity;
        break;
      case 'knock':
        this.audio.knock(inBooth ? WINDOW_POS : { x: camX + 3, y: 1.3, z: 0.1 }, 3);
        break;
      case 'distant_step':
        this.audio.distantStep(inBooth ? { x: 6, y: 0, z: 0.9 } : { x: camX - 4, y: 0, z: 0.9 });
        break;
      case 'phone_ring':
        this.audio.phoneRing();
        this.flickerPhone = 3;
        break;
      case 'whisper':
        this.audio.whisper({ x: camX + (Math.random() - 0.5) * 2, y: 1.5, z: this.player.camera.position.z + 1.6 }, 0.18 + intensity * 0.25);
        break;
      case 'door_creak': {
        this.audio.creak(inBooth ? { x: 1.8, y: 1, z: 0.8 } : { x: camX + 5, y: 1, z: 0.9 });
        const crate = this.env.props.find((p) => p.mesh.userData.interact?.prompt === 'Crate');
        crate?.phys.body.applyImpulse({ x: 0.4, y: 0.5, z: 0.2 }, true);
        break;
      }
      case 'drip_stop':
        this.sim.director.quiet = true;
        break;
      case 'music_box':
        this.audio.musicBox(inBooth ? { x: 0.8, y: 1.6, z: -5.2 } : { x: camX + 6, y: 1.2, z: 2.6 }, this.sim.state.stage);
        break;
      case 'scratch':
        this.audio.scratch(inBooth ? { x: 1.85, y: 1.1, z: 0.1 } : { x: camX + 3.5, y: 1.0, z: -0.1 });
        break;
      case 'breath_behind':
        this.audio.breathBehind();
        if (this.player.mode === 'desk' && !this.camfx.busy) {
          this.audio.whoosh();
          this.camfx.whip(new THREE.Vector3(0.25, 1.4, 1.8), 1.0);
        }
        break;
      case 'window_tap':
        this.audio.windowTap(inBooth ? WINDOW_POS : { x: 7.4, y: 1.6, z: 1.8 });
        break;
      case 'knob_rattle':
        this.audio.knobRattle(inBooth ? { x: 1.8, y: 1.0, z: 0.85 } : { x: camX + 3, y: 1.0, z: 0.0 });
        break;
      case 'chair_creak':
        this.audio.chairCreak();
        break;
      case 'overhead_steps':
        // pigeons in the roof space over the hall scatter when something walks up there
        if (Math.random() < 0.35) this.audio.pigeons({ x: 0, y: 3.4, z: -4.6 });
        else this.audio.overheadSteps();
        break;
      case 'pipe_knock':
        // night 2 lost the heating: the radiators bang when it tries to come back. Pell says so on the intercom.
        if (this.night === 2) this.audio.radiatorBang({ x: -3.88, y: 0.5, z: -5.8 });
        else this.audio.pipeKnock({ x: camX + 5, y: 2.6, z: 0.4 });
        break;
      case 'child_hum':
        this.audio.childHum({ x: 11, y: 0.9, z: 2.2 });
        break;
      case 'wheelchair':
        this.audio.wheelchair({ x: 11, y: 0.3, z: 2.2 });
        break;
      case 'stage_up':
        this.audio.stageUp(this.sim.state.stage / 7);
        if (this.sim.state.stage >= 4) this.pendingTimers.push(window.setTimeout(() => this.audio.broadcast(), 2200));
        this.flickerT = Math.max(this.flickerT, 0.5);
        break;
      case 'power_back':
      case 'power_out':
        break;
    }
  }
  private flickerPhone = 0;
  private creature = new CreatureView();
  private crack!: THREE.Mesh;
  private crackLevel = 0;
  private breachTimers: number[] = [];
  private stepT = 0;
  private dying = 0;
  private deathCause: DeathCause | null = null;
  private stareHinted = false;
  private lastPace = 'calm';

  // ------------------------------------------------------------------ the passage, the staff, the machine
  /**
   * Someone you let in has walked round to the wired window behind your chair.
   * People say goodbye and wave. A fake stands there and looks at the back of your head.
   * Either way the camera turns round to see: the dolly zoom, face held still while the passage stretches away.
   */
  private atBackWindow(p: Patient): void {
    const ax = this.env.annex;
    const face = new THREE.Vector3(ax.backSpot.x, 1.55 * (p.height || 1), ax.backSpot.z);
    const pos = { x: ax.backSpot.x, y: 1.6, z: ax.backSpot.z };
    if (p.tutorial) this.tutorial.atBack();
    const seated = this.player.mode === 'desk';
    if (p.truth === 'understudy') {
      this.audio.backTap(pos, 3);
      this.pendingTimers.push(window.setTimeout(() => this.audio.entityClicks(pos, 12), 900));
      this.backFake = { t: 6, hit: false };
      if (seated) {
        this.audio.whoosh();
        this.camfx.vertigo(face, 3.6, 0.12);
      }
      return;
    }
    const bye = p.lines?.bye;
    if (bye && p.castId) {
      const tut = p.tutorial;
      this.pendingTimers.push(window.setTimeout(() => this.speakAs(p.castId!, bye, { pos, glass: true }, p.displayName), tut ? 400 : 300));
    }
    // the first few times, and always for the tutorial, the camera turns to watch them pass
    if (seated && (this.admitted <= 3 || p.tutorial)) this.camfx.vertigo(face, p.tutorial ? 4.2 : 3.0, 0);
  }

  /** Staff in person, at the back window or in the corridor. They stay a while; E talks to them. */
  private showStaff(person: string, spot: THREE.Vector3, where: string, talk: L[]): void {
    const per = PERSON_BY_ID[person];
    if (!per) return;
    const v = this.staffView;
    const from = where === 'back' ? spot.clone().add(new THREE.Vector3(-1.8, 0, 0)) : spot.clone().add(new THREE.Vector3(3, 0, 0));
    v.spawn = from;
    v.stand = spot.clone();
    const rec = this.sim.state.registry.find((r) => r.id === `C_${person}`);
    const pseudo = {
      id: `S_${person}`, archetype: 'plain', truth: 'human', registryId: rec?.id ?? `C_${person}`, displayName: per.name,
      docs: { slipName: per.name, slipDob: '', slipSender: '', wristband: '', photoMark: rec?.photoMark ?? '' },
      faceMark: rec?.photoMark ?? '', answers: { name: '', dob: '', sender: '', kin: '', memory: '' }, tells: [], quirk: '',
      hue: 0.37, height: 1, sprite: 0, castId: person, breathes: true,
    } as Patient;
    v.setPatient(pseudo, 0);
    this.staffT = 36;
    this.staffPhase = 'approaching';
    this.staffPhaseT = 0;
    this.staffTalk = { person, lines: [...talk] };
    if (where === 'back') this.audio.passageStep({ x: spot.x - 1, y: 0, z: spot.z });
  }
  private staffPhase: 'none' | 'approaching' | 'present' = 'none';
  private staffPhaseT = 0;

  private tickStaff(dt: number): void {
    const v = this.staffView;
    if (this.staffPhase === 'none') {
      this.staffHit.visible = false;
      v.update(dt, 'none', this.player.camera.position, false);
      return;
    }
    this.staffPhaseT += dt;
    if (this.staffPhase === 'approaching' && this.staffPhaseT > 3.5) this.staffPhase = 'present';
    this.staffT -= dt;
    v.update(dt, this.staffPhase, this.player.camera.position, false);
    this.staffHit.position.copy(v.group.position).setY(0.95);
    this.staffHit.visible = this.staffPhase === 'present';
    if (this.staffT <= 0 || this.sim.stalker.active) {
      this.staffPhase = 'none';
      this.staffTalk = null;
      v.setPatient(null);
    }
  }

  private talkToStaff(): void {
    const t = this.staffTalk;
    if (!t || this.staffPhase !== 'present') return;
    const ax = this.env.annex;
    const pos = this.staffView.group.position;
    const line = t.lines.shift();
    if (!line) {
      this.speakAs(t.person, ["I've got to get back up. Mind yourself.", 'calm'], { pos: { x: pos.x, y: 1.6, z: pos.z }, glass: pos.distanceTo(ax.backSpot) < 0.5 });
      this.staffT = Math.min(this.staffT, 5);
      return;
    }
    this.staffView.speaking = this.speakAs(t.person, line, { pos: { x: pos.x, y: 1.6, z: pos.z }, glass: pos.distanceTo(ax.backSpot) < 0.5 });
    this.staffT = Math.max(this.staffT, 14);
  }

  private drawVendFront(): void {
    const stock = this.sim.vendStock().map((id) => VEND_BY_ID[id]);
    drawVend(this.env.annex.vendScreen, stock, this.sim.state.tokens);
  }

  private openVend(): void {
    const stock = this.sim.vendStock().map((id) => VEND_BY_ID[id]);
    this.vendOpen = true;
    document.exitPointerLock?.();
    this.input.keys.clear();
    const render = (): void =>
      this.hud.vendMenu(stock, this.sim.state.tokens, (id) => this.buy(id as VendId, render), () => this.closeVend());
    render();
  }

  private buy(id: VendId, rerender: () => void): void {
    if (!this.sim.buy(id)) return;
    this.audio.vend();
    const item = VEND_BY_ID[id];
    if (id === 'toffee') this.player.stamina = 1;
    this.hud.subtitle(item.name, item.effect, 3500);
    rerender();
  }

  private closeVend(): void {
    this.vendOpen = false;
    this.hud.overlay(null);
    if (this.running && this.player.mode === 'floor') this.hud.subtitle('', 'Click to carry on.', 2500);
  }

  /** The things that are only there for the camera: the figure in the corner, the smile in the dark. */
  private tickHauntings(dt: number): void {
    const ax = this.env.annex;
    const s = this.sim.state;
    // the figure in the corner of the hall: no sound, no music, nobody mentions it. On the night's opening turn
    // round the booth it stands there on the second pass (from night 2), and once later in the night, between visitors.
    const orbit = this.camfx.kind === 'orbit' && this.camfx.progress > 0.55 && this.night >= 2;
    if (!this.cornerDone && s.phase === 'none' && s.minute > 120 && this.sim.presRng.chance(dt * 0.02)) {
      this.cornerDone = true;
      this.cornerT = 22;
    }
    this.cornerT = Math.max(0, this.cornerT - dt);
    let fig = orbit ? 0.85 : this.cornerT > 0 ? Math.min(0.85, this.cornerT, 22 - this.cornerT) : 0;
    // look straight at it for too long through the lean, and it is gone with a tick of static
    if (fig > 0.5 && this.player.zoomed && this.player.mode === 'desk') {
      const to = ax.cornerFigure.position.clone().sub(this.player.camera.position).normalize();
      if (to.dot(this.player.forward()) > 0.97) {
        this.cornerT = 0;
        fig = 0;
        this.audio.glitch();
      }
    }
    (ax.cornerFigure.material as THREE.MeshBasicMaterial).opacity = fig;
    // the smile in the dark hall, once per power cut
    if (!s.powerOn && !this.smileDone && this.player.mode === 'desk') {
      this.smileT += dt;
      if (this.smileT > 3) {
        this.smileDone = true;
        this.smileT = -3;
        this.audio.entityClicks({ x: ax.smile.position.x, y: 1.6, z: ax.smile.position.z }, 6);
      }
    }
    if (s.powerOn) this.smileDone = false;
    const sm = this.smileT < 0 ? Math.min(1, -this.smileT) * (0.75 + Math.random() * 0.25) : 0;
    if (this.smileT < 0) this.smileT = Math.min(0, this.smileT + dt);
    (ax.smile.material as THREE.SpriteMaterial).opacity = sm;
    // the tall one breathes and clicks while it is in the corridor
    const st = this.sim.stalker;
    if (st.active) {
      this.creatureBreathT -= dt;
      if (this.creatureBreathT <= 0) {
        this.creatureBreathT = 5 + Math.random() * 4;
        const pos = { x: st.x, y: 2.1, z: st.z };
        if (Math.random() < 0.6) this.audio.creatureBreath(pos);
        else this.audio.creatureClick(pos);
      }
    }
    // a fake at the back window: turn and meet its eyes and it costs you
    if (this.backFake) {
      this.backFake.t -= dt;
      const to = ax.backSpot.clone().setY(1.5).sub(this.player.camera.position).normalize();
      const looking = to.dot(this.player.forward()) > 0.75 && !this.camfx.busy;
      if (looking && !this.backFake.hit) {
        this.backFake.hit = true;
        this.sim.passageStare();
        this.view.revealing = 1.2;
        this.audio.stareHit();
        this.flashV = Math.max(this.flashV, 0.3);
      }
      if (this.backFake.t <= 0) this.backFake = null;
    }
    // doors open as someone goes through them
    const k = this.view.passageK;
    const hallOpen = k > 0 && k < 0.42 ? 1 : 0;
    ax.hallDoor.rotation.y += (hallOpen * 1.4 - ax.hallDoor.rotation.y) * Math.min(1, dt * 4);
    const wardOpen = k > 0.82 ? 1 : 0;
    ax.wardDoor.rotation.y += (-wardOpen * 1.3 - ax.wardDoor.rotation.y) * Math.min(1, dt * 4);
    if (k > 0 && this.view.atBack === false && Math.random() < dt * 1.8) {
      const gp = this.view.group.position;
      this.audio.passageStep({ x: gp.x, y: 0, z: gp.z });
    }
  }

  // ------------------------------------------------------------------ desk actions
  private ask(q: QuestionId): void {
    const p = this.sim.state.current;
    if (!p || this.sim.state.phase !== 'present' || !this.running) return;
    const r = this.sim.ask(q);
    if (!r) return;
    this.hud.markAsked(q);
    this.hud.logLine('q', QUESTION_TEXT[q]);
    this.audio.clack();
    this.tutorial.on({ kind: 'ask', q });
    const t = window.setTimeout(() => {
      const dur = this.say(p, r.text, r.line);
      this.view.speaking = dur;
      this.hud.logLine('a', `"${r.text}"`);
    }, r.delay * 1000);
    this.pendingTimers.push(t);
  }

  private voicePitch(p: Patient): number {
    return p.archetype === 'voice_mimic' ? 208 : 105 + p.hue * 110;
  }

  /**
   * Someone says a line. The recorded voice when there is one, the system voice when there is not.
   * Subtitles are shown either way. Returns how long it lasts, in seconds.
   */
  private speakAs(person: string, line: L, o: { radio?: boolean; mimic?: number; pos?: { x: number; y: number; z: number }; glass?: boolean; queue?: boolean } = {}, who?: string): number {
    // queued lines wait for whoever is talking to finish, so nobody is cut off mid sentence
    const wait = o.queue ? Math.max(0, this.talkUntil - this.time) : 0;
    if (wait > 0.05) {
      const dur = this.voices.duration(person, line);
      this.talkUntil = this.time + wait + dur + 0.3;
      this.pendingTimers.push(window.setTimeout(() => this.speakAs(person, line, { ...o, queue: false }, who), wait * 1000));
      return wait + dur;
    }
    const text = lineText(line);
    const per = PERSON_BY_ID[person];
    const name = who ?? per?.name ?? person;
    let dur = this.voices.play(person, line, o);
    if (dur === null) {
      const v = SPEAKER_VOICE[name] ?? { pitch: per?.female ? 190 : 120, radio: !!o.radio };
      dur = this.audio.voice(text, { pitch: v.pitch, radio: !!o.radio, female: per?.female ?? FEMALE_STAFF.has(name), mimic: o.mimic ?? 0 });
    } else {
      this.audio.duckFor(dur);
      if (o.radio) this.audio.radioClick(dur);
      if ((o.mimic ?? 0) > 0) this.audio.mimicUnder(dur, o.mimic!);
    }
    this.hud.subtitle(name, text, Math.max(3200, dur * 1000 + 700));
    this.talkUntil = Math.max(this.talkUntil, this.time + dur + 0.3);
    return dur;
  }
  private talkUntil = 0;

  /** A visitor speaking through the glass. A fake's voice sits a little wrong, more so as it learns. */
  private say(p: Patient, text: string, line?: L, queue = false): number {
    const fake = p.truth === 'understudy';
    const mimic = fake ? (p.archetype === 'voice_mimic' ? 0.8 : Math.min(0.75, 0.12 + this.sim.state.stage * 0.08)) : 0;
    const person = p.castId ?? '';
    if (line && person && this.voices.has(person, line)) return this.speakAs(person, line, { pos: WINDOW_POS, glass: true, mimic, queue }, p.displayName);
    const female = FEMALE_NAMES.has(p.displayName.split(' ')[0] ?? '') || !!PERSON_BY_ID[person]?.female;
    const dur = this.audio.voice(text, { pitch: this.voicePitch(p), radio: false, female, mimic });
    this.hud.subtitle(p.displayName, text, Math.max(3500, dur * 1000 + 600));
    return dur;
  }

  private lookup(): void {
    if (!this.running) return;
    const e = this.sim.lookup();
    if (!e) {
      if (!this.sim.state.powerOn) this.hud.subtitle('Records', 'No power. The screen is dark.', 2500);
      return;
    }
    this.hud.setLedger(e, false, true);
    this.drawCrt(e);
    this.audio.ding();
    this.tutorial.on({ kind: 'lookup' });
  }

  /** X: right up to the glass. The visitor leans in too. Look for the mark, the breath, the pulse. X again to sit back. */
  private face(): void {
    if (!this.running || this.player.mode !== 'desk') return;
    if (this.player.closeup) {
      this.player.closeup = false;
      return;
    }
    const m = this.sim.inspectFace();
    this.player.closeup = true;
    this.player.underDesk = false;
    this.audio.chairCreak();
    if (m) {
      this.hud.logLine('face', `Face: ${m}.`);
      this.tutorial.on({ kind: 'face' });
    }
  }

  private doVerdict(v: Verdict): void {
    if (!this.running) return;
    if (v === 'contain' && !this.sim.state.powerOn) {
      this.hud.subtitle('Trapdoor', 'The trapdoor runs on the mains. With the power out it does nothing.', 2800);
      return;
    }
    if (!this.sim.state.current || this.sim.state.phase !== 'present') {
      if (v === 'contain') this.audio.lever();
      return;
    }
    this.player.closeup = false;
    this.tutorial.on({ kind: 'verdict', v });
    this.sim.verdict(v);
  }

  // ------------------------------------------------------------------ input
  private bindInput(): void {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.input.keys.add(e.code);
      if (e.code === 'F3') {
        e.preventDefault();
        this.perfOn = !this.perfOn;
        if (!this.perfOn) this.hud.perf(null);
      }
      if (e.code === 'KeyM') {
        this.audio.muted = !this.audio.muted;
        this.save.muted = this.audio.muted;
        writeSave(this.save);
      }
      if (e.code === 'KeyH' && this.began && !this.vendOpen) {
        this.hud.toggleHelp();
        this.running = !this.hud.helpOpen && !this.ended;
        return;
      }
      if (this.vendOpen) {
        const n = Number(e.code.replace('Digit', ''));
        const stock = this.sim.vendStock();
        if (n >= 1 && n <= stock.length) document.querySelector<HTMLButtonElement>(`#overlay button[data-buy="${stock[n - 1]}"]`)?.click();
        else if (e.code === 'Escape' || e.code === 'KeyE') this.closeVend();
        return;
      }
      if (!this.running || this.mini) return;
      if (e.code === 'Tab') e.preventDefault();
      this.onKey(e.code);
    });
    window.addEventListener('keyup', (e) => this.input.keys.delete(e.code));
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousedown', (e) => {
      if (e.button === 2) this.input.zoom = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.input.zoom = false;
    });
    window.addEventListener('blur', () => {
      this.input.keys.clear();
      this.input.zoom = false;
    });
    window.addEventListener('mousemove', (e) => {
      this.input.mouseNX = e.clientX / window.innerWidth;
      this.input.mouseNY = e.clientY / window.innerHeight;
      if (document.pointerLockElement === this.canvas) {
        this.input.mouseDX += e.movementX;
        this.input.mouseDY += e.movementY;
      }
    });
    this.canvas.addEventListener('click', () => {
      if (this.camfx.busy) {
        this.camfx.skip();
        return;
      }
      if (!this.running || this.mini) return;
      if (this.player.mode === 'floor') {
        if (document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock?.();
      } else if (this.hovered?.id === 'lever') this.doVerdict('contain');
      else if (this.hovered?.id === 'phone') this.answer();
      else if (this.hovered?.id === 'photo') this.usePhoto();
      else if (this.hovered?.id === 'staff') this.talkToStaff();
    });
    document.addEventListener('pointerlockchange', () => {
      if (this.player.mode === 'floor' && this.running && !this.mini && document.pointerLockElement !== this.canvas) this.pause();
    });
  }

  private onKey(code: string): void {
    const desk = this.player.mode === 'desk';
    if (code === 'Space' && this.call) {
      this.answer();
      return;
    }
    if (this.choiceT > 0 && !desk && (code === 'Digit1' || code === 'Digit2')) {
      this.choiceT = 0;
      this.sim.reportCount(code === 'Digit1');
      if (code === 'Digit2') this.hud.subtitle('', 'You say nothing. Pell keeps counting.', 3000);
      return;
    }
    if (desk) {
      const qs: Record<string, QuestionId> = { Digit1: 'name', Digit2: 'dob', Digit3: 'sender', Digit4: 'kin', Digit5: 'memory' };
      if (qs[code]) this.ask(qs[code]);
      else if (code === 'KeyZ') this.lookup();
      else if (code === 'KeyX') this.face();
      else if (code === 'KeyC') {
        this.player.underDesk = !this.player.underDesk;
        if (this.player.underDesk) this.player.closeup = false;
        this.audio.chairCreak();
      }
      else if (code === 'KeyA') this.doVerdict('admit');
      else if (code === 'KeyO') this.doVerdict('observe');
      else if (code === 'KeyR') this.doVerdict('refuse');
      else if (code === 'KeyT' || code === 'KeyL') this.doVerdict('contain');
      else if (code === 'Tab') this.hud.toggleAside();
      else if (code === 'KeyQ') {
        if (this.tutorial.active) return; // Pell is still talking you through the window
        this.player.stand();
        this.hud.setMode(false);
        this.canvas.requestPointerLock?.();
      }
    } else {
      if (code === 'KeyF') {
        this.flashlightOn = !this.flashlightOn;
        this.sim.setFlashlight(this.flashlightOn);
        this.audio.click();
      } else if (code === 'KeyE') this.interact();
    }
  }
  private flashlightOn = false;

  private interact(): void {
    const h = this.hovered;
    if (!h) return;
    const env = this.env;
    if (h.id === 'door') {
      const d = env.boothDoor;
      d.open = !d.open;
      if (d.open) this.physics.removeCollider(d.collider);
      else d.collider = this.physics.addStaticBox(1.8, 1.05, 0.85, 0.04, 1.05, 0.45);
      this.audio.creak({ x: 1.8, y: 1, z: 0.9 });
    } else if (h.id === 'prop' && h.prompt === 'Bucket') {
      if (!this.hasMop) {
        this.hasMop = true;
        this.mopMesh.visible = true;
        this.audio.scrub();
        this.hud.subtitle('', 'You take the mop out of the bucket. The water is pink.', 3000);
      }
    } else if (h.id === 'phone') {
      this.answer();
    } else if (h.id === 'photo') {
      this.usePhoto();
    } else if (h.id === 'chair') {
      this.mopMesh.visible = false;
      this.hasMop = this.sim.todoItem('mop')?.done ? false : this.hasMop;
      this.player.sit();
      document.exitPointerLock?.();
      this.hud.setMode(true);
      this.flashlightOn = false;
      this.sim.setFlashlight(false);
    } else if (h.id === 'lever') {
      this.doVerdict('contain');
    } else if (h.id === 'cabinet') {
      const t = this.sim.todoItem('file');
      if (!t || t.done) {
        this.hud.subtitle('Filing cabinet', 'Last week is filed. One drawer will not quite shut.', 2600);
        return;
      }
      this.openMini();
      this.mini = new FilingGame(
        this.root,
        (k) => (k === 'drawer' ? this.audio.clack() : k === 'paper' ? this.audio.paper() : k === 'sting' ? this.audio.glitch() : this.audio.click()),
        (finished) => {
          this.closeMini();
          if (finished) {
            this.sim.completeTask('file');
            this.pendingTimers.push(window.setTimeout(() => this.audio.chairCreak(), 900));
          }
        },
      );
    } else if (h.id === 'wardslot') {
      this.useWardSlot();
    } else if (h.id === 'vending') {
      this.openVend();
    } else if (h.id === 'staff') {
      this.talkToStaff();
    }
  }

  // ------------------------------------------------------------------ jobs away from the glass
  private mini: { close(finished: boolean): void } | null = null;
  private mopProgress = 0;
  private mopScared = false;
  private scrubT = 0;
  private lastTally = 0;
  private stain!: THREE.Mesh;
  private get root(): HTMLElement {
    return this.canvas.parentElement as HTMLElement;
  }

  private openMini(): void {
    document.exitPointerLock?.();
    this.input.keys.clear();
  }

  private closeMini(): void {
    this.mini = null;
    this.input.keys.clear();
    if (this.running && this.player.mode === 'floor') this.hud.subtitle('', 'Click to carry on.', 2500);
  }

  private wardEnding(): Ending {
    const s = this.sim.state;
    return s.motherTaken ? 'taken' : s.score.admittedUnderstudies > 0 ? 'crowded' : 'clean';
  }

  private useWardSlot(): void {
    const c1 = this.sim.todoItem('count1')!;
    const dawn = this.sim.todoItem('count_dawn')!;
    const mode = dawn.shown && !dawn.done ? 'dawn' : c1.shown && !c1.done && !c1.missed ? 'count1' : null;
    if (!mode) {
      this.hud.subtitle('Ward B', 'The slot is shut from the inside. You can hear eleven people breathing. You think it is eleven.', 3800);
      return;
    }
    this.openMini();
    const count = this.sim.wardCount();
    // while your eye is at the slot, something comes up the corridor behind you
    if (mode === 'count1' && (count.extras > 0 || this.sim.state.stage >= 2)) this.sim.summonStalker(13.5, 70);
    this.mini = new WardView(
      this.root,
      mode,
      count,
      this.wardEnding(),
      (k) => {
        if (k === 'tick') this.audio.click();
        else if (k === 'scare') {
          this.audio.glitch();
          this.audio.stareHit();
        } else if (k === 'breath') this.audio.breathBehind();
        else this.audio.glitch();
      },
      (finished, tally) => {
        this.closeMini();
        if (!finished) return;
        this.lastTally = tally;
        this.sim.completeTask(mode === 'dawn' ? 'count_dawn' : 'count1');
        if (mode === 'dawn') this.sim.finish();
      },
      this.motherReveal(),
    );
  }

  /** Her face, painted the way the Understudy wears it. Used once, at the Ward B slot. */
  private motherReveal(): HTMLCanvasElement {
    const look = { female: true, age: 64, skin: [236, 204, 180] as [number, number, number], hair: 'bun', hairColor: '#b8b4aa', eye: '#2f4a6a', glasses: false, stubble: false };
    const fake = { truth: 'understudy', hue: 0.31, faceMark: 'a freckle under the left eye' } as Patient;
    const t = drawFace(look, fake, 7, 'reveal');
    const img = t.image as HTMLCanvasElement;
    t.dispose();
    return img;
  }

  private refreshTaskLine(items: TodoItem[]): void {
    const open = items.filter((t) => t.shown && !t.done && !t.missed);
    if (this.sim.state.powerOn || !this.sim.state.breakerTripped) this.hud.setTask(open.length ? `To do: ${open.map((t) => { const parts = t.text.split('. '); return (parts[0].length < 16 ? parts.slice(0, 2).join('. ') : parts[0]).replace(/\.$/, '').toLowerCase(); }).join('; ')}.` : '');
  }

  /** The stain, the Ward B sign and slot, and the cabinet's hit box. Props only, at the task spots. */
  private buildTaskProps(): void {
    const env = this.env;
    const stainMat = new THREE.MeshLambertMaterial({ map: stainTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.stain = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85), stainMat);
    this.stain.rotation.x = -Math.PI / 2;
    this.stain.position.set(STAIN_POS.x + 0.35, 0.004, STAIN_POS.z);
    this.stain.userData.interact = { id: 'stain', prompt: 'Stain', range: 2.2 } satisfies Interact;
    env.scene.add(this.stain);
    const hit = (id: Interact['id'], w: number, h: number, d: number, x: number, y: number, z: number, range: number): void => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
      m.position.set(x, y, z);
      m.userData.interact = { id, prompt: id, range } satisfies Interact;
      env.scene.add(m);
      env.interactables.push(m);
    };
    env.interactables.push(this.stain);
    hit('cabinet', 0.6, 1.25, 0.7, -1.45, 0.6, 1.4, 2.2);
    hit('wardslot', 0.9, 2.0, 0.25, WARD_B_DOOR.x, 1.05, 1.72, 2.4);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.155), new THREE.MeshLambertMaterial({ map: signTexture('WARD  B') }));
    sign.position.set(WARD_B_DOOR.x, 2.28, 1.775);
    sign.rotation.y = Math.PI;
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.03), new THREE.MeshLambertMaterial({ color: 0x0a0a0b }));
    slot.position.set(WARD_B_DOOR.x, 1.55, 1.78);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.01), env.mats.brass);
    plate.position.set(WARD_B_DOOR.x, 1.55, 1.787);
    env.scene.add(sign, slot, plate);
  }

  // ------------------------------------------------------------------ drawing
  private drawCrt(e?: import('./sim/types').RegistryEntry): void {
    const s = this.env.crt;
    const g = s.ctx;
    g.fillStyle = '#031008';
    g.fillRect(0, 0, 512, 384);
    if (this.sim.state.powerOn) {
      g.fillStyle = '#62ff9a';
      g.font = '30px VT323, "Courier New", monospace';
      g.fillText('VESPER HOLLOW LEDGER', 24, 40);
      g.font = '26px VT323, "Courier New", monospace';
      if (e) {
        const rows = [`REC  ${e.id}`, `NAME ${e.name}`, `BORN ${e.dob}`, `REF  ${e.sender}`, `KIN  ${e.kin}`, `BAND ${e.wristband}`, `FACE ${e.photoMark}`];
        if (e.note) rows.push(`NOTE ${e.note}`);
        rows.forEach((r, i) => g.fillText(r.slice(0, 34), 24, 84 + i * 30));
      } else {
        g.fillText('READY. NO RECORD OPEN.', 24, 90);
        g.fillText(formatClock(this.sim.state.minute), 24, 130);
      }
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = 0; y < 384; y += 3) g.fillRect(0, y, 512, 1);
    }
    s.touch();
  }

  private drawSlip(p: Patient | null): void {
    const s = this.env.slip;
    const g = s.ctx;
    g.fillStyle = '#e6dcc0';
    g.fillRect(0, 0, 256, 320);
    if (p) {
      g.fillStyle = '#2a2018';
      g.font = '15px "Special Elite", "Courier New", monospace';
      g.fillText('ADMISSION SLIP  7-B', 40, 28);
      g.font = '14px "Special Elite", "Courier New", monospace';
      const rows = [p.docs.slipName, p.docs.slipDob, p.docs.slipSender, p.docs.wristband, p.docs.photoMark];
      const lab = ['Name', 'Born', 'By', 'Band', 'Photo'];
      rows.forEach((r, i) => {
        g.fillStyle = '#6b5a45';
        g.font = 'italic 12px "IM Fell English", Georgia, serif';
        g.fillText(lab[i], 14, 66 + i * 44);
        g.fillStyle = '#16192a';
        g.font = '14px "Special Elite", "Courier New", monospace';
        g.fillText(r.slice(0, 26), 14, 84 + i * 44);
      });
    }
    s.touch();
  }

  // ------------------------------------------------------------------ interaction raycast
  private pickInteract(): Interact | null {
    const cam = this.player.camera;
    if (this.player.mode === 'desk') {
      this.ray.setFromCamera(new THREE.Vector2(this.input.mouseNX * 2 - 1, -(this.input.mouseNY * 2 - 1)), cam);
    } else {
      this.ray.setFromCamera(new THREE.Vector2(0, 0), cam);
    }
    const hits = this.ray.intersectObjects(this.env.interactables, false);
    for (const h of hits) {
      const it = h.object.userData.interact as Interact | undefined;
      if (it && h.distance <= it.range) {
        if (it.id === 'staff' && this.staffPhase !== 'present') continue;
        if (this.player.mode === 'desk' && it.id !== 'lever' && it.id !== 'phone' && it.id !== 'photo' && it.id !== 'staff') continue;
        return it;
      }
    }
    return null;
  }

  // ------------------------------------------------------------------ frame
  private frame(nowMs: number): void {
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.1, (nowMs - (this.lastMs || nowMs)) / 1000);
    this.lastMs = nowMs;
    this.frameMs += (dt * 1000 - this.frameMs) * 0.1;
    this.time += dt;
    this.debug.frames++;
    this.post.adapt(dt * 1000);

    const sim = this.sim;
    if (this.dying > 0) this.deathFrame(dt);
    this.camfx.update(dt);
    if (this.running) {
      for (let i = 0; i < this.speedUp; i++) sim.tick(dt);
      const steps = this.clock.advance(dt);
      for (let i = 0; i < steps; i++) this.physics.step();
      this.mopTick(dt);
      this.player.update(dt, this.input, document.pointerLockElement === this.canvas);
      this.tutorial.update(dt);
      this.tickHauntings(dt);
      // leaning in counts once you have held it for a moment
      this.leanT = this.player.mode === 'desk' && this.player.zoomed && !this.player.closeup ? this.leanT + dt : 0;
      if (this.leanT > 0.7) this.tutorial.on({ kind: 'lean' });
    } else {
      this.player.update(this.scare ? dt : 0, this.input, false);
    }
    this.tickStaff(dt);
    const desk = this.player.mode === 'desk';
    this.hud.setUnder(desk && this.player.ducked);
    this.hud.setCloseup(desk && this.player.closeup);
    this.view.closeup = desk && this.player.closeup;
    // the horizon tips as your nerves go, and when something is holding your eye
    const tilt = Math.pow(1 - sim.state.sanity / 100, 2) * 0.09 + (sim.state.stare ? 0.035 : 0) + (this.backFake ? 0.04 : 0);
    this.player.dutch += (tilt * Math.sin(this.time * 0.37 + 1) - this.player.dutch) * Math.min(1, dt * 0.8);

    const s = sim.state;
    const seated = this.player.mode === 'desk';
    sim.setDuck(this.player.ducked);
    sim.setGaze(seated && this.player.zoomed && s.phase === 'present');
    const pace = sim.director.pace;
    if (pace !== this.lastPace) {
      if (pace === 'peak' && this.audio.ready) this.audio.riser(2.4);
      this.lastPace = pace;
    }
    const f = this.player.feet;
    sim.setZone(f.x > 12.4 ? 'breaker' : f.x > 2.0 ? 'corridor' : 'booth');
    this.feedStalker(dt);

    // patient phase transitions
    if (s.phase !== this.lastPhase) {
      if (s.phase === 'present' && s.current) this.onPatientPresent(s.current);
      this.lastPhase = s.phase;
    }
    this.view.update(dt, this.scare ? 'present' : s.phase, this.player.camera.position, s.powerOn && this.sim.director.quiet);
    this.animateWorld(dt);
    this.updateHud();

    // audio
    if (this.audio.ready) {
      const fwd = this.player.forward();
      this.audio.setListener(this.player.camera.position, fwd);
      this.audio.update(dt, {
        tension: sim.director.tension,
        fear: s.fear,
        zone: s.zone,
        power: s.powerOn,
        quiet: sim.director.quiet || s.stare,
        sanity: s.sanity,
        rainGain: 0.55,
      });
      if (this.player.stepDelta > 0) this.audio.walk(this.player.stepDelta, this.player.sprinting, this.player.ducked);
    }

    this.tickFearFx(dt);
    this.hovered = this.running ? this.pickInteract() : null;
    this.updatePrompt(dt);

    this.env.update(dt);
    const d = sim.distortion;
    const dark = !s.powerOn ? 1.5 : 1.0;
    this.post.render(this.env.scene, this.player.camera, this.time, d, dark, this.flashV * 0.25, 0.12 + (1 - s.sanity / 100) * 0.4);

    if (this.perfOn) this.perfTick(dt);
  }
  private lastMs = 0;

  // ------------------------------------------------------------------ the phone, the photo, the fear events
  private call: { speak: () => void; rings: number; t: number } | null = null;
  private hasMop = false;
  private mopMesh!: THREE.Group;
  private lampOutT = 0;
  private dawnT = 0;
  private choiceT = 0;
  private echo: { t: number; stepT: number; still: number; real: boolean; done: boolean } | null = null;
  private figureFarT = 0;
  private crtOverrideT = 0;

  /** The phone rings until you pick it up, or it gives up. A call you miss is gone. */
  private ring(speak: () => void): void {
    if (this.call) {
      this.call.speak = speak;
      return;
    }
    this.call = { speak, rings: 0, t: 0 };
    this.audio.phoneRing();
    this.flickerPhone = 2.5;
    this.hud.subtitle('Desk phone', 'The phone is ringing. Click it or press Space at the desk to answer.', 3000);
  }

  private answer(): void {
    if (!this.call) return;
    const inBooth = this.player.feet.x < 1.85;
    if (!inBooth) return;
    const c = this.call;
    this.call = null;
    this.audio.click();
    c.speak();
  }

  private usePhoto(): void {
    const ph = this.env.desk.photo;
    const down = Math.abs(ph.rotation.x) > 1;
    ph.rotation.set(-0.15, 0.25, 0);
    this.audio.paper();
    this.hud.subtitle(
      'The photograph',
      down ? 'Somebody laid it face down. Mum and me, Margate, 1949. You were six. She still knew your name then.' : 'Mum and me, Margate, 1949. You were six. She still knew your name then.',
      5000,
    );
  }

  private onFear(e: import('./sim/fear').FearEvent, real: boolean): void {
    const cam = this.player.camera.position;
    const st = this.sim.stalker;
    switch (e) {
      case 'rat':
        this.audio.scratch({ x: cam.x + 1.2, y: 0.1, z: 1.6 });
        this.pendingTimers.push(window.setTimeout(() => this.audio.tone2(2600, 0.08), 600));
        break;
      case 'pipe_burst':
        this.audio.pipeKnock({ x: cam.x + 2, y: 2.7, z: 0.3 });
        this.audio.hiss({ x: cam.x + 2, y: 2.7, z: 0.3 });
        break;
      case 'pell_false_alarm':
        for (let i = 0; i < 7; i++) this.pendingTimers.push(window.setTimeout(() => this.audio.distantStep({ x: 13.5 - i * 0.6, y: 0, z: 0.9 }), i * 520));
        this.pendingTimers.push(window.setTimeout(() => this.speakAs('pell', COMMON.false_alarm, { pos: { x: 13, y: 1.6, z: 0.9 } }), 4200));
        break;
      case 'echo_steps':
        this.echo = { t: 0, stepT: 0.4, still: 0, real, done: false };
        break;
      case 'run_far':
        for (let i = 0; i < 9; i++) this.pendingTimers.push(window.setTimeout(() => this.audio.distantStep({ x: 13.6, y: 0, z: 0.9 }), i * 170));
        break;
      case 'figure_far':
        if (!st.active) {
          this.figureFarT = 1.6;
          this.flickerT = Math.max(this.flickerT, 1.6);
          this.audio.presence();
        }
        break;
      case 'breath_wall':
        this.audio.breathBehind();
        break;
      case 'mug_moved': {
        const m = this.env.desk.mug;
        m.position.x += 0.22;
        m.rotation.y += 1.2;
        break;
      }
      case 'terminal_line':
        this.crtOverrideT = 5;
        this.drawCrtLine('WREN, ______   LET IN 22:00   WARD B BED 10');
        this.audio.ding();
        break;
      case 'photo_down':
        this.env.desk.photo.rotation.set(-Math.PI / 2 + 0.02, 0.25, 0);
        break;
      case 'dead_line_call':
        this.ring(() => {
          this.audio.breathBehind();
          this.pendingTimers.push(window.setTimeout(() => this.speakAs('officer', COMMON.dead_you, { radio: true, mimic: 0.6 }, 'Your own voice'), 2200));
          this.pendingTimers.push(window.setTimeout(() => this.speakAs(this.night >= 5 ? 'imogen' : 'pell', COMMON.dead_pell, { radio: true }), 9000));
        });
        break;
      case 'lamp_out':
        this.lampOutT = 4;
        this.audio.powerDown();
        break;
      case 'door_knock':
        this.audio.knock({ x: 1.85, y: 1.3, z: 0.85 }, 3);
        break;
    }
  }

  private drawCrtLine(line: string): void {
    const s = this.env.crt;
    const g = s.ctx;
    g.fillStyle = '#031008';
    g.fillRect(0, 0, 512, 384);
    g.fillStyle = '#62ff9a';
    g.font = '26px VT323, "Courier New", monospace';
    g.fillText('RECORD OPENED: 1 OF 1', 24, 60);
    g.fillText(line, 24, 120);
    s.touch();
  }

  /** Runs the presentation side of the fear events, the ringing phone and the report choice. */
  private tickFearFx(dt: number): void {
    if (!this.running) return;
    if (this.dawnT > 0) this.dawnT += dt;
    this.choiceT = Math.max(0, this.choiceT - dt);
    if (this.crtOverrideT > 0) {
      this.crtOverrideT -= dt;
      if (this.crtOverrideT <= 0) this.drawCrt();
    }
    if (this.call) {
      this.call.t += dt;
      if (this.call.t > 2.8) {
        this.call.t = 0;
        this.call.rings++;
        if (this.call.rings >= 4) {
          this.call = null;
          this.hud.subtitle('Desk phone', 'It stops ringing. Whatever they wanted to tell you, you missed it.', 3500);
        } else {
          this.audio.phoneRing();
          this.flickerPhone = 2.5;
        }
      }
    }
    // steps behind you that keep time with yours, and take one more step after you stop
    const e = this.echo;
    if (e && !e.done) {
      e.t += dt;
      const moving = this.player.stepDelta > 0.0005;
      const cam = this.player.camera.position;
      const behind = { x: cam.x - this.player.forward().x * 3, y: 0, z: cam.z - this.player.forward().z * 3 };
      if (moving) {
        e.still = 0;
        e.stepT -= dt;
        if (e.stepT <= 0) {
          e.stepT = 0.55;
          this.audio.distantStep(behind);
        }
      } else {
        e.still += dt;
        if (e.still > 0.6) {
          this.audio.distantStep(behind); // one more, after you stopped
          e.done = true;
        }
      }
      if (e.t > 9 && !e.done) {
        e.done = true;
      }
    }
    if (this.figureFarT > 0) {
      this.figureFarT -= dt;
      const on = this.figureFarT > 0 && Math.sin(this.time * 40) > -0.6;
      this.creature.update(dt, on, 13.6, 0.95, 'listen', this.player.camera.position);
    }
  }

  /** Tells the sim where you are and how loud you are being, and moves the tall one. */
  private feedStalker(dt: number): void {
    const pl = this.player;
    const f = pl.feet;
    const moving = pl.stepDelta > 0.0005 && pl.mode === 'floor';
    const noise = !moving ? 0 : pl.sprinting ? 1 : pl.ducked ? 0.02 : 0.38;
    const range = !moving ? 0 : pl.sprinting ? 13 : pl.ducked ? 1.5 : 6;
    const st = this.sim.stalker;
    let torchOnIt = false;
    if (this.flashlightOn && st.active && pl.mode === 'floor') {
      const to = new THREE.Vector3(st.x - pl.camera.position.x, 1.9 - pl.camera.position.y, st.z - pl.camera.position.z);
      const d = to.length();
      torchOnIt = d < 7 && to.normalize().dot(pl.forward()) > 0.93;
    }
    this.sim.setPlayer({ x: f.x, z: f.z, noise, noiseRange: range, torchOnIt, inBooth: f.x < 1.85, doorClosed: !this.env.boothDoor.open });
    if (this.figureFarT <= 0) this.creature.update(dt, st.active, st.x, st.z, st.mode, pl.camera.position);
    if (st.active && st.mode !== 'door') {
      this.stepT -= dt * (st.mode === 'hunt' ? 2.6 : 1);
      if (this.stepT <= 0) {
        this.stepT = 0.85;
        if (st.mode !== 'listen') this.audio.creatureStep({ x: st.x, y: 0, z: st.z });
      }
    }
  }

  /** You lose the night. A short, earned scare, then the sheet, then the whole shift starts again. */
  private die(cause: DeathCause): void {
    if (this.deathCause) return;
    this.mini?.close(false);
    this.deathCause = cause;
    this.running = false;
    this.ended = true;
    document.exitPointerLock?.();
    this.audio.stopVoice();
    this.audio.deathSting();
    this.dying = cause === 'nerves' ? 2.5 : 1.3;
    const clock = formatClock(this.sim.state.minute);
    this.pendingTimers.push(
      window.setTimeout(() => {
        this.hud.overlay(deathHtml(cause, clock));
        this.bindRestart();
      }, this.dying * 1000),
    );
  }

  private bindRestart(): void {
    for (const n of document.querySelectorAll<HTMLButtonElement>('#overlay button[data-next]')) n.onclick = () => this.goNight(Math.min(NIGHTS.length, this.night + 1));
    const b = document.querySelector<HTMLButtonElement>('#overlay button[data-restart]');
    if (!b) return;
    b.onclick = () => {
      if (this.night === NIGHTS.length && this.ended && !this.deathCause) return this.goNight(1);
      const qs = new URLSearchParams(location.search);
      qs.set('night', String(this.night));
      qs.set('autostart', '1');
      qs.delete('seed');
      location.search = qs.toString();
    };
  }

  /** The last second of your life, drawn in the world: it is in your face. */
  private deathFrame(dt: number): void {
    this.dying -= dt;
    const cam = this.player.camera;
    const fwd = this.player.forward();
    if (this.deathCause === 'stalker') {
      const st = this.sim.stalker;
      const target = cam.position.clone().add(fwd.clone().multiplyScalar(0.55));
      st.x += (target.x - st.x) * Math.min(1, dt * 12);
      st.z += (target.z - st.z) * Math.min(1, dt * 12);
      this.creature.update(dt, true, st.x, st.z, 'hunt', cam.position);
      this.creature.group.position.y = cam.position.y - this.creature.faceHeight; // its face level with yours
      this.flashV = Math.random() * 0.4;
    } else if (this.deathCause === 'breach') {
      const g = this.view.group;
      g.position.lerp(cam.position.clone().add(fwd.clone().multiplyScalar(0.45)).setY(cam.position.y - 1.55), Math.min(1, dt * 10));
      this.view.revealing = 1;
      this.flashV = Math.random() * 0.4;
    }
  }

  /** Mopping: hold E on the stain and scrub with the mouse. The view stays put while you scrub. */
  private mopTick(dt: number): void {
    const t = this.sim.todoItem('mop');
    if (!t || t.done || !this.hasMop || this.hovered?.id !== 'stain' || !this.input.keys.has('KeyE') || this.player.mode !== 'floor') return;
    const motion = Math.abs(this.input.mouseDX) + Math.abs(this.input.mouseDY);
    this.input.mouseDX = 0;
    this.input.mouseDY = 0;
    if (motion < 2) return;
    this.mopProgress = Math.min(1, this.mopProgress + Math.min(0.03, motion * 0.0006));
    (this.stain.material as THREE.MeshLambertMaterial).opacity = 1 - this.mopProgress * 0.85;
    this.scrubT -= dt;
    if (this.scrubT <= 0) {
      this.scrubT = 0.28;
      this.audio.scrub();
    }
    if (this.mopProgress > 0.6 && !this.mopScared) {
      // somebody on the other side of the Ward B door tries the handle while your back is to it
      this.mopScared = true;
      this.audio.knobRattle(WARD_B_DOOR);
      this.figureT = 1.6;
    }
    if (this.mopProgress >= 1) {
      this.sim.completeTask('mop');
      this.hud.subtitle('Your own handwriting', 'Not rust. Rust does not have fingers. The trail goes under the Ward B door.', 4200);
    }
  }

  private onPatientPresent(p: Patient): void {
    this.hud.showPatient(p);
    this.drawSlip(p);
    this.drawCrt();
    const line = p.lines?.greet ?? p.greet ?? 'Evening.';
    const dur = this.say(p, lineText(line), p.lines?.greet, true);
    this.view.speaking = dur;
    if (p.tutorial) this.tutorial.start(dur);
    else if (!this.tutorial.done && !this.tutorial.active && this.night === 1) this.tutorial.done = true;
    // the next answers are fetched now so they play on time
    if (p.castId && p.lines) for (const q of Object.values(p.lines.say)) this.voices.preload(p.castId, q);
  }

  private animateWorld(dt: number): void {
    const env = this.env;
    const s = this.sim.state;
    const L = env.lights;
    // lamp: honest early, unreliable once the Understudy has learned
    let lampMul = s.powerOn ? 1 : 0;
    if (this.flickerT > 0) {
      this.flickerT -= dt;
      lampMul *= Math.random() > 0.45 ? 1 : 0.08;
    } else if (s.powerOn && s.stage >= 3) {
      lampMul *= 0.92 + Math.sin(this.time * 31) * 0.05 * (s.stage - 2);
    }
    if (this.lampOutT > 0) {
      this.lampOutT -= dt;
      lampMul = 0;
    }
    L.lamp.intensity = 55 * lampMul;
    (L.lampBulb.material as THREE.MeshBasicMaterial).color.setScalar(s.powerOn ? 1 : 0.05).multiply(new THREE.Color(1, 0.85, 0.6));
    L.boothFill.intensity = (s.powerOn ? 7 : 0) * (this.flickerT > 0 ? lampMul : 1);
    L.crt.intensity = s.powerOn ? 2.2 : 0;
    L.hall.intensity = (s.powerOn ? 34 : 0) * (this.flickerT > 0 ? 0.5 + 0.5 * lampMul : 1);
    L.hemi.intensity = s.powerOn ? 0.55 : 0.22;
    const emergency = !s.powerOn;
    (this.crack.material as THREE.MeshBasicMaterial).opacity = this.crackLevel * 0.9;
    const st = this.sim.stalker;
    L.corridor.forEach((l, i) => {
      // the corridor: one tube is dead, the others buzz and stutter, and they stutter hard when it is near
      const near = st.active ? Math.max(0, 1 - Math.abs(l.position.x - st.x) / 3.5) : 0;
      let flick = s.zone !== 'booth' && this.flickerT > 0 ? (Math.random() > 0.5 ? 1 : 0.1) : 1;
      if (near > 0 && Math.random() < near * 0.5) flick *= 0.05;
      if (Math.sin(this.time * 0.37 + i * 2.1) > 0.97) flick *= 0.2;
      const dead = i === 1 ? 0 : 1;
      // dawn: the tubes die one after another from the far end
      if (this.dawnT > 0 && l.position.x > 14 - this.dawnT * 1.3) flick *= Math.random() < 0.08 ? 0.6 : 0.02;
      l.intensity = emergency ? (0.9 + Math.sin(this.time * 2 + i) * 0.4) * (1 - near * 0.8) : 3.2 * flick * dead;
      l.color.set(emergency ? 0xff3a2a : 0xa9d8c4);
      (L.corridorBulbs[i].material as THREE.MeshBasicMaterial).color.set(emergency ? 0x5a0d08 : 0xcfeee0);
    });

    // the passage bulbs and the machine run off the same mains
    const ax = this.env.annex;
    ax.passageLights.forEach((l, i) => {
      const buzz = Math.sin(this.time * 0.6 + i * 3) > 0.985 ? 0.15 : 1;
      l.intensity = s.powerOn ? 2.4 * buzz * (this.flickerT > 0 ? lampMul : 1) : 0.18;
      l.color.set(s.powerOn ? 0xd8e4c0 : 0xff3a2a);
    });
    if (Math.floor(s.minute) !== this.lastClockMin) {
      this.lastClockMin = Math.floor(s.minute);
      drawHallClock(ax.hallClock, s.minute);
    }

    // lightning
    this.lightningT -= dt;
    if (this.lightningT <= 0) {
      this.flashV = 1;
      this.lightningT = 18 + Math.random() * 30;
      const delay = 400 + Math.random() * 1600;
      this.pendingTimers.push(window.setTimeout(() => this.audio.thunder(), delay));
    }
    this.flashV = Math.max(0, this.flashV - dt * 3.5);
    const flicker = this.flashV > 0.2 ? 1 : this.flashV * 3;
    L.flash.intensity = flicker * 2.2;
    (env.outside.material as THREE.MeshBasicMaterial).color.setRGB(0.1 + flicker * 0.5, 0.15 + flicker * 0.55, 0.22 + flicker * 0.8);

    // hall doors follow the patient
    const open = s.phase === 'approaching' && this.view.progress < 0.9 ? 1 : 0;
    this.doorOpen += (open - this.doorOpen) * Math.min(1, dt * 4);
    env.hallDoorL.position.x = -0.35 - this.doorOpen * 0.75;
    env.hallDoorR.position.x = 0.35 + this.doorOpen * 0.75;

    // lever and breaker
    const target = this.leverT > 0 ? -0.7 : 0.7;
    this.leverT = Math.max(0, this.leverT - dt);
    env.leverArm.rotation.z += (target - env.leverArm.rotation.z) * Math.min(1, dt * 8);
    env.breakerLever.rotation.x += ((s.powerOn ? -0.9 : 0.9) - env.breakerLever.rotation.x) * Math.min(1, dt * 6);
    (env.breakerLamp.material as THREE.MeshBasicMaterial).color.set(s.powerOn ? 0x30ff60 : 0xff2010);
    this.flickerPhone = Math.max(0, this.flickerPhone - dt);
    (env.phoneLed.material as THREE.MeshBasicMaterial).color.set(this.flickerPhone > 0 && Math.sin(this.time * 18) > 0 ? 0xff6a10 : 0x331100);

    // the figure that should not be there
    this.figureT = Math.max(0, this.figureT - dt);
    (env.figure.material as THREE.MeshBasicMaterial).opacity = Math.min(0.9, this.figureT * 1.2);

    // flashlight follows the camera
    const cam = this.player.camera;
    this.flashlight.position.copy(cam.position);
    this.flashlight.target.position.copy(cam.position).add(this.player.forward().multiplyScalar(3));
    this.flashlight.intensity = this.flashlightOn && this.player.mode === 'floor' ? 28 : 0;
  }
  private doorOpen = 0;
  private lastClockMin = -1;
  private scare = false;

  private updateHud(): void {
    const s = this.sim.state;
    this.hud.setClock(s.minute);
    this.hud.setSanity(s.sanity);
    this.hud.setStamina(this.player.stamina, this.player.mode === 'floor');
  }

  private updatePrompt(dt: number): void {
    const s = this.sim.state;
    const h = this.hovered;
    const heldE = this.input.keys.has('KeyE');
    if (this.player.mode === 'desk') {
      this.hud.prompt(h?.id === 'lever' ? 'Click: open the trapdoor under them' : h?.id === 'phone' ? (this.call ? 'Click: answer the phone' : 'The desk phone') : h?.id === 'photo' ? 'Click: pick up the photograph' : h?.id === 'staff' ? 'Click: talk to them' : null);
      this.breakerHold = 0;
      return;
    }
    if (h?.id === 'breaker') {
      if (!s.powerOn) {
        this.breakerHold = heldE ? this.breakerHold + dt : 0;
        this.hud.prompt('Hold E: reset the fuses', Math.min(1, this.breakerHold / 1.3));
        if (this.breakerHold >= 1.3) {
          this.sim.restorePower();
          this.breakerHold = 0;
        }
      } else this.hud.prompt('The fuses are holding');
      return;
    }
    this.breakerHold = 0;
    if (h?.id === 'stain') {
      const t = this.sim.todoItem('mop');
      if (!t || t.done) this.hud.prompt('It has dried into the grout');
      else if (!this.hasMop) this.hud.prompt('You need the mop. It is in the bucket against the wall.');
      else this.hud.prompt('Hold E and move the mouse: mop', this.mopProgress);
      return;
    }
    if (h?.id === 'prop' && h.prompt === 'Bucket') {
      this.hud.prompt(this.hasMop ? 'The bucket' : 'E: take the mop');
      return;
    }
    if (h?.id === 'phone' || h?.id === 'photo') {
      this.hud.prompt(h.id === 'phone' ? (this.call ? 'E: answer the phone' : 'The desk phone') : 'E: pick up the photograph');
      return;
    }
    if (h?.id === 'cabinet') {
      this.hud.prompt('E: file last week\'s slips');
      return;
    }
    if (h?.id === 'wardslot') {
      this.hud.prompt('E: look through the slot in the Ward B door');
      return;
    }
    if (h?.id === 'vending') {
      this.hud.prompt(`E: the vending machine (${this.sim.state.tokens} token${this.sim.state.tokens === 1 ? '' : 's'})`);
      return;
    }
    if (h?.id === 'staff') {
      this.hud.prompt(`E: talk to ${PERSON_BY_ID[this.staffTalk?.person ?? '']?.name ?? 'them'}`);
      return;
    }
    if (h?.id === 'door') this.hud.prompt(`E: ${this.env.boothDoor.open ? 'close' : 'open'} the booth door`);
    else if (h?.id === 'chair') this.hud.prompt('E: sit at the desk');
    else if (h?.id === 'lever') this.hud.prompt('E: open the trapdoor');
    else this.hud.prompt(null);
  }

  private perfTick(dt: number): void {
    this.perfAcc += dt;
    if (this.perfAcc < 0.5) return;
    this.perfAcc = 0;
    const i = this.renderer.info;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    this.hud.perf(
      [
        `fps ${(1000 / this.frameMs).toFixed(0)}  frame ${this.frameMs.toFixed(1)}ms`,
        `scale ${this.post.scale.toFixed(2)}  calls ${i.render.calls}  tris ${i.render.triangles}`,
        `geo ${i.memory.geometries}  tex ${i.memory.textures}  prog ${i.programs?.length ?? 0}`,
        mem ? `heap ${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB` : 'heap n/a',
        `tension ${this.sim.director.tension.toFixed(2)} ${this.sim.director.pace}`,
        `sanity ${this.sim.state.sanity.toFixed(0)} fear ${this.sim.state.fear.toFixed(2)} stage ${this.sim.state.stage}`,
      ].join('\n'),
    );
  }
}
