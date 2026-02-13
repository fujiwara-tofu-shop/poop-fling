import * as THREE from 'three';
import { LEVEL_GEN, BLOCKS, MONKEY, WORLD } from '../core/Constants';
import { gameState } from '../core/GameState';

export interface BlockData {
  position: THREE.Vector3;
  size: THREE.Vector3;
  type: 'wood' | 'stone' | 'glass';
  health: number;
}

export interface MonkeyData {
  position: THREE.Vector3;
}

export interface LevelData {
  blocks: BlockData[];
  monkeys: MonkeyData[];
  ammo: number;
}

// Seeded random number generator for deterministic levels
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  pick<T>(arr: T[]): T {
    return arr[this.nextInt(0, arr.length - 1)];
  }
}

export class LevelGenerator {
  generate(levelNumber: number): LevelData {
    const rng = new SeededRandom(gameState.seed + levelNumber * 7919);

    const difficulty = LEVEL_GEN.BASE_DIFFICULTY + (levelNumber - 1) * LEVEL_GEN.DIFFICULTY_SCALE;

    // Calculate level parameters based on difficulty
    const numMonkeys = Math.min(
      Math.floor(LEVEL_GEN.MIN_MONKEYS + difficulty),
      LEVEL_GEN.MAX_MONKEYS
    );
    const numBlocks = Math.min(
      Math.floor(LEVEL_GEN.MIN_BLOCKS + difficulty * 3),
      LEVEL_GEN.MAX_BLOCKS
    );
    const ammo = Math.max(3, numMonkeys + 1);

    const blocks: BlockData[] = [];
    const monkeys: MonkeyData[] = [];

    // Generate structure type based on level
    const structureType = levelNumber % 5;

    switch (structureType) {
      case 1:
        this.generateTower(rng, blocks, monkeys, numBlocks, numMonkeys);
        break;
      case 2:
        this.generatePyramid(rng, blocks, monkeys, numBlocks, numMonkeys);
        break;
      case 3:
        this.generateBridge(rng, blocks, monkeys, numBlocks, numMonkeys);
        break;
      case 4:
        this.generateCastle(rng, blocks, monkeys, numBlocks, numMonkeys);
        break;
      default:
        this.generateBasicStack(rng, blocks, monkeys, numBlocks, numMonkeys);
    }

    return { blocks, monkeys, ammo };
  }

  private generateBasicStack(
    rng: SeededRandom,
    blocks: BlockData[],
    monkeys: MonkeyData[],
    numBlocks: number,
    numMonkeys: number
  ): void {
    const baseX = WORLD.STRUCTURE_START_X;
    const blockSize = LEVEL_GEN.BLOCK_SIZE;

    // Create layers of blocks
    const layers = Math.ceil(numBlocks / 3);
    let blocksPlaced = 0;

    for (let layer = 0; layer < layers && blocksPlaced < numBlocks; layer++) {
      const y = layer * blockSize + blockSize / 2;
      const blocksInLayer = Math.min(3, numBlocks - blocksPlaced);

      for (let i = 0; i < blocksInLayer; i++) {
        const x = baseX + (i - (blocksInLayer - 1) / 2) * blockSize * 1.2;
        const type = this.getBlockType(rng, layer);

        blocks.push({
          position: new THREE.Vector3(x, y, 0),
          size: new THREE.Vector3(blockSize, blockSize, blockSize),
          type,
          health: BLOCKS[type.toUpperCase() as keyof typeof BLOCKS].HEALTH,
        });
        blocksPlaced++;
      }
    }

    // Place monkeys on top
    for (let i = 0; i < numMonkeys; i++) {
      const x = baseX + rng.nextFloat(-1, 1);
      const y = layers * blockSize + MONKEY.BODY_RADIUS + 0.1;
      monkeys.push({ position: new THREE.Vector3(x, y, rng.nextFloat(-0.3, 0.3)) });
    }
  }

