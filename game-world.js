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
                
                // 川を作る
                if ((x === 10 && z >= 5 && z <= 15) || 
                    (z === 10 && x >= 5 && x <= 15)) {
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
            if (!building.isComplete || !building.config.production || !building.worker) return;
            
            building.productionTimer += deltaTime;
            
            // 畑の作物成長アニメーション
            if (building.type === 'farm') {
                if (!building.growthStage) building.growthStage = 0;
                building.growthStage = Math.min(1.0, building.growthStage + deltaTime / building.config.productionInterval);
                
                // 作物の成長を視覚的に更新
                this.updateFarmGrowth(building);
            }
            
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
                
                // 収穫エフェクト
                if (building.type === 'farm') {
                    const particles = this.voxelBuilder.createParticleEffect('harvest', {
                        x: building.x,
                        y: 0.5,
                        z: building.z
                    });
                    particles.forEach(p => this.scene.add(p));
                    
                    setTimeout(() => {
                        particles.forEach(p => this.scene.remove(p));
                    }, 1000);
                    
                    // 作物をリセット
                    building.growthStage = 0;
                }
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
        }
    }

    handleClick(x, z) {
        if (this.buildMode === 'demolish') {
            this.demolishBuilding(x, z);
            this.setBuildMode(null);
        } else if (this.buildMode && this.buildMode !== 'demolish') {
            const event = new CustomEvent('buildingPlaced', { 
                detail: { 
                    type: this.buildMode,
                    x: x,
                    z: z
                } 
            });
            window.dispatchEvent(event);
        } else {
            this.selectTile(x, z);
        }
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
}