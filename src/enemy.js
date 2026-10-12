import { CONFIG, ENEMY_TYPES, STRIKES } from './config.js';
import { POSES, lerpPose, approachPose, ease } from './poses.js';
import { slimeZone } from './combat.js';

// world — то, что враг знает о мире: world.player (x, …), world.engage(e), world.impact(e, strikeType) → результат,
// world.spawnArrow(e, height), world.swallow(e) → получилось ли, world.cue(height), world.staggered(e),
// world.heavySwing(e) — эффект тяжёлого взмаха, world.defeated(e) — мини-босс отступил,
// world.requestToken(e) — можно ли сейчас атаковать (бьёт один враг, остальные ждут; нет функции — можно всегда).
// Враг из группы встречи (group) просыпается только вместе с ней (awake), а не по расстоянию.

export function createEnemy(type, x, rng = Math.random, z = 22) {
  const kind = ENEMY_TYPES[type].kind;
  const Cls = kind === 'slime' ? Slime : kind === 'archer' ? Archer : kind === 'duelist' ? Duelist : Melee;
  const e = new Cls(type, x, rng);
  e.z = e.homeZ = z;
  return e;
}

class Enemy {
  constructor(type, x, rng) {
    this.type = type;
    this.def = ENEMY_TYPES[type];
    this.kind = this.def.kind;
    this.x = x;
    this.homeX = x;
    this.z = this.homeZ = 22;
    this.hp = this.def.hp;
    this.rng = rng;
    this.alive = true;
    this.facing = -1;
    this.pose = { ...POSES.idle };
    this.step = 0;
    this.airY = 0;
    this.flashT = 0;
    this.guardHeight = null;
    this.guardT = 0;
    this.react = null;
    this.combo = null;
    this.idx = 0;
    this.allPerfect = true;
    this.lastCombo = -1;
    this.waitFor = 0;
    this.enter('dormant');
  }

  enter(state) {
    this.state = state;
    this.t = 0;
    this.windupOverride = undefined;
    this.from = { ...this.pose };
    this.cued = false;
    this.done = false;
  }

  get solid() { return this.alive && this.airY < 6; }
  get canGuard() { return this.alive && (this.state === 'idle' || this.state === 'approach' || this.state === 'dormant'); }
  get windupTime() { return this.windupOverride ?? (this.idx === 0 ? this.def.windup : this.def.comboWindup); }
  get height() { return this.combo ? this.combo[this.idx] : null; }
  get strike() { return STRIKES[this.height] ?? STRIKES.mid; }
  get glint() { return this.state === 'windup' && this.t >= this.windupTime - CONFIG.perfectWindow; }

  dist(w) { return Math.abs(w.player.x - this.x); }
  faceTo(w) { this.facing = w.player.x < this.x ? -1 : 1; }
  walk(dt, speed, dir) {
    this.x += dir * speed * dt;
    this.step += dt * 10;
  }

  // скорость шага: у кого-то задана диапазоном — тогда каждый раз своя
  get speed() {
    const s = this.def.speed;
    if (!Array.isArray(s)) return s;
    if (this.state !== this.speedFor) {
      this.speedFor = this.state;
      this.curSpeed = s[0] + this.rng() * (s[1] - s[0]);
    }
    return this.curSpeed;
  }

  // сдвиг по глубине к нужной линии
  steerZ(dt, targetZ, speed = 30) {
    if (this.def.practice) return;  // чучело стоит на месте
    const d = targetZ - this.z;
    this.z += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
  }

  // моя очередь бить? (бьёт один враг, остальные ждут)
  myTurn(w) { return w.requestToken ? w.requestToken(this) : true; }

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

  // рыцарь начал замах — враг может успеть закрыться
  notifyAttack(atk) {
    if (!this.canGuard || !this.def.guardChance || atk.height === 'any') return;
    this.react = { t: this.def.reaction, height: atk.height };
  }

