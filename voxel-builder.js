// Voxelアート風の3Dオブジェクト生成クラス
class VoxelBuilder {
    constructor() {
        this.materials = new Map();
        this.textures = new Map();
        this.geometries = {
            cube: new THREE.BoxGeometry(1, 1, 1)
        };
    }

    // ピクセルアート風のマテリアルを作成
    createVoxelMaterial(color, emissive = 0x000000) {
        const key = `${color}_${emissive}`;
        if (this.materials.has(key)) {
            return this.materials.get(key);
        }

        const material = new THREE.MeshLambertMaterial({
            color: color,
            emissive: emissive,
            emissiveIntensity: 0.1
        });
        
        this.materials.set(key, material);
        return material;
    }

    // ピクセルテクスチャを生成
    createPixelTexture(size, pixelData) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const pixelSize = 1;
        pixelData.forEach((row, y) => {
            row.forEach((color, x) => {
                if (color) {
                    ctx.fillStyle = color;
                    ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                }
            });
        });

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        return texture;
    }

    // 基本的なボクセルブロックを作成
    createVoxel(color, position = {x: 0, y: 0, z: 0}, scale = 1) {
        const material = this.createVoxelMaterial(color);
        const mesh = new THREE.Mesh(this.geometries.cube, material);
        
        mesh.position.set(position.x, position.y, position.z);
        mesh.scale.setScalar(scale * GAME_CONFIG.VOXEL.SCALE);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        return mesh;
    }

    // 地面タイルを作成
    createGroundTile(tileType, x, z) {
        const group = new THREE.Group();
        const tileConfig = GAME_CONFIG.TILE_TYPES[tileType.toUpperCase()];
        
        // ベースタイル
        const base = this.createVoxel(
            tileConfig.color,
            { x: 0, y: -GAME_CONFIG.MAP.TILE_HEIGHT / 2, z: 0 }
        );
        base.scale.y = GAME_CONFIG.MAP.TILE_HEIGHT;
        group.add(base);

        // 草地の場合は草の装飾を追加
        if (tileType === 'grass') {
            for (let i = 0; i < 3; i++) {
                const grassBlade = this.createVoxel(
                    0x00FF00,
                    {
                        x: (Math.random() - 0.5) * 0.8,
                        y: GAME_CONFIG.MAP.TILE_HEIGHT / 2 + 0.05,
                        z: (Math.random() - 0.5) * 0.8
                    },
                    0.1
                );
                grassBlade.scale.y = 0.2;
                group.add(grassBlade);
            }
        }

        // 森の場合は木を追加
        if (tileType === 'forest') {
            const tree = this.createTree();
            tree.position.y = GAME_CONFIG.MAP.TILE_HEIGHT / 2;
            group.add(tree);
        }

        group.position.set(x, 0, z);
        group.userData = { tileType: tileType, x: x, z: z };
        
        return group;
    }

    // 木を作成
    createTree() {
        const group = new THREE.Group();
        
        // 幹
        const trunk = this.createVoxel(0x8B4513, { x: 0, y: 0.5, z: 0 });
        trunk.scale.set(0.3, 1, 0.3);
        group.add(trunk);

        // 葉
        const leavesPositions = [
            { x: 0, y: 1.2, z: 0, scale: 0.8 },
            { x: 0.3, y: 1, z: 0, scale: 0.6 },
            { x: -0.3, y: 1, z: 0, scale: 0.6 },
            { x: 0, y: 1, z: 0.3, scale: 0.6 },
            { x: 0, y: 1, z: -0.3, scale: 0.6 },
            { x: 0, y: 1.5, z: 0, scale: 0.4 }
        ];

        leavesPositions.forEach(pos => {
            const leaves = this.createVoxel(0x228B22, pos, pos.scale);
            group.add(leaves);
        });

        return group;
    }

    // 建物を作成
    createBuilding(buildingType) {
        const group = new THREE.Group();
        const config = GAME_CONFIG.BUILDINGS[buildingType.toUpperCase()];
        
        if (buildingType === 'farm') {
            // 畑のベース
            const base = this.createVoxel(0x8B4513, { x: 0, y: 0.05, z: 0 });
            base.scale.set(config.size.width, 0.1, config.size.height);
            group.add(base);

            // 作物の列
            for (let x = -0.5; x <= 0.5; x += 0.5) {
                for (let z = -0.5; z <= 0.5; z += 0.5) {
                    const crop = this.createVoxel(0x90EE90, { x: x, y: 0.2, z: z }, 0.2);
                    crop.scale.y = 0.4;
                    group.add(crop);
                }
            }
        } else if (buildingType === 'house') {
            // 家の土台
            const foundation = this.createVoxel(0x808080, { x: 0, y: 0.25, z: 0 });
            foundation.scale.set(config.size.width, 0.5, config.size.height);
            group.add(foundation);

            // 壁
            const walls = this.createVoxel(config.color, { x: 0, y: 1, z: 0 });
            walls.scale.set(config.size.width * 0.9, 1.5, config.size.height * 0.9);
            group.add(walls);

            // 屋根
            const roof = this.createVoxel(0x8B0000, { x: 0, y: 2, z: 0 });
            roof.scale.set(config.size.width * 1.1, 0.8, config.size.height * 1.1);
            group.add(roof);

            // ドア
            const door = this.createVoxel(0x654321, { x: 0, y: 0.8, z: config.size.height * 0.45 });
            door.scale.set(0.3, 0.8, 0.1);
            group.add(door);

            // 窓
            const window1 = this.createVoxel(0x87CEEB, { x: config.size.width * 0.3, y: 1.2, z: config.size.height * 0.45 });
            window1.scale.set(0.2, 0.3, 0.1);
            group.add(window1);
        } else if (buildingType === 'lumbermill') {
            // 製材所のベース
            const base = this.createVoxel(0x696969, { x: 0, y: 0.25, z: 0 });
            base.scale.set(config.size.width, 0.5, config.size.height);
            group.add(base);

            // 建物本体
            const building = this.createVoxel(config.color, { x: 0, y: 1, z: 0 });
            building.scale.set(config.size.width * 0.8, 1.5, config.size.height * 0.8);
            group.add(building);

            // 煙突
            const chimney = this.createVoxel(0x2F4F4F, { x: config.size.width * 0.3, y: 2, z: 0 });
            chimney.scale.set(0.3, 1, 0.3);
            group.add(chimney);

            // 木材の山
            for (let i = 0; i < 3; i++) {
                const log = this.createVoxel(0x8B4513, { 
                    x: -config.size.width * 0.4, 
                    y: 0.3 + i * 0.2, 
                    z: (i - 1) * 0.3 
                });
                log.scale.set(0.8, 0.2, 0.2);
                group.add(log);
            }
        }

        group.userData = { buildingType: buildingType, config: config };
        return group;
    }

    // キャラクター（住民）を作成
    createCharacter(profession) {
        const group = new THREE.Group();
        const profConfig = GAME_CONFIG.PROFESSIONS[profession];
        
        // 体
        const body = this.createVoxel(profConfig.color, { x: 0, y: 0.4, z: 0 });
        body.scale.set(0.3, 0.5, 0.2);
        group.add(body);

        // 頭
        const head = this.createVoxel(0xFFDBBB, { x: 0, y: 0.8, z: 0 });
        head.scale.set(0.25, 0.25, 0.25);
        group.add(head);

        // 腕
        const armLeft = this.createVoxel(profConfig.color, { x: -0.2, y: 0.4, z: 0 });
        armLeft.scale.set(0.1, 0.3, 0.1);
        group.add(armLeft);

        const armRight = this.createVoxel(profConfig.color, { x: 0.2, y: 0.4, z: 0 });
        armRight.scale.set(0.1, 0.3, 0.1);
        group.add(armRight);

        // 脚
        const legLeft = this.createVoxel(0x000080, { x: -0.1, y: 0.1, z: 0 });
        legLeft.scale.set(0.1, 0.3, 0.1);
        group.add(legLeft);

        const legRight = this.createVoxel(0x000080, { x: 0.1, y: 0.1, z: 0 });
        legRight.scale.set(0.1, 0.3, 0.1);
        group.add(legRight);

        // 職業別の装飾
        if (profession === 'farmer') {
            // 麦わら帽子
            const hat = this.createVoxel(0xF4A460, { x: 0, y: 0.95, z: 0 });
            hat.scale.set(0.35, 0.05, 0.35);
            group.add(hat);
        } else if (profession === 'builder') {
            // ヘルメット
            const helmet = this.createVoxel(0xFFFF00, { x: 0, y: 0.95, z: 0 });
            helmet.scale.set(0.3, 0.15, 0.3);
            group.add(helmet);
        }

        group.userData = { profession: profession };
        return group;
    }

    // 建設中の建物を作成
    createConstructionSite(buildingType, progress) {
        const group = new THREE.Group();
        const config = GAME_CONFIG.BUILDINGS[buildingType.toUpperCase()];
        
        // 土台
        const foundation = this.createVoxel(0x808080, { x: 0, y: 0.05, z: 0 });
        foundation.scale.set(config.size.width, 0.1, config.size.height);
        group.add(foundation);

        // 建設進捗に応じて足場を表示
        const scaffoldHeight = 2 * progress;
        if (scaffoldHeight > 0) {
            // 足場の柱
            const positions = [
                { x: -config.size.width/2, z: -config.size.height/2 },
                { x: config.size.width/2, z: -config.size.height/2 },
                { x: -config.size.width/2, z: config.size.height/2 },
                { x: config.size.width/2, z: config.size.height/2 }
            ];

            positions.forEach(pos => {
                const pole = this.createVoxel(0xDEB887, { x: pos.x, y: scaffoldHeight/2, z: pos.z });
                pole.scale.set(0.1, scaffoldHeight, 0.1);
                group.add(pole);
            });

            // 建設中の建物（部分的）
            if (progress > 0.3) {
                const partialBuilding = this.createBuilding(buildingType);
                partialBuilding.scale.y = progress;
                partialBuilding.children.forEach(child => {
                    child.material = child.material.clone();
                    child.material.opacity = 0.7;
                    child.material.transparent = true;
                });
                group.add(partialBuilding);
            }
        }

        group.userData = { buildingType: buildingType, progress: progress };
        return group;
    }

    // 選択カーソルを作成
    createSelectionCursor() {
        const group = new THREE.Group();
        
        // 四隅のマーカー
        const corners = [
            { x: -0.5, z: -0.5 },
            { x: 0.5, z: -0.5 },
            { x: -0.5, z: 0.5 },
            { x: 0.5, z: 0.5 }
        ];

        corners.forEach(corner => {
            const marker = this.createVoxel(0xFFFF00, { x: corner.x, y: 0.1, z: corner.z }, 0.1);
            marker.scale.y = 0.2;
            group.add(marker);
        });

        return group;
    }

    // パーティクルエフェクトを作成
    createParticleEffect(type, position) {
        const particles = [];
        
        if (type === 'harvest') {
            // 収穫エフェクト
            for (let i = 0; i < 5; i++) {
                const particle = this.createVoxel(0xFFD700, {
                    x: position.x + (Math.random() - 0.5) * 0.5,
                    y: position.y + Math.random() * 0.5,
                    z: position.z + (Math.random() - 0.5) * 0.5
                }, 0.1);
                particle.userData = {
                    velocity: {
                        x: (Math.random() - 0.5) * 0.1,
                        y: Math.random() * 0.2,
                        z: (Math.random() - 0.5) * 0.1
                    },
                    lifetime: 1.0
                };
                particles.push(particle);
            }
        } else if (type === 'build') {
            // 建設エフェクト
            for (let i = 0; i < 3; i++) {
                const particle = this.createVoxel(0xDDDDDD, {
                    x: position.x + (Math.random() - 0.5) * 0.3,
                    y: position.y,
                    z: position.z + (Math.random() - 0.5) * 0.3
                }, 0.05);
                particle.userData = {
                    velocity: {
                        x: 0,
                        y: Math.random() * 0.1,
                        z: 0
                    },
                    lifetime: 0.5
                };
                particles.push(particle);
            }
        }

        return particles;
    }
}