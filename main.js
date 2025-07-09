// メインゲームクラス
class PixelFarmGame {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // ドラッグ選択用の変数
        this.isDragging = false;
        this.dragStart = new THREE.Vector2();
        this.dragEnd = new THREE.Vector2();
        this.selectionBox = null;
        
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
        
        // 範囲指定ツール
        document.getElementById('btn-resource').addEventListener('click', () => {
            this.gameWorld.setBuildMode('resource');
        });
        
        document.getElementById('btn-farmzone').addEventListener('click', () => {
            this.gameWorld.setBuildMode('farmzone');
        });
        
        document.getElementById('btn-cleararea').addEventListener('click', () => {
            this.gameWorld.setBuildMode('cleararea');
        });
        
        document.getElementById('btn-demolish').addEventListener('click', () => {
            this.gameWorld.setBuildMode('demolish');
        });
        
        document.getElementById('btn-cancel').addEventListener('click', () => {
            this.gameWorld.setBuildMode(null);
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
            const spawnPos1 = { x: 15, z: 13 };
            const resident1 = this.residentAI.createResident('none', spawnPos1);
            if (resident1) {
                resident1.name = '①';
                this.resourceManager.population++;
                this.resourceManager.updateUI();
            }
            
            const spawnPos2 = { x: 17, z: 13 };
            const resident2 = this.residentAI.createResident('none', spawnPos2);
            if (resident2) {
                resident2.name = '②';
                this.resourceManager.population++;
                this.resourceManager.updateUI();
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
        // 右クリックでツールをキャンセル
        if (event.button === 2) {
            event.preventDefault();
            this.gameWorld.setBuildMode(null);
            return;
        }
        
        // カメラ操作中やドラッグ選択中はクリックイベントを無視
        if (this.cameraControls.isRotating || this.cameraControls.isPanning || this.isDragging) {
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
        
        // ドラッグ選択中（すべての範囲選択モードで有効）
        if (this.isDragging && (this.gameWorld.buildMode === 'harvest' || 
            this.gameWorld.buildMode === 'resource' || 
            this.gameWorld.buildMode === 'farmzone' || 
            this.gameWorld.buildMode === 'cleararea')) {
            const rect = this.renderer.domElement.getBoundingClientRect();
            this.dragEnd.set(event.clientX - rect.left, event.clientY - rect.top);
            this.updateSelectionBox();
        }
    }
    
    onMouseDown(event) {
        event.preventDefault();
        
        if (event.button === 0) { // 左クリック
            if (this.gameWorld.buildMode === 'harvest' || this.gameWorld.buildMode === 'resource' || 
                this.gameWorld.buildMode === 'farmzone' || this.gameWorld.buildMode === 'cleararea') {
                // 範囲選択モードの場合はドラッグ選択開始
                this.isDragging = true;
                const rect = this.renderer.domElement.getBoundingClientRect();
                this.dragStart.set(event.clientX - rect.left, event.clientY - rect.top);
                this.dragEnd.copy(this.dragStart);
                this.createSelectionBox();
            }
        } else if (event.button === 1) { // 中クリック
            this.cameraControls.isPanning = true;
            this.cameraControls.panStart.set(event.clientX, event.clientY);
        } else if (event.button === 2) { // 右クリック
            this.cameraControls.isRotating = true;
            this.cameraControls.rotateStart.set(event.clientX, event.clientY);
        }
    }
    
    onMouseUp(event) {
        this.cameraControls.isRotating = false;
        this.cameraControls.isPanning = false;
        
        if (this.isDragging && (this.gameWorld.buildMode === 'harvest' || this.gameWorld.buildMode === 'resource' || 
            this.gameWorld.buildMode === 'farmzone' || this.gameWorld.buildMode === 'cleararea')) {
            this.isDragging = false;
            this.completeSelection();
            this.removeSelectionBox();
        }
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
        switch(event.key.toLowerCase()) {
            // ゲーム速度制御
            case ' ':
                this.togglePause();
                break;
            case '1':
                this.setGameSpeed(1);
                break;
            case '2':
                this.setGameSpeed(2);
                break;
            case '3':
                this.setGameSpeed(5);
                break;
            
            // カメラ移動（WASD）
            case 'w':
                this.moveCameraRelative(0, -1);
                break;
            case 's':
                this.moveCameraRelative(0, 1);
                break;
            case 'a':
                this.moveCameraRelative(-1, 0);
                break;
            case 'd':
                this.moveCameraRelative(1, 0);
                break;
            
            // カメラ回転（QE）
            case 'q':
                this.rotateCameraBy(-Math.PI / 8);
                break;
            case 'e':
                this.rotateCameraBy(Math.PI / 8);
                break;
            
            // UIパネル
            case 'b':
                this.toggleBuildPanel();
                break;
            case 'r':
                this.toggleResourcePanel();
                break;
            case 'p':
                this.toggleResidentPanel();
                break;
            
            // その他
            case 'escape':
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
    
    // ゲーム速度を設定
    setGameSpeed(speed) {
        this.gameSpeed = speed;
        const btn = document.getElementById('btn-speed');
        const labels = ['1x', '2x', '5x'];
        const speeds = [1, 2, 5];
        const index = speeds.indexOf(speed);
        if (index !== -1) {
            btn.textContent = `⏩ 速度: ${labels[index]}`;
        }
        logGameEvent('ゲーム速度変更', { speed: speed });
    }
    
    // カメラを相対的に移動
    moveCameraRelative(dx, dz) {
        const moveSpeed = 2;
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        
        // カメラの向きに基づいて移動方向を計算
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0));
        
        this.cameraControls.target.add(right.multiplyScalar(dx * moveSpeed));
        this.cameraControls.target.add(forward.multiplyScalar(dz * moveSpeed));
        
        this.updateCamera();
    }
    
    // カメラを回転
    rotateCameraBy(angle) {
        this.cameraControls.spherical.theta += angle;
        this.updateCamera();
    }
    
    // 建設パネルの表示/非表示
    toggleBuildPanel() {
        const panel = document.getElementById('ui-bottom');
        panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
    }
    
    // リソースパネルの表示/非表示（将来実装用）
    toggleResourcePanel() {
        // TODO: リソース専用パネルを実装
        this.showNotification('リソースパネル（R）は準備中です');
    }
    
    // 住民パネルの表示/非表示
    toggleResidentPanel() {
        const window = document.getElementById('resident-window');
        if (window.classList.contains('hidden')) {
            window.classList.remove('hidden');
            this.updateMarketTab();
            this.updateStatsTab();
        } else {
            window.classList.add('hidden');
        }
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
    
    // カーソルを設定
    setCursor(type) {
        const container = document.getElementById('game-container');
        container.classList.remove('selecting-cursor', 'building-cursor', 'demolish-cursor');
        
        switch(type) {
            case 'selecting':
                container.classList.add('selecting-cursor');
                break;
            case 'building':
                container.classList.add('building-cursor');
                break;
            case 'demolish':
                container.classList.add('demolish-cursor');
                break;
            default:
                // デフォルトカーソル
                break;
        }
    }
    
    // 選択ボックスを作成
    createSelectionBox() {
        if (!this.selectionBox) {
            this.selectionBox = document.createElement('div');
            this.selectionBox.style.cssText = `
                position: absolute;
                border: 2px solid #00FF00;
                background: rgba(0, 255, 0, 0.1);
                pointer-events: none;
                z-index: 1000;
            `;
            document.getElementById('game-container').appendChild(this.selectionBox);
        }
    }
    
    // 選択ボックスを更新
    updateSelectionBox() {
        if (!this.selectionBox) return;
        
        const left = Math.min(this.dragStart.x, this.dragEnd.x);
        const top = Math.min(this.dragStart.y, this.dragEnd.y);
        const width = Math.abs(this.dragEnd.x - this.dragStart.x);
        const height = Math.abs(this.dragEnd.y - this.dragStart.y);
        
        this.selectionBox.style.left = left + 'px';
        this.selectionBox.style.top = top + 'px';
        this.selectionBox.style.width = width + 'px';
        this.selectionBox.style.height = height + 'px';
    }
    
    // 選択ボックスを削除
    removeSelectionBox() {
        if (this.selectionBox) {
            this.selectionBox.remove();
            this.selectionBox = null;
        }
    }
    
    // 選択完了処理
    completeSelection() {
        if (!this.gameWorld.buildMode) return;
        
        // 選択範囲の四隅を3D空間に変換
        const rect = this.renderer.domElement.getBoundingClientRect();
        const corners = [
            { x: this.dragStart.x, y: this.dragStart.y },
            { x: this.dragEnd.x, y: this.dragStart.y },
            { x: this.dragEnd.x, y: this.dragEnd.y },
            { x: this.dragStart.x, y: this.dragEnd.y }
        ];
        
        const worldCorners = corners.map(corner => {
            const mouse = new THREE.Vector2(
                (corner.x / rect.width) * 2 - 1,
                -(corner.y / rect.height) * 2 + 1
            );
            
            this.raycaster.setFromCamera(mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.scene.children, true);
            
            if (intersects.length > 0) {
                return intersects[0].point;
            }
            return null;
        }).filter(p => p !== null);
        
        if (worldCorners.length < 2) return;
        
        // 選択範囲を計算
        const minX = Math.floor(Math.min(...worldCorners.map(p => p.x)));
        const maxX = Math.floor(Math.max(...worldCorners.map(p => p.x)));
        const minZ = Math.floor(Math.min(...worldCorners.map(p => p.z)));
        const maxZ = Math.floor(Math.max(...worldCorners.map(p => p.z)));
        
        let selectedCount = 0;
        
        switch(this.gameWorld.buildMode) {
            case 'harvest':
                // 伐採指定（従来の処理）
                this.gameWorld.tiles.forEach(tile => {
                    if (tile.type === 'forest' && 
                        tile.x >= minX && tile.x <= maxX &&
                        tile.z >= minZ && tile.z <= maxZ) {
                        this.gameWorld.harvestTree(tile);
                        selectedCount++;
                    }
                });
                
                if (selectedCount > 0) {
                    this.showNotification(`${selectedCount}本の木を伐採対象に指定しました`, 'success');
                }
                break;
                
            case 'resource':
                // 資源確保エリアの指定
                this.gameWorld.tiles.forEach(tile => {
                    if ((tile.type === 'forest' || tile.type === 'stone') && 
                        tile.x >= minX && tile.x <= maxX &&
                        tile.z >= minZ && tile.z <= maxZ) {
                        this.gameWorld.markResourceArea(tile);
                        selectedCount++;
                    }
                });
                
                if (selectedCount > 0) {
                    this.showNotification(`${selectedCount}マスを資源確保エリアに指定しました`, 'success');
                }
                break;
                
            case 'farmzone':
                // 農地エリアの作成
                // まず作成可能なマス数を数える
                let farmableCount = 0;
                for (let x = minX; x <= maxX; x++) {
                    for (let z = minZ; z <= maxZ; z++) {
                        const tile = this.gameWorld.getTileAt(x, z);
                        if (tile && (tile.type === 'grass' || tile.type === 'dirt') && !tile.occupied) {
                            farmableCount++;
                        }
                    }
                }
                
                if (farmableCount === 0) {
                    this.showNotification('農地を作成できる場所がありません', 'error');
                    break;
                }
                
                // 資源チェック
                const cost = farmableCount * 10; // 1マスあたり木材10
                if (!this.resourceManager.canAfford({ wood: cost })) {
                    this.showNotification(`木材が不足しています（必要: ${cost}）`, 'error');
                    break;
                }
                
                // 農地を作成
                for (let x = minX; x <= maxX; x++) {
                    for (let z = minZ; z <= maxZ; z++) {
                        const tile = this.gameWorld.getTileAt(x, z);
                        if (tile && (tile.type === 'grass' || tile.type === 'dirt')) {
                            if (this.gameWorld.createFarmZone(x, z)) {
                                selectedCount++;
                            }
                        }
                    }
                }
                
                if (selectedCount > 0) {
                    this.showNotification(`${selectedCount}マスの農地を作成しました`, 'success');
                    // 資源を消費
                    this.resourceManager.consumeResources({ wood: selectedCount * 10 });
                }
                break;
                
            case 'cleararea':
                // 整地エリアの指定
                this.gameWorld.tiles.forEach(tile => {
                    if ((tile.type === 'forest' || tile.type === 'stone') && 
                        tile.x >= minX && tile.x <= maxX &&
                        tile.z >= minZ && tile.z <= maxZ) {
                        this.gameWorld.markForClearing(tile);
                        selectedCount++;
                    }
                });
                
                if (selectedCount > 0) {
                    this.showNotification(`${selectedCount}マスを整地対象に指定しました`, 'success');
                }
                break;
        }
        
        this.gameWorld.setBuildMode(null);
    }
}

// ゲームの開始
document.addEventListener('DOMContentLoaded', () => {
    const game = new PixelFarmGame();
    window.game = game;
});