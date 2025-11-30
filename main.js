// Game State
const gameState = {
    playing: false,
    score: 0,
    kills: 0,
    health: 100,
    enemiesLeft: 10,
    startTime: 0,
    selectedCar: 1,
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
};

// Input State
const input = {
    left: false,
    right: false,
    up: false,
    down: false,
    shoot: false,
    boost: false
};

// Three.js Setup
const canvas = document.getElementById('gameCanvas');
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 10, 100);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 2);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 5);
dirLight.castShadow = true;
dirLight.shadow.camera.left = -50;
dirLight.shadow.camera.right = 50;
dirLight.shadow.camera.top = 50;
dirLight.shadow.camera.bottom = -50;
scene.add(dirLight);

// Ground
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x1a1a2e,
    roughness: 0.8
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Grid
const gridHelper = new THREE.GridHelper(100, 50, 0x4facfe, 0x2a2a4e);
scene.add(gridHelper);

// Car configurations
const carConfigs = [
    { speed: 0.5, turnSpeed: 0.05, color: 0xff0000, health: 80 },
    { speed: 0.3, turnSpeed: 0.03, color: 0x00ff00, health: 150 },
    { speed: 0.4, turnSpeed: 0.04, color: 0x0000ff, health: 100 }
];

// Player Car
let player = null;

function createCar(color, isPlayer = false) {
    const car = new THREE.Group();
    
    // Body
    const bodyGeometry = new THREE.BoxGeometry(1.5, 0.5, 3);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color, metalness: 0.8, roughness: 0.2 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    car.add(body);
    
    // Cabin
    const cabinGeometry = new THREE.BoxGeometry(1.2, 0.4, 1.5);
    const cabin = new THREE.Mesh(cabinGeometry, bodyMaterial);
    cabin.position.y = 0.45;
    cabin.position.z = -0.3;
    cabin.castShadow = true;
    car.add(cabin);
    
    // Wheels
    const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
    
    const wheelPositions = [
        [-0.8, -0.3, 1], [0.8, -0.3, 1],
        [-0.8, -0.3, -1], [0.8, -0.3, -1]
    ];
    
    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(...pos);
        wheel.castShadow = true;
        car.add(wheel);
    });
    
    // Weapon (Gun on top)
    if (isPlayer) {
        const gunGeometry = new THREE.BoxGeometry(0.2, 0.2, 1);
        const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
        const gun = new THREE.Mesh(gunGeometry, gunMaterial);
        gun.position.set(0, 0.8, 1);
        car.add(gun);
    }
    
    car.velocity = new THREE.Vector3();
    car.rotation.y = isPlayer ? 0 : Math.random() * Math.PI * 2;
    car.health = isPlayer ? carConfigs[gameState.selectedCar].health : 100;
    car.maxHealth = car.health;
    car.isPlayer = isPlayer;
    
    return car;
}

// Bullets
const bullets = [];

function createBullet(position, direction) {
    const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    
    bullet.position.copy(position);
    bullet.position.y = 0.5;
    bullet.velocity = direction.normalize().multiplyScalar(0.8);
    bullet.lifetime = 100;
    
    scene.add(bullet);
    bullets.push(bullet);
    
    playSound('shoot');
}

// Enemies
const enemies = [];

function spawnEnemy() {
    const angle = Math.random() * Math.PI * 2;
    const distance = 30 + Math.random() * 20;
    
    const enemy = createCar(0xff6600, false);
    enemy.position.x = Math.cos(angle) * distance;
    enemy.position.z = Math.sin(angle) * distance;
    
    scene.add(enemy);
    enemies.push(enemy);
}

