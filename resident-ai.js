// 住民AIクラス
class ResidentAI {
    constructor(scene, voxelBuilder, gameWorld) {
        this.scene = scene;
        this.voxelBuilder = voxelBuilder;
        this.gameWorld = gameWorld;
        this.residents = new Map();
        this.residentId = 0;
    }

    createResident(profession = 'none', spawnPosition) {
        const id = `resident_${this.residentId++}`;
        const mesh = this.voxelBuilder.createCharacter(profession);
        mesh.position.set(spawnPosition.x, 0, spawnPosition.z);
        this.scene.add(mesh);
        
        // メッシュにIDを保存（クリック検出用）
        mesh.userData.residentId = id;
        mesh.userData.type = 'resident';
        
        const resident = {
            id: id,
            name: `住民${this.residentId}`,
            profession: profession,
            mesh: mesh,
            position: { x: spawnPosition.x, z: spawnPosition.z },
            target: null,
            workplace: null,
            state: 'idle',
            stateTimer: 0,
            path: [],
            pathIndex: 0,
            workProgress: 0,
            energy: 100,
            seedWarningShown: false,
            waterWarningShown: false,
            currentTool: null, // 現在持っている農具
            hasSeeds: false, // 種を持っているか
            hasWater: false // 水を持っているか
        };
        
        this.residents.set(id, resident);
        
        logGameEvent('住民誕生', { 
            profession: profession, 
            id: id,
            name: resident.name,
            position: spawnPosition 
        });
        
        return resident;
    }

    update(deltaTime) {
        this.residents.forEach(resident => {
            switch (resident.state) {
                case 'idle':
                    this.updateIdle(resident, deltaTime);
                    break;
                case 'moving':
                    this.updateMoving(resident, deltaTime);
                    break;
                case 'working':
                    this.updateWorking(resident, deltaTime);
                    break;
            }
        });
    }

    updateIdle(resident, deltaTime) {
        resident.stateTimer += deltaTime;
        
        // アイドルアニメーション（上下に揺れる）
        resident.mesh.position.y = Math.sin(resident.stateTimer * 2) * 0.05;
        
        // エネルギー回復
        if (resident.energy < 100) {
            resident.energy = Math.min(100, resident.energy + deltaTime * 5);
        }
        
        // 仕事を探す（職業がある場合のみ）
        if (resident.stateTimer > 2 && resident.profession !== 'none') {
            resident.stateTimer = 0;
            this.findWork(resident);
        }
    }