  tickGuard(dt) {
    if (!this.canGuard) {
      this.guardHeight = null;
      this.react = null;
      return;
    }
    if (this.react) {
      this.react.t -= dt;
      if (this.react.t <= 0) {
        if (this.rng() < this.def.guardChance) {
          this.guardHeight = this.react.height;
          this.guardT = 0.7;
        }
        this.react = null;
      }
    }
    if (this.guardT > 0) {
      this.guardT -= dt;
      if (this.guardT <= 0) this.guardHeight = null;
    }
  }

  blocks(height) {
    if (!this.canGuard) return false;
    if (this.def.shield && height !== 'low') return true;
    return this.guardHeight === height;
  }

  // удар рыцаря дошёл до врага → { out: 'hit' | 'counter' | 'blocked' | 'miss', dmg }
  receiveAttack(atk) {
    if (!this.alive) return { out: 'none' };
    if (this.state === 'stagger') {
      const dmg = atk.damage * CONFIG.counterMult;
      this.damage(dmg);
      return { out: 'counter', dmg };
    }
    // захлёст огибает защиту, рипост не успеть отбить
    if (atk.height !== 'any' && !atk.bypass && !atk.pierce && this.blocks(atk.height)) {
      this.guardT = 0.7;
      return { out: 'blocked' };
    }
    this.damage(atk.damage);
    return { out: 'hit', dmg: atk.damage };
  }

  damage(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
    this.flashT = 0.1;
    if (this.hp <= 0) {
      this.alive = false;
      this.combo = null;
      this.airY = 0;
      this.enter('dead');
      return;
    }
    // размен: свой удар враг не прерывает — рыцарь получит в ответ
    if (this.state === 'windup' || this.state === 'strike') return;
    this.combo = null;
    this.enter('hurt');
  }

  baseUpdate(dt) {
    this.t += dt;
    this.flashT = Math.max(0, this.flashT - dt);
    this.tickGuard(dt);
  }

  restPose() {
    return this.guardHeight ? POSES['guard_' + this.guardHeight] : POSES.idle;
  }

  // состояния, одинаковые у всех, кто бьёт мечом или стреляет
  commonStates(dt) {
    switch (this.state) {
      case 'recover':
        this.pose = approachPose(this.pose, POSES.idle, dt, 12);
        if (this.t >= this.def.recover) this.rest(0.5);
        return true;
      case 'stagger':
        this.pose = approachPose(this.pose, POSES.stagger, dt, 25);
        if (this.t >= CONFIG.counterWindow) this.rest(0.5);
        return true;
      case 'hurt':
        this.pose = approachPose(this.pose, POSES.hurt, dt, 30);
        if (!this.def.practice) this.x -= this.facing * 16 * dt;
        if (this.t >= 0.3) this.rest(0.6);
        return true;
      case 'dead':
        this.pose = approachPose(this.pose, POSES.dead, dt, 10);
        return true;
    }
    return false;
  }
}

