// ゲームの状態管理
const GameState = {
    TITLE: 'title',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'game_over',
    ENDING: 'ending',
    OP_ANIMATION: 'op_animation',
    BOSS_DEFEATED: 'boss_defeated' // ボス撃破アニメーション中
};

// ゲーム設定
const GAME_CONFIG = {
    width: 1920,
    height: 1080,
    fps: 60,
    playerSpeed: 4, // 半分に
    bulletSpeed: 15,
    enemyBulletSpeed: 3, // 敵弾を遅く
    scrollSpeed: 3,
    invincibleTime: 180, // 3秒 (60fps)
    maxBullets: 120,
    maxEffects: 120,
    stageDuration: 600, // 10秒 (60fps) テスト用
    showHitboxes: false // 当たり判定を非表示
};

// グローバル変数
let canvas, ctx;
let gameState = GameState.TITLE;
let currentStage = 1;
let score = 0;
let lives = 3;
let frameCount = 0;
let isPaused = false;

// プレイヤー
let player = {
    x: 200,
    y: GAME_CONFIG.height / 2,
    width: 160, // 2倍
    height: 120, // 2倍
    speed: GAME_CONFIG.playerSpeed,
    invincible: 0,
    weapon: 'normal', // normal, 3way
    attachments: [], // よしみん付属機
    speedBoost: false // いかスピードアップ
};

// ゲームオブジェクト配列
let playerBullets = [];
let enemies = [];
let enemyBullets = [];
let items = [];
let effects = [];
let background = { x: 0 };
let stageTimer = 0;
let bossSpawned = false;
let bossEntering = false; // ボス登場中フラグ
let bossBattleTimer = 0; // ボス戦タイマー

// 画像リソース
const images = {};
const imageSources = {
    main: 'sozai/png/main.png',
    nagao: 'sozai/png/nagao.png',
    hiyoko: 'sozai/png/hiyoko.png',
    yoshimin: 'sozai/png/yoshimin.png',
    sunagimo: 'sozai/png/砂肝.jpg',
    ika: 'sozai/png/いか.png',
    enemy1: 'sozai/png/敵1.png',
    enemy2: 'sozai/png/敵2.png',
    enemy3: 'sozai/png/敵3.png',
    enemy4: 'sozai/png/敵4.png',
    enemy5: 'sozai/png/敵5.png',
    enemy6: 'sozai/png/敵6.png',
    time: 'sozai/png/時間.jpg',
    boss3: 'sozai/png/boss3.png'
};

// 音声リソース
const sounds = {};
const soundSources = {
    bgmNormal: 'sozai/bgm/通常面.mp3',
    bgmBoss1: 'sozai/bgm/boss.mp3',
    bgmBoss2: 'sozai/bgm/boss2.mp3',
    bgmBoss3: 'sozai/bgm/boss3.mp3',
    shot: 'sozai/bgm/ショット.mp3',
    speedUp: 'sozai/bgm/スピードアップ.mp3',
    powerUp: 'sozai/bgm/パワーアップ.mp3',
    explosion: 'sozai/bgm/自機爆発.mp3',
    warning: 'sozai/bgm/警報.mp3',
    bossBigExplosion: 'sozai/bgm/boss大爆発2.mp3'
};

let currentBGM = null;

// 初期化
window.addEventListener('load', init);

function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // 画像読み込み
    loadImages(() => {
        // イベントリスナー設定
        setupEventListeners();
        // ゲームループ開始
        gameLoop();
    });
}

function loadImages(callback) {
    let loadedCount = 0;
    const totalImages = Object.keys(imageSources).length;
    const totalSounds = Object.keys(soundSources).length;
    const totalResources = totalImages + totalSounds;
    
    // 画像読み込み
    for (const [key, src] of Object.entries(imageSources)) {
        images[key] = new Image();
        images[key].onload = () => {
            loadedCount++;
            if (loadedCount === totalResources) {
                callback();
            }
        };
        images[key].onerror = () => {
            console.error(`Failed to load image: ${src}`);
            loadedCount++;
            if (loadedCount === totalResources) {
                callback();
            }
        };
        images[key].src = src;
    }
    
    // 音声読み込み
    for (const [key, src] of Object.entries(soundSources)) {
        sounds[key] = new Audio(src);
        sounds[key].addEventListener('canplaythrough', () => {
            loadedCount++;
            if (loadedCount === totalResources) {
                callback();
            }
        }, { once: true });
        sounds[key].addEventListener('error', () => {
            console.error(`Failed to load sound: ${src}`);
            loadedCount++;
            if (loadedCount === totalResources) {
                callback();
            }
        });
        sounds[key].load();
    }
}

function setupEventListeners() {
    // キーボード入力
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // タッチ入力（スマホ対応）
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', handleTouchEnd);
    
    // マウス入力（タイトル画面用）
    canvas.addEventListener('click', handleClick);
    
    // タイトル画面のタッチイベント
    const titleScreen = document.getElementById('titleScreen');
    titleScreen.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameState === GameState.TITLE) {
            startGame();
        }
    });
    titleScreen.addEventListener('click', () => {
        if (gameState === GameState.TITLE) {
            startGame();
        }
    });
}

// 入力処理
const keys = {};

function handleKeyDown(e) {
    keys[e.key] = true;
    
    if (gameState === GameState.TITLE && e.key === 'Enter') {
        startGame();
    } else if (gameState === GameState.GAME_OVER && e.key === 'Enter') {
        resetToTitle();
    } else if (gameState === GameState.PLAYING && e.key.toLowerCase() === 'p') {
        togglePause();
    }
}

function handleKeyUp(e) {
    keys[e.key] = false;
}

let touchStartY = 0;
let touchPlayerY = 0;

function handleTouchStart(e) {
    e.preventDefault();
    
    if (gameState === GameState.TITLE) {
        startGame();
        return;
    }
    
    if (gameState === GameState.PLAYING) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        touchStartY = touch.clientY - rect.top;
        touchPlayerY = player.y;
    }
}

