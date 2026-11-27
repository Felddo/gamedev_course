import Phaser from 'phaser';
import { LaserProjectile, MissileRarityRef, MissileTypeCodeRef } from './types';

type TrailShapeKind =
  | 'plasma_spark'
  | 'ice_crystal'
  | 'frost_mist'
  | 'fan_streak'
  | 'zigzag_arc'
  | 'flame_puff'
  | 'smoke_puff'
  | 'ember'
  | 'sonic_ring'
  | 'vortex_orb'
  | 'triangle'
  | 'rail_streak'
  | 'rail_tick'
  | 'jet_streak';

interface VisualTrailNode {
  kind: TrailShapeKind;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  angle: number;
  spin: number;
  color: number;
  coreColor?: number;
  alpha: number;
}

const MAX_TRAIL_NODES = 480;

const RARITY_PRIMARY_COLOR: Record<MissileRarityRef, number> = {
  common: 0x38bdf8,
  rare: 0x34d399,
  legendary: 0xf87171,
};

const RARITY_INTENSITY: Record<MissileRarityRef, number> = {
  common: 1.0,
  rare: 1.12,
  legendary: 1.24,
};

/**
 * Рендерер уникальных визуальных шлейфов для каждого из 10 типов ракет (001–010).
 * Использует единый слой Phaser.Graphics для плавной отрисовки без лишних аллокаций спрайтов.
 */
export class MissileTrailRenderer {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics | null = null;
  private nodes: VisualTrailNode[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = this.scene.add.graphics();
    this.graphics.setDepth(11.5);
  }

  public reset(): void {
    this.nodes = [];
    this.graphics?.clear();
  }

  public destroy(): void {
    this.reset();
    if (this.graphics) {
      this.graphics.destroy();
      this.graphics = null;
    }
  }

  public emitForProjectile(laser: LaserProjectile, seconds: number): void {
    const typeCode: MissileTypeCodeRef = laser.missileTypeCode ?? '010';
    const rarity: MissileRarityRef = laser.missileRarity ?? 'common';
    const isSub = !!laser.isSubProjectile;
    const scale = (isSub ? 0.62 : 1.0) * RARITY_INTENSITY[rarity];

    const speed = Math.hypot(laser.vx, laser.vy) || 1;
    const dirX = laser.vx / speed;
    const dirY = laser.vy / speed;
    const angle = Math.atan2(dirY, dirX);
    const rearAngle = angle + Math.PI;
    const perpX = -dirY;
    const perpY = dirX;

    const nozzleDist = isSub ? 7 : 12;
    const tailX = laser.sprite.x - dirX * nozzleDist;
    const tailY = laser.sprite.y - dirY * nozzleDist;

    const interval = this.getEmitInterval(typeCode, isSub);
    laser.visualTrailTimer = (laser.visualTrailTimer ?? 0) - seconds;
    if (laser.visualTrailTimer > 0) return;
    laser.visualTrailTimer = interval;

    laser.trailPhase = (laser.trailPhase ?? 0) + 1;
    const phase = laser.trailPhase;
    const prevX = laser.prevTrailX ?? tailX;
    const prevY = laser.prevTrailY ?? tailY;
    laser.prevTrailX = tailX;
    laser.prevTrailY = tailY;

    switch (typeCode) {
      case '001':
        this.emitEnergySparks(tailX, tailY, rearAngle, rarity, scale);
        break;
      case '002':
        this.emitFrostTrail(tailX, tailY, perpX, perpY, angle, phase, scale);
        break;
      case '003':
        this.emitFanTrail(tailX, tailY, rearAngle, angle, scale);
        break;
      case '004':
        this.emitRicochetZigzag(prevX, prevY, tailX, tailY, perpX, perpY, phase, rarity, scale);
        break;
      case '005':
        this.emitExplosiveFireTrail(tailX, tailY, rearAngle, perpX, perpY, scale);
        break;
      case '006':
        this.emitImpulseRings(tailX, tailY, angle, scale);
        break;
      case '007':
        this.emitGravityVortex(tailX, tailY, perpX, perpY, rearAngle, phase, rarity, scale);
        break;
      case '008':
        this.emitTriangleTrail(tailX, tailY, rearAngle, angle, phase, scale);
        break;
      case '009':
        this.emitInterceptorRails(prevX, prevY, tailX, tailY, perpX, perpY, phase, scale);
        break;
      case '010':
      default:
        this.emitStandardJetTrail(prevX, prevY, tailX, tailY, rearAngle, rarity, scale, isSub);
        break;
    }
  }

