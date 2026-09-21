// Physics module
function initPhysics() {
  world = new CANNON.World();
  world.gravity.set(0, -CONFIG.gravityStrength, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 22;
  world.solver.tolerance = 0.002;
  world.allowSleep = true;

  groundMaterial = new CANNON.Material('ground');
  ragdollMaterial = new CANNON.Material('ragdoll');
  shellMaterial = new CANNON.Material('shell');

  groundRagdollContact = new CANNON.ContactMaterial(groundMaterial, ragdollMaterial, { friction: CONFIG.ragdollFriction, restitution: 0.0 });
  const ragdollRagdollContact = new CANNON.ContactMaterial(ragdollMaterial, ragdollMaterial, { friction: 0.45, restitution: 0.0 });
  const groundShellContact = new CANNON.ContactMaterial(groundMaterial, shellMaterial, { friction: 0.4, restitution: 0.35 });
  world.addContactMaterial(groundRagdollContact);
  world.addContactMaterial(ragdollRagdollContact);
  world.addContactMaterial(groundShellContact);
  world.defaultContactMaterial.friction = 0.9;
  world.defaultContactMaterial.restitution = 0.0;

  const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: groundMaterial });
  groundBody.collisionFilterGroup = GROUP_GROUND;
  groundBody.collisionFilterMask = GROUP_GROUND | GROUP_RAGDOLL | GROUP_SHELL;
  groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  world.addBody(groundBody);
}