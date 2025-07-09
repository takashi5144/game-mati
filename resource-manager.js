// リソース管理クラス
class ResourceManager {
    constructor() {
        this.resources = {
            food: GAME_CONFIG.INITIAL_RESOURCES.food,
            wood: GAME_CONFIG.INITIAL_RESOURCES.wood,
            money: GAME_CONFIG.INITIAL_RESOURCES.money,
            harvested: {} // 収穫した作物を保存
        };
        
        this.population = 0;
        this.maxPopulation = 10; // 初期の人口上限を10に設定
        
        this.setupEventListeners();
        this.updateUI();
    }

    setupEventListeners() {
        // 建物配置イベント
        window.addEventListener('buildingPlaced', (event) => {
            const { type, x, z } = event.detail;
            this.handleBuildingPlacement(type, x, z);
        });
        
        // 人口増加イベント
        window.addEventListener('populationIncrease', (event) => {
            this.maxPopulation += event.detail.amount;
            this.updateUI();
            logGameEvent('人口上限増加', { 
                amount: event.detail.amount,
                newMax: this.maxPopulation 
            });
        });
        
        // 資源生産イベント
        window.addEventListener('resourceProduced', (event) => {
            const { resources, building } = event.detail;
            this.addResources(resources);
            logGameEvent('資源生産', { 
                resources: resources,
                building: building.type,
                position: { x: building.x, z: building.z }
            });
        });
    }

    handleBuildingPlacement(buildingType, x, z) {
        const config = GAME_CONFIG.BUILDINGS[buildingType.toUpperCase()];
        if (!config) return;
        
        // コストをチェック
        if (!this.canAfford(config.cost)) {
            this.showNotification('資源が不足しています！', 'error');
            logGameEvent('建設失敗', { reason: '資源不足', type: buildingType });
            return;
        }
        
        // GameWorldに建設を依頼
        const building = window.gameWorld.placeBuilding(x, z, buildingType);
        if (building) {
            // コストを消費
            this.consumeResources(config.cost);
            this.showNotification(`${config.name}の建設を開始しました`, 'success');
            
            // 建築家を生成して割り当て（人口に余裕がある場合）
            if (this.population < this.maxPopulation) {
                const spawnPos = this.findSpawnPosition();
                const builder = window.residentAI.createResident('builder', spawnPos);
                this.population++;
                this.updateUI();
            }
        }
    }

    canAfford(cost) {
        for (const [resource, amount] of Object.entries(cost)) {
            if (this.resources[resource] < amount) {
                return false;
            }
        }
        return true;
    }
    
    consumeResources(cost) {
        for (const [resource, amount] of Object.entries(cost)) {
            this.resources[resource] -= amount;
        }
        this.updateUI();
    }

    addResources(additions) {
        for (const [resource, amount] of Object.entries(additions)) {
            this.resources[resource] = (this.resources[resource] || 0) + amount;
        }
        this.updateUI();
    }

    findSpawnPosition() {
        // マップの中心付近のランダムな位置
        const mapSize = window.gameWorld ? window.gameWorld.mapSize : GAME_CONFIG.MAP.WIDTH;
        const centerX = mapSize / 2;
        const centerZ = mapSize / 2;
        
        return {
            x: centerX + (Math.random() - 0.5) * 4,
            z: centerZ + (Math.random() - 0.5) * 4
        };
    }

    updateUI() {
        // リソース表示を更新
        document.getElementById('food-count').textContent = `食料: ${Math.floor(this.resources.food)}`;
        document.getElementById('wood-count').textContent = `木材: ${Math.floor(this.resources.wood)}`;
        document.getElementById('money-count').textContent = `資金: ${Math.floor(this.resources.money)}`;
        document.getElementById('population-count').textContent = `人口: ${this.population}/${this.maxPopulation}`;
        
        // ボタンの有効/無効を更新
        this.updateButtonStates();
    }

