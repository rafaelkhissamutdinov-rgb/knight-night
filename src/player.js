import { CONFIG, WEAPON } from './config.js';
import { POSES, approachPose, spinPose, ease } from './poses.js';

// Какой удар выйдет при нажатии атаки. vert — зажатое направление ('up' | 'down' | null),
// spin — только что нажато вперёд → назад, state / t — что рыцарь делает сейчас, sinceRoll — сколько прошло после кувырка.
export function chooseAttack({ vert, spin, state, t, sinceRoll }) {
  if (state === 'dash' && t <= WEAPON.dash.time + WEAPON.dashCutWindow) return 'dashCut';
  if (sinceRoll <= WEAPON.roll.strikeWindow) return 'rollCut';
  if (spin) return 'spin';
  if (vert === 'up') return 'overhead';
  if (vert === 'down') return 'low';
  return 'side';
}

// Замах с учётом ножен: сбоку из ножен — быстрее, верх и низ — медленнее.
export function attackWindup(key, sheathed) {
  const a = WEAPON.attacks[key];
  if (!sheathed) return a.windup;
  return a.windup + (key === 'side' ? WEAPON.drawSide : WEAPON.drawExtra);
}

export class Player {
  constructor(x) {
    this.x = x;
    this.z = CONFIG.depth / 2;
    this.hp = CONFIG.playerHp;
    this.facing = 1;
    this.clock = 0;
    this.pose = { ...POSES.sheathed };
    this.guard = null;
    this.sheathed = true;
    this.idleT = 0;
    this.walking = false;
    this.step = 0;
    this.atk = null;
    this.ward = null;
    this.dashReadyAt = 0;
    this.spinReadyAt = 0;
    this.brokenUntil = -1;
    this.rollEnd = -10;
    this.buffer = null;
    this.knock = 0;
    this.trail = [];
    this.swallower = null;
    this.events = [];
    this.enter('ready');
  }

  enter(state) {
    this.state = state;
    this.t = 0;
  }

  get ready() { return this.state === 'ready'; }

  // фаза удара: windup → active → recover
  get phase() {
    if (this.state !== 'attack') return null;
    const a = this.atk;
    if (this.t < a.windup) return 'windup';
    if (this.t < a.windup + a.active) return 'active';
    return 'recover';
  }

  get broken() { return this.clock < this.brokenUntil; }

  get wardActive() { return !!this.ward && !this.ward.used && this.clock <= this.ward.until; }

  defense() {
    const r = WEAPON.roll.iframes;
    return {
      guard: this.state === 'ready' ? this.guard : null,
      broken: this.broken,
      dodge: (this.state === 'roll' && this.t >= r[0] && this.t <= r[1]) || this.state === 'swallowed',
      ward: this.state === 'backdash' && this.wardActive,
      attacking: this.state === 'attack',
      // отскок сделан раньше времени: заслон погас, а рыцарь ещё не собрался
      vulnerable: this.state === 'backdash' && !this.wardActive && !this.ward?.used,
    };
  }

  // доля готовности вихря: 1 — готов
  get spinCharge() { return Math.min(1, 1 - (this.spinReadyAt - this.clock) / CONFIG.spinCooldown); }

  requestAttack(vert, spin) {
    if (this.state === 'swallowed' || this.state === 'hurt') return;
    if (spin && this.clock < this.spinReadyAt) {
      // вихрь ещё перезаряжается — выйдет обычный удар
      spin = false;
      this.events.push({ type: 'spinNotReady' });
    }
    const sinceRoll = this.state === 'ready' ? this.clock - this.rollEnd : Infinity;
    const key = chooseAttack({ vert, spin, state: this.state, t: this.t, sinceRoll });
    if (key === 'dashCut' || this.state === 'ready') {
      this.startAttack(key);
      return;
    }
    if (this.state === 'roll') this.buffer = { key: 'rollCut', until: this.clock + 0.5 };
    else this.buffer = { vert, spin, until: this.clock + CONFIG.attackBuffer };
  }

  startAttack(key) {
    const a = WEAPON.attacks[key];
    this.atk = { ...a, key, windup: attackWindup(key, this.sheathed), draw: this.sheathed, hit: 0 };
    if (key === 'spin') this.spinReadyAt = this.clock + CONFIG.spinCooldown;
    this.sheathed = false;
    this.idleT = 0;
    this.buffer = null;
    this.trail = [];
    this.enter('attack');
    this.events.push({ type: 'attackStart', atk: this.atk });
  }

  // отмена удара, пока идёт замах
  cancel() {
    if (this.state === 'attack' && this.t < this.atk.windup) {
      this.atk = null;
      this.enter('ready');
      this.events.push({ type: 'feint' });
      return true;
    }
    return false;
  }

  // dir: 'up' — прыжок с ударом, 'down' — кувырок, 'back' — отскок с заслоном, иначе рывок вперёд
  requestDash(dir) {
    if (this.clock < this.dashReadyAt) return;
    if (this.state === 'attack') this.cancel();
    if (this.state !== 'ready') return;
    this.dashReadyAt = this.clock + WEAPON.dash.cooldown;
    this.idleT = 0;
    if (dir === 'up') {
      this.startAttack('leap');
      return;
    }
    if (dir === 'down') this.enter('roll');
    else if (dir === 'back') {
      this.enter('backdash');
      this.ward = { until: this.clock + WEAPON.backdash.ward, used: false };
    } else this.enter('dash');
    this.events.push({ type: this.state });
  }

