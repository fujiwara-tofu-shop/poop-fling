import * as THREE from 'three';
import { CAMERA, WORLD, COLORS, POOP, MONKEY, BLOCKS, GAME, PHYSICS } from './Constants';
import { eventBus, Events } from './EventBus';
import { gameState } from './GameState';
import { playFun } from './PlayFunSDK';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { InputSystem } from '../systems/InputSystem';
import { LevelGenerator, BlockData, MonkeyData } from '../level/LevelGenerator';

export class Game {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private clock = new THREE.Clock();
  
  private physics!: PhysicsSystem;
  private input!: InputSystem;
  private levelGenerator!: LevelGenerator;
  
  private currentPoop: { mesh: THREE.Group; id: string } | null = null;
  private trajectoryLine: THREE.Line | null = null;
  private slingshot!: THREE.Group;
  
  private monkeys: Map<string, THREE.Group> = new Map();
  private blocks: Map<string, THREE.Mesh> = new Map();
  
  private settleCheckTimer = 0;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.setupRenderer();
    this.setupScene();
    this.setupCamera();
    this.setupLighting();
    this.setupSlingshot();
    
    this.physics = new PhysicsSystem();
    this.input = new InputSystem(this.renderer.domElement);
    this.levelGenerator = new LevelGenerator();
    
    // Create ground
    const { mesh: groundMesh } = this.physics.createGround(WORLD.GROUND_SIZE);
    this.scene.add(groundMesh);
    
    this.setupEventListeners();
    this.setupUI();
    
    // Initialize Play.fun SDK (non-blocking)
    // Pass gameId from URL params or leave empty for offline mode
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('gameId') || undefined;
    playFun.init(gameId);
    