// Initialize game
function initGame() {
    // Clear previous game
    if (player) scene.remove(player);
    enemies.forEach(e => scene.remove(e));
    bullets.forEach(b => scene.remove(b));
    enemies.length = 0;
    bullets.length = 0;
    
    // Create player
    const config = carConfigs[gameState.selectedCar];
    player = createCar(config.color, true);
    player.position.set(0, 0, 0);
    scene.add(player);
    
    // Camera setup
    camera.position.set(0, 8, -10);
    camera.lookAt(player.position);
    
    // Spawn enemies
    for (let i = 0; i < gameState.enemiesLeft; i++) {
        spawnEnemy();
    }
    
    // Reset game state
    gameState.score = 0;
    gameState.kills = 0;
    gameState.health = config.health;
    player.health = config.health;
    player.maxHealth = config.health;
    gameState.startTime = Date.now();
    gameState.playing = true;
    
    updateHUD();
}

// Update HUD
function updateHUD() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('enemiesLeft').textContent = enemies.length;
    
    const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
    document.getElementById('timer').textContent = elapsed;
    
    const healthPercent = (player.health / player.maxHealth) * 100;
    document.getElementById('healthFill').style.width = healthPercent + '%';
    document.getElementById('healthText').textContent = Math.max(0, Math.floor(healthPercent)) + '%';
}

// Game Loop
let lastShootTime = 0;
const shootCooldown = 300;

function animate() {
    requestAnimationFrame(animate);
    
    if (!gameState.playing) {
        renderer.render(scene, camera);
        return;
    }
    
    const config = carConfigs[gameState.selectedCar];
    
    // Player movement
    if (input.up) {
        player.velocity.z += config.speed * 0.1;
    }
    if (input.down) {
        player.velocity.z -= config.speed * 0.05;
    }
    if (input.left) {
        player.rotation.y += config.turnSpeed;
    }
    if (input.right) {
        player.rotation.y -= config.turnSpeed;
    }
    
    // Apply velocity
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(player.quaternion);
    player.position.add(forward.multiplyScalar(player.velocity.z));
    
    // Friction
    player.velocity.multiplyScalar(0.95);
    
    // Boundary check
    const boundary = 45;
    player.position.x = Math.max(-boundary, Math.min(boundary, player.position.x));
    player.position.z = Math.max(-boundary, Math.min(boundary, player.position.z));
    
    // Shooting
    if (input.shoot && Date.now() - lastShootTime > shootCooldown) {
        const bulletPos = player.position.clone();
        const bulletDir = new THREE.Vector3(0, 0, 1).applyQuaternion(player.quaternion);
        createBullet(bulletPos, bulletDir);
        lastShootTime = Date.now();
    }
    
    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.position.add(bullet.velocity);
        bullet.lifetime--;
        
        if (bullet.lifetime <= 0) {
            scene.remove(bullet);
            bullets.splice(i, 1);
            continue;
        }
        
        // Bullet collision with enemies
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (bullet.position.distanceTo(enemy.position) < 2) {
                enemy.health -= 34;
                scene.remove(bullet);
                bullets.splice(i, 1);
                
                if (enemy.health <= 0) {
                    scene.remove(enemy);
                    enemies.splice(j, 1);
                    gameState.score += 100;
                    gameState.kills++;
                    playSound('explosion');
                    
                    if (enemies.length === 0) {
                        endGame(true);
                    }
                } else {
                    playSound('hit');
                }
                break;
            }
        }
    }
    
    // Enemy AI
    enemies.forEach(enemy => {
        const toPlayer = new THREE.Vector3()
            .subVectors(player.position, enemy.position)
            .normalize();
        
        const angle = Math.atan2(toPlayer.x, toPlayer.z);
        enemy.rotation.y = angle;
        
        const distance = enemy.position.distanceTo(player.position);
        
        if (distance > 5 && distance < 40) {
            enemy.position.add(toPlayer.multiplyScalar(0.08));
        }
        
        // Enemy collision with player
        if (distance < 2.5) {
            player.health -= 0.3;
            
            if (player.health <= 0) {
                endGame(false);
            }
        }
        
        // Random movement
        if (Math.random() < 0.02) {
            enemy.rotation.y += (Math.random() - 0.5) * 0.5;
        }
    });
    
    // Camera follow
    const cameraOffset = new THREE.Vector3(0, 8, -10);
    const cameraPosition = player.position.clone().add(
        cameraOffset.applyQuaternion(player.quaternion)
    );
    camera.position.lerp(cameraPosition, 0.1);
    camera.lookAt(player.position);
    
    updateHUD();
    renderer.render(scene, camera);
}

