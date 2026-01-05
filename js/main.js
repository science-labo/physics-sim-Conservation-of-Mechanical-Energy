// ========================================
// グローバル変数
// ========================================
const g = 9.8; // 重力加速度 (m/s²)
let animationFrameId = null;

// ========================================
// タブ切り替え機能
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const simContainers = document.querySelectorAll('.simulation-container');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // 全てのタブとコンテナから active クラスを削除
            tabButtons.forEach(btn => btn.classList.remove('active'));
            simContainers.forEach(container => container.classList.remove('active'));
            
            // クリックされたタブとコンテナに active クラスを追加
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
            
            // すべてのアニメーションを停止
            cancelAnimationFrame(animationFrameId);
            pendulumSim.isRunning = false;
            slopeSim.isRunning = false;
            freefallSim.isRunning = false;
            
            // タブ切り替え後にキャンバスをリサイズして再描画
            setTimeout(() => {
                if (targetTab === 'pendulum') {
                    pendulumSim.canvas.width = pendulumSim.canvas.offsetWidth;
                    pendulumSim.canvas.height = 400;
                    drawPendulum();
                } else if (targetTab === 'slope') {
                    slopeSim.canvas.width = slopeSim.canvas.offsetWidth;
                    slopeSim.canvas.height = 400;
                    drawSlope();
                } else if (targetTab === 'freefall') {
                    freefallSim.canvas.width = freefallSim.canvas.offsetWidth;
                    freefallSim.canvas.height = 400;
                    drawFreefall();
                }
            }, 50);
        });
    });
    
    // シミュレーションの初期化
    setTimeout(() => {
        // まず振り子を初期化（これはアクティブなタブなのでサイズが取得できる）
        initPendulumSimulation();
        
        // 振り子のキャンバスサイズを基準にする
        const refWidth = pendulumSim.canvas.width;
        const refHeight = pendulumSim.canvas.height;
        
        // 他のシミュレーションを初期化（基準サイズを渡す）
        initSlopeSimulation(refWidth, refHeight);
        initFreefallSimulation(refWidth, refHeight);
        
        // 初期描画を確実に実行
        setTimeout(() => {
            drawPendulum();
            drawSlope();
            drawFreefall();
        }, 100);
    }, 100);
});

// ========================================
// 振り子シミュレーション
// ========================================
const pendulumSim = {
    canvas: null,
    ctx: null,
    chart: null,
    isRunning: false,
    
    // パラメータ
    mass: 1.0,
    length: 2.0,
    initialAngle: 60 * Math.PI / 180,
    
    // 状態変数
    angle: 0,
    angularVelocity: 0,
    time: 0,
    
    // データ保存
    energyData: {
        time: [],
        pe: [],
        ke: [],
        total: []
    },
    maxDataPoints: 100
};

function initPendulumSimulation() {
    // キャンバス設定
    pendulumSim.canvas = document.getElementById('pendulumCanvas');
    pendulumSim.ctx = pendulumSim.canvas.getContext('2d');
    
    // 非表示タブのキャンバスはoffsetWidthが0になるため、親要素のサイズを取得
    const parentWidth = pendulumSim.canvas.parentElement.offsetWidth;
    
    // キャンバスサイズを明示的に設定
    if (parentWidth > 0) {
        pendulumSim.canvas.width = parentWidth;
        pendulumSim.canvas.height = 400;
    } else {
        pendulumSim.canvas.width = 600;
        pendulumSim.canvas.height = 400;
    }
    
    // パラメータスライダーのイベントリスナー
    document.getElementById('pendulumMass').addEventListener('input', (e) => {
        pendulumSim.mass = parseFloat(e.target.value);
        document.getElementById('pendulumMassValue').textContent = pendulumSim.mass.toFixed(1);
    });
    
    document.getElementById('pendulumLength').addEventListener('input', (e) => {
        pendulumSim.length = parseFloat(e.target.value);
        document.getElementById('pendulumLengthValue').textContent = pendulumSim.length.toFixed(1);
    });
    
    document.getElementById('pendulumAngle').addEventListener('input', (e) => {
        pendulumSim.initialAngle = parseFloat(e.target.value) * Math.PI / 180;
        document.getElementById('pendulumAngleValue').textContent = e.target.value;
    });
    
    // コントロールボタン
    document.getElementById('pendulumPlay').addEventListener('click', () => {
        pendulumSim.isRunning = true;
        animatePendulum();
    });
    
    document.getElementById('pendulumPause').addEventListener('click', () => {
        pendulumSim.isRunning = false;
    });
    
    document.getElementById('pendulumReset').addEventListener('click', () => {
        pendulumSim.isRunning = false;
        resetPendulum();
    });
    
    // Chart.js 初期化
    initPendulumChart();
    
    // 初期描画
    resetPendulum();
}

