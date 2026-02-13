import { GAME } from './Constants';

interface LevelState {
  current: number;
  monkeysRemaining: number;
  monkeysTotal: number;
  blocksRemaining: number;
}

interface PlayerState {
  score: number;
  totalScore: number;
  ammo: number;
}

interface GameFlags {
  started: boolean;
  paused: boolean;
  isPlaying: boolean;
  isAiming: boolean;
  isWaitingForSettle: boolean;
  levelComplete: boolean;
  gameOver: boolean;
}

class GameState {
  level: LevelState = {
    current: 1,
    monkeysRemaining: 0,
    monkeysTotal: 0,
    blocksRemaining: 0,
  };

  player: PlayerState = {
    score: 0,
    totalScore: 0,
    ammo: GAME.INITIAL_AMMO,
  };

  game: GameFlags = {
    started: false,
    paused: false,
    isPlaying: false,
    isAiming: false,
    isWaitingForSettle: false,
    levelComplete: false,
    gameOver: false,
  };

  // Deterministic random seed for level generation
  seed: number = 12345;

  reset(): void {
    this.level = {
      current: 1,
      monkeysRemaining: 0,
      monkeysTotal: 0,
      blocksRemaining: 0,
    };
    this.player = {
      score: 0,
      totalScore: 0,
      ammo: GAME.INITIAL_AMMO,
    };
    this.game = {
      started: false,
      paused: false,
      isPlaying: false,
      isAiming: false,
      isWaitingForSettle: false,
      levelComplete: false,
      gameOver: false,
    };
    this.seed = 12345;
  }

  resetLevel(): void {
    this.player.score = 0;
    this.player.ammo = GAME.INITIAL_AMMO;
    this.game.isPlaying = true;
    this.game.isAiming = false;
    this.game.isWaitingForSettle = false;
    this.game.levelComplete = false;
    this.game.gameOver = false;
  }

  nextLevel(): void {
    this.level.current++;
    this.player.totalScore += this.player.score;
    this.resetLevel();
    // Update seed for new level (deterministic)
    this.seed = this.seed * 1103515245 + 12345;
  }
}

export const gameState = new GameState();
