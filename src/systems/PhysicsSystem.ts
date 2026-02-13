import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { PHYSICS } from '../core/Constants';
import { eventBus, Events } from '../core/EventBus';

interface PhysicsBody {
  mesh: THREE.Object3D;
  body: CANNON.Body;
  type: 'poop' | 'block' | 'monkey' | 'ground';
  id: string;
  health?: number;
}

export class PhysicsSystem {
  world: CANNON.World;
  private bodies: Map<string, PhysicsBody> = new Map();
  private groundMaterial: CANNON.Material;
  private objectMaterial: CANNON.Material;
  private nextId = 0;

  constructor() {
    // Create deterministic physics world
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, PHYSICS.GRAVITY, 0),
    });

    // Use deterministic solver settings
    (this.world.solver as any).iterations = 10;
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;

    // Materials
    this.groundMaterial = new CANNON.Material('ground');
    this.objectMaterial = new CANNON.Material('object');

    // Contact materials
    const groundObjectContact = new CANNON.ContactMaterial(
      this.groundMaterial,
      this.objectMaterial,
      {
        friction: PHYSICS.GROUND_FRICTION,
        restitution: PHYSICS.RESTITUTION,
      }
    );

    const objectObjectContact = new CANNON.ContactMaterial(
      this.objectMaterial,
      this.objectMaterial,
      {
        friction: PHYSICS.BLOCK_FRICTION,
        restitution: PHYSICS.RESTITUTION,
      }
    );

    this.world.addContactMaterial(groundObjectContact);
    this.world.addContactMaterial(objectObjectContact);

    // Listen for collisions
    this.world.addEventListener('beginContact', this.onCollision.bind(this));
  }

  createGround(size: number): { mesh: THREE.Mesh; body: CANNON.Body } {
    // Three.js mesh
    const geometry = new THREE.PlaneGeometry(size, size);
    const material = new THREE.MeshStandardMaterial({
      color: 0x228B22,
      roughness: 0.8,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;

    // Cannon.js body
    const shape = new CANNON.Plane();
    const body = new CANNON.Body({
      mass: 0,
      material: this.groundMaterial,
    });
    body.addShape(shape);
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);

    this.world.addBody(body);

    return { mesh, body };
  }

  addPoop(position: THREE.Vector3, radius: number, mesh: THREE.Object3D): string {
    const id = `poop_${this.nextId++}`;

    const shape = new CANNON.Sphere(radius);
    const body = new CANNON.Body({
      mass: PHYSICS.POOP_MASS,
      material: this.objectMaterial,
      linearDamping: 0.0,  // No air resistance so trajectory matches preview
      angularDamping: 0.1,
    });
    body.addShape(shape);
    body.position.set(position.x, position.y, position.z);

    this.world.addBody(body);
    this.bodies.set(id, { mesh, body, type: 'poop', id });

    return id;
  }

  addBlock(
    position: THREE.Vector3,
    size: THREE.Vector3,
    mesh: THREE.Object3D,
    health: number
  ): string {
    const id = `block_${this.nextId++}`;

    const shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
    const body = new CANNON.Body({
      mass: PHYSICS.BLOCK_MASS,
      material: this.objectMaterial,
      linearDamping: 0.3,
      angularDamping: 0.5,
      sleepSpeedLimit: 0.1,
      sleepTimeLimit: 1,
    });
    body.addShape(shape);
    body.position.set(position.x, position.y, position.z);
    // Start sleeping so structures don't collapse immediately
    body.sleep();

    this.world.addBody(body);
    this.bodies.set(id, { mesh, body, type: 'block', id, health });

    return id;
  }

  addMonkey(position: THREE.Vector3, radius: number, mesh: THREE.Object3D): string {
    const id = `monkey_${this.nextId++}`;

    const shape = new CANNON.Sphere(radius);
    const body = new CANNON.Body({
      mass: PHYSICS.MONKEY_MASS,
      material: this.objectMaterial,
      linearDamping: 0.3,
      angularDamping: 0.5,
      sleepSpeedLimit: 0.1,
      sleepTimeLimit: 1,
    });
    body.addShape(shape);
    body.position.set(position.x, position.y, position.z);
    // Start sleeping
    body.sleep();

    this.world.addBody(body);
    this.bodies.set(id, { mesh, body, type: 'monkey', id, health: 1 });

    return id;
  }

  launchPoop(id: string, velocity: THREE.Vector3): void {
    const poop = this.bodies.get(id);
    if (poop) {
      poop.body.velocity.set(velocity.x, velocity.y, velocity.z);
      poop.body.wakeUp();
      eventBus.emit(Events.POOP_LAUNCHED, { id, velocity });
    }
  }

  removeBody(id: string): void {
    const physicsBody = this.bodies.get(id);
    if (physicsBody) {
      this.world.removeBody(physicsBody.body);
      this.bodies.delete(id);
    }
  }

  getBody(id: string): PhysicsBody | undefined {
    return this.bodies.get(id);
  }

  private onCollision(event: any): void {
    const bodyA = event.bodyA;
    const bodyB = event.bodyB;

    // Find the physics bodies
    let objA: PhysicsBody | undefined;
    let objB: PhysicsBody | undefined;

    for (const [, pb] of this.bodies) {
      if (pb.body === bodyA) objA = pb;
      if (pb.body === bodyB) objB = pb;
    }

    if (!objA || !objB) return;

    // Calculate impact force
    const relVel = new CANNON.Vec3();
    bodyA.velocity.vsub(bodyB.velocity, relVel);
    const impactForce = relVel.length();

    // Poop hitting something
    if (objA.type === 'poop' || objB.type === 'poop') {
      const poop = objA.type === 'poop' ? objA : objB;
      const other = objA.type === 'poop' ? objB : objA;

      if (other.type === 'monkey') {
        eventBus.emit(Events.MONKEY_HIT, { monkeyId: other.id, poopId: poop.id, force: impactForce });
      } else if (other.type === 'block') {
        eventBus.emit(Events.BLOCK_HIT, { blockId: other.id, poopId: poop.id, force: impactForce });
      }

      eventBus.emit(Events.POOP_HIT, { poopId: poop.id, otherId: other.id, force: impactForce });
    }

    // Block hitting monkey (falling blocks)
    if ((objA.type === 'block' && objB.type === 'monkey') ||
        (objA.type === 'monkey' && objB.type === 'block')) {
      const monkey = objA.type === 'monkey' ? objA : objB;
      if (impactForce > 3) {
        eventBus.emit(Events.MONKEY_HIT, { monkeyId: monkey.id, force: impactForce });
      }
    }
  }

  update(delta: number): void {
    // Step physics with fixed timestep for determinism
    this.world.step(PHYSICS.TIME_STEP, delta, PHYSICS.MAX_SUB_STEPS);

    // Sync Three.js meshes with Cannon.js bodies
    for (const [, pb] of this.bodies) {
      pb.mesh.position.copy(pb.body.position as any);
      pb.mesh.quaternion.copy(pb.body.quaternion as any);
    }
  }

  isSettled(): boolean {
    // Need at least one body to check
    if (this.bodies.size === 0) return false;
    
    let hasMovingPoop = false;
    
    for (const [, pb] of this.bodies) {
      const speed = pb.body.velocity.length();
      const angularSpeed = pb.body.angularVelocity.length();
      
      // If poop is still moving fast, not settled
      if (pb.type === 'poop') {
        if (speed > 0.3 || angularSpeed > 0.3) {
          return false;
        }
        hasMovingPoop = true;
      }
      
      // Check other objects too
      if (speed > 1 || angularSpeed > 1) {
        return false;
      }
    }
    
    return hasMovingPoop || this.bodies.size > 0;
  }

  clear(): void {
    // Only remove non-ground bodies
    const toRemove: string[] = [];
    for (const [id, pb] of this.bodies) {
      if (pb.type !== 'ground') {
        toRemove.push(id);
      }
    }
    for (const id of toRemove) {
      this.removeBody(id);
    }
    this.nextId = 0;
  }

  hasPoop(): boolean {
    for (const [, pb] of this.bodies) {
      if (pb.type === 'poop') return true;
    }
    return false;
  }

  wakeNearby(position: CANNON.Vec3, radius: number): void {
    for (const [, pb] of this.bodies) {
      const dist = pb.body.position.distanceTo(position);
      if (dist < radius) {
        pb.body.wakeUp();
      }
    }
  }
}