function resetPendulum() {
    pendulumSim.angle = pendulumSim.initialAngle;
    pendulumSim.angularVelocity = 0;
    pendulumSim.time = 0;
    
    // データリセット
    pendulumSim.energyData.time = [];
    pendulumSim.energyData.pe = [];
    pendulumSim.energyData.ke = [];
    pendulumSim.energyData.total = [];
    
    updatePendulumChart();
    drawPendulum();
    updatePendulumDisplay();
}

function animatePendulum() {
    if (!pendulumSim.isRunning) return;
    
    const dt = 0.016; // 約60fps
    
    // 角加速度の計算 (小角近似を使わない)
    const angularAcceleration = -(g / pendulumSim.length) * Math.sin(pendulumSim.angle);
    
    // 速度と位置の更新
    pendulumSim.angularVelocity += angularAcceleration * dt;
    pendulumSim.angle += pendulumSim.angularVelocity * dt;
    pendulumSim.time += dt;
    
    // エネルギー計算
    const height = pendulumSim.length * (1 - Math.cos(pendulumSim.angle));
    const velocity = pendulumSim.length * Math.abs(pendulumSim.angularVelocity);
    const pe = pendulumSim.mass * g * height;
    const ke = 0.5 * pendulumSim.mass * velocity * velocity;
    const total = pe + ke;
    
    // データ保存
    if (pendulumSim.energyData.time.length >= pendulumSim.maxDataPoints) {
        pendulumSim.energyData.time.shift();
        pendulumSim.energyData.pe.shift();
        pendulumSim.energyData.ke.shift();
        pendulumSim.energyData.total.shift();
    }
    
    pendulumSim.energyData.time.push(pendulumSim.time.toFixed(2));
    pendulumSim.energyData.pe.push(pe.toFixed(2));
    pendulumSim.energyData.ke.push(ke.toFixed(2));
    pendulumSim.energyData.total.push(total.toFixed(2));
    
    // 描画と表示更新
    drawPendulum();
    updatePendulumDisplay();
    updatePendulumChart();
    
    animationFrameId = requestAnimationFrame(animatePendulum);
}

function drawPendulum() {
    const canvas = pendulumSim.canvas;
    const ctx = pendulumSim.ctx;
    
    // キャンバスサイズ確認
    if (canvas.width === 0 || canvas.height === 0) {
        canvas.width = canvas.offsetWidth || 600;
        canvas.height = 400;
    }
    
    // キャンバスクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 中心点
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 4;
    
    // スケール計算
    const scale = Math.min(canvas.width, canvas.height) / 6;
    const bobX = centerX + pendulumSim.length * scale * Math.sin(pendulumSim.angle);
    const bobY = centerY + pendulumSim.length * scale * Math.cos(pendulumSim.angle);
    
    // 基準線（地面）
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, centerY + pendulumSim.length * scale);
    ctx.lineTo(canvas.width, centerY + pendulumSim.length * scale);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 支点
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // 紐
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();
    
    // 振り子の球
    const bobRadius = 15 + pendulumSim.mass * 5;
    const gradient = ctx.createRadialGradient(bobX - 5, bobY - 5, 0, bobX, bobY, bobRadius);
    gradient.addColorStop(0, '#fbbf24');
    gradient.addColorStop(1, '#f59e0b');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(bobX, bobY, bobRadius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 速度ベクトル
    const velocity = pendulumSim.length * pendulumSim.angularVelocity;
    const vx = velocity * Math.cos(pendulumSim.angle) * scale * 0.5;
    const vy = -velocity * Math.sin(pendulumSim.angle) * scale * 0.5;
    
    if (Math.abs(velocity) > 0.1) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bobX, bobY);
        ctx.lineTo(bobX + vx, bobY + vy);
        ctx.stroke();
        
        // 矢印
        drawArrow(ctx, bobX, bobY, bobX + vx, bobY + vy, '#ef4444');
    }
}

