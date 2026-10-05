(() => {
  "use strict";

  const canvas = document.querySelector("#gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const stage = document.querySelector("#gameStage");

  const dom = {
    score: document.querySelector("#scoreValue"),
    best: document.querySelector("#bestValue"),
    speed: document.querySelector("#speedValue"),
    speedFill: document.querySelector("#speedFill"),
    finalScore: document.querySelector("#finalScore"),
    finalBest: document.querySelector("#finalBest"),
    collisionMessage: document.querySelector("#collisionMessage"),
    newRecord: document.querySelector("#newRecord"),
    status: document.querySelector("#statusMessage"),
    startScreen: document.querySelector("#startScreen"),
    pauseScreen: document.querySelector("#pauseScreen"),
    gameOverScreen: document.querySelector("#gameOverScreen"),
    start: document.querySelector("#startButton"),
    restart: document.querySelector("#restartButton"),
    resume: document.querySelector("#resumeButton"),
    pause: document.querySelector("#pauseButton"),
    pauseLabel: document.querySelector("#pauseLabel"),
    mute: document.querySelector("#muteButton"),
    soundIcon: document.querySelector("#soundIcon"),
    soundLabel: document.querySelector("#soundLabel"),
    jump: document.querySelector("#jumpButton"),
    duck: document.querySelector("#duckButton"),
    bombs: document.querySelector("#bombValue"),
    ammo: document.querySelector("#ammoValue"),
    gun: document.querySelector("#gunButton"),
  };

  const WORLD = Object.freeze({
    width: 1280,
    height: 720,
    floor: 592,
    gravity: 2350,
    jumpVelocity: -855,
    baseSpeed: 360,
    maxSpeed: 1125,
  });

  const OBSTACLE_SCALE = 0.7;
  const BOMB_COUNT = 5;
  const AMMO_COUNT = 50;
  const PARTICLE_LIMIT = 96;
  const BLAST_DURATION = 0.45;
  const GUN_INTERVAL = 0.14;
  const BULLET_SPEED = 1250;
  const BULLET_LIMIT = 16;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const storageKey = "dashun-jump-best-v1";

  const safeStorage = {
    get() {
      try {
        return Math.max(0, Number.parseInt(localStorage.getItem(storageKey) || "0", 10) || 0);
      } catch (_error) {
        return 0;
      }
    },
    set(value) {
      try {
        localStorage.setItem(storageKey, String(value));
      } catch (_error) {
        // 无痕模式或禁用存储时，游戏仍可正常运行。
      }
    },
  };

  class SoundBoard {
    constructor() {
      this.context = null;
      this.master = null;
      this.muted = false;
    }

    ensureReady() {
      if (this.context) {
        if (this.context.state === "suspended") this.context.resume();
        return;
      }

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.18;
      this.master.connect(this.context.destination);
    }

    setMuted(muted) {
      this.muted = muted;
      if (this.master && this.context) {
        this.master.gain.cancelScheduledValues(this.context.currentTime);
        this.master.gain.setTargetAtTime(muted ? 0 : 0.18, this.context.currentTime, 0.02);
      }
    }

    tone({ frequency = 440, endFrequency = frequency, duration = 0.12, type = "sine", gain = 0.5 } = {}) {
      if (this.muted) return;
      this.ensureReady();
      if (!this.context || !this.master) return;

      const now = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const envelope = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, endFrequency), now + duration);
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), now + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(envelope);
      envelope.connect(this.master);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
    }

    jump() {
      this.tone({ frequency: 310, endFrequency: 610, duration: 0.11, type: "square", gain: 0.22 });
    }

    milestone() {
      this.tone({ frequency: 520, endFrequency: 780, duration: 0.1, type: "triangle", gain: 0.28 });
      window.setTimeout(() => {
        this.tone({ frequency: 720, endFrequency: 980, duration: 0.12, type: "triangle", gain: 0.22 });
      }, 85);
    }

    hit() {
      this.tone({ frequency: 150, endFrequency: 62, duration: 0.3, type: "sawtooth", gain: 0.34 });
    }

    gun() {
      this.tone({ frequency: 480, endFrequency: 190, duration: 0.045, type: "square", gain: 0.1 });
    }
  }

  const sound = new SoundBoard();

  const runnerImage = new Image();
  let runnerImageReady = false;
  runnerImage.onload = () => {
    runnerImageReady = true;
  };
  runnerImage.onerror = () => {
    runnerImageReady = false;
  };
  runnerImage.src = "assets/game/dashun-runner-optimized.png";

  const player = {
    x: 150,
    y: WORLD.floor - 118,
    width: 90,
    height: 118,
    standingWidth: 90,
    standingHeight: 118,
    duckingWidth: 108,
    duckingHeight: 66,
    velocityY: 0,
    onGround: true,
    crouching: false,
    runTime: 0,
  };

  const obstacleKinds = [
    { type: "capsule", label: "滚动核能胶囊", width: 76, height: 54, weight: 1.2, minScore: 0 },
    { type: "chimney", label: "喷气烟囱", width: 62, height: 108, weight: 0.95, minScore: 8 },
    { type: "dumpster", label: "超级垃圾桶", width: 112, height: 87, weight: 0.85, minScore: 15 },
    { type: "steamPipe", label: "低空蒸汽管", width: 148, height: 48, weight: 0.75, minScore: 25 },
    { type: "robot", label: "维修机器人", width: 74, height: 66, weight: 0.9, minScore: 12 },
    { type: "cones", label: "安全锥", width: 101, height: 58, weight: 1.05, minScore: 4 },
  ];

  const game = {
    state: "intro",
    clock: 0,
    distance: 0,
    score: 0,
    best: safeStorage.get(),
    speed: WORLD.baseSpeed,
    obstacles: [],
    particles: [],
    distanceSinceSpawn: 0,
    nextGap: 570,
    lastObstacle: "",
    milestone: 0,
    statusTimer: 0,
    shake: 0,
    newRecord: false,
    bombs: BOMB_COUNT,
    ammo: AMMO_COUNT,
    blasts: [],
    bullets: [],
    gunCooldown: 0,
    shooting: false,
  };

  // 装备只绘制一次，跑动时复用图层。
  const equipmentSprite = createEquipmentSprite();
  const emptyEquipmentSprite = createEquipmentSprite(false);
  const hudCache = {};
  const screenVisibility = new WeakMap();

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function mod(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  function lerp(a, b, amount) {
    return a + (b - a) * amount;
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function roundedRectPath(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function fillRoundedRect(context, x, y, width, height, radius) {
    roundedRectPath(context, x, y, width, height, radius);
    context.fill();
  }

  function strokeRoundedRect(context, x, y, width, height, radius) {
    roundedRectPath(context, x, y, width, height, radius);
    context.stroke();
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function setCanvasTransform(shakeX = 0, shakeY = 0) {
    ctx.setTransform(
      canvas.width / WORLD.width,
      0,
      0,
      canvas.height / WORLD.height,
      shakeX * (canvas.width / WORLD.width),
      shakeY * (canvas.height / WORLD.height),
    );
  }

  function formatScore(value) {
    return String(Math.max(0, Math.floor(value))).padStart(5, "0");
  }

  function updateHud() {
    const score = formatScore(game.score);
    const best = formatScore(game.best);
    const progress = clamp((game.speed - WORLD.baseSpeed) / (WORLD.maxSpeed - WORLD.baseSpeed), 0, 1);
    const gear = Math.min(5, 1 + Math.floor(progress * 5));
    const speedWidth = Math.round(8 + progress * 92);
    const speedColor = progress > 0.72 ? "#d95038" : "#f7c928";
    if (hudCache.score !== score) dom.score.textContent = hudCache.score = score;
    if (hudCache.best !== best) dom.best.textContent = hudCache.best = best;
    if (hudCache.gear !== gear) {
      hudCache.gear = gear;
      dom.speed.textContent = `${gear} 档`;
    }
    if (hudCache.speedWidth !== speedWidth) {
      hudCache.speedWidth = speedWidth;
      dom.speedFill.style.width = `${speedWidth}%`;
    }
    if (hudCache.speedColor !== speedColor) dom.speedFill.style.backgroundColor = hudCache.speedColor = speedColor;
    if (hudCache.bombs !== game.bombs) dom.bombs.textContent = hudCache.bombs = game.bombs;
    if (hudCache.ammo !== game.ammo) dom.ammo.textContent = hudCache.ammo = game.ammo;
    const gunReady = game.state === "running" && game.ammo > 0;
    if (hudCache.gunReady !== gunReady) {
      hudCache.gunReady = gunReady;
      dom.gun.disabled = !gunReady;
    }
    if (hudCache.shooting !== game.shooting) {
      hudCache.shooting = game.shooting;
      dom.gun.setAttribute("aria-pressed", String(game.shooting));
    }
  }

  function setScreen(element, visible) {
    screenVisibility.set(element, visible);
    if (visible) {
      element.hidden = false;
      requestAnimationFrame(() => {
        if (screenVisibility.get(element)) element.classList.add("screen--visible");
      });
    } else {
      element.classList.remove("screen--visible");
      window.setTimeout(() => {
        if (!screenVisibility.get(element)) element.hidden = true;
      }, 250);
    }
  }

  function showStatus(message, duration = 1.35) {
    dom.status.textContent = message;
    dom.status.classList.add("status-message--visible");
    game.statusTimer = duration;
  }

  function hideStatus() {
    game.statusTimer = 0;
    dom.status.classList.remove("status-message--visible");
  }

  function resetPlayer() {
    player.width = player.standingWidth;
    player.height = player.standingHeight;
    player.y = WORLD.floor - player.height;
    player.velocityY = 0;
    player.onGround = true;
    player.crouching = false;
    player.runTime = 0;
  }

  function startGame(jumpImmediately = false) {
    sound.ensureReady();
    game.state = "running";
    game.distance = 0;
    game.score = 0;
    game.speed = WORLD.baseSpeed;
    game.obstacles.length = 0;
    game.particles.length = 0;
    game.distanceSinceSpawn = 0;
    game.nextGap = 530;
    game.lastObstacle = "";
    game.milestone = 0;
    game.shake = 0;
    game.newRecord = false;
    game.bombs = BOMB_COUNT;
    game.ammo = AMMO_COUNT;
    game.blasts.length = 0;
    game.bullets.length = 0;
    game.gunCooldown = 0;
    game.shooting = false;
    resetPlayer();
    hideStatus();
    setScreen(dom.startScreen, false);
    setScreen(dom.gameOverScreen, false);
    setScreen(dom.pauseScreen, false);
    dom.pauseLabel.textContent = "暂停";
    dom.pause.setAttribute("aria-pressed", "false");
    updateHud();
    if (jumpImmediately) jump();
  }

  function togglePause(forcePause) {
    const shouldPause = typeof forcePause === "boolean" ? forcePause : game.state === "running";
    if (shouldPause && game.state === "running") {
      game.state = "paused";
      player.crouching = false;
      game.shooting = false;
      setScreen(dom.pauseScreen, true);
      dom.pauseLabel.textContent = "继续";
      dom.pause.setAttribute("aria-pressed", "true");
      updateHud();
      return;
    }

    if (!shouldPause && game.state === "paused") {
      game.state = "running";
      setScreen(dom.pauseScreen, false);
      dom.pauseLabel.textContent = "暂停";
      dom.pause.setAttribute("aria-pressed", "false");
      updateHud();
    }
  }

  function jump() {
    if (game.state !== "running" || !player.onGround) return;
    setCrouch(false);
    player.velocityY = WORLD.jumpVelocity;
    player.onGround = false;
    sound.jump();
    burst(player.x + 19, WORLD.floor - 7, "dust", prefersReducedMotion ? 2 : 7);
  }

  function setCrouch(crouching) {
    if (game.state !== "running") crouching = false;
    player.crouching = crouching;
    if (crouching && !player.onGround) player.velocityY += 34;
  }

  function chooseObstacle() {
    let available = obstacleKinds.filter((kind) => kind.minScore <= game.score);
    if (available.length > 1) {
      const withoutRepeat = available.filter((kind) => kind.type !== game.lastObstacle);
      if (withoutRepeat.length) available = withoutRepeat;
    }

    const total = available.reduce((sum, kind) => sum + kind.weight, 0);
    let roll = Math.random() * total;
    for (const kind of available) {
      roll -= kind.weight;
      if (roll <= 0) return kind;
    }
    return available[0];
  }

  function spawnObstacle() {
    const kind = chooseObstacle();
    const obstacle = {
      ...kind,
      baseWidth: kind.width,
      baseHeight: kind.height,
      width: Math.round(kind.width * OBSTACLE_SCALE),
      height: Math.round(kind.height * OBSTACLE_SCALE),
      x: WORLD.width + 55,
      y: 0,
      age: 0,
      rotation: Math.random() * Math.PI,
      passed: false,
    };
    obstacle.y = WORLD.floor - obstacle.height;
    if (kind.type === "steamPipe") obstacle.y = WORLD.floor - 101;
    game.obstacles.push(obstacle);
    game.lastObstacle = kind.type;
    game.distanceSinceSpawn = 0;
    game.nextGap = game.speed * randomBetween(0.9, 1.28) + randomBetween(120, 235) + obstacle.width * 0.25;
  }

  function playerHitbox() {
    const ducking = player.crouching && player.onGround;
    return {
      x: player.x + (ducking ? 15 : 21),
      y: player.y + (ducking ? 9 : 10),
      width: player.width - (ducking ? 30 : 42),
      height: player.height - (ducking ? 18 : 22),
    };
  }

  function obstacleHitbox(obstacle) {
    switch (obstacle.type) {
      case "capsule":
        return { x: obstacle.x + obstacle.width * 0.08, y: obstacle.y + obstacle.height * 0.15, width: obstacle.width * 0.84, height: obstacle.height * 0.8 };
      case "chimney":
        return { x: obstacle.x + obstacle.width * 0.11, y: obstacle.y + obstacle.height * 0.04, width: obstacle.width * 0.78, height: obstacle.height * 0.95 };
      case "dumpster":
        return { x: obstacle.x + obstacle.width * 0.05, y: obstacle.y + obstacle.height * 0.1, width: obstacle.width * 0.9, height: obstacle.height * 0.85 };
      case "steamPipe":
        return { x: obstacle.x + obstacle.width * 0.02, y: obstacle.y + obstacle.height * 0.06, width: obstacle.width * 0.96, height: obstacle.height * 0.88 };
      case "robot":
        return { x: obstacle.x + obstacle.width * 0.09, y: obstacle.y + obstacle.height * 0.12, width: obstacle.width * 0.82, height: obstacle.height * 0.8 };
      case "cones":
        return { x: obstacle.x + obstacle.width * 0.05, y: obstacle.y + obstacle.height * 0.14, width: obstacle.width * 0.9, height: obstacle.height * 0.84 };
      default:
        return { x: obstacle.x, y: obstacle.y, width: obstacle.width, height: obstacle.height };
    }
  }

  function overlaps(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function endGame(obstacle) {
    if (game.state !== "running") return;
    game.state = "gameover";
    game.shooting = false;
    game.shake = prefersReducedMotion ? 0 : 5;
    sound.hit();
    game.bullets.length = 0;

    const previousBest = game.best;
    if (game.score > game.best) {
      game.best = game.score;
      game.newRecord = true;
      safeStorage.set(game.best);
    }

    dom.finalScore.textContent = String(game.score);
    dom.finalBest.textContent = String(game.best);
    dom.newRecord.hidden = !game.newRecord;
    dom.collisionMessage.textContent = `炸弹用完了，${obstacle.label}挡住了大顺。再跑一次吧！`;
    if (previousBest > 0 && !game.newRecord && game.score >= previousBest * 0.85) {
      dom.collisionMessage.textContent += " 差一点就破纪录啦。";
    }
    hideStatus();
    setScreen(dom.gameOverScreen, true);
    window.setTimeout(() => {
      if (game.state === "gameover") dom.restart.focus({ preventScroll: true });
    }, 280);
    updateHud();
  }

  function destroyObstacle(obstacle, kind) {
    if (obstacle.cleared) return;
    obstacle.cleared = true;
    const x = obstacle.x + obstacle.width / 2;
    const y = obstacle.y + obstacle.height / 2;
    if (game.blasts.length < 12) game.blasts.push({ x, y, age: 0, kind });
    burst(x, y, "spark", prefersReducedMotion ? 2 : kind === "bomb" ? 10 : 5);
    burst(x, y, "smoke", prefersReducedMotion ? 2 : kind === "bomb" ? 6 : 3);
  }

  function fireGun() {
    if (game.state !== "running" || game.ammo <= 0 || game.gunCooldown > 0 || game.bullets.length >= BULLET_LIMIT) return;
    const x = player.x + player.width * 0.94;
    const y = player.y + player.height * 0.3;
    let target = null;
    for (const obstacle of game.obstacles) {
      if (obstacle.cleared || obstacle.x + obstacle.width < x) continue;
      if (!target || obstacle.x < target.x) target = obstacle;
    }
    game.bullets.push({ x, y, age: 0, target });
    game.ammo -= 1;
    game.gunCooldown = GUN_INTERVAL;
    sound.gun();
    if (game.ammo === 0) {
      game.shooting = false;
      showStatus("子弹用完了，继续跳跃躲障碍！");
    }
    updateHud();
  }

  function setShooting(active) {
    game.shooting = active && game.state === "running" && game.ammo > 0;
    if (game.shooting) fireGun();
    updateHud();
  }

  function updateGun(dt) {
    game.gunCooldown = Math.max(0, game.gunCooldown - dt);
    if (game.shooting) fireGun();
    let retained = 0;
    for (const bullet of game.bullets) {
      const previousX = bullet.x;
      const previousY = bullet.y;
      bullet.x += BULLET_SPEED * dt;
      bullet.age += dt;
      if (bullet.target && !bullet.target.cleared) {
        const targetX = bullet.target.x + bullet.target.width / 2;
        const targetY = bullet.target.y + bullet.target.height / 2;
        const timeToTarget = Math.max(dt, (targetX - previousX) / (BULLET_SPEED + game.speed));
        bullet.y += clamp((targetY - previousY) / timeToTarget, -BULLET_SPEED, BULLET_SPEED) * dt;
      }
      // 检查整段飞行轨迹，低帧率时也不会穿过窄障碍。
      const sweep = {
        x: previousX - 8,
        y: Math.min(previousY, bullet.y) - 4,
        width: bullet.x - previousX + 16,
        height: Math.abs(bullet.y - previousY) + 8,
      };
      let hit = false;
      for (const obstacle of game.obstacles) {
        if (obstacle.cleared || !overlaps(sweep, obstacleHitbox(obstacle))) continue;
        destroyObstacle(obstacle, "gun");
        hit = true;
        break;
      }
      if (!hit && bullet.x < WORLD.width + 60 && bullet.age < 1.2) {
        game.bullets[retained++] = bullet;
      }
    }
    game.bullets.length = retained;
  }

  function updateBlast(dt) {
    let retained = 0;
    for (const blast of game.blasts) {
      blast.age += dt;
      if (blast.age < BLAST_DURATION) game.blasts[retained++] = blast;
    }
    game.blasts.length = retained;
  }

  function makeParticle(x, y, kind) {
    const isSpark = kind === "spark";
    const isSmoke = kind === "smoke";
    return {
      x,
      y,
      vx: isSpark ? randomBetween(-150, 190) : isSmoke ? randomBetween(-100, 100) : randomBetween(-92, -28),
      vy: isSpark ? randomBetween(-235, 30) : isSmoke ? randomBetween(-95, -30) : randomBetween(-70, -12),
      gravity: isSpark ? 520 : isSmoke ? -12 : 70,
      size: isSpark ? randomBetween(3, 7) : isSmoke ? randomBetween(12, 25) : randomBetween(5, 14),
      life: 1,
      decay: isSpark ? randomBetween(1.8, 2.8) : isSmoke ? randomBetween(0.8, 1.15) : randomBetween(1.2, 2),
      kind,
      color: isSpark && Math.random() > 0.35 ? "#f7c928" : "#e65a36",
    };
  }

  function burst(x, y, kind, count) {
    const available = Math.min(count, PARTICLE_LIMIT - game.particles.length);
    for (let index = 0; index < available; index += 1) game.particles.push(makeParticle(x, y, kind));
  }

  function updateParticles(dt) {
    let retained = 0;
    for (const particle of game.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += particle.gravity * dt;
      particle.life -= particle.decay * dt;
      if (particle.kind === "smoke") particle.size += dt * 18;
      if (particle.life > 0) game.particles[retained++] = particle;
    }
    game.particles.length = retained;
  }

  function updatePlayer(dt) {
    player.runTime += dt * (game.speed / WORLD.baseSpeed);

    const previousBottom = player.y + player.height;
    const wantsDuck = player.crouching && player.onGround;
    const targetWidth = wantsDuck ? player.duckingWidth : player.standingWidth;
    const targetHeight = wantsDuck ? player.duckingHeight : player.standingHeight;
    player.width = targetWidth;
    player.height = targetHeight;
    if (player.onGround) player.y = WORLD.floor - player.height;
    else player.y = previousBottom - player.height;

    if (!player.onGround) {
      const fastFall = player.crouching && player.velocityY > -80 ? 1.48 : 1;
      player.velocityY += WORLD.gravity * fastFall * dt;
      player.y += player.velocityY * dt;
      if (player.y + player.height >= WORLD.floor) {
        player.y = WORLD.floor - player.height;
        player.velocityY = 0;
        player.onGround = true;
        burst(player.x + player.width * 0.45, WORLD.floor - 4, "dust", prefersReducedMotion ? 1 : 5);
      }
    }
  }

  function updateGame(dt) {
    game.speed = Math.min(WORLD.maxSpeed, WORLD.baseSpeed + game.distance * 0.0165);
    game.distance += game.speed * dt;
    game.distanceSinceSpawn += game.speed * dt;
    game.score = Math.floor(game.distance / 19);

    updatePlayer(dt);

    if (!prefersReducedMotion && player.onGround && !player.crouching && Math.random() < dt * 7) {
      burst(player.x + 8, WORLD.floor - 3, "dust", 1);
    }

    if (game.distanceSinceSpawn >= game.nextGap) spawnObstacle();

    for (const obstacle of game.obstacles) {
      obstacle.x -= game.speed * dt;
      obstacle.age += dt;
    }
    updateGun(dt);
    const playerBox = playerHitbox();
    for (const obstacle of game.obstacles) {
      if (obstacle.cleared) continue;
      if (!obstacle.passed && obstacle.x + obstacle.width < player.x) {
        obstacle.passed = true;
        if (obstacle.type === "steamPipe") showStatus("漂亮的下蹲！");
      }
      if (overlaps(playerBox, obstacleHitbox(obstacle))) {
        if (game.bombs > 0) {
          game.bombs -= 1;
          destroyObstacle(obstacle, "bomb");
          game.shake = prefersReducedMotion ? 0 : 3;
          sound.hit();
          showStatus(`炸掉${obstacle.label}！剩 ${game.bombs} 枚炸弹`, 1.1);
        } else {
          endGame(obstacle);
          break;
        }
      }
    }
    for (const blast of game.blasts) blast.x -= game.speed * dt;
    game.obstacles = game.obstacles.filter((obstacle) => !obstacle.cleared && obstacle.x + obstacle.width > -70);

    const reachedMilestone = Math.floor(game.score / 100);
    if (reachedMilestone > game.milestone) {
      game.milestone = reachedMilestone;
      sound.milestone();
      showStatus(`${game.milestone * 100} 米！继续加油！`);
    }

    if (game.statusTimer > 0) {
      game.statusTimer -= dt;
      if (game.statusTimer <= 0) hideStatus();
    }

    updateHud();
  }

  function updatePassive(dt) {
    if (game.state === "paused") return;
    game.clock += dt;
    updateParticles(dt);
    updateBlast(dt);
    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 28);
  }

  function drawCloud(x, y, scale, alpha = 0.82) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#fff8e9";
    ctx.beginPath();
    ctx.arc(x, y, 22 * scale, Math.PI, 0);
    ctx.arc(x + 27 * scale, y - 9 * scale, 29 * scale, Math.PI, 0.15);
    ctx.arc(x + 61 * scale, y, 22 * scale, Math.PI * 1.08, 0);
    ctx.lineTo(x + 80 * scale, y + 18 * scale);
    ctx.lineTo(x - 18 * scale, y + 18 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawSky() {
    const sky = ctx.createLinearGradient(0, 0, 0, WORLD.floor);
    sky.addColorStop(0, "#83c9ef");
    sky.addColorStop(0.58, "#bfe5ed");
    sky.addColorStop(1, "#f7dcaa");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    const sun = ctx.createRadialGradient(1060, 139, 6, 1060, 139, 94);
    sun.addColorStop(0, "rgba(255, 246, 177, 0.98)");
    sun.addColorStop(0.27, "rgba(255, 222, 93, 0.73)");
    sun.addColorStop(1, "rgba(255, 222, 93, 0)");
    ctx.fillStyle = sun;
    ctx.fillRect(940, 20, 240, 240);

    const cloudTravel = game.distance * 0.025 + game.clock * 4;
    const cloudData = [
      [95, 112, 0.86, 0.7],
      [450, 169, 0.58, 0.58],
      [790, 80, 0.7, 0.7],
      [1190, 205, 0.46, 0.55],
      [1510, 118, 0.75, 0.67],
    ];
    for (const [baseX, y, scale, alpha] of cloudData) {
      const x = mod(baseX - cloudTravel, 1670) - 130;
      drawCloud(x, y, scale, alpha);
    }
  }

  function drawMountains() {
    const offset = mod(game.distance * 0.065, 760);
    ctx.save();
    ctx.translate(-offset, 0);
    for (let repeat = -1; repeat < 3; repeat += 1) {
      const x = repeat * 760;
      ctx.fillStyle = "#7f9ca2";
      ctx.beginPath();
      ctx.moveTo(x, 430);
      ctx.lineTo(x + 135, 307);
      ctx.lineTo(x + 210, 374);
      ctx.lineTo(x + 330, 254);
      ctx.lineTo(x + 470, 399);
      ctx.lineTo(x + 590, 288);
      ctx.lineTo(x + 760, 430);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgba(236, 241, 224, 0.68)";
      ctx.beginPath();
      ctx.moveTo(x + 270, 315);
      ctx.lineTo(x + 330, 254);
      ctx.lineTo(x + 391, 317);
      ctx.lineTo(x + 348, 298);
      ctx.lineTo(x + 329, 324);
      ctx.lineTo(x + 310, 295);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCoolingTower(x, y, width, height) {
    ctx.save();
    const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
    gradient.addColorStop(0, "#aebbb8");
    gradient.addColorStop(0.48, "#f0eee1");
    gradient.addColorStop(1, "#9daba9");
    ctx.fillStyle = gradient;
    ctx.strokeStyle = "#6f8386";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + width * 0.16, y + height);
    ctx.quadraticCurveTo(x + width * 0.31, y + height * 0.48, x + width * 0.26, y + 9);
    ctx.quadraticCurveTo(x + width * 0.5, y - 5, x + width * 0.74, y + 9);
    ctx.quadraticCurveTo(x + width * 0.69, y + height * 0.48, x + width * 0.84, y + height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(77, 99, 104, 0.36)";
    ctx.lineWidth = 1;
    for (let row = 1; row <= 5; row += 1) {
      const yy = y + (height / 6) * row;
      ctx.beginPath();
      ctx.moveTo(x + width * (0.25 - row * 0.012), yy);
      ctx.lineTo(x + width * (0.75 + row * 0.012), yy);
      ctx.stroke();
    }

    const steamDrift = Math.sin(game.clock * 0.38 + x) * 12;
    drawCloud(x + width * 0.32 + steamDrift, y - 28, width / 190, 0.66);
    drawCloud(x + width * 0.2 + steamDrift * 0.6, y - 61, width / 230, 0.43);
    ctx.restore();
  }

  function drawFarPlant() {
    const offset = mod(game.distance * 0.13, 1550);
    ctx.save();
    ctx.translate(-offset, 0);
    for (let repeat = -1; repeat < 3; repeat += 1) {
      const base = repeat * 1550;
      drawCoolingTower(base + 575, 188, 252, 300);
      drawCoolingTower(base + 850, 240, 192, 248);

      ctx.fillStyle = "#d8d8cc";
      ctx.strokeStyle = "#73888c";
      ctx.lineWidth = 3;
      ctx.fillRect(base + 195, 355, 286, 134);
      ctx.strokeRect(base + 195, 355, 286, 134);
      ctx.fillStyle = "#2874aa";
      ctx.fillRect(base + 195, 389, 286, 29);
      ctx.fillStyle = "#f4cc39";
      ctx.fillRect(base + 211, 331, 236, 12);

      ctx.fillStyle = "#d8d8cc";
      ctx.strokeStyle = "#73888c";
      ctx.beginPath();
      ctx.arc(base + 365, 363, 93, Math.PI, 0);
      ctx.lineTo(base + 458, 472);
      ctx.lineTo(base + 272, 472);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#2874aa";
      ctx.fillRect(base + 274, 399, 182, 18);
    }
    ctx.restore();
  }

  function drawPowerPylon(x, floorY, scale) {
    ctx.save();
    ctx.translate(x, floorY);
    ctx.scale(scale, scale);
    ctx.strokeStyle = "rgba(55, 78, 85, 0.62)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.lineTo(-8, -155);
    ctx.lineTo(8, -155);
    ctx.lineTo(30, 0);
    ctx.moveTo(-23, -48);
    ctx.lineTo(23, -48);
    ctx.moveTo(-18, -87);
    ctx.lineTo(18, -87);
    ctx.moveTo(-42, -121);
    ctx.lineTo(42, -121);
    ctx.moveTo(-34, -108);
    ctx.lineTo(34, -108);
    ctx.moveTo(-8, -155);
    ctx.lineTo(8, 0);
    ctx.moveTo(8, -155);
    ctx.lineTo(-8, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawMidground() {
    const travel = mod(game.distance * 0.28, 680);
    ctx.save();
    ctx.translate(-travel, 0);
    for (let repeat = -1; repeat < 4; repeat += 1) {
      const x = repeat * 680;
      drawPowerPylon(x + 105, 507, 0.8);
      drawPowerPylon(x + 560, 507, 0.58);

      ctx.strokeStyle = "rgba(43, 68, 78, 0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 60, 410);
      ctx.quadraticCurveTo(x + 330, 445, x + 520, 426);
      ctx.stroke();

      ctx.fillStyle = "#41665f";
      ctx.beginPath();
      ctx.arc(x + 240, 493, 44, Math.PI, 0);
      ctx.arc(x + 291, 493, 60, Math.PI, 0);
      ctx.arc(x + 357, 493, 41, Math.PI, 0);
      ctx.lineTo(x + 401, 515);
      ctx.lineTo(x + 198, 515);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#79a75f";
      ctx.beginPath();
      ctx.arc(x + 260, 493, 34, Math.PI, 0);
      ctx.arc(x + 319, 493, 43, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    const railOffset = mod(game.distance * 0.5, 150);
    ctx.save();
    ctx.translate(-railOffset, 0);
    ctx.strokeStyle = "#d6a51d";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-170, 503);
    ctx.lineTo(1450, 503);
    ctx.moveTo(-170, 547);
    ctx.lineTo(1450, 547);
    for (let x = -150; x < 1450; x += 150) {
      ctx.moveTo(x, 503);
      ctx.lineTo(x, 574);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawGround() {
    ctx.fillStyle = "#b9aca0";
    ctx.fillRect(0, WORLD.floor, WORLD.width, WORLD.height - WORLD.floor);
    ctx.fillStyle = "#6f7776";
    ctx.fillRect(0, WORLD.floor, WORLD.width, 9);
    ctx.fillStyle = "#ded4c5";
    ctx.fillRect(0, WORLD.floor + 9, WORLD.width, 17);

    const stripeOffset = mod(game.distance * 0.88, 80);
    ctx.save();
    ctx.translate(-stripeOffset, 0);
    for (let x = -90; x < WORLD.width + 90; x += 80) {
      ctx.fillStyle = "#f0c82c";
      ctx.beginPath();
      ctx.moveTo(x, WORLD.floor + 27);
      ctx.lineTo(x + 48, WORLD.floor + 27);
      ctx.lineTo(x + 18, WORLD.floor + 53);
      ctx.lineTo(x - 30, WORLD.floor + 53);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#283b45";
      ctx.beginPath();
      ctx.moveTo(x + 48, WORLD.floor + 27);
      ctx.lineTo(x + 80, WORLD.floor + 27);
      ctx.lineTo(x + 50, WORLD.floor + 53);
      ctx.lineTo(x + 18, WORLD.floor + 53);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = "#566260";
    ctx.fillRect(0, WORLD.floor + 53, WORLD.width, 7);
    ctx.fillStyle = "#8b8580";
    ctx.fillRect(0, WORLD.floor + 60, WORLD.width, 68);
    ctx.strokeStyle = "rgba(56, 63, 65, 0.32)";
    ctx.lineWidth = 2;
    const seamOffset = mod(game.distance * 0.88, 190);
    for (let x = -seamOffset; x < WORLD.width + 190; x += 190) {
      ctx.beginPath();
      ctx.moveTo(x, WORLD.floor + 61);
      ctx.lineTo(x + 30, WORLD.height);
      ctx.stroke();
      ctx.fillStyle = "#535b5a";
      ctx.beginPath();
      ctx.arc(x + 24, WORLD.floor + 77, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawAtomSymbol(x, y, scale, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5 * scale;
    for (let index = 0; index < 3; index += 1) {
      ctx.save();
      ctx.rotate((Math.PI / 3) * index);
      ctx.beginPath();
      ctx.ellipse(0, 0, 17 * scale, 7 * scale, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 3.6 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCapsule(obstacle) {
    ctx.save();
    ctx.translate(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2);
    ctx.rotate(-obstacle.x * 0.025 + obstacle.rotation);
    ctx.fillStyle = "#23343f";
    ctx.strokeStyle = "#102e52";
    ctx.lineWidth = 4;
    fillRoundedRect(ctx, -obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height, 25);
    strokeRoundedRect(ctx, -obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height, 25);
    ctx.fillStyle = "#f7c928";
    ctx.fillRect(-24, -obstacle.height / 2, 15, obstacle.height);
    ctx.fillRect(9, -obstacle.height / 2, 15, obstacle.height);
    drawAtomSymbol(0, 0, 0.7, "#f7c928");
    ctx.restore();

    ctx.strokeStyle = "rgba(248, 250, 232, 0.72)";
    ctx.lineWidth = 4;
    for (let index = 0; index < 2; index += 1) {
      const trailX = obstacle.x - 10 - index * 16;
      ctx.beginPath();
      ctx.moveTo(trailX, obstacle.y + 19 + index * 11);
      ctx.lineTo(trailX - 10, obstacle.y + 19 + index * 11);
      ctx.stroke();
    }
  }

  function drawChimney(obstacle) {
    const x = obstacle.x;
    const y = obstacle.y;
    const w = obstacle.width;
    const h = obstacle.height;
    const metal = ctx.createLinearGradient(x, 0, x + w, 0);
    metal.addColorStop(0, "#808c8c");
    metal.addColorStop(0.45, "#d7d7ca");
    metal.addColorStop(1, "#6a787a");
    ctx.fillStyle = metal;
    ctx.strokeStyle = "#263e4b";
    ctx.lineWidth = 4;
    fillRoundedRect(ctx, x + 12, y + 9, w - 24, h - 15, 7);
    strokeRoundedRect(ctx, x + 12, y + 9, w - 24, h - 15, 7);
    ctx.fillStyle = "#ced2c7";
    fillRoundedRect(ctx, x + 3, y, w - 6, 18, 6);
    ctx.strokeStyle = "#263e4b";
    strokeRoundedRect(ctx, x + 3, y, w - 6, 18, 6);
    ctx.fillStyle = "#263e4b";
    ctx.fillRect(x + 13, y + 54, w - 26, 16);
    ctx.fillStyle = "#f7c928";
    for (let stripe = 0; stripe < 3; stripe += 1) {
      ctx.save();
      ctx.translate(x + 14 + stripe * 15, y + 54);
      ctx.rotate(-0.55);
      ctx.fillRect(0, 0, 8, 25);
      ctx.restore();
    }
    ctx.fillStyle = "#616c6e";
    fillRoundedRect(ctx, x, y + h - 17, w, 17, 4);

    const puff = mod(obstacle.age * 65, 58);
    ctx.globalAlpha = 0.75 * (1 - puff / 65);
    drawCloud(x + 10 + Math.sin(obstacle.age * 3) * 5, y - 5 - puff, 0.28 + puff / 260, 0.8);
    ctx.globalAlpha = 1;
  }

  function drawDumpster(obstacle) {
    const { x, y, width: w, height: h } = obstacle;
    ctx.fillStyle = "#315f51";
    ctx.strokeStyle = "#173d3b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 17);
    ctx.lineTo(x + w - 10, y + 17);
    ctx.lineTo(x + w - 18, y + h - 13);
    ctx.lineTo(x + 18, y + h - 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#f7c928";
    fillRoundedRect(ctx, x + 1, y + 4, w - 2, 20, 7);
    ctx.strokeStyle = "#173d3b";
    strokeRoundedRect(ctx, x + 1, y + 4, w - 2, 20, 7);
    ctx.fillStyle = "#22493f";
    fillRoundedRect(ctx, x + 2, y, 16, 16, 4);
    fillRoundedRect(ctx, x + w - 18, y, 16, 16, 4);

    ctx.fillStyle = "#e4efe2";
    ctx.font = "900 17px 'Arial Rounded MT Bold', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("超级", x + w / 2, y + 48);
    ctx.font = "900 14px 'Arial Rounded MT Bold', sans-serif";
    ctx.fillText("回收桶", x + w / 2, y + 66);

    ctx.fillStyle = "#283d42";
    ctx.beginPath();
    ctx.arc(x + 23, y + h - 7, 9, 0, Math.PI * 2);
    ctx.arc(x + w - 23, y + h - 7, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a8b3ae";
    ctx.beginPath();
    ctx.arc(x + 23, y + h - 7, 3, 0, Math.PI * 2);
    ctx.arc(x + w - 23, y + h - 7, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSteamPipe(obstacle) {
    const { x, y, width: w, height: h } = obstacle;
    const floorY = obstacle.drawFloor ?? WORLD.floor;
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = "#6f8386";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x + 20, y + h);
    ctx.lineTo(x + 20, floorY);
    ctx.moveTo(x + w - 20, y + h);
    ctx.lineTo(x + w - 20, floorY);
    ctx.stroke();
    ctx.restore();

    const metal = ctx.createLinearGradient(0, y, 0, y + h);
    metal.addColorStop(0, "#eef0df");
    metal.addColorStop(0.48, "#9eaba9");
    metal.addColorStop(1, "#596b70");
    ctx.fillStyle = metal;
    ctx.strokeStyle = "#28414d";
    ctx.lineWidth = 4;
    fillRoundedRect(ctx, x, y, w, h, h / 2);
    strokeRoundedRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = "#f7c928";
    ctx.fillRect(x + 22, y + 3, 18, h - 6);
    ctx.fillRect(x + w - 40, y + 3, 18, h - 6);
    ctx.strokeStyle = "#28414d";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 22, y + 3, 18, h - 6);
    ctx.strokeRect(x + w - 40, y + 3, 18, h - 6);

    const steamX = x + w * 0.7;
    const puff = mod(obstacle.age * 80, 50);
    ctx.globalAlpha = 0.62 * (1 - puff / 58);
    drawCloud(steamX + Math.sin(obstacle.age * 4) * 6, y - 10 - puff, 0.22 + puff / 260, 0.72);
    ctx.globalAlpha = 1;
  }

  function drawRobot(obstacle) {
    const { x, y, width: w, height: h } = obstacle;
    const bob = Math.sin(obstacle.age * 8) * 2;
    ctx.save();
    ctx.translate(0, bob);
    ctx.fillStyle = "#f7c928";
    ctx.strokeStyle = "#203d50";
    ctx.lineWidth = 4;
    fillRoundedRect(ctx, x + 8, y + 13, w - 16, h - 25, 12);
    strokeRoundedRect(ctx, x + 8, y + 13, w - 16, h - 25, 12);
    ctx.fillStyle = "#183743";
    fillRoundedRect(ctx, x + 15, y + 20, w - 30, 22, 7);
    ctx.fillStyle = "#9de4d1";
    ctx.beginPath();
    ctx.arc(x + 28, y + 31, 4, 0, Math.PI * 2);
    ctx.arc(x + w - 28, y + 31, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#203d50";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 13);
    ctx.lineTo(x + w / 2, y + 4);
    ctx.stroke();
    ctx.fillStyle = "#d95038";
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#263b43";
    ctx.beginPath();
    ctx.arc(x + 20, y + h - 8, 10, 0, Math.PI * 2);
    ctx.arc(x + w - 20, y + h - 8, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCone(x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ea5a36";
    ctx.strokeStyle = "#7f342a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(17, 0);
    ctx.lineTo(32, 46);
    ctx.lineTo(2, 46);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f9ead1";
    ctx.beginPath();
    ctx.moveTo(9, 23);
    ctx.lineTo(26, 23);
    ctx.lineTo(29, 32);
    ctx.lineTo(6, 32);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#34454a";
    fillRoundedRect(ctx, -3, 43, 40, 10, 3);
    ctx.restore();
  }

  function drawCones(obstacle) {
    const baseY = obstacle.y + obstacle.height - 53;
    drawCone(obstacle.x + 2, baseY + 6, 0.88);
    drawCone(obstacle.x + 34, baseY, 1);
    drawCone(obstacle.x + 72, baseY + 8, 0.84);
  }

  const obstacleRenderView = {};

  function drawObstacle(obstacle) {
    const designObstacle = obstacleRenderView;
    designObstacle.x = obstacle.x;
    designObstacle.y = obstacle.y;
    designObstacle.width = obstacle.baseWidth;
    designObstacle.height = obstacle.baseHeight;
    designObstacle.age = obstacle.age;
    designObstacle.rotation = obstacle.rotation;
    designObstacle.drawFloor = obstacle.y + (WORLD.floor - obstacle.y) / OBSTACLE_SCALE;

    ctx.save();
    ctx.translate(obstacle.x, obstacle.y);
    ctx.scale(OBSTACLE_SCALE, OBSTACLE_SCALE);
    ctx.translate(-obstacle.x, -obstacle.y);
    switch (obstacle.type) {
      case "capsule": drawCapsule(designObstacle); break;
      case "chimney": drawChimney(designObstacle); break;
      case "dumpster": drawDumpster(designObstacle); break;
      case "steamPipe": drawSteamPipe(designObstacle); break;
      case "robot": drawRobot(designObstacle); break;
      case "cones": drawCones(designObstacle); break;
      default: break;
    }
    ctx.restore();
  }

  function createEquipmentSprite(includeBombs = true) {
    const sprite = document.createElement("canvas");
    sprite.width = 640;
    sprite.height = 551;
    const equipment = sprite.getContext("2d");
    equipment.lineWidth = 5;
    equipment.strokeStyle = "#203b50";

    // 装备包和腰带，剩余数量由 HUD 显示。
    if (includeBombs) {
      equipment.fillStyle = "#ec913e";
      fillRoundedRect(equipment, 227, 178, 73, 107, 14);
      strokeRoundedRect(equipment, 227, 178, 73, 107, 14);
      equipment.fillStyle = "#ffd36b";
      fillRoundedRect(equipment, 237, 230, 54, 42, 8);
      equipment.fillStyle = "#213f52";
      equipment.textAlign = "center";
      equipment.font = "900 27px sans-serif";
      equipment.fillText("炸", 264, 260);
      equipment.strokeStyle = "#ec913e";
      equipment.lineWidth = 9;
      equipment.beginPath();
      equipment.moveTo(280, 143);
      equipment.lineTo(309, 263);
      equipment.stroke();
      equipment.fillStyle = "#ed9f4c";
      fillRoundedRect(equipment, 270, 266, 84, 22, 7);
      for (let index = 0; index < 3; index += 1) {
        const x = 282 + index * 29;
        equipment.strokeStyle = "#eeb75b";
        equipment.lineWidth = 4;
        equipment.beginPath();
        equipment.moveTo(x, 271);
        equipment.quadraticCurveTo(x - 4, 255, x + 7, 257);
        equipment.stroke();
        equipment.fillStyle = "#263e56";
        equipment.beginPath();
        equipment.arc(x, 282, 13, 0, Math.PI * 2);
        equipment.fill();
        equipment.fillStyle = "#c3e7ec";
        equipment.beginPath();
        equipment.arc(x - 4, 278, 3, 0, Math.PI * 2);
        equipment.fill();
      }
    }

    // 手里的卡通枪，即使炸弹用完也能继续开枪。
    equipment.strokeStyle = "#254555";
    equipment.lineWidth = 5;
    equipment.fillStyle = "#f5ca45";
    fillRoundedRect(equipment, 440, 181, 17, 29, 5);
    strokeRoundedRect(equipment, 440, 181, 17, 29, 5);
    equipment.fillStyle = "#75d4d9";
    fillRoundedRect(equipment, 432, 165, 74, 23, 7);
    strokeRoundedRect(equipment, 432, 165, 74, 23, 7);
    equipment.fillStyle = "#244855";
    fillRoundedRect(equipment, 500, 168, 13, 17, 4);
    equipment.fillStyle = "#efffff";
    equipment.fillRect(443, 171, 26, 4);
    return sprite;
  }

  function drawRunnerPlaceholder(x, y, width, height, crouching) {
    ctx.save();
    ctx.translate(x + width / 2, y + height / 2);
    if (crouching) ctx.rotate(-0.08);

    const scale = height / 88;
    ctx.scale(scale, scale);
    const localWidth = width / scale;
    const left = -localWidth / 2;
    const top = -44;

    ctx.fillStyle = "#f1c09c";
    ctx.strokeStyle = "#16344e";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(left + 37, top + 17, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#152c3f";
    ctx.beginPath();
    ctx.arc(left + 35, top + 12, 14, Math.PI, Math.PI * 1.95);
    ctx.lineTo(left + 48, top + 10);
    ctx.quadraticCurveTo(left + 39, top - 2, left + 26, top + 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#173c70";
    ctx.strokeStyle = "#102e52";
    fillRoundedRect(ctx, left + 24, top + 30, 34, 35, 10);
    strokeRoundedRect(ctx, left + 24, top + 30, 34, 35, 10);
    ctx.fillStyle = "#f7f2df";
    fillRoundedRect(ctx, left + 34, top + 31, 15, 32, 5);

    ctx.strokeStyle = "#173c70";
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    const stride = Math.sin(player.runTime * 11) * (crouching ? 5 : 13);
    ctx.beginPath();
    ctx.moveTo(left + 29, top + 61);
    ctx.lineTo(left + 21 - stride * 0.35, top + 78);
    ctx.lineTo(left + 12 - stride, top + 84);
    ctx.moveTo(left + 52, top + 61);
    ctx.lineTo(left + 53 + stride * 0.35, top + 77);
    ctx.lineTo(left + 62 + stride, top + 82);
    ctx.stroke();

    ctx.strokeStyle = "#f8f3e3";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(left + 9 - stride, top + 84);
    ctx.lineTo(left + 18 - stride, top + 84);
    ctx.moveTo(left + 60 + stride, top + 82);
    ctx.lineTo(left + 69 + stride, top + 82);
    ctx.stroke();

    ctx.strokeStyle = "#173c70";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(left + 28, top + 37);
    ctx.lineTo(left + 12 - stride * 0.35, top + 51);
    ctx.moveTo(left + 54, top + 38);
    ctx.lineTo(left + 68 + stride * 0.35, top + 48);
    ctx.stroke();

    ctx.fillStyle = "#16344e";
    ctx.beginPath();
    ctx.arc(left + 42, top + 16, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer() {
    const crouching = player.crouching && player.onGround;
    const bob = player.onGround && !prefersReducedMotion ? Math.abs(Math.sin(player.runTime * 11)) * 2.5 : 0;
    const tilt = player.onGround ? Math.sin(player.runTime * 11) * 0.018 : clamp(player.velocityY / 3800, -0.08, 0.13);

    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#263b43";
    ctx.beginPath();
    const shadowScale = player.onGround ? 1 : clamp(1 - (WORLD.floor - player.y - player.height) / 300, 0.4, 1);
    ctx.ellipse(player.x + player.width / 2, WORLD.floor + 5, 34 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const drawX = player.x;
    const drawY = player.y - bob;
    if (!runnerImageReady) {
      drawRunnerPlaceholder(drawX, drawY, player.width, player.height, crouching);
      return;
    }

    ctx.save();
    ctx.translate(drawX + player.width / 2, drawY + player.height / 2);
    ctx.rotate(tilt);
    const sourceRatio = runnerImage.naturalWidth / runnerImage.naturalHeight || 0.8;
    let imageHeight = player.height * (crouching ? 1.32 : 1.18);
    let imageWidth = imageHeight * sourceRatio;
    const maxWidth = player.width * (crouching ? 1.42 : 1.86);
    if (imageWidth > maxWidth) {
      imageWidth = maxWidth;
      imageHeight = imageWidth / sourceRatio;
    }
    ctx.drawImage(runnerImage, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
    ctx.drawImage(game.bombs > 0 ? equipmentSprite : emptyEquipmentSprite, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
    ctx.restore();
  }

  function drawBullets() {
    ctx.save();
    ctx.fillStyle = "#ffe46c";
    ctx.strokeStyle = "#bc6235";
    ctx.lineWidth = 1.5;
    for (const bullet of game.bullets) {
      fillRoundedRect(ctx, bullet.x - 9, bullet.y - 3, 18, 6, 3);
      strokeRoundedRect(ctx, bullet.x - 9, bullet.y - 3, 18, 6, 3);
    }
    ctx.restore();
  }

  function drawBlast() {
    for (const blast of game.blasts) {
      const progress = clamp(blast.age / BLAST_DURATION, 0, 1);
      const radius = prefersReducedMotion ? 28 : (blast.kind === "bomb" ? 32 : 20) + progress * 35;
      ctx.save();
      ctx.translate(blast.x, blast.y);
      ctx.globalAlpha = (1 - progress) * 0.85;
      ctx.fillStyle = "#ef873c";
      ctx.strokeStyle = "#ca5b30";
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let index = 0; index < 24; index += 1) {
        const angle = index / 24 * Math.PI * 2;
        const length = radius * (index % 2 ? 0.7 : 1);
        const x = Math.cos(angle) * length;
        const y = Math.sin(angle) * length;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffd76b";
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1 - progress * 0.5;
      ctx.fillStyle = "#203e53";
      ctx.font = "900 20px 'PingFang SC', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(blast.kind === "bomb" ? "砰！" : "命中！", 0, -45 - progress * 16);
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const particle of game.particles) {
      ctx.save();
      ctx.globalAlpha = clamp(particle.life, 0, 1);
      if (particle.kind === "spark") {
        ctx.fillStyle = particle.color;
        ctx.translate(particle.x, particle.y);
        ctx.rotate(Math.atan2(particle.vy, particle.vx));
        ctx.fillRect(-particle.size * 1.7, -particle.size / 2, particle.size * 3.4, particle.size);
      } else {
        if (particle.kind === "smoke") ctx.globalAlpha *= 0.62;
        ctx.fillStyle = particle.kind === "smoke" ? "#d9edf0" : "#e7dfce";
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawScene() {
    drawSky();
    drawMountains();
    drawFarPlant();
    drawMidground();
    drawGround();

    for (const obstacle of game.obstacles) drawObstacle(obstacle);
    drawPlayer();
    drawBullets();
    drawBlast();
    drawParticles();

    if (game.state === "intro") {
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = "#fffaf0";
      ctx.font = "800 17px 'Arial Rounded MT Bold', 'PingFang SC', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("安全运行区  ·  春季巡检", 37, WORLD.height - 24);
      ctx.restore();
    }
  }

  function render() {
    const shakeX = game.shake > 0 ? randomBetween(-game.shake, game.shake) : 0;
    const shakeY = game.shake > 0 ? randomBetween(-game.shake * 0.45, game.shake * 0.45) : 0;
    setCanvasTransform(shakeX, shakeY);
    ctx.clearRect(-20, -20, WORLD.width + 40, WORLD.height + 40);
    drawScene();
  }

  function handlePrimaryAction(fromCanvas = false) {
    sound.ensureReady();
    if (game.state === "intro") {
      startGame(fromCanvas);
    } else if (game.state === "gameover") {
      startGame(fromCanvas);
    } else if (game.state === "paused") {
      togglePause(false);
    } else {
      jump();
    }
  }

  function toggleMute() {
    sound.setMuted(!sound.muted);
    dom.mute.setAttribute("aria-pressed", String(sound.muted));
    dom.soundIcon.textContent = sound.muted ? "×" : "♪";
    dom.soundLabel.textContent = sound.muted ? "声音：关" : "声音：开";
    if (!sound.muted) sound.tone({ frequency: 540, endFrequency: 660, duration: 0.08, gain: 0.16 });
  }

  dom.start.addEventListener("click", () => startGame(false));
  dom.restart.addEventListener("click", () => startGame(false));
  dom.resume.addEventListener("click", () => togglePause(false));
  dom.pause.addEventListener("click", () => {
    if (game.state === "running") togglePause(true);
    else if (game.state === "paused") togglePause(false);
  });
  dom.mute.addEventListener("click", toggleMute);
  dom.gun.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    dom.gun.setPointerCapture?.(event.pointerId);
    setShooting(true);
  });
  for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
    dom.gun.addEventListener(eventName, () => setShooting(false));
  }
  dom.gun.addEventListener("click", fireGun);
  dom.jump.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    dom.jump.classList.add("touch-button--active");
    handlePrimaryAction(true);
  });
  for (const eventName of ["pointerup", "pointercancel", "pointerleave"]) {
    dom.jump.addEventListener(eventName, () => dom.jump.classList.remove("touch-button--active"));
  }

  dom.duck.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    dom.duck.setPointerCapture?.(event.pointerId);
    dom.duck.classList.add("touch-button--active");
    setCrouch(true);
  });
  for (const eventName of ["pointerup", "pointercancel", "lostpointercapture"]) {
    dom.duck.addEventListener(eventName, () => {
      dom.duck.classList.remove("touch-button--active");
      setCrouch(false);
    });
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    handlePrimaryAction(true);
  });

  window.addEventListener("keydown", (event) => {
    if (["Space", "ArrowUp", "ArrowDown"].includes(event.code)) event.preventDefault();
    if (event.repeat && ["Space", "ArrowUp", "KeyW", "KeyP", "KeyJ"].includes(event.code)) return;

    if (["Space", "ArrowUp", "KeyW"].includes(event.code)) {
      handlePrimaryAction(true);
    } else if (["ArrowDown", "KeyS"].includes(event.code)) {
      setCrouch(true);
    } else if (event.code === "KeyP") {
      if (game.state === "running") togglePause(true);
      else if (game.state === "paused") togglePause(false);
    } else if (event.code === "KeyM") {
      toggleMute();
    } else if (event.code === "KeyJ") {
      event.preventDefault();
      setShooting(true);
    } else if (event.code === "KeyR" && game.state === "gameover") {
      startGame(false);
    }
  });

  window.addEventListener("keyup", (event) => {
    if (["ArrowDown", "KeyS"].includes(event.code)) setCrouch(false);
    if (event.code === "KeyJ") setShooting(false);
  });

  window.addEventListener("blur", () => setShooting(false));

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.state === "running") togglePause(true);
  });

  window.addEventListener("resize", resizeCanvas);
  if ("ResizeObserver" in window) new ResizeObserver(resizeCanvas).observe(stage);

  updateHud();
  resizeCanvas();

  let lastTime = performance.now();
  function frame(now) {
    const dt = Math.min(0.034, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    updatePassive(dt);
    if (game.state === "running") updateGame(dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
