// リアルな3Dオブジェクト生成クラス
class RealisticBuilder {
    constructor() {
        this.materials = new Map();
        this.textureLoader = new THREE.TextureLoader();
        this.loadedTextures = new Map();
    }

    // リアルなマテリアルを作成
    createRealisticMaterial(options) {
        const key = JSON.stringify(options);
        if (this.materials.has(key)) {
            return this.materials.get(key);
        }

        const materialOptions = {
            color: options.color || 0xffffff,
            roughness: options.roughness || 0.7,
            metalness: options.metalness || 0.0,
        };

        // テクスチャがある場合は適用
        if (options.textureUrl) {
            const texture = this.loadTexture(options.textureUrl);
            materialOptions.map = texture;
        }

        const material = new THREE.MeshStandardMaterial(materialOptions);
        this.materials.set(key, material);
        return material;
    }

    // テクスチャをロード（ダミー実装）
    loadTexture(url) {
        if (!this.loadedTextures.has(url)) {
            // 実際のテクスチャロードの代わりに、プロシージャルテクスチャを生成
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            
            // テクスチャタイプに応じて異なるパターンを生成
            if (url.includes('wood')) {
                this.generateWoodTexture(ctx, canvas.width, canvas.height);
            } else if (url.includes('grass')) {
                this.generateGrassTexture(ctx, canvas.width, canvas.height);
            } else if (url.includes('stone')) {
                this.generateStoneTexture(ctx, canvas.width, canvas.height);
            } else if (url.includes('soil')) {
                this.generateSoilTexture(ctx, canvas.width, canvas.height);
            }
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            this.loadedTextures.set(url, texture);
        }
        return this.loadedTextures.get(url);
    }

