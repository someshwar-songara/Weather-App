/**
 * Atmosphere 3D - Ultra-Realistic, Colorful Three.js Weather Visualization Engine
 * Features:
 * - ☀️ Radiant Sun: Metallic core, dual-tier rotating rays, coronal flare pulse, floating solar motes
 * - 🌙 3D Moon: Procedural craters, lunar halo, and 400+ twinkling cosmic starlight particles
 * - ☁️ Raytraced Frosted Glass Clouds: Multi-puff volumetric clusters with internal lighting
 * - 🌧️ Luminous Rain: 3D falling teardrops with expanding ground splash ripples
 * - ❄️ 3D Snow: Crystalline snowflakes with sinusoidal sway and tumbling physics
 * - ⛈️ Dynamic Lightning: Procedural 3D bolt with internal cloud illumination
 * - 🎮 Interactivity: Touch & drag 3D rotation with inertia, device tilt parallax, tap pulse
 */

(function (window) {
    'use strict';

    function Weather3D(containerId, options) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Weather3D: Container not found:', containerId);
            return;
        }

        this.options = Object.assign({
            initialCondition: 'partly_cloudy',
            isDay: true,
            isSunset: false,
            interactive: true,
            autoRotate: true,
            autoRotateSpeed: 0.45
        }, options || {});

        this.currentCondition = this.options.initialCondition;
        this.isDay = this.options.isDay;
        this.isSunset = this.options.isSunset;
        this.currentTheme = this.options.theme || 'light';
        this.isVisible = true;

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
        this.setTheme(this.currentTheme);
        this.animate();
    }

    Weather3D.prototype.setTheme = function (theme) {
        this.currentTheme = theme;
        var isLight = (theme === 'light');
        if (this.ambientLight) {
            this.ambientLight.intensity = isLight ? (this.isDay ? 2.0 : 1.4) : (this.isDay ? 1.5 : 0.95);
        }
        if (this.sunLight) {
            this.sunLight.intensity = isLight ? (this.isDay ? 4.0 : 1.8) : (this.isDay ? 3.6 : 1.4);
        }
        if (this.renderer) {
            this.renderer.toneMappingExposure = isLight ? 1.45 : 1.35;
        }
    };

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
        this.renderer.toneMappingExposure = 1.35;

        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);

        this.mainGroup = new THREE.Group();
        this.scene.add(this.mainGroup);
    };

    Weather3D.prototype.initLights = function () {
        this.ambientLight = new THREE.AmbientLight(0xdbeafe, 1.5);
        this.scene.add(this.ambientLight);

        // Key sunlight
        this.sunLight = new THREE.DirectionalLight(0xfff7ed, 3.6);
        this.sunLight.position.set(8, 12, 8);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 512;
        this.sunLight.shadow.mapSize.height = 512;
        this.scene.add(this.sunLight);

        // Electric cyan rim light for glass specular edge
        this.rimLight = new THREE.PointLight(0x38bdf8, 2.6, 25);
        this.rimLight.position.set(-6, -4, 6);
        this.scene.add(this.rimLight);

        // Sunset warm amber rim light
        this.sunsetRimLight = new THREE.PointLight(0xf97316, 0, 30);
        this.sunsetRimLight.position.set(4, -5, 4);
        this.scene.add(this.sunsetRimLight);

        // Thunderstorm lightning burst light
        this.lightningLight = new THREE.PointLight(0xa5f3fc, 0, 45);
        this.lightningLight.position.set(0, 3, 3);
        this.scene.add(this.lightningLight);

        // Internal cloud storm light
        this.cloudInternalLight = new THREE.PointLight(0x818cf8, 0, 20);
        this.cloudInternalLight.position.set(0, 0, 0.5);
        this.scene.add(this.cloudInternalLight);
    };

    Weather3D.prototype.initSkyAndAtmosphere = function () {
        var starCount = 420;
        var starGeo = new THREE.BufferGeometry();
        var positions = new Float32Array(starCount * 3);
        var twinks = new Float32Array(starCount);

        for (var i = 0; i < starCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 50;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 25 - 5;
            twinks[i] = Math.random() * Math.PI * 2;
        }

        starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeo.setAttribute('twinkle', new THREE.BufferAttribute(twinks, 1));

        var starMat = new THREE.PointsMaterial({
            color: 0x93c5fd,
            size: 0.16,
            transparent: true,
            opacity: 0.75,
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
        this.splashGroup = new THREE.Group();

        this.mainGroup.add(this.sunGroup);
        this.mainGroup.add(this.moonGroup);
        this.mainGroup.add(this.cloudGroup);
        this.mainGroup.add(this.rainGroup);
        this.mainGroup.add(this.splashGroup);
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
     * ☀️ Radiant Golden Sun with Raytraced Sheen, Dual Rotating Rays & Floating Light Motes
     */
    Weather3D.prototype.buildSun = function () {
        // Metallic Core
        var sunGeo = new THREE.SphereGeometry(1.5, 36, 36);
        var sunMat = new THREE.MeshStandardMaterial({
            color: 0xfffbeb,
            emissive: 0xf59e0b,
            emissiveIntensity: 2.4,
            roughness: 0.12,
            metalness: 0.35
        });
        this.sunCore = new THREE.Mesh(sunGeo, sunMat);
        this.sunGroup.add(this.sunCore);

        // Soft Corona Glow Sphere
        var coronaGeo = new THREE.SphereGeometry(1.95, 28, 28);
        var coronaMat = new THREE.MeshBasicMaterial({
            color: 0xfde047,
            transparent: true,
            opacity: 0.42,
            blending: THREE.AdditiveBlending
        });
        this.sunCorona = new THREE.Mesh(coronaGeo, coronaMat);
        this.sunGroup.add(this.sunCorona);

        // Outer Coronal Halo
        var haloGeo = new THREE.SphereGeometry(2.35, 24, 24);
        var haloMat = new THREE.MeshBasicMaterial({
            color: 0xfbbf24,
            transparent: true,
            opacity: 0.22,
            blending: THREE.AdditiveBlending
        });
        this.sunOuterHalo = new THREE.Mesh(haloGeo, haloMat);
        this.sunGroup.add(this.sunOuterHalo);

        // Tier 1: Primary Solar Rays (Clockwise)
        this.solarRaysPrimary = new THREE.Group();
        var rayCountPrimary = 14;
        for (var i = 0; i < rayCountPrimary; i++) {
            var angle = (i / rayCountPrimary) * Math.PI * 2;
            var rayGeo = new THREE.ConeGeometry(0.24, 1.45, 5);
            rayGeo.translate(0, 0.72, 0);
            var rayMat = new THREE.MeshBasicMaterial({
                color: (i % 2 === 0) ? 0xfbbf24 : 0xfde047,
                transparent: true,
                opacity: 0.6,
                blending: THREE.AdditiveBlending
            });
            var ray = new THREE.Mesh(rayGeo, rayMat);
            ray.position.set(Math.cos(angle) * 1.5, Math.sin(angle) * 1.5, 0);
            ray.rotation.z = angle - Math.PI / 2;
            this.solarRaysPrimary.add(ray);
        }
        this.sunGroup.add(this.solarRaysPrimary);

        // Tier 2: Secondary Shorter Inner Rays (Counter-Clockwise)
        this.solarRaysSecondary = new THREE.Group();
        var rayCountSecondary = 10;
        for (var j = 0; j < rayCountSecondary; j++) {
            var angle2 = (j / rayCountSecondary) * Math.PI * 2 + 0.2;
            var rayGeo2 = new THREE.ConeGeometry(0.18, 0.95, 4);
            rayGeo2.translate(0, 0.48, 0);
            var rayMat2 = new THREE.MeshBasicMaterial({
                color: 0xf59e0b,
                transparent: true,
                opacity: 0.45,
                blending: THREE.AdditiveBlending
            });
            var ray2 = new THREE.Mesh(rayGeo2, rayMat2);
            ray2.position.set(Math.cos(angle2) * 1.52, Math.sin(angle2) * 1.52, -0.05);
            ray2.rotation.z = angle2 - Math.PI / 2;
            this.solarRaysSecondary.add(ray2);
        }
        this.sunGroup.add(this.solarRaysSecondary);

        // Floating Solar Light Motes (Sparkles)
        this.sunMotes = [];
        var moteGeo = new THREE.SphereGeometry(0.06, 8, 8);
        var moteMat = new THREE.MeshBasicMaterial({
            color: 0xfef08a,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        for (var m = 0; m < 20; m++) {
            var mote = new THREE.Mesh(moteGeo, moteMat.clone());
            var rad = 1.8 + Math.random() * 1.6;
            var ang = Math.random() * Math.PI * 2;
            mote.position.set(Math.cos(ang) * rad, Math.sin(ang) * rad, (Math.random() - 0.5) * 1.2);
            mote.userData = {
                baseRad: rad,
                angle: ang,
                speed: 0.4 + Math.random() * 0.5,
                pulseOffset: Math.random() * Math.PI * 2
            };
            this.sunGroup.add(mote);
            this.sunMotes.push(mote);
        }

        this.sunGroup.position.set(1.5, 1.15, -1.3);
    };

    /**
     * 🌙 3D Moon with Procedural Craters & Glowing Lunar Halo
     */
    Weather3D.prototype.buildMoon = function () {
        var moonGeo = new THREE.SphereGeometry(1.48, 36, 36);
        var moonMat = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0,
            roughness: 0.65,
            metalness: 0.15,
            emissive: 0x38bdf8,
            emissiveIntensity: 0.3
        });
        this.moonCore = new THREE.Mesh(moonGeo, moonMat);
        this.moonGroup.add(this.moonCore);

        // 3D Moon Craters with rim relief
        var craterMat = new THREE.MeshStandardMaterial({
            color: 0x94a3b8,
            roughness: 0.92,
            metalness: 0.05
        });
        var craterSpecs = [
            [-0.55, 0.45, 1.22, 0.26],
            [0.45, -0.42, 1.32, 0.32],
            [-0.12, -0.65, 1.25, 0.22],
            [0.62, 0.32, 1.15, 0.27],
            [-0.65, -0.25, 1.18, 0.18],
            [0.15, 0.72, 1.2, 0.24]
        ];
        for (var c = 0; c < craterSpecs.length; c++) {
            var s = craterSpecs[c];
            var craterGeo = new THREE.CylinderGeometry(s[3], s[3] * 0.78, 0.09, 16);
            var crater = new THREE.Mesh(craterGeo, craterMat);
            crater.position.set(s[0], s[1], s[2]);
            crater.lookAt(0, 0, 0);
            this.moonGroup.add(crater);
        }

        // Soft Lunar Halo
        var haloGeo = new THREE.SphereGeometry(1.9, 28, 28);
        var haloMat = new THREE.MeshBasicMaterial({
            color: 0x60a5fa,
            transparent: true,
            opacity: 0.32,
            blending: THREE.AdditiveBlending
        });
        var halo = new THREE.Mesh(haloGeo, haloMat);
        this.moonGroup.add(halo);

        // Secondary Outer Moon Glow
        var haloOuterGeo = new THREE.SphereGeometry(2.35, 24, 24);
        var haloOuterMat = new THREE.MeshBasicMaterial({
            color: 0x818cf8,
            transparent: true,
            opacity: 0.18,
            blending: THREE.AdditiveBlending
        });
        var haloOuter = new THREE.Mesh(haloOuterGeo, haloOuterMat);
        this.moonGroup.add(haloOuter);

        this.moonGroup.position.set(1.5, 1.15, -1.3);
        this.moonGroup.visible = false;
    };

    /**
     * ☁️ Multi-Puff Frosted Glassmorphism Cloud with Iridescent Depth
     */
    Weather3D.prototype.buildClouds = function () {
        this.cloudPuffs = [];

        var glassCloudMat = new THREE.MeshPhysicalMaterial({
            color: 0xf0f7ff,
            emissive: 0x1e3a5f,
            emissiveIntensity: 0.18,
            roughness: 0.18,
            metalness: 0.06,
            transmission: 0.86,
            thickness: 2.4,
            ior: 1.48,
            reflectivity: 0.9,
            clearcoat: 0.8,
            clearcoatRoughness: 0.2,
            transparent: true,
            opacity: 0.95
        });

        // 9 Organic Cloud Billows centered with volume
        var puffSpecs = [
            [0.0, -0.3, 0.2, 1.48],       // Center main body
            [-1.15, -0.4, 0.15, 1.18],    // Left billow
            [1.18, -0.45, 0.1, 1.12],     // Right billow
            [-0.28, 0.52, 0.1, 1.18],     // Upper crown billow
            [0.68, 0.38, 0.05, 0.98],     // Upper right secondary crown
            [-0.52, -0.1, 0.52, 0.92],    // Front left depth puff
            [0.52, -0.15, 0.48, 0.88],    // Front right depth puff
            [0.1, 0.12, -0.38, 1.15],     // Back volume
            [-0.8, 0.2, -0.2, 0.85]       // Back left accent
        ];

        var heroCluster = new THREE.Group();
        for (var i = 0; i < puffSpecs.length; i++) {
            var spec = puffSpecs[i];
            var puffGeo = new THREE.SphereGeometry(spec[3], 26, 26);
            var puff = new THREE.Mesh(puffGeo, glassCloudMat.clone());
            puff.position.set(spec[0], spec[1], spec[2]);
            puff.castShadow = true;
            puff.receiveShadow = true;
            puff.userData = {
                baseX: spec[0],
                baseY: spec[1],
                baseZ: spec[2],
                floatSpeed: 0.85 + i * 0.12,
                floatOffset: (i / puffSpecs.length) * Math.PI * 2
            };
            heroCluster.add(puff);
            this.cloudPuffs.push(puff);
        }

        heroCluster.position.set(0, -0.1, 0.5);
        this.cloudGroup.add(heroCluster);
    };

    /**
     * 🌧️ Glowing Cyan Teardrop Raindrops & Expanding Ground Splash Ripples
     */
    Weather3D.prototype.buildRain = function () {
        this.rainDrops = [];
        this.splashes = [];

        var raindropMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 1.6,
            roughness: 0.08,
            metalness: 0.45,
            transparent: true,
            opacity: 0.94
        });

        // Primary falling teardrops
        var primaryPositions = [
            [-0.95, -1.5, 0.4],
            [-0.35, -2.0, 0.5],
            [0.32, -1.7, 0.45],
            [0.9, -2.15, 0.35],
            [-0.65, -1.85, 0.3],
            [0.65, -1.95, 0.4]
        ];

        for (var p = 0; p < primaryPositions.length; p++) {
            var pos = primaryPositions[p];
            var dropGeo = new THREE.ConeGeometry(0.12, 0.45, 14);
            dropGeo.rotateX(Math.PI);
            var drop = new THREE.Mesh(dropGeo, raindropMat);
            drop.position.set(pos[0], pos[1], pos[2]);
            drop.userData = {
                originX: pos[0],
                originY: -1.2,
                limitY: -3.2,
                speed: 2.4 + p * 0.35,
                splashIdx: p
            };
            this.rainGroup.add(drop);
            this.rainDrops.push(drop);

            // Ground Splash Ripple Disk
            var rippleGeo = new THREE.RingGeometry(0.04, 0.22, 16);
            rippleGeo.rotateX(-Math.PI / 2);
            var rippleMat = new THREE.MeshBasicMaterial({
                color: 0x38bdf8,
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide
            });
            var ripple = new THREE.Mesh(rippleGeo, rippleMat);
            ripple.position.set(pos[0], -3.2, pos[2]);
            this.splashGroup.add(ripple);
            this.splashes.push({ mesh: ripple, scale: 0.1, alpha: 0 });
        }

        // Secondary background rain streaks for cinematic depth
        var streakGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.42, 6);
        for (var b = 0; b < 16; b++) {
            var sMat = new THREE.MeshBasicMaterial({
                color: 0x38bdf8,
                transparent: true,
                opacity: 0.65
            });
            var streak = new THREE.Mesh(streakGeo, sMat);
            streak.position.set(
                (Math.random() - 0.5) * 4.0,
                -1.2 - Math.random() * 2.0,
                (Math.random() - 0.5) * 2.0
            );
            streak.userData = {
                originX: streak.position.x,
                originY: -1.0,
                limitY: -3.4,
                speed: 3.5 + Math.random() * 1.5
            };
            this.rainGroup.add(streak);
            this.rainDrops.push(streak);
        }

        this.rainGroup.visible = false;
        this.splashGroup.visible = false;
    };

    /**
     * ❄️ Fluttering 3D Crystalline Snowflakes
     */
    Weather3D.prototype.buildSnow = function () {
        this.snowFlakes = [];

        var flakeGeo = new THREE.DodecahedronGeometry(0.09, 0);
        var flakeMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.35,
            metalness: 0.15,
            emissive: 0xbae6fd,
            emissiveIntensity: 0.7
        });

        for (var i = 0; i < 42; i++) {
            var flake = new THREE.Mesh(flakeGeo, flakeMat);
            flake.position.set(
                (Math.random() - 0.5) * 4.2,
                -0.9 - Math.random() * 2.5,
                (Math.random() - 0.5) * 2.0 + 0.3
            );
            flake.userData = {
                originX: flake.position.x,
                originY: -0.7,
                limitY: -3.3,
                speed: 0.65 + Math.random() * 0.55,
                swaySpeed: 1.6 + Math.random() * 1.8,
                swayDist: 0.18 + Math.random() * 0.22,
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
            new THREE.Vector3(0.12, 0.5, 0.3),
            new THREE.Vector3(-0.28, -0.35, 0.42),
            new THREE.Vector3(0.22, -0.48, 0.48),
            new THREE.Vector3(-0.18, -1.25, 0.52),
            new THREE.Vector3(0.08, -2.0, 0.42)
        ];

        var curve = new THREE.CatmullRomCurve3(points);
        var tubeGeo = new THREE.TubeGeometry(curve, 22, 0.055, 6, false);
        var boltMat = new THREE.MeshBasicMaterial({
            color: 0xf0fdf4,
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

        // 1. Celestial Positioning & Lighting
        if (this.isSunset) {
            this.sunGroup.visible = true;
            this.moonGroup.visible = false;
            this.starField.visible = false;
            this.sunGroup.position.set(1.35, 0.55, -1.2);

            this.sunCore.material.emissive.setHex(0xea580c);
            this.sunCorona.material.color.setHex(0xf97316);
            this.sunLight.color.setHex(0xf97316);
            this.sunLight.intensity = 3.0;
            this.ambientLight.color.setHex(0x7c3aed);
            this.ambientLight.intensity = 1.4;
            this.sunsetRimLight.intensity = 3.8;
            this.cloudInternalLight.intensity = 0;

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
            this.sunLight.intensity = (isCloudy || isRain) ? 2.4 : 3.6;
            this.ambientLight.color.setHex(isRain ? 0x94a3b8 : 0xdbeafe);
            this.ambientLight.intensity = isRain ? 1.1 : 1.5;
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
            this.sunLight.color.setHex(0x93c5fd);
            this.sunLight.intensity = 1.4;
            this.ambientLight.color.setHex(0x1e293b);
            this.ambientLight.intensity = 0.95;
            this.sunsetRimLight.intensity = 0;
            this.cloudInternalLight.intensity = 0;

            if (isClear) {
                this.cloudGroup.visible = false;
                this.moonGroup.position.set(0, 0, 0); // Hero center moon
            } else {
                this.cloudGroup.visible = true;
                this.moonGroup.position.set(1.5, 1.15, -1.3);
                for (var p2 = 0; p2 < this.cloudPuffs.length; p2++) {
                    this.cloudPuffs[p2].material.color.setHex(0x334155);
                    this.cloudPuffs[p2].material.emissive.setHex(0x0f172a);
                }
            }
        }

        // Precipitation
        this.rainGroup.visible = isRain;
        this.splashGroup.visible = isRain;
        this.snowGroup.visible = isSnow;
        this.isStorm = isStorm;
        this.lightningTimer = 0;
    };

    /**
     * Tap Surge Micro-Interaction (double click or tap on 3D canvas)
     */
    Weather3D.prototype.triggerPulse = function () {
        if (this.sunGroup.visible) {
            this.sunCorona.scale.set(1.6, 1.6, 1.6);
        }
        if (this.isStorm) {
            this.lightningTimer = 3.1; // trigger instant flash
        }
    };

    Weather3D.prototype.setupEventListeners = function () {
        var self = this;
        var dom = this.renderer.domElement;

        dom.addEventListener('mousedown', function (e) {
            self.orbit.isDragging = true;
            self.orbit.prevX = e.clientX;
            self.orbit.prevY = e.clientY;
        });

        dom.addEventListener('click', function () {
            self.triggerPulse();
        });

        window.addEventListener('mousemove', function (e) {
            var rect = dom.getBoundingClientRect();
            var x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            var y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
            self.mouse.targetX = x * 0.32;
            self.mouse.targetY = y * 0.32;

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

        // Device orientation tilt
        if (window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission !== 'function') {
            window.addEventListener('deviceorientation', function (event) {
                if (event.gamma !== null && event.beta !== null) {
                    self.mouse.targetX = (event.gamma / 45) * 0.28;
                    self.mouse.targetY = ((event.beta - 45) / 45) * 0.28;
                }
            }, { passive: true });
        }

        // Viewport intersection observer to pause rendering when offscreen
        if (typeof IntersectionObserver !== 'undefined' && this.container) {
            var observer = new IntersectionObserver(function (entries) {
                self.isVisible = entries[0].isIntersecting;
            }, { threshold: 0.05 });
            observer.observe(this.container);
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
     * 60 FPS Animation & Physics Render Loop
     */
    Weather3D.prototype.animate = function () {
        var self = this;
        requestAnimationFrame(function () {
            self.animate();
        });

        if (document.hidden || self.isVisible === false) return;

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

        // 1. Sun Coronal Rays & Flare Pulse
        if (this.sunGroup.visible) {
            this.solarRaysPrimary.rotation.z += delta * 0.22;
            this.solarRaysSecondary.rotation.z -= delta * 0.28;
            var sunScale = 1.0 + Math.sin(elapsed * 2.4) * 0.04;
            this.sunCorona.scale.set(sunScale, sunScale, sunScale);
            this.sunOuterHalo.scale.set(1.0 + Math.sin(elapsed * 1.8) * 0.06, 1.0 + Math.sin(elapsed * 1.8) * 0.06, 1.0);
            this.sunCore.rotation.y += delta * 0.05;

            // Animate floating solar motes
            for (var m = 0; m < this.sunMotes.length; m++) {
                var mote = this.sunMotes[m];
                var u = mote.userData;
                u.angle += delta * u.speed;
                mote.position.x = Math.cos(u.angle) * u.baseRad;
                mote.position.y = Math.sin(u.angle) * u.baseRad;
                mote.material.opacity = 0.4 + Math.sin(elapsed * 3.0 + u.pulseOffset) * 0.4;
            }
        }

        // 2. Moon Rotation & Starfield Twinkle
        if (this.moonGroup.visible) {
            this.moonCore.rotation.y += delta * 0.03;
        }
        if (this.starField.visible) {
            this.starField.rotation.y += delta * 0.015;
            this.starField.material.opacity = 0.65 + Math.sin(elapsed * 1.8) * 0.2;
        }

        // 3. Clouds Breathing & Floating Motion
        if (this.cloudGroup.visible) {
            for (var p = 0; p < this.cloudPuffs.length; p++) {
                var puff = this.cloudPuffs[p];
                var pu = puff.userData;
                puff.position.y = pu.baseY + Math.sin(elapsed * pu.floatSpeed + pu.floatOffset) * 0.07;
                puff.position.x = pu.baseX + Math.cos(elapsed * pu.floatSpeed * 0.75 + pu.floatOffset) * 0.045;
            }
        }

        // 4. Raindrops Physics Loop & Splash Ripples
        if (this.rainGroup.visible) {
            for (var r = 0; r < this.rainDrops.length; r++) {
                var drop = this.rainDrops[r];
                drop.position.y -= drop.userData.speed * delta;
                if (drop.position.y < drop.userData.limitY) {
                    drop.position.y = drop.userData.originY;

                    // Trigger ground splash ripple
                    if (drop.userData.splashIdx !== undefined && this.splashes[drop.userData.splashIdx]) {
                        var sp = this.splashes[drop.userData.splashIdx];
                        sp.scale = 0.15;
                        sp.alpha = 0.75;
                    }
                }
            }

            // Animate splash ripples
            for (var s = 0; s < this.splashes.length; s++) {
                var splash = this.splashes[s];
                if (splash.alpha > 0.01) {
                    splash.scale += delta * 1.6;
                    splash.alpha -= delta * 2.2;
                    splash.mesh.scale.set(splash.scale, splash.scale, splash.scale);
                    splash.mesh.material.opacity = Math.max(0, splash.alpha);
                } else {
                    splash.mesh.material.opacity = 0;
                }
            }
        }

        // 5. Snow Flakes Gentle Swirl Physics
        if (this.snowGroup.visible) {
            for (var sn = 0; sn < this.snowFlakes.length; sn++) {
                var flake = this.snowFlakes[sn];
                var su = flake.userData;
                flake.position.y -= su.speed * delta;
                flake.position.x = su.originX + Math.sin(elapsed * su.swaySpeed + su.seed) * su.swayDist;
                flake.rotation.x += delta * 0.6;
                flake.rotation.y += delta * 0.9;
                if (flake.position.y < su.limitY) {
                    flake.position.y = su.originY;
                }
            }
        }

        // 6. Thunderstorm Procedural Lightning Burst & Cloud Internal Light
        if (this.isStorm) {
            this.lightningTimer += delta;
            if (this.lightningTimer > 3.2 + Math.random() * 2.2) {
                var flash = (Math.sin(elapsed * 48) > 0.35) ? 1.0 : 0.0;
                this.lightningBolt.material.opacity = flash * 0.95;
                this.lightningLight.intensity = flash * 5.0;
                this.cloudInternalLight.intensity = flash * 4.0;
                if (this.lightningTimer > 3.65) {
                    this.lightningTimer = 0;
                    this.lightningBolt.material.opacity = 0;
                    this.lightningLight.intensity = 0;
                    this.cloudInternalLight.intensity = 0;
                }
            }
        }

        this.renderer.render(this.scene, this.camera);
    };

    window.Weather3D = Weather3D;

})(window);