  private getEmitInterval(typeCode: MissileTypeCodeRef, isSub: boolean): number {
    const mult = isSub ? 1.45 : 1.0;
    switch (typeCode) {
      case '001':
        return 0.03 * mult;
      case '002':
        return 0.024 * mult;
      case '003':
        return 0.026 * mult;
      case '004':
        return 0.018 * mult;
      case '005':
        return 0.02 * mult;
      case '006':
        return 0.042 * mult;
      case '007':
        return 0.02 * mult;
      case '008':
        return 0.034 * mult;
      case '009':
        return 0.018 * mult;
      case '010':
      default:
        return 0.018 * mult;
    }
  }

  private pushNode(node: VisualTrailNode): void {
    if (this.nodes.length >= MAX_TRAIL_NODES) {
      this.nodes.shift();
    }
    this.nodes.push(node);
  }

  /** 001: Энергетические искры вокруг плазменного следа */
  private emitEnergySparks(
    x: number,
    y: number,
    rearAngle: number,
    rarity: MissileRarityRef,
    scale: number,
  ): void {
    const color = RARITY_PRIMARY_COLOR[rarity];
    const spread = rearAngle + (Math.random() - 0.5) * 1.1;
    const spd = 40 + Math.random() * 65;
    this.pushNode({
      kind: 'plasma_spark',
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      vx: Math.cos(spread) * spd,
      vy: Math.sin(spread) * spd,
      life: 0.24,
      maxLife: 0.24,
      size: 2.6 * scale,
      angle: spread,
      spin: 0,
      color,
      coreColor: 0xffffff,
      alpha: 0.9,
    });
  }

  /** 002: Криогенные кристаллы льда и морозная дымка */
  private emitFrostTrail(
    x: number,
    y: number,
    perpX: number,
    perpY: number,
    angle: number,
    phase: number,
    scale: number,
  ): void {
    const side = phase % 2 === 0 ? 1 : -1;
    const lateral = side * (2 + Math.random() * 5);
    this.pushNode({
      kind: 'frost_mist',
      x: x + perpX * lateral * 0.5,
      y: y + perpY * lateral * 0.5,
      vx: perpX * lateral * 3.5,
      vy: perpY * lateral * 3.5,
      life: 0.34,
      maxLife: 0.34,
      size: 5.8 * scale,
      angle: 0,
      spin: 0,
      color: 0x06b6d4,
      alpha: 0.34,
    });

    this.pushNode({
      kind: 'ice_crystal',
      x: x + perpX * lateral,
      y: y + perpY * lateral,
      vx: perpX * side * (18 + Math.random() * 20),
      vy: perpY * side * (18 + Math.random() * 20),
      life: 0.38,
      maxLife: 0.38,
      size: (4.6 + Math.random() * 2.2) * scale,
      angle: angle + Math.random() * Math.PI,
      spin: side * 4.5,
      color: 0x67e8f9,
      coreColor: 0xf0f9ff,
      alpha: 0.95,
    });
  }

