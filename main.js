// =============================================
//  FULL FIXED main.js  (copy-paste replace)
// =============================================

import GUI from "https://cdn.skypack.dev/lil-gui@0.18.0";
import { PointerLockControls } from "./PointerLockControls.js";
import { EffectComposer } from 'https://cdn.skypack.dev/three@0.149.0/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'https://cdn.skypack.dev/three@0.149.0/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'https://cdn.skypack.dev/three@0.149.0/examples/jsm/postprocessing/ShaderPass';
import { RGBShiftShader } from './shader/RGBShiftShader.js';
import { StaticShader } from './shader/StaticShader.js';
import Stats from 'https://cdn.skypack.dev/stats.js';
import { VignetteShader } from './shader/VignetteShader.js';

import * as THREE from 'https://unpkg.com/three@0.149.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.149.0/examples/jsm/loaders/GLTFLoader.js';

// ============== CONFIG ==============
const MAZE_SIZE = 10;           // width = height
const MAZE_DEPTH = 8;           // W layers (0-6)
let currentW = 0;

let tolerance = MAZE_SIZE;      // generation distance
let acceleration = 0.1;
const damping = 0.9;

var stats = new Stats();

let wpps = [
    "./public/wallpaper0.png", // yellow backroom
"./public/wallpaper1.png", // grey backroom
"./public/wallpaper2.png", // concrete with pipes
"./public/wallpaper3.png", // concrete
"./public/wallpaper4.png", // brick
"./public/wallpaper5.png", // construction metal with alpha
"./public/wallpaper6.png",  // geoskeleton
"./public/wallpaper7.png"
];

const layerConfigs = {
    0: {
        wpp: wpps[0],
        fog: 0xd9a336,
        light: 0xfeffd9,
        transparent: false
    },
    1: {
        wpp: wpps[1],
        fog: 0xe8e4ca,
        light: 0xeeeeee,
        transparent: false
    },
    2: {
        wpp: wpps[2],
        fog: 0x777777,
        light: 0x777777,
        transparent: true
    },
    3: {
        wpp: wpps[3],
        fog: 0x777777,
        light: 0x777777,
        transparent: true
    },
    4: {
        wpp: wpps[4],
        fog: 0x881100,
        light: 0x881100,
        transparent: true
    },
    5: {
        wpp: wpps[5],
        fog: 0x000,
        light: 0x000000,
        transparent: true
    },
    6: {
        wpp: wpps[6],
        fog: 0x000,
        light: 0x000000,
        transparent: true
    },
    7: {
        wpp: wpps[7],
        fog: 0x000,
        light: 0x000000,
        transparent: true
    }
    // Add configs for up to MAZE_DEPTH (6)
};

let current_wpp = wpps[0];

stats.showPanel(0);
document.body.appendChild( stats.dom );
const coordinates = document.getElementById('coordinates');
// ============== THREE SETUP ==============
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, MAZE_SIZE + 10);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio * 0.5);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const textureLoader = new THREE.TextureLoader();

// Post-processing (kept exactly as you wanted)
const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
const composer = new EffectComposer(renderer, renderTarget);
composer.addPass(new RenderPass(scene, camera));

const staticPass = new ShaderPass(StaticShader);
staticPass.uniforms.amount.value = 0.04;
staticPass.uniforms.size.value = 4.0;
composer.addPass(staticPass);

const rgbShift = new ShaderPass(RGBShiftShader);
rgbShift.uniforms.amount.value = 0.001;
rgbShift.renderToScreen = true;
composer.addPass(rgbShift);

const vignette = new ShaderPass(VignetteShader);
vignette.uniforms.offset.value = 0.81;
vignette.uniforms.darkness.value = 1.0;
vignette.renderToScreen = true;
composer.addPass(vignette);

// Lights & fog
scene.add(new THREE.AmbientLight(0xe8e4ca, 0.7));
const dirLight = new THREE.DirectionalLight(0xfeffd9, 0.9);
dirLight.position.set(0, 10, 0);
scene.add(dirLight);
scene.fog = new THREE.FogExp2(0xd9a336, 0.17);
renderer.setClearColor(0xd9a336);

function loadTexture(path, options = {}) {
    const texture = textureLoader.load(path, function (texture) {
        texture.generateMipmaps = options.generateMipmaps || true;
        texture.minFilter = options.minFilter || THREE.LinearMipmapLinearFilter;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(options.repeatX || 1, options.repeatY || 1);
        if (options.anisotropy) texture.anisotropy = options.anisotropy;
        if (options.offset) texture.offset.set(options.offset.x, options.offset.y);
    });
        return texture;
}