function handleTouchMove(e) {
    e.preventDefault();
    
    if (gameState === GameState.PLAYING) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const currentY = touch.clientY - rect.top;
        const deltaY = currentY - touchStartY;
        
        // キャンバスの実際のサイズとゲーム座標の比率を計算
        const scaleY = GAME_CONFIG.height / rect.height;
        player.y = touchPlayerY + deltaY * scaleY;
        
        // 画面内に制限
        player.y = Math.max(player.height / 2, Math.min(GAME_CONFIG.height - player.height / 2, player.y));
    }
}

function handleTouchEnd(e) {
    e.preventDefault();
}

function handleClick(e) {
    if (gameState === GameState.TITLE) {
        startGame();
    }
}

// ゲーム制御
function startGame() {
    gameState = GameState.OP_ANIMATION;
    currentStage = 1;
    score = 0;
    lives = 3;
    stageTimer = 0;
    bossSpawned = false;
    resetPlayer();
    clearGameObjects();
    showOPAnimation(1);
}

function resetToTitle() {
    gameState = GameState.TITLE;
    document.getElementById('gameOverScreen').style.display = 'none';
    document.getElementById('titleScreen').style.display = 'flex';
}

function togglePause() {
    if (gameState === GameState.PLAYING) {
        gameState = GameState.PAUSED;
        document.getElementById('pauseScreen').style.display = 'flex';
    } else if (gameState === GameState.PAUSED) {
        gameState = GameState.PLAYING;
        document.getElementById('pauseScreen').style.display = 'none';
    }
}

function resetPlayer() {
    player.x = 200;
    player.y = GAME_CONFIG.height / 2;
    player.invincible = 0;
    player.weapon = 'normal';
    player.attachments = [];
    player.speedBoost = false;
    player.speed = GAME_CONFIG.playerSpeed;
}

function clearGameObjects() {
    playerBullets = [];
    enemies = [];
    enemyBullets = [];
    items = [];
    effects = [];
    stageTimer = 0;
    bossSpawned = false;
    bossEntering = false;
    bossBattleTimer = 0;
}

// OPアニメーション
function showOPAnimation(stage) {
    const dialogues = {
        1: [
            { image: 'nagao', text: '行きなさい、ワキーン。誰かの為じゃない、あなた自身の願いの為に。' },
            { image: 'main', text: 'ふっ、まかせろ' }
        ],
        2: [
            { image: 'nagao', text: '奇跡を待つより捨て身の努力よ！' },
            { image: 'main', text: 'ふっ、まかせろ' }
        ],
        3: [
            { image: 'nagao', text: 'あんたまだ生きてるんでしょ！だったらしっかり生きて、それから死になさい！！' },
            { image: 'main', text: 'ふっ、まかせろ' }
        ]
    };
    
    const stageDialogues = dialogues[stage];
    let dialogueIndex = 0;
    
    const opDiv = document.createElement('div');
    opDiv.className = 'op-animation';
    document.getElementById('gameContainer').appendChild(opDiv);
    
    function showNextDialogue() {
        if (dialogueIndex >= stageDialogues.length) {
            opDiv.remove();
            startStage(stage);
            return;
        }
        
        const dialogue = stageDialogues[dialogueIndex];
        opDiv.innerHTML = `
            <img src="sozai/png/${dialogue.image}.png" alt="">
            <div class="dialogue">${dialogue.text}</div>
        `;
        
        dialogueIndex++;
        setTimeout(showNextDialogue, 3000);
    }
    
    showNextDialogue();
}

function startStage(stage) {
    gameState = GameState.PLAYING;
    currentStage = stage;
    stageTimer = 0;
    bossSpawned = false;
    document.getElementById('titleScreen').style.display = 'none';
    
    // BGM再生
    stopBGM();
    currentBGM = sounds.bgmNormal;
    if (currentBGM) {
        currentBGM.loop = true;
        currentBGM.play().catch(e => console.log('BGM playback failed:', e));
    }
    
    // ステージ開始時の処理
    if (stage === 1) {
        // 15秒後にフェイクワーニング
        setTimeout(() => {
            if (gameState === GameState.PLAYING && currentStage === 1 && !bossSpawned) {
                showWarning(true);
            }
        }, 15000);
    } else if (stage === 3) {
        // ステージ3では5秒おきにフェイクワーニング
        let warningInterval = setInterval(() => {
            if (gameState === GameState.PLAYING && currentStage === 3 && !bossSpawned) {
                showWarning(true);
            } else {
                clearInterval(warningInterval);
            }
        }, 5000);
    }
}

function showWarning(isFake = false) {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'warning';
    warningDiv.textContent = 'WARNING!!';
    document.getElementById('gameContainer').appendChild(warningDiv);
    
    // 警報音再生
    if (sounds.warning) {
        sounds.warning.currentTime = 0;
        sounds.warning.play().catch(e => console.log('Warning sound failed:', e));
    }
    
    setTimeout(() => {
        warningDiv.remove();
        if (!isFake) {
            // ボス出現
            spawnBoss();
        }
    }, 2000);
}

function stopBGM() {
    if (currentBGM) {
        currentBGM.pause();
        currentBGM.currentTime = 0;
    }
}

// ゲームループ
function gameLoop() {
    if (gameState === GameState.PLAYING) {
        update();
        render();
    } else if (gameState === GameState.TITLE) {
        renderTitle();
    }
    
    frameCount++;
    requestAnimationFrame(gameLoop);
}

function update() {
    // プレイヤー更新
    updatePlayer();
    
    // 弾更新
    updateBullets();
    
    // 敵更新
    updateEnemies();
    
    // アイテム更新
    updateItems();
    
    // エフェクト更新
    updateEffects();
    
    // 背景スクロール
    background.x -= GAME_CONFIG.scrollSpeed;
    if (background.x <= -GAME_CONFIG.width) {
        background.x = 0;
    }
    
    // 衝突判定
    checkCollisions();
    
    // 敵生成
    spawnEnemies();
    
    // ステージタイマー更新
    stageTimer++;
    if (stageTimer >= GAME_CONFIG.stageDuration && !bossSpawned) {
        bossSpawned = true;
        console.log('Boss spawning for stage', currentStage);
        showWarning(false);
    }
    
    // ボス戦タイマー更新
    if (bossBattleTimer > 0) {
        bossBattleTimer--;
        if (bossBattleTimer === 0) {
            console.log('Boss battle timer ended, player can shoot now');
        }
    }
}