  /** 003: Расходящийся веерный шлейф из парных золотых шевронов */
  private emitFanTrail(
    x: number,
    y: number,
    rearAngle: number,
    angle: number,
    scale: number,
  ): void {
    const fanAngles = [-0.46, 0.46];
    for (const offset of fanAngles) {
      const a = rearAngle + offset;
      const spd = 75 * scale;
      this.pushNode({
        kind: 'fan_streak',
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 0.26,
        maxLife: 0.26,
        size: 11 * scale,
        angle: angle - offset,
        spin: 0,
        color: 0xfbbf24,
        coreColor: 0xfef08a,
        alpha: 0.92,
      });
    }
  }

  /** 004: Ломаный электрический зигзаг-шлейф */
  private emitRicochetZigzag(
    prevX: number,
    prevY: number,
    x: number,
    y: number,
    perpX: number,
    perpY: number,
    phase: number,
    rarity: MissileRarityRef,
    scale: number,
  ): void {
    const dist = Math.hypot(x - prevX, y - prevY);
    if (dist < 2 || dist > 140) return;

    const sign = phase % 2 === 0 ? 1 : -1;
    const prevSign = -sign;
    const amp = 6.5 * scale;

    const p1x = prevX + perpX * prevSign * amp;
    const p1y = prevY + perpY * prevSign * amp;
    const p2x = x + perpX * sign * amp;
    const p2y = y + perpY * sign * amp;

    const accent = rarity === 'legendary' ? 0xfda4af : rarity === 'rare' ? 0x6ee7b7 : 0xfacc15;
    this.pushNode({
      kind: 'zigzag_arc',
      x: p1x,
      y: p1y,
      x2: p2x,
      y2: p2y,
      vx: 0,
      vy: 0,
      life: 0.24,
      maxLife: 0.24,
      size: 2.3 * scale,
      angle: 0,
      spin: 0,
      color: accent,
      coreColor: 0xffffff,
      alpha: 0.95,
    });
  }

  /** 005: Огненно-дымный взрывной выхлоп с углями */
  private emitExplosiveFireTrail(
    x: number,
    y: number,
    rearAngle: number,
    perpX: number,
    perpY: number,
    scale: number,
  ): void {
    const jitter = (Math.random() - 0.5) * 6;
    this.pushNode({
      kind: 'smoke_puff',
      x: x + perpX * jitter,
      y: y + perpY * jitter,
      vx: Math.cos(rearAngle) * 28 + (Math.random() - 0.5) * 18,
      vy: Math.sin(rearAngle) * 28 + (Math.random() - 0.5) * 18,
      life: 0.42,
      maxLife: 0.42,
      size: 5.5 * scale,
      angle: 0,
      spin: 0,
      color: 0x64748b,
      alpha: 0.48,
    });

    this.pushNode({
      kind: 'flame_puff',
      x,
      y,
      vx: Math.cos(rearAngle) * 55,
      vy: Math.sin(rearAngle) * 55,
      life: 0.2,
      maxLife: 0.2,
      size: 6.2 * scale,
      angle: 0,
      spin: 0,
      color: Math.random() < 0.5 ? 0xf97316 : 0xef4444,
      coreColor: 0xfef08a,
      alpha: 0.95,
    });

    if (Math.random() < 0.7) {
      const emberA = rearAngle + (Math.random() - 0.5) * 0.95;
      const spd = 70 + Math.random() * 90;
      this.pushNode({
        kind: 'ember',
        x,
        y,
        vx: Math.cos(emberA) * spd,
        vy: Math.sin(emberA) * spd,
        life: 0.28,
        maxLife: 0.28,
        size: 2.0 * scale,
        angle: 0,
        spin: 0,
        color: 0xfacc15,
        alpha: 0.95,
      });
    }
  }

  /** 006: Расширяющиеся импульсные ударные кольца */
  private emitImpulseRings(x: number, y: number, angle: number, scale: number): void {
    this.pushNode({
      kind: 'sonic_ring',
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.32,
      maxLife: 0.32,
      size: 5.5 * scale,
      angle,
      spin: 0,
      color: 0x38bdf8,
      coreColor: 0xe0f2fe,
      alpha: 0.92,
    });
  }

