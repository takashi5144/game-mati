// ゲーム設定とバランスパラメータ
const GAME_CONFIG = {
    // マップ設定
    MAP: {
        WIDTH: 30,
        HEIGHT: 30,
        TILE_SIZE: 1,
        TILE_HEIGHT: 0.1
    },

    // カメラ設定
    CAMERA: {
        POSITION: { x: 20, y: 25, z: 20 },
        LOOK_AT: { x: 15, y: 0, z: 15 },
        FRUSTUM_SIZE: 35
    },

    // 畑の状態
    FARM_STATES: {
        BARREN: { id: 'barren', name: '荒地', duration: 0 },
        TILLED: { id: 'tilled', name: '耕された畑', duration: 2 },
        SEEDED: { id: 'seeded', name: '種がまかれた畑', duration: 2 },
        WATERED: { id: 'watered', name: '水やり済みの畑', duration: 3 },
        SPROUTED: { id: 'sprouted', name: '芽が出た畑', duration: 5 },
        GROWING_EARLY: { id: 'growing_early', name: '成長初期の畑', duration: 5 },
        GROWING_MID: { id: 'growing_mid', name: '成長中期の畑', duration: 5 },
        READY: { id: 'ready', name: '収穫可能な畑', duration: 0 }
    },

    // 建物の定義
    BUILDINGS: {
        FARM: {
            id: 'farm',
            name: '畑',
            icon: '🌱',
            cost: { wood: 10, money: 0 },
            buildTime: 3,
            size: { width: 2, height: 2 },
            production: { food: 5 },
            productionInterval: 10,
            requiredWorker: 'farmer',
            color: 0x8B4513
        },
        HOUSE: {
            id: 'house',
            name: '家',
            icon: '🏠',
            cost: { wood: 20, money: 100 },
            buildTime: 5,
            size: { width: 2, height: 2 },
            populationIncrease: 2,
            color: 0xA0522D
        },
        LUMBERMILL: {
            id: 'lumbermill',
            name: '製材所',
            icon: '🪚',
            cost: { wood: 30, money: 200 },
            buildTime: 8,
            size: { width: 3, height: 3 },
            production: { wood: 3 },
            productionInterval: 15,
            requiredWorker: 'lumberjack',
            color: 0x654321
        }
    },

    // 住民の職業
    PROFESSIONS: {
        none: {
            name: '無職',
            icon: '🧑',
            workPlace: null,
            moveSpeed: 0.04,
            workDuration: 0,
            color: 0x808080  // グレー
        },
        farmer: {
            name: '農夫',
            icon: '👨‍🌾',
            workPlace: 'farm',
            moveSpeed: 0.05,
            workDuration: 5,
            color: 0x00FF00  // 明るい緑
        },
        builder: {
            name: '建築家',
            icon: '👷',
            workPlace: 'construction',
            moveSpeed: 0.04,
            workDuration: 3,
            color: 0xFFA500  // オレンジ
        },
        lumberjack: {
            name: '木こり',
            icon: '🪓',
            workPlace: 'lumbermill',
            moveSpeed: 0.045,
            workDuration: 6,
            color: 0xFF0000  // 赤
        }
    },

    // 初期リソース
    INITIAL_RESOURCES: {
        food: 100,
        wood: 50,
        money: 1000,
        seeds: {
            potato: 10
        },
        tools: {
            wateringCan: 1
        }
    },
    
    // 種の種類
    SEED_TYPES: {
        potato: {
            name: 'ジャガイモの種',
            growthTime: 15,
            production: 8,
            color: 0xDEB887
        }
    },

    // ゲームスピード設定
    GAME_SPEED: {
        PAUSED: 0,
        NORMAL: 1,
        FAST: 2,
        VERY_FAST: 3
    },

    // 季節設定
    SEASONS: {
        SPRING: { name: '春', duration: 30, color: 0x90EE90 },
        SUMMER: { name: '夏', duration: 30, color: 0x87CEEB },
        AUTUMN: { name: '秋', duration: 30, color: 0xFFA500 },
        WINTER: { name: '冬', duration: 30, color: 0xF0F8FF }
    },

    // タイルタイプ
    TILE_TYPES: {
        GRASS: { id: 'grass', name: '草地', color: 0x228B22, buildable: true },
        DIRT: { id: 'dirt', name: '土', color: 0x8B4513, buildable: true },
        WATER: { id: 'water', name: '水', color: 0x4169E1, buildable: false },
        FOREST: { id: 'forest', name: '森', color: 0x228B22, buildable: false }
    },

    // ピクセルアート設定
    VOXEL: {
        SCALE: 0.9, // ボクセル間の隙間を作るためのスケール
        TEXTURE_SIZE: 16 // テクスチャの解像度
    },

    // ライティング設定
    LIGHTING: {
        AMBIENT: {
            color: 0xffffff,
            intensity: 0.4
        },
        DIRECTIONAL: {
            color: 0xffffff,
            intensity: 1.0,
            position: { x: 10, y: 15, z: 10 }
        },
        SPOT: {
            color: 0xffffff,
            intensity: 0.5,
            angle: Math.PI / 6,
            penumbra: 0.1,
            decay: 2,
            distance: 30
        }
    },

    // デバッグ設定
    DEBUG: {
        SHOW_GRID: true,
        SHOW_PATHFINDING: false,
        CONSOLE_EVENTS: true
    }
};

// ゲームイベントのログ出力関数
function logGameEvent(eventType, details) {
    if (GAME_CONFIG.DEBUG.CONSOLE_EVENTS) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] ${eventType}:`, details);
    }
}