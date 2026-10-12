import { CONFIG, ENEMY_TYPES } from './config.js';
import { POSES, lerpPose, ease } from './poses.js';

// Враг: ждёт → подходит → пауза → серия ударов (замах, удар, замах, удар…) →
// открыт (recover) или ошеломлён (stagger, если вся серия отбита идеально).
export class Enemy {
  constructor(type, x, rng = Math.random) {
    this.type = type;
    this.def = ENEMY_TYPES[type];
    this.x = x;
    this.homeX = x;
    this.hp = this.def.hp;
    this.rng = rng;
    this.alive = true;
    this.combo = null;
    this.idx = 0;
    this.allPerfect = true;
    this.lastCombo = -1;
    this.pose = { ...POSES.idle };
    this.offset = 0;
    this.step = 0;
    this.enter('wait');
  }

  enter(state) {
    this.state = state;
    this.t = 0;
    this.from = { ...this.pose };
    this.cued = false;
  }

  get height() { return this.combo ? this.combo[this.idx] : null; }
  get windupTime() { return this.idx === 0 ? this.def.windup : this.def.comboWindup; }
  get glint() { return this.state === 'windup' && this.t >= this.windupTime - CONFIG.perfectWindow; }

  engage(duelX) {
    this.duelX = duelX;
    this.enter('approach');
  }

  rest(scale = 1) {
    const [a, b] = this.def.wait;
    this.waitFor = (a + this.rng() * (b - a)) * scale;
    this.enter('idle');
  }

  pickCombo() {
    const n = this.def.combos.length;
    let i = Math.floor(this.rng() * n);
    if (n > 1 && i === this.lastCombo) i = (i + 1) % n;
    this.lastCombo = i;
    return this.def.combos[i];
  }

  takeHit(damage) {
    this.hp = Math.max(0, this.hp - damage);
    this.combo = null;
    this.enter('hurt');
  }

  // hooks.impact(height) → 'perfect' | 'block' | 'hit'; hooks.staggered(); hooks.cue(height)
  update(dt, hooks) {
    this.t += dt;
    const d = this.def;
    switch (this.state) {
      case 'wait':
        break;

      case 'approach': {
        const dir = Math.sign(this.duelX - this.x);
        this.x += dir * 50 * dt;
        this.step += dt * 10;
        if ((dir <= 0 && this.x <= this.duelX) || (dir > 0 && this.x >= this.duelX)) {
          this.x = this.duelX;
          this.step = 0;
          this.rest();
        }
        break;
      }

      case 'idle':
        this.pose = lerpPose(this.from, POSES.idle, ease(Math.min(1, this.t / 0.25)));
        if (this.t >= this.waitFor) {
          this.combo = this.pickCombo();
          this.idx = 0;
          this.allPerfect = true;
          this.enter('windup');
        }
        break;

      case 'windup': {
        const T = this.windupTime;
        const h = this.height;
        // быстро принимает позу замаха и замирает — эта пауза и есть подсказка
        this.pose = lerpPose(this.from, POSES['windup_' + h], ease(Math.min(1, this.t / (T * 0.55))));
        if (!this.cued && this.t >= T * 0.55) {
          this.cued = true;
          hooks.cue?.(h);
        }
        if (this.t >= T) {
          const result = hooks.impact(h, this);
          if (result !== 'perfect') this.allPerfect = false;
          this.enter('strike');
        }
        break;
      }

      case 'strike':
        this.pose = lerpPose(this.from, POSES['strike_' + this.height], ease(Math.min(1, this.t / 0.07)));
        if (this.t >= 0.1 + d.gap) {
          this.idx++;
          if (this.idx < this.combo.length) {
            this.enter('windup');
          } else {
            this.combo = null;
            if (this.allPerfect) {
              this.enter('stagger');
              hooks.staggered?.(this);
            } else {
              this.enter('recover');
            }
          }
        }
        break;

      case 'recover':
        this.pose = lerpPose(this.from, POSES.idle, ease(Math.min(1, this.t / 0.3)));
        if (this.t >= d.recover) this.rest(0.5);
        break;

      case 'stagger':
        this.pose = lerpPose(this.from, POSES.stagger, ease(Math.min(1, this.t / 0.12)));
        if (this.t >= CONFIG.counterWindow) this.rest(0.5);
        break;

      case 'hurt':
        this.pose = lerpPose(this.from, POSES.hurt, ease(Math.min(1, this.t / 0.08)));
        this.offset = Math.sin(Math.min(1, this.t / 0.35) * Math.PI) * 5;
        if (this.t >= 0.35) {
          this.offset = 0;
          if (this.hp <= 0) {
            this.alive = false;
            this.enter('dead');
          } else {
            this.rest(0.6);
          }
        }
        break;

      case 'dead':
        this.pose = lerpPose(this.from, POSES.dead, ease(Math.min(1, this.t / 0.4)));
        break;
    }
  }
}
