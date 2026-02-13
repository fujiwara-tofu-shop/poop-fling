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
}

export class LevelGenerator {
  generate(levelNumber: number): LevelData {
    const rng = new SeededRandom(gameState.seed + levelNumber * 7919);

    const difficulty = LEVEL_GEN.BASE_DIFFICULTY + (levelNumber - 1) * LEVEL_GEN.DIFFICULTY_SCALE;

    const numMonkeys = Math.min(
      Math.floor(LEVEL_GEN.MIN_MONKEYS + difficulty * 0.5),
      LEVEL_GEN.MAX_MONKEYS
    );
    const numBlocks = Math.min(
      Math.floor(LEVEL_GEN.MIN_BLOCKS + difficulty * 3),
      LEVEL_GEN.MAX_BLOCKS
    );
    const ammo = Math.max(3, numMonkeys + 2);

    const blocks: BlockData[] = [];
    const monkeys: MonkeyData[] = [];

    // Pick structure type based on level
    const structureType = levelNumber % 5;
    const baseX = WORLD.STRUCTURE_START_X;
    
    switch (structureType) {
      case 1:
        this.generateTower(rng, blocks, monkeys, numBlocks, numMonkeys, baseX);
        break;
      case 2:
        this.generatePyramid(rng, blocks, monkeys, numBlocks, numMonkeys, baseX);
        break;
      case 3:
        this.generateBridge(rng, blocks, monkeys, numBlocks, numMonkeys, baseX);
        break;
      case 4:
        this.generateCastle(rng, blocks, monkeys, numBlocks, numMonkeys, baseX);
        break;
      default:
        this.generateStack(rng, blocks, monkeys, numBlocks, numMonkeys, baseX);
    }

    return { blocks, monkeys, ammo };
  }

