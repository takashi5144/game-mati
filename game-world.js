// ゲームワールドの管理クラス
class GameWorld {
    constructor(scene, voxelBuilder) {
        this.scene = scene;
        this.voxelBuilder = voxelBuilder;
        this.tiles = new Map();
        this.buildings = new Map();
        this.selectedTile = null;
        this.selectionCursor = null;
        this.buildMode = null;
        this.mapSize = GAME_CONFIG.MAP.WIDTH;
        
        this.initializeMap();
        this.createSelectionCursor();
    }

    initializeMap() {
        const size = this.mapSize;
        
        for (let x = 0; x < size; x++) {
            for (let z = 0; z < size; z++) {
                let tileType = 'grass';
                
                // マップに変化を加える
                if (Math.random() < 0.1) {
                    tileType = 'forest';
                } else if (Math.random() < 0.05) {
                    tileType = 'dirt';
                }
                
                // 川を作る（マップサイズに応じて調整）
                const centerX = Math.floor(size / 2);
                const centerZ = Math.floor(size / 2);
                const riverWidth = 2;
                const riverStart = Math.floor(size * 0.2);
                const riverEnd = Math.floor(size * 0.8);
                
                // 曲がりくねった川を生成
                const riverCurve = Math.sin((z / size) * Math.PI * 2) * 3;
                const riverX = centerX + riverCurve;
                
                if ((x >= riverX - riverWidth && x <= riverX + riverWidth && z >= riverStart && z <= riverEnd) ||
                    (z >= centerZ - riverWidth && z <= centerZ + riverWidth && x >= riverStart && x <= riverEnd)) {
                    tileType = 'water';
                }
                
                const tile = this.voxelBuilder.createGroundTile(tileType, x, z);
                this.scene.add(tile);
                
                const key = `${x},${z}`;
                this.tiles.set(key, {
                    mesh: tile,
                    x: x,
                    z: z,
                    type: tileType,
                    building: null,
                    occupied: false
                });
            }
        }
        
        logGameEvent('マップ生成完了', { width: size, height: size });
    }

    createSelectionCursor() {
        this.selectionCursor = this.voxelBuilder.createSelectionCursor();
        this.selectionCursor.visible = false;
        this.scene.add(this.selectionCursor);
    }

    getTileAt(x, z) {
        const key = `${Math.floor(x)},${Math.floor(z)}`;
        return this.tiles.get(key);
    }

    selectTile(x, z) {
        const tile = this.getTileAt(x, z);
        if (!tile) return;
        
        this.selectedTile = tile;
        this.selectionCursor.position.set(tile.x, 0.2, tile.z);
        this.selectionCursor.visible = true;
        
        // 情報パネルを更新
        this.updateInfoPanel(tile);
    }

    deselectTile() {
        this.selectedTile = null;
        this.selectionCursor.visible = false;
        document.getElementById('info-panel').classList.add('hidden');
    }

    updateInfoPanel(tile) {
        const panel = document.getElementById('info-panel');
        const title = document.getElementById('info-title');
        const content = document.getElementById('info-content');
        
        panel.classList.remove('hidden');
        
        if (tile.building) {
            const buildingConfig = GAME_CONFIG.BUILDINGS[tile.building.type.toUpperCase()];
            title.textContent = buildingConfig.name;
            content.innerHTML = `
                <p>タイプ: ${buildingConfig.name}</p>
                <p>状態: ${tile.building.isComplete ? '稼働中' : '建設中'}</p>
                ${tile.building.worker ? `<p>作業者: ${tile.building.worker.profession}</p>` : ''}
                ${buildingConfig.production ? `<p>生産: ${Object.entries(buildingConfig.production).map(([k,v]) => `${k} +${v}`).join(', ')}</p>` : ''}
            `;
        } else {
            const tileConfig = GAME_CONFIG.TILE_TYPES[tile.type.toUpperCase()];
            title.textContent = tileConfig.name;
            content.innerHTML = `
                <p>座標: (${tile.x}, ${tile.z})</p>
                <p>建設可能: ${tileConfig.buildable ? 'はい' : 'いいえ'}</p>
            `;
        }
    }