    updateButtonStates() {
        // 各建物のボタンの状態を更新
        Object.entries(GAME_CONFIG.BUILDINGS).forEach(([key, config]) => {
            const btn = document.getElementById(`btn-${key.toLowerCase()}`);
            if (btn) {
                const canBuild = this.canAfford(config.cost);
                btn.style.opacity = canBuild ? '1' : '0.5';
                btn.style.cursor = canBuild ? 'pointer' : 'not-allowed';
                
                // ツールチップを更新
                const costText = Object.entries(config.cost)
                    .map(([res, amt]) => `${res}: ${amt}`)
                    .join(', ');
                btn.title = `${config.name} (${costText})`;
            }
        });
        
        // マップ拡張ボタンの状態を更新
        const expandBtn = document.getElementById('btn-expand-map');
        if (expandBtn) {
            const expandCost = { money: 500, wood: 50 };
            const canExpand = this.canAfford(expandCost);
            expandBtn.style.opacity = canExpand ? '1' : '0.5';
            expandBtn.style.cursor = canExpand ? 'pointer' : 'not-allowed';
        }
    }

    showNotification(message, type = 'info') {
        // 簡易的な通知表示
        const notification = document.createElement('div');
        notification.className = 'notification ' + type;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: ${type === 'error' ? '#ff4444' : '#44ff44'};
            color: white;
            padding: 20px 40px;
            border-radius: 10px;
            font-size: 18px;
            z-index: 1000;
            animation: fadeIn 0.3s ease-in-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease-in-out';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 2000);
    }

    // ゲームループで呼ばれる更新処理
    update(deltaTime) {
        // 食料消費（人口に応じて）
        if (this.population > 0) {
            this.resources.food -= this.population * 0.1 * deltaTime;
            
            // 食料が尽きた場合の処理
            if (this.resources.food < 0) {
                this.resources.food = 0;
                // TODO: 住民の幸福度低下などのペナルティ
            }
        }
        
        // 資金の自動増加は削除（作物売却のみで増やす）
        
        this.updateUI();
    }
    
    // 作物を売却
    sellCrops(cropId, amount) {
        const harvestedAmount = this.resources.harvested[cropId] || 0;
        const sellAmount = Math.min(amount, harvestedAmount);
        
        if (sellAmount <= 0) return 0;
        
        // 作物の価格を計算（仮の価格設定）
        const cropPrices = {
            wheat: 50,
            tomato: 80,
            potato: 60
        };
        
        const price = cropPrices[cropId] || 50;
        const totalPrice = price * sellAmount;
        
        // 売却処理
        this.resources.harvested[cropId] -= sellAmount;
        this.resources.money += totalPrice;
        
        logGameEvent('作物売却', {
            crop: cropId,
            amount: sellAmount,
            price: totalPrice
        });
        
        this.updateUI();
        return totalPrice;
    }
    
    // すべての作物を売却
    sellAllCrops() {
        let totalPrice = 0;
        
        Object.keys(this.resources.harvested).forEach(cropId => {
            const amount = this.resources.harvested[cropId];
            if (amount > 0) {
                totalPrice += this.sellCrops(cropId, amount);
            }
        });
        
        return totalPrice;
    }

    // 住民を生成
    spawnResident(profession) {
        if (this.population >= this.maxPopulation) {
            this.showNotification('人口が上限に達しています！家を建ててください', 'error');
            return null;
        }
        
        const spawnPos = this.findSpawnPosition();
        const resident = window.residentAI.createResident(profession, spawnPos);
        this.population++;
        this.updateUI();
        
        return resident;
    }

    // ゲーム統計を取得
    getStats() {
        return {
            resources: { ...this.resources },
            population: this.population,
            maxPopulation: this.maxPopulation,
            buildings: window.gameWorld ? window.gameWorld.buildings.size : 0,
            residents: window.residentAI ? window.residentAI.residents.size : 0
        };
    }
}

// アニメーションスタイルを追加
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
    
    @keyframes fadeOut {
        from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        to { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
    }
`;
document.head.appendChild(style);