    // 木目テクスチャを生成
    generateWoodTexture(ctx, width, height) {
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, '#8B4513');
        gradient.addColorStop(0.3, '#A0522D');
        gradient.addColorStop(0.5, '#8B4513');
        gradient.addColorStop(0.7, '#A0522D');
        gradient.addColorStop(1, '#8B4513');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // 木目の線を追加
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        for (let i = 0; i < height; i += 20) {
            ctx.beginPath();
            ctx.moveTo(0, i + Math.sin(i * 0.1) * 10);
            ctx.lineTo(width, i + Math.sin(i * 0.1) * 10);
            ctx.stroke();
        }
    }

    // 草テクスチャを生成
    generateGrassTexture(ctx, width, height) {
        ctx.fillStyle = '#228B22';
        ctx.fillRect(0, 0, width, height);
        
        // ランダムな草の葉を描画
        for (let i = 0; i < 1000; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const shade = Math.random() * 0.3 + 0.7;
            ctx.strokeStyle = `rgba(34, 139, 34, ${shade})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.random() * 4 - 2, y - Math.random() * 8);
            ctx.stroke();
        }
    }

    // 石テクスチャを生成
    generateStoneTexture(ctx, width, height) {
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, width, height);
        
        // ノイズを追加
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = Math.random() * 30 + 10;
            const shade = Math.random() * 0.3 + 0.7;
            ctx.fillStyle = `rgba(128, 128, 128, ${shade})`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 土テクスチャを生成
    generateSoilTexture(ctx, width, height) {
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(0, 0, width, height);
        
        // ランダムな土の粒子
        for (let i = 0; i < 2000; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const shade = Math.random() * 0.5 + 0.5;
            ctx.fillStyle = `rgba(139, 69, 19, ${shade})`;
            ctx.fillRect(x, y, 2, 2);
        }
    }

    // 地面タイルを作成
    createGroundTile(tileType, x, z) {
        const group = new THREE.Group();
        const tileConfig = GAME_CONFIG.TILE_TYPES[tileType.toUpperCase()];
        
        // リアルな地面
        const geometry = new THREE.PlaneGeometry(GAME_CONFIG.MAP.TILE_SIZE, GAME_CONFIG.MAP.TILE_SIZE);
        geometry.rotateX(-Math.PI / 2);
        
        let material;
        if (tileType === 'grass') {
            material = this.createRealisticMaterial({
                color: 0x3a7d3a,
                textureUrl: 'grass',
                roughness: 0.8
            });
        } else if (tileType === 'dirt') {
            material = this.createRealisticMaterial({
                color: 0x8B4513,
                textureUrl: 'soil',
                roughness: 0.9
            });
        } else if (tileType === 'water') {
            material = this.createRealisticMaterial({
                color: 0x006994,
                roughness: 0.1,
                metalness: 0.8
            });
        } else {
            material = this.createRealisticMaterial({
                color: tileConfig.color,
                roughness: 0.7
            });
        }
        
        const ground = new THREE.Mesh(geometry, material);
        ground.receiveShadow = true;
        group.add(ground);

        // 草地の場合は草を追加
        if (tileType === 'grass') {
            for (let i = 0; i < 5; i++) {
                const grassBlade = this.createGrassBlade();
                grassBlade.position.set(
                    (Math.random() - 0.5) * 0.8,
                    0,
                    (Math.random() - 0.5) * 0.8
                );
                grassBlade.rotation.y = Math.random() * Math.PI * 2;
                group.add(grassBlade);
            }
        }

        // 森の場合は木を追加
        if (tileType === 'forest') {
            const tree = this.createRealisticTree();
            tree.position.y = 0;
            group.add(tree);
        }

        group.position.set(x, 0, z);
        group.userData = { tileType: tileType, x: x, z: z };
        
        return group;
    }

    // 草の葉を作成
    createGrassBlade() {
        const geometry = new THREE.ConeGeometry(0.02, 0.2, 4);
        const material = this.createRealisticMaterial({
            color: 0x3a7d3a,
            roughness: 0.7
        });
        const blade = new THREE.Mesh(geometry, material);
        blade.position.y = 0.1;
        return blade;
    }

    // リアルな木を作成
    createRealisticTree() {
        const group = new THREE.Group();
        
        // 幹（円柱）
        const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
        const trunkMaterial = this.createRealisticMaterial({
            color: 0x8B4513,
            textureUrl: 'wood',
            roughness: 0.9
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 1;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        group.add(trunk);

        // 葉（複数の球体）
        const leafMaterial = this.createRealisticMaterial({
            color: 0x228B22,
            roughness: 0.8
        });
        
        const leafPositions = [
            { x: 0, y: 2.5, z: 0, scale: 1.2 },
            { x: 0.5, y: 2.2, z: 0, scale: 0.8 },
            { x: -0.5, y: 2.2, z: 0, scale: 0.8 },
            { x: 0, y: 2.2, z: 0.5, scale: 0.8 },
            { x: 0, y: 2.2, z: -0.5, scale: 0.8 },
        ];

        leafPositions.forEach(pos => {
            const leafGeometry = new THREE.SphereGeometry(pos.scale * 0.6, 8, 6);
            const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
            leaf.position.set(pos.x, pos.y, pos.z);
            leaf.castShadow = true;
            leaf.receiveShadow = true;
            group.add(leaf);
        });

        return group;
    }

    // リアルな建物を作成
    createBuilding(buildingType, growthStage = 1.0) {
        const group = new THREE.Group();
        const config = GAME_CONFIG.BUILDINGS[buildingType.toUpperCase()];
        
        if (buildingType === 'farm') {
            // 畑のベース
            const baseGeometry = new THREE.BoxGeometry(config.size.width, 0.1, config.size.height);
            const baseMaterial = this.createRealisticMaterial({
                color: 0x8B4513,
                textureUrl: 'soil',
                roughness: 0.9
            });
            const base = new THREE.Mesh(baseGeometry, baseMaterial);
            base.position.y = 0.05;
            base.receiveShadow = true;
            group.add(base);

            // 畝（うね）
            for (let i = -1; i <= 1; i++) {
                const ridgeGeometry = new THREE.BoxGeometry(config.size.width * 0.9, 0.15, 0.3);
                const ridge = new THREE.Mesh(ridgeGeometry, baseMaterial);
                ridge.position.set(0, 0.075, i * 0.6);
                ridge.receiveShadow = true;
                group.add(ridge);
            }

            // 作物
            if (growthStage > 0) {
                const cropMaterial = this.createRealisticMaterial({
                    color: growthStage < 0.5 ? 0x90EE90 : (growthStage < 0.8 ? 0x7CFC00 : 0xFFD700),
                    roughness: 0.6
                });
                
                for (let x = -3; x <= 3; x++) {
                    for (let z = -1; z <= 1; z++) {
                        const cropHeight = 0.1 + (growthStage * 0.5);
                        const cropGeometry = new THREE.CylinderGeometry(0.05, 0.05, cropHeight, 6);
                        const crop = new THREE.Mesh(cropGeometry, cropMaterial);
                        crop.position.set(x * 0.25, 0.15 + cropHeight/2, z * 0.6);
                        crop.castShadow = true;
                        group.add(crop);
                    }
                }
            }
        } else if (buildingType === 'house') {
            // 土台
            const foundationGeometry = new THREE.BoxGeometry(config.size.width, 0.3, config.size.height);
            const foundationMaterial = this.createRealisticMaterial({
                color: 0x808080,
                textureUrl: 'stone',
                roughness: 0.9
            });
            const foundation = new THREE.Mesh(foundationGeometry, foundationMaterial);
            foundation.position.y = 0.15;
            foundation.castShadow = true;
            foundation.receiveShadow = true;
            group.add(foundation);

            // 壁
            const wallMaterial = this.createRealisticMaterial({
                color: 0xD2B48C,
                textureUrl: 'wood',
                roughness: 0.7
            });
            
            // 前後の壁
            const wallFrontGeometry = new THREE.BoxGeometry(config.size.width, 1.5, 0.1);
            const wallFront = new THREE.Mesh(wallFrontGeometry, wallMaterial);
            wallFront.position.set(0, 1.05, config.size.height/2);
            wallFront.castShadow = true;
            wallFront.receiveShadow = true;
            group.add(wallFront);
            
            const wallBack = wallFront.clone();
            wallBack.position.z = -config.size.height/2;
            group.add(wallBack);
            
            // 左右の壁
            const wallSideGeometry = new THREE.BoxGeometry(0.1, 1.5, config.size.height);
            const wallLeft = new THREE.Mesh(wallSideGeometry, wallMaterial);
            wallLeft.position.set(-config.size.width/2, 1.05, 0);
            wallLeft.castShadow = true;
            wallLeft.receiveShadow = true;
            group.add(wallLeft);
            
            const wallRight = wallLeft.clone();
            wallRight.position.x = config.size.width/2;
            group.add(wallRight);

            // 屋根
            const roofGeometry = new THREE.ConeGeometry(config.size.width * 0.7, 0.8, 4);
            roofGeometry.rotateY(Math.PI / 4);
            const roofMaterial = this.createRealisticMaterial({
                color: 0x8B0000,
                roughness: 0.8
            });
            const roof = new THREE.Mesh(roofGeometry, roofMaterial);
            roof.position.y = 2.2;
            roof.castShadow = true;
            roof.receiveShadow = true;
            group.add(roof);

            // ドア
            const doorGeometry = new THREE.BoxGeometry(0.4, 0.8, 0.15);
            const doorMaterial = this.createRealisticMaterial({
                color: 0x654321,
                textureUrl: 'wood',
                roughness: 0.6
            });
            const door = new THREE.Mesh(doorGeometry, doorMaterial);
            door.position.set(0, 0.7, config.size.height/2);
            door.castShadow = true;
            group.add(door);

            // 窓
            const windowGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.15);
            const windowMaterial = this.createRealisticMaterial({
                color: 0x87CEEB,
                roughness: 0.1,
                metalness: 0.5
            });
            const window1 = new THREE.Mesh(windowGeometry, windowMaterial);
            window1.position.set(config.size.width * 0.3, 1.2, config.size.height/2);
            window1.castShadow = true;
            group.add(window1);
            
            const window2 = window1.clone();
            window2.position.x = -config.size.width * 0.3;
            group.add(window2);
        } else if (buildingType === 'lumbermill') {
            // 製材所の土台
            const baseGeometry = new THREE.BoxGeometry(config.size.width, 0.4, config.size.height);
            const baseMaterial = this.createRealisticMaterial({
                color: 0x696969,
                textureUrl: 'stone',
                roughness: 0.9
            });
            const base = new THREE.Mesh(baseGeometry, baseMaterial);
            base.position.y = 0.2;
            base.castShadow = true;
            base.receiveShadow = true;
            group.add(base);

            // 建物本体
            const buildingGeometry = new THREE.BoxGeometry(config.size.width * 0.8, 2, config.size.height * 0.8);
            const buildingMaterial = this.createRealisticMaterial({
                color: 0x8B4513,
                textureUrl: 'wood',
                roughness: 0.8
            });
            const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
            building.position.y = 1.2;
            building.castShadow = true;
            building.receiveShadow = true;
            group.add(building);

            // 屋根
            const roofGeometry = new THREE.BoxGeometry(config.size.width * 0.9, 0.3, config.size.height * 0.9);
            const roofMaterial = this.createRealisticMaterial({
                color: 0x4B4B4B,
                roughness: 0.7
            });
            const roof = new THREE.Mesh(roofGeometry, roofMaterial);
            roof.position.y = 2.35;
            roof.castShadow = true;
            roof.receiveShadow = true;
            group.add(roof);

            // 煙突
            const chimneyGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 8);
            const chimneyMaterial = this.createRealisticMaterial({
                color: 0x2F4F4F,
                roughness: 0.8
            });
            const chimney = new THREE.Mesh(chimneyGeometry, chimneyMaterial);
            chimney.position.set(config.size.width * 0.3, 2.75, 0);
            chimney.castShadow = true;
            chimney.receiveShadow = true;
            group.add(chimney);

            // 木材の山
            const logMaterial = this.createRealisticMaterial({
                color: 0x8B4513,
                textureUrl: 'wood',
                roughness: 0.9
            });
            
            for (let i = 0; i < 5; i++) {
                const logGeometry = new THREE.CylinderGeometry(0.15, 0.15, 1.5, 8);
                logGeometry.rotateZ(Math.PI / 2);
                const log = new THREE.Mesh(logGeometry, logMaterial);
                log.position.set(-config.size.width * 0.4, 0.5 + i * 0.2, (i - 2) * 0.3);
                log.castShadow = true;
                log.receiveShadow = true;
                group.add(log);
            }
        }

        group.userData = { buildingType: buildingType, config: config };
        return group;
    }

    // リアルなキャラクターを作成
    createCharacter(profession) {
        const group = new THREE.Group();
        const profConfig = GAME_CONFIG.PROFESSIONS[profession];
        
        // 体（カプセル形状）
        const bodyGeometry = new THREE.CapsuleGeometry(0.15, 0.5, 4, 8);
        const bodyMaterial = this.createRealisticMaterial({
            color: profConfig.color,
            roughness: 0.8
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.5;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        // 頭
        const headGeometry = new THREE.SphereGeometry(0.15, 8, 6);
        const headMaterial = this.createRealisticMaterial({
            color: 0xFFDBBB,
            roughness: 0.7
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 0.9;
        head.castShadow = true;
        head.receiveShadow = true;
        group.add(head);

        // 腕
        const armGeometry = new THREE.CapsuleGeometry(0.05, 0.3, 4, 8);
        const armMaterial = bodyMaterial.clone();
        
        const armLeft = new THREE.Mesh(armGeometry, armMaterial);
        armLeft.position.set(-0.2, 0.5, 0);
        armLeft.rotation.z = Math.PI / 8;
        armLeft.castShadow = true;
        group.add(armLeft);

        const armRight = new THREE.Mesh(armGeometry, armMaterial);
        armRight.position.set(0.2, 0.5, 0);
        armRight.rotation.z = -Math.PI / 8;
        armRight.castShadow = true;
        group.add(armRight);

        // 脚
        const legGeometry = new THREE.CapsuleGeometry(0.06, 0.35, 4, 8);
        const legMaterial = this.createRealisticMaterial({
            color: 0x000080,
            roughness: 0.8
        });
        
        const legLeft = new THREE.Mesh(legGeometry, legMaterial);
        legLeft.position.set(-0.1, 0.2, 0);
        legLeft.castShadow = true;
        group.add(legLeft);

        const legRight = new THREE.Mesh(legGeometry, legMaterial);
        legRight.position.set(0.1, 0.2, 0);
        legRight.castShadow = true;
        group.add(legRight);

        // 職業別の装飾
        if (profession === 'farmer') {
            // 麦わら帽子
            const hatGeometry = new THREE.CylinderGeometry(0.25, 0.2, 0.05, 8);
            const hatMaterial = this.createRealisticMaterial({
                color: 0xF4A460,
                roughness: 0.9
            });
            const hat = new THREE.Mesh(hatGeometry, hatMaterial);
            hat.position.y = 1.05;
            hat.castShadow = true;
            group.add(hat);
        } else if (profession === 'builder') {
            // ヘルメット
            const helmetGeometry = new THREE.SphereGeometry(0.18, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
            const helmetMaterial = this.createRealisticMaterial({
                color: 0xFFFF00,
                roughness: 0.3,
                metalness: 0.2
            });
            const helmet = new THREE.Mesh(helmetGeometry, helmetMaterial);
            helmet.position.y = 1.02;
            helmet.castShadow = true;
            group.add(helmet);
        } else if (profession === 'lumberjack') {
            // 斧を持たせる
            const axeHandleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6);
            const axeHandleMaterial = this.createRealisticMaterial({
                color: 0x8B4513,
                textureUrl: 'wood',
                roughness: 0.8
            });
            const axeHandle = new THREE.Mesh(axeHandleGeometry, axeHandleMaterial);
            axeHandle.position.set(0.25, 0.5, 0);
            axeHandle.rotation.z = -Math.PI / 6;
            axeHandle.castShadow = true;
            group.add(axeHandle);
            
            const axeBladeGeometry = new THREE.BoxGeometry(0.1, 0.15, 0.02);
            const axeBladeMaterial = this.createRealisticMaterial({
                color: 0x808080,
                roughness: 0.2,
                metalness: 0.8
            });
            const axeBlade = new THREE.Mesh(axeBladeGeometry, axeBladeMaterial);
            axeBlade.position.set(0.35, 0.7, 0);
            axeBlade.rotation.z = -Math.PI / 6;
            axeBlade.castShadow = true;
            group.add(axeBlade);
        }

        // 顔の特徴（目）
        const eyeGeometry = new THREE.SphereGeometry(0.02, 4, 4);
        const eyeMaterial = this.createRealisticMaterial({
            color: 0x000000,
            roughness: 0.1
        });
        
        const eyeLeft = new THREE.Mesh(eyeGeometry, eyeMaterial);
        eyeLeft.position.set(-0.05, 0.92, 0.13);
        group.add(eyeLeft);
        
        const eyeRight = new THREE.Mesh(eyeGeometry, eyeMaterial);
        eyeRight.position.set(0.05, 0.92, 0.13);
        group.add(eyeRight);

        group.userData = { profession: profession, type: 'resident' };
        return group;
    }

    // 建設中の建物を作成
    createConstructionSite(buildingType, progress) {
        const group = new THREE.Group();
        const config = GAME_CONFIG.BUILDINGS[buildingType.toUpperCase()];
        
        // 土台
        const foundationGeometry = new THREE.BoxGeometry(config.size.width, 0.1, config.size.height);
        const foundationMaterial = this.createRealisticMaterial({
            color: 0x808080,
            textureUrl: 'stone',
            roughness: 0.9
        });
        const foundation = new THREE.Mesh(foundationGeometry, foundationMaterial);
        foundation.position.y = 0.05;
        foundation.receiveShadow = true;
        group.add(foundation);

        // 足場
        const scaffoldMaterial = this.createRealisticMaterial({
            color: 0xDEB887,
            textureUrl: 'wood',
            roughness: 0.9
        });
        
        const scaffoldHeight = 2.5 * progress;
        if (scaffoldHeight > 0) {
            // 足場の柱
            const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, scaffoldHeight, 6);
            const positions = [
                { x: -config.size.width/2, z: -config.size.height/2 },
                { x: config.size.width/2, z: -config.size.height/2 },
                { x: -config.size.width/2, z: config.size.height/2 },
                { x: config.size.width/2, z: config.size.height/2 }
            ];

            positions.forEach(pos => {
                const pole = new THREE.Mesh(poleGeometry, scaffoldMaterial);
                pole.position.set(pos.x, scaffoldHeight/2, pos.z);
                pole.castShadow = true;
                pole.receiveShadow = true;
                group.add(pole);
            });

            // 横板
            if (progress > 0.3) {
                const plankGeometry = new THREE.BoxGeometry(config.size.width, 0.05, 0.2);
                for (let h = 0.5; h < scaffoldHeight; h += 0.5) {
                    const plank = new THREE.Mesh(plankGeometry, scaffoldMaterial);
                    plank.position.y = h;
                    plank.castShadow = true;
                    plank.receiveShadow = true;
                    group.add(plank);
                }
            }

            // 建設中の建物（部分的）
            if (progress > 0.3) {
                const partialBuilding = this.createBuilding(buildingType);
                partialBuilding.scale.y = progress;
                partialBuilding.children.forEach(child => {
                    if (child.material) {
                        child.material = child.material.clone();
                        child.material.opacity = 0.8;
                        child.material.transparent = true;
                    }
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
        
        // 光る輪
        const ringGeometry = new THREE.TorusGeometry(0.5, 0.05, 8, 16);
        const ringMaterial = this.createRealisticMaterial({
            color: 0xFFFF00,
            emissive: 0xFFFF00,
            emissiveIntensity: 0.5,
            roughness: 0.3
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.1;
        group.add(ring);

        return group;
    }

    // パーティクルエフェクトを作成
    createParticleEffect(type, position) {
        const particles = [];
        
        if (type === 'harvest') {
            // 収穫エフェクト（光る粒子）
            const particleGeometry = new THREE.SphereGeometry(0.05, 6, 6);
            const particleMaterial = this.createRealisticMaterial({
                color: 0xFFD700,
                emissive: 0xFFD700,
                emissiveIntensity: 0.8,
                roughness: 0.2
            });
            
            for (let i = 0; i < 8; i++) {
                const particle = new THREE.Mesh(particleGeometry, particleMaterial.clone());
                particle.position.set(
                    position.x + (Math.random() - 0.5) * 0.5,
                    position.y + Math.random() * 0.5,
                    position.z + (Math.random() - 0.5) * 0.5
                );
                particle.userData = {
                    velocity: {
                        x: (Math.random() - 0.5) * 0.15,
                        y: Math.random() * 0.3 + 0.1,
                        z: (Math.random() - 0.5) * 0.15
                    },
                    lifetime: 1.5
                };
                particles.push(particle);
            }
        } else if (type === 'build') {
            // 建設エフェクト（煙）
            const smokeGeometry = new THREE.SphereGeometry(0.1, 6, 6);
            const smokeMaterial = this.createRealisticMaterial({
                color: 0xCCCCCC,
                opacity: 0.7,
                transparent: true,
                roughness: 1.0
            });
            
            for (let i = 0; i < 5; i++) {
                const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial.clone());
                smoke.position.set(
                    position.x + (Math.random() - 0.5) * 0.3,
                    position.y,
                    position.z + (Math.random() - 0.5) * 0.3
                );
                smoke.userData = {
                    velocity: {
                        x: (Math.random() - 0.5) * 0.05,
                        y: Math.random() * 0.1 + 0.05,
                        z: (Math.random() - 0.5) * 0.05
                    },
                    lifetime: 2.0
                };
                particles.push(smoke);
            }
        }

        return particles;
    }
}