  private generateTower(
    rng: SeededRandom,
    blocks: BlockData[],
    monkeys: MonkeyData[],
    numBlocks: number,
    numMonkeys: number
  ): void {
    const baseX = WORLD.STRUCTURE_START_X + 2;
    const blockSize = LEVEL_GEN.BLOCK_SIZE;

    // Tall thin tower
    const height = Math.min(numBlocks, 8);
    let blocksPlaced = 0;

    for (let y = 0; y < height && blocksPlaced < numBlocks; y++) {
      const type = this.getBlockType(rng, y);
      blocks.push({
        position: new THREE.Vector3(baseX, y * blockSize + blockSize / 2, 0),
        size: new THREE.Vector3(blockSize, blockSize, blockSize),
        type,
        health: BLOCKS[type.toUpperCase() as keyof typeof BLOCKS].HEALTH,
      });
      blocksPlaced++;

      // Add horizontal supports every 2 levels
      if (y % 2 === 1 && blocksPlaced < numBlocks) {
        blocks.push({
          position: new THREE.Vector3(baseX - blockSize, y * blockSize + blockSize / 2, 0),
          size: new THREE.Vector3(blockSize, blockSize * 0.5, blockSize),
          type: 'wood',
          health: BLOCKS.WOOD.HEALTH,
        });
        blocksPlaced++;
      }
    }

    // Monkeys at different heights
    for (let i = 0; i < numMonkeys; i++) {
      const y = (height - 1 - i) * blockSize + blockSize + MONKEY.BODY_RADIUS;
      monkeys.push({
        position: new THREE.Vector3(baseX + 0.8, Math.max(y, MONKEY.BODY_RADIUS + 0.1), 0),
      });
    }
  }

  private generatePyramid(
    rng: SeededRandom,
    blocks: BlockData[],
    monkeys: MonkeyData[],
    numBlocks: number,
    numMonkeys: number
  ): void {
    const baseX = WORLD.STRUCTURE_START_X;
    const blockSize = LEVEL_GEN.BLOCK_SIZE;

    // Pyramid structure
    let layer = 0;
    let blocksPlaced = 0;
    let layerWidth = 4;

    while (layerWidth > 0 && blocksPlaced < numBlocks) {
      const y = layer * blockSize + blockSize / 2;

      for (let i = 0; i < layerWidth && blocksPlaced < numBlocks; i++) {
        const x = baseX + (i - (layerWidth - 1) / 2) * blockSize;
        const type = this.getBlockType(rng, layer);

        blocks.push({
          position: new THREE.Vector3(x, y, 0),
          size: new THREE.Vector3(blockSize, blockSize, blockSize),
          type,
          health: BLOCKS[type.toUpperCase() as keyof typeof BLOCKS].HEALTH,
        });
        blocksPlaced++;
      }

      layer++;
      layerWidth--;
    }

    // Monkey on top
    const topY = layer * blockSize + MONKEY.BODY_RADIUS;
    for (let i = 0; i < numMonkeys; i++) {
      monkeys.push({
        position: new THREE.Vector3(baseX + i * 0.5, topY + i * 0.3, 0),
      });
    }
  }