function updatePlayer() {
    // キーボード入力処理
    if (keys['ArrowUp']) {
        player.y -= player.speed;
    }
    if (keys['ArrowDown']) {
        player.y += player.speed;
    }
    
    // 画面内に制限
    player.y = Math.max(player.height / 2, Math.min(GAME_CONFIG.height - player.height / 2, player.y));
    
    // 無敵時間更新
    if (player.invincible > 0) {
        player.invincible--;
    }
    
    // 自動ショット（ボス登場中とボス戦開始10秒間は停止）
    if (frameCount % 20 === 0 && !bossEntering && bossBattleTimer === 0) { // 発射間隔を1/4に
        shootPlayerBullet();
    }
    
    // 付属機更新
    updateAttachments();
}

function shootPlayerBullet() {
    // ショット音再生
    // OPアニメーション中とボス撃破中はSEを鳴らさない
    if (sounds.shot && gameState === GameState.PLAYING) {
        sounds.shot.currentTime = 0;
        sounds.shot.play().catch(e => {});
    }
    
    if (player.weapon === 'normal') {
        playerBullets.push({
            x: player.x + player.width / 2,
            y: player.y,
            vx: GAME_CONFIG.bulletSpeed,
            vy: 0,
            width: 20, // 2倍
            height: 8 // 2倍
        });
    } else if (player.weapon === '3way') {
        // 3way弾
        for (let i = -1; i <= 1; i++) {
            playerBullets.push({
                x: player.x + player.width / 2,
                y: player.y,
                vx: GAME_CONFIG.bulletSpeed,
                vy: i * 2,
                width: 20, // 2倍
                height: 8 // 2倍
            });
        }
    } else if (player.weapon === '5way') {
        // 5way弾
        for (let i = -2; i <= 2; i++) {
            playerBullets.push({
                x: player.x + player.width / 2,
                y: player.y,
                vx: GAME_CONFIG.bulletSpeed,
                vy: i * 1.5,
                width: 20, // 2倍
                height: 8 // 2倍
            });
        }
    } else if (player.weapon === '7way') {
        // 7way弾
        for (let i = -3; i <= 3; i++) {
            playerBullets.push({
                x: player.x + player.width / 2,
                y: player.y,
                vx: GAME_CONFIG.bulletSpeed,
                vy: i * 1.2,
                width: 20, // 2倍
                height: 8 // 2倍
            });
        }
    }
    
    // 付属機からも発射
    for (const attachment of player.attachments) {
        if (attachment.type === 'yoshimin') {
            if (player.weapon === 'normal') {
                playerBullets.push({
                    x: attachment.x + 40,
                    y: attachment.y,
                    vx: GAME_CONFIG.bulletSpeed,
                    vy: 0,
                    width: 20,
                    height: 8
                });
            } else if (player.weapon === '3way') {
                for (let i = -1; i <= 1; i++) {
                    playerBullets.push({
                        x: attachment.x + 40,
                        y: attachment.y,
                        vx: GAME_CONFIG.bulletSpeed,
                        vy: i * 2,
                        width: 20,
                        height: 8
                    });
                }
            } else if (player.weapon === '5way') {
                for (let i = -2; i <= 2; i++) {
                    playerBullets.push({
                        x: attachment.x + 40,
                        y: attachment.y,
                        vx: GAME_CONFIG.bulletSpeed,
                        vy: i * 1.5,
                        width: 20,
                        height: 8
                    });
                }
            } else if (player.weapon === '7way') {
                for (let i = -3; i <= 3; i++) {
                    playerBullets.push({
                        x: attachment.x + 40,
                        y: attachment.y,
                        vx: GAME_CONFIG.bulletSpeed,
                        vy: i * 1.2,
                        width: 20,
                        height: 8
                    });
                }
            }
        }
    }
}

function updateAttachments() {
    for (let i = 0; i < player.attachments.length; i++) {
        const attachment = player.attachments[i];
        
        if (attachment.type === 'yoshimin') {
            // よしみん付属機は自機に追従
            const index = player.attachments.filter(a => a.type === 'yoshimin').indexOf(attachment);
            const angleOffset = (Math.PI * 2 / 6) * index; // 6機分の位置
            const radius = 120;
            const targetX = player.x + Math.cos(angleOffset + frameCount * 0.02) * radius;
            const targetY = player.y + Math.sin(angleOffset + frameCount * 0.02) * radius;
            
            attachment.x += (targetX - attachment.x) * 0.1;
            attachment.y += (targetY - attachment.y) * 0.1;
        } else if (attachment.type === 'hiyoko') {
            // ひよこは画面中央で自機を狙う
            if (frameCount % 30 === 0) {
                const angle = Math.atan2(player.y - attachment.y, player.x - attachment.x);
                
                if (player.weapon === 'normal') {
                    enemyBullets.push({
                        x: attachment.x,
                        y: attachment.y,
                        vx: Math.cos(angle) * 3,
                        vy: Math.sin(angle) * 3,
                        width: 16, // 2倍
                        height: 16 // 2倍
                    });
                } else if (player.weapon === '3way') {
                    // ひよこ3way
                    for (let i = -1; i <= 1; i++) {
                        enemyBullets.push({
                            x: attachment.x,
                            y: attachment.y,
                            vx: Math.cos(angle + i * 0.2) * 3,
                            vy: Math.sin(angle + i * 0.2) * 3,
                            width: 16,
                            height: 16
                        });
                    }
                } else if (player.weapon === '5way') {
                    // ひよこ5way
                    for (let i = -2; i <= 2; i++) {
                        enemyBullets.push({
                            x: attachment.x,
                            y: attachment.y,
                            vx: Math.cos(angle + i * 0.15) * 3,
                            vy: Math.sin(angle + i * 0.15) * 3,
                            width: 16,
                            height: 16
                        });
                    }
                } else if (player.weapon === '7way') {
                    // ひよこ7way
                    for (let i = -3; i <= 3; i++) {
                        enemyBullets.push({
                            x: attachment.x,
                            y: attachment.y,
                            vx: Math.cos(angle + i * 0.12) * 3,
                            vy: Math.sin(angle + i * 0.12) * 3,
                            width: 16,
                            height: 16
                        });
                    }
                }
            }
        }
    }
}