// End game
function endGame(won) {
    gameState.playing = false;
    
    const gameOverScreen = document.getElementById('gameOverScreen');
    const gameOverTitle = document.getElementById('gameOverTitle');
    
    if (won) {
        gameOverTitle.textContent = "G'ALABA! 🏆";
        gameOverTitle.className = 'game-over-title win';
        playSound('win');
    } else {
        gameOverTitle.textContent = "YUTQAZDINGIZ 💥";
        gameOverTitle.className = 'game-over-title lose';
        playSound('lose');
    }
    
    const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
    document.getElementById('finalScore').textContent = gameState.score;
    document.getElementById('finalKills').textContent = gameState.kills;
    document.getElementById('finalTime').textContent = elapsed;
    
    gameOverScreen.classList.add('active');
}

// Sound effects (simple beep sounds)
function playSound(type) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch(type) {
        case 'shoot':
            oscillator.frequency.value = 400;
            gainNode.gain.value = 0.1;
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
            break;
        case 'hit':
            oscillator.frequency.value = 200;
            gainNode.gain.value = 0.15;
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.15);
            break;
        case 'explosion':
            oscillator.frequency.value = 100;
            gainNode.gain.value = 0.2;
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
            break;
        case 'win':
            oscillator.frequency.value = 600;
            gainNode.gain.value = 0.15;
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.5);
            break;
        case 'lose':
            oscillator.frequency.value = 150;
            gainNode.gain.value = 0.2;
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.8);
            break;
    }
}

// Event Listeners
document.getElementById('startBtn').addEventListener('click', () => {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('hud').classList.add('active');
    
    if (gameState.isMobile) {
        document.getElementById('mobileControls').classList.add('active');
    }
    
    initGame();
});

document.getElementById('instructionsBtn').addEventListener('click', () => {
    alert('🎮 QOIDALAR:\n\n' +
        'KOMPYUTER:\n' +
        '↑ W / ↑ - Oldinga\n' +
        '↓ S / ↓ - Orqaga\n' +
        '← A / ← - Chapga\n' +
        '→ D / → - O\'ngga\n' +
        'SPACE - Otish\n' +
        'SHIFT - Tezlashtirish\n\n' +
        'MOBIL:\n' +
        'Ekrandagi tugmalardan foydalaning\n\n' +
        'MAQSAD:\n' +
        '✓ Barcha dushmanlarni yo\'q qiling\n' +
        '✓ Sog\'ligingizni saqlang\n' +
        '✓ Ko\'proq ball to\'plang!\n\n' +
        'Omad tilaymiz! 🏁');
});

document.getElementById('restartBtn').addEventListener('click', () => {
    document.getElementById('gameOverScreen').classList.remove('active');
    initGame();
});

document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('gameOverScreen').classList.remove('active');
    document.getElementById('hud').classList.remove('active');
    document.getElementById('mobileControls').classList.remove('active');
    document.getElementById('mainMenu').classList.remove('hidden');
});

// Car selection
document.querySelectorAll('.car-card').forEach(card => {
    card.addEventListener('click', () => {
        document.querySelectorAll('.car-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        gameState.selectedCar = parseInt(card.dataset.car);
    });
});

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (!gameState.playing) return;
    
    switch(e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
            input.up = true;
            e.preventDefault();
            break;
        case 's':
        case 'arrowdown':
            input.down = true;
            e.preventDefault();
            break;
        case 'a':
        case 'arrowleft':
            input.left = true;
            e.preventDefault();
            break;
        case 'd':
        case 'arrowright':
            input.right = true;
            e.preventDefault();
            break;
        case ' ':
            input.shoot = true;
            e.preventDefault();
            break;
        case 'shift':
            input.boost = true;
            e.preventDefault();
            break;
    }
});

