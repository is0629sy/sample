const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// 画面サイズ変更時のリサイズ処理
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  player.y = canvas.height - 150;
  player.x = window.innerWidth <= 768 ? 50 : 100; // リサイズ時もスマートフォン表示を考慮
});

// ===== ゲームステート管理 =====
let gameStarted = false;
let gameOver = false;
let score = 0;
let highScore = 0;

// ===== プレイヤー情報 =====
const player = {
  x: window.innerWidth <= 768 ? 50 : 100, // スマートフォン表示時は左にずらす
  y: canvas.height - 150,
  width: 75,
  height: 75,
  color: 'red',
  dy: 0,
  gravity: 1,
  jumpPower: -18,
  grounded: false,
  jumpCount: 0,
  images: [new Image(), new Image(), new Image()],
  currentImageIndex: 0,
  animationFrame: 0,
  baseAnimationSpeed: 10,
  minAnimationSpeed: 5,
};

// プレイヤー画像の読み込み
player.images[0].src = 'img/walk.png';
player.images[1].src = 'img/walk2.png';
player.images[2].src = 'img/jamp.png';

// ===== 各種設定 =====
const groundHeight = 100;
const minGap = 50; // プレイヤーの幅と同じ最小幅
const maxGap = 200; // 二段ジャンプで超えられる最大幅
const minPlatformLength = 200; // 最小プラットフォーム長
const maxPlatformLength = 400; // 最大プラットフォーム長
const platformSpacing = 250;
const baseScrollSpeed = 5; // 基本のスクロール速度
const maxScrollSpeed = 15; // 最大スクロール速度
const speedIncreaseInterval = 200; // スコアがこの値ごとに速度が上がる（100から200に変更）
const obstacleProbability = 0.4;
const floatingPlatformProbability = 0.35; // 浮遊する足場の生成確率を35%に下げる
const floatingPlatformWidth = 150;
const floatingPlatformHeight = 20;
const minObstacleWidth = 20; // 障害物の最小幅
const maxObstacleWidth = 50; // 障害物の最大幅
const minObstacleHeight = 30; // 障害物の最小高さ
const maxObstacleHeight = 60; // 障害物の最大高さ
const maxObstacleGap = 200; // 障害物間の最大間隔（この間隔以下の場合に浮遊する足場を生成）

// 浮遊する足場の最小距離
const minFloatingPlatformDistance = 300; // 浮遊する足場同士の最小距離

const keys = {
  space: false,
};

let scrollX = 0;
const groundPlatforms = [];
const floatingPlatforms = [];
const obstacles = [];
const clouds = []; // 雲の配列を追加

// 雲の設定
const cloudImage = new Image();
cloudImage.src = 'img/cloud.png';
const cloudSpawnInterval = 4000; // 雲の生成間隔を2倍に（2000から4000に変更）
let lastCloudSpawn = 0;