function updateBullets() {
    // プレイヤー弾更新
    playerBullets = playerBullets.filter(bullet => {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        return bullet.x < GAME_CONFIG.width + 50;
    });
    
    // 敵弾更新
    enemyBullets = enemyBullets.filter(bullet => {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        return bullet.x > -50 && bullet.x < GAME_CONFIG.width + 50 && 
               bullet.y > -50 && bullet.y < GAME_CONFIG.height + 50;
    });
}

function updateEnemies() {
    enemies = enemies.filter(enemy => {
        // ボスの特別な移動処理
        if (enemy.isBoss) {
            // 登場中の処理
            if (enemy.entranceTimer !== undefined && enemy.entranceTimer > 0) {
                enemy.entranceTimer--;
                enemy.x += enemy.vx; // 登場中は左に移動
                
                // ボスごとに設定された停止位置を使用
                const targetX = enemy.stopX || (GAME_CONFIG.width - 100);
                
                // 目標位置に到達したら停止
                if (enemy.x <= targetX) {
                    enemy.x = targetX;
                    enemy.vx = 0;
                    // 上下移動開始
                    enemy.vy = 2;
                    enemy.entranceTimer = 0; // 登場完了
                }
            } else {
                // 登場完了後の処理
                if (enemy.entranceTimer === 0 && !enemy.hitEnabled) {
                    // 登場完了後に当たり判定を有効化
                    enemy.hitEnabled = true;
                    if (bossEntering) {
                        bossEntering = false; // ボス登場完了
                        // ステージ3の場合は10秒、それ以外は5秒
                        bossBattleTimer = (enemy.type === 'boss3') ? 600 : 300;
                        console.log('Boss entrance complete, battle timer started');
                    }
                }
                // 上下移動のみ（横移動はしない）
                enemy.y += enemy.vy;
            }
        } else {
            // 通常の敵は通常通り移動
            enemy.x += enemy.vx;
            enemy.y += enemy.vy;
        }
        
        // ボスの上下移動
        if (enemy.isBoss && enemy.entranceTimer === 0) {
            // 画面上下端で反転
            if (enemy.y - enemy.height / 2 <= 50 || enemy.y + enemy.height / 2 >= GAME_CONFIG.height - 50) {
                enemy.vy = -enemy.vy;
            }
        }
        
        // 敵の弾発射
        if (enemy.shootCooldown > 0) {
            enemy.shootCooldown--;
        } else if (enemy.isBoss) {
            // ボスの弾発射（登場完了後のみ）
            if (enemy.entranceTimer === 0) {
                // ボス2の特殊処理
                if (enemy.type === 'boss2') {
                    // パターンタイマー管理
                    if (enemy.shootPattern !== undefined) {
                        enemy.shootPattern--;
                        
                        if (enemy.shootPattern <= 0) {
                            // パターン切り替え
                            if (enemy.shootPaused) {
                                // 射撃再開
                                enemy.shootPaused = false;
                                enemy.shootPattern = 60; // 1秒射撃
                            } else {
                                // 射撃停止
                                enemy.shootPaused = true;
                                enemy.shootPattern = 60; // 1秒停止
                            }
                        }
                        
                        // 射撃中の場合のみ弾を発射
                        if (!enemy.shootPaused) {
                            shootEnemyBullet(enemy);
                            enemy.shootCooldown = 2; // ほぼ連射
                        }
                    }
                } else {
                    // 他のボスは通常処理
                    shootEnemyBullet(enemy);
                    // ボスごとの発射間隔
                    if (enemy.type === 'boss1') {
                        enemy.shootCooldown = 60; // 1秒ごと
                    } else if (enemy.type === 'boss3') {
                        enemy.shootCooldown = 180; // 3秒ごと
                    }
                }
            }
        } else if (Math.random() < 0.015) {
            shootEnemyBullet(enemy);
            enemy.shootCooldown = 60;
        }
        
        return enemy.x > -100 && enemy.hp > 0;
    });
}

function shootEnemyBullet(enemy) {
    if (enemy.isBoss) {
        if (enemy.type === 'boss1') {
            // ステージ1ボス：3way弾
            const baseAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
            for (let i = -1; i <= 1; i++) {
                const angle = baseAngle + (i * 0.3); // 扇状に広がる
                enemyBullets.push({
                    x: enemy.x - enemy.width / 2,
                    y: enemy.y,
                    vx: Math.cos(angle) * 5,
                    vy: Math.sin(angle) * 5,
                    width: 24,
                    height: 24
                });
            }
        } else if (enemy.type === 'boss2') {
            // ステージ2ボス：ビーム連射（プレイヤーを狙う）
            const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
            enemyBullets.push({
                x: enemy.x - enemy.width / 2,
                y: enemy.y,
                vx: Math.cos(angle) * 8, // 高速
                vy: Math.sin(angle) * 8,
                width: 40, // 大きめ
                height: 16 // 横長でビーム感
            });
        } else if (enemy.type === 'boss3') {
            // ステージ3ボス：画面を覆う弾幕（激ムズだが5%の確率で抜けられる）
            const bulletRows = 25; // 弾の行数
            const safeZone = Math.floor(Math.random() * (bulletRows - 6)) + 3; // 隙間の位置
            
            // 波状の弾幕を生成（30列）
            for (let col = 0; col < 30; col++) {
                // 列ごとに波打つように隙間をずらす
                const waveOffset = Math.sin(col * 0.3) * 2; // 波の振幅
                const adjustedSafeZone = Math.floor(safeZone + waveOffset);
                
                for (let row = 0; row < bulletRows; row++) {
                    // 隙間を3行分作る（ギリギリ通れるサイズ）
                    if (row >= adjustedSafeZone && row <= adjustedSafeZone + 2) continue;
                    
                    const y = GAME_CONFIG.height / bulletRows * row + 50;
                    // 列ごとに少しランダムな上下のズレを加える
                    const randomOffset = (Math.random() - 0.5) * 10;
                    
                    enemyBullets.push({
                        x: enemy.x - enemy.width / 2 + col * 25, // 列ごとの間隔
                        y: y + randomOffset,
                        vx: -2.5 - Math.random() * 0.5, // 微妙な速度差
                        vy: 0,
                        width: 14, // 少し小さく
                        height: 14
                    });
                }
            }
        }
    } else {
        // 通常敵の弾
        enemyBullets.push({
            x: enemy.x,
            y: enemy.y,
            vx: -GAME_CONFIG.enemyBulletSpeed,
            vy: 0,
            width: 16,
            height: 16
        });
    }
}