// ============== TEXTURES ==============
const wallTex = loadTexture(current_wpp/*'./public/wallpaper3.png'*/, { repeatX: 18, repeatY: 6, offset: {x: Math.random(), y: Math.random()} }); //textureLoader.load('./public/wallpaper.png');
//wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;

const floorTex = loadTexture('./public/floor.png', { repeatX: 60, repeatY: 60 }); //textureLoader.load('./public/floor.png');
//floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
//floorTex.repeat.set(60, 60);

const baseboardTex = loadTexture('./public/baseboard.jpg', { repeatX: 20, repeatY: 20, anisotropy: 16 });

const floorBump = loadTexture('./public/heightmap.png', { repeatX: 60, repeatY: 60 }); //textureLoader.load('./public/heightmap.png');
//floorBump.wrapS = floorBump.wrapT = THREE.RepeatWrapping;

const ceilTex = loadTexture('./public/ceiling_tile.jpg', { repeatX: 60, repeatY: 40, minFilter: THREE.LinearMipmapLinearFilter }); //textureLoader.load('./public/ceiling_tile.jpg');
//ceilTex.wrapS = ceilTex.wrapT = THREE.RepeatWrapping;
const ceilBump = loadTexture('./public/ceiling_tile_heightmap.png', { repeatX: 60, repeatY: 40, minFilter: THREE.LinearMipmapLinearFilter }); //textureLoader.load('./public/ceiling_tile_heightmap.png');

// ============== GEOMETRIES ==============
const wallGeo = new THREE.BoxGeometry(1.0001, 1, 1.0001);
const wallMat = new THREE.MeshPhongMaterial({
    map: wallTex ,
    transparent: true, // Allows transparency
    alphaTest: 0.5,    // Prevents "invisible" walls from blocking the view of things behind them
    side: THREE.DoubleSide
});

const floorGeo = new THREE.PlaneGeometry(MAZE_SIZE, MAZE_SIZE);
const floorMat = new THREE.MeshPhongMaterial({
    map: floorTex,
    bumpMap: floorBump,
    bumpScale: 0.005,
    shininess: 0,
    reflectivity: 0,
    roughness: 1,
    receiveShadow: true,
    color: 0x777777,
    metalness: 0
});

const ceilGeo = new THREE.PlaneGeometry(MAZE_SIZE, MAZE_SIZE);
const ceilMat = new THREE.MeshPhongMaterial({
    map: ceilTex,
    bumpMap: ceilBump,
    bumpScale: 0.0015,
    shininess: 0,
    reflectivity: 0,
    roughness: 1,
    receiveShadow: true,
    color: 0x777777
});

const baseboardGeo = new THREE.BoxGeometry(1.01, 0.065, 1.01);
const baseboardMat = new THREE.MeshPhongMaterial({ map: baseboardTex, reflectivity: 0, shininess: 0, roughness: 1 });

const lightGeo = new THREE.BoxGeometry(0.15, 0.01, 0.15);
const lightMat = new THREE.MeshBasicMaterial({ color: 0xfeffe8 });
const outlineGeo = new THREE.BoxGeometry(0.17, 0.01, 0.17);
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x333333 });

// ============== POINTER LOCK ==============
const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.getObject());

const startBtn = document.getElementById('startButton');
const menu = document.getElementById('menuPanel');

startBtn.addEventListener('click', () => {
    startTime();
    controls.lock();
});

controls.addEventListener('lock', () => {
    startBtn.style.display = 'none';
    menu.style.display = 'none';
    paused = false;
});

controls.addEventListener('unlock', () => {
    startBtn.style.display = 'block';
    menu.style.display = 'block';
    paused = true;
});

// ============== GUI ==============
const gui = new GUI();
const gfx = gui.addFolder("Graphics");
const guiData = { pixelratio: 50, genDist: MAZE_SIZE };
gfx.add(guiData, "pixelratio", 20, 100, 5).onChange(v => {
    renderer.setPixelRatio(window.devicePixelRatio * v / 100);
}).name("Pixel Ratio (%)");
gfx.add(guiData, "genDist", 1, MAZE_SIZE, 1).onChange(v => tolerance = v).name("Generation Distance");
gfx.close();

// ============== MAZE DATA ==============
const worldData = new Map();           // chunkKey → 3D maze array [W][Y][X]
const visited = new Set();             // "x,z"
const chunkObjects = new Map();