    this.animate();
  }

  private setupRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    document.getElementById('game-container')!.appendChild(this.renderer.domElement);
    window.addEventListener('resize', () => this.onWindowResize());
  }

  private setupScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(WORLD.SKY_COLOR);
  }

  private setupCamera(): void {
    const aspect = window.innerWidth / window.innerHeight;
    const isPortrait = aspect < 1;
    
    // For portrait: higher FOV, pull back more
    const fov = isPortrait ? 65 : CAMERA.FOV;
    
    this.camera = new THREE.PerspectiveCamera(
      fov,
      aspect,
      CAMERA.NEAR,
      CAMERA.FAR
    );
    
    // Position camera behind slingshot looking at structures
    // Portrait needs to pull back more on X
    const xPos = isPortrait ? CAMERA.POSITION.x - 5 : CAMERA.POSITION.x;
    const yPos = isPortrait ? CAMERA.POSITION.y + 3 : CAMERA.POSITION.y;
    
    this.camera.position.set(xPos, yPos, CAMERA.POSITION.z);
    this.camera.lookAt(CAMERA.LOOK_AT.x, CAMERA.LOOK_AT.y, CAMERA.LOOK_AT.z);
  }

  private setupLighting(): void {
    const ambient = new THREE.AmbientLight(WORLD.AMBIENT_LIGHT, WORLD.AMBIENT_INTENSITY);
    this.scene.add(ambient);
    
    const directional = new THREE.DirectionalLight(WORLD.DIRECTIONAL_LIGHT, WORLD.DIRECTIONAL_INTENSITY);
    directional.position.set(10, 20, 10);
    directional.castShadow = true;
    directional.shadow.mapSize.width = 1024;
    directional.shadow.mapSize.height = 1024;
    directional.shadow.camera.near = 0.5;
    directional.shadow.camera.far = 50;
    directional.shadow.camera.left = -20;
    directional.shadow.camera.right = 20;
    directional.shadow.camera.top = 20;
    directional.shadow.camera.bottom = -20;
    this.scene.add(directional);
  }

  private setupSlingshot(): void {
    this.slingshot = new THREE.Group();
    
    // Slingshot Y-frame
    const postMaterial = new THREE.MeshStandardMaterial({ color: COLORS.SLINGSHOT });
    
    const leftPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.15, 3, 8),
      postMaterial
    );
    leftPost.position.set(-0.4, 1.5, 0);
    leftPost.rotation.z = 0.2;
    
    const rightPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.15, 3, 8),
      postMaterial
    );
    rightPost.position.set(0.4, 1.5, 0);
    rightPost.rotation.z = -0.2;
    
    this.slingshot.add(leftPost, rightPost);
    this.slingshot.position.set(
      WORLD.SLINGSHOT_POSITION.x,
      WORLD.SLINGSHOT_POSITION.y - 1,
      WORLD.SLINGSHOT_POSITION.z
    );
    
    this.scene.add(this.slingshot);
  }

  private setupEventListeners(): void {
    eventBus.on(Events.GAME_START, () => this.startGame());
    eventBus.on(Events.LEVEL_START, (data) => this.loadLevel(data.level));
    eventBus.on(Events.LEVEL_RESET, () => this.resetLevel());
    
    eventBus.on(Events.AIM_START, () => this.onAimStart());
    eventBus.on(Events.AIM_UPDATE, (data) => this.onAimUpdate(data));
    eventBus.on(Events.AIM_RELEASE, (data) => this.onAimRelease(data));
    
    eventBus.on(Events.MONKEY_HIT, (data) => this.onMonkeyHit(data));
    eventBus.on(Events.BLOCK_HIT, (data) => this.onBlockHit(data));
    eventBus.on(Events.POOP_SETTLED, () => this.onPoopSettled());
  }

  private setupUI(): void {
    document.getElementById('play-btn')?.addEventListener('click', () => {
      eventBus.emit(Events.GAME_START);
    });
    
    document.getElementById('retry-btn')?.addEventListener('click', () => {
      gameState.reset();
      eventBus.emit(Events.GAME_START);
    });
    
    document.getElementById('next-level-btn')?.addEventListener('click', () => {
      gameState.nextLevel();
      eventBus.emit(Events.LEVEL_START, { level: gameState.level.current });
    });
  }

  private startGame(): void {
    gameState.reset();
    gameState.game.started = true;
    
    document.getElementById('menu-screen')?.classList.add('hidden');
    document.getElementById('game-over-screen')?.classList.add('hidden');
    document.getElementById('level-complete-screen')?.classList.add('hidden');
    document.getElementById('hud')?.classList.remove('hidden');
    document.getElementById('aim-indicator')?.classList.remove('hidden');
    
    eventBus.emit(Events.LEVEL_START, { level: 1 });
  }

  private loadLevel(levelNumber: number): void {
    // Hide any overlays
    document.getElementById('level-complete-screen')?.classList.add('hidden');
    document.getElementById('game-over-screen')?.classList.add('hidden');
    document.getElementById('menu-screen')?.classList.add('hidden');
    document.getElementById('hud')?.classList.remove('hidden');
    
    // Clear previous level
    this.clearLevel();
    
    // Generate new level
    const levelData = this.levelGenerator.generate(levelNumber);
    
    // Update game state
    gameState.level.current = levelNumber;
    gameState.level.monkeysTotal = levelData.monkeys.length;
    gameState.level.monkeysRemaining = levelData.monkeys.length;
    gameState.level.blocksRemaining = levelData.blocks.length;
    gameState.player.ammo = levelData.ammo;
    gameState.game.isPlaying = true;
    gameState.game.levelComplete = false;
    gameState.game.gameOver = false;
    
    // Create blocks
    levelData.blocks.forEach((blockData) => {
      this.createBlock(blockData);
    });
    
    // Create monkeys
    levelData.monkeys.forEach((monkeyData) => {
      this.createMonkey(monkeyData);
    });
    
    // Create first poop
    this.createPoop();
    
    this.updateUI();
  }

  private clearLevel(): void {
    // Remove all physics bodies
    this.physics.clear();
    
    // Remove meshes from scene
    this.monkeys.forEach((mesh) => this.scene.remove(mesh));
    this.monkeys.clear();
    
    this.blocks.forEach((mesh) => this.scene.remove(mesh));
    this.blocks.clear();
    
    if (this.currentPoop) {
      this.scene.remove(this.currentPoop.mesh);
      this.currentPoop = null;
    }
    
    if (this.trajectoryLine) {
      this.scene.remove(this.trajectoryLine);
      this.trajectoryLine = null;
    }
  }

  private createBlock(data: BlockData): void {
    const blockColors = {
      wood: BLOCKS.WOOD.COLOR,
      stone: BLOCKS.STONE.COLOR,
      glass: BLOCKS.GLASS.COLOR,
    };
    
    const geometry = new THREE.BoxGeometry(data.size.x, data.size.y, data.size.z);
    const material = new THREE.MeshStandardMaterial({
      color: blockColors[data.type],
      transparent: data.type === 'glass',
      opacity: data.type === 'glass' ? 0.6 : 1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(data.position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    this.scene.add(mesh);
    
    const id = this.physics.addBlock(data.position, data.size, mesh, data.health);
    this.blocks.set(id, mesh);
  }

  private createMonkey(data: MonkeyData): void {
    const monkey = new THREE.Group();
    
    // Body
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(MONKEY.BODY_RADIUS, 16, 16),
      new THREE.MeshStandardMaterial({ color: MONKEY.COLOR })
    );
    
    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(MONKEY.HEAD_RADIUS, 16, 16),
      new THREE.MeshStandardMaterial({ color: MONKEY.COLOR })
    );
    head.position.y = MONKEY.BODY_RADIUS + MONKEY.HEAD_RADIUS * 0.5;
    
    // Face
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(MONKEY.HEAD_RADIUS * 0.6, 16),
      new THREE.MeshStandardMaterial({ color: MONKEY.FACE_COLOR })
    );
    face.position.set(0, head.position.y, MONKEY.HEAD_RADIUS * 0.9);
    
    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.1, head.position.y + 0.05, MONKEY.HEAD_RADIUS);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.1, head.position.y + 0.05, MONKEY.HEAD_RADIUS);
    
    monkey.add(body, head, face, leftEye, rightEye);
    monkey.position.copy(data.position);
    
    this.scene.add(monkey);
    
    const id = this.physics.addMonkey(data.position, MONKEY.BODY_RADIUS, monkey);
    this.monkeys.set(id, monkey);
  }

  private createPoop(): void {
    if (gameState.player.ammo <= 0) return;
    
    const poop = new THREE.Group();
    
    // Main poop body (stacked spheres for swirl effect)
    const material = new THREE.MeshStandardMaterial({ color: POOP.COLOR });
    
    const base = new THREE.Mesh(new THREE.SphereGeometry(POOP.RADIUS, 16, 16), material);
    const mid = new THREE.Mesh(new THREE.SphereGeometry(POOP.RADIUS * 0.8, 16, 16), material);
    mid.position.y = POOP.RADIUS * 0.6;
    const top = new THREE.Mesh(new THREE.SphereGeometry(POOP.RADIUS * 0.5, 16, 16), material);
    top.position.y = POOP.RADIUS * 1.1;
    
    poop.add(base, mid, top);
    
    const startPos = new THREE.Vector3(
      WORLD.SLINGSHOT_POSITION.x,
      WORLD.SLINGSHOT_POSITION.y + 1,
      WORLD.SLINGSHOT_POSITION.z
    );
    poop.position.copy(startPos);
    
    this.scene.add(poop);
    
    const id = this.physics.addPoop(startPos, POOP.RADIUS, poop);
    this.currentPoop = { mesh: poop, id };
    
    eventBus.emit(Events.POOP_READY, { id });
  }

  private onAimStart(): void {
    // Create trajectory line
    const points = [];
    for (let i = 0; i < 50; i++) {
      points.push(new THREE.Vector3());
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: COLORS.TRAJECTORY,
      transparent: true,
      opacity: 0.5,
    });
    
    this.trajectoryLine = new THREE.Line(geometry, material);
    this.scene.add(this.trajectoryLine);
    
    // Show power bar
    document.getElementById('power-bar')?.classList.add('active');
  }

  private updatePoopPullback(pullX: number, pullY: number): void {
    if (!this.currentPoop) return;
    
    // Move poop back based on pull (visual only, clamped)
    const maxPull = 2;
    const clampedX = Math.max(-maxPull, Math.min(0, -pullX * 0.01));
    const clampedY = Math.max(-maxPull, Math.min(maxPull, -pullY * 0.01));
    
    this.currentPoop.mesh.position.set(
      WORLD.SLINGSHOT_POSITION.x + clampedX,
      WORLD.SLINGSHOT_POSITION.y + 1 + clampedY,
      WORLD.SLINGSHOT_POSITION.z
    );
  }

  private onAimUpdate(data: any): void {
    if (data.cancelled) {
      if (this.trajectoryLine) {
        this.scene.remove(this.trajectoryLine);
        this.trajectoryLine = null;
      }
      document.getElementById('power-bar')?.classList.remove('active');
      // Reset poop position
      if (this.currentPoop) {
        this.currentPoop.mesh.position.set(
          WORLD.SLINGSHOT_POSITION.x,
          WORLD.SLINGSHOT_POSITION.y + 1,
          WORLD.SLINGSHOT_POSITION.z
        );
      }
      return;
    }
    
    if (!this.trajectoryLine || !data.velocity) return;
    
    // Update poop pullback visual
    if (data.pullX !== undefined && data.pullY !== undefined) {
      this.updatePoopPullback(data.pullX, data.pullY);
    }
    
    // Update power bar
    const powerPercent = Math.min(100, (data.power / GAME.LAUNCH_POWER_MAX) * 100);
    const powerFill = document.getElementById('power-fill');
    if (powerFill) {
      powerFill.style.width = `${powerPercent}%`;
    }
    
    // Update trajectory preview from current poop position
    const positions = this.trajectoryLine.geometry.attributes.position;
    const startPos = this.currentPoop 
      ? this.currentPoop.mesh.position.clone()
      : new THREE.Vector3(WORLD.SLINGSHOT_POSITION.x, WORLD.SLINGSHOT_POSITION.y + 1, 0);
    
    const velocity = data.velocity.clone();
    const gravity = new THREE.Vector3(0, PHYSICS.GRAVITY, 0);
    // Use EXACT same timestep as physics for accurate preview
    const dt = PHYSICS.TIME_STEP;
    const pos = startPos.clone();
    
    // Simulate trajectory - use more steps since dt is smaller
    // Skip some steps to spread points across longer time (show every 2nd step)
    let step = 0;
    for (let i = 0; i < 50; i++) {
      positions.setXYZ(i, pos.x, Math.max(pos.y, 0), pos.z);
      
      // Simulate 2 physics steps per point for longer trajectory view
      for (let s = 0; s < 2; s++) {
        velocity.add(gravity.clone().multiplyScalar(dt));
        pos.add(velocity.clone().multiplyScalar(dt));
        step++;
      }
      
      if (pos.y < 0) {
        for (let j = i; j < 50; j++) {
          positions.setXYZ(j, pos.x, 0, pos.z);
        }
        break;
      }
    }
    
    positions.needsUpdate = true;
  }

  private onAimRelease(data: any): void {
    if (!this.currentPoop) return;
    
    // Remove trajectory line
    if (this.trajectoryLine) {
      this.scene.remove(this.trajectoryLine);
      this.trajectoryLine = null;
    }
    
    // Hide power bar
    document.getElementById('power-bar')?.classList.remove('active');
    
    // Sync physics body position with visual mesh position before launch
    const poopBody = this.physics.getBody(this.currentPoop.id);
    if (poopBody) {
      poopBody.body.position.set(
        this.currentPoop.mesh.position.x,
        this.currentPoop.mesh.position.y,
        this.currentPoop.mesh.position.z
      );
    }
    
    // Launch the poop from its current pulled-back position
    this.physics.launchPoop(this.currentPoop.id, data.velocity);
    
    gameState.player.ammo--;
    gameState.game.isWaitingForSettle = true;
    
    this.updateUI();
  }

  private onMonkeyHit(data: any): void {
    const monkey = this.monkeys.get(data.monkeyId);
    const physicsBody = this.physics.getBody(data.monkeyId);
    if (!monkey || !physicsBody) return;
    
    // Wake up the monkey and nearby objects
    this.physics.wakeNearby(physicsBody.body.position, 3);
    
    // Check if hit was hard enough to "kill"
    if (data.force > 8) {
      this.scene.remove(monkey);
      this.physics.removeBody(data.monkeyId);
      this.monkeys.delete(data.monkeyId);
      
      gameState.level.monkeysRemaining--;
      gameState.player.score += GAME.POINTS_PER_MONKEY;
      
      playFun.addPoints(GAME.POINTS_PER_MONKEY);
      
      eventBus.emit(Events.MONKEY_KILLED, { monkeyId: data.monkeyId });
      this.updateUI();
    }
  }

  private onBlockHit(data: any): void {
    const physicsBody = this.physics.getBody(data.blockId);
    if (!physicsBody || physicsBody.health === undefined) return;
    
    // Wake up this block and nearby objects
    this.physics.wakeNearby(physicsBody.body.position, 3);
    
    // Only reduce health on significant impacts
    if (data.force > 3) {
      const damage = Math.ceil(data.force / 8);
      physicsBody.health -= damage;
    }
    
    if (physicsBody.health <= 0) {
      const mesh = this.blocks.get(data.blockId);
      if (mesh) {
        // Wake nearby before removing
        this.physics.wakeNearby(physicsBody.body.position, 4);
        
        this.scene.remove(mesh);
        this.physics.removeBody(data.blockId);
        this.blocks.delete(data.blockId);
        
        gameState.level.blocksRemaining--;
        gameState.player.score += GAME.POINTS_PER_BLOCK;
        
        playFun.addPoints(GAME.POINTS_PER_BLOCK);
        
        eventBus.emit(Events.BLOCK_DESTROYED, { blockId: data.blockId });
        this.updateUI();
      }
    }
  }

  private onPoopSettled(): void {
    gameState.game.isWaitingForSettle = false;
    
    // Check win/lose conditions
    if (gameState.level.monkeysRemaining <= 0) {
      // Level complete!
      gameState.game.levelComplete = true;
      gameState.game.isPlaying = false;
      
      playFun.savePoints();
      
      setTimeout(() => {
        document.getElementById('level-score')!.textContent = `Score: ${gameState.player.score}`;
        document.getElementById('level-complete-screen')?.classList.remove('hidden');
      }, 1000);
      
    } else if (gameState.player.ammo <= 0) {
      // Out of ammo - game over
      gameState.game.gameOver = true;
      gameState.game.isPlaying = false;
      
      playFun.savePoints();
      
      setTimeout(() => {
        document.getElementById('final-score')!.textContent = 
          `Total Score: ${gameState.player.totalScore + gameState.player.score}`;
        document.getElementById('game-over-screen')?.classList.remove('hidden');
      }, 1000);
      
    } else {
      // Continue - spawn new poop
      if (this.currentPoop) {
        this.scene.remove(this.currentPoop.mesh);
        this.physics.removeBody(this.currentPoop.id);
        this.currentPoop = null;
      }
      this.createPoop();
    }
  }

  private resetLevel(): void {
    this.loadLevel(gameState.level.current);
  }

  private updateUI(): void {
    document.getElementById('level-indicator')!.textContent = `Level ${gameState.level.current}`;
    document.getElementById('score-display')!.textContent = `Score: ${gameState.player.score}`;
    document.getElementById('monkeys-display')!.textContent = 
      `Monkeys: ${gameState.level.monkeysRemaining}/${gameState.level.monkeysTotal}`;
    
    // Update ammo display with poop emojis
    const ammoStr = '💩'.repeat(gameState.player.ammo);
    document.getElementById('ammo-display')!.textContent = `Poop: ${ammoStr || '(empty)'}`;
  }

  private onWindowResize(): void {
    const aspect = window.innerWidth / window.innerHeight;
    const isPortrait = aspect < 1;
    
    this.camera.aspect = aspect;
    this.camera.fov = isPortrait ? 65 : CAMERA.FOV;
    
    const xPos = isPortrait ? CAMERA.POSITION.x - 5 : CAMERA.POSITION.x;
    const yPos = isPortrait ? CAMERA.POSITION.y + 3 : CAMERA.POSITION.y;
    
    this.camera.position.set(xPos, yPos, CAMERA.POSITION.z);
    this.camera.lookAt(CAMERA.LOOK_AT.x, CAMERA.LOOK_AT.y, CAMERA.LOOK_AT.z);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    
    const delta = Math.min(this.clock.getDelta(), 0.1);
    
    // Update physics
    this.physics.update(delta);
    
    // Check if physics has settled
    if (gameState.game.isWaitingForSettle) {
      this.settleCheckTimer += delta;
      
      // Force settle after 5 seconds or when physics settles (after 1 second minimum)
      const forceSettle = this.settleCheckTimer > 5;
      const physicsSettled = this.settleCheckTimer > 1.5 && this.physics.isSettled();
      
      if (forceSettle || physicsSettled) {
        this.settleCheckTimer = 0;
        eventBus.emit(Events.POOP_SETTLED);
      }
    }
    
    this.renderer.render(this.scene, this.camera);
  }
}