function updateItems() {
    items = items.filter(item => {
        item.x -= 2;
        
        // プレイヤーとの当たり判定
        if (checkCollision(player, item)) {
            collectItem(item);
            return false;
        }
        
        return item.x > -50;
    });
}

function collectItem(item) {
    // アイテム取得エフェクト
    if (item.type === 'sunagimo') {
        // 砂肝：3Way→5Way→7Way
        if (player.weapon === '5way') {
            player.weapon = '7way';
            showItemAnimation('sunagimo', '砂肝三つ目！！7WAY最強！！');
        } else if (player.weapon === '3way') {
            player.weapon = '5way';
            showItemAnimation('sunagimo', '砂肝もういっちょう！5WAY！！');
        } else {
            player.weapon = '3way';
            showItemAnimation('sunagimo', '砂肝いっちょう！おまち！！');
        }
        if (sounds.powerUp) {
            sounds.powerUp.currentTime = 0;
            sounds.powerUp.play().catch(e => {});
        }
    } else if (item.type === 'yoshimin') {
        // よしみん：付属機追加（6機まで）
        if (player.attachments.filter(a => a.type === 'yoshimin').length < 6) {
            player.attachments.push({
                type: 'yoshimin',
                x: player.x,
                y: player.y,
                width: 160, // 4倍
                height: 160 // 4倍
            });
            showItemAnimation('yoshimin', '地球に凸みん！');
            if (sounds.powerUp) {
                sounds.powerUp.currentTime = 0;
                sounds.powerUp.play().catch(e => {});
            }
        }
    } else if (item.type === 'hiyoko') {
        // ひよこ：偽パワーアップ（無限）
        player.attachments.push({
            type: 'hiyoko',
            x: GAME_CONFIG.width / 2,
            y: GAME_CONFIG.height / 2,
            width: 80, // 2倍
            height: 80 // 2倍
        });
        showItemAnimation('hiyoko', '私の本体は帽子だ！');
        if (sounds.powerUp) {
            sounds.powerUp.currentTime = 0;
            sounds.powerUp.play().catch(e => {});
        }
    } else if (item.type === 'ika') {
        // いか：スピードアップ
        player.speedBoost = !player.speedBoost;
        player.speed = player.speedBoost ? GAME_CONFIG.playerSpeed * 2 : GAME_CONFIG.playerSpeed;
        showItemEffect(player.speedBoost ? 'SPEED UP!' : 'SPEED DOWN!');
        if (sounds.speedUp) {
            sounds.speedUp.currentTime = 0;
            sounds.speedUp.play().catch(e => {});
        }
    }
}

function showItemAnimation(itemType, text) {
    // 画面中央にアイテム画像とテキストを表示
    effects.push({
        type: 'itemGet',
        image: itemType,
        text: text,
        x: GAME_CONFIG.width / 2,
        y: GAME_CONFIG.height / 2,
        life: 120,
        scale: 0.1
    });
}

function showItemEffect(text) {
    effects.push({
        type: 'text',
        text: text,
        x: GAME_CONFIG.width / 2,
        y: GAME_CONFIG.height / 2,
        life: 60,
        scale: 0.1
    });
}

function updateEffects() {
    effects = effects.filter(effect => {
        effect.life--;
        
        if (effect.type === 'text') {
            effect.scale = Math.min(effect.scale + 0.05, 1);
            effect.y -= 1;
        } else if (effect.type === 'itemGet') {
            effect.scale = Math.min(effect.scale + 0.05, 1);
        } else if (effect.type === 'explosion') {
            effect.x += effect.vx;
            effect.y += effect.vy;
            effect.vx *= 0.95;
            effect.vy *= 0.95;
        } else if (effect.type === 'bossExplosion') {
            effect.x += effect.vx;
            effect.y += effect.vy;
            effect.vx *= 0.9;
            effect.vy *= 0.9;
            effect.size *= 0.98; // サイズも徐々に小さく
        }
        
        return effect.life > 0;
    });
}

function spawnEnemies() {
    if (!bossSpawned && !bossEntering && frameCount % 60 === 0) {
        // ボス登場中は敵を出現させない
        enemies.push({
            type: 'normal',
            x: GAME_CONFIG.width + 50,
            y: Math.random() * (GAME_CONFIG.height - 100) + 50,
            vx: -3 - Math.random() * 2,
            vy: (Math.random() - 0.5) * 2,
            width: 120, // 2倍
            height: 120, // 2倍
            hp: 1,
            shootCooldown: 0,
            hitEnabled: true,
            sprite: `enemy${Math.floor(Math.random() * 6) + 1}`
        });
    }
    
    // アイテムランダム生成（通常面）
    if (!bossSpawned && !bossEntering && frameCount % 180 === 0) { // 3秒ごとに変更（出現率アップ）
        const itemTypes = ['sunagimo', 'sunagimo', 'yoshimin', 'hiyoko', 'ika']; // 砂肝の確率を上げる
        const type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
        
        items.push({
            type: type,
            x: GAME_CONFIG.width + 50,
            y: Math.random() * (GAME_CONFIG.height - 100) + 50,
            width: 80, // 2倍
            height: 80 // 2倍
        });
    }
    
    // ステージ2ボス戦中の特別アイテム生成
    if (bossSpawned && currentStage === 2 && !bossEntering && frameCount % 300 === 0) { // 5秒ごと
        // 砂肝かよしみんのどちらかを出す
        const specialItemTypes = ['sunagimo', 'yoshimin'];
        const type = specialItemTypes[Math.floor(Math.random() * specialItemTypes.length)];
        
        items.push({
            type: type,
            x: GAME_CONFIG.width + 50,
            y: Math.random() * (GAME_CONFIG.height - 100) + 50,
            width: 80,
            height: 80
        });
    }
}