function findSafeSpawn(maze) {
    // 1. Scan all W layers (dimensions)
    for (let w = 0; w < MAZE_DEPTH; w++) {
        // 2. Scan rows and columns
        // We start at 1 and end at SIZE-1 to avoid boundary walls
        for (let y = 1; y < MAZE_SIZE /*- 1*/; y++) {
            for (let x = 1; x < MAZE_SIZE /*- 1*/; x++) {
                if (maze[w][y][x] === 0) {
                    return {
                        x: (x - MAZE_SIZE / 2 + 0.5),
                        z: (y - MAZE_SIZE / 2 + 0.5),
                        w: w // Return which dimension we found the space in
                    };
                }
            }
        }
    }
    // Final fallback if the maze is somehow 100% solid
    return { x: 0.5, z: 0.5, w: 0 };
}

let timeRate = 0;

function startTime() {
    const today = new Date();
    today.setSeconds(today.getSeconds()+((currentW+1)*timeRate/10));
    let h = today.getHours();
    let m = today.getMinutes();
    let s = today.getSeconds();
    timer.innerHTML =  String(Math.round(h)).padStart(2, '0') + ":" + String(Math.round(m)).padStart(2, '0') + ":" + String(Math.round(s)).padStart(2, '0') + " }";
    timeRate += 0.1;
    setTimeout(startTime, 1000);
}

function generateMaze() {
    // Initialize the 3D array (Depth x Height x Width)
    const maze = Array.from({ length: MAZE_DEPTH }, () =>
    Array.from({ length: MAZE_SIZE }, () => Array(MAZE_SIZE).fill(1))
    );

    // Loop through each layer (w) independently
    for (let w = 0; w < MAZE_DEPTH; w++) {

        // Pick a random starting point for THIS specific layer
        const startX = Math.floor(Math.random() * (MAZE_SIZE / 2)) * 2 + 1;
        const startY = Math.floor(Math.random() * (MAZE_SIZE / 2)) * 2 + 1;

        const frontier = [[startX, startY]];
        maze[w][startY][startX] = 0;

        while (frontier.length > 0) {
            // Pick a random spot from the frontier
            const idx = Math.floor(Math.random() * frontier.length);
            const [x, y] = frontier.splice(idx, 1)[0];

            // 2D Directions only (North, South, East, West)
            const dirs = [[-2, 0], [2, 0], [0, -2], [0, 2]];
            dirs.sort(() => Math.random() - 0.5);

            for (const [dx, dy] of dirs) {
                const nx = x + dx;
                const ny = y + dy;

                // Check 2D bounds
                if (nx > 0 && nx < MAZE_SIZE - 1 && ny > 0 && ny < MAZE_SIZE - 1) {

                    if (maze[w][ny][nx] === 1) {
                        // Carve the destination cell
                        maze[w][ny][nx] = 0;

                        // Carve the "wall" between the current cell and the new cell
                        const bridgeX = x + dx / 2;
                        const bridgeY = y + dy / 2;
                        maze[w][bridgeY][bridgeX] = 0;

                        frontier.push([nx, ny]);
                    }
                }
            }
        }

        // Apply your specific "Master-style" door/edge logic for this layer
        for (let i = 0; i < MAZE_SIZE; i++) {
            maze[w][i][MAZE_SIZE - 1] = 0; // East edge open
            maze[w][MAZE_SIZE - 1][i] = 0; // South edge open
        }
    }

    return maze;
}

// ============== RENDER FUNCTIONS ==============
// Add 'parent' as the last argument to all these functions
function generateWalls(maze, cx, cz, layer, parent) {
    const inst = new THREE.InstancedMesh(wallGeo, wallMat, MAZE_SIZE * MAZE_SIZE);
    const baseboardInst = new THREE.InstancedMesh(baseboardGeo, baseboardMat, MAZE_SIZE * MAZE_SIZE);
    const dummy = new THREE.Object3D();
    let count = 0;

    for (let y = 0; y < MAZE_SIZE; y++) {
        for (let x = 0; x < MAZE_SIZE; x++) {
            if (maze[layer][y][x] === 1) {
                const px = (x - MAZE_SIZE/2 + 0.5) + cx * MAZE_SIZE;
                const pz = (y - MAZE_SIZE/2 + 0.5) + cz * MAZE_SIZE;

                dummy.position.set(px, 0.5, pz);
                dummy.updateMatrix();
                inst.setMatrixAt(count, dummy.matrix);

                dummy.position.set(px, 0.0325, pz);
                dummy.updateMatrix();
                baseboardInst.setMatrixAt(count, dummy.matrix);
                count++;
            }
        }
    }
    inst.count = count;
    baseboardInst.count = count;
    parent.add(inst);      // Added to parent group
    parent.add(baseboardInst);
}