class Melee extends Enemy {
  update(dt, w) {
    this.baseUpdate(dt);
    const d = this.def;
    const dist = this.dist(w);
    if (this.alive) this.faceTo(w);
    if (this.commonStates(dt)) return;

    switch (this.state) {
      case 'dormant':
        this.pose = approachPose(this.pose, this.restPose(), dt, 20);
        if (this.awake || (this.group === undefined && dist < d.aggro)) {
          w.engage(this);
          this.enter('approach');
        }
        break;

      case 'approach': {
        this.pose = approachPose(this.pose, this.restPose(), dt, 20);
        // ждущие держатся чуть дальше и на своей линии, атакующий выходит на линию рыцаря
        const turn = this.myTurn(w);
        const want = turn ? d.reach - 4 : d.reach + 18;
        this.steerZ(dt, turn ? w.player.z : this.homeZ);
        if (dist > want && this.speed > 0) this.walk(dt, this.speed, this.facing);
        else {
          this.step = 0;
          this.rest();
        }
        break;
      }

      case 'idle': {
        this.pose = approachPose(this.pose, this.restPose(), dt, 25);
        const turn = this.myTurn(w);
        this.steerZ(dt, turn ? w.player.z : this.homeZ);
        if (dist > (turn ? d.reach + 10 : d.reach + 30) && this.speed > 0) {
          this.enter('approach');
          break;
        }
        if (turn && this.decide?.(w, dist)) break;
        if (dist < CONFIG.bodyGap + 2) this.walk(dt, this.speed * 0.6, -this.facing);
        if (this.t >= this.waitFor && turn && dist <= d.reach + 4 && Math.abs(this.z - w.player.z) <= CONFIG.depthReach) {
          this.combo = this.pickCombo();
          this.idx = 0;
          this.allPerfect = true;
          this.enter('windup');
        }
        break;
      }

      case 'windup': {
        const T = this.windupTime;
        const s = this.strike;
        // быстро принимает позу замаха и замирает — эта пауза и есть подсказка
        this.pose = lerpPose(this.from, POSES['windup_' + s.pose], ease(Math.min(1, this.t / (T * 0.55))));
        if (!this.cued && this.t >= T * 0.55) {
          this.cued = true;
          w.cue(s.guard, s);
        }
        if (this.t >= T) {
          if (s.heavy) w.heavySwing(this);
          const result = w.impact(this, this.height);
          this.lastResult = result;
          if (result !== 'perfect') this.allPerfect = false;
          this.enter('strike');
        }
        break;
      }

      case 'strike':
        this.pose = lerpPose(this.from, POSES['strike_' + this.strike.pose], ease(Math.min(1, this.t / 0.07)));
        if (this.t < 0.1) this.x += this.facing * d.lunge * dt / 0.1;
        if (this.t >= 0.1 + d.gap) {
          this.idx++;
          if (this.idx < this.combo.length) {
            // идеально отбитый удар выбивает из ритма: пауза, в которую можно ударить
            this.enter(this.lastResult === 'perfect' ? 'reel' : 'windup');
          } else {
            this.combo = null;
            if (this.allPerfect) {
              this.enter('stagger');
              w.staggered(this);
            } else {
              this.enter('recover');
            }
          }
        }
        break;

      case 'reel':
        this.pose = approachPose(this.pose, POSES.stagger, dt, 20);
        if (this.t >= CONFIG.reelTime) this.enter('windup');
        break;
    }
  }
}

// Лучник держит дистанцию: отпрыгивает, если подойти близко, и стреляет на разной высоте.
class Archer extends Enemy {
  constructor(type, x, rng) {
    super(type, x, rng);
    this.bowDraw = 0;
    this.hopDir = 0;
  }

  get glint() { return this.state === 'windup' && this.t >= this.windupTime - 0.12; }