  /** 007: Двойная гравитационная спираль и темное ядро сингулярности */
  private emitGravityVortex(
    x: number,
    y: number,
    perpX: number,
    perpY: number,
    rearAngle: number,
    phase: number,
    rarity: MissileRarityRef,
    scale: number,
  ): void {
    const wave = Math.sin(phase * 0.75) * 8.5 * scale;
    const coreTint = rarity === 'legendary' ? 0xf43f5e : rarity === 'rare' ? 0x10b981 : 0x818cf8;

    this.pushNode({
      kind: 'vortex_orb',
      x: x + perpX * wave,
      y: y + perpY * wave,
      vx: perpX * (-wave * 1.4) + Math.cos(rearAngle) * 18,
      vy: perpY * (-wave * 1.4) + Math.sin(rearAngle) * 18,
      life: 0.34,
      maxLife: 0.34,
      size: 3.4 * scale,
      angle: 0,
      spin: 0,
      color: 0xa855f7,
      coreColor: 0xe9d5ff,
      alpha: 0.92,
    });

    this.pushNode({
      kind: 'vortex_orb',
      x: x - perpX * wave,
      y: y - perpY * wave,
      vx: perpX * (wave * 1.4) + Math.cos(rearAngle) * 18,
      vy: perpY * (wave * 1.4) + Math.sin(rearAngle) * 18,
      life: 0.34,
      maxLife: 0.34,
      size: 3.0 * scale,
      angle: 0,
      spin: 0,
      color: coreTint,
      coreColor: 0xffffff,
      alpha: 0.85,
    });
  }

  /** 008: Вращающиеся полые треугольники */
  private emitTriangleTrail(
    x: number,
    y: number,
    rearAngle: number,
    angle: number,
    phase: number,
    scale: number,
  ): void {
    const dir = phase % 2 === 0 ? 1 : -1;
    this.pushNode({
      kind: 'triangle',
      x,
      y,
      vx: Math.cos(rearAngle) * 20,
      vy: Math.sin(rearAngle) * 20,
      life: 0.36,
      maxLife: 0.36,
      size: 6.5 * scale,
      angle,
      spin: dir * 5.2,
      color: 0xf43f5e,
      coreColor: 0xfde047,
      alpha: 0.95,
    });
  }

  /** 009: Двойные параллельные лазерные полосы и прицельные засечки перехватчика */
  private emitInterceptorRails(
    prevX: number,
    prevY: number,
    x: number,
    y: number,
    perpX: number,
    perpY: number,
    phase: number,
    scale: number,
  ): void {
    const dist = Math.hypot(x - prevX, y - prevY);
    if (dist < 2 || dist > 140) return;

    const offset = 5.5 * scale;
    for (const s of [-1, 1]) {
      this.pushNode({
        kind: 'rail_streak',
        x: prevX + perpX * offset * s,
        y: prevY + perpY * offset * s,
        x2: x + perpX * offset * s,
        y2: y + perpY * offset * s,
        vx: 0,
        vy: 0,
        life: 0.24,
        maxLife: 0.24,
        size: 1.8 * scale,
        angle: 0,
        spin: 0,
        color: 0x22d3ee,
        coreColor: 0xffffff,
        alpha: 0.9,
      });
    }

    if (phase % 3 === 0) {
      const tickSpan = 9.5 * scale;
      this.pushNode({
        kind: 'rail_tick',
        x: x - perpX * tickSpan,
        y: y - perpY * tickSpan,
        x2: x + perpX * tickSpan,
        y2: y + perpY * tickSpan,
        vx: 0,
        vy: 0,
        life: 0.22,
        maxLife: 0.22,
        size: 1.5 * scale,
        angle: 0,
        spin: 0,
        color: 0xa5f3fc,
        alpha: 0.85,
      });
    }
  }

