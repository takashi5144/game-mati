// メインゲームクラス
class PixelFarmGame {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.voxelBuilder = new VoxelBuilder();
        this.gameWorld = null;
        this.residentAI = null;
        this.resourceManager = null;
        
        this.gameSpeed = GAME_CONFIG.GAME_SPEED.NORMAL;
        this.isPaused = false;
        this.currentDay = 1;
        this.currentSeason = 'SPRING';
        this.seasonTimer = 0;
        
        this.selectedResident = null;
        
        this.clock = new THREE.Clock();
        
        this.init();
    }

    init() {
        // シーンの作成
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x87CEEB, 20, 50);
        
        // カメラの設定（正投影カメラ）
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = GAME_CONFIG.CAMERA.FRUSTUM_SIZE;
        this.camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            frustumSize / -2,
            0.1,
            1000
        );
        this.camera.position.set(
            GAME_CONFIG.CAMERA.POSITION.x,
            GAME_CONFIG.CAMERA.POSITION.y,
            GAME_CONFIG.CAMERA.POSITION.z
        );
        this.camera.lookAt(
            GAME_CONFIG.CAMERA.LOOK_AT.x,
            GAME_CONFIG.CAMERA.LOOK_AT.y,
            GAME_CONFIG.CAMERA.LOOK_AT.z
        );
        
        // レンダラーの設定
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: false,  // ピクセルアート風にするためアンチエイリアスを無効に
            alpha: true 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.shadowMap.autoUpdate = true;
        
        const container = document.getElementById('game-container');
        container.appendChild(this.renderer.domElement);
        
        // ライティングの設定
        this.setupLighting();
        
        // ゲームオブジェクトの初期化
        this.gameWorld = new GameWorld(this.scene, this.voxelBuilder);
        this.residentAI = new ResidentAI(this.scene, this.voxelBuilder, this.gameWorld);
        this.resourceManager = new ResourceManager();
        
        // グローバル変数として公開（他のクラスから参照できるように）
        window.gameWorld = this.gameWorld;
        window.residentAI = this.residentAI;
        window.resourceManager = this.resourceManager;
        
        // イベントリスナーの設定
        this.setupEventListeners();
        
        // 初期住民の生成
        this.spawnInitialResidents();
        
        // 初期建物の配置
        this.placeInitialBuildings();
        
        // ゲームループの開始
        this.animate();
        
        logGameEvent('ゲーム開始', { 
            mapSize: { 
                width: GAME_CONFIG.MAP.WIDTH, 
                height: GAME_CONFIG.MAP.HEIGHT 
            } 
        });
    }

    setupLighting() {
        // 環境光
        const ambientLight = new THREE.AmbientLight(
            GAME_CONFIG.LIGHTING.AMBIENT.color,
            GAME_CONFIG.LIGHTING.AMBIENT.intensity
        );
        this.scene.add(ambientLight);
        
        // 指向性ライト（太陽光）
        const directionalLight = new THREE.DirectionalLight(
            GAME_CONFIG.LIGHTING.DIRECTIONAL.color,
            GAME_CONFIG.LIGHTING.DIRECTIONAL.intensity
        );
        directionalLight.position.set(
            GAME_CONFIG.LIGHTING.DIRECTIONAL.position.x,
            GAME_CONFIG.LIGHTING.DIRECTIONAL.position.y,
            GAME_CONFIG.LIGHTING.DIRECTIONAL.position.z
        );
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.left = -30;
        directionalLight.shadow.camera.right = 30;
        directionalLight.shadow.camera.top = 30;
        directionalLight.shadow.camera.bottom = -30;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        
        this.scene.add(directionalLight);
    }

    setupEventListeners() {
        // マウスイベント
        this.renderer.domElement.addEventListener('click', (event) => this.onMouseClick(event));
        this.renderer.domElement.addEventListener('mousemove', (event) => this.onMouseMove(event));
        
        // ウィンドウリサイズ
        window.addEventListener('resize', () => this.onWindowResize());
        
        // UIボタン
        document.getElementById('btn-farm').addEventListener('click', () => {
            this.gameWorld.setBuildMode('farm');
        });
        
        document.getElementById('btn-house').addEventListener('click', () => {
            this.gameWorld.setBuildMode('house');
        });
        
        document.getElementById('btn-lumbermill').addEventListener('click', () => {
            this.gameWorld.setBuildMode('lumbermill');
        });
        
        document.getElementById('btn-demolish').addEventListener('click', () => {
            this.gameWorld.setBuildMode('demolish');
        });
        
        document.getElementById('btn-pause').addEventListener('click', () => {
            this.togglePause();
        });
        
        document.getElementById('btn-speed').addEventListener('click', () => {
            this.cycleGameSpeed();
        });
        
        // キーボードショートカット
        document.addEventListener('keydown', (event) => this.onKeyDown(event));
        
        // 職業変更ボタン
        document.querySelectorAll('.profession-btn').forEach(btn => {
            btn.addEventListener('click', (event) => {
                if (this.selectedResident) {
                    const newProfession = event.target.dataset.profession;
                    this.residentAI.changeProfession(this.selectedResident.id, newProfession);
                    this.updateResidentPanel();
                }
            });
        });
        
        // ウィンドウシステム
        document.getElementById('btn-open-window').addEventListener('click', () => {
            document.getElementById('resident-window').classList.remove('hidden');
            this.updateMarketTab();
            this.updateStatsTab();
        });
        
        document.querySelector('.window-close').addEventListener('click', () => {
            document.getElementById('resident-window').classList.add('hidden');
        });
        
        // タブシステム
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (event) => {
                const tabName = event.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
        
        // 売却ボタン
        document.getElementById('btn-sell-all').addEventListener('click', () => {
            const totalPrice = this.resourceManager.sellAllCrops();
            if (totalPrice > 0) {
                this.showNotification(`作物を売却しました！ +${totalPrice}円`);
                this.updateMarketTab();
            } else {
                this.showNotification('売却できる作物がありません', 'error');
            }
        });
    }
    
    switchTab(tabName) {
        // すべてのタブを非表示
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 選択されたタブを表示
        document.getElementById(`tab-${tabName}`).classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // タブに応じて内容を更新
        if (tabName === 'market') {
            this.updateMarketTab();
        } else if (tabName === 'stats') {
            this.updateStatsTab();
        }
    }
    
    updateMarketTab() {
        const marketItems = document.getElementById('market-items');
        marketItems.innerHTML = '';
        
        let totalValue = 0;
        
        Object.entries(this.resourceManager.resources.harvested).forEach(([cropId, amount]) => {
            if (amount > 0) {
                const cropPrices = { wheat: 50, tomato: 80, potato: 60 };
                const price = cropPrices[cropId] || 50;
                const value = price * amount;
                totalValue += value;
                
                const item = document.createElement('div');
                item.className = 'market-item';
                item.innerHTML = `
                    <div class="market-item-info">
                        <strong>${this.getCropName(cropId)}</strong>
                        <span>数量: ${amount} | 単価: ${price}円</span>
                    </div>
                    <div class="market-item-actions">
                        <span>${value}円</span>
                    </div>
                `;
                marketItems.appendChild(item);
            }
        });
        
        if (marketItems.children.length === 0) {
            marketItems.innerHTML = '<p style="color: #999;">収穫した作物がありません</p>';
        }
        
        document.getElementById('market-total').textContent = totalValue;
    }
    
    updateStatsTab() {
        document.getElementById('stat-residents').textContent = this.residentAI.getResidentCount();
        document.getElementById('stat-buildings').textContent = this.gameWorld.buildings.size;
        
        let totalHarvested = 0;
        Object.values(this.resourceManager.resources.harvested).forEach(amount => {
            totalHarvested += amount;
        });
        document.getElementById('stat-harvested').textContent = totalHarvested;
    }
    
    getCropName(cropId) {
        const names = {
            wheat: '小麦',
            tomato: 'トマト',
            potato: 'ジャガイモ'
        };
        return names[cropId] || cropId;
    }
    
    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        const bgColor = type === 'error' ? 'rgba(255, 0, 0, 0.9)' : 'rgba(76, 175, 80, 0.9)';
        notification.style.cssText = `
            position: fixed;
            top: 120px;
            left: 50%;
            transform: translateX(-50%);
            background: ${bgColor};
            color: white;
            padding: 15px 30px;
            border-radius: 5px;
            font-size: 18px;
            z-index: 1000;
            border: 2px solid ${type === 'error' ? '#ff6666' : '#4CAF50'};
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.transition = 'opacity 0.5s';
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }

    spawnInitialResidents() {
        // 初期の住民を生成（全員無職）
        setTimeout(() => {
            // 6人の無職住民を生成
            for (let i = 0; i < 6; i++) {
                this.resourceManager.spawnResident('none');
            }
            
            logGameEvent('初期住民生成完了', { 
                total: 6,
                profession: '無職' 
            });
            
            // プレイヤーへの説明
            this.showNotification('住民をクリックして職業を割り当ててください');
        }, 1000);
    }

    placeInitialBuildings() {
        // 初期建物を配置（住民がすぐに働けるように）
        setTimeout(() => {
            // 畑を3つ配置
            this.gameWorld.placeBuilding(8, 8, 'farm');
            this.gameWorld.placeBuilding(11, 8, 'farm');
            this.gameWorld.placeBuilding(14, 8, 'farm');
            
            // 家を2つ配置
            this.gameWorld.placeBuilding(8, 11, 'house');
            this.gameWorld.placeBuilding(11, 11, 'house');
            
            // 製材所を1つ配置
            this.gameWorld.placeBuilding(14, 11, 'lumbermill');
            
            // 建物をすぐに完成状態にする
            this.gameWorld.buildings.forEach(building => {
                if (!building.isComplete) {
                    this.gameWorld.completeBuilding(building);
                }
            });
            
            logGameEvent('初期建物配置完了', { 
                farms: 3, 
                houses: 2, 
                lumbermills: 1 
            });
        }, 500);
    }

    onMouseClick(event) {
        // マウス座標を正規化
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // レイキャスト
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;
            
            // 住民をクリックした場合
            if (clickedObject.userData && clickedObject.userData.type === 'resident') {
                this.selectResident(clickedObject.userData.residentId);
                return;
            }
            
            // タイルをクリックした場合
            const point = intersects[0].point;
            const tileX = Math.floor(point.x + 0.5);
            const tileZ = Math.floor(point.z + 0.5);
            
            this.gameWorld.handleClick(tileX, tileZ);
        }
    }
    
    selectResident(residentId) {
        this.selectedResident = this.residentAI.getResident(residentId);
        if (!this.selectedResident) return;
        
        // ウィンドウを開く
        const window = document.getElementById('resident-window');
        window.classList.remove('hidden');
        
        // 職業変更タブをアクティブに
        this.switchTab('profession');
        
        // 住民情報を更新
        this.updateResidentPanel();
        
        // 建物情報パネルを隠す
        document.getElementById('info-panel').classList.add('hidden');
        
        logGameEvent('住民選択', { 
            id: residentId,
            name: this.selectedResident.name,
            profession: this.selectedResident.profession 
        });
    }
    
    updateResidentPanel() {
        if (!this.selectedResident) return;
        
        document.getElementById('resident-name').textContent = this.selectedResident.name;
        document.getElementById('resident-profession').textContent = GAME_CONFIG.PROFESSIONS[this.selectedResident.profession].name;
        document.getElementById('resident-state').textContent = this.getResidentStateText(this.selectedResident.state);
        document.getElementById('resident-energy').textContent = `${Math.floor(this.selectedResident.energy)}/100`;
        
        // 職業ボタンの状態を更新
        document.querySelectorAll('.profession-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.profession === this.selectedResident.profession) {
                btn.classList.add('active');
            }
        });
    }
    
    getResidentStateText(state) {
        const stateTexts = {
            'idle': '待機中',
            'moving': '移動中',
            'working': '作業中',
            'resting': '休憩中'
        };
        return stateTexts[state] || state;
    }

    onMouseMove(event) {
        // マウス座標を更新
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // ホバー効果のための処理をここに追加可能
    }

    onWindowResize() {
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = GAME_CONFIG.CAMERA.FRUSTUM_SIZE;
        
        this.camera.left = frustumSize * aspect / -2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = frustumSize / -2;
        
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    onKeyDown(event) {
        switch(event.key) {
            case ' ':
                this.togglePause();
                break;
            case '1':
                this.gameWorld.setBuildMode('farm');
                break;
            case '2':
                this.gameWorld.setBuildMode('house');
                break;
            case '3':
                this.gameWorld.setBuildMode('lumbermill');
                break;
            case 'd':
            case 'D':
                this.gameWorld.setBuildMode('demolish');
                break;
            case 'Escape':
                this.gameWorld.setBuildMode(null);
                this.gameWorld.deselectTile();
                this.selectedResident = null;
                document.getElementById('resident-window').classList.add('hidden');
                break;
        }
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const btn = document.getElementById('btn-pause');
        btn.textContent = this.isPaused ? '▶️ 再開' : '⏸️ 一時停止';
        
        logGameEvent('ゲーム一時停止', { paused: this.isPaused });
    }

    cycleGameSpeed() {
        const speeds = [
            GAME_CONFIG.GAME_SPEED.NORMAL,
            GAME_CONFIG.GAME_SPEED.FAST,
            GAME_CONFIG.GAME_SPEED.VERY_FAST
        ];
        const currentIndex = speeds.indexOf(this.gameSpeed);
        this.gameSpeed = speeds[(currentIndex + 1) % speeds.length];
        
        const btn = document.getElementById('btn-speed');
        const labels = ['1x', '2x', '3x'];
        btn.textContent = `⏩ 速度: ${labels[this.gameSpeed - 1]}`;
        
        logGameEvent('ゲーム速度変更', { speed: this.gameSpeed });
    }

    updateSeasons(deltaTime) {
        this.seasonTimer += deltaTime;
        
        const currentSeasonData = GAME_CONFIG.SEASONS[this.currentSeason];
        if (this.seasonTimer >= currentSeasonData.duration) {
            this.seasonTimer = 0;
            
            // 次の季節へ
            const seasonKeys = Object.keys(GAME_CONFIG.SEASONS);
            const currentIndex = seasonKeys.indexOf(this.currentSeason);
            this.currentSeason = seasonKeys[(currentIndex + 1) % seasonKeys.length];
            
            // 年が終わったら日数をリセット
            if (this.currentSeason === 'SPRING') {
                this.currentDay = 1;
            }
            
            this.updateTimeDisplay();
            
            logGameEvent('季節変更', { 
                newSeason: this.currentSeason,
                day: this.currentDay 
            });
        }
        
        // 日の進行
        if (this.seasonTimer % 1 < deltaTime) {
            this.currentDay++;
            this.updateTimeDisplay();
        }
    }

    updateTimeDisplay() {
        const dayDisplay = document.getElementById('day-display');
        const seasonDisplay = document.getElementById('season-display');
        
        dayDisplay.textContent = `Day ${this.currentDay}`;
        seasonDisplay.textContent = GAME_CONFIG.SEASONS[this.currentSeason].name;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        
        if (!this.isPaused) {
            const adjustedDelta = deltaTime * this.gameSpeed;
            
            // ゲームシステムの更新
            this.residentAI.update(adjustedDelta);
            this.gameWorld.updateProduction(adjustedDelta);
            this.resourceManager.update(adjustedDelta);
            this.updateSeasons(adjustedDelta);
            
            // 選択中の住民情報を更新
            if (this.selectedResident) {
                this.updateResidentPanel();
            }
            
            // パーティクルアニメーションなどの更新
            // TODO: パーティクルシステムの実装
        }
        
        // レンダリング
        this.renderer.render(this.scene, this.camera);
    }
}

// ゲームの開始
document.addEventListener('DOMContentLoaded', () => {
    const game = new PixelFarmGame();
    window.game = game;
});