function updatePendulumDisplay() {
    const height = pendulumSim.length * (1 - Math.cos(pendulumSim.angle));
    const velocity = pendulumSim.length * Math.abs(pendulumSim.angularVelocity);
    const pe = pendulumSim.mass * g * height;
    const ke = 0.5 * pendulumSim.mass * velocity * velocity;
    const total = pe + ke;
    
    document.getElementById('pendulumHeight').textContent = height.toFixed(2) + ' m';
    document.getElementById('pendulumVelocity').textContent = velocity.toFixed(2) + ' m/s';
    document.getElementById('pendulumPE').textContent = pe.toFixed(2) + ' J';
    document.getElementById('pendulumKE').textContent = ke.toFixed(2) + ' J';
    document.getElementById('pendulumTotal').textContent = total.toFixed(2) + ' J';
}

function initPendulumChart() {
    const ctx = document.getElementById('pendulumChart').getContext('2d');
    pendulumSim.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: '位置エネルギー (J)',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4
                },
                {
                    label: '運動エネルギー (J)',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4
                },
                {
                    label: '全エネルギー (J)',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '時間 (秒)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'エネルギー (J)'
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
}

function updatePendulumChart() {
    pendulumSim.chart.data.labels = pendulumSim.energyData.time;
    pendulumSim.chart.data.datasets[0].data = pendulumSim.energyData.pe;
    pendulumSim.chart.data.datasets[1].data = pendulumSim.energyData.ke;
    pendulumSim.chart.data.datasets[2].data = pendulumSim.energyData.total;
    pendulumSim.chart.update();
}

// ========================================
// 斜面転がりシミュレーション
// ========================================
const slopeSim = {
    canvas: null,
    ctx: null,
    chart: null,
    isRunning: false,
    
    // パラメータ
    mass: 1.0,
    initialHeight: 5.0,
    slopeAngle: 30 * Math.PI / 180,
    
    // 状態変数
    x: 0,
    y: 0,
    velocity: 0,
    time: 0,
    
    // データ保存
    energyData: {
        time: [],
        pe: [],
        ke: [],
        total: []
    },
    maxDataPoints: 100
};

function initSlopeSimulation(defaultWidth, defaultHeight) {
    slopeSim.canvas = document.getElementById('slopeCanvas');
    slopeSim.ctx = slopeSim.canvas.getContext('2d');
    
    // キャンバスサイズを設定（デフォルト値を使用）
    slopeSim.canvas.width = defaultWidth || 600;
    slopeSim.canvas.height = defaultHeight || 400;
    
    // パラメータスライダー
    document.getElementById('slopeMass').addEventListener('input', (e) => {
        slopeSim.mass = parseFloat(e.target.value);
        document.getElementById('slopeMassValue').textContent = slopeSim.mass.toFixed(1);
    });
    
    document.getElementById('slopeHeight').addEventListener('input', (e) => {
        slopeSim.initialHeight = parseFloat(e.target.value);
        document.getElementById('slopeHeightValue').textContent = slopeSim.initialHeight.toFixed(1);
    });
    
    document.getElementById('slopeAngle').addEventListener('input', (e) => {
        slopeSim.slopeAngle = parseFloat(e.target.value) * Math.PI / 180;
        document.getElementById('slopeAngleValue').textContent = e.target.value;
    });
    
    // コントロールボタン
    document.getElementById('slopePlay').addEventListener('click', () => {
        slopeSim.isRunning = true;
        animateSlope();
    });
    
    document.getElementById('slopePause').addEventListener('click', () => {
        slopeSim.isRunning = false;
    });
    
    document.getElementById('slopeReset').addEventListener('click', () => {
        slopeSim.isRunning = false;
        resetSlope();
    });
    
    // Chart.js 初期化
    initSlopeChart();
    
    resetSlope();
}

