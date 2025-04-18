const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ===== ゲームステート管理 =====
let gameStarted = false;
let gameOver = false;
let gameCleared = false;

// ===== プレイヤー情報 =====
const player = {
  x: 100,
  y: canvas.height - 150,
  width: 50,
  height: 50,
  color: 'red',
  dy: 0,
  gravity: 1,
  jumpPower: -18,
  grounded: false,
  jumpCount: 0,
};

// ===== 各種設定 =====
const groundHeight = 100;
const minGap = 50; // プレイヤーの幅と同じ最小幅
const maxGap = 200; // 二段ジャンプで超えられる最大幅
const platformSpacing = 250;
const scrollSpeed = 5;
const goalPosition = 6250; // プラットフォーム間隔変更に合わせて調整

const keys = {
  space: false,
};

let scrollX = 0;
const groundPlatforms = [];
const floatingPlatforms = [];
const obstacles = [];

// ===== プラットフォーム生成関数 =====
function createPlatform(arr, x, y, width, height) {
  arr.push({ x, y, width, height });
}

// ===== 初期化関数 =====
function setupLevel() {
  groundPlatforms.length = 0;
  floatingPlatforms.length = 0;
  obstacles.length = 0;

  // 最初の地面（スタート地点）
  createPlatform(groundPlatforms, 0, canvas.height - groundHeight, 300, groundHeight);

  // 地面と穴の生成（25個）
  let lastPlatformX = 300; // 最初の地面の終点
  for (let i = 1; i < 25; i++) {
    // minGapからmaxGapまでのランダムな穴の幅を生成
    const gap = minGap + Math.random() * (maxGap - minGap);
    const x = lastPlatformX + gap;
    createPlatform(groundPlatforms, x, canvas.height - groundHeight, platformSpacing, groundHeight);
    lastPlatformX = x + platformSpacing;
    
    // たまに障害物
    if (Math.random() < 0.2) {
      obstacles.push({
        x: x + 100,
        y: canvas.height - groundHeight - 40,
        width: 30,
        height: 40,
      });
    }
  }

  // ゴール地点の地面を必ず生成
  createPlatform(groundPlatforms, goalPosition - 300, canvas.height - groundHeight, 600, groundHeight);

  // 浮遊する足場（ジャンプ or 2段ジャンプで届く）
  floatingPlatforms.push(
    { x: 900, y: canvas.height - 250, width: 100, height: 20 },      // 普通のジャンプで届く
    { x: 1300, y: canvas.height - 350, width: 100, height: 20 },     // 2段ジャンプで届く
    { x: 1700, y: canvas.height - 300, width: 100, height: 20 }      // 少し下、ジャンプで届く
  );
}

// ===== 入力処理 =====
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    if (!gameStarted) {
      gameStarted = true;
      setupLevel();
    } else if (!gameOver && !gameCleared && player.jumpCount < 2) {
      player.dy = player.jumpPower;
      player.grounded = false;
      player.jumpCount++;
    }
    keys.space = true;
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') keys.space = false;
});

// ===== 衝突判定 =====
function isColliding(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// ===== ゲーム更新処理 =====
function update() {
  if (!gameStarted || gameOver || gameCleared) return;

  player.dy += player.gravity;
  player.y += player.dy;

  player.grounded = false;

  // 地面・浮遊足場との衝突判定
  const allPlatforms = groundPlatforms.concat(floatingPlatforms);

  allPlatforms.forEach(platform => {
    const shiftedPlatform = {
      x: platform.x - scrollX,
      y: platform.y,
      width: platform.width,
      height: platform.height
    };

    if (
      player.x + player.width > shiftedPlatform.x &&
      player.x < shiftedPlatform.x + shiftedPlatform.width &&
      player.y + player.height > shiftedPlatform.y &&
      player.y + player.height < shiftedPlatform.y + shiftedPlatform.height
    ) {
      player.y = shiftedPlatform.y - player.height;
      player.dy = 0;
      player.grounded = true;
      player.jumpCount = 0;
    }
  });

  // 障害物との衝突
  for (let obs of obstacles) {
    const shiftedObs = { ...obs, x: obs.x - scrollX };
    if (isColliding(player, shiftedObs)) {
      gameOver = true;
    }
  }

  // 穴に落ちたらゲームオーバー
  if (player.y > canvas.height) {
    gameOver = true;
  }

  // ゴール判定
  if (scrollX >= goalPosition) {
    gameCleared = true;
  }

  scrollX += scrollSpeed;
}

// ===== 描画処理 =====
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!gameStarted) {
    ctx.fillStyle = 'black';
    ctx.font = '48px sans-serif';
    ctx.fillText('スペースキーでスタート！', canvas.width / 2 - 200, canvas.height / 2);
    return;
  }

  if (gameOver) {
    ctx.fillStyle = 'black';
    ctx.font = '48px sans-serif';
    ctx.fillText('ゲームオーバー', canvas.width / 2 - 130, canvas.height / 2);
    return;
  }

  if (gameCleared) {
    ctx.fillStyle = 'black';
    ctx.font = '48px sans-serif';
    ctx.fillText('ゲームクリア！', canvas.width / 2 - 130, canvas.height / 2);
    return;
  }

  // 地面
  groundPlatforms.forEach(platform => {
    ctx.fillStyle = 'green';
    ctx.fillRect(platform.x - scrollX, platform.y, platform.width, platform.height);
  });

  // 浮遊する足場
  floatingPlatforms.forEach(platform => {
    ctx.fillStyle = 'brown';
    ctx.fillRect(platform.x - scrollX, platform.y, platform.width, platform.height);
  });

  // 障害物
  obstacles.forEach(obs => {
    ctx.fillStyle = 'gray';
    ctx.fillRect(obs.x - scrollX, obs.y, obs.width, obs.height);
  });

  // ゴール地点の旗
  const flagX = goalPosition - scrollX;
  if (flagX > 0 && flagX < canvas.width) {
    ctx.fillStyle = 'yellow';
    ctx.fillRect(flagX, canvas.height - groundHeight - 100, 10, 100);
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.moveTo(flagX + 10, canvas.height - groundHeight - 100);
    ctx.lineTo(flagX + 50, canvas.height - groundHeight - 80);
    ctx.lineTo(flagX + 10, canvas.height - groundHeight - 60);
    ctx.fill();
  }

  // プレイヤー
  ctx.fillStyle = player.color;
  ctx.fillRect(player.x, player.y, player.width, player.height);
}

// ===== ゲームループ =====
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
