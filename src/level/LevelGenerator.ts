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

    const numMonkeys = Math.min(
      Math.floor(LEVEL_GEN.MIN_MONKEYS + difficulty * 0.5),
      LEVEL_GEN.MAX_MONKEYS
    );
    const numBlocks = Math.min(
      Math.floor(LEVEL_GEN.MIN_BLOCKS + difficulty * 4),
      LEVEL_GEN.MAX_BLOCKS
    );
    const ammo = Math.max(3, numMonkeys + 2);

    const blocks: BlockData[] = [];
    const monkeys: MonkeyData[] = [];

    // Generate 1-3 structures spread across the play area
    const numStructures = Math.min(1 + Math.floor(levelNumber / 3), 3);
    
    for (let s = 0; s < numStructures; s++) {
      const structX = WORLD.STRUCTURE_START_X + s * 6;
      const structZ = rng.nextFloat(-3, 3);
      const blocksForThis = Math.ceil(numBlocks / numStructures);
      const monkeysForThis = Math.ceil(numMonkeys / numStructures);
      
      const structureType = rng.nextInt(0, 4);
      
      switch (structureType) {
        case 0:
          this.generateTower(rng, blocks, monkeys, blocksForThis, monkeysForThis, structX, structZ);
          break;
        case 1:
          this.generateWall(rng, blocks, monkeys, blocksForThis, monkeysForThis, structX, structZ);
          break;
        case 2:
          this.generatePlatforms(rng, blocks, monkeys, blocksForThis, monkeysForThis, structX, structZ);
          break;
        case 3:
          this.generateFortress(rng, blocks, monkeys, blocksForThis, monkeysForThis, structX, structZ);
          break;
        default:
          this.generateStack(rng, blocks, monkeys, blocksForThis, monkeysForThis, structX, structZ);
      }
    }

    return { blocks, monkeys, ammo };
  }

  private generateStack(
    rng: SeededRandom,
    blocks: BlockData[],
    monkeys: MonkeyData[],
    numBlocks: number,
    numMonkeys: number,
    baseX: number,
    baseZ: number
  ): void {
    const blockSize = LEVEL_GEN.BLOCK_SIZE;
    const width = rng.nextInt(2, 4);
    let blocksPlaced = 0;
    let layer = 0;

    while (blocksPlaced < numBlocks) {
      const y = layer * blockSize + blockSize / 2;
      
      for (let i = 0; i < width && blocksPlaced < numBlocks; i++) {
        const x = baseX + (i - (width - 1) / 2) * blockSize * 1.1;
        const z = baseZ + rng.nextFloat(-0.5, 0.5);
        const type = this.getBlockType(rng, layer);

        blocks.push({
          position: new THREE.Vector3(x, y, z),
          size: new THREE.Vector3(blockSize, blockSize, blockSize),
          type,
          health: BLOCKS[type.toUpperCase() as keyof typeof BLOCKS].HEALTH,
        });
        blocksPlaced++;
      }
      layer++;
    }

    // Place monkeys on and around the stack
    for (let i = 0; i < numMonkeys; i++) {
      const x = baseX + rng.nextFloat(-1.5, 1.5);
      const y = layer * blockSize + MONKEY.BODY_RADIUS + 0.2;
      const z = baseZ + rng.nextFloat(-1, 1);
      monkeys.push({ position: new THREE.Vector3(x, y, z) });
    }
  }

  private generateTower(
    rng: SeededRandom,
    blocks: BlockData[],
    monkeys: MonkeyData[],
    numBlocks: number,
    numMonkeys: number,
    baseX: number,
    baseZ: number
  ): void {
    const blockSize = LEVEL_GEN.BLOCK_SIZE;
    const height = Math.min(numBlocks, 6);
    let blocksPlaced = 0;

    // Main tower column
    for (let y = 0; y < height && blocksPlaced < numBlocks; y++) {
      const type = y === 0 ? 'stone' : this.getBlockType(rng, y);
      blocks.push({
        position: new THREE.Vector3(baseX, y * blockSize + blockSize / 2, baseZ),
        size: new THREE.Vector3(blockSize, blockSize, blockSize),
        type,
        health: BLOCKS[type.toUpperCase() as keyof typeof BLOCKS].HEALTH,
      });
      blocksPlaced++;
    }

    // Side supports
    for (let side = -1; side <= 1; side += 2) {
      for (let y = 0; y < height - 1 && blocksPlaced < numBlocks; y += 2) {
        blocks.push({
          position: new THREE.Vector3(baseX + side * blockSize, y * blockSize + blockSize / 2, baseZ),
          size: new THREE.Vector3(blockSize * 0.8, blockSize * 0.5, blockSize * 0.8),
          type: 'wood',
          health: BLOCKS.WOOD.HEALTH,
        });
        blocksPlaced++;
      }
    }

    // Monkeys at various heights
    for (let i = 0; i < numMonkeys; i++) {
      const yLevel = rng.nextInt(1, height);
      const side = rng.pick([-1.2, 1.2]);
      monkeys.push({
        position: new THREE.Vector3(
          baseX + side,
          yLevel * blockSize + MONKEY.BODY_RADIUS,
          baseZ + rng.nextFloat(-0.5, 0.5)
        ),
      });
    }
  }

  private generateWall(
    rng: SeededRandom,
    blocks: BlockData[],
    monkeys: MonkeyData[],
    numBlocks: number,
    numMonkeys: number,
    baseX: number,
    baseZ: number
  ): void {
    const blockSize = LEVEL_GEN.BLOCK_SIZE;
    const width = rng.nextInt(3, 5);
    const height = rng.nextInt(2, 4);
    let blocksPlaced = 0;

    // Build a wall with depth
    for (let y = 0; y < height && blocksPlaced < numBlocks; y++) {
      for (let i = 0; i < width && blocksPlaced < numBlocks; i++) {
        const x = baseX + (i - (width - 1) / 2) * blockSize * 1.05;
        const z = baseZ;
        const type = y === 0 ? 'stone' : this.getBlockType(rng, y);

        blocks.push({
          position: new THREE.Vector3(x, y * blockSize + blockSize / 2, z),
          size: new THREE.Vector3(blockSize, blockSize, blockSize * 0.8),
          type,
          health: BLOCKS[type.toUpperCase() as keyof typeof BLOCKS].HEALTH,
        });
        blocksPlaced++;
      }
    }

    // Monkeys behind and on the wall
    for (let i = 0; i < numMonkeys; i++) {
      const x = baseX + rng.nextFloat(-width/2, width/2);
      const behindWall = rng.next() > 0.5;
      const y = behindWall ? MONKEY.BODY_RADIUS + 0.1 : height * blockSize + MONKEY.BODY_RADIUS + 0.2;
      const z = behindWall ? baseZ + 1.5 : baseZ;
      monkeys.push({ position: new THREE.Vector3(x, y, z) });
    }
  }

  private generatePlatforms(
    rng: SeededRandom,
    blocks: BlockData[],
    monkeys: MonkeyData[],
    numBlocks: number,
    numMonkeys: number,
    baseX: number,
    baseZ: number
  ): void {
    const blockSize = LEVEL_GEN.BLOCK_SIZE;
    let blocksPlaced = 0;
    const numPlatforms = rng.nextInt(2, 3);

    for (let p = 0; p < numPlatforms && blocksPlaced < numBlocks; p++) {
      const platX = baseX + rng.nextFloat(-2, 2);
      const platY = (p + 1) * 2;
      const platZ = baseZ + rng.nextFloat(-2, 2);
      const platWidth = rng.nextInt(2, 3);

      // Platform supports (pillars)
      for (let y = 0; y < platY && blocksPlaced < numBlocks; y++) {
        blocks.push({
          position: new THREE.Vector3(platX - 1, y * blockSize + blockSize / 2, platZ),
          size: new THREE.Vector3(blockSize * 0.6, blockSize, blockSize * 0.6),
          type: 'stone',
          health: BLOCKS.STONE.HEALTH,
        });
        blocksPlaced++;
        
        if (blocksPlaced < numBlocks) {
          blocks.push({
            position: new THREE.Vector3(platX + 1, y * blockSize + blockSize / 2, platZ),
            size: new THREE.Vector3(blockSize * 0.6, blockSize, blockSize * 0.6),
            type: 'stone',
            health: BLOCKS.STONE.HEALTH,
          });
          blocksPlaced++;
        }
      }

      // Platform surface
      for (let i = 0; i < platWidth && blocksPlaced < numBlocks; i++) {
        blocks.push({
          position: new THREE.Vector3(platX + (i - (platWidth-1)/2) * blockSize, platY * blockSize + blockSize / 2, platZ),
          size: new THREE.Vector3(blockSize, blockSize * 0.4, blockSize),
          type: 'wood',
          health: BLOCKS.WOOD.HEALTH,
        });
        blocksPlaced++;
      }

      // Monkey on this platform
      if (monkeys.length < numMonkeys) {
        monkeys.push({
          position: new THREE.Vector3(platX, platY * blockSize + blockSize + MONKEY.BODY_RADIUS, platZ),
        });
      }
    }
  }

  private generateFortress(
    rng: SeededRandom,
    blocks: BlockData[],
    monkeys: MonkeyData[],
    numBlocks: number,
    numMonkeys: number,
    baseX: number,
    baseZ: number
  ): void {
    const blockSize = LEVEL_GEN.BLOCK_SIZE;
    let blocksPlaced = 0;

    // Base walls (front and back)
    const width = 4;
    for (let i = 0; i < width && blocksPlaced < numBlocks; i++) {
      // Front wall
      blocks.push({
        position: new THREE.Vector3(baseX + (i - (width-1)/2) * blockSize, blockSize / 2, baseZ - 1),
        size: new THREE.Vector3(blockSize, blockSize, blockSize),
        type: 'stone',
        health: BLOCKS.STONE.HEALTH,
      });
      blocksPlaced++;

      // Back wall
      if (blocksPlaced < numBlocks) {
        blocks.push({
          position: new THREE.Vector3(baseX + (i - (width-1)/2) * blockSize, blockSize / 2, baseZ + 1),
          size: new THREE.Vector3(blockSize, blockSize, blockSize),
          type: 'stone',
          health: BLOCKS.STONE.HEALTH,
        });
        blocksPlaced++;
      }
    }

    // Corner towers
    const corners = [[-1.5, -1], [-1.5, 1], [1.5, -1], [1.5, 1]];
    for (const [cx, cz] of corners) {
      for (let y = 1; y < 3 && blocksPlaced < numBlocks; y++) {
        blocks.push({
          position: new THREE.Vector3(baseX + cx * blockSize, y * blockSize + blockSize / 2, baseZ + cz),
          size: new THREE.Vector3(blockSize * 0.8, blockSize, blockSize * 0.8),
          type: y === 1 ? 'stone' : 'wood',
          health: y === 1 ? BLOCKS.STONE.HEALTH : BLOCKS.WOOD.HEALTH,
        });
        blocksPlaced++;
      }
    }

    // Roof
    for (let i = 0; i < 3 && blocksPlaced < numBlocks; i++) {
      blocks.push({
        position: new THREE.Vector3(baseX + (i - 1) * blockSize, 2.5 * blockSize, baseZ),
        size: new THREE.Vector3(blockSize, blockSize * 0.3, blockSize * 2),
        type: 'wood',
        health: BLOCKS.WOOD.HEALTH,
      });
      blocksPlaced++;
    }

    // Monkeys inside fortress
    for (let i = 0; i < numMonkeys; i++) {
      monkeys.push({
        position: new THREE.Vector3(
          baseX + rng.nextFloat(-1, 1),
          MONKEY.BODY_RADIUS + 0.1,
          baseZ + rng.nextFloat(-0.5, 0.5)
        ),
      });
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
