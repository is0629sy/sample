const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// 画面サイズ変更時のリサイズ処理
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  player.y = canvas.height - 150;
});

// ===== ゲームステート管理 =====
let gameStarted = false;
let gameOver = false;
let score = 0;
let highScore = 0;

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
const minPlatformLength = 200; // 最小プラットフォーム長
const maxPlatformLength = 400; // 最大プラットフォーム長
const platformSpacing = 250;
const scrollSpeed = 5;
const obstacleProbability = 0.4;
const floatingPlatformProbability = 0.35; // 浮遊する足場の生成確率を35%に下げる
const floatingPlatformWidth = 150;
const floatingPlatformHeight = 20;

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
  score = 0;

  // 最初の地面（スタート地点）
  createPlatform(groundPlatforms, 0, canvas.height - groundHeight, 300, groundHeight);

  // 最初の地面と穴の生成（5個）
  let lastPlatformX = 300; // 最初の地面の終点
  for (let i = 1; i < 5; i++) {
    // minGapからmaxGapまでのランダムな穴の幅を生成
    const gap = minGap + Math.random() * (maxGap - minGap);
    const x = lastPlatformX + gap;
    const platformLength = minPlatformLength + Math.random() * (maxPlatformLength - minPlatformLength);
    createPlatform(groundPlatforms, x, canvas.height - groundHeight, platformLength, groundHeight);
    lastPlatformX = x + platformLength;
    
    // 障害物の生成
    // 地面の長さに応じて複数の障害物を生成
    const obstacleCount = Math.floor(platformLength / 150); // 150pxごとに障害物を生成
    for (let i = 0; i < obstacleCount; i++) {
      if (Math.random() < obstacleProbability) {
        const obstacleX = x + 75 + (i * 150); // 150px間隔で配置
        obstacles.push({
          x: obstacleX,
          y: canvas.height - groundHeight - 40,
          width: 30,
          height: 40,
        });
      }
    }

    // 浮遊する足場の生成（地面の上と穴の上）
    if (Math.random() < floatingPlatformProbability) {
      const floatingY = canvas.height - groundHeight - 150 - Math.random() * 100;
      // 地面の上に生成
      createPlatform(floatingPlatforms, x + 75, floatingY, floatingPlatformWidth, floatingPlatformHeight);
    }

    // 穴の上にも浮遊する足場を生成
    if (Math.random() < floatingPlatformProbability) {
      const floatingY = canvas.height - groundHeight - 150 - Math.random() * 100;
      // 穴の上に生成（最後の地面の終点から次の地面の開始位置までの間）
      createPlatform(floatingPlatforms, lastPlatformX + 75, floatingY, floatingPlatformWidth, floatingPlatformHeight);
    }
  }
}