  update(dt, w) {
    this.baseUpdate(dt);
    const d = this.def;
    const dist = this.dist(w);
    if (this.alive) this.faceTo(w);
    if (this.state !== 'windup') this.bowDraw = Math.max(0, this.bowDraw - dt * 6);
    if (this.commonStates(dt)) return;

    switch (this.state) {
      case 'dormant':
        this.pose = approachPose(this.pose, POSES.aim_mid, dt, 20);
        if (this.awake || (this.group === undefined && dist < d.aggro)) {
          w.engage(this);
          this.rest();
        }
        break;

      case 'idle':
        this.pose = approachPose(this.pose, this.guardHeight ? POSES['guard_' + this.guardHeight] : POSES.aim_mid, dt, 20);
        // загнан к краю: прыгать некуда — уходит вглубь пола с линии рыцаря и стреляет
        const room = w.roomBehind ? w.roomBehind(this, -this.facing) : 999;
        if (dist < d.minDist && room < 40) this.steerZ(dt, w.player.z > 22 ? 4 : 40, 26);
        if (dist < d.minDist && room >= 40 && Math.abs(this.x - this.homeX) < 140) {
          this.hopDir = -this.facing;
          this.enter('hop');
          break;
        }
        if (dist > d.maxDist) this.walk(dt, 30, this.facing);
        if (!(dist < d.minDist && room < 40)) this.steerZ(dt, w.player.z, 18);
        if (this.t >= this.waitFor) {
          const shots = this.rng() < d.volleyChance ? 2 : 1;
          this.combo = Array.from({ length: shots }, () => d.heights[Math.floor(this.rng() * d.heights.length)]);
          this.idx = 0;
          this.enter('windup');
        }
        break;

      case 'hop': {
        const T = 0.38;
        this.x += this.hopDir * 85 * dt;
        this.airY = Math.sin(Math.PI * Math.min(1, this.t / T)) * 10;
        if (this.t >= T) {
          this.airY = 0;
          this.rest(0.6);
        }
        break;
      }

      case 'windup': {
        const T = this.windupTime;
        const h = this.height;
        this.pose = lerpPose(this.from, POSES['aim_' + h], ease(Math.min(1, this.t / (T * 0.4))));
        // навесную стрелу отбивают верхней защитой
        this.bowDraw = Math.min(1, this.t / (T * 0.7));
        if (!this.cued && this.t >= T * 0.55) {
          this.cued = true;
          w.cue(h === 'arc' ? 'high' : h);
        }
        if (this.t >= T) {
          w.spawnArrow(this, h);
          this.bowDraw = 0;
          this.enter('strike');
        }
        break;
      }

      case 'strike':
        if (this.t >= 0.18) {
          this.idx++;
          if (this.idx < this.combo.length) this.enter('windup');
          else {
            this.combo = null;
            this.enter('recover');
          }
        }
        break;
    }
  }
}

// Слизень прыгает. На земле его достаёт нижний удар, в прыжке — средний или верхний.
// Иногда отскакивает и раздувается: не пробьёшь вовремя — проглотит.
class Slime extends Enemy {
  constructor(type, x, rng) {
    super(type, x, rng);
    this.size = 1;
    this.squash = 0;
    this.inflateHits = 0;
    this.holding = false;
  }

  get canGuard() { return false; }
  get solid() { return this.alive && this.airY < 4 && !this.holding; }
  get zone() { return slimeZone(this.airY, this.state === 'inflate'); }
  get glint() { return this.state === 'leap' && this.t >= this.def.leapTime - CONFIG.perfectWindow; }

  receiveAttack(atk) {
    if (!this.alive) return { out: 'none' };
    if (atk.height !== 'any' && this.zone !== 'any' && atk.height !== this.zone) return { out: 'miss' };
    const counter = this.state === 'stagger';
    const dmg = atk.damage * (counter ? CONFIG.counterMult : 1);
    this.hp = Math.max(0, this.hp - dmg);
    this.flashT = 0.1;
    if (this.hp <= 0) {
      this.alive = false;
      this.holding = false;
      this.airY = 0;
      this.enter('dead');
    } else if (this.state === 'inflate') {
      this.inflateHits++;
      if (this.inflateHits >= this.def.popHits) this.enter('stagger');
    } else if (this.state !== 'leap' && this.state !== 'stagger' && this.state !== 'suck') {
      this.enter('hurt');
    }
    return { out: counter ? 'counter' : 'hit', dmg };
  }

  release() {
    this.holding = false;
    this.enter('land');
  }

