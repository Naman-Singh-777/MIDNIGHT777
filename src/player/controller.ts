import * as THREE from 'three';
import type { Physics, PlayerRig } from '../physics/world';

export type PlayerMode = 'desk' | 'floor';

export interface InputState {
  keys: Set<string>;
  mouseDX: number;
  mouseDY: number;
  mouseNX: number; // normalized cursor 0..1
  mouseNY: number;
  zoom?: boolean;
}

const EYE_STAND = 1.62;
const EYE_SEAT = 1.28;
const EYE_DUCK = 0.5;
const EYE_CROUCH = 1.05;
const BASE_FOV = 70;
const ZOOM_FOV = 44;
const DESK_POS = new THREE.Vector3(0, 0, 0.5);

export class PlayerController {
  readonly camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 60);
  readonly rig: PlayerRig;
  mode: PlayerMode = 'desk';
  yaw = 0;
  pitch = 0;
  stamina = 1;
  private vy = 0;
  private bob = 0;
  private eyeY = EYE_SEAT;
  private grounded = true;
  /** distance walked this frame, consumed by audio for footsteps */
  stepDelta = 0;
  sprinting = false;
  private smoothYaw = 0;
  private smoothPitch = 0;
  private staminaWait = 0;
  private leanZ = 0;
  private fov = BASE_FOV;
  /** Seated: ducked under the sill. Standing: crouched. */
  ducked = false;
  zoomed = false;
  /** Seated: C toggles getting under the desk. */
  underDesk = false;
  /** Seated: X brings you right up to the glass to look at the face. */
  closeup = false;
  /** A short camera move the game is playing (camfx.ts). While set, it owns the camera. */
  override: { pos: THREE.Vector3; look: THREE.Vector3; fov: number; roll: number; blend: number } | null = null;
  private underK = 0;
  /** Tilt of the horizon, in radians, added on top of normal look. Low nerves tip the world over. */
  dutch = 0;

  constructor(physics: Physics) {
    this.rig = physics.createPlayer(DESK_POS.x, 0.86, DESK_POS.z);
    this.camera.position.set(DESK_POS.x, EYE_SEAT, DESK_POS.z);
  }

  get feet(): THREE.Vector3 {
    const t = this.rig.body.translation();
    return new THREE.Vector3(t.x, t.y - 0.85, t.z);
  }

  sit(): void {
    this.mode = 'desk';
    this.rig.body.setTranslation({ x: DESK_POS.x, y: 0.86, z: DESK_POS.z }, true);
    this.yaw = 0;
    this.pitch = 0;
    this.vy = 0;
  }

  stand(): void {
    this.underDesk = false;
    this.closeup = false;
    this.mode = 'floor';
    this.rig.body.setTranslation({ x: 0.2, y: 0.86, z: 1.15 }, true);
    this.yaw = 0;
    this.pitch = 0;
  }

  forward(): THREE.Vector3 {
    return new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }

  update(dt: number, input: InputState, locked: boolean): void {
    if (this.mode === 'desk') this.updateDesk(dt, input);
    else this.updateFloor(dt, input, locked);
    input.mouseDX = 0;
    input.mouseDY = 0;
  }

  private updateDesk(dt: number, input: InputState): void {
    // seated: look follows the cursor with a gentle limit, like leaning over the desk
    const ty = -(input.mouseNX - 0.5) * 1.5;
    const tp = -(input.mouseNY - 0.5) * 0.9 - 0.12;
    this.smoothYaw += (ty - this.smoothYaw) * Math.min(1, dt * 6);
    this.smoothPitch += (tp - this.smoothPitch) * Math.min(1, dt * 6);
    this.yaw = this.smoothYaw;
    this.pitch = this.smoothPitch;
    this.stamina = Math.min(1, this.stamina + dt * 0.4);
    this.ducked = this.underDesk || input.keys.has('ControlLeft') || input.keys.has('ControlRight');
    if (this.ducked) this.closeup = false;
    this.zoomed = !this.ducked && (!!input.zoom || this.closeup);
    const eyeTarget = this.ducked ? EYE_DUCK : this.closeup ? 1.42 : EYE_SEAT;
    this.eyeY += (eyeTarget - this.eyeY) * Math.min(1, dt * (this.ducked ? 9 : 5));
    const breath = Math.sin(performance.now() * 0.0011) * 0.004;
    // leaning toward the glass when zoomed, right up to it for the face check
    const lean = this.closeup ? 1.18 : this.zoomed ? 0.32 : 0;
    this.leanZ += (lean - this.leanZ) * Math.min(1, dt * (this.closeup ? 3.5 : 6));
    // under the desk you can only look about a little, out between the pedestals
    const yaw = this.ducked ? this.yaw * 0.6 : this.closeup ? this.yaw * 0.35 : this.yaw;
    const pitch = this.ducked ? -0.05 + this.pitch * 0.3 : this.closeup ? this.pitch * 0.3 + 0.07 : this.pitch;
    this.underK += ((this.ducked ? 1 : 0) - this.underK) * Math.min(1, dt * 6);
    // under the desk proper: into the knee hole, the desk top over your head, the hall a strip of light past the modesty board
    this.camera.position.set(DESK_POS.x, this.eyeY + breath, DESK_POS.z - this.leanZ - this.underK * 0.92);
    this.camera.rotation.set(pitch, yaw, this.dutch, 'YXZ');
    this.applyFov(dt);
    this.applyOverride(dt);
    this.stepDelta = 0;
    this.sprinting = false;
  }

  private updateFloor(dt: number, input: InputState, locked: boolean): void {
    if (locked) {
      this.yaw -= input.mouseDX * 0.0022;
      this.pitch = THREE.MathUtils.clamp(this.pitch - input.mouseDY * 0.0022, -1.45, 1.45);
    }
    const k = input.keys;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const moving = f !== 0 || s !== 0;
    const wantSprint = k.has('ShiftLeft') || k.has('ShiftRight');
    this.ducked = k.has('KeyC') || k.has('ControlLeft') || k.has('ControlRight');
    this.zoomed = !!input.zoom;
    this.sprinting = wantSprint && moving && this.stamina > 0.05 && !this.ducked;
    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - dt * 0.22);
      this.staminaWait = 1.6; // regen pauses before it starts
    } else {
      this.staminaWait = Math.max(0, this.staminaWait - dt);
      if (this.staminaWait <= 0) this.stamina = Math.min(1, this.stamina + dt * (moving ? 0.12 : 0.3));
    }
    const speed = this.ducked ? 1.3 : this.sprinting ? 4.6 : this.zoomed ? 1.6 : 2.5;

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // forward vector at yaw (camera looks down -z)
    let dx = (-sin * f + cos * s);
    let dz = (-cos * f - sin * s);
    const len = Math.hypot(dx, dz);
    if (len > 0) {
      dx = (dx / len) * speed * dt;
      dz = (dz / len) * speed * dt;
    }
    this.vy = this.grounded ? -0.5 * dt : this.vy - 9.81 * dt;
    const desired = { x: dx, y: this.vy * dt + (this.grounded ? -0.02 : 0), z: dz };
    this.rig.controller.computeColliderMovement(this.rig.collider, desired);
    const m = this.rig.controller.computedMovement();
    this.grounded = this.rig.controller.computedGrounded();
    if (this.grounded) this.vy = 0;
    const t = this.rig.body.translation();
    this.rig.body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });
    this.stepDelta = moving ? Math.hypot(m.x, m.z) : 0;

    // head bob: speed and amount depend on the movement state
    const bobSpeed = this.ducked ? 6 : this.sprinting ? 12.5 : 8.5;
    const bobAmt = this.ducked ? 0.012 : this.sprinting ? 0.05 : 0.026;
    if (moving) this.bob += dt * bobSpeed;
    const bobY = moving ? Math.sin(this.bob) * bobAmt : 0;
    const bobX = moving ? Math.cos(this.bob * 0.5) * bobAmt * 0.5 : 0;
    this.eyeY += ((this.ducked ? EYE_CROUCH : EYE_STAND) - this.eyeY) * Math.min(1, dt * 7);
    this.camera.position.set(t.x + bobX * Math.cos(this.yaw), t.y - 0.85 + this.eyeY + bobY, t.z - bobX * Math.sin(this.yaw));
    this.camera.rotation.set(this.pitch, this.yaw, (moving ? Math.sin(this.bob * 0.5) * bobAmt * 0.25 : 0) + this.dutch, 'YXZ');
    this.applyFov(dt);
    this.applyOverride(dt);
  }

  /** Blend from the player's own view into the shot the game is playing, and back. */
  private applyOverride(_dt: number): void {
    const o = this.override;
    if (!o || o.blend <= 0) return;
    const k = Math.min(1, o.blend);
    const fromPos = this.camera.position.clone();
    const fromQ = this.camera.quaternion.clone();
    const m = new THREE.Matrix4().lookAt(o.pos, o.look, new THREE.Vector3(0, 1, 0));
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), o.roll));
    this.camera.position.copy(fromPos.lerp(o.pos, k));
    this.camera.quaternion.copy(fromQ.slerp(q, k));
    const fov = this.camera.fov + (o.fov - this.camera.fov) * k;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  private applyFov(dt: number): void {
    const target = this.closeup ? 30 : this.zoomed ? ZOOM_FOV : this.sprinting ? BASE_FOV + 4 : BASE_FOV;
    this.fov += (target - this.fov) * Math.min(1, dt * 8);
    if (Math.abs(this.camera.fov - this.fov) > 0.05) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }

  setAspect(a: number): void {
    this.camera.aspect = a;
    this.camera.updateProjectionMatrix();
  }
}