function resetSlope() {
    slopeSim.x = 0;
    slopeSim.y = slopeSim.initialHeight;
    slopeSim.velocity = 0;
    slopeSim.time = 0;
    
    slopeSim.energyData.time = [];
    slopeSim.energyData.pe = [];
    slopeSim.energyData.ke = [];
    slopeSim.energyData.total = [];
    
    updateSlopeChart();
    drawSlope();
    updateSlopeDisplay();
}

function animateSlope() {
    if (!slopeSim.isRunning) return;
    
    const dt = 0.016;
    
    // 斜面上を転がる加速度 (摩擦なし、回転を考慮しない単純化)
    const acceleration = g * Math.sin(slopeSim.slopeAngle);
    
    slopeSim.velocity += acceleration * dt;
    
    const distance = slopeSim.velocity * dt;
    slopeSim.x += distance * Math.cos(slopeSim.slopeAngle);
    slopeSim.y -= distance * Math.sin(slopeSim.slopeAngle);
    
    slopeSim.time += dt;
    
    // 地面に到達したら停止
    if (slopeSim.y <= 0) {
        slopeSim.y = 0;
        slopeSim.isRunning = false;
    }
    
    // エネルギー計算
    const pe = slopeSim.mass * g * slopeSim.y;
    const ke = 0.5 * slopeSim.mass * slopeSim.velocity * slopeSim.velocity;
    const total = pe + ke;
    
    // データ保存
    if (slopeSim.energyData.time.length >= slopeSim.maxDataPoints) {
        slopeSim.energyData.time.shift();
        slopeSim.energyData.pe.shift();
        slopeSim.energyData.ke.shift();
        slopeSim.energyData.total.shift();
    }
    
    slopeSim.energyData.time.push(slopeSim.time.toFixed(2));
    slopeSim.energyData.pe.push(pe.toFixed(2));
    slopeSim.energyData.ke.push(ke.toFixed(2));
    slopeSim.energyData.total.push(total.toFixed(2));
    
    drawSlope();
    updateSlopeDisplay();
    updateSlopeChart();
    
    if (slopeSim.isRunning) {
        animationFrameId = requestAnimationFrame(animateSlope);
    }
}