  update(dt, w) {
    this.baseUpdate(dt);
    const d = this.def;
    const p = w.player;
    const dist = this.dist(w);
    if (this.alive && this.state !== 'leap') this.faceTo(w);
    const shrink = () => { this.size += (1 - this.size) * Math.min(1, dt * 6); };

    switch (this.state) {
      case 'dormant':
        if (this.awake || (this.group === undefined && dist < d.aggro)) {
          w.engage(this);
          this.enter('hop');
        }
        break;

      case 'hop': {
        const P = 0.55;
        const ph = this.t % P;
        this.airY = ph < 0.4 ? Math.sin(Math.PI * ph / 0.4) * 6 : 0;
        this.squash = ph >= 0.4 ? 0.25 : -0.1;
        if (ph < 0.4 && dist > 30) this.x += this.facing * 34 * dt;
        if (ph < 0.4) this.steerZ(dt, w.player.z, 24);
        shrink();
        if (this.t > 0.6 && ph >= 0.42 && dist <= 52 && this.myTurn(w)) {
          if (this.rng() < d.leapChance) this.enter('crouch');
          else {
            this.hopDir = -this.facing;
            this.enter('retreat');
          }
        }
        break;
      }

      case 'crouch':
        this.airY = 0;
        this.squash = 0.2 + 0.5 * Math.min(1, this.t / d.crouchTime);
        if (!this.cued && this.t >= d.crouchTime * 0.5) {
          this.cued = true;
          w.cue('high');
        }
        if (this.t >= d.crouchTime) {
          this.leapFrom = this.x;
          this.leapTo = p.x - this.facing * 8;
          this.leapFromZ = this.z;
          this.leapToZ = p.z;
          this.enter('leap');
        }
        break;

      case 'leap': {
        const k = Math.min(1, this.t / d.leapTime);
        this.x = this.leapFrom + (this.leapTo - this.leapFrom) * k;
        this.z = this.leapFromZ + (this.leapToZ - this.leapFromZ) * k;
        this.airY = Math.sin(Math.PI * k) * 30;
        this.squash = -0.3;
        if (this.t >= d.leapTime) {
          this.airY = 0;
          w.impact(this, 'high');
          this.enter('land');
        }
        break;
      }

      case 'land':
        this.squash = 0.6 * (1 - Math.min(1, this.t / 0.3));
        shrink();
        if (this.t >= 0.7) this.enter('hop');
        break;

      case 'retreat': {
        const T = 0.45;
        const k = Math.min(1, this.t / T);
        this.x += this.hopDir * 90 * dt;
        this.airY = Math.sin(Math.PI * k) * 12;
        if (this.t >= T) {
          this.airY = 0;
          this.inflateHits = 0;
          this.enter('inflate');
        }
        break;
      }

      case 'inflate':
        this.size = 1 + 1.3 * Math.min(1, this.t / d.inflateTime);
        this.squash = Math.sin(this.t * 10) * 0.05;
        if (!this.cued && this.t >= d.inflateTime - 0.5) {
          this.cued = true;
          w.cue('low');
        }
        if (this.t >= d.inflateTime) this.enter('suck');
        break;

      case 'suck':
        if (!this.done) {
          this.done = true;
          this.holding = dist < d.suckRange && w.swallow(this);
        }
        if (!this.holding) {
          shrink();
          if (this.t >= 0.3) this.enter('stagger');
        }
        break;

      case 'stagger':
        this.squash = 0.5;
        shrink();
        if (this.t >= d.stunTime) this.enter('hop');
        break;

      case 'hurt':
        this.squash = 0.5;
        this.airY = Math.max(0, this.airY - dt * 80);
        if (this.t >= 0.25) this.enter('hop');
        break;

      case 'dead':
        this.squash = Math.min(0.9, this.squash + dt * 3);
        shrink();
        break;
    }
  }
}

// Мини-босс с рапирой. Самый богатый набор ударов, отпрыгивает и врывается, меняет скорость шага.
// Побеждённый не умирает: встаёт на колено, смотрит вверх и убегает — он ещё появится.
class Duelist extends Melee {
  get solid() { return this.alive && this.airY < 6; }

  damage(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
    this.flashT = 0.1;
    if (this.hp <= 0) {
      this.alive = false;
      this.combo = null;
      this.airY = 0;
      this.enter('yield');
      return;
    }
    if (this.state === 'windup' || this.state === 'strike' || this.state === 'leapIn' || this.state === 'vault') return;
    this.combo = null;
    this.enter('hurt');
  }

