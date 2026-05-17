(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const ui = {
    day: document.getElementById("dayLabel"),
    time: document.getElementById("timeLabel"),
    health: document.getElementById("healthMeter"),
    food: document.getElementById("foodMeter"),
    heat: document.getElementById("heatMeter"),
    wood: document.getElementById("woodCount"),
    berries: document.getElementById("berryCount"),
    stones: document.getElementById("stoneCount"),
    wallCount: document.getElementById("wallCount"),
    coins: document.getElementById("coinCount"),
    weapon: document.getElementById("weaponName"),
    className: document.getElementById("className"),
    quests: document.getElementById("questList"),
    gather: document.getElementById("gatherButton"),
    eat: document.getElementById("eatButton"),
    fire: document.getElementById("fireButton"),
    wall: document.getElementById("wallButton"),
    attack: document.getElementById("attackButton"),
    menu: document.getElementById("menuButton"),
    panel: document.getElementById("messagePanel"),
    helpPanel: document.getElementById("helpPanel"),
    menuPanel: document.getElementById("menuPanel"),
    classList: document.getElementById("classList"),
    menuCoins: document.getElementById("menuCoinCount"),
    version: document.getElementById("versionLabel"),
    message: document.getElementById("messageText"),
    start: document.getElementById("startButton"),
    titleMenu: document.getElementById("titleMenuButton"),
    help: document.getElementById("helpButton"),
    titleHelp: document.getElementById("titleHelpButton"),
    closeMenu: document.getElementById("closeMenuButton"),
    closeHelp: document.getElementById("closeHelpButton"),
    update: document.getElementById("updateButton")
  };

  const APP_VERSION = "0.6.0";
  const SPRITES = {
    player: loadSprite("assets/3days-shujimkou.png"),
    enemy: loadSprite("assets/3days-bakemono.png")
  };
  const TAU = Math.PI * 2;
  const WORLD = { width: 1800, height: 1300 };
  const DAY_SECONDS = 76;
  const WIN_DAY = 10;
  const COIN_KEY = "forest-three-nights-coins";
  const CLASS_KEY = "forest-three-nights-class";
  const UNLOCKED_CLASS_KEY = "forest-three-nights-unlocked-classes";
  const QUESTS = [
    { id: "wood", label: "木材を6個集める", target: 6, reward: 8 },
    { id: "berries", label: "ベリーを6個集める", target: 6, reward: 8 },
    { id: "stone", label: "石を5個集める", target: 5, reward: 10 },
    { id: "wall", label: "囲いを1回作る", target: 1, reward: 12 }
  ];
  const WEAPONS = {
    axe: { name: "斧", range: 78, cooldown: 0.7, color: "#b9c2bd" },
    sword: { name: "剣", range: 112, cooldown: 0.55, color: "#d9e5df" },
    gun: { name: "銃", range: 230, cooldown: 1.05, color: "#f0d46b" }
  };
  const CLASSES = [
    { id: "traveler", name: "旅人", cost: 0, description: "基本のクラス。クセがなく、いつも通りに始められる。" },
    { id: "fighter", name: "戦士", cost: 30, description: "剣を持って始める。夜に敵へ反撃しやすい。" },
    { id: "treasure", name: "宝探し", cost: 35, description: "宝箱が2つ多く出る。武器を見つけやすい。" },
    { id: "gatherer", name: "採集家", cost: 25, description: "ベリーを5個持って始める。空腹に強い。" }
  ];

  let coins = loadCoins();
  let unlockedClasses = loadUnlockedClasses();
  let currentClass = loadCurrentClass();

  let dpr = 1;
  let viewWidth = 1;
  let viewHeight = 1;
  let lastTime = 0;
  let running = false;
  let state = makeState();

  function makeState() {
    return {
      elapsed: DAY_SECONDS * 0.25,
      result: "",
      message: "近くの資源を集めて夜に備えろ。",
      player: {
        x: WORLD.width * 0.5,
        y: WORLD.height * 0.5,
        tx: WORLD.width * 0.5,
        ty: WORLD.height * 0.5,
        r: 18,
        speed: 178,
        health: 100,
        food: 82,
        heat: 56,
        wood: 1,
        berries: 1 + (currentClass === "gatherer" ? 4 : 0),
        stones: 0,
        invulnerable: 0,
        weapon: currentClass === "fighter" ? "sword" : null,
        attackCooldown: 0
      },
      camp: {
        x: WORLD.width * 0.5 + 62,
        y: WORLD.height * 0.5 + 16,
        power: 50,
        wallLevel: 0
      },
      resources: [],
      chests: [],
      enemies: [],
      particles: [],
      questProgress: {
        wood: 0,
        berries: 0,
        stone: 0,
        wall: 0
      },
      appliedClassBonuses: {
        fighter: currentClass === "fighter",
        treasure: currentClass === "treasure",
        gatherer: currentClass === "gatherer"
      },
      completedQuests: {},
      nextSpawn: 0,
      shake: 0
    };
  }

  function resetGame() {
    state = makeState();
    state.resources = createResources();
    state.chests = createChests();
    state.enemies = [];
    lastTime = performance.now();
    running = true;
    ui.panel.hidden = true;
    requestAnimationFrame(loop);
  }

  function createResources() {
    const resources = [];
    const types = [
      { type: "wood", count: 28 },
      { type: "berries", count: 24 },
      { type: "stone", count: 18 }
    ];

    for (const group of types) {
      for (let i = 0; i < group.count; i += 1) {
        const p = randomOpenPoint(140);
        resources.push({
          type: group.type,
          x: p.x,
          y: p.y,
          r: group.type === "wood" ? 18 : 15,
          amount: group.type === "berries" ? 2 : 1,
          cooldown: 0
        });
      }
    }
    return resources;
  }

  function createChests() {
    const chests = [];
    const count = currentClass === "treasure" ? 5 : 3;
    for (let i = 0; i < count; i += 1) {
      const p = randomOpenPoint(180);
      chests.push({
        x: p.x,
        y: p.y,
        r: 22,
        opened: false,
        weapon: ["axe", "sword", "gun"][Math.floor(Math.random() * 3)]
      });
    }
    return chests;
  }

  function loadSprite(src) {
    const image = new Image();
    image.onload = () => draw();
    image.src = src;
    return image;
  }

  function randomOpenPoint(pad) {
    const centerX = WORLD.width * 0.5;
    const centerY = WORLD.height * 0.5;
    for (let i = 0; i < 80; i += 1) {
      const x = pad + Math.random() * (WORLD.width - pad * 2);
      const y = pad + Math.random() * (WORLD.height - pad * 2);
      if (dist(x, y, centerX, centerY) > 150) {
        return { x, y };
      }
    }
    return { x: pad, y: pad };
  }

  function resize() {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    viewWidth = Math.max(320, window.innerWidth);
    viewHeight = Math.max(420, window.innerHeight);
    canvas.width = Math.floor(viewWidth * dpr);
    canvas.height = Math.floor(viewHeight * dpr);
    canvas.style.width = `${viewWidth}px`;
    canvas.style.height = `${viewHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function loop(now) {
    if (!running) {
      return;
    }
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0);
    lastTime = now;
    update(dt);
    draw();
    if (running) {
      requestAnimationFrame(loop);
    }
  }

  function update(dt) {
    const p = state.player;
    state.elapsed += dt;
    state.camp.power = clamp(state.camp.power - dt * (isNight() ? 2.6 : 1.15), 0, 100);
    p.food = clamp(p.food - dt * (isNight() ? 0.46 : 0.32), 0, 100);

    movePlayer(dt);
    p.attackCooldown = Math.max(0, p.attackCooldown - dt);
    updateNeeds(dt);
    updateResources(dt);
    updateEnemies(dt);
    updateParticles(dt);

    if (p.health <= 0) {
      endGame("森に飲み込まれた。");
    } else if (dayNumber() >= WIN_DAY && dayProgress() >= 0.24) {
      endGame("10日目の夜明けだ。生き延びた。");
    }
  }

  function movePlayer(dt) {
    const p = state.player;
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const len = Math.hypot(dx, dy);
    if (len > 2) {
      const step = Math.min(len, p.speed * dt);
      p.x += (dx / len) * step;
      p.y += (dy / len) * step;
      p.x = clamp(p.x, 24, WORLD.width - 24);
      p.y = clamp(p.y, 24, WORLD.height - 24);
    }
    p.invulnerable = Math.max(0, p.invulnerable - dt);
  }

  function updateNeeds(dt) {
    const p = state.player;
    const campDistance = dist(p.x, p.y, state.camp.x, state.camp.y);
    const warmth = Math.max(0, 1 - campDistance / 350) * (state.camp.power / 100);
    const nightCold = isNight() ? 1 : 0.16;
    p.heat = clamp(p.heat + dt * (warmth * 20 - nightCold * 9), 0, 100);

    if (p.food <= 0) {
      p.health = clamp(p.health - dt * 5.5, 0, 100);
    } else if (p.food > 45 && p.heat > 38 && !isNight()) {
      p.health = clamp(p.health + dt * 1.1, 0, 100);
    }
    if (p.heat <= 0) {
      p.health = clamp(p.health - dt * 7.5, 0, 100);
    }
  }

  function updateResources(dt) {
    for (const item of state.resources) {
      if (item.cooldown > 0) {
        item.cooldown = Math.max(0, item.cooldown - dt);
      }
    }
  }

  function updateEnemies(dt) {
    if (!isNight()) {
      state.enemies.length = 0;
      return;
    }

    state.nextSpawn -= dt;
    const maxEnemies = 3 + Math.min(3, dayNumber());
    if (state.nextSpawn <= 0 && state.enemies.length < maxEnemies) {
      spawnEnemy();
      state.nextSpawn = Math.max(2.2, 7 - dayNumber() * 0.7 - Math.random() * 1.8);
    }

    const p = state.player;
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      const nearFire = dist(e.x, e.y, state.camp.x, state.camp.y) < getRepelRadius();
      const targetX = nearFire ? state.camp.x + (e.x - state.camp.x) * 2 : p.x;
      const targetY = nearFire ? state.camp.y + (e.y - state.camp.y) * 2 : p.y;
      const dx = targetX - e.x;
      const dy = targetY - e.y;
      const len = Math.hypot(dx, dy) || 1;
      e.x += (dx / len) * e.speed * dt;
      e.y += (dy / len) * e.speed * dt;
      e.wobble += dt;

      if (dist(e.x, e.y, p.x, p.y) < e.r + p.r && p.invulnerable <= 0) {
        p.health = clamp(p.health - 16, 0, 100);
        p.invulnerable = 1.05;
        state.shake = 0.25;
        state.message = "夜の影に噛まれた。";
      }

      if (e.x < -80 || e.x > WORLD.width + 80 || e.y < -80 || e.y > WORLD.height + 80) {
        state.enemies.splice(i, 1);
      }
    }
    state.shake = Math.max(0, state.shake - dt);
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const particle = state.particles[i];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      if (particle.life <= 0) {
        state.particles.splice(i, 1);
      }
    }
  }

  function spawnEnemy() {
    const side = Math.floor(Math.random() * 4);
    const p = side === 0
      ? { x: Math.random() * WORLD.width, y: -35 }
      : side === 1
        ? { x: WORLD.width + 35, y: Math.random() * WORLD.height }
        : side === 2
          ? { x: Math.random() * WORLD.width, y: WORLD.height + 35 }
          : { x: -35, y: Math.random() * WORLD.height };
    state.enemies.push({
      x: p.x,
      y: p.y,
      r: 19,
      health: 1,
      speed: 74 + Math.random() * 18 + dayNumber() * 5,
      wobble: Math.random() * TAU
    });
  }

  function gather() {
    if (!running) {
      return;
    }
    const p = state.player;
    const chest = nearestClosedChest();
    if (chest) {
      openChest(chest);
      return;
    }

    let closest = null;
    let best = 74;
    for (const item of state.resources) {
      const d = dist(p.x, p.y, item.x, item.y);
      if (item.cooldown <= 0 && d < best) {
        closest = item;
        best = d;
      }
    }

    if (!closest) {
      state.message = "手が届く場所に資源がない。";
      return;
    }

    closest.cooldown = closest.type === "berries" ? 22 : 34;
    if (closest.type === "wood") {
      p.wood += closest.amount;
      state.message = "薪を拾った。";
      addQuestProgress("wood", closest.amount);
    } else if (closest.type === "berries") {
      p.berries += closest.amount;
      state.message = "ベリーを摘んだ。";
      addQuestProgress("berries", closest.amount);
    } else {
      p.stones += closest.amount;
      state.message = "石を拾った。";
      addQuestProgress("stone", closest.amount);
    }
    burst(closest.x, closest.y, closest.type);
  }

  function nearestClosedChest() {
    let closest = null;
    let best = 82;
    for (const chest of state.chests) {
      const d = dist(state.player.x, state.player.y, chest.x, chest.y);
      if (!chest.opened && d < best) {
        closest = chest;
        best = d;
      }
    }
    return closest;
  }

  function openChest(chest) {
    chest.opened = true;
    state.player.weapon = chest.weapon;
    const weapon = WEAPONS[chest.weapon];
    state.message = `宝箱から${weapon.name}を手に入れた。`;
    burst(chest.x, chest.y, "coin");
  }

  function attack() {
    const p = state.player;
    const weapon = WEAPONS[p.weapon];
    if (!running || !weapon || p.attackCooldown > 0) {
      state.message = !weapon ? "武器がない。宝箱を探そう。" : "まだ攻撃できない。";
      return;
    }

    let targetIndex = -1;
    let best = weapon.range;
    for (let i = 0; i < state.enemies.length; i += 1) {
      const e = state.enemies[i];
      const d = dist(p.x, p.y, e.x, e.y);
      if (d < best) {
        targetIndex = i;
        best = d;
      }
    }

    p.attackCooldown = weapon.cooldown;
    if (targetIndex < 0) {
      state.message = `${weapon.name}が届く敵がいない。`;
      burst(p.x, p.y, "attack");
      return;
    }

    const target = state.enemies[targetIndex];
    state.enemies.splice(targetIndex, 1);
    state.message = `${weapon.name}で敵を倒した。`;
    burst(target.x, target.y, "attack");
  }

  function eat() {
    const p = state.player;
    if (!running || p.berries <= 0 || p.food >= 96) {
      state.message = p.berries <= 0 ? "食べ物がない。" : "まだ腹は満ちている。";
      return;
    }
    p.berries -= 1;
    p.food = clamp(p.food + 28, 0, 100);
    p.health = clamp(p.health + 3, 0, 100);
    state.message = "少し腹が落ち着いた。";
  }

  function feedFire() {
    const p = state.player;
    const close = dist(p.x, p.y, state.camp.x, state.camp.y) < 116;
    if (!running || !close || p.wood <= 0) {
      state.message = !close ? "焚き火のそばで使う。" : "薪がない。";
      return;
    }
    p.wood -= 1;
    state.camp.power = clamp(state.camp.power + 32, 0, 100);
    p.heat = clamp(p.heat + 8, 0, 100);
    state.message = "火が強くなった。";
    burst(state.camp.x, state.camp.y, "fire");
  }

  function buildWall() {
    const p = state.player;
    const close = dist(p.x, p.y, state.camp.x, state.camp.y) < 136;
    if (!running || !close || p.stones < 3 || state.camp.wallLevel >= 3) {
      state.message = !close
        ? "焚き火のそばで作る。"
        : state.camp.wallLevel >= 3
          ? "囲いはこれ以上広げられない。"
          : "石が3個必要だ。";
      return;
    }
    p.stones -= 3;
    state.camp.wallLevel += 1;
    state.message = `石の囲いを広げた。${state.camp.wallLevel}段階目。`;
    addQuestProgress("wall", 1);
    burst(state.camp.x, state.camp.y, "stone");
  }

  function addQuestProgress(id, amount) {
    if (!state.questProgress[id]) {
      state.questProgress[id] = 0;
    }
    state.questProgress[id] += amount;

    const quest = QUESTS.find((item) => item.id === id);
    if (!quest || state.completedQuests[id] || state.questProgress[id] < quest.target) {
      return;
    }

    state.completedQuests[id] = true;
    coins += quest.reward;
    saveCoins();
    state.message = `クエスト達成。${quest.reward}コイン手に入れた。`;
  }

  function burst(x, y, type) {
    const color = type === "berries" ? "#d84f5f" : type === "stone" ? "#b9c2bd" : type === "fire" ? "#f6a23b" : type === "attack" ? "#f0d46b" : "#d2a05b";
    for (let i = 0; i < 10; i += 1) {
      const a = Math.random() * TAU;
      const speed = 24 + Math.random() * 58;
      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        color,
        life: 0.35 + Math.random() * 0.28
      });
    }
  }

  function endGame(message) {
    running = false;
    state.result = message;
    draw();
    ui.message.textContent = message;
    ui.start.textContent = message.includes("生き延びた") ? "もう一度" : "再挑戦";
    ui.panel.hidden = false;
  }

  function reloadLatest() {
    const url = new URL(window.location.href);
    url.searchParams.set("update", Date.now().toString());
    window.location.replace(url.toString());
  }

  function openHelp() {
    ui.helpPanel.hidden = false;
  }

  function closeHelp() {
    ui.helpPanel.hidden = true;
  }

  function openMenu() {
    renderClassList();
    ui.menuPanel.hidden = false;
  }

  function closeMenu() {
    ui.menuPanel.hidden = true;
  }

  function buyOrSelectClass(id) {
    const classInfo = getClassInfo(id);
    if (!classInfo) {
      return;
    }

    if (!unlockedClasses[id]) {
      if (coins < classInfo.cost) {
        state.message = "コインが足りない。クエストで集めよう。";
        renderClassList();
        return;
      }
      coins -= classInfo.cost;
      unlockedClasses[id] = true;
      saveCoins();
      saveUnlockedClasses();
    }

    currentClass = id;
    saveCurrentClass();
    applyClassBonusNow(id);
    state.message = `${classInfo.name}に変更した。`;
    renderClassList();
    draw();
  }

  function applyClassBonusNow(id) {
    if (!running || state.appliedClassBonuses[id]) {
      return;
    }

    if (id === "fighter") {
      state.player.weapon = "sword";
      state.appliedClassBonuses[id] = true;
    } else if (id === "gatherer") {
      state.player.berries += 4;
      state.appliedClassBonuses[id] = true;
    } else if (id === "treasure") {
      for (let i = 0; i < 2; i += 1) {
        const p = randomOpenPoint(180);
        state.chests.push({
          x: p.x,
          y: p.y,
          r: 22,
          opened: false,
          weapon: ["axe", "sword", "gun"][Math.floor(Math.random() * 3)]
        });
      }
      state.appliedClassBonuses[id] = true;
    }
  }

  function preventPageZoom(event) {
    event.preventDefault();
  }

  function preventMultiTouch(event) {
    if (event.touches && event.touches.length > 1) {
      event.preventDefault();
    }
  }

  function draw() {
    const camera = getCamera();
    ctx.save();
    if (state.shake > 0) {
      ctx.translate((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7);
    }
    drawWorld(camera);
    drawResources(camera);
    drawChests(camera);
    drawCamp(camera);
    drawEnemies(camera);
    drawPlayer(camera);
    drawParticles(camera);
    drawVignette();
    ctx.restore();
    updateUi();
  }

  function getCamera() {
    const p = state.player;
    return {
      x: clamp(p.x - viewWidth / 2, 0, WORLD.width - viewWidth),
      y: clamp(p.y - viewHeight / 2, 0, WORLD.height - viewHeight)
    };
  }

  function drawWorld(camera) {
    const sky = ctx.createLinearGradient(0, 0, 0, viewHeight);
    const night = nightAmount();
    sky.addColorStop(0, mixColor("#385f4d", "#111725", night));
    sky.addColorStop(1, mixColor("#203423", "#0c1018", night));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, viewWidth, viewHeight);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    drawGroundPattern(night);
    drawTrees(night);
    ctx.restore();
  }

  function drawGroundPattern(night) {
    ctx.fillStyle = night > 0.5 ? "rgba(174, 184, 161, 0.04)" : "rgba(250, 231, 169, 0.08)";
    for (let x = 40; x < WORLD.width; x += 95) {
      for (let y = 30; y < WORLD.height; y += 78) {
        const jitter = pseudo(x * 5 + y) * 24;
        ctx.beginPath();
        ctx.ellipse(x + jitter, y - jitter * 0.4, 18, 5, 0.25, 0, TAU);
        ctx.fill();
      }
    }
  }

  function drawTrees(night) {
    for (let i = 0; i < 95; i += 1) {
      const x = 45 + pseudo(i * 91) * (WORLD.width - 90);
      const y = 45 + pseudo(i * 133 + 19) * (WORLD.height - 90);
      if (dist(x, y, state.camp.x, state.camp.y) < 170) {
        continue;
      }
      const size = 23 + pseudo(i * 41) * 24;
      ctx.fillStyle = night > 0.5 ? "#0b1a16" : "#193c28";
      ctx.beginPath();
      ctx.arc(x, y, size, 0, TAU);
      ctx.fill();
      ctx.fillStyle = night > 0.5 ? "#07100d" : "#102919";
      ctx.beginPath();
      ctx.arc(x - size * 0.4, y + size * 0.28, size * 0.7, 0, TAU);
      ctx.fill();
    }
  }

  function drawResources(camera) {
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    for (const item of state.resources) {
      if (item.cooldown > 0) {
        continue;
      }
      if (!isOnScreen(item.x, item.y, camera, 80)) {
        continue;
      }
      if (item.type === "wood") {
        ctx.strokeStyle = "#a06c36";
        ctx.lineWidth = 8;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(item.x - 13, item.y + 7);
        ctx.lineTo(item.x + 15, item.y - 8);
        ctx.stroke();
      } else if (item.type === "berries") {
        ctx.fillStyle = "#315f34";
        ctx.beginPath();
        ctx.arc(item.x, item.y, 16, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#d94760";
        for (let i = 0; i < 4; i += 1) {
          ctx.beginPath();
          ctx.arc(item.x - 7 + i * 5, item.y - 5 + (i % 2) * 8, 4, 0, TAU);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = "#98aaa4";
        ctx.beginPath();
        ctx.ellipse(item.x, item.y, 15, 10, -0.2, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawChests(camera) {
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    for (const chest of state.chests) {
      if (!isOnScreen(chest.x, chest.y, camera, 80)) {
        continue;
      }
      ctx.fillStyle = chest.opened ? "#4c3a2a" : "#8e5b2f";
      ctx.fillRect(chest.x - 18, chest.y - 13, 36, 26);
      ctx.fillStyle = chest.opened ? "#6f5a43" : "#d8a145";
      ctx.fillRect(chest.x - 18, chest.y - 17, 36, 8);
      ctx.fillStyle = "#f1d37a";
      ctx.fillRect(chest.x - 3, chest.y - 12, 6, 12);
    }
    ctx.restore();
  }

  function drawCamp(camera) {
    const x = state.camp.x - camera.x;
    const y = state.camp.y - camera.y;
    const fire = state.camp.power / 100;
    const warmthRadius = 350;
    const repelRadius = getRepelRadius();

    ctx.save();
    ctx.globalAlpha = 0.16 + fire * 0.28;
    const glow = ctx.createRadialGradient(x, y, 10, x, y, 210 + fire * 180);
    glow.addColorStop(0, "#f4a340");
    glow.addColorStop(1, "rgba(244, 163, 64, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 230 + fire * 190, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.22 + fire * 0.18;
    const range = ctx.createRadialGradient(x, y, repelRadius * 0.35, x, y, warmthRadius);
    range.addColorStop(0, "rgba(250, 173, 72, 0.18)");
    range.addColorStop(0.42, "rgba(239, 134, 58, 0.1)");
    range.addColorStop(1, "rgba(239, 134, 58, 0)");
    ctx.fillStyle = range;
    ctx.beginPath();
    ctx.arc(x, y, warmthRadius, 0, TAU);
    ctx.fill();

    ctx.setLineDash([12, 9]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(255, 206, 112, ${0.46 + fire * 0.24})`;
    ctx.beginPath();
    ctx.arc(x, y, warmthRadius, 0, TAU);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(255, 245, 190, ${0.34 + fire * 0.22})`;
    ctx.beginPath();
    ctx.arc(x, y, repelRadius, 0, TAU);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = "#6a4a32";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - 23, y + 18);
    ctx.lineTo(x + 24, y - 8);
    ctx.moveTo(x + 22, y + 18);
    ctx.lineTo(x - 24, y - 8);
    ctx.stroke();

    if (state.camp.wallLevel > 0) {
      drawStoneWall(x, y, repelRadius);
    }

    if (fire > 0.04) {
      ctx.fillStyle = "#f7c45f";
      ctx.beginPath();
      ctx.moveTo(x, y - 35 - fire * 12);
      ctx.quadraticCurveTo(x + 24, y - 8, x + 6, y + 18);
      ctx.quadraticCurveTo(x - 22, y - 1, x, y - 35 - fire * 12);
      ctx.fill();
      ctx.fillStyle = "#e05232";
      ctx.beginPath();
      ctx.moveTo(x, y - 22 - fire * 8);
      ctx.quadraticCurveTo(x + 13, y - 2, x + 3, y + 12);
      ctx.quadraticCurveTo(x - 12, y, x, y - 22 - fire * 8);
      ctx.fill();
    }
  }

  function drawStoneWall(x, y, repelRadius) {
    const stones = 10 + state.camp.wallLevel * 5;
    const radius = repelRadius - 12;
    ctx.save();
    for (let i = 0; i < stones; i += 1) {
      const angle = (i / stones) * TAU + state.camp.wallLevel * 0.13;
      const jitter = Math.sin(i * 2.41) * 5;
      const sx = x + Math.cos(angle) * (radius + jitter);
      const sy = y + Math.sin(angle) * (radius + jitter);
      ctx.fillStyle = i % 2 === 0 ? "#b9c2bd" : "#89978f";
      ctx.beginPath();
      ctx.ellipse(sx, sy, 8, 5, angle, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEnemies(camera) {
    for (const e of state.enemies) {
      const x = e.x - camera.x;
      const y = e.y - camera.y;
      ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
      ctx.beginPath();
      ctx.ellipse(x, y + 18, 20, 8, 0, 0, TAU);
      ctx.fill();
      if (drawSprite(SPRITES.enemy, x, y, 58 + Math.sin(e.wobble * 7) * 3)) {
        continue;
      }
      ctx.fillStyle = "#121014";
      ctx.beginPath();
      ctx.arc(x, y, e.r + Math.sin(e.wobble * 7) * 2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#f0d46b";
      ctx.beginPath();
      ctx.arc(x - 6, y - 2, 3, 0, TAU);
      ctx.arc(x + 7, y - 2, 3, 0, TAU);
      ctx.fill();
    }
  }

  function drawPlayer(camera) {
    const p = state.player;
    const x = p.x - camera.x;
    const y = p.y - camera.y;
    ctx.save();
    ctx.globalAlpha = p.invulnerable > 0 && Math.floor(p.invulnerable * 12) % 2 === 0 ? 0.45 : 1;
    ctx.fillStyle = "#2c3031";
    ctx.beginPath();
    ctx.ellipse(x, y + 22, 22, 8, 0, 0, TAU);
    ctx.fill();
    if (drawSprite(SPRITES.player, x, y, 72)) {
      drawHeldWeapon(x, y);
      ctx.restore();
      return;
    }
    ctx.fillStyle = "#d8a05a";
    ctx.beginPath();
    ctx.arc(x, y, p.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#456b7d";
    ctx.beginPath();
    ctx.arc(x, y + 5, 15, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = "#1f1712";
    ctx.beginPath();
    ctx.arc(x - 6, y - 3, 2.5, 0, TAU);
    ctx.arc(x + 6, y - 3, 2.5, 0, TAU);
    ctx.fill();
    drawHeldWeapon(x, y);
    ctx.restore();
  }

  function drawSprite(image, x, y, size) {
    if (!image.complete || image.naturalWidth <= 0) {
      return false;
    }
    ctx.drawImage(image, x - size / 2, y - size / 2, size, size);
    return true;
  }

  function drawHeldWeapon(x, y) {
    const weapon = WEAPONS[state.player.weapon];
    if (!weapon) {
      return;
    }
    ctx.strokeStyle = weapon.color;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (state.player.weapon === "gun") {
      ctx.moveTo(x + 12, y + 2);
      ctx.lineTo(x + 31, y - 3);
    } else if (state.player.weapon === "sword") {
      ctx.moveTo(x + 10, y + 6);
      ctx.lineTo(x + 28, y - 18);
    } else {
      ctx.moveTo(x + 10, y + 6);
      ctx.lineTo(x + 24, y - 8);
    }
    ctx.stroke();
  }

  function drawParticles(camera) {
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    for (const p of state.particles) {
      ctx.globalAlpha = clamp(p.life * 3, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawVignette() {
    const night = nightAmount();
    if (night <= 0.02) {
      return;
    }
    const g = ctx.createRadialGradient(viewWidth / 2, viewHeight / 2, 80, viewWidth / 2, viewHeight / 2, Math.max(viewWidth, viewHeight) * 0.78);
    g.addColorStop(0, `rgba(4, 7, 12, ${0.04 * night})`);
    g.addColorStop(1, `rgba(2, 4, 8, ${0.72 * night})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, viewWidth, viewHeight);
  }

  function updateUi() {
    const p = state.player;
    ui.day.textContent = `${dayNumber()}日目`;
    ui.time.textContent = clockText();
    ui.health.value = Math.round(p.health);
    ui.food.value = Math.round(p.food);
    ui.heat.value = Math.round(p.heat);
    ui.wood.textContent = p.wood;
    ui.berries.textContent = p.berries;
    ui.stones.textContent = p.stones;
    ui.wallCount.textContent = state.camp.wallLevel;
    ui.coins.textContent = coins;
    ui.weapon.textContent = p.weapon ? WEAPONS[p.weapon].name : "なし";
    ui.className.textContent = getClassInfo(currentClass).name;
    ui.menuCoins.textContent = coins;
    updateQuestList();
    ui.eat.disabled = p.berries <= 0 || p.food >= 96 || !running;
    ui.fire.disabled = p.wood <= 0 || dist(p.x, p.y, state.camp.x, state.camp.y) >= 116 || !running;
    ui.wall.disabled = p.stones < 3 || state.camp.wallLevel >= 3 || dist(p.x, p.y, state.camp.x, state.camp.y) >= 136 || !running;
    ui.attack.disabled = !p.weapon || p.attackCooldown > 0 || !running;
    ui.gather.disabled = !running;
  }

  function getRepelRadius() {
    return 145 + state.camp.power * 1.25 + state.camp.wallLevel * 48;
  }

  function updateQuestList() {
    ui.quests.innerHTML = QUESTS.map((quest) => {
      const value = clamp(state.questProgress[quest.id] || 0, 0, quest.target);
      const done = state.completedQuests[quest.id];
      const text = done ? `${quest.label} 達成 +${quest.reward}` : `${quest.label} ${value}/${quest.target}`;
      return `<li class="${done ? "quest-done" : ""}"><span>${text}</span><progress max="${quest.target}" value="${value}"></progress></li>`;
    }).join("");
  }

  function renderClassList() {
    ui.menuCoins.textContent = coins;
    ui.classList.innerHTML = CLASSES.map((classInfo) => {
      const unlocked = Boolean(unlockedClasses[classInfo.id]);
      const active = currentClass === classInfo.id;
      const buttonText = active ? "使用中" : unlocked ? "このクラスにする" : `${classInfo.cost}コインで購入`;
      const disabled = active || (!unlocked && coins < classInfo.cost);
      return `
        <article class="class-card ${active ? "active" : ""}">
          <h3>${classInfo.name}</h3>
          <p>${classInfo.description}</p>
          <p>${unlocked ? "購入済み" : `価格 ${classInfo.cost}コイン`}</p>
          <button type="button" data-class-id="${classInfo.id}" ${disabled ? "disabled" : ""}>${buttonText}</button>
        </article>
      `;
    }).join("");

    for (const button of ui.classList.querySelectorAll("button[data-class-id]")) {
      button.addEventListener("click", () => buyOrSelectClass(button.dataset.classId));
    }
  }

  function getClassInfo(id) {
    return CLASSES.find((classInfo) => classInfo.id === id) || CLASSES[0];
  }

  function loadCoins() {
    try {
      const saved = Number.parseInt(window.localStorage.getItem(COIN_KEY) || "0", 10);
      return Number.isFinite(saved) ? saved : 0;
    } catch (_error) {
      return 0;
    }
  }

  function saveCoins() {
    try {
      window.localStorage.setItem(COIN_KEY, String(coins));
    } catch (_error) {
      // 保存できない環境でも、今のプレイ中はコイン表示を続ける。
    }
  }

  function loadUnlockedClasses() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(UNLOCKED_CLASS_KEY) || "{}");
      return { traveler: true, ...saved };
    } catch (_error) {
      return { traveler: true };
    }
  }

  function saveUnlockedClasses() {
    try {
      window.localStorage.setItem(UNLOCKED_CLASS_KEY, JSON.stringify(unlockedClasses));
    } catch (_error) {
      // 保存できない環境でも、今のプレイ中は購入状態を保つ。
    }
  }

  function loadCurrentClass() {
    try {
      const saved = window.localStorage.getItem(CLASS_KEY) || "traveler";
      return unlockedClasses[saved] ? saved : "traveler";
    } catch (_error) {
      return "traveler";
    }
  }

  function saveCurrentClass() {
    try {
      window.localStorage.setItem(CLASS_KEY, currentClass);
    } catch (_error) {
      // 保存できない環境でも、今のプレイ中は選択状態を保つ。
    }
  }

  function setTargetFromEvent(event) {
    if (!running) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const camera = getCamera();
    state.player.tx = clamp(event.clientX - rect.left + camera.x, 20, WORLD.width - 20);
    state.player.ty = clamp(event.clientY - rect.top + camera.y, 20, WORLD.height - 20);
  }

  function dayProgress() {
    return (state.elapsed % DAY_SECONDS) / DAY_SECONDS;
  }

  function dayNumber() {
    return Math.floor(state.elapsed / DAY_SECONDS) + 1;
  }

  function isNight() {
    const t = dayProgress();
    return t < 0.23 || t > 0.69;
  }

  function nightAmount() {
    const t = dayProgress();
    if (t < 0.23) {
      return 1 - t / 0.23;
    }
    if (t > 0.69) {
      return clamp((t - 0.69) / 0.18, 0, 1);
    }
    return 0;
  }

  function clockText() {
    const hours = Math.floor(dayProgress() * 24);
    const minutes = Math.floor((dayProgress() * 24 - hours) * 60 / 10) * 10;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function isOnScreen(x, y, camera, margin) {
    return x > camera.x - margin && x < camera.x + viewWidth + margin && y > camera.y - margin && y < camera.y + viewHeight + margin;
  }

  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function pseudo(seed) {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  function mixColor(a, b, t) {
    const ac = parseColor(a);
    const bc = parseColor(b);
    const c = ac.map((v, i) => Math.round(v + (bc[i] - v) * t));
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  }

  function parseColor(hex) {
    return [
      Number.parseInt(hex.slice(1, 3), 16),
      Number.parseInt(hex.slice(3, 5), 16),
      Number.parseInt(hex.slice(5, 7), 16)
    ];
  }

  window.addEventListener("resize", resize);
  window.addEventListener("gesturestart", preventPageZoom, { passive: false });
  window.addEventListener("gesturechange", preventPageZoom, { passive: false });
  window.addEventListener("gestureend", preventPageZoom, { passive: false });
  window.addEventListener("touchmove", preventMultiTouch, { passive: false });
  window.addEventListener("dblclick", preventPageZoom, { passive: false });
  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    setTargetFromEvent(event);
  });
  canvas.addEventListener("pointermove", (event) => {
    event.preventDefault();
    setTargetFromEvent(event);
  });
  ui.gather.addEventListener("click", gather);
  ui.eat.addEventListener("click", eat);
  ui.fire.addEventListener("click", feedFire);
  ui.wall.addEventListener("click", buildWall);
  ui.attack.addEventListener("click", attack);
  ui.menu.addEventListener("click", openMenu);
  ui.start.addEventListener("click", resetGame);
  ui.titleMenu.addEventListener("click", openMenu);
  ui.help.addEventListener("click", openHelp);
  ui.titleHelp.addEventListener("click", openHelp);
  ui.closeMenu.addEventListener("click", closeMenu);
  ui.closeHelp.addEventListener("click", closeHelp);
  ui.update.addEventListener("click", reloadLatest);

  resize();
  ui.version.textContent = `v${APP_VERSION}`;
  state.resources = createResources();
  state.chests = createChests();
  renderClassList();
  draw();
}());