function drawSlope() {
    const canvas = slopeSim.canvas;
    const ctx = slopeSim.ctx;
    
    // キャンバスサイズ確認
    if (canvas.width === 0 || canvas.height === 0) {
        canvas.width = canvas.offsetWidth || 600;
        canvas.height = 400;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const scale = Math.min(canvas.width, canvas.height) / 12;
    const startX = 50;
    const groundY = canvas.height - 50;
    
    // 斜面の長さ
    const slopeLength = slopeSim.initialHeight / Math.sin(slopeSim.slopeAngle);
    const slopeEndX = startX + slopeLength * Math.cos(slopeSim.slopeAngle) * scale;
    const slopeEndY = groundY;
    const slopeStartY = groundY - slopeSim.initialHeight * scale;
    
    // 地面
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(canvas.width, groundY);
    ctx.stroke();
    
    // 斜面
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(startX, slopeStartY);
    ctx.lineTo(slopeEndX, slopeEndY);
    ctx.stroke();
    
    // 斜面の塗りつぶし
    ctx.fillStyle = 'rgba(100, 116, 139, 0.2)';
    ctx.beginPath();
    ctx.moveTo(startX, slopeStartY);
    ctx.lineTo(slopeEndX, slopeEndY);
    ctx.lineTo(startX, slopeEndY);
    ctx.closePath();
    ctx.fill();
    
    // 球の位置
    const ballX = startX + slopeSim.x * scale;
    const ballY = groundY - slopeSim.y * scale;
    
    // 球
    const ballRadius = 12 + slopeSim.mass * 3;
    const gradient = ctx.createRadialGradient(ballX - 3, ballY - 3, 0, ballX, ballY, ballRadius);
    gradient.addColorStop(0, '#60a5fa');
    gradient.addColorStop(1, '#3b82f6');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 速度ベクトル（斜面に沿った方向）
    if (slopeSim.velocity > 0.1) {
        const vScale = scale * 0.3;
        // 斜面を下る方向：右方向（+x）、下方向（+y）
        const vx = slopeSim.velocity * Math.cos(slopeSim.slopeAngle) * vScale;
        const vy = slopeSim.velocity * Math.sin(slopeSim.slopeAngle) * vScale;
        
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ballX, ballY);
        ctx.lineTo(ballX + vx, ballY + vy);
        ctx.stroke();
        
        drawArrow(ctx, ballX, ballY, ballX + vx, ballY + vy, '#ef4444');
    }
    
    // 高さ表示線
    if (slopeSim.y > 0) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(ballX, ballY);
        ctx.lineTo(ballX, groundY);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // 高さテキスト
        ctx.fillStyle = '#3b82f6';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`h = ${slopeSim.y.toFixed(1)}m`, ballX + 10, (ballY + groundY) / 2);
    }
}

function updateSlopeDisplay() {
    const pe = slopeSim.mass * g * slopeSim.y;
    const ke = 0.5 * slopeSim.mass * slopeSim.velocity * slopeSim.velocity;
    const total = pe + ke;
    
    document.getElementById('slopeHeightCurrent').textContent = slopeSim.y.toFixed(2) + ' m';
    document.getElementById('slopeVelocity').textContent = slopeSim.velocity.toFixed(2) + ' m/s';
    document.getElementById('slopePE').textContent = pe.toFixed(2) + ' J';
    document.getElementById('slopeKE').textContent = ke.toFixed(2) + ' J';
    document.getElementById('slopeTotal').textContent = total.toFixed(2) + ' J';
}

function initSlopeChart() {
    const ctx = document.getElementById('slopeChart').getContext('2d');
    slopeSim.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: '位置エネルギー (J)',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4
                },
                {
                    label: '運動エネルギー (J)',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4
                },
                {
                    label: '全エネルギー (J)',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '時間 (秒)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'エネルギー (J)'
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
}

function updateSlopeChart() {
    slopeSim.chart.data.labels = slopeSim.energyData.time;
    slopeSim.chart.data.datasets[0].data = slopeSim.energyData.pe;
    slopeSim.chart.data.datasets[1].data = slopeSim.energyData.ke;
    slopeSim.chart.data.datasets[2].data = slopeSim.energyData.total;
    slopeSim.chart.update();
}

// ========================================
// 自由落下シミュレーション
// ========================================
const freefallSim = {
    canvas: null,
    ctx: null,
    chart: null,
    isRunning: false,
    
    // パラメータ
    mass: 1.0,
    initialHeight: 10.0,
    bounceCoeff: 0.8,
    
    // 状態変数
    y: 0,
    velocity: 0,
    time: 0,
    
    // データ保存
    energyData: {
        time: [],
        pe: [],
        ke: [],
        total: []
    },
    maxDataPoints: 150
};