  private generateStack(
    rng: SeededRandom,
    blocks: BlockData[],
    monkeys: MonkeyData[],
    numBlocks: number,
    numMonkeys: number,
    baseX: number
  ): void {
    const blockSize = LEVEL_GEN.BLOCK_SIZE;
    const width = 3;
    let blocksPlaced = 0;
    let layer = 0;

    while (blocksPlaced < numBlocks) {
      for (let i = 0; i < width && blocksPlaced < numBlocks; i++) {
        const x = baseX + (i - 1) * blockSize * 1.1;
        const y = layer * blockSize + blockSize / 2;
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
    }

    // Monkeys on top
    for (let i = 0; i < numMonkeys; i++) {
      const x = baseX + (i - (numMonkeys - 1) / 2) * 1.2;
      const y = layer * blockSize + MONKEY.BODY_RADIUS + 0.2;
      monkeys.push({ position: new THREE.Vector3(x, y, 0) });
    }
  }

  private generateTower(
    rng: SeededRandom,
    blocks: BlockData[],
    monkeys: MonkeyData[],
    numBlocks: number,
    numMonkeys: number,
    baseX: number
  ): void {
    const blockSize = LEVEL_GEN.BLOCK_SIZE;
    let blocksPlaced = 0;

    // Central tower
    for (let y = 0; blocksPlaced < numBlocks; y++) {
      const type = y === 0 ? 'stone' : this.getBlockType(rng, y);
      blocks.push({
        position: new THREE.Vector3(baseX, y * blockSize + blockSize / 2, 0),
        size: new THREE.Vector3(blockSize, blockSize, blockSize),
        type,
        health: BLOCKS[type.toUpperCase() as keyof typeof BLOCKS].HEALTH,
      });
      blocksPlaced++;

      // Side supports every other level
      if (y % 2 === 0 && blocksPlaced < numBlocks) {
        blocks.push({
          position: new THREE.Vector3(baseX - blockSize * 1.1, y * blockSize + blockSize / 2, 0),
          size: new THREE.Vector3(blockSize * 0.8, blockSize, blockSize),
          type: 'wood',
          health: BLOCKS.WOOD.HEALTH,
        });
        blocksPlaced++;
      }
      if (y % 2 === 1 && blocksPlaced < numBlocks) {
        blocks.push({
          position: new THREE.Vector3(baseX + blockSize * 1.1, y * blockSize + blockSize / 2, 0),
          size: new THREE.Vector3(blockSize * 0.8, blockSize, blockSize),
          type: 'wood',
          health: BLOCKS.WOOD.HEALTH,
        });
        blocksPlaced++;
      }
    }

    const height = Math.ceil(numBlocks / 2);
    for (let i = 0; i < numMonkeys; i++) {
      const y = (height - i) * blockSize + MONKEY.BODY_RADIUS;
      const side = i % 2 === 0 ? 1.3 : -1.3;
      monkeys.push({ position: new THREE.Vector3(baseX + side, Math.max(y, 1), 0) });
    }
  }

  private generatePyramid(
    rng: SeededRandom,
    blocks: BlockData[],
    monkeys: MonkeyData[],
    numBlocks: number,
    numMonkeys: number,
    baseX: number
  ): void {
    const blockSize = LEVEL_GEN.BLOCK_SIZE;
    let blocksPlaced = 0;
    let layer = 0;
    let layerWidth = 5;

    while (layerWidth > 0 && blocksPlaced < numBlocks) {
      for (let i = 0; i < layerWidth && blocksPlaced < numBlocks; i++) {
        const x = baseX + (i - (layerWidth - 1) / 2) * blockSize;
        const y = layer * blockSize + blockSize / 2;
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
    for (let i = 0; i < numMonkeys; i++) {
      const y = layer * blockSize + MONKEY.BODY_RADIUS + 0.2 + i * 0.5;
      monkeys.push({ position: new THREE.Vector3(baseX, y, 0) });
    }
  }

  private generateBridge(
    rng: SeededRandom,
    blocks: BlockData[],
    monkeys: MonkeyData[],
    numBlocks: number,
    numMonkeys: number,
    baseX: number
  ): void {
    const blockSize = LEVEL_GEN.BLOCK_SIZE;
    const pillarHeight = 3;
    const bridgeWidth = 4;
    let blocksPlaced = 0;

    // Left pillar
    for (let y = 0; y < pillarHeight && blocksPlaced < numBlocks; y++) {
      blocks.push({
        position: new THREE.Vector3(baseX - bridgeWidth/2 * blockSize, y * blockSize + blockSize / 2, 0),
        size: new THREE.Vector3(blockSize, blockSize, blockSize),
        type: 'stone',
        health: BLOCKS.STONE.HEALTH,
      });
      blocksPlaced++;
    }

    // Right pillar
    for (let y = 0; y < pillarHeight && blocksPlaced < numBlocks; y++) {
      blocks.push({
        position: new THREE.Vector3(baseX + bridgeWidth/2 * blockSize, y * blockSize + blockSize / 2, 0),
        size: new THREE.Vector3(blockSize, blockSize, blockSize),
        type: 'stone',
        health: BLOCKS.STONE.HEALTH,
      });
      blocksPlaced++;
    }

    // Bridge planks
    for (let i = 0; i < bridgeWidth && blocksPlaced < numBlocks; i++) {
      blocks.push({
        position: new THREE.Vector3(
          baseX + (i - (bridgeWidth - 1) / 2) * blockSize,
          pillarHeight * blockSize + blockSize * 0.3,
          0
        ),
        size: new THREE.Vector3(blockSize * 1.1, blockSize * 0.4, blockSize),
        type: 'wood',
        health: BLOCKS.WOOD.HEALTH,
      });
      blocksPlaced++;
    }

    // Monkeys on bridge - position them to rest on top of planks
    // Planks top is at: pillarHeight * blockSize + blockSize * 0.3 + (blockSize * 0.4 / 2)
    const plankTop = pillarHeight * blockSize + blockSize * 0.3 + blockSize * 0.2;
    for (let i = 0; i < numMonkeys; i++) {
      const x = baseX + (i - (numMonkeys - 1) / 2) * 1.0;
      const y = plankTop + MONKEY.BODY_RADIUS;
      monkeys.push({ position: new THREE.Vector3(x, y, 0) });
    }
  }

  private generateCastle(
    rng: SeededRandom,
    blocks: BlockData[],
    monkeys: MonkeyData[],
    numBlocks: number,
    numMonkeys: number,
    baseX: number
  ): void {
    const blockSize = LEVEL_GEN.BLOCK_SIZE;
    let blocksPlaced = 0;
    const width = 5;

    // Base wall
    for (let i = 0; i < width && blocksPlaced < numBlocks; i++) {
      blocks.push({
        position: new THREE.Vector3(baseX + (i - (width-1)/2) * blockSize, blockSize / 2, 0),
        size: new THREE.Vector3(blockSize, blockSize, blockSize),
        type: 'stone',
        health: BLOCKS.STONE.HEALTH,
      });
      blocksPlaced++;
    }

    // Towers on ends
    for (let y = 1; y < 4 && blocksPlaced < numBlocks; y++) {
      blocks.push({
        position: new THREE.Vector3(baseX - 2 * blockSize, y * blockSize + blockSize / 2, 0),
        size: new THREE.Vector3(blockSize, blockSize, blockSize),
        type: y < 2 ? 'stone' : 'wood',
        health: y < 2 ? BLOCKS.STONE.HEALTH : BLOCKS.WOOD.HEALTH,
      });
      blocksPlaced++;

      if (blocksPlaced < numBlocks) {
        blocks.push({
          position: new THREE.Vector3(baseX + 2 * blockSize, y * blockSize + blockSize / 2, 0),
          size: new THREE.Vector3(blockSize, blockSize, blockSize),
          type: y < 2 ? 'stone' : 'wood',
          health: y < 2 ? BLOCKS.STONE.HEALTH : BLOCKS.WOOD.HEALTH,
        });
        blocksPlaced++;
      }
    }

    // Glass window in middle
    if (blocksPlaced < numBlocks) {
      blocks.push({
        position: new THREE.Vector3(baseX, blockSize * 1.5, 0),
        size: new THREE.Vector3(blockSize, blockSize, blockSize * 0.5),
        type: 'glass',
        health: BLOCKS.GLASS.HEALTH,
      });
      blocksPlaced++;
    }

    // Monkeys inside
    for (let i = 0; i < numMonkeys; i++) {
      const x = baseX + (i - (numMonkeys - 1) / 2) * 1.0;
      monkeys.push({ position: new THREE.Vector3(x, blockSize + MONKEY.BODY_RADIUS + 0.2, 0) });
    }
  }

  private getBlockType(rng: SeededRandom, layer: number): 'wood' | 'stone' | 'glass' {
    const rand = rng.next();
    if (layer === 0) {
      return rand < 0.8 ? 'stone' : 'wood';
    } else if (rand < 0.15) {
      return 'glass';
    } else if (rand < 0.4) {
      return 'stone';
    } else {
      return 'wood';
    }
  }
}