  // решение в паузе между сериями: отпрыгнуть, ворваться или ждать серию
  decide(w, dist) {
    if (this.t < this.waitFor) return false;
    const r = this.rng();
    const d = this.def;
    if (r < d.leapBackChance && dist < d.reach + 6) {
      this.leapDir = -this.facing;
      this.enter('leapBack');
      return true;
    }
    if (r < d.leapBackChance + d.leapInChance && dist > 24) {
      this.leapDir = this.facing;
      this.enter('leapIn');
      return true;
    }
    if (r < d.leapBackChance + d.leapInChance + d.vaultChance && dist < 60) {
      // прыжок через голову: приземлиться за спиной рыцаря
      this.vaultFrom = this.x;
      this.vaultTo = w.player.x + this.facing * 26;
      this.enter('vault');
      return true;
    }
    return false;
  }

  update(dt, w) {
    const d = this.def;
    if (this.state === 'yield' || this.state === 'flee') this.flashT = Math.max(0, this.flashT - dt);
    switch (this.state) {
      case 'leapBack':
      case 'leapIn': {
        this.t += dt;
        this.flashT = Math.max(0, this.flashT - dt);
        const T = this.state === 'leapBack' ? 0.4 : 0.35;
        const k = Math.min(1, this.t / T);
        const dist = this.dist(w);
        const travel = this.state === 'leapIn' ? Math.max(0, dist - d.reach + 6) : d.leapDistance;
        this.x += this.leapDir * travel * (ease(k) - ease(Math.max(0, (this.t - dt) / T)));
        this.airY = Math.sin(Math.PI * k) * (this.state === 'leapBack' ? 14 : 10);
        this.pose = approachPose(this.pose, this.state === 'leapIn' ? POSES.windup_thrust : POSES.guard_mid, dt, 25);
        if (this.t >= T) {
          this.airY = 0;
          if (this.state === 'leapIn') {
            // врывается и сразу колет
            this.combo = ['thrust', 'thrust', 'thrust'];
            this.idx = 1;
            this.allPerfect = true;
            this.enter('windup');
          } else this.rest(0.5);
        }
        return;
      }

      case 'vault': {
        this.t += dt;
        this.flashT = Math.max(0, this.flashT - dt);
        const T = 0.5;
        const k = Math.min(1, this.t / T);
        this.x = this.vaultFrom + (this.vaultTo - this.vaultFrom) * ease(k);
        this.airY = Math.sin(Math.PI * k) * 36;
        this.pose = approachPose(this.pose, POSES.vault, dt, 20);
        if (this.t >= T) {
          this.airY = 0;
          this.faceTo(w);
          // приземлился и сразу хлещет в спину
          this.combo = ['flickBack'];
          this.idx = 0;
          this.allPerfect = true;
          this.enter('windup');
          this.windupOverride = this.def.vaultWindup;
        }
        return;
      }

      case 'yield':
        this.t += dt;
        this.pose = approachPose(this.pose, POSES.kneel, dt, 12);
        if (!this.disarmed) {
          // последний удар выбивает рапиру — её можно подобрать
          this.disarmed = true;
          w.dropWeapon?.(this, 'rapier');
        }
        if (this.t >= 1.6) {
          this.facing = w.player.x < this.x ? 1 : -1;  // разворачивается прочь от рыцаря
          this.enter('flee');
          w.defeated?.(this);
        }
        return;

      case 'flee':
        this.t += dt;
        this.pose = approachPose(this.pose, POSES.idle, dt, 15);
        this.x += this.facing * 190 * dt;
        this.step += dt * 18;
        if (this.t >= 2.5) this.enter('gone');
        return;

      case 'gone':
        return;
    }
    super.update(dt, w);
  }
}
