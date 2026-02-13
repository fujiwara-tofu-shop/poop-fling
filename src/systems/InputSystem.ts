import * as THREE from 'three';
import { eventBus, Events } from '../core/EventBus';
import { gameState } from '../core/GameState';
import { GAME, WORLD } from '../core/Constants';

export class InputSystem {
  private isDragging = false;
  private startPos = new THREE.Vector2();
  private currentPos = new THREE.Vector2();
  private slingshotOrigin: THREE.Vector3;
  
  constructor(private canvas: HTMLCanvasElement) {
    this.slingshotOrigin = new THREE.Vector3(
      WORLD.SLINGSHOT_POSITION.x,
      WORLD.SLINGSHOT_POSITION.y,
      WORLD.SLINGSHOT_POSITION.z
    );
    
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Mouse events
    this.canvas.addEventListener('mousedown', this.onPointerDown.bind(this));
    this.canvas.addEventListener('mousemove', this.onPointerMove.bind(this));
    this.canvas.addEventListener('mouseup', this.onPointerUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.onPointerUp.bind(this));

    // Touch events
    this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
    this.canvas.addEventListener('touchcancel', this.onTouchEnd.bind(this), { passive: false });
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      this.handlePointerDown(touch.clientX, touch.clientY);
    }
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      this.handlePointerMove(touch.clientX, touch.clientY);
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    this.handlePointerUp();
  }

  private onPointerDown(e: MouseEvent): void {
    this.handlePointerDown(e.clientX, e.clientY);
  }

  private onPointerMove(e: MouseEvent): void {
    this.handlePointerMove(e.clientX, e.clientY);
  }

  private onPointerUp(): void {
    this.handlePointerUp();
  }

  private handlePointerDown(x: number, y: number): void {
    if (!gameState.game.isPlaying || gameState.game.isWaitingForSettle) return;
    if (gameState.player.ammo <= 0) return;

    this.isDragging = true;
    this.startPos.set(x, y);
    this.currentPos.set(x, y);
    gameState.game.isAiming = true;

    eventBus.emit(Events.AIM_START);
  }

  private handlePointerMove(x: number, y: number): void {
    if (!this.isDragging) return;

    this.currentPos.set(x, y);

    const pullVector = this.calculatePullVector();
    const launchData = this.calculateLaunchData(pullVector);

    eventBus.emit(Events.AIM_UPDATE, {
      pullVector,
      ...launchData,
    });
  }

  private handlePointerUp(): void {
    if (!this.isDragging) return;

    this.isDragging = false;
    gameState.game.isAiming = false;

    const pullVector = this.calculatePullVector();
    const launchData = this.calculateLaunchData(pullVector);

    // Only launch if there's significant pull
    if (launchData.power > 2) {
      eventBus.emit(Events.AIM_RELEASE, {
        velocity: launchData.velocity,
        power: launchData.power,
        angle: launchData.angle,
      });
    } else {
      // Cancel aiming
      eventBus.emit(Events.AIM_UPDATE, { cancelled: true });
    }
  }

  private calculatePullVector(): THREE.Vector2 {
    const dx = this.startPos.x - this.currentPos.x;
    const dy = this.startPos.y - this.currentPos.y;
    return new THREE.Vector2(dx, dy);
  }

  private calculateLaunchData(pullVector: THREE.Vector2): {
    velocity: THREE.Vector3;
    power: number;
    angle: number;
  } {
    // Convert screen pull to game velocity
    const pullLength = pullVector.length();
    const normalizedPull = Math.min(pullLength / 200, 1); // Max pull at 200px

    // Power scales with pull distance
    const power = GAME.LAUNCH_POWER_MIN + normalizedPull * (GAME.LAUNCH_POWER_MAX - GAME.LAUNCH_POWER_MIN);

    // Angle based on pull direction (pull down-left to launch up-right)
    const pullAngle = Math.atan2(pullVector.y, pullVector.x);
    const launchAngle = Math.max(
      GAME.LAUNCH_ANGLE_MIN,
      Math.min(GAME.LAUNCH_ANGLE_MAX, (pullAngle * 180) / Math.PI)
    );
    const launchAngleRad = (launchAngle * Math.PI) / 180;

    // Calculate velocity vector
    const velocity = new THREE.Vector3(
      Math.cos(launchAngleRad) * power,
      Math.sin(launchAngleRad) * power,
      0
    );

    return { velocity, power, angle: launchAngle };
  }

  getPullAmount(): number {
    if (!this.isDragging) return 0;
    const pullVector = this.calculatePullVector();
    return Math.min(pullVector.length() / 200, 1);
  }

  destroy(): void {
    // Remove event listeners if needed
  }
}
