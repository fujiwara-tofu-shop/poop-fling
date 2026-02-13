type EventCallback = (data?: any) => void;

class EventBus {
  private listeners = new Map<string, Set<EventCallback>>();

  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  once(event: string, callback: EventCallback): void {
    const wrapper: EventCallback = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    this.on(event, wrapper);
  }

  off(event: string, callback: EventCallback): void {
    const cbs = this.listeners.get(event);
    if (cbs) {
      cbs.delete(callback);
      if (cbs.size === 0) this.listeners.delete(event);
    }
  }

  emit(event: string, data?: unknown): void {
    const cbs = this.listeners.get(event);
    if (cbs) {
      cbs.forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error(`EventBus error [${event}]:`, e);
        }
      });
    }
  }

  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

export const eventBus = new EventBus();

// Event names
export const Events = {
  // Game flow
  GAME_START: 'game:start',
  GAME_OVER: 'game:over',
  GAME_PAUSE: 'game:pause',
  GAME_RESUME: 'game:resume',
  
  // Level
  LEVEL_START: 'level:start',
  LEVEL_COMPLETE: 'level:complete',
  LEVEL_FAILED: 'level:failed',
  LEVEL_RESET: 'level:reset',
  
  // Poop
  POOP_READY: 'poop:ready',
  POOP_LAUNCHED: 'poop:launched',
  POOP_HIT: 'poop:hit',
  POOP_SETTLED: 'poop:settled',
  AMMO_CHANGED: 'ammo:changed',
  
  // Targets
  MONKEY_HIT: 'monkey:hit',
  MONKEY_KILLED: 'monkey:killed',
  BLOCK_HIT: 'block:hit',
  BLOCK_DESTROYED: 'block:destroyed',
  
  // Score
  SCORE_CHANGED: 'score:changed',
  POINTS_ADDED: 'points:added',
  
  // Input
  AIM_START: 'input:aim_start',
  AIM_UPDATE: 'input:aim_update',
  AIM_RELEASE: 'input:aim_release',
  
  // UI
  UI_UPDATE: 'ui:update',
} as const;