function spawnBoss() {
    let boss;
    
    console.log('Spawning boss for stage', currentStage);
    bossEntering = true; // ボス登場開始
    
    // BGM切り替え
    stopBGM();
    
    if (currentStage === 1) {
        boss = {
            type: 'boss1',
            x: GAME_CONFIG.width + 640, // 画面外から登場（十分な距離を確保）
            y: GAME_CONFIG.height / 2,
            vx: -5, // 左に移動（速く移動）
            vy: 0,
            width: 640,
            height: 480,
            hp: 50, // 50発で撃破
            maxHp: 50, // 表示用
            shootCooldown: 0,
            hitEnabled: false, // 最初は無敵
            isBoss: true,
            sprite: 'enemy4',
            entranceTimer: 120, // 2秒間は無敵
            stopX: GAME_CONFIG.width - 520 // 停止位置を明示的に設定（画像が完全に表示されるように）
        };
        currentBGM = sounds.bgmBoss1;
    } else if (currentStage === 2) {
        boss = {
            type: 'boss2',
            x: GAME_CONFIG.width + 640, // 画面外から登場（十分な距離を確保）
            y: GAME_CONFIG.height / 2,
            vx: -5, // 左に移動（速く移動）
            vy: 0,
            width: 640,
            height: 480,
            hp: 1000, // 1000発で撃破
            maxHp: 1000, // 表示用
            shootCooldown: 0,
            hitEnabled: false, // 最初は無敵
            isBoss: true,
            sprite: 'enemy4',
            timer: 3600, // 60秒
            entranceTimer: 120, // 2秒間は無敵
            stopX: GAME_CONFIG.width - 520, // 停止位置を明示的に設定（画像が完全に表示されるように）
            shootPattern: 60, // 1秒射撃（60フレーム）
            shootPaused: false // 射撃停止フラグ
        };
        currentBGM = sounds.bgmBoss2;
    } else if (currentStage === 3) {
        boss = {
            type: 'boss3',
            x: GAME_CONFIG.width + 800, // 画面外から登場（十分な距離を確保）
            y: GAME_CONFIG.height / 2,
            vx: -5, // 左に移動（速く移動）
            vy: 0,
            width: 800,
            height: 600,
            hp: 1, // 1発で撃破
            maxHp: 1,
            shootCooldown: 0,
            hitEnabled: false, // 最初は無敵
            isBoss: true,
            sprite: 'boss3',
            entranceTimer: 300, // 5秒間は無敵
            stopX: GAME_CONFIG.width - 900 // 停止位置を明示的に設定（もっと左側に表示）
        };
        currentBGM = sounds.bgmBoss3;
    }
    
    if (currentBGM) {
        currentBGM.loop = true;
        currentBGM.play().catch(e => console.log('Boss BGM playback failed:', e));
    }
    
    if (boss) {
        enemies.push(boss);
        console.log('Boss added:', boss);
    }
}

function checkCollisions() {
    // プレイヤー弾 vs 敵
    for (let i = playerBullets.length - 1; i >= 0; i--) {
        const bullet = playerBullets[i];
        
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            
            if (enemy.hitEnabled && checkCollision(bullet, enemy)) {
                playerBullets.splice(i, 1);
                enemy.hp--;
                
                if (enemy.hp <= 0) {
                    score += enemy.isBoss ? 10000 : 100;
                    
                    if (enemy.isBoss) {
                        // ボス撃破
                        stopBGM();
                        
                        // ボス撃破状態に移行（ショットSEを止めるため）
                        gameState = GameState.BOSS_DEFEATED;
                        
                        // ボスの座標を保存
                        const bossX = enemy.x;
                        const bossY = enemy.y;
                        const bossWidth = enemy.width;
                        const bossHeight = enemy.height;
                        
                        // 敵配列から削除
                        enemies.splice(j, 1);
                        
                        // ボス大爆発
                        createBossExplosion(bossX, bossY, bossWidth, bossHeight);
                        
                        // ボス大爆発SE再生
                        if (sounds.bossBigExplosion) {
                            sounds.bossBigExplosion.currentTime = 0;
                            sounds.bossBigExplosion.play().catch(e => {});
                        }
                        
                        // 遅延してから次のステージへ（2.5秒後）
                        setTimeout(() => {
                            if (currentStage < 3) {
                                currentStage++;
                                clearGameObjects();
                                showOPAnimation(currentStage);
                            } else {
                                // エンディング
                                gameState = GameState.ENDING;
                                document.getElementById('endingScreen').style.display = 'flex';
                            }
                        }, 2500); // 2.5秒後
                        
                        break; // ボス処理完了
                    }
                }
                break;
            }
        }
    }
    
    // 敵弾 vs プレイヤー
    if (player.invincible === 0) {
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            const bullet = enemyBullets[i];
            
            if (checkCollision(player, bullet)) {
                enemyBullets.splice(i, 1);
                playerHit();
                break;
            }
        }
        
        // 敵 vs プレイヤー
        for (const enemy of enemies) {
            if (enemy.hitEnabled && checkCollision(player, enemy)) {
                playerHit();
                break;
            }
        }
    }
}

function checkCollision(a, b) {
    // プレイヤーの当たり判定を小さくする
    let aLeft = a.x - a.width / 2;
    let aRight = a.x + a.width / 2;
    let aTop = a.y - a.height / 2;
    let aBottom = a.y + a.height / 2;
    
    let bLeft = b.x - b.width / 2;
    let bRight = b.x + b.width / 2;
    let bTop = b.y - b.height / 2;
    let bBottom = b.y + b.height / 2;
    
    // プレイヤーの場合、当たり判定を小さくする
    const padding = 40;
    if (a === player) {
        aLeft += padding;
        aRight -= padding;
        aTop += padding;
        aBottom -= padding;
    }
    if (b === player) {
        bLeft += padding;
        bRight -= padding;
        bTop += padding;
        bBottom -= padding;
    }
    
    return aLeft < bRight &&
           aRight > bLeft &&
           aTop < bBottom &&
           aBottom > bTop;
}