document.addEventListener('keyup', (e) => {
    switch(e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
            input.up = false;
            break;
        case 's':
        case 'arrowdown':
            input.down = false;
            break;
        case 'a':
        case 'arrowleft':
            input.left = false;
            break;
        case 'd':
        case 'arrowright':
            input.right = false;
            break;
        case ' ':
            input.shoot = false;
            break;
        case 'shift':
            input.boost = false;
            break;
    }
});

// Mobile controls
const addTouchControl = (id, key) => {
    const btn = document.getElementById(id);
    
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        input[key] = true;
    });
    
    btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        input[key] = false;
    });
    
    btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input[key] = true;
    });
    
    btn.addEventListener('mouseup', (e) => {
        e.preventDefault();
        input[key] = false;
    });
};

addTouchControl('leftBtn', 'left');
addTouchControl('rightBtn', 'right');
addTouchControl('shootBtn', 'shoot');
addTouchControl('boostBtn', 'up');

// Touch screen forward movement
canvas.addEventListener('touchstart', (e) => {
    if (gameState.playing && e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        
        // Touch left or right side for movement
        if (x < rect.width / 2) {
            input.left = true;
        } else {
            input.right = true;
        }
    }
});

canvas.addEventListener('touchend', () => {
    input.left = false;
    input.right = false;
});

// Window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start animation loop
animate();

// Add particle effects
function createExplosion(position) {
    const particleCount = 20;
    const particles = [];
    
    for (let i = 0; i < particleCount; i++) {
        const geometry = new THREE.SphereGeometry(0.1, 4, 4);
        const material = new THREE.MeshBasicMaterial({ 
            color: Math.random() > 0.5 ? 0xff6600 : 0xffff00 
        });
        const particle = new THREE.Mesh(geometry, material);
        
        particle.position.copy(position);
        particle.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            Math.random() * 0.3,
            (Math.random() - 0.5) * 0.3
        );
        particle.lifetime = 30;
        
        scene.add(particle);
        particles.push(particle);
    }
    
    // Animate particles
    const animateParticles = () => {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.position.add(p.velocity);
            p.velocity.y -= 0.01; // gravity
            p.lifetime--;
            
            if (p.lifetime <= 0) {
                scene.remove(p);
                particles.splice(i, 1);
            }
        }
        
        if (particles.length > 0) {
            requestAnimationFrame(animateParticles);
        }
    };
    
    animateParticles();
}

// Enhanced enemy destruction
const originalEnemyDestruction = () => {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (bullet.position.distanceTo(enemy.position) < 2) {
                enemy.health -= 34;
                scene.remove(bullet);
                bullets.splice(i, 1);
                
                if (enemy.health <= 0) {
                    createExplosion(enemy.position);
                    scene.remove(enemy);
                    enemies.splice(j, 1);
                    gameState.score += 100;
                    gameState.kills++;
                    playSound('explosion');
                    
                    if (enemies.length === 0) {
                        endGame(true);
                    }
                } else {
                    playSound('hit');
                }
                break;
            }
        }
    }
};

// Add stars/background
const starGeometry = new THREE.BufferGeometry();
const starVertices = [];

for (let i = 0; i < 1000; i++) {
    const x = (Math.random() - 0.5) * 200;
    const y = Math.random() * 100 + 20;
    const z = (Math.random() - 0.5) * 200;
    starVertices.push(x, y, z);
}

starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 });
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

// Add speed boost effect
let boostActive = false;
let boostCooldown = 0;

function updateBoost() {
    if (input.boost && boostCooldown <= 0 && gameState.playing) {
        boostActive = true;
        boostCooldown = 180; // 3 seconds cooldown
        
        setTimeout(() => {
            boostActive = false;
        }, 1000); // 1 second boost duration
    }
    
    if (boostCooldown > 0) {
        boostCooldown--;
    }
    
    if (boostActive) {
        player.velocity.z *= 1.3;
    }
}