// ===== プラットフォーム生成関数 =====
function createPlatform(arr, x, y, width, height) {
  // 木目のパターンを生成
  const woodPattern = [];
  for (let i = 0; i < width; i += 20 + Math.random() * 30) {
    // 左右の余白を広く取る
    const margin = 20; // 左右の余白
    
    woodPattern.push({
      x: i,
      startY: Math.random() * 10,
      endY: height - Math.random() * 10,
      controlX: i + (Math.random() * 20 - 10),
      controlY: (height / 2) + (Math.random() * 20 - 10),
      lineWidth: 0.5 + Math.random() * 2,
      margin: margin
    });
  }
  
  // 濃淡のパターンを生成
  const shadePattern = [];
  for (let i = 0; i < width; i += 50 + Math.random() * 50) {
    // 左右の余白を広く取る
    const margin = 20; // 左右の余白
    
    shadePattern.push({
      x: i,
      startY: Math.random() * height,
      endY: Math.random() * height,
      opacity: 0.3 + Math.random() * 0.3,
      lineWidth: 1 + Math.random() * 2,
      margin: margin
    });
  }
  
  arr.push({ x, y, width, height, woodPattern, shadePattern });
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
    const obstacleCount = Math.floor(platformLength / 150);
    let lastObstacleX = null;
    for (let i = 0; i < obstacleCount; i++) {
      if (Math.random() < obstacleProbability) {
        const obstacleX = x + 75 + (i * 150);
        const obstacleWidth = minObstacleWidth + Math.random() * (maxObstacleWidth - minObstacleWidth);
        const obstacleHeight = minObstacleHeight + Math.random() * (maxObstacleHeight - minObstacleHeight);
        
        // 前の障害物との間隔をチェック
        if (lastObstacleX !== null && obstacleX - lastObstacleX <= maxObstacleGap) {
          // 障害物間の上空に浮遊する足場を生成
          const floatingY = canvas.height - groundHeight - 200 - Math.random() * 100;
          const newPlatform = {
            x: (lastObstacleX + obstacleX) / 2 - floatingPlatformWidth / 2,
            y: floatingY,
            width: floatingPlatformWidth,
            height: floatingPlatformHeight
          };
          
          if (!isOverlappingOrTooClose(newPlatform, floatingPlatforms)) {
            createPlatform(floatingPlatforms, newPlatform.x, newPlatform.y, newPlatform.width, newPlatform.height);
          }
        }
        
        obstacles.push({
          x: obstacleX,
          y: canvas.height - groundHeight - obstacleHeight,
          width: obstacleWidth,
          height: obstacleHeight,
        });
        lastObstacleX = obstacleX + obstacleWidth;
      }
    }

    // 浮遊する足場の生成（地面の上）
    if (Math.random() < floatingPlatformProbability) {
      const floatingY = canvas.height - groundHeight - 150 - Math.random() * 100;
      const newPlatform = {
        x: x + 75,
        y: floatingY,
        width: floatingPlatformWidth,
        height: floatingPlatformHeight
      };
      
      if (!isOverlappingOrTooClose(newPlatform, floatingPlatforms)) {
        createPlatform(floatingPlatforms, newPlatform.x, newPlatform.y, newPlatform.width, newPlatform.height);
      }
    }

    // 穴の上にも浮遊する足場を生成
    if (Math.random() < floatingPlatformProbability) {
      const floatingY = canvas.height - groundHeight - 150 - Math.random() * 100;
      const newPlatform = {
        x: lastPlatformX + 75,
        y: floatingY,
        width: floatingPlatformWidth,
        height: floatingPlatformHeight
      };
      
      if (!isOverlappingOrTooClose(newPlatform, floatingPlatforms)) {
        createPlatform(floatingPlatforms, newPlatform.x, newPlatform.y, newPlatform.width, newPlatform.height);
      }
    }
  }
}