function playerHit() {
    // 爆発音再生
    if (sounds.explosion) {
        sounds.explosion.currentTime = 0;
        sounds.explosion.play().catch(e => {});
    }
    
    // 爆発エフェクト
    createExplosion(player.x, player.y);
    
    lives--;
    player.invincible = GAME_CONFIG.invincibleTime;
    
    // 付属機消滅
    player.attachments = player.attachments.filter(a => a.type !== 'yoshimin');
    
    if (lives <= 0) {
        gameOver();
    } else {
        // 残機表示
        showRemainingLives();
    }
}

function createExplosion(x, y) {
    for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 / 20) * i;
        const speed = 5 + Math.random() * 5;
        effects.push({
            type: 'explosion',
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 30 + Math.random() * 30,
            size: 10 + Math.random() * 20,
            color: `hsl(${Math.random() * 60}, 100%, 50%)`
        });
    }
}

function createBossExplosion(x, y, width, height) {
    // 複数の大爆発を連続的に生成
    for (let j = 0; j < 5; j++) {
        setTimeout(() => {
            // ランダムな位置で爆発
            const explosionX = x + (Math.random() - 0.5) * width;
            const explosionY = y + (Math.random() - 0.5) * height;
            
            // 大きな爆発エフェクト
            for (let i = 0; i < 50; i++) {
                const angle = (Math.PI * 2 / 50) * i;
                const speed = 10 + Math.random() * 15;
                effects.push({
                    type: 'bossExplosion',
                    x: explosionX,
                    y: explosionY,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 60 + Math.random() * 60,
                    size: 20 + Math.random() * 40,
                    color: `hsl(${Math.random() * 60}, 100%, 50%)`
                });
            }
        }, j * 200); // 0.2秒ごとに爆発
    }
}

function showRemainingLives() {
    effects.push({
        type: 'livesDisplay',
        x: GAME_CONFIG.width / 2,
        y: GAME_CONFIG.height / 2,
        life: 120,
        scale: 0.1
    });
}

function gameOver() {
    gameState = GameState.GAME_OVER;
    stopBGM();
    document.getElementById('gameOverScreen').style.display = 'flex';
}

// 描画処理
function render() {
    ctx.clearRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
    
    // 背景描画
    renderBackground();
    
    // ゲームオブジェクト描画
    renderPlayer();
    renderBullets();
    renderEnemies();
    renderItems();
    renderEffects();
    
    // 当たり判定表示
    if (GAME_CONFIG.showHitboxes) {
        renderHitboxes();
    }
    
    renderHUD();
}