function generateNewPlatform() {
  // 画面外に出たプラットフォームを削除
  groundPlatforms.forEach((platform, index) => {
    if (platform.x + platform.width < scrollX) {
      groundPlatforms.splice(index, 1);
    }
  });

  // 画面外に出た浮遊足場を削除
  floatingPlatforms.forEach((platform, index) => {
    if (platform.x + platform.width < scrollX) {
      floatingPlatforms.splice(index, 1);
    }
  });

  // 画面外に出た障害物を削除
  obstacles.forEach((obs, index) => {
    if (obs.x + obs.width < scrollX) {
      obstacles.splice(index, 1);
    }
  });

  // 最後のプラットフォームの位置を取得
  const lastPlatform = groundPlatforms[groundPlatforms.length - 1];
  const lastPlatformX = lastPlatform ? lastPlatform.x + lastPlatform.width : 0;

  // 新しいプラットフォームを生成
  if (lastPlatformX - scrollX < canvas.width + maxPlatformLength) {
    const gap = minGap + Math.random() * (maxGap - minGap);
    const x = lastPlatformX + gap;
    const platformLength = minPlatformLength + Math.random() * (maxPlatformLength - minPlatformLength);
    createPlatform(groundPlatforms, x, canvas.height - groundHeight, platformLength, groundHeight);
    
    // 障害物の生成
    // 地面の長さに応じて複数の障害物を生成
    const obstacleCount = Math.floor(platformLength / 150); // 150pxごとに障害物を生成
    for (let i = 0; i < obstacleCount; i++) {
      if (Math.random() < obstacleProbability) {
        const obstacleX = x + 75 + (i * 150); // 150px間隔で配置
        obstacles.push({
          x: obstacleX,
          y: canvas.height - groundHeight - 40,
          width: 30,
          height: 40,
        });
      }
    }

    // 浮遊する足場の生成（地面の上と穴の上）
    if (Math.random() < floatingPlatformProbability) {
      const floatingY = canvas.height - groundHeight - 150 - Math.random() * 100;
      // 地面の上に生成
      createPlatform(floatingPlatforms, x + 75, floatingY, floatingPlatformWidth, floatingPlatformHeight);
    }

    // 穴の上にも浮遊する足場を生成
    if (Math.random() < floatingPlatformProbability) {
      const floatingY = canvas.height - groundHeight - 150 - Math.random() * 100;
      // 穴の上に生成（最後の地面の終点から次の地面の開始位置までの間）
      createPlatform(floatingPlatforms, lastPlatformX + 75, floatingY, floatingPlatformWidth, floatingPlatformHeight);
    }
  }
}

// ===== 入力処理 =====
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    if (!gameStarted) {
      gameStarted = true;
      document.getElementById('startScreen').style.display = 'none';
      setupLevel();
    } else if (gameOver) {
      // ゲームオーバー時にスペースキーを押したらリセット
      gameOver = false;
      gameStarted = false;
      document.getElementById('gameOverScreen').style.display = 'none';
      document.getElementById('startScreen').style.display = 'block';
      player.y = canvas.height - 150;
      player.dy = 0;
      scrollX = 0;
    } else if (!gameOver && player.jumpCount < 2) {
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

// ===== タッチ操作の実装 =====
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault(); // デフォルトのタッチ動作を防止
  if (!gameStarted) {
    gameStarted = true;
    document.getElementById('startScreen').style.display = 'none';
    setupLevel();
  } else if (gameOver) {
    // ゲームオーバー時にタップしたらリセット
    gameOver = false;
    gameStarted = false;
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('startScreen').style.display = 'block';
    player.y = canvas.height - 150;
    player.dy = 0;
    scrollX = 0;
  } else if (!gameOver && player.jumpCount < 2) {
    player.dy = player.jumpPower;
    player.grounded = false;
    player.jumpCount++;
  }
  keys.space = true;
});

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  keys.space = false;
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
  if (!gameStarted || gameOver) return;

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
      if (score > highScore) {
        highScore = score;
        document.getElementById('highScoreDisplay').textContent = `ハイスコア: ${highScore}`;
      }
      document.getElementById('gameOverScreen').style.display = 'block';
      document.getElementById('finalScore').textContent = `スコア: ${score}`;
    }
  }

  // 穴に落ちたらゲームオーバー
  if (player.y > canvas.height) {
    gameOver = true;
    if (score > highScore) {
      highScore = score;
      document.getElementById('highScoreDisplay').textContent = `ハイスコア: ${highScore}`;
    }
    document.getElementById('gameOverScreen').style.display = 'block';
    document.getElementById('finalScore').textContent = `スコア: ${score}`;
  }

  // スコア更新（進んだ距離に比例）
  score = Math.floor(scrollX / 10);
  document.getElementById('scoreDisplay').textContent = `スコア: ${score}`;
  scrollX += scrollSpeed;

  // 新しいプラットフォームの生成
  generateNewPlatform();
}

// ===== 描画処理 =====
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!gameStarted) {
    // スタート画面はHTMLで表示するため、ここでは何も描画しない
    return;
  }

  if (gameOver) {
    // ゲームオーバー画面はHTMLで表示するため、ここでは何も描画しない
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