// 浮遊する足場の重なりと距離をチェックする関数
function isOverlappingOrTooClose(newPlatform, existingPlatforms) {
  return existingPlatforms.some(platform => {
    // 重なりチェック（より厳密に）
    const horizontalOverlap = (
      newPlatform.x < platform.x + platform.width &&
      newPlatform.x + newPlatform.width > platform.x
    );
    
    const verticalOverlap = (
      newPlatform.y < platform.y + platform.height &&
      newPlatform.y + newPlatform.height > platform.y
    );

    // 距離チェック（より厳密に）
    const centerX1 = newPlatform.x + newPlatform.width / 2;
    const centerY1 = newPlatform.y + newPlatform.height / 2;
    const centerX2 = platform.x + platform.width / 2;
    const centerY2 = platform.y + platform.height / 2;
    
    const distance = Math.sqrt(
      Math.pow(centerX2 - centerX1, 2) + 
      Math.pow(centerY2 - centerY1, 2)
    );

    // 水平方向または垂直方向に重なっている場合、または距離が近すぎる場合はtrueを返す
    return (horizontalOverlap && verticalOverlap) || distance < minFloatingPlatformDistance;
  });
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
    let lastObstacleX = null;
    for (let i = 0; i < obstacleCount; i++) {
      if (Math.random() < obstacleProbability) {
        const obstacleX = x + 75 + (i * 150); // 150px間隔で配置
        const obstacleWidth = minObstacleWidth + Math.random() * (maxObstacleWidth - minObstacleWidth);
        const obstacleHeight = minObstacleHeight + Math.random() * (maxObstacleHeight - minObstacleHeight);
        
        // 前の障害物との間隔をチェック
        if (lastObstacleX !== null && obstacleX - lastObstacleX <= maxObstacleGap) {
          // 障害物間の上空に浮遊する足場を生成
          const floatingY = canvas.height - groundHeight - 200 - Math.random() * 100;
          const newPlatform = {
            x: (lastObstacleX + obstacleX) / 2 - floatingPlatformWidth / 2,
            y: floatingY,
            width: floatingPlatformWidth,
            height: floatingPlatformHeight
          };
          
          if (!isOverlappingOrTooClose(newPlatform, floatingPlatforms)) {
            createPlatform(floatingPlatforms, newPlatform.x, newPlatform.y, newPlatform.width, newPlatform.height);
          }
        }
        
        obstacles.push({
          x: obstacleX,
          y: canvas.height - groundHeight - obstacleHeight,
          width: obstacleWidth,
          height: obstacleHeight,
        });
        lastObstacleX = obstacleX + obstacleWidth;
      }
    }

    // 浮遊する足場の生成（地面の上と穴の上）
    if (Math.random() < floatingPlatformProbability) {
      const floatingY = canvas.height - groundHeight - 150 - Math.random() * 100;
      const newPlatform = {
        x: x + 75,
        y: floatingY,
        width: floatingPlatformWidth,
        height: floatingPlatformHeight
      };
      
      // 重なりと距離チェック
      if (!isOverlappingOrTooClose(newPlatform, floatingPlatforms)) {
        createPlatform(floatingPlatforms, newPlatform.x, newPlatform.y, newPlatform.width, newPlatform.height);
      }
    }

    // 穴の上にも浮遊する足場を生成
    if (Math.random() < floatingPlatformProbability) {
      const floatingY = canvas.height - groundHeight - 150 - Math.random() * 100;
      const newPlatform = {
        x: lastPlatformX + 75,
        y: floatingY,
        width: floatingPlatformWidth,
        height: floatingPlatformHeight
      };
      
      // 重なりと距離チェック
      if (!isOverlappingOrTooClose(newPlatform, floatingPlatforms)) {
        createPlatform(floatingPlatforms, newPlatform.x, newPlatform.y, newPlatform.width, newPlatform.height);
      }
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
      // 背景色をリセット
      document.body.classList.remove('high-score');
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
    // 背景色をリセット
    document.body.classList.remove('high-score');
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

  updateClouds(); // 雲の更新を追加

  // スコアに応じてスクロール速度を更新
  const speedMultiplier = 1 + Math.min(Math.floor(score / speedIncreaseInterval) * 0.1, (maxScrollSpeed - baseScrollSpeed) / baseScrollSpeed);
  scrollSpeed = baseScrollSpeed * speedMultiplier;

  // スコアが1000を超えた時の処理
  if (score > 1000) {
    // 地面を草むらに変更
    groundPlatforms.forEach(platform => {
      platform.isGrass = true;
    });
    // 背景を変更
    document.body.classList.add('high-score');
  }

  // スクロール速度に応じてアニメーション速度を更新
  const animationSpeedRange = player.baseAnimationSpeed - player.minAnimationSpeed;
  const currentAnimationSpeed = Math.max(
    player.minAnimationSpeed,
    player.baseAnimationSpeed - (speedMultiplier - 1) * (animationSpeedRange / ((maxScrollSpeed - baseScrollSpeed) / baseScrollSpeed))
  );

  player.dy += player.gravity;
  player.y += player.dy;

  // アニメーション更新
  if (player.grounded) {
    player.animationFrame++;
    if (player.animationFrame >= currentAnimationSpeed) {
      player.animationFrame = 0;
      player.currentImageIndex = (player.currentImageIndex + 1) % 2;
    }
  } else {
    player.animationFrame = 0;
    player.currentImageIndex = 2;
  }

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
        document.getElementById('newHighScoreMessage').style.display = 'block';
      } else {
        document.getElementById('newHighScoreMessage').style.display = 'none';
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
      document.getElementById('newHighScoreMessage').style.display = 'block';
    } else {
      document.getElementById('newHighScoreMessage').style.display = 'none';
    }
    document.getElementById('gameOverScreen').style.display = 'block';
    document.getElementById('finalScore').textContent = `スコア: ${score}`;
    // 背景色は保持する（リセットしない）
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

  // 雲の描画
  clouds.forEach(cloud => {
    ctx.drawImage(cloudImage, cloud.x, cloud.y, cloud.width, cloud.height);
  });

  // 地面
  groundPlatforms.forEach(platform => {
    if (platform.isGrass) {
      // 草むらの描画（濃い緑色）
      ctx.fillStyle = '#228B22';
      ctx.fillRect(platform.x - scrollX, platform.y, platform.width, platform.height);
    } else {
      // 通常の木目調の地面
      ctx.fillStyle = '#D2B48C';
      ctx.fillRect(platform.x - scrollX, platform.y, platform.width, platform.height);
      
      // 木目の模様
      ctx.strokeStyle = '#654321';
      
      // 保存された木目のパターンを描画
      platform.woodPattern.forEach(pattern => {
        // 左右の余白を考慮して描画
        if (pattern.x >= pattern.margin && pattern.x <= platform.width - pattern.margin) {
          ctx.beginPath();
          ctx.moveTo(platform.x - scrollX + pattern.x, platform.y + pattern.startY);
          ctx.quadraticCurveTo(
            platform.x - scrollX + pattern.controlX,
            platform.y + pattern.controlY,
            platform.x - scrollX + pattern.x,
            platform.y + pattern.endY
          );
          ctx.lineWidth = pattern.lineWidth;
          ctx.stroke();
        }
      });
      
      // 保存された濃淡のパターンを描画
      platform.shadePattern.forEach(pattern => {
        // 左右の余白を考慮して描画
        if (pattern.x >= pattern.margin && pattern.x <= platform.width - pattern.margin) {
          ctx.beginPath();
          ctx.moveTo(platform.x - scrollX + pattern.x, platform.y + pattern.startY);
          ctx.lineTo(platform.x - scrollX + pattern.x, platform.y + pattern.endY);
          ctx.strokeStyle = `rgba(50, 25, 0, ${pattern.opacity})`;
          ctx.lineWidth = pattern.lineWidth;
          ctx.stroke();
        }
      });
    }
  });

  // 浮遊する足場
  floatingPlatforms.forEach(platform => {
    ctx.fillStyle = '#e63e7a';
    ctx.fillRect(platform.x - scrollX, platform.y, platform.width, platform.height);
  });

  // 障害物
  obstacles.forEach(obs => {
    ctx.fillStyle = 'gray';
    ctx.fillRect(obs.x - scrollX, obs.y, obs.width, obs.height);
  });

  // プレイヤー
  const currentImage = player.images[player.currentImageIndex];
  if (currentImage.complete) {
    ctx.drawImage(currentImage, player.x, player.y, player.width, player.height);
  } else {
    // 画像が読み込まれていない場合は赤い四角形を表示
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
  }
}