  hurt(dmg, fromX) {
    this.hp = Math.max(0, this.hp - dmg);
    this.atk = null;
    this.knock = Math.sign(this.x - fromX) || -this.facing;
    this.enter('hurt');
  }

  // защиту сбили: рыцаря отбрасывает, какое-то время он не может закрыться — только отходить или бить
  breakGuard(fromX) {
    this.brokenUntil = this.clock + CONFIG.guardBreakTime;
    this.x += (Math.sign(this.x - fromX) || -this.facing) * 10;
  }

  swallowedBy(slime) {
    this.atk = null;
    this.swallower = slime;
    this.enter('swallowed');
  }

  // враг закрылся от удара: рыцаря немного отбрасывает, восстановление дольше
  recoil() {
    if (this.state !== 'attack') return;
    this.atk.recover += 0.15;
    this.x -= this.facing * 3;
  }

  // c: { fwd, back, dz, guard, engaged, anyInput } — управление в этом кадре относительно взгляда рыцаря;
  // dz — шаг вглубь пола (-1 к стене, 1 к краю экрана)
  update(dt, c) {
    this.clock += dt;
    this.t += dt;
    this.idleT += dt;
    this.walking = false;
    this.guard = null;
    let target = null;
    const forward = dist => { this.x += dist * this.facing; };
    const eased = (time, total) => ease(Math.min(1, Math.max(0, time / total)));

    switch (this.state) {
      case 'ready': {
        if (this.buffer) {
          const b = this.buffer;
          this.buffer = null;
          if (this.clock <= b.until) {
            if (b.key) this.startAttack(b.key);
            else this.requestAttack(b.vert, b.spin);
            if (this.state !== 'ready') break;
          }
        }
        const g = this.broken ? null : c.guard;
        this.guard = g;
        if (g || c.anyInput) this.idleT = 0;
        if (g) this.sheathed = false;
        // в защите ходит медленнее
        const slow = g ? 0.6 : 1;
        let v = 0;
        if (c.back) v = -CONFIG.walkSpeed * CONFIG.backWalkFactor;
        else if (c.fwd) v = CONFIG.walkSpeed;
        if (v) forward(v * slow * dt);
        if (c.dz) this.z = Math.max(0, Math.min(CONFIG.depth, this.z + c.dz * CONFIG.depthSpeed * slow * dt));
        this.walking = !!(v || c.dz);
        if (!c.engaged && !g && this.idleT > CONFIG.autoSheathe) this.sheathed = true;
        target = this.broken ? POSES.broken : this.sheathed ? POSES.sheathed : g ? POSES['guard_' + g] : POSES.idle;
        break;
      }

      case 'attack': {
        const a = this.atk;
        const t = this.t;
        if (a.move) forward((eased(t, a.windup + a.active) - eased(t - dt, a.windup + a.active)) * a.move);
        if (t < a.windup) {
          target = a.key === 'spin' ? POSES.windup_low : a.draw && a.key === 'side' ? POSES.draw : POSES['windup_' + a.pose];
        } else if (t < a.windup + a.active) {
          const lt = t - a.windup;
          if (a.key === 'spin') {
            this.pose = spinPose(lt / a.active);
            while (a.hit < a.hits.length && lt >= a.hits[a.hit]) {
              this.events.push({ type: 'strike', atk: a, index: a.hit });
              a.hit++;
            }
          } else {
            target = a.draw && a.key === 'side' ? POSES.strike_draw : POSES['strike_' + a.pose];
            if (a.hit === 0) {
              a.hit = 1;
              this.events.push({ type: 'strike', atk: a });
            }
          }
        } else if (t < a.windup + a.active + a.recover) {
          target = POSES.idle;
        } else {
          this.atk = null;
          this.enter('ready');
          target = POSES.idle;
        }
        break;
      }

      case 'dash':
      case 'roll':
      case 'backdash': {
        const m = WEAPON[this.state];
        const dir = this.state === 'backdash' ? -1 : 1;
        forward((eased(this.t, m.time) - eased(this.t - dt, m.time)) * m.distance * dir);
        target = this.state === 'dash' ? POSES.dash : this.state === 'backdash' ? POSES.backdash : POSES.idle;
        const total = this.state === 'dash' ? m.time + WEAPON.dashCutWindow : (m.total ?? m.time);
        if (this.t >= total) {
          if (this.state === 'roll') this.rollEnd = this.clock;
          this.enter('ready');
        }
        break;
      }

      case 'hurt':
        this.x += this.knock * 20 * dt;
        target = POSES.hurt;
        if (this.t >= 0.3) this.enter('ready');
        break;

      case 'swallowed':
        this.x = this.swallower.x;
        if (this.t >= 1.2) {
          this.events.push({ type: 'spit', slime: this.swallower });
          this.swallower = null;
          this.x -= this.facing * 36;   // выплюнул назад, туда, откуда рыцарь пришёл
          this.knock = -this.facing;
          this.enter('hurt');
        }
        break;
    }

    if (target) this.pose = approachPose(this.pose, target, dt, this.state === 'attack' ? 55 : 40);
    this.step = this.walking ? this.step + dt * 12 : 0;
  }
}
