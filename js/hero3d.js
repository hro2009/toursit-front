export function initHero() {
  if (!window.THREE) return;
  const THREE = window.THREE;
  const canvas = document.getElementById('gl');
  if (!canvas) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 760px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1 : 1.5));
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b2227, 65, 210);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 320);
  scene.add(new THREE.HemisphereLight(0xd7f0e8, 0x18352e, 1.15));
  const sunlight = new THREE.DirectionalLight(0xf4b678, 1.35);
  sunlight.position.set(-35, 34, -80);
  scene.add(sunlight);

  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const smooth = value => value * value * (3 - 2 * value);
  const heightAt = (x, z) => {
    const sideSlope = Math.pow(Math.abs(x) / 110, 1.8) * 17;
    const ridges = Math.sin(x * 0.12 + 1) * 2.4
      + Math.sin(z * 0.17 + x * 0.06) * 1.8
      + Math.sin(x * 0.31) * Math.cos(z * 0.27) * 0.9;
    const riverbed = Math.exp(-(x * x) / 300) * 3.2;
    const distanceFade = smooth(clamp((z + 110) / 70, 0, 1));
    return 2.8 + sideSlope + (ridges + 3) * distanceFade - riverbed;
  };

  const terrain = new THREE.PlaneGeometry(220, 170, mobile ? 48 : 90, mobile ? 38 : 72);
  terrain.rotateX(-Math.PI / 2);
  terrain.translate(0, 0, -25);
  const vertices = terrain.attributes.position;
  const terrainColors = [];
  const low = new THREE.Color(0x254f45);
  const middle = new THREE.Color(0x456e54);
  const high = new THREE.Color(0x78947a);
  for (let index = 0; index < vertices.count; index++) {
    const x = vertices.getX(index);
    const z = vertices.getZ(index);
    const y = heightAt(x, z);
    vertices.setY(index, y);
    const amount = clamp(y / 20, 0, 1);
    const color = amount < 0.45
      ? low.clone().lerp(middle, amount / 0.45)
      : middle.clone().lerp(high, (amount - 0.45) / 0.55);
    terrainColors.push(color.r, color.g, color.b);
  }
  terrain.setAttribute('color', new THREE.Float32BufferAttribute(terrainColors, 3));
  terrain.computeVertexNormals();
  const ground = new THREE.MeshLambertMaterial({ vertexColors: true });
  ground.flatShading = true;
  scene.add(new THREE.Mesh(terrain, ground));

  function addPeak(x, z, radius, height, snowHeight) {
    const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x526b69 });
    rockMaterial.flatShading = true;
    const rock = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 8), rockMaterial);
    rock.position.set(x, height / 2 - 1, z);
    scene.add(rock);
    const snowMaterial = new THREE.MeshLambertMaterial({ color: 0xe8f3ef });
    snowMaterial.flatShading = true;
    const snow = new THREE.Mesh(new THREE.ConeGeometry(radius * snowHeight / height, snowHeight, 8), snowMaterial);
    snow.position.set(x, height - snowHeight / 2 - 1, z);
    scene.add(snow);
  }
  addPeak(13, -82, 18, 25, 10);
  addPeak(-8, -88, 12, 17, 6);
  addPeak(-42, -98, 20, 24, 8);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(5, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd49a, fog: false })
  );
  sun.position.set(-35, 25, -128);
  scene.add(sun);
  const sunHalo = new THREE.Mesh(
    new THREE.SphereGeometry(8, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xf4b678, transparent: true, opacity: 0.13, fog: false, depthWrite: false })
  );
  sunHalo.position.copy(sun.position);
  scene.add(sunHalo);

  const riverPoints = [];
  for (let z = 55; z >= -108; z -= 10) {
    const x = Math.sin(z * 0.055) * 5;
    riverPoints.push(new THREE.Vector3(x, heightAt(x, z) - 0.3, z));
  }
  const riverPath = new THREE.CatmullRomCurve3(riverPoints);
  const river = new THREE.Mesh(
    new THREE.TubeGeometry(riverPath, 100, 0.42, 7, false),
    new THREE.MeshPhongMaterial({ color: 0x78b8b1, emissive: 0x12363c, shininess: 70, transparent: true, opacity: 0.9 })
  );
  scene.add(river);

  const particlePositions = [];
  for (let index = 0; index < 180; index++) {
    particlePositions.push(
      Math.sin(index * 127.1) * 60,
      2 + (index * 37 % 170) / 10,
      -105 + (index * 71 % 160)
    );
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
  scene.add(new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({ color: 0xf4b678, size: mobile ? 0.42 : 0.52, transparent: true, opacity: 0.78, sizeAttenuation: true })
  ));

  const lanterns = [];
  const lanternMaterial = new THREE.MeshBasicMaterial({ color: 0xf4b678 });
  const lanternGlowMaterial = new THREE.MeshBasicMaterial({ color: 0xf4b678, transparent: true, opacity: 0.14, depthWrite: false });
  for (let index = 0; index < 12; index++) {
    const lantern = new THREE.Group();
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), lanternMaterial);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), lanternGlowMaterial);
    lantern.add(glow, core);
    lantern.position.set(Math.sin(index * 2.1) * 24, 5 + index % 4 * 2, -92 + index * 13);
    lantern.userData.baseY = lantern.position.y;
    lantern.userData.phase = index * 1.7;
    lantern.userData.speed = 0.45 + index % 3 * 0.12;
    scene.add(lantern);
    lanterns.push(lantern);
  }

  const compass = new THREE.Group();
  const gold = new THREE.MeshBasicMaterial({ color: 0xf4b678 });
  compass.add(new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.12, 8, 48), gold));
  compass.add(new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.035, 6, 40), gold));
  const north = new THREE.Mesh(new THREE.ConeGeometry(0.62, 2.2, 3), gold);
  north.position.y = 1.05;
  compass.add(north);
  const south = new THREE.Mesh(
    new THREE.ConeGeometry(0.48, 1.7, 3),
    new THREE.MeshBasicMaterial({ color: 0xe8f3ef })
  );
  south.position.y = -0.82;
  south.rotation.z = Math.PI;
  compass.add(south);
  compass.position.set(17, 10, -8);
  compass.scale.setScalar(1.35);
  scene.add(compass);

  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;
  const onPointerMove = event => {
    targetX = (event.clientX / innerWidth - 0.5) * 2;
    targetY = (event.clientY / innerHeight - 0.5) * 2;
  };
  const resize = () => {
    const width = innerWidth;
    const height = innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width / height < 1 ? 76 : 55;
    camera.updateProjectionMatrix();
    if (reducedMotion) render(0, false);
  };
  addEventListener('resize', resize, { passive: true });
  resize();

  function render(time, animate) {
    const pageRange = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const progress = animate ? clamp(scrollY / pageRange, 0, 1) : 0;
    mouseX += ((animate ? targetX : 0) - mouseX) * 0.045;
    mouseY += ((animate ? targetY : 0) - mouseY) * 0.045;
    const cameraX = mouseX * 4;
    const cameraY = 9 - progress * 2 + mouseY * 1.5;
    const cameraZ = 49 - progress * 24;
    if (animate) {
      camera.position.x += (cameraX - camera.position.x) * 0.08;
      camera.position.y += (cameraY - camera.position.y) * 0.08;
      camera.position.z += (cameraZ - camera.position.z) * 0.08;
    } else {
      camera.position.set(cameraX, cameraY, cameraZ);
    }
    camera.lookAt(mouseX * 1.5, 5 + progress, -65 - progress * 10);

    if (animate) {
      lanterns.forEach(lantern => {
        lantern.position.y = lantern.userData.baseY + Math.sin(time * 0.0005 * lantern.userData.speed + lantern.userData.phase) * 0.65;
        lantern.rotation.y += 0.003;
      });
      compass.rotation.z += 0.0015;
    }
    renderer.render(scene, camera);
  }

  if (reducedMotion) {
    return;
  }
  addEventListener('pointermove', onPointerMove, { passive: true });
  const animate = time => {
    requestAnimationFrame(animate);
    if (document.visibilityState === 'visible') render(time, true);
  };
  requestAnimationFrame(animate);
}