  private generateBridge(
    rng: SeededRandom,
    blocks: BlockData[],
    monkeys: MonkeyData[],
    numBlocks: number,
    numMonkeys: number
  ): void {
    const baseX = WORLD.STRUCTURE_START_X;
    const blockSize = LEVEL_GEN.BLOCK_SIZE;

    // Two pillars with a bridge
    const pillarHeight = 3;
    let blocksPlaced = 0;

    // Left pillar
    for (let y = 0; y < pillarHeight && blocksPlaced < numBlocks; y++) {
      blocks.push({
        position: new THREE.Vector3(baseX, y * blockSize + blockSize / 2, 0),
        size: new THREE.Vector3(blockSize, blockSize, blockSize),
        type: 'stone',
        health: BLOCKS.STONE.HEALTH,
      });
      blocksPlaced++;
    }

    // Right pillar
    for (let y = 0; y < pillarHeight && blocksPlaced < numBlocks; y++) {
      blocks.push({
        position: new THREE.Vector3(baseX + 4, y * blockSize + blockSize / 2, 0),
        size: new THREE.Vector3(blockSize, blockSize, blockSize),
        type: 'stone',
        health: BLOCKS.STONE.HEALTH,
      });
      blocksPlaced++;
    }

    // Bridge planks
    for (let i = 0; i < 3 && blocksPlaced < numBlocks; i++) {
      blocks.push({
        position: new THREE.Vector3(baseX + 1 + i, pillarHeight * blockSize + blockSize / 2, 0),
        size: new THREE.Vector3(blockSize * 1.2, blockSize * 0.3, blockSize),
        type: 'wood',
        health: BLOCKS.WOOD.HEALTH,
      });
      blocksPlaced++;
    }

    // Monkeys on the bridge
    for (let i = 0; i < numMonkeys; i++) {
      monkeys.push({
        position: new THREE.Vector3(
          baseX + 1.5 + i * 0.8,
          pillarHeight * blockSize + blockSize + MONKEY.BODY_RADIUS,
          0
        ),
      });
    }
  }

  private generateCastle(
    rng: SeededRandom,
    blocks: BlockData[],
    monkeys: MonkeyData[],
    numBlocks: number,
    numMonkeys: number
  ): void {
    const baseX = WORLD.STRUCTURE_START_X;
    const blockSize = LEVEL_GEN.BLOCK_SIZE;
    let blocksPlaced = 0;

    // Castle base
    for (let i = 0; i < 5 && blocksPlaced < numBlocks; i++) {
      blocks.push({
        position: new THREE.Vector3(baseX + i * blockSize * 0.9, blockSize / 2, 0),
        size: new THREE.Vector3(blockSize, blockSize, blockSize),
        type: 'stone',
        health: BLOCKS.STONE.HEALTH,
      });
      blocksPlaced++;
    }

    // Towers at edges
    for (let y = 1; y < 3 && blocksPlaced < numBlocks; y++) {
      blocks.push({
        position: new THREE.Vector3(baseX, y * blockSize + blockSize / 2, 0),
        size: new THREE.Vector3(blockSize, blockSize, blockSize),
        type: 'stone',
        health: BLOCKS.STONE.HEALTH,
      });
      blocksPlaced++;

      blocks.push({
        position: new THREE.Vector3(baseX + 4 * blockSize * 0.9, y * blockSize + blockSize / 2, 0),
        size: new THREE.Vector3(blockSize, blockSize, blockSize),
        type: 'stone',
        health: BLOCKS.STONE.HEALTH,
      });
      blocksPlaced++;
    }

    // Glass windows
    blocks.push({
      position: new THREE.Vector3(baseX + 2 * blockSize * 0.9, blockSize * 1.5, 0),
      size: new THREE.Vector3(blockSize, blockSize, blockSize * 0.3),
      type: 'glass',
      health: BLOCKS.GLASS.HEALTH,
    });
    blocksPlaced++;

    // Monkeys inside castle
    for (let i = 0; i < numMonkeys; i++) {
      monkeys.push({
        position: new THREE.Vector3(
          baseX + 1.5 + i * 0.6,
          blockSize + MONKEY.BODY_RADIUS + 0.1,
          0
        ),
      });
    }
  }

  private getBlockType(rng: SeededRandom, layer: number): 'wood' | 'stone' | 'glass' {
    const rand = rng.next();
    if (layer === 0) {
      // Base layer is usually stronger
      return rand < 0.7 ? 'stone' : 'wood';
    } else if (rand < 0.2) {
      return 'glass';
    } else if (rand < 0.5) {
      return 'stone';
    } else {
      return 'wood';
    }
  }
}
