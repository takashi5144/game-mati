// メインゲームクラス
class PixelFarmGame {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // カメラコントロール用の変数
        this.cameraControls = {
            isRotating: false,
            isPanning: false,
            rotateStart: new THREE.Vector2(),
            rotateEnd: new THREE.Vector2(),
            rotateDelta: new THREE.Vector2(),
            panStart: new THREE.Vector2(),
            panEnd: new THREE.Vector2(),
            panDelta: new THREE.Vector2(),
            spherical: new THREE.Spherical(),
            sphericalDelta: new THREE.Spherical(),
            scale: 1,
            zoomSpeed: 0.1,
            target: new THREE.Vector3(15, 0, 15),
            minDistance: 5,
            maxDistance: 100,
            minPolarAngle: 0,
            maxPolarAngle: Math.PI * 0.495
        };
        
        this.voxelBuilder = new VoxelBuilder();
        this.realisticBuilder = new RealisticBuilder();
        this.useRealisticMode = true; // リアルモードを有効化
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
        try {
            // シーンの作成
            this.scene = new THREE.Scene();
            this.scene.fog = new THREE.Fog(0x87CEEB, 50, 100);
            this.scene.background = new THREE.Color(0x87CEEB);
            
            // カメラの設定（透視投影カメラ）
            this.camera = new THREE.PerspectiveCamera(
                45,
                window.innerWidth / window.innerHeight,
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
            
            // カメラコントロールの初期化
            const offset = new THREE.Vector3().subVectors(this.camera.position, this.cameraControls.target);
            this.cameraControls.spherical.setFromVector3(offset);
        
        // レンダラーの設定
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,  // リアルな見た目のためアンチエイリアスを有効に
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
        console.log('ゲームワールド初期化開始');
        const builder = this.useRealisticMode ? this.realisticBuilder : this.voxelBuilder;
        this.gameWorld = new GameWorld(this.scene, builder);
        console.log('住民AI初期化開始');
        this.residentAI = new ResidentAI(this.scene, builder, this.gameWorld);
        console.log('リソースマネージャー初期化開始');
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
        } catch (error) {
            console.error('ゲーム初期化エラー:', error);
            alert('ゲームの初期化中にエラーが発生しました: ' + error.message);
        }
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
        directionalLight.shadow.mapSize.width = 4096;
        directionalLight.shadow.mapSize.height = 4096;
        
        this.scene.add(directionalLight);
        
        // スポットライト（特定エリアの照明）
        const spotLight = new THREE.SpotLight(
            GAME_CONFIG.LIGHTING.SPOT.color,
            GAME_CONFIG.LIGHTING.SPOT.intensity,
            GAME_CONFIG.LIGHTING.SPOT.distance,
            GAME_CONFIG.LIGHTING.SPOT.angle,
            GAME_CONFIG.LIGHTING.SPOT.penumbra,
            GAME_CONFIG.LIGHTING.SPOT.decay
        );
        spotLight.position.set(10, 20, 10);
        spotLight.target.position.set(10, 0, 10);
        spotLight.castShadow = true;
        spotLight.shadow.mapSize.width = 2048;
        spotLight.shadow.mapSize.height = 2048;
        
        this.scene.add(spotLight);
        this.scene.add(spotLight.target);
    }