    updateMoving(resident, deltaTime) {
        if (!resident.path || resident.path.length === 0) {
            resident.state = 'idle';
            return;
        }
        
        const speed = GAME_CONFIG.PROFESSIONS[resident.profession].moveSpeed;
        const target = resident.path[resident.pathIndex];
        
        // 目標地点への方向を計算
        const dx = target.x - resident.position.x;
        const dz = target.z - resident.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance < 0.1) {
            // 次のウェイポイントへ
            resident.pathIndex++;
            if (resident.pathIndex >= resident.path.length) {
                // 目的地に到着
                resident.pathIndex = 0;
                resident.path = [];
                
                // onArrivalコールバックがあれば実行
                if (resident.onArrival) {
                    resident.onArrival();
                    resident.onArrival = null;
                } else {
                    // 通常の作業開始
                    resident.state = 'working';
                    if (resident.workplace) {
                        resident.workplace.worker = resident;
                    }
                }
            }
        } else {
            // 移動
            const moveX = (dx / distance) * speed;
            const moveZ = (dz / distance) * speed;
            
            resident.position.x += moveX;
            resident.position.z += moveZ;
            resident.mesh.position.x = resident.position.x;
            resident.mesh.position.z = resident.position.z;
            
            // 歩行アニメーション
            resident.mesh.position.y = Math.abs(Math.sin(resident.stateTimer * 10)) * 0.1;
            resident.stateTimer += deltaTime;
            
            // 進行方向を向く
            resident.mesh.lookAt(
                new THREE.Vector3(target.x, resident.mesh.position.y, target.z)
            );
        }
    }

    updateWorking(resident, deltaTime) {
        if (!resident.workplace) {
            resident.state = 'idle';
            return;
        }
        
        const workDuration = GAME_CONFIG.PROFESSIONS[resident.profession].workDuration;
        resident.workProgress += deltaTime;
        
        // 警告フラグをリセット（リソースが補充された場合のため）
        if (window.resourceManager) {
            if (window.resourceManager.hasSeeds('potato')) {
                resident.seedWarningShown = false;
            }
            if (window.resourceManager.wateringCanFilled) {
                resident.waterWarningShown = false;
            }
        }
        
        // 作業アニメーション
        if (resident.profession === 'farmer') {
            // 農作業（上下運動）
            resident.mesh.position.y = Math.abs(Math.sin(resident.workProgress * 3)) * 0.2;
            
            // 畑の状態に応じた作業
            if (resident.workplace && resident.workplace.type === 'farm' && resident.workplace.isComplete) {
                this.updateFarmWork(resident, resident.workplace, deltaTime);
            }
        } else if (resident.profession === 'builder') {
            // 建築作業（ハンマーを振る動き）
            const armRight = resident.mesh.children.find(child => 
                child.position.x > 0 && child.position.y < 0.6
            );
            if (armRight) {
                armRight.rotation.z = Math.sin(resident.workProgress * 5) * 0.5;
            }
        }
        
        // 建築家の場合は建設を進める
        if (resident.profession === 'builder' && !resident.workplace.isComplete) {
            this.gameWorld.updateBuildingProgress(resident.workplace.id, deltaTime);
        }
        
        // 作業完了チェック
        if (resident.workProgress >= workDuration) {
            resident.workProgress = 0;
            
            // 建築家は建設が完了したら次の仕事を探す
            if (resident.profession === 'builder' && resident.workplace.isComplete) {
                resident.workplace.worker = null;
                resident.workplace = null;
                resident.state = 'idle';
            }
            
            // 農夫は畑が収穫済みになったら次の仕事を探す
            if (resident.profession === 'farmer' && resident.workplace.farmState === 'BARREN' && resident.workplace.stateTimer > 2) {
                // 新しい畑を探す（他に作業可能な畑がある場合）
                const farms = this.gameWorld.getAvailableBuildings('farm');
                if (farms.length > 0) {
                    resident.workplace.worker = null;
                    resident.workplace = null;
                    resident.state = 'idle';
                }
            }
        }
    }

    findWork(resident) {
        if (resident.profession === 'farmer') {
            // 農夫は畑を探す（作業者がいない畑、または自分が作業中の畑）
            const allFarms = [];
            this.gameWorld.buildings.forEach(building => {
                if (building.type === 'farm' && building.isComplete) {
                    // 作業者がいない、または自分が作業中の畑
                    if (!building.worker || building.worker.id === resident.id) {
                        allFarms.push(building);
                    }
                }
            });
            
            if (allFarms.length > 0) {
                // 最も近い畑を選択
                const nearestFarm = this.findNearestBuilding(resident, allFarms);
                if (nearestFarm) {
                    this.assignWork(resident, nearestFarm);
                }
            }
        } else if (resident.profession === 'builder') {
            // 建築家は建設サイトを探す
            const sites = this.gameWorld.getConstructionSites();
            if (sites.length > 0) {
                const nearestSite = this.findNearestBuilding(resident, sites);
                if (nearestSite) {
                    this.assignWork(resident, nearestSite);
                }
            }
        } else if (resident.profession === 'lumberjack') {
            // 木こりは製材所を探す
            const lumbermills = this.gameWorld.getAvailableBuildings('lumbermill');
            if (lumbermills.length > 0) {
                const nearestMill = this.findNearestBuilding(resident, lumbermills);
                if (nearestMill) {
                    this.assignWork(resident, nearestMill);
                }
            }
        }
    }

    findNearestBuilding(resident, buildings) {
        let nearest = null;
        let minDistance = Infinity;
        
        buildings.forEach(building => {
            const dx = building.x - resident.position.x;
            const dz = building.z - resident.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance < minDistance) {
                minDistance = distance;
                nearest = building;
            }
        });
        
        return nearest;
    }
    
    // 納屋を見つける
    findBarn() {
        let barn = null;
        this.gameWorld.buildings.forEach(building => {
            if (building.type === 'barn' && building.isComplete) {
                barn = building;
            }
        });
        return barn;
    }

    assignWork(resident, workplace) {
        resident.workplace = workplace;
        resident.target = { x: workplace.x, z: workplace.z };
        
        // 簡単な経路探索（直線移動）
        resident.path = this.findPath(resident.position, resident.target);
        resident.pathIndex = 0;
        resident.state = 'moving';
        
        logGameEvent('仕事割り当て', { 
            resident: resident.id,
            profession: resident.profession,
            workplace: workplace.type,
            position: { x: workplace.x, z: workplace.z }
        });
    }

    findPath(start, end) {
        // 簡単な直線経路（将来的にはA*アルゴリズムなどに拡張可能）
        const path = [];
        const steps = 10;
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            path.push({
                x: start.x + (end.x - start.x) * t,
                z: start.z + (end.z - start.z) * t
            });
        }
        
        return path;
    }

    getResidentCount() {
        return this.residents.size;
    }

    getResidentsByProfession(profession) {
        const filtered = [];
        this.residents.forEach(resident => {
            if (resident.profession === profession) {
                filtered.push(resident);
            }
        });
        return filtered;
    }

    removeResident(residentId) {
        const resident = this.residents.get(residentId);
        if (!resident) return;
        
        // メッシュを削除
        this.scene.remove(resident.mesh);
        
        // 職場から解放
        if (resident.workplace) {
            resident.workplace.worker = null;
        }
        
        this.residents.delete(residentId);
        
        logGameEvent('住民削除', { id: residentId });
    }

    changeProfession(residentId, newProfession) {
        const resident = this.residents.get(residentId);
        if (!resident) return false;
        
        // 現在の職場から離れる
        if (resident.workplace) {
            resident.workplace.worker = null;
            resident.workplace = null;
        }
        
        // 職業を変更
        const oldProfession = resident.profession;
        resident.profession = newProfession;
        
        // 外見を更新
        this.scene.remove(resident.mesh);
        resident.mesh = this.voxelBuilder.createCharacter(newProfession);
        resident.mesh.position.set(resident.position.x, 0, resident.position.z);
        resident.mesh.userData.residentId = residentId;
        resident.mesh.userData.type = 'resident';
        this.scene.add(resident.mesh);
        
        // 状態をリセット
        resident.state = 'idle';
        resident.target = null;
        resident.path = [];
        resident.pathIndex = 0;
        resident.workProgress = 0;
        
        logGameEvent('職業変更', { 
            residentId: residentId,
            name: resident.name,
            oldProfession: oldProfession,
            newProfession: newProfession
        });
        
        return true;
    }

    getResident(residentId) {
        return this.residents.get(residentId);
    }
    
    // 畑の状態に応じた作業
    updateFarmWork(resident, farm, deltaTime) {
        // 大文字に変換してから取得
        const stateKey = farm.farmState ? farm.farmState.toUpperCase() : 'BARREN';
        const stateConfig = GAME_CONFIG.FARM_STATES[stateKey];
        
        if (!stateConfig) {
            console.error(`No state config for farm state: ${farm.farmState} (key: ${stateKey})`);
            return;
        }
        
        // stateTimerが未定義の場合は初期化
        if (farm.stateTimer === undefined) {
            farm.stateTimer = 0;
        }
        
        farm.stateTimer += deltaTime;
        
        // 現在の状態に応じた処理（大文字小文字の問題を回避）
        const farmStateUpper = farm.farmState ? farm.farmState.toUpperCase() : 'BARREN';
        switch(farmStateUpper) {
            case 'BARREN':
                // 荒地を耕す（鍬が必要）
                if (!resident.currentTool || resident.currentTool !== 'hoe') {
                    // 納屋に鍬を取りに行く
                    this.goToBarnForTool(resident, 'hoe');
                    return;
                }
                if (farm.stateTimer >= 2) {
                    this.gameWorld.changeFarmState(farm, 'TILLED');
                    this.createWorkEffect(farm, 'till');
                }
                break;
                
            case 'TILLED':
                // 種をまく（種が必要）
                if (!resident.hasSeeds) {
                    // 納屋に種を取りに行く
                    this.goToBarnForTool(resident, 'seeds');
                    return;
                }
                if (farm.stateTimer >= stateConfig.duration) {
                    if (window.resourceManager && window.resourceManager.hasSeeds('potato')) {
                        window.resourceManager.useSeeds('potato');
                        resident.hasSeeds = false; // 種を使った
                        this.gameWorld.changeFarmState(farm, 'SEEDED');
                        this.createWorkEffect(farm, 'seed');
                        logGameEvent('種まき完了', {
                            farmId: farm.id,
                            position: { x: farm.x, z: farm.z },
                            remainingSeeds: window.resourceManager.resources.seeds.potato
                        });
                        if (window.game) {
                            window.game.showNotification('種まき完了！', 'success');
                        }
                    } else {
                        // 種がない場合は待機（作業場所は保持）
                        farm.stateTimer = 0; // タイマーをリセットして再試行を促す
                        if (window.game && !resident.seedWarningShown) {
                            window.game.showNotification('種が不足しています！', 'error');
                            resident.seedWarningShown = true;
                        }
                    }
                }
                break;
                
            case 'SEEDED':
                // 水やり（じょうろに水が必要）
                if (!resident.currentTool || resident.currentTool !== 'wateringCan' || !resident.hasWater) {
                    // 納屋にじょうろを取りに行くか、水を汲みに行く
                    if (!resident.currentTool || resident.currentTool !== 'wateringCan') {
                        this.goToBarnForTool(resident, 'wateringCan');
                    } else {
                        this.goToRiverForWater(resident);
                    }
                    return;
                }
                if (farm.stateTimer >= stateConfig.duration) {
                    resident.hasWater = false; // 水を使った
                    this.gameWorld.changeFarmState(farm, 'WATERED');
                    this.createWorkEffect(farm, 'water');
                }
                break;
                
            case 'WATERED':
                // 芽が出るのを待つ
                if (farm.stateTimer >= stateConfig.duration) {
                    this.gameWorld.changeFarmState(farm, 'SPROUTED');
                }
                break;
                
            case 'SPROUTED':
                // 成長を見守る（毎日水が必要）
                if (window.resourceManager && window.resourceManager.wateringCanFilled) {
                    window.resourceManager.useWateringCan();
                    this.createWorkEffect(farm, 'water');
                    if (farm.stateTimer >= stateConfig.duration) {
                        this.gameWorld.changeFarmState(farm, 'GROWING_EARLY');
                    }
                } else {
                    // 水がない場合は成長が止まる（作業場所は保持）
                    if (window.game && !resident.waterWarningShown) {
                        window.game.showNotification('成長中の作物に水が必要です！', 'error');
                        resident.waterWarningShown = true;
                    }
                }
                break;
                
            case 'GROWING_EARLY':
                // 成長中期へ（毎日水が必要）
                if (window.resourceManager && window.resourceManager.wateringCanFilled) {
                    window.resourceManager.useWateringCan();
                    this.createWorkEffect(farm, 'water');
                    if (farm.stateTimer >= stateConfig.duration) {
                        this.gameWorld.changeFarmState(farm, 'GROWING_MID');
                    }
                } else {
                    resident.state = 'idle';
                    resident.workplace = null;
                    if (window.game) {
                        window.game.showNotification('成長中の作物に水が必要です！', 'error');
                    }
                }
                break;
                
            case 'GROWING_MID':
                // 収穫可能へ（毎日水が必要）
                if (window.resourceManager && window.resourceManager.wateringCanFilled) {
                    window.resourceManager.useWateringCan();
                    this.createWorkEffect(farm, 'water');
                    if (farm.stateTimer >= stateConfig.duration) {
                        this.gameWorld.changeFarmState(farm, 'READY');
                    }
                } else {
                    resident.state = 'idle';
                    resident.workplace = null;
                    if (window.game) {
                        window.game.showNotification('成長中の作物に水が必要です！', 'error');
                    }
                }
                break;
                
            case 'READY':
                // 収穫する
                if (farm.stateTimer >= 1) {
                    // 収穫処理
                    const event = new CustomEvent('resourceProduced', {
                        detail: {
                            resources: { food: farm.config.production.food },
                            building: farm
                        }
                    });
                    window.dispatchEvent(event);
                    
                    // 畑を荒地に戻す
                    this.gameWorld.changeFarmState(farm, 'BARREN');
                    this.createWorkEffect(farm, 'harvest');
                    
                    logGameEvent('収穫完了', {
                        farmId: farm.id,
                        production: farm.config.production.food,
                        position: { x: farm.x, z: farm.z }
                    });
                }
                break;
        }
    }
    
    // 作業エフェクトを作成
    createWorkEffect(building, type) {
        let particles = [];
        
        switch(type) {
            case 'till':
                // 土ぼこりエフェクト
                for (let i = 0; i < 5; i++) {
                    const particle = this.voxelBuilder.createParticleEffect('build', {
                        x: building.x + Math.random() * 2 - 1,
                        y: 0.5,
                        z: building.z + Math.random() * 2 - 1
                    });
                    particles = particles.concat(particle);
                }
                break;
                
            case 'seed':
                // 種まきエフェクト（小さな黄色い粒子）
                for (let i = 0; i < 3; i++) {
                    const particle = this.voxelBuilder.createParticleEffect('harvest', {
                        x: building.x + Math.random() * 2 - 1,
                        y: 0.3,
                        z: building.z + Math.random() * 2 - 1
                    });
                    particles = particles.concat(particle);
                }
                break;
                
            case 'water':
                // 水やりエフェクト（青い粒子）
                for (let i = 0; i < 8; i++) {
                    const waterDrop = this.createWaterDroplet(
                        building.x + Math.random() * 2 - 1,
                        1.5,
                        building.z + Math.random() * 2 - 1
                    );
                    particles.push(waterDrop);
                }
                break;
                
            case 'harvest':
                // 収穫エフェクト
                particles = this.voxelBuilder.createParticleEffect('harvest', {
                    x: building.x,
                    y: 1,
                    z: building.z
                });
                break;
        }
        
        // パーティクルをシーンに追加
        particles.forEach(p => this.scene.add(p));
        
        // 一定時間後に削除
        setTimeout(() => {
            particles.forEach(p => this.scene.remove(p));
        }, 1500);
    }
    
    // 水滴を作成
    createWaterDroplet(x, y, z) {
        const geometry = new THREE.SphereGeometry(0.05, 6, 6);
        const material = new THREE.MeshStandardMaterial({
            color: 0x4169E1,
            transparent: true,
            opacity: 0.7,
            emissive: 0x4169E1,
            emissiveIntensity: 0.2
        });
        const droplet = new THREE.Mesh(geometry, material);
        droplet.position.set(x, y, z);
        
        // 落下アニメーション用のユーザーデータ
        droplet.userData = {
            velocity: {
                x: (Math.random() - 0.5) * 0.1,
                y: -0.3,
                z: (Math.random() - 0.5) * 0.1
            },
            lifetime: 1.5
        };
        
        return droplet;
    }
    
    // 納屋に道具を取りに行く
    goToBarnForTool(resident, toolType) {
        const barn = this.findBarn();
        if (!barn) {
            if (window.game) {
                window.game.showNotification('納屋が必要です！', 'error');
            }
            return;
        }
        
        // 現在の作業場所を保存
        const savedWorkplace = resident.workplace;
        
        // 納屋に移動
        resident.target = { x: barn.x, z: barn.z };
        resident.path = this.findPath(resident.position, resident.target);
        resident.pathIndex = 0;
        resident.state = 'moving';
        
        // 納屋に到着したら道具を取得
        resident.onArrival = () => {
            switch(toolType) {
                case 'hoe':
                    resident.currentTool = 'hoe';
                    if (window.game) {
                        window.game.showNotification(`${resident.name}が鍬を取得しました`, 'success');
                    }
                    break;
                case 'wateringCan':
                    resident.currentTool = 'wateringCan';
                    if (window.game) {
                        window.game.showNotification(`${resident.name}がじょうろを取得しました`, 'success');
                    }
                    break;
                case 'seeds':
                    if (window.resourceManager && window.resourceManager.hasSeeds('potato')) {
                        resident.hasSeeds = true;
                        if (window.game) {
                            window.game.showNotification(`${resident.name}が種を取得しました`, 'success');
                        }
                    }
                    break;
            }
            
            // 元の作業場所に戻る
            resident.workplace = savedWorkplace;
            if (savedWorkplace) {
                resident.target = { x: savedWorkplace.x, z: savedWorkplace.z };
                resident.path = this.findPath(resident.position, resident.target);
                resident.pathIndex = 0;
                resident.state = 'moving';
            }
        };
    }
    
    // 川に水を汲みに行く
    goToRiverForWater(resident) {
        // 川のタイルを探す
        let riverTile = null;
        let minDistance = Infinity;
        
        this.gameWorld.tiles.forEach(tile => {
            if (tile.type === 'water') {
                const dx = tile.x - resident.position.x;
                const dz = tile.z - resident.position.z;
                const distance = Math.sqrt(dx * dx + dz * dz);
                
                if (distance < minDistance) {
                    minDistance = distance;
                    riverTile = tile;
                }
            }
        });
        
        if (!riverTile) {
            return;
        }
        
        // 現在の作業場所を保存
        const savedWorkplace = resident.workplace;
        
        // 川に移動
        resident.target = { x: riverTile.x, z: riverTile.z };
        resident.path = this.findPath(resident.position, resident.target);
        resident.pathIndex = 0;
        resident.state = 'moving';
        
        // 川に到着したら水を汲む
        resident.onArrival = () => {
            resident.hasWater = true;
            this.gameWorld.createWaterFillEffect(riverTile.x, riverTile.z);
            if (window.game) {
                window.game.showNotification(`${resident.name}が水を汲みました`, 'success');
            }
            
            // 元の作業場所に戻る
            resident.workplace = savedWorkplace;
            if (savedWorkplace) {
                resident.target = { x: savedWorkplace.x, z: savedWorkplace.z };
                resident.path = this.findPath(resident.position, resident.target);
                resident.pathIndex = 0;
                resident.state = 'moving';
            }
        };
    }
}