  /** 010: Классический сужающийся ионно-реактивный шлейф */
  private emitStandardJetTrail(
    prevX: number,
    prevY: number,
    x: number,
    y: number,
    rearAngle: number,
    rarity: MissileRarityRef,
    scale: number,
    isSub: boolean,
  ): void {
    const dist = Math.hypot(x - prevX, y - prevY);
    if (dist < 2 || dist > 140) return;

    const jetColor = RARITY_PRIMARY_COLOR[rarity];
    this.pushNode({
      kind: 'jet_streak',
      x: prevX,
      y: prevY,
      x2: x,
      y2: y,
      vx: Math.cos(rearAngle) * 14,
      vy: Math.sin(rearAngle) * 14,
      life: isSub ? 0.14 : 0.2,
      maxLife: isSub ? 0.14 : 0.2,
      size: 4.2 * scale,
      angle: 0,
      spin: 0,
      color: jetColor,
      coreColor: 0xffffff,
      alpha: 0.88,
    });
  }

  public update(seconds: number): void {
    if (!this.graphics) return;
    this.graphics.clear();

    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      n.life -= seconds;
      if (n.life <= 0) {
        this.nodes.splice(i, 1);
        continue;
      }

      n.x += n.vx * seconds;
      n.y += n.vy * seconds;
      if (n.x2 !== undefined && n.y2 !== undefined) {
        n.x2 += n.vx * seconds;
        n.y2 += n.vy * seconds;
      }
      n.angle += n.spin * seconds;

      const ratio = n.life / n.maxLife;
      const a = n.alpha * ratio;

      this.drawNode(this.graphics, n, ratio, a);
    }
  }

  private drawNode(
    g: Phaser.GameObjects.Graphics,
    n: VisualTrailNode,
    ratio: number,
    a: number,
  ): void {
    switch (n.kind) {
      case 'plasma_spark': {
        g.fillStyle(n.color, a * 0.7);
        g.fillCircle(n.x, n.y, n.size * (0.5 + ratio * 0.6));
        g.fillStyle(n.coreColor ?? 0xffffff, a);
        g.fillCircle(n.x, n.y, n.size * 0.45 * ratio);
        break;
      }
      case 'frost_mist': {
        const r = n.size * (1.5 - ratio * 0.5);
        g.fillStyle(n.color, a * 0.55);
        g.fillCircle(n.x, n.y, r);
        break;
      }
      case 'ice_crystal': {
        const r = n.size * (0.45 + ratio * 0.55);
        const rSide = r * 0.5;
        const c = Math.cos(n.angle);
        const s = Math.sin(n.angle);
        const px1 = n.x + c * r;
        const py1 = n.y + s * r;
        const px2 = n.x - s * rSide;
        const py2 = n.y + c * rSide;
        const px3 = n.x - c * r;
        const py3 = n.y - s * r;
        const px4 = n.x + s * rSide;
        const py4 = n.y - c * rSide;
        g.fillStyle(n.color, a * 0.65);
        g.beginPath();
        g.moveTo(px1, py1);
        g.lineTo(px2, py2);
        g.lineTo(px3, py3);
        g.lineTo(px4, py4);
        g.closePath();
        g.fillPath();
        g.lineStyle(1.1, n.coreColor ?? 0xffffff, a);
        g.strokePath();
        break;
      }
      case 'fan_streak': {
        const len = n.size * (0.4 + ratio * 0.6);
        const dx = Math.cos(n.angle) * len;
        const dy = Math.sin(n.angle) * len;
        g.lineStyle(3.2 * ratio, n.color, a * 0.65);
        g.lineBetween(n.x - dx, n.y - dy, n.x, n.y);
        g.lineStyle(1.4 * ratio, n.coreColor ?? 0xffffff, a);
        g.lineBetween(n.x - dx * 0.7, n.y - dy * 0.7, n.x, n.y);
        break;
      }
      case 'zigzag_arc': {
        if (n.x2 === undefined || n.y2 === undefined) break;
        g.lineStyle(n.size * 2.1 * ratio, n.color, a * 0.5);
        g.lineBetween(n.x, n.y, n.x2, n.y2);
        g.lineStyle(n.size * ratio, n.coreColor ?? 0xffffff, a);
        g.lineBetween(n.x, n.y, n.x2, n.y2);
        g.fillStyle(n.coreColor ?? 0xffffff, a);
        g.fillCircle(n.x2, n.y2, n.size * 0.85 * ratio);
        break;
      }
      case 'smoke_puff': {
        const r = n.size * (1.7 - ratio * 0.7);
        g.fillStyle(n.color, a * 0.6);
        g.fillCircle(n.x, n.y, r);
        break;
      }
      case 'flame_puff': {
        const r = n.size * (0.4 + ratio * 0.75);
        g.fillStyle(n.color, a * 0.78);
        g.fillCircle(n.x, n.y, r);
        g.fillStyle(n.coreColor ?? 0xfef08a, a);
        g.fillCircle(n.x, n.y, r * 0.45);
        break;
      }
      case 'ember': {
        g.fillStyle(n.color, a);
        g.fillCircle(n.x, n.y, n.size * ratio);
        break;
      }
      case 'sonic_ring': {
        const r = n.size * (2.6 - ratio * 1.6);
        g.lineStyle(2.4 * ratio + 0.5, n.color, a * 0.75);
        g.strokeCircle(n.x, n.y, r);
        g.lineStyle(1.0, n.coreColor ?? 0xffffff, a * 0.55);
        g.strokeCircle(n.x, n.y, r * 0.72);
        break;
      }
      case 'vortex_orb': {
        const r = n.size * (0.45 + ratio * 0.65);
        g.fillStyle(n.color, a * 0.65);
        g.fillCircle(n.x, n.y, r * 1.45);
        g.fillStyle(n.coreColor ?? 0xffffff, a);
        g.fillCircle(n.x, n.y, r * 0.55);
        break;
      }
      case 'triangle': {
        const r = n.size * (1.35 - ratio * 0.35);
        const step = (Math.PI * 2) / 3;
        const p1x = n.x + Math.cos(n.angle) * r;
        const p1y = n.y + Math.sin(n.angle) * r;
        const p2x = n.x + Math.cos(n.angle + step) * r;
        const p2y = n.y + Math.sin(n.angle + step) * r;
        const p3x = n.x + Math.cos(n.angle + step * 2) * r;
        const p3y = n.y + Math.sin(n.angle + step * 2) * r;
        g.lineStyle(2.2 * ratio + 0.6, n.color, a * 0.85);
        g.strokeTriangle(p1x, p1y, p2x, p2y, p3x, p3y);
        g.fillStyle(n.coreColor ?? 0xfde047, a * 0.8);
        g.fillCircle(n.x, n.y, 1.8 * ratio);
        break;
      }
      case 'rail_streak': {
        if (n.x2 === undefined || n.y2 === undefined) break;
        g.lineStyle(n.size * 1.8 * ratio, n.color, a * 0.55);
        g.lineBetween(n.x, n.y, n.x2, n.y2);
        g.lineStyle(n.size * 0.75 * ratio, n.coreColor ?? 0xffffff, a);
        g.lineBetween(n.x, n.y, n.x2, n.y2);
        break;
      }
      case 'rail_tick': {
        if (n.x2 === undefined || n.y2 === undefined) break;
        g.lineStyle(n.size * ratio, n.color, a * 0.85);
        g.lineBetween(n.x, n.y, n.x2, n.y2);
        break;
      }
      case 'jet_streak': {
        if (n.x2 === undefined || n.y2 === undefined) break;
        g.lineStyle(n.size * ratio, n.color, a * 0.55);
        g.lineBetween(n.x, n.y, n.x2, n.y2);
        g.lineStyle(n.size * 0.42 * ratio, n.coreColor ?? 0xffffff, a * 0.92);
        g.lineBetween(n.x, n.y, n.x2, n.y2);
        break;
      }
    }
  }
}