    canBuildAt(x, z, buildingType) {
        const config = GAME_CONFIG.BUILDINGS[buildingType.toUpperCase()];
        if (!config) return false;
        
        // 建物のサイズを考慮してチェック
        for (let dx = 0; dx < config.size.width; dx++) {
            for (let dz = 0; dz < config.size.height; dz++) {
                const checkX = Math.floor(x) + dx;
                const checkZ = Math.floor(z) + dz;
                const tile = this.getTileAt(checkX, checkZ);
                
                if (!tile || tile.occupied || !GAME_CONFIG.TILE_TYPES[tile.type.toUpperCase()].buildable) {
                    return false;
                }
            }
        }
        
        return true;
    }

    placeBuilding(x, z, buildingType) {
        if (!this.canBuildAt(x, z, buildingType)) {
            logGameEvent('建設失敗', { reason: '建設不可能な場所です', x: x, z: z });
            return false;
        }
        
        const config = GAME_CONFIG.BUILDINGS[buildingType.toUpperCase()];
        const buildingId = `building_${Date.now()}`;
        
        // 建設サイトを作成
        const construction = this.voxelBuilder.createConstructionSite(buildingType, 0);
        construction.position.set(Math.floor(x), 0, Math.floor(z));
        this.scene.add(construction);
        
        // 建物データを作成
        const buildingData = {
            id: buildingId,
            type: buildingType,
            x: Math.floor(x),
            z: Math.floor(z),
            mesh: construction,
            isComplete: false,
            progress: 0,
            config: config,
            worker: null,
            productionTimer: 0,
            farmState: buildingType === 'farm' ? 'BARREN' : null,
            stateTimer: 0
        };
        
        // タイルを占有状態にする
        for (let dx = 0; dx < config.size.width; dx++) {
            for (let dz = 0; dz < config.size.height; dz++) {
                const tile = this.getTileAt(Math.floor(x) + dx, Math.floor(z) + dz);
                if (tile) {
                    tile.occupied = true;
                    tile.building = buildingData;
                }
            }
        }
        
        this.buildings.set(buildingId, buildingData);
        
        logGameEvent('建設開始', { 
            type: buildingType, 
            position: { x: Math.floor(x), z: Math.floor(z) },
            id: buildingId 
        });
        
        return buildingData;
    }

    updateBuildingProgress(buildingId, deltaTime) {
        const building = this.buildings.get(buildingId);
        if (!building || building.isComplete) return;
        
        building.progress += deltaTime / building.config.buildTime;
        
        if (building.progress >= 1) {
            // 建設完了
            this.completeBuilding(building);
        } else {
            // 建設進捗を更新
            this.scene.remove(building.mesh);
            building.mesh = this.voxelBuilder.createConstructionSite(building.type, building.progress);
            building.mesh.position.set(building.x, 0, building.z);
            this.scene.add(building.mesh);
        }
    }

    completeBuilding(building) {
        // 建設サイトを削除して完成した建物を配置
        this.scene.remove(building.mesh);
        
        // 畑の場合は初期成長段階を0に設定
        if (building.type === 'farm') {
            building.growthStage = 0;
            building.farmState = 'BARREN';
            building.mesh = this.voxelBuilder.createBuilding(building.type, 0, building.farmState);
        } else {
            building.mesh = this.voxelBuilder.createBuilding(building.type);
        }
        
        building.mesh.position.set(building.x, 0, building.z);
        this.scene.add(building.mesh);
        
        building.isComplete = true;
        building.progress = 1;
        
        // 建設完了エフェクト
        const particles = this.voxelBuilder.createParticleEffect('build', {
            x: building.x,
            y: 1,
            z: building.z
        });
        particles.forEach(p => this.scene.add(p));
        
        // パーティクルを削除（1秒後）
        setTimeout(() => {
            particles.forEach(p => this.scene.remove(p));
        }, 1000);
        
        logGameEvent('建設完了', { 
            type: building.type, 
            position: { x: building.x, z: building.z } 
        });
        
        // 家の場合は人口を増やす
        if (building.type === 'house') {
            const event = new CustomEvent('populationIncrease', { 
                detail: { amount: building.config.populationIncrease } 
            });
            window.dispatchEvent(event);
        }
    }

    demolishBuilding(x, z) {
        const tile = this.getTileAt(x, z);
        if (!tile || !tile.building) return false;
        
        const building = tile.building;
        
        // 建物を削除
        this.scene.remove(building.mesh);
        this.buildings.delete(building.id);
        
        // タイルの占有を解除
        for (let dx = 0; dx < building.config.size.width; dx++) {
            for (let dz = 0; dz < building.config.size.height; dz++) {
                const clearTile = this.getTileAt(building.x + dx, building.z + dz);
                if (clearTile) {
                    clearTile.occupied = false;
                    clearTile.building = null;
                }
            }
        }
        
        logGameEvent('建物撤去', { 
            type: building.type, 
            position: { x: building.x, z: building.z } 
        });
        
        return true;
    }

