import { CONFIG } from './config.js';
import { POSES, lerpPose } from './poses.js';

const ATTACK = {
  attack: { hitAt: 0.09, duration: 0.26, reach: 3 },
  lunge:  { hitAt: 0.09, duration: 0.38, reach: 10 },
};

export class Player {
  constructor(x) {
    this.x = x;
    this.hp = CONFIG.playerHp;
    this.state = 'ready';
    this.t = 0;
    this.pose = { ...POSES.idle };
    this.guard = null;
    this.offset = 0;
    this.step = 0;
    this.walking = false;
    this.struck = false;
  }

  get ready() { return this.state === 'ready'; }

  startAttack(kind) {
    this.state = kind;
    this.t = 0;
    this.struck = false;
  }

  hurt() {
    this.hp = Math.max(0, this.hp - 1);
    this.state = 'hurt';
    this.t = 0;
  }

  // guard — какую защиту держат клавиши. Возвращает 'attack' / 'lunge' в кадр, когда клинок достаёт врага.
  update(dt, guard) {
    this.t += dt;
    let event = null;
    const atk = ATTACK[this.state];
    if (atk) {
      if (!this.struck && this.t >= atk.hitAt) {
        this.struck = true;
        event = this.state;
      }
      this.offset = Math.sin(Math.min(1, this.t / atk.duration) * Math.PI) * atk.reach;
      if (this.t >= atk.duration) this.state = 'ready';
    } else if (this.state === 'hurt') {
      this.offset = -Math.sin(Math.min(1, this.t / 0.3) * Math.PI) * 4;
      if (this.t >= 0.3) this.state = 'ready';
    }
    if (this.state === 'ready') this.offset = 0;

    this.guard = this.ready ? guard : null;
    let target = POSES.idle;
    if (atk && this.state !== 'ready') target = POSES[this.state];
    else if (this.state === 'hurt') target = POSES.hurt;
    else if (this.guard) target = POSES['guard_' + this.guard];
    this.pose = lerpPose(this.pose, target, 1 - Math.exp(-dt * 40));

    this.step = this.walking ? this.step + dt * 12 : 0;
    return event;
  }
}