function initFreefallSimulation(defaultWidth, defaultHeight) {
    freefallSim.canvas = document.getElementById('freefallCanvas');
    freefallSim.ctx = freefallSim.canvas.getContext('2d');
    
    // キャンバスサイズを設定（デフォルト値を使用）
    freefallSim.canvas.width = defaultWidth || 600;
    freefallSim.canvas.height = defaultHeight || 400;
    
    // パラメータスライダー
    document.getElementById('freefallMass').addEventListener('input', (e) => {
        freefallSim.mass = parseFloat(e.target.value);
        document.getElementById('freefallMassValue').textContent = freefallSim.mass.toFixed(1);
    });
    
    document.getElementById('freefallHeight').addEventListener('input', (e) => {
        freefallSim.initialHeight = parseFloat(e.target.value);
        document.getElementById('freefallHeightValue').textContent = freefallSim.initialHeight.toFixed(1);
    });
    
    document.getElementById('freefallBounce').addEventListener('input', (e) => {
        freefallSim.bounceCoeff = parseFloat(e.target.value);
        document.getElementById('freefallBounceValue').textContent = freefallSim.bounceCoeff.toFixed(2);
    });
    
    // コントロールボタン
    document.getElementById('freefallPlay').addEventListener('click', () => {
        freefallSim.isRunning = true;
        animateFreefall();
    });
    
    document.getElementById('freefallPause').addEventListener('click', () => {
        freefallSim.isRunning = false;
    });
    
    document.getElementById('freefallReset').addEventListener('click', () => {
        freefallSim.isRunning = false;
        resetFreefall();
    });
    
    // Chart.js 初期化
    initFreefallChart();
    
    resetFreefall();
}

function resetFreefall() {
    freefallSim.y = freefallSim.initialHeight;
    freefallSim.velocity = 0;
    freefallSim.time = 0;
    
    freefallSim.energyData.time = [];
    freefallSim.energyData.pe = [];
    freefallSim.energyData.ke = [];
    freefallSim.energyData.total = [];
    
    updateFreefallChart();
    drawFreefall();
    updateFreefallDisplay();
}

function animateFreefall() {
    if (!freefallSim.isRunning) return;
    
    const dt = 0.016;
    
    // 重力による加速
    freefallSim.velocity += g * dt;
    freefallSim.y -= freefallSim.velocity * dt;
    
    // 地面との衝突判定
    if (freefallSim.y <= 0) {
        freefallSim.y = 0;
        freefallSim.velocity = -freefallSim.velocity * freefallSim.bounceCoeff;
        
        // 跳ね返りが小さくなったら停止
        if (Math.abs(freefallSim.velocity) < 0.5) {
            freefallSim.velocity = 0;
            freefallSim.isRunning = false;
        }
    }
    
    freefallSim.time += dt;
    
    // エネルギー計算
    const pe = freefallSim.mass * g * freefallSim.y;
    const ke = 0.5 * freefallSim.mass * freefallSim.velocity * freefallSim.velocity;
    const total = pe + ke;
    
    // データ保存
    if (freefallSim.energyData.time.length >= freefallSim.maxDataPoints) {
        freefallSim.energyData.time.shift();
        freefallSim.energyData.pe.shift();
        freefallSim.energyData.ke.shift();
        freefallSim.energyData.total.shift();
    }
    
    freefallSim.energyData.time.push(freefallSim.time.toFixed(2));
    freefallSim.energyData.pe.push(pe.toFixed(2));
    freefallSim.energyData.ke.push(ke.toFixed(2));
    freefallSim.energyData.total.push(total.toFixed(2));
    
    drawFreefall();
    updateFreefallDisplay();
    updateFreefallChart();
    
    if (freefallSim.isRunning) {
        animationFrameId = requestAnimationFrame(animateFreefall);
    }
}

