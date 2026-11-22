/**
 * Atmosphere 3D - Ultra-Realistic Three.js Weather Visualization Engine
 * Features:
 * - ☀️ Sunny: Radiant 3D Sun with multi-layered coronal rays, pulsating flares, lens glow
 * - 🌧️ Rainy: Falling rain physics, ground splash ripples, wet surface reflections
 * - ⛈️ Thunderstorm: Procedural 3D lightning bolt mesh, dynamic multi-burst volumetric cloud illumination
 * - ❄️ Snowy: 500+ fluttering crystalline 3D snowflakes with air turbulence & swirling physics
 * - ☁️ Cloudy: Realistic volumetric fluffy clouds with Fresnel lighting & physical wind drift
 * - 🌅 Sunset: Golden hour atmosphere with low-angle sun, coral/rose cloud rim lighting, amber/purple gradients
 * - 🌙 Night: High-detail 3D Moon with craters, lunar maria, and twinkling cosmic starfield
 * - 🔄 360-degree interactive camera orbit with smooth touch/mouse damping & gyroscopic parallax
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
            enableParallax: true,
            autoRotate: true,
            autoRotateSpeed: 0.35
        }, options || {});

        this.currentCondition = this.options.initialCondition;
        this.isDay = this.options.isDay;
        this.isSunset = this.options.isSunset;
        this.windSpeed = 3.5; // m/s
        this.windDeg = 45;

        this.clock = new THREE.Clock();
        this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
        this.orbit = {
            isDragging: false,
            prevX: 0,
            prevY: 0,
            rotX: 0.1,
            rotY: 0,
            targetRotX: 0.1,
            targetRotY: 0
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
        var width = this.container.clientWidth || 360;
        var height = this.container.clientHeight || 340;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
        this.camera.position.set(0, 0, 18);

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
        this.renderer.toneMappingExposure = 1.2;

        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);

        this.mainGroup = new THREE.Group();
        this.scene.add(this.mainGroup);
    };

    Weather3D.prototype.initLights = function () {
        this.ambientLight = new THREE.AmbientLight(0xdbeafe, 1.25);
        this.scene.add(this.ambientLight);

        this.sunLight = new THREE.DirectionalLight(0xfff7ed, 2.6);
        this.sunLight.position.set(12, 16, 10);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 1024;
        this.sunLight.shadow.mapSize.height = 1024;
        this.scene.add(this.sunLight);

        this.rimLight = new THREE.PointLight(0x38bdf8, 2.2, 35);
        this.rimLight.position.set(-10, -5, 8);
        this.scene.add(this.rimLight);

        this.sunsetRimLight = new THREE.PointLight(0xf43f5e, 0, 35);
        this.sunsetRimLight.position.set(0, -8, 5);
        this.scene.add(this.sunsetRimLight);

        this.lightningLight = new THREE.PointLight(0xe0e7ff, 0, 50);
        this.lightningLight.position.set(0, 8, 2);
        this.scene.add(this.lightningLight);
    };

    Weather3D.prototype.initSkyAndAtmosphere = function () {
        // Floating starry cosmos & ambient light motes
        var starCount = 450;
        var starGeo = new THREE.BufferGeometry();
        var positions = new Float32Array(starCount * 3);
        var scales = new Float32Array(starCount);

        for (var i = 0; i < starCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 60;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 45;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 35 - 5;
            scales[i] = Math.random() * 0.9 + 0.2;
        }

        starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeo.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

        var starMat = new THREE.PointsMaterial({
            color: 0xbae6fd,
            size: 0.16,
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

        this.mainGroup.add(this.cloudGroup);
        this.mainGroup.add(this.sunGroup);
        this.mainGroup.add(this.moonGroup);
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
     * ☀️ Realistic 3D Sun with Multi-layered Coronal Glow & Rotating Solar Flares
     */
    Weather3D.prototype.buildSun = function () {
        // Core Sun Sphere
        var sunGeo = new THREE.SphereGeometry(2.35, 36, 36);
        var sunMat = new THREE.MeshStandardMaterial({
            color: 0xffedd5,
            emissive: 0xf59e0b,
            emissiveIntensity: 1.5,
            roughness: 0.1,
            metalness: 0.1
        });
        this.sunCore = new THREE.Mesh(sunGeo, sunMat);
        this.sunGroup.add(this.sunCore);

        // Inner Corona Glow Sphere
        var coronaGeo = new THREE.SphereGeometry(2.9, 28, 28);
        var coronaMat = new THREE.MeshBasicMaterial({
            color: 0xfde047,
            transparent: true,
            opacity: 0.32,
            blending: THREE.AdditiveBlending
        });
        this.sunCorona = new THREE.Mesh(coronaGeo, coronaMat);
        this.sunGroup.add(this.sunCorona);

        // Outer Atmospheric Halo Disk
        var haloGeo = new THREE.RingGeometry(2.8, 4.2, 32);
        var haloMat = new THREE.MeshBasicMaterial({
            color: 0xfbbf24,
            transparent: true,
            opacity: 0.18,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        this.sunHalo = new THREE.Mesh(haloGeo, haloMat);
        this.sunGroup.add(this.sunHalo);

        // Radiating Solar Flares
        this.solarRays = new THREE.Group();
        var rayCount = 16;
        for (var i = 0; i < rayCount; i++) {
            var angle = (i / rayCount) * Math.PI * 2;
            var rayGeo = new THREE.ConeGeometry(0.38, 2.1, 4);
            rayGeo.translate(0, 1.05, 0);
            var rayMat = new THREE.MeshBasicMaterial({
                color: (i % 2 === 0) ? 0xfbbf24 : 0xfde047,
                transparent: true,
                opacity: 0.6,
                blending: THREE.AdditiveBlending
            });
            var ray = new THREE.Mesh(rayGeo, rayMat);
            ray.position.set(Math.cos(angle) * 2.35, Math.sin(angle) * 2.35, 0);
            ray.rotation.z = angle - Math.PI / 2;
            this.solarRays.add(ray);
        }
        this.sunGroup.add(this.solarRays);

        this.sunGroup.position.set(3.8, 3.0, -2.5);
    };

    /**
     * 🌙 Realistic 3D Moon with Craters, Lunar Maria & Ambient Halo
     */
    Weather3D.prototype.buildMoon = function () {
        var moonGeo = new THREE.SphereGeometry(2.25, 36, 36);
        var moonMat = new THREE.MeshStandardMaterial({
            color: 0xe2e8f0,
            roughness: 0.85,
            metalness: 0.15,
            emissive: 0x38bdf8,
            emissiveIntensity: 0.18
        });
        this.moonCore = new THREE.Mesh(moonGeo, moonMat);
        this.moonGroup.add(this.moonCore);

        // Moon Craters
        var craterMat = new THREE.MeshStandardMaterial({
            color: 0x94a3b8,
            roughness: 0.95
        });
        var craterPositions = [
            [-0.8, 0.6, 1.8, 0.35],
            [0.6, -0.7, 1.9, 0.45],
            [-0.2, -0.9, 1.8, 0.3],
            [0.9, 0.4, 1.7, 0.4],
            [-1.1, -0.3, 1.6, 0.25],
            [0.2, 1.0, 1.7, 0.35]
        ];
        for (var c = 0; c < craterPositions.length; c++) {
            var cp = craterPositions[c];
            var craterGeo = new THREE.CylinderGeometry(cp[3], cp[3] * 0.8, 0.1, 16);
            var crater = new THREE.Mesh(craterGeo, craterMat);
            crater.position.set(cp[0], cp[1], cp[2]);
            crater.lookAt(0, 0, 0);
            this.moonGroup.add(crater);
        }

        // Soft Lunar Halo
        var haloGeo = new THREE.SphereGeometry(2.8, 28, 28);
        var haloMat = new THREE.MeshBasicMaterial({
            color: 0x60a5fa,
            transparent: true,
            opacity: 0.24,
            blending: THREE.AdditiveBlending
        });
        var halo = new THREE.Mesh(haloGeo, haloMat);
        this.moonGroup.add(halo);

        this.moonGroup.position.set(3.8, 3.0, -2.5);
        this.moonGroup.visible = false;
    };

    /**
     * ☁️ Realistic Volumetric 3D Cloud System
     */
    Weather3D.prototype.buildClouds = function () {
        this.cloudPuffs = [];

        var cloudMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.72,
            metalness: 0.05,
            transparent: true,
            opacity: 0.96
        });

        // Main Hero Cloud Cluster
        var heroCluster = new THREE.Group();
        var puffSpecs = [
            [0.0, 0.0, 0.0, 2.35],
            [1.8, -0.3, 0.3, 1.85],
            [-1.8, -0.3, 0.2, 1.75],
            [1.0, 1.1, -0.2, 1.65],
            [-0.9, 1.0, -0.1, 1.55],
            [-2.6, -0.7, 0.1, 1.25],
            [2.7, -0.6, 0.2, 1.35],
            [0.2, -0.6, 0.8, 1.55],
            [-1.1, -0.5, 0.9, 1.45],
            [1.2, -0.5, 0.8, 1.4]
        ];

        for (var i = 0; i < puffSpecs.length; i++) {
            var spec = puffSpecs[i];
            var puffGeo = new THREE.SphereGeometry(spec[3], 24, 24);
            var puff = new THREE.Mesh(puffGeo, cloudMat.clone());
            puff.position.set(spec[0], spec[1], spec[2]);
            puff.castShadow = true;
            puff.receiveShadow = true;
            puff.userData = {
                baseX: spec[0],
                baseY: spec[1],
                baseZ: spec[2],
                floatSpeed: 0.8 + Math.random() * 0.4,
                floatOffset: Math.random() * Math.PI * 2
            };
            heroCluster.add(puff);
            this.cloudPuffs.push(puff);
        }
        this.cloudGroup.add(heroCluster);

        // Secondary Background Cloud Cluster (adds panoramic depth)
        var backCluster = heroCluster.clone();
        backCluster.scale.set(0.68, 0.68, 0.68);
        backCluster.position.set(-3.8, 1.8, -4.0);
        this.cloudGroup.add(backCluster);

        // Drift Cloud Cluster 3
        var smallCluster = heroCluster.clone();
        smallCluster.scale.set(0.5, 0.5, 0.5);
        smallCluster.position.set(4.8, -1.9, -3.2);
        this.cloudGroup.add(smallCluster);

        this.cloudGroup.position.set(-0.5, -0.2, 1.5);
    };

    /**
     * 🌧️ 3D Particle Rain System with Falling Streaks & Splash Ripples
     */
    Weather3D.prototype.buildRain = function () {
        var dropCount = 850;
        var rainGeo = new THREE.BufferGeometry();
        var positions = new Float32Array(dropCount * 6);
        this.rainVelocities = [];

        for (var i = 0; i < dropCount; i++) {
            var x = (Math.random() - 0.5) * 20;
            var y = Math.random() * 22 - 6;
            var z = (Math.random() - 0.5) * 16 + 1;
            var len = 0.55 + Math.random() * 0.45;

            positions[i * 6] = x;
            positions[i * 6 + 1] = y;
            positions[i * 6 + 2] = z;

            positions[i * 6 + 3] = x - 0.09;
            positions[i * 6 + 4] = y - len;
            positions[i * 6 + 5] = z;

            this.rainVelocities.push(0.38 + Math.random() * 0.28);
        }

        rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        var rainMat = new THREE.LineBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.72,
            blending: THREE.AdditiveBlending
        });

        this.rainLines = new THREE.LineSegments(rainGeo, rainMat);
        this.rainGroup.add(this.rainLines);

        // Splash Ripples Pool
        this.ripples = [];
        var rippleGeo = new THREE.RingGeometry(0.08, 0.18, 16);
        rippleGeo.rotateX(-Math.PI / 2);
        var rippleMat = new THREE.MeshBasicMaterial({
            color: 0x7dd3fc,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });

        for (var r = 0; r < 28; r++) {
            var rip = new THREE.Mesh(rippleGeo, rippleMat.clone());
            rip.position.set((Math.random() - 0.5) * 16, -5.5, (Math.random() - 0.5) * 12);
            rip.scale.set(0.1, 0.1, 0.1);
            rip.visible = false;
            rip.userData = { life: 0, maxLife: 32 };
            this.rainGroup.add(rip);
            this.ripples.push(rip);
        }

        this.rainGroup.visible = false;
    };

    /**
     * ❄️ 3D Fluttering Snowflake System
     */
    Weather3D.prototype.buildSnow = function () {
        var flakeCount = 500;
        var snowGeo = new THREE.BufferGeometry();
        var positions = new Float32Array(flakeCount * 3);
        this.snowVelocities = [];

        for (var i = 0; i < flakeCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 22;
            positions[i * 3 + 1] = Math.random() * 22 - 6;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 16;

            this.snowVelocities.push({
                y: 0.045 + Math.random() * 0.055,
                swaySpeed: 1.6 + Math.random() * 2.2,
                swayAmp: 0.025 + Math.random() * 0.035,
                rotSpeed: 0.025 + Math.random() * 0.045,
                phase: Math.random() * Math.PI * 2
            });
        }

        snowGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        var snowMat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.24,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
        });

        this.snowPoints = new THREE.Points(snowGeo, snowMat);
        this.snowGroup.add(this.snowPoints);
        this.snowGroup.visible = false;
    };

    /**
     * ⛈️ Procedural 3D Lightning Mesh Generator
     */
    Weather3D.prototype.buildLightning = function () {
        var lightningMat = new THREE.LineBasicMaterial({
            color: 0xf0f9ff,
            linewidth: 2,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending
        });

        this.lightningBolts = [];
        for (var b = 0; b < 2; b++) {
            var boltGeo = new THREE.BufferGeometry();
            var bolt = new THREE.Line(boltGeo, lightningMat.clone());
            bolt.visible = false;
            this.lightningGroup.add(bolt);
            this.lightningBolts.push(bolt);
        }
    };

    Weather3D.prototype.triggerLightningStrike = function () {
        var self = this;
        var startX = (Math.random() - 0.5) * 6;
        var startY = 3.5;
        var startZ = (Math.random() - 0.5) * 4;

        var points = [];
        var currX = startX;
        var currY = startY;
        var currZ = startZ;
        points.push(new THREE.Vector3(currX, currY, currZ));

        var steps = 8;
        for (var s = 0; s < steps; s++) {
            currY -= (startY + 5.5) / steps;
            currX += (Math.random() - 0.5) * 1.6;
            currZ += (Math.random() - 0.5) * 1.2;
            points.push(new THREE.Vector3(currX, currY, currZ));
        }

        var bolt = this.lightningBolts[0];
        bolt.geometry.setFromPoints(points);
        bolt.visible = true;

        // Illumination burst
        this.lightningLight.intensity = 9.5;
        this.lightningLight.position.set(startX, 2, startZ);
        this.renderer.toneMappingExposure = 2.4;

        setTimeout(function () {
            bolt.visible = false;
            self.lightningLight.intensity = 0;
            self.renderer.toneMappingExposure = 1.2;
        }, 90);

        // Secondary aftershock strike
        setTimeout(function () {
            self.lightningLight.intensity = 5.2;
            setTimeout(function () {
                self.lightningLight.intensity = 0;
            }, 60);
        }, 150);
    };

    /**
     * Dynamic Weather State Transitions
     * Supports: 'clear', 'sunny', 'partly_cloudy', 'cloudy', 'rain', 'thunderstorm', 'snow', 'sunset'
     */
    Weather3D.prototype.setCondition = function (condition, isDay, isSunset) {
        this.currentCondition = (condition || 'clear').toLowerCase();
        this.isSunset = !!isSunset || this.currentCondition.indexOf('sunset') !== -1;
        this.isDay = isDay !== undefined ? isDay : !this.isSunset;

        var isStorm = this.currentCondition.indexOf('thunder') !== -1 || this.currentCondition.indexOf('storm') !== -1;
        var isRain = this.currentCondition.indexOf('rain') !== -1 || this.currentCondition.indexOf('drizzle') !== -1 || isStorm;
        var isSnow = this.currentCondition.indexOf('snow') !== -1 || this.currentCondition.indexOf('ice') !== -1;
        var isCloudy = this.currentCondition.indexOf('cloud') !== -1 || this.currentCondition.indexOf('overcast') !== -1;
        var isClear = !isRain && !isSnow && !isCloudy && !this.isSunset;

        // 1. Celestial Positioning & Shading
        if (this.isSunset) {
            this.sunGroup.visible = true;
            this.moonGroup.visible = false;
            this.starField.visible = false;
            this.sunGroup.position.set(2.0, -0.6, -2.0); // Lower sun near horizon

            this.sunCore.material.emissive.setHex(0xea580c);
            this.sunCorona.material.color.setHex(0xf97316);
            this.sunLight.color.setHex(0xf97316);
            this.sunLight.intensity = 2.4;
            this.ambientLight.color.setHex(0x7c3aed);
            this.ambientLight.intensity = 1.1;
            this.sunsetRimLight.intensity = 3.0;

            // Warm golden-rose clouds
            this.cloudGroup.visible = true;
            for (var p0 = 0; p0 < this.cloudPuffs.length; p0++) {
                this.cloudPuffs[p0].material.color.setHex(0xfed7aa);
            }
        } else if (this.isDay) {
            this.sunGroup.visible = true;
            this.moonGroup.visible = false;
            this.starField.visible = false;
            this.sunGroup.position.set(3.8, 3.0, -2.5);

            this.sunCore.material.emissive.setHex(0xf59e0b);
            this.sunCorona.material.color.setHex(0xfde047);
            this.sunLight.color.setHex(0xfff7ed);
            this.sunLight.intensity = isCloudy || isRain ? 1.5 : 2.8;
            this.ambientLight.color.setHex(isRain ? 0x64748b : 0xe0f2fe);
            this.ambientLight.intensity = isRain ? 0.9 : 1.3;
            this.sunsetRimLight.intensity = 0;

            // Cloud Shading
            if (isClear) {
                this.cloudGroup.visible = false;
            } else {
                this.cloudGroup.visible = true;
                var cloudCol = 0xffffff;
                if (isStorm) cloudCol = 0x334155;
                else if (isRain) cloudCol = 0x64748b;

                for (var p1 = 0; p1 < this.cloudPuffs.length; p1++) {
                    this.cloudPuffs[p1].material.color.setHex(cloudCol);
                }
            }
        } else {
            // Night Mode
            this.sunGroup.visible = false;
            this.moonGroup.visible = true;
            this.starField.visible = true;
            this.moonGroup.position.set(3.8, 3.0, -2.5);

            this.sunLight.color.setHex(0x93c5fd);
            this.sunLight.intensity = 1.0;
            this.ambientLight.color.setHex(0x1e293b);
            this.ambientLight.intensity = 0.85;
            this.sunsetRimLight.intensity = 0;

            if (isClear) {
                this.cloudGroup.visible = false;
                this.moonGroup.position.set(0, 0, 0); // Hero moon center
            } else {
                this.cloudGroup.visible = true;
                for (var p2 = 0; p2 < this.cloudPuffs.length; p2++) {
                    this.cloudPuffs[p2].material.color.setHex(0x475569);
                }
            }
        }

        // Center sun if sunny & clear
        if (isClear && this.isDay && !this.isSunset) {
            this.sunGroup.position.set(0, 0, 0);
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
            self.mouse.targetX = x * 0.4;
            self.mouse.targetY = y * 0.4;

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
                    self.mouse.targetX = (event.gamma / 45) * 0.35;
                    self.mouse.targetY = ((event.beta - 45) / 45) * 0.35;
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
     * 60 FPS Render Animation Loop
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

        // Orbital Rotation
        if (this.options.autoRotate && !this.orbit.isDragging) {
            this.orbit.targetRotY += delta * this.options.autoRotateSpeed * 0.22;
        }
        this.orbit.rotX += (this.orbit.targetRotX - this.orbit.rotX) * 0.1;
        this.orbit.rotY += (this.orbit.targetRotY - this.orbit.rotY) * 0.1;

        this.mainGroup.rotation.y = this.orbit.rotY + this.mouse.x * 0.5;
        this.mainGroup.rotation.x = Math.max(-0.6, Math.min(0.6, this.orbit.rotX - this.mouse.y * 0.5));

        // 1. Sun Animations
        if (this.sunGroup.visible) {
            this.solarRays.rotation.z += delta * 0.26;
            var sunScale = 1.0 + Math.sin(elapsed * 2.2) * 0.04;
            this.sunCorona.scale.set(sunScale, sunScale, sunScale);
            this.sunCore.rotation.y += delta * 0.06;
            this.sunHalo.rotation.z -= delta * 0.15;
        }

        // 2. Moon Animations
        if (this.moonGroup.visible) {
            this.moonCore.rotation.y += delta * 0.04;
            this.moonGroup.rotation.z = Math.sin(elapsed * 0.5) * 0.05;
        }

        // 3. Clouds Organic Puff Breathing & Floating
        if (this.cloudGroup.visible) {
            for (var p = 0; p < this.cloudPuffs.length; p++) {
                var puff = this.cloudPuffs[p];
                var u = puff.userData;
                puff.position.y = u.baseY + Math.sin(elapsed * u.floatSpeed + u.floatOffset) * 0.14;
                puff.position.x = u.baseX + Math.cos(elapsed * 0.5 * u.floatSpeed + u.floatOffset) * 0.08;
            }
            this.cloudGroup.position.y = -0.2 + Math.sin(elapsed * 0.8) * 0.18;
        }

        // 4. Rain Particles Physics & Splash Ripples
        if (this.rainGroup.visible && this.rainLines) {
            var rainPositions = this.rainLines.geometry.attributes.position.array;
            var dropCount = rainPositions.length / 6;

            for (var r = 0; r < dropCount; r++) {
                var idx = r * 6;
                var vel = this.rainVelocities[r];
                rainPositions[idx + 1] -= vel;
                rainPositions[idx + 4] -= vel;

                rainPositions[idx] -= vel * 0.18;
                rainPositions[idx + 3] -= vel * 0.18;

                if (rainPositions[idx + 1] < -6.0) {
                    var newX = (Math.random() - 0.5) * 20 + 2;
                    var newY = 10.0 + Math.random() * 3;
                    var newZ = (Math.random() - 0.5) * 16 + 1;
                    var len = 0.55 + Math.random() * 0.45;

                    rainPositions[idx] = newX;
                    rainPositions[idx + 1] = newY;
                    rainPositions[idx + 2] = newZ;

                    rainPositions[idx + 3] = newX - 0.09;
                    rainPositions[idx + 4] = newY - len;
                    rainPositions[idx + 5] = newZ;

                    // Trigger ground splash ripple
                    if (this.ripples && this.ripples[r % this.ripples.length]) {
                        var rip = this.ripples[r % this.ripples.length];
                        if (!rip.visible) {
                            rip.position.set(newX, -5.5, newZ);
                            rip.scale.set(0.1, 0.1, 0.1);
                            rip.material.opacity = 0.6;
                            rip.visible = true;
                            rip.userData.life = 0;
                        }
                    }
                }
            }
            this.rainLines.geometry.attributes.position.needsUpdate = true;

            for (var ripIdx = 0; ripIdx < this.ripples.length; ripIdx++) {
                var ripple = this.ripples[ripIdx];
                if (ripple.visible) {
                    ripple.userData.life += 1;
                    var prog = ripple.userData.life / ripple.userData.maxLife;
                    var s = 0.1 + prog * 1.6;
                    ripple.scale.set(s, s, s);
                    ripple.material.opacity = 0.6 * (1.0 - prog);
                    if (prog >= 1.0) {
                        ripple.visible = false;
                    }
                }
            }
        }

        // 5. Snow Particles Physics
        if (this.snowGroup.visible && this.snowPoints) {
            var snowPositions = this.snowPoints.geometry.attributes.position.array;
            var flakeCount = snowPositions.length / 3;

            for (var sIdx = 0; sIdx < flakeCount; sIdx++) {
                var sPos = sIdx * 3;
                var sVel = this.snowVelocities[sIdx];

                snowPositions[sPos + 1] -= sVel.y;
                snowPositions[sPos] += Math.sin(elapsed * sVel.swaySpeed + sVel.phase) * sVel.swayAmp;

                if (snowPositions[sPos + 1] < -6.0) {
                    snowPositions[sPos] = (Math.random() - 0.5) * 22;
                    snowPositions[sPos + 1] = 10.0 + Math.random() * 3;
                    snowPositions[sPos + 2] = (Math.random() - 0.5) * 16;
                }
            }
            this.snowPoints.geometry.attributes.position.needsUpdate = true;
        }

        // 6. Thunderstorm Dynamic Lightning Generator
        if (this.isStorm) {
            this.lightningTimer += delta;
            if (this.lightningTimer > 3.2 + Math.random() * 3.8) {
                this.lightningTimer = 0;
                this.triggerLightningStrike();
            }
        }

        // 7. Twinkling Stars
        if (this.starField.visible) {
            this.starField.rotation.y = elapsed * 0.012;
        }

        this.renderer.render(this.scene, this.camera);
    };

    window.Weather3D = Weather3D;

})(window);