function createLights(maze, cx, cz, layer, parent) {
    for (let y = 0; y < MAZE_SIZE; y += 2) {
        for (let x = 0; x < MAZE_SIZE; x += 2) {
            const lx = (x - MAZE_SIZE/2) + (cx * MAZE_SIZE);
            const lz = (y - MAZE_SIZE/2) + (cz * MAZE_SIZE);

            const light = new THREE.Mesh(lightGeo, lightMat);
            light.position.set(lx, 0.99, lz);
            parent.add(light);

            const outline = new THREE.Mesh(outlineGeo, outlineMat);
            outline.position.set(lx, 0.999, lz);
            parent.add(outline);
        }
    }
}

function createFloor(cx, cz, parent) {
    const f = new THREE.Mesh(floorGeo, floorMat);
    f.rotation.x = -Math.PI/2;
    f.position.set(cx * MAZE_SIZE, 0, cz * MAZE_SIZE);
    parent.add(f);
}

function createCeiling(cx, cz, parent) {
    const c = new THREE.Mesh(ceilGeo, ceilMat);
    c.rotation.x = Math.PI/2;
    c.position.set(cx * MAZE_SIZE, 1, cz * MAZE_SIZE);
    parent.add(c);
}
function refreshAllVisuals() {
    const config = layerConfigs[currentW] || layerConfigs[0];

    // 1. Update the Wall Texture
    // We load the new texture and swap it on the existing material
    textureLoader.load(config.wpp, (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(9, 3); // Keep your repeat settings
        wallMat.map = tex;
        wallMat.transparent = config.transparent;
        wallMat.needsUpdate = true;
    });

    // 2. Update Scene Colors
    const newColor = new THREE.Color(config.fog);
    scene.fog.color = newColor;
    renderer.setClearColor(newColor);
    dirLight.color = new THREE.Color(config.light);

    // 3. Clear all existing chunk groups from the scene
    for (const key of chunkObjects.keys()) {
        const group = chunkObjects.get(key);
        scene.remove(group);
    }
    chunkObjects.clear();

    // 4. Just let updateChunks rebuild them for the new currentW
    updateChunks();
}

// ============== COLLISION ==============
function checkCollision(oldPos) {
    const pos = controls.getObject().position;
    const radius = 0.2;

    // Define the 4 corners to check
    const checks = [
        { x: pos.x + radius, z: pos.z + radius },
        { x: pos.x - radius, z: pos.z + radius },
        { x: pos.x + radius, z: pos.z - radius },
        { x: pos.x - radius, z: pos.z - radius }
    ];

    for (let point of checks) {
        const cx = Math.floor((point.x + MAZE_SIZE/2) / MAZE_SIZE);
        const cz = Math.floor((point.z + MAZE_SIZE/2) / MAZE_SIZE);
        const key = `${cx},${cz}`;
        const maze = worldData.get(key);

        if (maze) {
            const localX = Math.floor((point.x - cx * MAZE_SIZE) + MAZE_SIZE / 2);
            const localZ = Math.floor((point.z - cz * MAZE_SIZE) + MAZE_SIZE / 2);

            // If any corner is inside a wall (1), reset position
            if (maze[currentW] && maze[currentW][localZ] && maze[currentW][localZ][localX] === 1) {
                controls.getObject().position.copy(oldPos);
                velocity.set(0, 0, 0);
                return; // Stop checking once we hit something
            }
        }
    }
}

// ================ CAT =================

const loader = new GLTFLoader();
let pet; // The pet (cat) model

loader.load('public/kotek.gltf', (gltf) => {
    pet = gltf.scene; // The pet model is now a part of the scene

    pet.scale.set(0.02, 0.02, 0.02);
    pet.position.set(0, -0.5, 1); // Position relative to the player
    pet.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    scene.add(pet); // Add the pet to the scene
});

function updatePetPosition() {
    if (pet) {
        // Get the position of the player (camera or object)
        const playerPosition = controls.getObject().position;

        // Set the pet's position relative to the player: slightly behind and below
        pet.position.lerp(new THREE.Vector3(playerPosition.x-0.5, playerPosition.y - 0.5, playerPosition.z - 0.5),0.1);

    }
}