function drawFreefall() {
    const canvas = freefallSim.canvas;
    const ctx = freefallSim.ctx;
    
    // キャンバスサイズ確認
    if (canvas.width === 0 || canvas.height === 0) {
        canvas.width = canvas.offsetWidth || 600;
        canvas.height = 400;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const centerX = canvas.width / 2;
    const groundY = canvas.height - 50;
    const scale = (canvas.height - 100) / (freefallSim.initialHeight + 2);
    
    // 高さの目盛り
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#64748b';
    
    for (let h = 0; h <= freefallSim.initialHeight; h += 2) {
        const y = groundY - h * scale;
        ctx.beginPath();
        ctx.moveTo(centerX - 20, y);
        ctx.lineTo(centerX - 10, y);
        ctx.stroke();
        ctx.fillText(h + 'm', centerX - 50, y + 4);
    }
    
    // 地面
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
    
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(canvas.width, groundY);
    ctx.stroke();
    
    // 球の位置
    const ballY = groundY - freefallSim.y * scale;
    const ballRadius = 15 + freefallSim.mass * 3;
    
    // 高さを示す線
    if (freefallSim.y > 0) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(centerX, ballY);
        ctx.lineTo(centerX, groundY);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    // 球
    const gradient = ctx.createRadialGradient(centerX - 5, ballY - 5, 0, centerX, ballY, ballRadius);
    gradient.addColorStop(0, '#a78bfa');
    gradient.addColorStop(1, '#8b5cf6');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // 速度ベクトル
    if (Math.abs(freefallSim.velocity) > 0.5) {
        const vScale = scale * 0.2;
        const vy = freefallSim.velocity * vScale;
        
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(centerX, ballY);
        ctx.lineTo(centerX, ballY + vy);
        ctx.stroke();
        
        drawArrow(ctx, centerX, ballY, centerX, ballY + vy, '#ef4444');
    }
}

function updateFreefallDisplay() {
    const pe = freefallSim.mass * g * freefallSim.y;
    const ke = 0.5 * freefallSim.mass * freefallSim.velocity * freefallSim.velocity;
    const total = pe + ke;
    
    document.getElementById('freefallHeightCurrent').textContent = freefallSim.y.toFixed(2) + ' m';
    document.getElementById('freefallVelocity').textContent = Math.abs(freefallSim.velocity).toFixed(2) + ' m/s';
    document.getElementById('freefallPE').textContent = pe.toFixed(2) + ' J';
    document.getElementById('freefallKE').textContent = ke.toFixed(2) + ' J';
    document.getElementById('freefallTotal').textContent = total.toFixed(2) + ' J';
}

function initFreefallChart() {
    const ctx = document.getElementById('freefallChart').getContext('2d');
    freefallSim.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: '位置エネルギー (J)',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4
                },
                {
                    label: '運動エネルギー (J)',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4
                },
                {
                    label: '全エネルギー (J)',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '時間 (秒)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'エネルギー (J)'
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
}

function updateFreefallChart() {
    freefallSim.chart.data.labels = freefallSim.energyData.time;
    freefallSim.chart.data.datasets[0].data = freefallSim.energyData.pe;
    freefallSim.chart.data.datasets[1].data = freefallSim.energyData.ke;
    freefallSim.chart.data.datasets[2].data = freefallSim.energyData.total;
    freefallSim.chart.update();
}

// ========================================
// ユーティリティ関数
// ========================================

// キャンバスリサイズ
function resizeCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // サイズが0の場合はデフォルト値を設定
    if (canvas.width === 0) canvas.width = 600;
    if (canvas.height === 0) canvas.height = 400;
}

// 矢印を描画
function drawArrow(ctx, fromX, fromY, toX, toY, color) {
    const headLength = 10;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
        toX - headLength * Math.cos(angle - Math.PI / 6),
        toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
        toX - headLength * Math.cos(angle + Math.PI / 6),
        toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
}

// ウィンドウリサイズ時の処理
window.addEventListener('resize', () => {
    // アクティブなキャンバスのみリサイズ
    const activeTab = document.querySelector('.simulation-container.active');
    if (activeTab) {
        const tabId = activeTab.id;
        
        if (tabId === 'pendulum' && pendulumSim.canvas) {
            pendulumSim.canvas.width = pendulumSim.canvas.offsetWidth;
            pendulumSim.canvas.height = 400;
            drawPendulum();
        } else if (tabId === 'slope' && slopeSim.canvas) {
            slopeSim.canvas.width = slopeSim.canvas.offsetWidth;
            slopeSim.canvas.height = 400;
            drawSlope();
        } else if (tabId === 'freefall' && freefallSim.canvas) {
            freefallSim.canvas.width = freefallSim.canvas.offsetWidth;
            freefallSim.canvas.height = 400;
            drawFreefall();
        }
    }
});
