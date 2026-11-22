/**
 * Atmosphere 3D - Ultra-Realistic Three.js Weather Visualization Engine
 * Inspired by Google Stitch Raytraced Glassmorphism Reference (stitch_3d_hero.jpg)
 *
 * Weather Environments:
 * - ☀️ Sunny: Radiant golden metallic sun with rotating coronal rays and solar flares
 * - 🌧️ Rainy: Frosted glass cloud with glowing cyan teardrop raindrops & splash effects
 * - ⛈️ Thunderstorm: Dark atmospheric storm clouds with procedural 3D lightning bursts
 * - ❄️ Snowy: Translucent cloud with 250+ fluttering crystalline snowflakes
 * - ☁️ Cloudy / Partly Cloudy: Multi-billow volumetric frosted glass cloud with subsurface scattering
 * - 🌅 Sunset: Golden hour amber sun with rose-gold ambient rim lighting
 * - 🌙 Night: Cratered 3D Moon with lunar halo & deep space cosmic starfield
 */

(function (window) {
    'use strict';

    function Weather3D(containerId, options) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Weather3D: Container element not found:', containerId);
            return;
        }

        this.options = Object.assign({
            initialCondition: 'partly_cloudy',
            isDay: true,
            isSunset: false,
            interactive: true,
            autoRotate: true,
            autoRotateSpeed: 0.4
        }, options || {});

        this.currentCondition = this.options.initialCondition;
        this.isDay = this.options.isDay;
        this.isSunset = this.options.isSunset;

        this.clock = new THREE.Clock();
        this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
        this.orbit = {
            isDragging: false,
            prevX: 0,
            prevY: 0,
            rotX: 0.0,
            rotY: 0.0,
            targetRotX: 0.0,
            targetRotY: 0.0
        };

        this.initThree();
        this.initLights();
        this.initSkyAndAtmosphere();
        this.initWeatherObjects();
        this.setupEventListeners();
        this.setCondition(this.currentCondition, this.isDay, this.isSunset);
        this.animate();
    }

    Weather3D.prototype.initThree = function () {
        var width = this.container.clientWidth || 240;
        var height = this.container.clientHeight || 240;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 1000);
        this.camera.position.set(0, 0, 13.5);

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.25;

        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);

        this.mainGroup = new THREE.Group();
        this.scene.add(this.mainGroup);
    };

    Weather3D.prototype.initLights = function () {
        this.ambientLight = new THREE.AmbientLight(0xdbeafe, 1.4);
        this.scene.add(this.ambientLight);

        this.sunLight = new THREE.DirectionalLight(0xfff7ed, 3.2);
        this.sunLight.position.set(8, 12, 8);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 512;
        this.sunLight.shadow.mapSize.height = 512;
        this.scene.add(this.sunLight);

        // Electric cyan rim light for glass specular edge
        this.rimLight = new THREE.PointLight(0x38bdf8, 2.4, 25);
        this.rimLight.position.set(-6, -4, 6);
        this.scene.add(this.rimLight);

        // Sunset warm amber rim light
        this.sunsetRimLight = new THREE.PointLight(0xf97316, 0, 30);
        this.sunsetRimLight.position.set(4, -5, 4);
        this.scene.add(this.sunsetRimLight);

        // Thunderstorm lightning burst light
        this.lightningLight = new THREE.PointLight(0xa5f3fc, 0, 40);
        this.lightningLight.position.set(0, 4, 3);
        this.scene.add(this.lightningLight);
    };

    Weather3D.prototype.initSkyAndAtmosphere = function () {
        var starCount = 350;
        var starGeo = new THREE.BufferGeometry();
        var positions = new Float32Array(starCount * 3);

        for (var i = 0; i < starCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 45;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 35;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 25 - 4;
        }

        starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        var starMat = new THREE.PointsMaterial({
            color: 0x93c5fd,
            size: 0.14,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });

        this.starField = new THREE.Points(starGeo, starMat);
        this.scene.add(this.starField);
    };

    Weather3D.prototype.initWeatherObjects = function () {
        this.cloudGroup = new THREE.Group();
        this.sunGroup = new THREE.Group();
        this.moonGroup = new THREE.Group();
        this.rainGroup = new THREE.Group();
        this.snowGroup = new THREE.Group();
        this.lightningGroup = new THREE.Group();

        this.mainGroup.add(this.sunGroup);
        this.mainGroup.add(this.moonGroup);
        this.mainGroup.add(this.cloudGroup);
        this.mainGroup.add(this.rainGroup);
        this.mainGroup.add(this.snowGroup);
        this.mainGroup.add(this.lightningGroup);

        this.buildSun();
        this.buildMoon();
        this.buildClouds();
        this.buildRain();
        this.buildSnow();
        this.buildLightning();
    };

    /**
     * ☀️ Realistic Golden Sun with Raytraced Sheen & Coronal Glow (Google Stitch Style)
     */
    Weather3D.prototype.buildSun = function () {
        // Metallic Sun Core
        var sunGeo = new THREE.SphereGeometry(1.48, 36, 36);
        var sunMat = new THREE.MeshStandardMaterial({
            color: 0xfffbeb,
            emissive: 0xf59e0b,
            emissiveIntensity: 2.2,
            roughness: 0.15,
            metalness: 0.28
        });
        this.sunCore = new THREE.Mesh(sunGeo, sunMat);
        this.sunGroup.add(this.sunCore);

        // Soft Corona Glow Sphere
        var coronaGeo = new THREE.SphereGeometry(1.85, 24, 24);
        var coronaMat = new THREE.MeshBasicMaterial({
            color: 0xfde047,
            transparent: true,
            opacity: 0.38,
            blending: THREE.AdditiveBlending
        });
        this.sunCorona = new THREE.Mesh(coronaGeo, coronaMat);
        this.sunGroup.add(this.sunCorona);

        // Radiating Solar Light Cones
        this.solarRays = new THREE.Group();
        var rayCount = 14;
        for (var i = 0; i < rayCount; i++) {
            var angle = (i / rayCount) * Math.PI * 2;
            var rayGeo = new THREE.ConeGeometry(0.24, 1.4, 4);
            rayGeo.translate(0, 0.7, 0);
            var rayMat = new THREE.MeshBasicMaterial({
                color: (i % 2 === 0) ? 0xfbbf24 : 0xfde047,
                transparent: true,
                opacity: 0.55,
                blending: THREE.AdditiveBlending
            });
            var ray = new THREE.Mesh(rayGeo, rayMat);
            ray.position.set(Math.cos(angle) * 1.48, Math.sin(angle) * 1.48, 0);
            ray.rotation.z = angle - Math.PI / 2;
            this.solarRays.add(ray);
        }
        this.sunGroup.add(this.solarRays);

        // Position slightly top-right/back behind cloud (matches stitch_3d_hero.jpg)
        this.sunGroup.position.set(1.5, 1.15, -1.3);
    };

    /**
     * 🌙 3D Moon with Soft Lunar Atmosphere
     */
    Weather3D.prototype.buildMoon = function () {
        var moonGeo = new THREE.SphereGeometry(1.45, 32, 32);
        var moonMat = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0,
            roughness: 0.75,
            metalness: 0.12,
            emissive: 0x38bdf8,
            emissiveIntensity: 0.22
        });
        this.moonCore = new THREE.Mesh(moonGeo, moonMat);
        this.moonGroup.add(this.moonCore);

        // Moon Craters
        var craterMat = new THREE.MeshStandardMaterial({
            color: 0x94a3b8,
            roughness: 0.95
        });
        var craterSpecs = [
            [-0.5, 0.4, 1.2, 0.24],
            [0.4, -0.4, 1.3, 0.3],
            [-0.1, -0.6, 1.2, 0.2],
            [0.6, 0.3, 1.1, 0.25]
        ];
        for (var c = 0; c < craterSpecs.length; c++) {
            var s = craterSpecs[c];
            var craterGeo = new THREE.CylinderGeometry(s[3], s[3] * 0.8, 0.08, 14);
            var crater = new THREE.Mesh(craterGeo, craterMat);
            crater.position.set(s[0], s[1], s[2]);
            crater.lookAt(0, 0, 0);
            this.moonGroup.add(crater);
        }

        // Soft Lunar Halo
        var haloGeo = new THREE.SphereGeometry(1.8, 24, 24);
        var haloMat = new THREE.MeshBasicMaterial({
            color: 0x60a5fa,
            transparent: true,
            opacity: 0.28,
            blending: THREE.AdditiveBlending
        });
        var halo = new THREE.Mesh(haloGeo, haloMat);
        this.moonGroup.add(halo);

        this.moonGroup.position.set(1.5, 1.15, -1.3);
        this.moonGroup.visible = false;
    };

    /**
     * ☁️ Frosted Glassmorphism Cloud (matches Google Stitch Raytraced Glass Style)
     */
    Weather3D.prototype.buildClouds = function () {
        this.cloudPuffs = [];

        // MeshPhysicalMaterial with transmission for raytraced frosted glass effect
        var glassCloudMat = new THREE.MeshPhysicalMaterial({
            color: 0xf0f7ff,
            emissive: 0x1e3a5f,
            emissiveIntensity: 0.15,
            roughness: 0.22,
            metalness: 0.05,
            transmission: 0.82,
            thickness: 2.2,
            ior: 1.45,
            reflectivity: 0.85,
            clearcoat: 0.7,
            clearcoatRoughness: 0.25,
            transparent: true,
            opacity: 0.94
        });

        // Soft Organic Cloud Billows centered perfectly
        var puffSpecs = [
            // Center main body
            [0.0, -0.3, 0.2, 1.45],
            // Left billow
            [-1.1, -0.4, 0.15, 1.15],
            // Right billow
            [1.15, -0.45, 0.1, 1.1],
            // Upper center crown billow
            [-0.25, 0.5, 0.1, 1.15],
            // Upper right secondary crown
            [0.65, 0.35, 0.05, 0.95],
            // Subsurface depth puffs
            [-0.5, -0.1, 0.5, 0.9],
            [0.5, -0.15, 0.45, 0.85],
            // Back volume
            [0.1, 0.1, -0.35, 1.1]
        ];

        var heroCluster = new THREE.Group();
        for (var i = 0; i < puffSpecs.length; i++) {
            var spec = puffSpecs[i];
            var puffGeo = new THREE.SphereGeometry(spec[3], 24, 24);
            var puff = new THREE.Mesh(puffGeo, glassCloudMat.clone());
            puff.position.set(spec[0], spec[1], spec[2]);
            puff.castShadow = true;
            puff.receiveShadow = true;
            puff.userData = {
                baseX: spec[0],
                baseY: spec[1],
                baseZ: spec[2],
                floatSpeed: 0.9 + i * 0.1,
                floatOffset: (i / puffSpecs.length) * Math.PI * 2
            };
            heroCluster.add(puff);
            this.cloudPuffs.push(puff);
        }

        // Center cloud group in view
        heroCluster.position.set(0, -0.1, 0.5);
        this.cloudGroup.add(heroCluster);
    };

    /**
     * 🌧️ Glowing Stylized Cyan Teardrop Raindrops (matches stitch_3d_hero.jpg)
     */
    Weather3D.prototype.buildRain = function () {
        this.rainDrops = [];

        var raindropMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 1.4,
            roughness: 0.1,
            metalness: 0.4,
            transparent: true,
            opacity: 0.92
        });

        // 4 primary luminous raindrops positioned right below cloud
        var primaryPositions = [
            [-0.9, -1.6, 0.4],
            [-0.3, -2.1, 0.5],
            [0.3, -1.75, 0.4],
            [0.85, -2.2, 0.3]
        ];

        for (var p = 0; p < primaryPositions.length; p++) {
            var pos = primaryPositions[p];
            var dropGeo = new THREE.ConeGeometry(0.12, 0.42, 12);
            dropGeo.rotateX(Math.PI); // Point tip downward
            var drop = new THREE.Mesh(dropGeo, raindropMat);
            drop.position.set(pos[0], pos[1], pos[2]);
            drop.userData = {
                originX: pos[0],
                originY: -1.2,
                limitY: -3.2,
                speed: 2.2 + p * 0.4
            };
            this.rainGroup.add(drop);
            this.rainDrops.push(drop);
        }

        // 12 background falling rain streaks for cinematic depth
        var streakGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.4, 6);
        for (var b = 0; b < 12; b++) {
            var sMat = new THREE.MeshBasicMaterial({
                color: 0x38bdf8,
                transparent: true,
                opacity: 0.65
            });
            var streak = new THREE.Mesh(streakGeo, sMat);
            streak.position.set(
                (Math.random() - 0.5) * 3.5,
                -1.2 - Math.random() * 2.0,
                (Math.random() - 0.5) * 1.5
            );
            streak.userData = {
                originX: streak.position.x,
                originY: -1.0,
                limitY: -3.4,
                speed: 3.2 + Math.random() * 1.2
            };
            this.rainGroup.add(streak);
            this.rainDrops.push(streak);
        }

        this.rainGroup.visible = false;
    };

    /**
     * ❄️ Fluttering 3D Snowflakes
     */
    Weather3D.prototype.buildSnow = function () {
        this.snowFlakes = [];

        var flakeGeo = new THREE.DodecahedronGeometry(0.08, 0);
        var flakeMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.4,
            metalness: 0.1,
            emissive: 0xbae6fd,
            emissiveIntensity: 0.6
        });

        for (var i = 0; i < 35; i++) {
            var flake = new THREE.Mesh(flakeGeo, flakeMat);
            flake.position.set(
                (Math.random() - 0.5) * 3.6,
                -1.0 - Math.random() * 2.2,
                (Math.random() - 0.5) * 1.8 + 0.3
            );
            flake.userData = {
                originX: flake.position.x,
                originY: -0.8,
                limitY: -3.2,
                speed: 0.6 + Math.random() * 0.5,
                swaySpeed: 1.5 + Math.random() * 1.5,
                swayDist: 0.15 + Math.random() * 0.2,
                seed: Math.random() * Math.PI * 2
            };
            this.snowGroup.add(flake);
            this.snowFlakes.push(flake);
        }

        this.snowGroup.visible = false;
    };

    /**
     * ⛈️ Procedural 3D Lightning Bolt
     */
    Weather3D.prototype.buildLightning = function () {
        var points = [
            new THREE.Vector3(0.1, 0.4, 0.3),
            new THREE.Vector3(-0.25, -0.4, 0.4),
            new THREE.Vector3(0.2, -0.5, 0.45),
            new THREE.Vector3(-0.15, -1.2, 0.5),
            new THREE.Vector3(0.05, -1.9, 0.4)
        ];

        var curve = new THREE.CatmullRomCurve3(points);
        var tubeGeo = new THREE.TubeGeometry(curve, 18, 0.05, 6, false);
        var boltMat = new THREE.MeshBasicMaterial({
            color: 0xe0f2fe,
            transparent: true,
            opacity: 0
        });

        this.lightningBolt = new THREE.Mesh(tubeGeo, boltMat);
        this.lightningGroup.add(this.lightningBolt);
        this.lightningTimer = 0;
    };

    /**
     * Set Weather Condition State & Adapt 3D Lighting / Celestial Positions
     */
    Weather3D.prototype.setCondition = function (condition, isDay, isSunset) {
        this.currentCondition = (condition || 'clear').toLowerCase().replace(/_/g, ' ');
        this.isSunset = !!isSunset || this.currentCondition.indexOf('sunset') !== -1;
        this.isDay = isDay !== undefined ? isDay : !this.isSunset;

        var isStorm = this.currentCondition.indexOf('thunder') !== -1 || this.currentCondition.indexOf('storm') !== -1;
        var isRain = this.currentCondition.indexOf('rain') !== -1 || this.currentCondition.indexOf('drizzle') !== -1 || isStorm;
        var isSnow = this.currentCondition.indexOf('snow') !== -1 || this.currentCondition.indexOf('ice') !== -1;
        var isCloudy = this.currentCondition.indexOf('cloud') !== -1 || this.currentCondition.indexOf('overcast') !== -1;
        var isClear = !isRain && !isSnow && !isCloudy && !this.isSunset;

        // 1. Celestial Setup
        if (this.isSunset) {
            this.sunGroup.visible = true;
            this.moonGroup.visible = false;
            this.starField.visible = false;
            this.sunGroup.position.set(1.4, 0.6, -1.2); // Low golden horizon sun

            this.sunCore.material.emissive.setHex(0xea580c);
            this.sunCorona.material.color.setHex(0xf97316);
            this.sunLight.color.setHex(0xf97316);
            this.sunLight.intensity = 2.8;
            this.ambientLight.color.setHex(0x7c3aed);
            this.ambientLight.intensity = 1.3;
            this.sunsetRimLight.intensity = 3.5;

            // Warm golden-rose cloud shading
            this.cloudGroup.visible = true;
            for (var p0 = 0; p0 < this.cloudPuffs.length; p0++) {
                this.cloudPuffs[p0].material.color.setHex(0xfed7aa);
                this.cloudPuffs[p0].material.emissive.setHex(0x9a3412);
            }
        } else if (this.isDay) {
            this.sunGroup.visible = true;
            this.moonGroup.visible = false;
            this.starField.visible = false;
            this.sunGroup.position.set(1.5, 1.15, -1.3);

            this.sunCore.material.emissive.setHex(0xf59e0b);
            this.sunCorona.material.color.setHex(0xfde047);
            this.sunLight.color.setHex(0xfff7ed);
            this.sunLight.intensity = (isCloudy || isRain) ? 2.2 : 3.4;
            this.ambientLight.color.setHex(isRain ? 0x94a3b8 : 0xdbeafe);
            this.ambientLight.intensity = isRain ? 1.0 : 1.4;
            this.sunsetRimLight.intensity = 0;

            if (isClear) {
                this.cloudGroup.visible = false;
                this.sunGroup.position.set(0, 0, 0); // Hero center sun
            } else {
                this.cloudGroup.visible = true;
                var cloudCol = 0xf0f7ff;
                var cloudEmiss = 0x1e3a5f;
                if (isStorm) {
                    cloudCol = 0x334155;
                    cloudEmiss = 0x0f172a;
                } else if (isRain) {
                    cloudCol = 0x64748b;
                    cloudEmiss = 0x1e293b;
                }

                for (var p1 = 0; p1 < this.cloudPuffs.length; p1++) {
                    this.cloudPuffs[p1].material.color.setHex(cloudCol);
                    this.cloudPuffs[p1].material.emissive.setHex(cloudEmiss);
                }
            }
        } else {
            // Night
            this.sunGroup.visible = false;
            this.moonGroup.visible = true;
            this.starField.visible = true;
            this.moonGroup.position.set(1.5, 1.15, -1.3);

            this.sunLight.color.setHex(0x93c5fd);
            this.sunLight.intensity = 1.2;
            this.ambientLight.color.setHex(0x1e293b);
            this.ambientLight.intensity = 0.9;
            this.sunsetRimLight.intensity = 0;

            if (isClear) {
                this.cloudGroup.visible = false;
                this.moonGroup.position.set(0, 0, 0); // Hero center moon
            } else {
                this.cloudGroup.visible = true;
                for (var p2 = 0; p2 < this.cloudPuffs.length; p2++) {
                    this.cloudPuffs[p2].material.color.setHex(0x334155);
                    this.cloudPuffs[p2].material.emissive.setHex(0x0f172a);
                }
            }
        }

        // Precipitation
        this.rainGroup.visible = isRain;
        this.snowGroup.visible = isSnow;
        this.isStorm = isStorm;
        this.lightningTimer = 0;
    };

    Weather3D.prototype.setupEventListeners = function () {
        var self = this;
        var dom = this.renderer.domElement;

        dom.addEventListener('mousedown', function (e) {
            self.orbit.isDragging = true;
            self.orbit.prevX = e.clientX;
            self.orbit.prevY = e.clientY;
        });

        window.addEventListener('mousemove', function (e) {
            var rect = dom.getBoundingClientRect();
            var x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            var y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
            self.mouse.targetX = x * 0.3;
            self.mouse.targetY = y * 0.3;

            if (self.orbit.isDragging) {
                var deltaX = e.clientX - self.orbit.prevX;
                var deltaY = e.clientY - self.orbit.prevY;
                self.orbit.targetRotY += deltaX * 0.008;
                self.orbit.targetRotX += deltaY * 0.008;
                self.orbit.prevX = e.clientX;
                self.orbit.prevY = e.clientY;
            }
        });

        window.addEventListener('mouseup', function () {
            self.orbit.isDragging = false;
        });

        dom.addEventListener('touchstart', function (e) {
            if (e.touches.length === 1) {
                self.orbit.isDragging = true;
                self.orbit.prevX = e.touches[0].clientX;
                self.orbit.prevY = e.touches[0].clientY;
            }
        }, { passive: true });

        window.addEventListener('touchmove', function (e) {
            if (self.orbit.isDragging && e.touches.length === 1) {
                var deltaX = e.touches[0].clientX - self.orbit.prevX;
                var deltaY = e.touches[0].clientY - self.orbit.prevY;
                self.orbit.targetRotY += deltaX * 0.008;
                self.orbit.targetRotX += deltaY * 0.008;
                self.orbit.prevX = e.touches[0].clientX;
                self.orbit.prevY = e.touches[0].clientY;
            }
        }, { passive: true });

        window.addEventListener('touchend', function () {
            self.orbit.isDragging = false;
        });

        window.addEventListener('resize', function () {
            self.onWindowResize();
        });

        if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission !== 'function') {
            window.addEventListener('deviceorientation', function (event) {
                if (event.gamma !== null && event.beta !== null) {
                    self.mouse.targetX = (event.gamma / 45) * 0.25;
                    self.mouse.targetY = ((event.beta - 45) / 45) * 0.25;
                }
            }, { passive: true });
        }
    };

    Weather3D.prototype.onWindowResize = function () {
        if (!this.container || !this.renderer || !this.camera) return;
        var width = this.container.clientWidth;
        var height = this.container.clientHeight;
        if (width === 0 || height === 0) return;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    };

    /**
     * 60 FPS Render Loop
     */
    Weather3D.prototype.animate = function () {
        var self = this;
        requestAnimationFrame(function () {
            self.animate();
        });

        var delta = this.clock.getDelta();
        var elapsed = this.clock.getElapsedTime();

        // Parallax Damping
        this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.08;
        this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.08;

        // Auto Rotation
        if (this.options.autoRotate && !this.orbit.isDragging) {
            this.orbit.targetRotY += delta * this.options.autoRotateSpeed * 0.2;
        }
        this.orbit.rotX += (this.orbit.targetRotX - this.orbit.rotX) * 0.1;
        this.orbit.rotY += (this.orbit.targetRotY - this.orbit.rotY) * 0.1;

        this.mainGroup.rotation.y = this.orbit.rotY + this.mouse.x * 0.35;
        this.mainGroup.rotation.x = Math.max(-0.4, Math.min(0.4, this.orbit.rotX - this.mouse.y * 0.35));

        // 1. Sun Solar Flare Rotation & Corona Pulse
        if (this.sunGroup.visible) {
            this.solarRays.rotation.z += delta * 0.22;
            var sunScale = 1.0 + Math.sin(elapsed * 2.2) * 0.04;
            this.sunCorona.scale.set(sunScale, sunScale, sunScale);
            this.sunCore.rotation.y += delta * 0.05;
        }

        // 2. Moon Rotation
        if (this.moonGroup.visible) {
            this.moonCore.rotation.y += delta * 0.03;
        }

        // 3. Clouds Breathing & Floating Motion
        if (this.cloudGroup.visible) {
            for (var p = 0; p < this.cloudPuffs.length; p++) {
                var puff = this.cloudPuffs[p];
                var u = puff.userData;
                puff.position.y = u.baseY + Math.sin(elapsed * u.floatSpeed + u.floatOffset) * 0.06;
                puff.position.x = u.baseX + Math.cos(elapsed * u.floatSpeed * 0.8 + u.floatOffset) * 0.04;
            }
        }

        // 4. Raindrops Physics Loop
        if (this.rainGroup.visible) {
            for (var r = 0; r < this.rainDrops.length; r++) {
                var drop = this.rainDrops[r];
                drop.position.y -= drop.userData.speed * delta;
                if (drop.position.y < drop.userData.limitY) {
                    drop.position.y = drop.userData.originY;
                }
            }
        }

        // 5. Snow Flakes Gentle Swirl Physics
        if (this.snowGroup.visible) {
            for (var s = 0; s < this.snowFlakes.length; s++) {
                var flake = this.snowFlakes[s];
                var su = flake.userData;
                flake.position.y -= su.speed * delta;
                flake.position.x = su.originX + Math.sin(elapsed * su.swaySpeed + su.seed) * su.swayDist;
                flake.rotation.x += delta * 0.5;
                flake.rotation.y += delta * 0.8;
                if (flake.position.y < su.limitY) {
                    flake.position.y = su.originY;
                }
            }
        }

        // 6. Thunderstorm Procedural Lightning Burst
        if (this.isStorm) {
            this.lightningTimer += delta;
            if (this.lightningTimer > 3.0 + Math.random() * 2.5) {
                var flash = (Math.sin(elapsed * 45) > 0.4) ? 1.0 : 0.0;
                this.lightningBolt.material.opacity = flash * 0.95;
                this.lightningLight.intensity = flash * 4.5;
                if (this.lightningTimer > 3.4) {
                    this.lightningTimer = 0;
                    this.lightningBolt.material.opacity = 0;
                    this.lightningLight.intensity = 0;
                }
            }
        }

        this.renderer.render(this.scene, this.camera);
    };

    window.Weather3D = Weather3D;

})(window);
