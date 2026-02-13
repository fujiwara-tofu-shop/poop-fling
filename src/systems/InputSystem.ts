import * as THREE from 'three';
import { eventBus, Events } from '../core/EventBus';
import { gameState } from '../core/GameState';
import { GAME } from '../core/Constants';

export class InputSystem {
  private isDragging = false;
  private startPos = new THREE.Vector2();
  private currentPos = new THREE.Vector2();
  
  constructor(private canvas: HTMLCanvasElement) {
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

    const launchData = this.calculateLaunchData();
    const pullX = this.startPos.x - this.currentPos.x;
    const pullY = this.startPos.y - this.currentPos.y;

    eventBus.emit(Events.AIM_UPDATE, { ...launchData, pullX, pullY });
  }

  private handlePointerUp(): void {
    if (!this.isDragging) return;

    this.isDragging = false;
    gameState.game.isAiming = false;

    const launchData = this.calculateLaunchData();

    // Only launch if there's significant pull
    if (launchData.power > 5) {
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

  private calculateLaunchData(): {
    velocity: THREE.Vector3;
    power: number;
    angle: number;
  } {
    // Pull vector: from current position back to start (drag direction)
    const dx = this.startPos.x - this.currentPos.x;
    const dy = this.startPos.y - this.currentPos.y;
    
    const pullLength = Math.sqrt(dx * dx + dy * dy);
    const normalizedPull = Math.min(pullLength / 150, 1); // Max pull at 150px

    // Power scales with pull distance
    const power = GAME.LAUNCH_POWER_MIN + normalizedPull * (GAME.LAUNCH_POWER_MAX - GAME.LAUNCH_POWER_MIN);

    // Launch direction is opposite of pull
    // If you drag down-left, launch goes up-right
    // Screen Y is inverted (down = positive), so we flip dy
    const launchDirX = dx;  // Pull left = launch right
    const launchDirY = -dy; // Pull down = launch up (screen coords inverted)
    
    // Normalize the direction
    const dirLength = Math.sqrt(launchDirX * launchDirX + launchDirY * launchDirY);
    
    let normX = 1;
    let normY = 0.5;
    
    if (dirLength > 0.001) {
      normX = launchDirX / dirLength;
      normY = launchDirY / dirLength;
    }
    
    // Ensure we're always launching forward and somewhat upward
    // Clamp the angle between 15 and 75 degrees
    let angle = Math.atan2(normY, normX) * (180 / Math.PI);
    angle = Math.max(GAME.LAUNCH_ANGLE_MIN, Math.min(GAME.LAUNCH_ANGLE_MAX, angle));
    
    // If dragging right (wrong direction), default to 45 degrees
    if (dx < 0) {
      angle = 45;
    }
    
    const angleRad = angle * (Math.PI / 180);

    // Calculate velocity vector
    const velocity = new THREE.Vector3(
      Math.cos(angleRad) * power,
      Math.sin(angleRad) * power,
      0
    );

    return { velocity, power, angle };
  }

  destroy(): void {
    // Remove event listeners if needed
  }
}