// ===== ゲームループ =====
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();

// ゲームの初期化
function init() {
    // 背景を初期状態に戻す
    document.body.classList.remove('high-score');
    
    // その他の初期化処理
    // ... existing code ...
}

// ゲーム開始時の処理
function startGame() {
    init();
    gameStarted = true;
    // ... existing code ...
}

// 雲の生成関数
function createCloud() {
  const cloud = {
    x: canvas.width + Math.random() * 100, // 画面右端からランダムな位置で生成
    y: Math.random() * (canvas.height * 0.3), // 画面上部30%の範囲内でランダムな高さ
    width: 150 + Math.random() * 75, // 雲の幅を1.5倍に（100から150に、50から75に）
    height: 75 + Math.random() * 45, // 雲の高さを1.5倍に（50から75に、30から45に）
  };
  clouds.push(cloud);
}

// 雲の更新関数
function updateClouds() {
  const currentTime = Date.now();
  if (currentTime - lastCloudSpawn > cloudSpawnInterval) {
    createCloud();
    lastCloudSpawn = currentTime;
  }

  // 雲の移動と削除
  clouds.forEach((cloud, index) => {
    cloud.x -= baseScrollSpeed; // スクロール速度と同じ速さで移動
    if (cloud.x + cloud.width < 0) {
      clouds.splice(index, 1);
    }
  });
}