    updateProduction(deltaTime) {
        this.buildings.forEach(building => {
            if (!building.isComplete) return;
            
            // 畑の場合は新しい状態システムで管理（ResidentAIが処理）
            if (building.type === 'farm') {
                // ResidentAIがタイマーを管理するのでここでは更新しない
                return;
            }
            
            // 他の建物の生産処理
            if (!building.config.production || !building.worker) return;
            
            building.productionTimer += deltaTime;
            
            if (building.productionTimer >= building.config.productionInterval) {
                building.productionTimer = 0;
                
                // 生産物を追加
                const event = new CustomEvent('resourceProduced', { 
                    detail: { 
                        resources: building.config.production,
                        building: building
                    } 
                });
                window.dispatchEvent(event);
            }
        });
    }
    
    updateFarmGrowth(building) {
        // 古い建物メッシュを削除
        this.scene.remove(building.mesh);
        
        // 成長段階に応じた新しいメッシュを作成
        building.mesh = this.voxelBuilder.createBuilding(building.type, building.growthStage, building.farmState);
        building.mesh.position.set(building.x, 0, building.z);
        this.scene.add(building.mesh);
    }
    
    // 畑の状態を変更
    changeFarmState(building, newState) {
        if (building.type !== 'farm' || !building.isComplete) return;
        
        const oldState = building.farmState;
        building.farmState = newState;
        building.stateTimer = 0;
        
        // メッシュを更新
        this.updateFarmGrowth(building);
        
        logGameEvent('畑の状態変更', {
            buildingId: building.id,
            oldState: oldState,
            newState: newState,
            position: { x: building.x, z: building.z }
        });
    }

    getAvailableBuildings(type) {
        const available = [];
        this.buildings.forEach(building => {
            if (building.type === type && building.isComplete && !building.worker) {
                available.push(building);
            }
        });
        return available;
    }

    getConstructionSites() {
        const sites = [];
        this.buildings.forEach(building => {
            if (!building.isComplete && !building.worker) {
                sites.push(building);
            }
        });
        return sites;
    }

    setBuildMode(mode) {
        this.buildMode = mode;
        
        // ボタンの選択状態を更新
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        if (mode) {
            const btn = document.getElementById(`btn-${mode}`);
            if (btn) btn.classList.add('selected');
            
            // カーソルを更新
            if (window.game) {
                if (['harvest', 'resource', 'farmzone', 'cleararea'].includes(mode)) {
                    window.game.setCursor('selecting');
                } else if (mode === 'demolish') {
                    window.game.setCursor('demolish');
                } else {
                    window.game.setCursor('building');
                }
            }
        } else {
            // モードがnullの場合はデフォルトカーソル
            if (window.game) {
                window.game.setCursor('default');
            }
        }
    }

    handleClick(x, z) {
        const tile = this.getTileAt(x, z);
        
        if (this.buildMode === 'demolish') {
            this.demolishBuilding(x, z);
            this.setBuildMode(null);
        } else if (this.buildMode === 'harvest') {
            // 伐採モード
            if (tile && tile.type === 'forest') {
                this.harvestTree(tile);
            } else {
                if (window.game) {
                    window.game.showNotification('森のタイルを選択してください', 'error');
                }
            }
            this.setBuildMode(null);
        } else if (this.buildMode && this.buildMode !== 'demolish' && this.buildMode !== 'harvest') {
            const event = new CustomEvent('buildingPlaced', { 
                detail: { 
                    type: this.buildMode,
                    x: x,
                    z: z
                } 
            });
            window.dispatchEvent(event);
        } else if (tile && tile.type === 'water' && window.resourceManager) {
            // 川をクリックしたらじょうろに水を汲む
            window.resourceManager.fillWateringCan();
            this.createWaterFillEffect(x, z);
        } else {
            this.selectTile(x, z);
        }
    }
    