// Enhanced animate function
const originalAnimate = animate;
animate = function() {
    requestAnimationFrame(animate);
    
    if (!gameState.playing) {
        renderer.render(scene, camera);
        return;
    }
    
    updateBoost();
    
    const config = carConfigs[gameState.selectedCar];
    
    // Player movement
    if (input.up) {
        player.velocity.z += config.speed * 0.1;
    }
    if (input.down) {
        player.velocity.z -= config.speed * 0.05;
    }
    if (input.left) {
        player.rotation.y += config.turnSpeed;
    }
    if (input.right) {
        player.rotation.y -= config.turnSpeed;
    }
    
    // Apply velocity
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(player.quaternion);
    player.position.add(forward.multiplyScalar(player.velocity.z));
    
    // Friction
    player.velocity.multiplyScalar(0.95);
    
    // Boundary check
    const boundary = 45;
    player.position.x = Math.max(-boundary, Math.min(boundary, player.position.x));
    player.position.z = Math.max(-boundary, Math.min(boundary, player.position.z));
    
    // Shooting
    if (input.shoot && Date.now() - lastShootTime > shootCooldown) {
        const bulletPos = player.position.clone();
        const bulletDir = new THREE.Vector3(0, 0, 1).applyQuaternion(player.quaternion);
        createBullet(bulletPos, bulletDir);
        lastShootTime = Date.now();
    }
    
    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.position.add(bullet.velocity);
        bullet.lifetime--;
        
        if (bullet.lifetime <= 0) {
            scene.remove(bullet);
            bullets.splice(i, 1);
            continue;
        }
        
        // Bullet collision with enemies
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (bullet.position.distanceTo(enemy.position) < 2) {
                enemy.health -= 34;
                scene.remove(bullet);
                bullets.splice(i, 1);
                
                if (enemy.health <= 0) {
                    createExplosion(enemy.position);
                    scene.remove(enemy);
                    enemies.splice(j, 1);
                    gameState.score += 100;
                    gameState.kills++;
                    playSound('explosion');
                    
                    if (enemies.length === 0) {
                        endGame(true);
                    }
                } else {
                    playSound('hit');
                }
                break;
            }
        }
    }
    
    // Enemy AI
    enemies.forEach(enemy => {
        const toPlayer = new THREE.Vector3()
            .subVectors(player.position, enemy.position)
            .normalize();
        
        const angle = Math.atan2(toPlayer.x, toPlayer.z);
        enemy.rotation.y = angle;
        
        const distance = enemy.position.distanceTo(player.position);
        
        if (distance > 5 && distance < 40) {
            enemy.position.add(toPlayer.multiplyScalar(0.08));
        }
        
        // Enemy collision with player
        if (distance < 2.5) {
            player.health -= 0.3;
            
            if (player.health <= 0) {
                endGame(false);
            }
        }
        
        // Random movement
        if (Math.random() < 0.02) {
            enemy.rotation.y += (Math.random() - 0.5) * 0.5;
        }
    });
    
    // Camera follow
    const cameraOffset = new THREE.Vector3(0, 8, -10);
    const cameraPosition = player.position.clone().add(
        cameraOffset.applyQuaternion(player.quaternion)
    );
    camera.position.lerp(cameraPosition, 0.1);
    camera.lookAt(player.position);
    
    updateHUD();
    renderer.render(scene, camera);
};

console.log('🎮 3D Car Battle Racing yuklanmoqda...');
console.log('✅ O\'yin tayyor! Start tugmasini bosing!');