function renderHitboxes() {
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    
    // プレイヤーの当たり判定
    const playerPadding = 40; // checkCollisionと同じ値に
    ctx.strokeRect(
        player.x - player.width / 2 + playerPadding,
        player.y - player.height / 2 + playerPadding,
        player.width - playerPadding * 2,
        player.height - playerPadding * 2
    );
    
    // 敵の当たり判定
    ctx.strokeStyle = '#f00';
    for (const enemy of enemies) {
        if (enemy.hitEnabled) {
            ctx.strokeRect(
                enemy.x - enemy.width / 2,
                enemy.y - enemy.height / 2,
                enemy.width,
                enemy.height
            );
        }
    }
    
    // 弾の当たり判定
    ctx.strokeStyle = '#ff0';
    for (const bullet of enemyBullets) {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.width / 2, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
}

function renderTitle() {
    ctx.clearRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
    
    // タイトル背景アニメーション
    const hue = (frameCount * 2) % 360;
    ctx.fillStyle = `hsl(${hue}, 50%, 10%)`;
    ctx.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
}

function renderBackground() {
    // チカチカする背景
    const colors = frameCount % 20 < 10 ? 
        ['#111', '#222', '#333'] : 
        ['#811', '#922', '#a33'];
    
    for (let i = 0; i < 3; i++) {
        ctx.fillStyle = colors[i];
        ctx.fillRect(background.x + i * 640, 0, 640, GAME_CONFIG.height);
        ctx.fillRect(background.x + i * 640 + GAME_CONFIG.width, 0, 640, GAME_CONFIG.height);
    }
}

function renderPlayer() {
    ctx.save();
    
    // 無敵時間中は点滅
    if (player.invincible > 0 && player.invincible % 4 < 2) {
        ctx.globalAlpha = 0.5;
    }
    
    // 自機描画
    if (images.main) {
        ctx.drawImage(images.main, 
            player.x - player.width / 2, 
            player.y - player.height / 2 + Math.sin(frameCount * 0.1) * 5, // 上下揺れ
            player.width, 
            player.height
        );
    } else {
        ctx.fillStyle = '#0ff';
        ctx.fillRect(player.x - player.width / 2, player.y - player.height / 2, player.width, player.height);
    }
    
    // 付属機描画
    for (const attachment of player.attachments) {
        if (attachment.type === 'yoshimin' && images.yoshimin) {
            ctx.drawImage(images.yoshimin,
                attachment.x - attachment.width / 2,
                attachment.y - attachment.height / 2,
                attachment.width,
                attachment.height
            );
        } else if (attachment.type === 'hiyoko' && images.hiyoko) {
            ctx.drawImage(images.hiyoko,
                attachment.x - attachment.width / 2,
                attachment.y - attachment.height / 2,
                attachment.width,
                attachment.height
            );
        }
    }
    
    ctx.restore();
}

function renderBullets() {
    // プレイヤー弾
    ctx.fillStyle = '#ff0';
    for (const bullet of playerBullets) {
        ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height / 2, bullet.width, bullet.height);
    }
    
    // 敵弾
    for (const bullet of enemyBullets) {
        if (bullet.width === 40 && bullet.height === 16) {
            // ステージ2ボスのビーム風弾
            ctx.fillStyle = '#0ff';
            ctx.shadowColor = '#0ff';
            ctx.shadowBlur = 10;
            ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height / 2, bullet.width, bullet.height);
            ctx.shadowBlur = 0;
        } else {
            // 通常の弾
            ctx.fillStyle = '#f00';
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, bullet.width / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function renderEnemies() {
    for (const enemy of enemies) {
        ctx.save();
        
        // 敵画像描画
        if (images[enemy.sprite]) {
            // ステージ2ボスの「あわてない画像」は大きく表示
            if (enemy.type === 'boss2' && enemy.sprite === 'enemy4') {
                const scale = 2; // 2倍の大きさで表示
                ctx.drawImage(images[enemy.sprite],
                    enemy.x - (enemy.width * scale) / 2,
                    enemy.y - (enemy.height * scale) / 2,
                    enemy.width * scale,
                    enemy.height * scale
                );
            } else {
                ctx.drawImage(images[enemy.sprite],
                    enemy.x - enemy.width / 2,
                    enemy.y - enemy.height / 2,
                    enemy.width,
                    enemy.height
                );
            }
        } else {
            ctx.fillStyle = '#f0f';
            ctx.fillRect(enemy.x - enemy.width / 2, enemy.y - enemy.height / 2, enemy.width, enemy.height);
        }
        
        // ボスのHPゲージ
        if (enemy.isBoss) {
            const barWidth = 600;
            const barHeight = 20;
            const barX = (GAME_CONFIG.width - barWidth) / 2;
            const barY = 50;
            
            ctx.fillStyle = '#333';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            
            ctx.fillStyle = '#f00';
            const hpRatio = enemy.hp / enemy.maxHp;
            ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
            
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(barX, barY, barWidth, barHeight);
            
            ctx.fillStyle = '#fff';
            ctx.font = '20px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`HP: ${enemy.maxHp}`, GAME_CONFIG.width / 2, barY - 10);
            
            // ボス2のタイマーとあわてない画像
            if (enemy.type === 'boss2') {
                const seconds = Math.ceil(enemy.timer / 60);
                ctx.fillText(`TIME: ${seconds}`, GAME_CONFIG.width / 2, barY + barHeight + 30);
                
                enemy.timer--;
                if (enemy.timer <= 0) {
                    // タイムアップで次ステージ
                    currentStage++;
                    clearGameObjects();
                    showOPAnimation(currentStage);
                }
                
                // 5秒ごとにあわてない画像
                if (enemy.timer % 300 === 0 && images.time) {
                    effects.push({
                        type: 'image',
                        image: 'time',
                        x: GAME_CONFIG.width / 2,
                        y: GAME_CONFIG.height / 2,
                        life: 120,
                        scale: 1
                    });
                }
            }
        }
        
        ctx.restore();
    }
}

function renderItems() {
    for (const item of items) {
        if (images[item.type]) {
            ctx.drawImage(images[item.type],
                item.x - item.width / 2,
                item.y - item.height / 2,
                item.width,
                item.height
            );
        } else {
            ctx.fillStyle = '#0f0';
            ctx.fillRect(item.x - item.width / 2, item.y - item.height / 2, item.width, item.height);
        }
    }
}

function renderEffects() {
    for (const effect of effects) {
        ctx.save();
        
        if (effect.type === 'text') {
            ctx.globalAlpha = effect.life / 60;
            ctx.fillStyle = '#fff';
            ctx.font = `${48 * effect.scale}px bold monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(effect.text, effect.x, effect.y);
        } else if (effect.type === 'image' && images[effect.image]) {
            ctx.globalAlpha = Math.min(1, effect.life / 30);
            // 時間.jpgは大きく表示
            const baseSize = effect.image === 'time' ? 600 : 300;
            const size = baseSize * effect.scale;
            ctx.drawImage(images[effect.image],
                effect.x - size / 2,
                effect.y - size / 2,
                size,
                size
            );
        } else if (effect.type === 'itemGet' && images[effect.image]) {
            ctx.globalAlpha = Math.min(1, effect.life / 30);
            const size = 400 * effect.scale;
            ctx.drawImage(images[effect.image],
                effect.x - size / 2,
                effect.y - size / 2 - 100,
                size,
                size
            );
            
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 4;
            ctx.font = `${48 * effect.scale}px bold monospace`;
            ctx.textAlign = 'center';
            ctx.strokeText(effect.text, effect.x, effect.y + 100);
            ctx.fillText(effect.text, effect.x, effect.y + 100);
        } else if (effect.type === 'explosion') {
            ctx.globalAlpha = effect.life / 60;
            ctx.fillStyle = effect.color;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, effect.size, 0, Math.PI * 2);
            ctx.fill();
        } else if (effect.type === 'bossExplosion') {
            ctx.globalAlpha = effect.life / 120;
            ctx.fillStyle = effect.color;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, effect.size, 0, Math.PI * 2);
            ctx.fill();
            // 明るい中心部
            ctx.globalAlpha = effect.life / 60;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, effect.size * 0.5, 0, Math.PI * 2);
            ctx.fill();
        } else if (effect.type === 'livesDisplay') {
            ctx.globalAlpha = Math.min(1, effect.life / 30);
            ctx.fillStyle = '#fff';
            ctx.font = `${72 * effect.scale}px bold monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(`LIVES: ${lives}`, effect.x, effect.y);
            
            // 残機アイコン表示
            if (images.main) {
                const iconSize = 60 * effect.scale;
                for (let i = 0; i < lives; i++) {
                    ctx.drawImage(images.main,
                        effect.x - (lives * iconSize) / 2 + i * iconSize,
                        effect.y + 40,
                        iconSize,
                        iconSize
                    );
                }
            }
        }
        
        ctx.restore();
    }
}

function renderHUD() {
    ctx.fillStyle = '#fff';
    ctx.font = '24px monospace';
    ctx.textAlign = 'left';
    
    ctx.fillText(`SCORE: ${score.toString().padStart(8, '0')}`, 20, 40);
    ctx.fillText(`LIVES: ${lives}`, 20, 70);
    ctx.fillText(`STAGE: ${currentStage}`, 20, 100);
    
    if (player.weapon === '3way') {
        ctx.fillText('WEAPON: 3WAY', 20, 130);
    }
    
    // ボス戦タイマー表示
    if (bossBattleTimer > 0) {
        ctx.fillStyle = '#ff0';
        const seconds = Math.ceil(bossBattleTimer / 60);
        ctx.fillText(`CANNON DISABLED: ${seconds}s`, 20, 160);
    }
}