    // 水汲みエフェクト
    createWaterFillEffect(x, z) {
        const particles = [];
        for (let i = 0; i < 5; i++) {
            const geometry = new THREE.SphereGeometry(0.05, 6, 6);
            const material = new THREE.MeshStandardMaterial({
                color: 0x4169E1,
                transparent: true,
                opacity: 0.7,
                emissive: 0x4169E1,
                emissiveIntensity: 0.2
            });
            const droplet = new THREE.Mesh(geometry, material);
            droplet.position.set(
                x + (Math.random() - 0.5) * 0.5,
                1 + Math.random() * 0.5,
                z + (Math.random() - 0.5) * 0.5
            );
            this.scene.add(droplet);
            particles.push(droplet);
        }
        
        setTimeout(() => {
            particles.forEach(p => this.scene.remove(p));
        }, 1000);
    }
    
    expandMap(newSize) {
        const oldSize = this.mapSize;
        this.mapSize = newSize;
        
        // 新しいタイルを追加（既存のタイルの外側）
        for (let x = 0; x < newSize; x++) {
            for (let z = 0; z < newSize; z++) {
                // 既存のタイルはスキップ
                if (x < oldSize && z < oldSize) continue;
                
                const key = `${x},${z}`;
                if (this.tiles.has(key)) continue;
                
                // 新しいタイルのタイプを決定
                let tileType = 'grass';
                if (Math.random() < 0.1) {
                    tileType = 'forest';
                } else if (Math.random() < 0.05) {
                    tileType = 'dirt';
                }
                
                // タイルを作成
                const tile = this.voxelBuilder.createGroundTile(tileType, x, z);
                this.scene.add(tile);
                
                this.tiles.set(key, {
                    mesh: tile,
                    x: x,
                    z: z,
                    type: tileType,
                    building: null,
                    occupied: false
                });
            }
        }
        
        logGameEvent('マップ拡張完了', { 
            oldSize: oldSize, 
            newSize: newSize,
            newTiles: (newSize * newSize) - (oldSize * oldSize)
        });
    }
    
    // 木を伐採する
    harvestTree(tile) {
        if (!tile || tile.type !== 'forest') return;
        
        // 伐採タスクを作成
        const harvestTask = {
            id: `harvest_${Date.now()}`,
            type: 'harvest_tree',
            position: { x: tile.x, z: tile.z },
            tile: tile,
            assigned: false
        };
        
        // グローバル変数として公開（木こりが見つけられるように）
        if (!window.harvestTasks) {
            window.harvestTasks = [];
        }
        window.harvestTasks.push(harvestTask);
        
        // 伐採マーカーを表示
        const markerGeometry = new THREE.RingGeometry(0.3, 0.4, 8);
        const markerMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xFF0000,
            side: THREE.DoubleSide
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.rotation.x = -Math.PI / 2;
        marker.position.set(tile.x, 0.1, tile.z);
        marker.name = `harvest_marker_${harvestTask.id}`;
        this.scene.add(marker);
        
        // タスクにマーカーを紐付け
        harvestTask.marker = marker;
        
        logGameEvent('伐採タスク作成', {
            position: { x: tile.x, z: tile.z },
            taskId: harvestTask.id
        });
        
        if (window.game) {
            window.game.showNotification('伐採対象を指定しました', 'success');
        }
    }
    
    // 伐採完了（木こりが呼び出す）
    completeHarvest(tile) {
        if (!tile || tile.type !== 'forest') return;
        
        // タイルを草地に変更
        tile.type = 'grass';
        
        // 古いメッシュを削除
        this.scene.remove(tile.mesh);
        
        // 新しい草地タイルを作成
        const builder = window.game.useRealisticMode ? window.game.realisticBuilder : window.game.voxelBuilder;
        tile.mesh = builder.createGroundTile('grass', tile.x, tile.z);
        this.scene.add(tile.mesh);
        
        // 伐採エフェクト
        const particles = [];
        for (let i = 0; i < 10; i++) {
            const particleGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
            const particleMaterial = new THREE.MeshStandardMaterial({
                color: 0x8B4513,
                emissive: 0x8B4513,
                emissiveIntensity: 0.2
            });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.position.set(
                tile.x + (Math.random() - 0.5) * 0.5,
                1 + Math.random() * 0.5,
                tile.z + (Math.random() - 0.5) * 0.5
            );
            particle.velocity = {
                x: (Math.random() - 0.5) * 0.2,
                y: Math.random() * 0.3,
                z: (Math.random() - 0.5) * 0.2
            };
            this.scene.add(particle);
            particles.push(particle);
        }
        
        // パーティクルアニメーション
        let animationTime = 0;
        const animate = () => {
            animationTime += 0.016;
            let allFinished = true;
            
            particles.forEach(p => {
                if (p.position.y > 0.1) {
                    p.position.x += p.velocity.x * 0.016;
                    p.position.y += p.velocity.y * 0.016;
                    p.position.z += p.velocity.z * 0.016;
                    p.velocity.y -= 0.5 * 0.016; // 重力
                    p.rotation.x += 0.1;
                    p.rotation.y += 0.1;
                    allFinished = false;
                }
            });
            
            if (!allFinished && animationTime < 2) {
                requestAnimationFrame(animate);
            } else {
                particles.forEach(p => this.scene.remove(p));
            }
        };
        animate();
        
        logGameEvent('伐採完了', {
            position: { x: tile.x, z: tile.z }
        });
    }
    