const translations = {
uz: {
    title: "CAR BATTLE RACING",
    subtitle: "3D Action Racing O'yini",
    chooseCar: "Mashina turini tanlang:",
    car1Name: "🏎️ TEZKOR DEMON",
    car2Name: "🚗 TANK YO'QOTUVCHI",
    car3Name: "🏁 BALANSLI RACER",
    car1Stats: "Tezlik: ⭐⭐⭐⭐⭐<br>Kuch: ⭐⭐⭐",
    car2Stats: "Tezlik: ⭐⭐⭐<br>Kuch: ⭐⭐⭐⭐⭐",
    car3Stats: "Tezlik: ⭐⭐⭐⭐<br>Kuch: ⭐⭐⭐⭐",
    startBtn: "O'yinni Boshlash",
    instructions: "Qoidalar",
    scoreLabel: "Ball",
    enemiesLabel: "Dushmanlar",
    timeLabel: "Vaqt",
    victory: "G'ALABA! 🏆",
    defeat: "YUTQAZDINGIZ 💥",
    finalScoreLabel: "Yakuniy Ball:",
    finalKillsLabel: "O'ldirganlar:",
    finalTimeLabel: "Vaqt:",
    restart: "Qayta O'ynash",
    menu: "Menyu",
    instructionsText: "🎮 QOIDALAR:\n\n" +
        "KOMPYUTER:\n" +
        "↑ W / ↑ - Oldinga\n" +
        "↓ S / ↓ - Orqaga\n" +
        "← A / ← - Chapga\n" +
        "→ D / → - O'ngga\n" +
        "SPACE - Otish\n" +
        "SHIFT - Tezlashtirish\n\n" +
        "MOBIL:\n" +
        "Ekrandagi tugmalardan foydalaning\n\n" +
        "MAQSAD:\n" +
        "✓ Barcha dushmanlarni yo'q qiling\n" +
        "✓ Sog'ligingizni saqlang\n" +
        "✓ Ko'proq ball to'plang!\n" +
        "⚠️ Dushmanlar sizga o'q otadi!\n\n" +
        "Omad tilaymiz! 🏁"
},
en: {
    title: "CAR BATTLE RACING",
    subtitle: "3D Action Racing Game",
    chooseCar: "Choose Your Car:",
    car1Name: "🏎️ SPEED DEMON",
    car2Name: "🚗 TANK DESTROYER",
    car3Name: "🏁 BALANCED RACER",
    car1Stats: "Speed: ⭐⭐⭐⭐⭐<br>Power: ⭐⭐⭐",
    car2Stats: "Speed: ⭐⭐⭐<br>Power: ⭐⭐⭐⭐⭐",
    car3Stats: "Speed: ⭐⭐⭐⭐<br>Power: ⭐⭐⭐⭐",
    startBtn: "Start Game",
    instructions: "Instructions",
    scoreLabel: "Score",
    enemiesLabel: "Enemies",
    timeLabel: "Time",
    victory: "VICTORY! 🏆",
    defeat: "GAME OVER 💥",
    finalScoreLabel: "Final Score:",
    finalKillsLabel: "Kills:",
    finalTimeLabel: "Time:",
    restart: "Restart",
    menu: "Menu",
    instructionsText: "🎮 CONTROLS:\n\n" +
        "KEYBOARD:\n" +
        "↑ W / ↑ - Forward\n" +
        "↓ S / ↓ - Backward\n" +
        "← A / ← - Left\n" +
        "→ D / → - Right\n" +
        "SPACE - Shoot\n" +
        "SHIFT - Boost\n\n" +
        "MOBILE:\n" +
        "Use on-screen buttons\n\n" +
        "OBJECTIVE:\n" +
        "✓ Destroy all enemies\n" +
        "✓ Keep your health up\n" +
        "✓ Score more points!\n" +
        "⚠️ Enemies shoot back!\n\n" +
        "Good luck! 🏁"
},
ru: {
    title: "CAR BATTLE RACING",
    subtitle: "3D Гоночная Игра",
    chooseCar: "Выберите машину:",
    car1Name: "🏎️ ДЕМОН СКОРОСТИ",
    car2Name: "🚗 ТАНК-РАЗРУШИТЕЛЬ",
    car3Name: "🏁 СБАЛАНСИРОВАННЫЙ",
    car1Stats: "Скорость: ⭐⭐⭐⭐⭐<br>Сила: ⭐⭐⭐",
    car2Stats: "Скорость: ⭐⭐⭐<br>Сила: ⭐⭐⭐⭐⭐",
    car3Stats: "Скорость: ⭐⭐⭐⭐<br>Сила: ⭐⭐⭐⭐",
    startBtn: "Начать Игру",
    instructions: "Правила",
    scoreLabel: "Очки",
    enemiesLabel: "Враги",
    timeLabel: "Время",
    victory: "ПОБЕДА! 🏆",
    defeat: "ПОРАЖЕНИЕ 💥",
    finalScoreLabel: "Итоговый счёт:",
    finalKillsLabel: "Убийств:",
    finalTimeLabel: "Время:",
    restart: "Играть Снова",
    menu: "Меню",
    instructionsText: "🎮 УПРАВЛЕНИЕ:\n\n" +
        "КЛАВИАТУРА:\n" +
        "↑ W / ↑ - Вперёд\n" +
        "↓ S / ↓ - Назад\n" +
        "← A / ← - Влево\n" +
        "→ D / → - Вправо\n" +
        "ПРОБЕЛ - Стрелять\n" +
        "SHIFT - Ускорение\n\n" +
        "МОБИЛЬНЫЙ:\n" +
        "Используйте кнопки на экране\n\n" +
        "ЦЕЛЬ:\n" +
        "✓ Уничтожить всех врагов\n" +
        "✓ Сохранить здоровье\n" +
        "✓ Набрать больше очков!\n" +
        "⚠️ Враги стреляют в ответ!\n\n" +
        "Удачи! 🏁"
}
};

