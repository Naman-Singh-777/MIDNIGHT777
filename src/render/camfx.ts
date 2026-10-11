import * as THREE from 'three';
import type { PlayerController } from '../player/controller';

/**
 * Short camera moves, taken from the horror shot list (docs: HORROR_SHOTS):
 *  - vertigo: the dolly zoom. The camera moves toward a face while the lens widens, so the face holds its size
 *    and the room behind it stretches away. Used when something you let in stops at the window behind your chair.
 *  - whip: a fast turn to a sound behind you, a blur of air, and back.
 *  - follow: a slow pan after someone walking out of the hall toward the admissions door.
 *  - orbit: the unbroken 360 degree pan at the start of a night. On the second time round, something has changed.
 *  - lunge: the last frame of the demo night. It turns to the lens and comes through it.
 * Every move is short and blends in and out of the player's own view. A click skips it.
 */
type Shot =
  | { kind: 'vertigo'; t: number; dur: number; face: THREE.Vector3; from: THREE.Vector3; fov0: number; roll: number }
  | { kind: 'whip'; t: number; dur: number; at: THREE.Vector3 }
  | { kind: 'follow'; t: number; dur: number; target: () => THREE.Vector3 }
  | { kind: 'orbit'; t: number; dur: number; centre: THREE.Vector3 }
  | { kind: 'lunge'; t: number; dur: number; face: () => THREE.Vector3 };

export class CameraFx {
  private shot: Shot | null = null;
  private blend = 0;
  /** True while a shot owns the camera. */
  get busy(): boolean {
    return !!this.shot;
  }
  get kind(): string | null {
    return this.shot?.kind ?? null;
  }
  /** Fraction through the current shot. */
  get progress(): number {
    return this.shot ? this.shot.t / this.shot.dur : 0;
  }

  constructor(private readonly player: PlayerController) {}

  vertigo(face: THREE.Vector3, dur = 3.4, roll = 0): void {
    const cam = this.player.camera;
    this.shot = { kind: 'vertigo', t: 0, dur, face: face.clone(), from: cam.position.clone(), fov0: 34, roll };
  }

  whip(at: THREE.Vector3, dur = 1.1): void {
    if (this.shot) return;
    this.shot = { kind: 'whip', t: 0, dur, at: at.clone() };
  }

  follow(target: () => THREE.Vector3, dur = 2.2): void {
    if (this.shot) return;
    this.shot = { kind: 'follow', t: 0, dur, target };
  }

  orbit(centre: THREE.Vector3, dur = 9): void {
    this.shot = { kind: 'orbit', t: 0, dur, centre: centre.clone() };
  }

  lunge(face: () => THREE.Vector3, dur = 2.4): void {
    this.shot = { kind: 'lunge', t: 0, dur, face };
  }

  skip(): void {
    if (this.shot && this.shot.kind !== 'lunge') this.shot.t = Math.max(this.shot.t, this.shot.dur - 0.35);
  }

  update(dt: number): void {
    const p = this.player;
    const s = this.shot;
    if (!s) {
      this.blend = Math.max(0, this.blend - dt * 4);
      if (p.override) p.override.blend = this.blend;
      if (this.blend <= 0) p.override = null;
      return;
    }
    s.t += dt;
    const k = Math.min(1, s.t / s.dur);
    // ease in for the first 0.3 s, ease out over the last 0.35 s
    const edge = Math.min(1, s.t / 0.3, Math.max(0, (s.dur - s.t) / 0.35));
    this.blend = s.kind === 'whip' || s.kind === 'lunge' ? Math.min(1, edge * 1.6) : edge;
    const seat = new THREE.Vector3(0, 1.28, 0.5);
    let pos = seat.clone();
    let look = new THREE.Vector3(0, 1.3, -2);
    let fov = 70;
    let roll = 0;
    switch (s.kind) {
      case 'vertigo': {
        // the subject keeps its size; the space behind it stretches. tan(fov/2) * distance stays the same.
        const D0 = s.from.distanceTo(s.face);
        const travel = Math.min(D0 - 0.45, 0.85) * Math.sin(Math.min(1, k * 1.25) * Math.PI * 0.5);
        const dir = s.face.clone().sub(s.from).normalize();
        pos = s.from.clone().addScaledVector(dir, travel);
        const D = D0 - travel;
        const half = Math.atan((Math.tan(THREE.MathUtils.degToRad(s.fov0 / 2)) * D0) / D);
        fov = Math.min(110, THREE.MathUtils.radToDeg(half * 2));
        look = s.face;
        roll = s.roll * k;
        break;
      }
      case 'whip': {
        pos = p.camera.position.clone();
        look = s.at;
        fov = 64;
        break;
      }
      case 'follow': {
        pos = p.camera.position.clone();
        look = s.target().clone().setY(1.5);
        fov = 58;
        break;
      }
      case 'orbit': {
        // one slow turn on the spot, from the chair
        const a = k * Math.PI * 2;
        pos = seat;
        look = s.centre.clone().add(new THREE.Vector3(-Math.sin(a) * 3, -0.1, -Math.cos(a) * 3));
        fov = 62;
        break;
      }
      case 'lunge': {
        const f = s.face();
        pos = seat.clone().lerp(f, Math.max(0, (k - 0.55) / 0.45) * 0.6);
        look = f;
        fov = 50 - k * 22;
        roll = Math.sin(s.t * 31) * 0.04 * k;
        break;
      }
    }
    p.override = { pos, look, fov, roll, blend: this.blend };
    if (s.t >= s.dur) this.shot = null;
  }
}