    setupEventListeners() {
        // マウスイベント
        this.renderer.domElement.addEventListener('click', (event) => this.onMouseClick(event));
        this.renderer.domElement.addEventListener('mousemove', (event) => this.onMouseMove(event));
        this.renderer.domElement.addEventListener('mousedown', (event) => this.onMouseDown(event));
        this.renderer.domElement.addEventListener('mouseup', (event) => this.onMouseUp(event));
        this.renderer.domElement.addEventListener('wheel', (event) => this.onMouseWheel(event));
        this.renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
        
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
        
        document.getElementById('btn-barn').addEventListener('click', () => {
            this.gameWorld.setBuildMode('barn');
        });
        
        document.getElementById('btn-harvest-tree').addEventListener('click', () => {
            this.gameWorld.setBuildMode('harvest');
        });
        
        document.getElementById('btn-demolish').addEventListener('click', () => {
            this.gameWorld.setBuildMode('demolish');
        });
        
        document.getElementById('btn-expand-map').addEventListener('click', () => {
            this.expandMap();
        });
        
        document.getElementById('btn-pause').addEventListener('click', () => {
            this.togglePause();
        });
        
        document.getElementById('btn-speed').addEventListener('click', () => {
            this.cycleGameSpeed();
        });
        
        // キーボードショートカット
        document.addEventListener('keydown', (event) => this.onKeyDown(event));
        
        // 職業変更セレクトボックス
        document.getElementById('btn-change-profession').addEventListener('click', () => {
            const select = document.getElementById('profession-select');
            const newProfession = select.value;
            
            if (this.selectedResident && newProfession) {
                this.residentAI.changeProfession(this.selectedResident.id, newProfession);
                this.updateResidentPanel();
                this.showNotification(`${this.selectedResident.name}の職業を${GAME_CONFIG.PROFESSIONS[newProfession].name}に変更しました`);
            }
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
        // 初期の住民を生成（2人）
        setTimeout(() => {
            // 2人の住民を生成
            const resident1 = this.resourceManager.spawnResident('none');
            if (resident1) {
                resident1.name = '①';
                // ResidentAIでも名前を更新
                const residentData = this.residentAI.getResident(resident1.id);
                if (residentData) {
                    residentData.name = '①';
                }
            }
            
            const resident2 = this.resourceManager.spawnResident('none');
            if (resident2) {
                resident2.name = '②';
                // ResidentAIでも名前を更新
                const residentData = this.residentAI.getResident(resident2.id);
                if (residentData) {
                    residentData.name = '②';
                }
            }
            
            logGameEvent('初期住民生成完了', { 
                total: 2,
                names: ['①', '②'],
                profession: '無職' 
            });
            
            // プレイヤーへの説明
            this.showNotification('住民をクリックして職業を割り当ててください');
        }, 1000);
    }

    placeInitialBuildings() {
        // 初期建物を配置（住民がすぐに働けるように）
        setTimeout(() => {
            // 納屋を中央に配置
            this.gameWorld.placeBuilding(15, 15, 'barn');
            
            // 畑を3つ配置（納屋の周りに）
            this.gameWorld.placeBuilding(10, 10, 'farm');
            this.gameWorld.placeBuilding(13, 10, 'farm');
            this.gameWorld.placeBuilding(16, 10, 'farm');
            
            // 家を1つ配置
            this.gameWorld.placeBuilding(10, 13, 'house');
            
            // 建物をすぐに完成状態にする
            this.gameWorld.buildings.forEach(building => {
                if (!building.isComplete) {
                    this.gameWorld.completeBuilding(building);
                }
            });
            
            logGameEvent('初期建物配置完了', { 
                barn: 1,
                farms: 3, 
                houses: 1
            });
        }, 500);
    }

    onMouseClick(event) {
        // カメラ操作中はクリックイベントを無視
        if (this.cameraControls.isRotating || this.cameraControls.isPanning) {
            return;
        }
        
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
        
        // 職業セレクトボックスの状態を更新
        const select = document.getElementById('profession-select');
        select.value = this.selectedResident.profession;
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
        
        // カメラ回転
        if (this.cameraControls.isRotating) {
            this.cameraControls.rotateEnd.set(event.clientX, event.clientY);
            this.cameraControls.rotateDelta.subVectors(this.cameraControls.rotateEnd, this.cameraControls.rotateStart);
            
            const element = this.renderer.domElement;
            this.cameraControls.sphericalDelta.theta -= 2 * Math.PI * this.cameraControls.rotateDelta.x / element.clientWidth;
            this.cameraControls.sphericalDelta.phi -= 2 * Math.PI * this.cameraControls.rotateDelta.y / element.clientHeight;
            
            this.cameraControls.rotateStart.copy(this.cameraControls.rotateEnd);
            this.updateCamera();
        }
        
        // カメラパン
        if (this.cameraControls.isPanning) {
            this.cameraControls.panEnd.set(event.clientX, event.clientY);
            this.cameraControls.panDelta.subVectors(this.cameraControls.panEnd, this.cameraControls.panStart);
            
            const offset = new THREE.Vector3();
            const distance = this.camera.position.distanceTo(this.cameraControls.target);
            const targetDistance = distance * Math.tan((this.camera.fov / 2) * Math.PI / 180);
            
            // 横方向の移動
            offset.setFromMatrixColumn(this.camera.matrix, 0);
            offset.multiplyScalar(-2 * this.cameraControls.panDelta.x * targetDistance / this.renderer.domElement.clientHeight);
            this.cameraControls.target.add(offset);
            
            // 縦方向の移動
            offset.setFromMatrixColumn(this.camera.matrix, 1);
            offset.multiplyScalar(2 * this.cameraControls.panDelta.y * targetDistance / this.renderer.domElement.clientHeight);
            this.cameraControls.target.add(offset);
            
            this.cameraControls.panStart.copy(this.cameraControls.panEnd);
            this.updateCamera();
        }
    }
    
    onMouseDown(event) {
        event.preventDefault();
        
        if (event.button === 0) { // 左クリック
            this.cameraControls.isRotating = true;
            this.cameraControls.rotateStart.set(event.clientX, event.clientY);
        } else if (event.button === 1) { // 中クリック
            this.cameraControls.isPanning = true;
            this.cameraControls.panStart.set(event.clientX, event.clientY);
        }
    }
    
    onMouseUp(event) {
        this.cameraControls.isRotating = false;
        this.cameraControls.isPanning = false;
    }
    
    onMouseWheel(event) {
        event.preventDefault();
        
        if (event.deltaY < 0) {
            this.cameraControls.scale /= 1.05;
        } else {
            this.cameraControls.scale *= 1.05;
        }
        
        this.updateCamera();
    }
    
    updateCamera() {
        const offset = new THREE.Vector3();
        
        // カメラの球面座標を更新
        this.cameraControls.spherical.radius *= this.cameraControls.scale;
        this.cameraControls.spherical.theta += this.cameraControls.sphericalDelta.theta;
        this.cameraControls.spherical.phi += this.cameraControls.sphericalDelta.phi;
        
        // 制限を適用
        this.cameraControls.spherical.radius = Math.max(this.cameraControls.minDistance, Math.min(this.cameraControls.maxDistance, this.cameraControls.spherical.radius));
        this.cameraControls.spherical.phi = Math.max(this.cameraControls.minPolarAngle, Math.min(this.cameraControls.maxPolarAngle, this.cameraControls.spherical.phi));
        
        // 球面座標から直交座標へ変換
        offset.setFromSpherical(this.cameraControls.spherical);
        
        // カメラ位置を更新
        this.camera.position.copy(this.cameraControls.target).add(offset);
        this.camera.lookAt(this.cameraControls.target);
        
        // デルタをリセット
        this.cameraControls.sphericalDelta.set(0, 0, 0);
        this.cameraControls.scale = 1;
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
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
            case '4':
                this.gameWorld.setBuildMode('barn');
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
    
    expandMap() {
        const expandCost = { money: 0, wood: 0 };  // 無料で拡張可能に
        
        // マップを拡張
        const currentSize = this.gameWorld.mapSize || 20;
        const newSize = currentSize + 5;  // 一度に5マス拡張
        
        // 新しいタイルを追加
        this.gameWorld.expandMap(newSize);
        
        // カメラターゲットを新しい中心に調整
        this.cameraControls.target.set(newSize / 2, 0, newSize / 2);
        this.updateCamera();
        
        this.showNotification(`マップを${newSize}x${newSize}に拡張しました！`);
        logGameEvent('マップ拡張', { 
            oldSize: currentSize, 
            newSize: newSize,
            cost: expandCost 
        });
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
            this.onNewDay();
        }
    }

    updateTimeDisplay() {
        const dayDisplay = document.getElementById('day-display');
        const seasonDisplay = document.getElementById('season-display');
        
        dayDisplay.textContent = `Day ${this.currentDay}`;
        seasonDisplay.textContent = GAME_CONFIG.SEASONS[this.currentSeason].name;
    }
    
    onNewDay() {
        // 新しい日の処理
        logGameEvent('新しい日', { day: this.currentDay });
        
        // すべての畑を乾かす
        if (this.gameWorld) {
            this.gameWorld.buildings.forEach(building => {
                if (building.type === 'farm' && building.isComplete) {
                    // 水やり済みの畑を種まき済みに戻す（乾く）
                    if (building.farmState === 'WATERED') {
                        this.gameWorld.changeFarmState(building, 'SEEDED');
                        logGameEvent('畑が乾いた', { 
                            farmId: building.id,
                            position: { x: building.x, z: building.z }
                        });
                    }
                    // 成長中の畑も水が必要になる
                    else if (['SPROUTED', 'GROWING_EARLY', 'GROWING_MID'].includes(building.farmState)) {
                        // 成長段階を1つ戻す（水不足）
                        const previousState = building.farmState === 'SPROUTED' ? 'SEEDED' :
                                            building.farmState === 'GROWING_EARLY' ? 'SPROUTED' :
                                            'GROWING_EARLY';
                        this.gameWorld.changeFarmState(building, previousState);
                        logGameEvent('水不足で成長が止まった', { 
                            farmId: building.id,
                            position: { x: building.x, z: building.z }
                        });
                    }
                }
            });
            
            this.showNotification('新しい日が始まりました。畑に水やりが必要です！');
        }
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