let currentLang = 'uz';

function updateLanguage(lang) {
currentLang = lang;
const t = translations[lang];

document.getElementById('gameTitle').textContent = t.title;
document.getElementById('gameSubtitle').textContent = t.subtitle;
document.getElementById('chooseCar').textContent = t.chooseCar;
document.getElementById('car1Name').textContent = t.car1Name;
document.getElementById('car2Name').textContent = t.car2Name;
document.getElementById('car3Name').textContent = t.car3Name;
document.getElementById('car1Stats').innerHTML = t.car1Stats;
document.getElementById('car2Stats').innerHTML = t.car2Stats;
document.getElementById('car3Stats').innerHTML = t.car3Stats;
document.getElementById('startBtn').textContent = t.startBtn;
document.getElementById('instructionsBtn').textContent = t.instructions;
document.getElementById('scoreLabel').textContent = t.scoreLabel;
document.getElementById('enemiesLabel').textContent = t.enemiesLabel;
document.getElementById('timeLabel').textContent = t.timeLabel;
document.getElementById('finalScoreLabel').textContent = t.finalScoreLabel;
document.getElementById('finalKillsLabel').textContent = t.finalKillsLabel;
document.getElementById('finalTimeLabel').textContent = t.finalTimeLabel;
document.getElementById('restartBtn').textContent = t.restart;
document.getElementById('menuBtn').textContent = t.menu;
}

document.getElementById('languageSelect').addEventListener('change', (e) => {
updateLanguage(e.target.value);
});


// Kontekst menyusini blokirovka qilish
document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    alert('Kontekst menyusi bloklangan!');
});

// Tezkor tugmalarni blokirovka qilish
document.addEventListener('keydown', function(e) {
    // Ctrl+U blokirovkasi
    if (e.ctrlKey && e.keyCode === 85) {
        e.preventDefault();
        alert('Sahifa manbasini koʻrish bloklangan!');
        return false;
    }
    
    // Ctrl+Shift+I, F12 blokirovkasi
    if (e.ctrlKey && e.shiftKey && e.keyCode === 73 || e.keyCode === 123) {
        e.preventDefault();
        alert('Developer asboblari bloklangan!');
        return false;
    }
});

// Sahifa manbasiga kirishni blokirovka qilish
function disableViewSource() {
    // Bu brauzerda sahifa manbasini yashirishga urinish
    window.onkeypress = function(event) {
        if (event.keyCode === 123) { // F12
            return false;
        } else if (event.ctrlKey && event.shiftKey && event.keyCode === 73) { // Ctrl+Shift+I
            return false;
        } else if (event.ctrlKey && event.keyCode === 85) { // Ctrl+U
            return false;
        }
    };
    
    // O'ng tugma blokirovkasi
    document.oncontextmenu = function() {
        return false;
    };
    
    // Drag and drop blokirovkasi
    document.ondragstart = function() {
        return false;
    };
}

disableViewSource();