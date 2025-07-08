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
            energy: 100
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
                resident.state = 'working';
                resident.pathIndex = 0;
                resident.path = [];
                
                if (resident.workplace) {
                    resident.workplace.worker = resident;
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
        
        // 作業アニメーション
        if (resident.profession === 'farmer') {
            // 農作業（上下運動）
            resident.mesh.position.y = Math.abs(Math.sin(resident.workProgress * 3)) * 0.2;
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
        }
    }

    findWork(resident) {
        if (resident.profession === 'farmer') {
            // 農夫は畑を探す
            const farms = this.gameWorld.getAvailableBuildings('farm');
            if (farms.length > 0) {
                // 最も近い畑を選択
                const nearestFarm = this.findNearestBuilding(resident, farms);
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
}