    // 資源確保エリアをマーク
    markResourceArea(tile) {
        if (!tile || !['forest', 'stone'].includes(tile.type)) return;
        
        // 資源マーカーを表示
        const markerGeometry = new THREE.RingGeometry(0.3, 0.4, 4);
        const markerMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00FF00,
            side: THREE.DoubleSide
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.rotation.x = -Math.PI / 2;
        marker.position.set(tile.x, 0.1, tile.z);
        marker.name = `resource_marker_${tile.x}_${tile.z}`;
        this.scene.add(marker);
        
        // タイルに資源マークを追加
        tile.resourceMarked = true;
        
        logGameEvent('資源エリア指定', {
            position: { x: tile.x, z: tile.z },
            type: tile.type
        });
    }
    
    // 農地を作成
    createFarmZone(x, z) {
        const tile = this.getTileAt(x, z);
        if (!tile || tile.occupied || !['grass', 'dirt'].includes(tile.type)) {
            return false;
        }
        
        // タイルを農地に変更
        tile.type = 'dirt';
        tile.farmReady = true;
        
        // 古いメッシュを削除
        this.scene.remove(tile.mesh);
        
        // 農地タイルを作成
        const builder = window.game.useRealisticMode ? window.game.realisticBuilder : window.game.voxelBuilder;
        tile.mesh = builder.createGroundTile('dirt', tile.x, tile.z);
        this.scene.add(tile.mesh);
        
        // 農地マーカーを追加
        const markerGeometry = new THREE.PlaneGeometry(0.9, 0.9);
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: 0x8B4513,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.rotation.x = -Math.PI / 2;
        marker.position.set(tile.x, 0.05, tile.z);
        marker.name = `farm_marker_${tile.x}_${tile.z}`;
        this.scene.add(marker);
        
        logGameEvent('農地作成', {
            position: { x: tile.x, z: tile.z }
        });
        
        return true;
    }
    
    // 整地対象をマーク
    markForClearing(tile) {
        if (!tile || !['forest', 'stone'].includes(tile.type)) return;
        
        // 整地マーカーを表示（×印）
        const markerGroup = new THREE.Group();
        
        // ×印の線を作成
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xFF0000, linewidth: 3 });
        
        const line1Geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-0.3, 0.1, -0.3),
            new THREE.Vector3(0.3, 0.1, 0.3)
        ]);
        const line1 = new THREE.Line(line1Geometry, lineMaterial);
        
        const line2Geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-0.3, 0.1, 0.3),
            new THREE.Vector3(0.3, 0.1, -0.3)
        ]);
        const line2 = new THREE.Line(line2Geometry, lineMaterial);
        
        markerGroup.add(line1);
        markerGroup.add(line2);
        markerGroup.position.set(tile.x, 0, tile.z);
        markerGroup.name = `clear_marker_${tile.x}_${tile.z}`;
        this.scene.add(markerGroup);
        
        // タイルに整地マークを追加
        tile.clearingMarked = true;
        
        // 整地タスクを作成
        const clearingTask = {
            id: `clear_${Date.now()}`,
            type: 'clear_area',
            position: { x: tile.x, z: tile.z },
            tile: tile,
            assigned: false
        };
        
        // グローバル変数として公開（建築家が見つけられるように）
        if (!window.clearingTasks) {
            window.clearingTasks = [];
        }
        window.clearingTasks.push(clearingTask);
        
        logGameEvent('整地エリア指定', {
            position: { x: tile.x, z: tile.z },
            type: tile.type
        });
    }
}