// ============== CHUNK GENERATION ==============
function unloadChunk(key) {
    const group = chunkObjects.get(key);
    if (group) {
        scene.remove(group);
        // Important: Dispose of geometries and materials to save memory
        group.traverse((child) => {
            if (child.isMesh || child.isInstancedMesh) {
                child.geometry.dispose();
                // If material is an array (common in some Three.js setups)
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        chunkObjects.delete(key);
         worldData.delete(key);
         visited.delete(key);
    }
}

function generateChunk(cx, cz) {
    const key = `${cx},${cz}`;
    if (chunkObjects.has(key)) return; // Already rendered

    // If we haven't generated the data for this chunk yet, do it
    if (!worldData.has(key)) {
        worldData.set(key, generateMaze());
        visited.add(key);
    }

    const maze = worldData.get(key);
    const group = new THREE.Group();
    group.userData.isMazeVisual = true; // Still useful for your refresh logic
    scene.add(group);
    chunkObjects.set(key, group);

    generateWalls(maze, cx, cz, currentW, group);
    createLights(maze, cx, cz, currentW, group);
    createFloor(cx, cz, group);
    createCeiling(cx, cz, group);
}
function updateChunks() {
    const pos = controls.getObject().position;
    const currentCx = Math.floor((pos.x + MAZE_SIZE / 2) / MAZE_SIZE);
    const currentCz = Math.floor((pos.z + MAZE_SIZE / 2) / MAZE_SIZE);

    // 1. Generate nearby chunks
    for (let dx = -tolerance; dx <= tolerance; dx++) {
        for (let dz = -tolerance; dz <= tolerance; dz++) {
            generateChunk(currentCx + dx, currentCz + dz);
        }
    }

    // 2. Unload far away chunks
    for (const key of chunkObjects.keys()) {
        const [cx, cz] = key.split(',').map(Number);
        if (Math.abs(cx - currentCx) > tolerance || Math.abs(cz - currentCz) > tolerance) {
            unloadChunk(key);
        }
    }
}

// ============== INPUT ==============
let paused = true;
const velocity = new THREE.Vector3();
const keyState = {
    KeyW: false, KeyA: false, KeyS: false, KeyD: false,
    KeyQ: false, KeyE: false,
    PageUp: false, PageDown: false,
    ShiftLeft: false, ShiftRight: false
};

document.addEventListener('keydown', e => { if (!paused) keyState[e.code] = true; });
document.addEventListener('keyup',   e => { if (!paused) keyState[e.code] = false; });

let wCooldown = 0;

// ============== MAIN LOOP ==============
let lastTime = 0;
function animate(now = 0) {
    requestAnimationFrame(animate);
    stats.begin();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    if (paused) {
        composer.render();
        return;
    }

    // W-dimension switch (Q/E or PageUp/Down)
    if ((keyState.KeyQ || keyState.PageUp) && Date.now() > wCooldown) {
        currentW = (currentW + 1) % MAZE_DEPTH;
        refreshAllVisuals();
        wCooldown = Date.now() + 250;
    }
    if ((keyState.KeyE || keyState.PageDown) && Date.now() > wCooldown) {
        currentW = (currentW - 1 + MAZE_DEPTH) % MAZE_DEPTH;
        refreshAllVisuals();
        wCooldown = Date.now() + 250;
    }

    // movement
    if (keyState.KeyW || keyState.ArrowUp)    velocity.z += acceleration*dt;
    if (keyState.KeyS || keyState.ArrowDown)  velocity.z -= acceleration*dt;
    if (keyState.KeyA || keyState.ArrowLeft)  velocity.x -= acceleration*dt;
    if (keyState.KeyD || keyState.ArrowRight) velocity.x += acceleration*dt;
    updatePetPosition();
    coordinates.innerHTML = `( ${controls.getObject().position.x.toFixed(2)} ; ${controls.getObject().position.z.toFixed(2)} ; 0.5 ; ${currentW} ; `;

    velocity.multiplyScalar(Math.pow(damping, dt * 60));

    const oldPos = controls.getObject().position.clone();
    controls.moveForward(velocity.z);
    controls.moveRight(velocity.x);

    checkCollision(oldPos);
    updateChunks();

    // static noise
    staticPass.uniforms.time.value = (now * 0.001)%1000;

    composer.render();
    stats.end();
}

// ============== INIT ==============
function init() {
    // first chunk
    const startMaze = generateMaze();
    worldData.set("0,0", startMaze);
    visited.add("0,0");

    generateChunk(0,0)

    // spawn in a guaranteed open cell (north door)
    const spawn = findSafeSpawn(startMaze, currentW);
    controls.getObject().position.set(spawn.x, 0.5, spawn.z);
    // start rendering
    animate();
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

init();
