/**
 * Atmosphere 3D - High Fidelity Three.js Weather Visualization Engine
 * Features:
 * - Procedural 3D Volumetric Fluffy Clouds with Fresnel Lighting
 * - Radiant 3D Sun with Multi-layered Coronal Rays & Pulsing Flares
 * - Realistic 3D Moon with Crater Shading & Sparkling Starlight Field
 * - 3D Particle Rain Physics with Wind Deflection & Ground Splash Ripples
 * - 3D Fluttering Snowflake System with Swirling Air Turbulence
 * - Thunderstorm Dynamic Lightning Generator & Volumetric Cloud Illumination
 * - 360-Degree Touch / Mouse Orbital Interaction & Gyroscopic Parallax
 * - Smooth Day/Night & Meteorological State Transitions
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
            initialCondition: 'clear',
            isDay: true,
            interactive: true,
            enableParallax: true,
            autoRotate: true,
            autoRotateSpeed: 0.4
        }, options || {});

        this.currentCondition = this.options.initialCondition;
        this.isDay = this.options.isDay;
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
        this.setCondition(this.currentCondition, this.isDay);
        this.animate();
    }

    Weather3D.prototype.initThree = function () {
        var width = this.container.clientWidth || 360;
        var height = this.container.clientHeight || 300;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
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
        this.renderer.toneMappingExposure = 1.15;

        // Clean any existing canvas
        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);

        this.mainGroup = new THREE.Group();
        this.scene.add(this.mainGroup);
    };

    Weather3D.prototype.initLights = function () {
        this.ambientLight = new THREE.AmbientLight(0xdbeafe, 1.2);
        this.scene.add(this.ambientLight);

        this.sunLight = new THREE.DirectionalLight(0xfff7ed, 2.5);
        this.sunLight.position.set(12, 16, 10);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 1024;
        this.sunLight.shadow.mapSize.height = 1024;
        this.scene.add(this.sunLight);

        this.rimLight = new THREE.PointLight(0x38bdf8, 2.0, 30);
        this.rimLight.position.set(-10, -5, 8);
        this.scene.add(this.rimLight);

        this.lightningLight = new THREE.PointLight(0xe0e7ff, 0, 40);
        this.lightningLight.position.set(0, 8, 2);
        this.scene.add(this.lightningLight);
    };

    Weather3D.prototype.initSkyAndAtmosphere = function () {
        // Floating ambient dust motes / stars
        var starCount = 350;
        var starGeo = new THREE.BufferGeometry();
        var positions = new Float32Array(starCount * 3);
        var scales = new Float32Array(starCount);

        for (var i = 0; i < starCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 50;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 30 - 5;
            scales[i] = Math.random() * 0.8 + 0.2;
        }

        starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeo.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

        var starMat = new THREE.PointsMaterial({
            color: 0x93c5fd,
            size: 0.14,
            transparent: true,
            opacity: 0.5,
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

        this.mainGroup.add(this.cloudGroup);
        this.mainGroup.add(this.sunGroup);
        this.mainGroup.add(this.moonGroup);
        this.mainGroup.add(this.rainGroup);
        this.mainGroup.add(this.snowGroup);

        this.buildSun();
        this.buildMoon();
        this.buildClouds();
        this.buildRain();
        this.buildSnow();
    };

    /**
     * Realistic 3D Sun with Radiant Core, Coronal Glow & Solar Ray Flares
     */
    Weather3D.prototype.buildSun = function () {
        // Core Sun Sphere
        var sunGeo = new THREE.SphereGeometry(2.3, 36, 36);
        var sunMat = new THREE.MeshStandardMaterial({
            color: 0xffedd5,
            emissive: 0xf59e0b,
            emissiveIntensity: 1.4,
            roughness: 0.1,
            metalness: 0.1
        });
        this.sunCore = new THREE.Mesh(sunGeo, sunMat);
        this.sunGroup.add(this.sunCore);

        // Inner Corona Glow
        var coronaGeo = new THREE.SphereGeometry(2.8, 24, 24);
        var coronaMat = new THREE.MeshBasicMaterial({
            color: 0xfde047,
            transparent: true,
            opacity: 0.28,
            blending: THREE.AdditiveBlending
        });
        this.sunCorona = new THREE.Mesh(coronaGeo, coronaMat);
        this.sunGroup.add(this.sunCorona);

        // Radiating Solar Flares
        this.solarRays = new THREE.Group();
        var rayCount = 14;
        for (var i = 0; i < rayCount; i++) {
            var angle = (i / rayCount) * Math.PI * 2;
            var rayGeo = new THREE.ConeGeometry(0.35, 1.8, 4);
            rayGeo.translate(0, 0.9, 0);
            var rayMat = new THREE.MeshBasicMaterial({
                color: 0xfbbf24,
                transparent: true,
                opacity: 0.55,
                blending: THREE.AdditiveBlending
            });
            var ray = new THREE.Mesh(rayGeo, rayMat);
            ray.position.set(Math.cos(angle) * 2.3, Math.sin(angle) * 2.3, 0);
            ray.rotation.z = angle - Math.PI / 2;
            this.solarRays.add(ray);
        }
        this.sunGroup.add(this.solarRays);

        this.sunGroup.position.set(4.0, 3.2, -2.5);
    };

    /**
     * Realistic 3D Moon with Procedural Craters and Ambient Lunar Ring
     */
    Weather3D.prototype.buildMoon = function () {
        var moonGeo = new THREE.SphereGeometry(2.2, 36, 36);
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
        var craterCount = 8;
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
        var haloGeo = new THREE.SphereGeometry(2.7, 24, 24);
        var haloMat = new THREE.MeshBasicMaterial({
            color: 0x60a5fa,
            transparent: true,
            opacity: 0.22,
            blending: THREE.AdditiveBlending
        });
        var halo = new THREE.Mesh(haloGeo, haloMat);
        this.moonGroup.add(halo);

        this.moonGroup.position.set(4.0, 3.2, -2.5);
        this.moonGroup.visible = false;
    };

    /**
     * Volumetric 3D Cloud System
     * Puffy clustered spheres with organic offsets, transmission and soft shadows
     */
    Weather3D.prototype.buildClouds = function () {
        this.cloudPuffs = [];

        var cloudMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.75,
            metalness: 0.05,
            transparent: true,
            opacity: 0.95
        });

        // Main Hero Cloud Cluster
        var heroCluster = new THREE.Group();
        var puffSpecs = [
            // [x, y, z, radius]
            [0.0, 0.0, 0.0, 2.3],
            [1.8, -0.3, 0.3, 1.8],
            [-1.8, -0.3, 0.2, 1.7],
            [1.0, 1.1, -0.2, 1.6],
            [-0.9, 1.0, -0.1, 1.5],
            [-2.6, -0.7, 0.1, 1.2],
            [2.7, -0.6, 0.2, 1.3],
            [0.2, -0.6, 0.8, 1.5],
            [-1.1, -0.5, 0.9, 1.4],
            [1.2, -0.5, 0.8, 1.35]
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

        // Secondary Background Cloud Cluster (adds depth)
        var backCluster = heroCluster.clone();
        backCluster.scale.set(0.65, 0.65, 0.65);
        backCluster.position.set(-3.5, 1.6, -4.0);
        this.cloudGroup.add(backCluster);

        // Drift Cloud 3
        var smallCluster = heroCluster.clone();
        smallCluster.scale.set(0.48, 0.48, 0.48);
        smallCluster.position.set(4.5, -1.8, -3.0);
        this.cloudGroup.add(smallCluster);

        this.cloudGroup.position.set(-0.5, -0.2, 1.5);
    };

    /**
     * 3D Physics Rain Particle System
     * High performance falling streaks + ground ripple rings
     */
    Weather3D.prototype.buildRain = function () {
        var dropCount = 600;
        var rainGeo = new THREE.BufferGeometry();
        var positions = new Float32Array(dropCount * 6); // 2 vertices per line segment
        this.rainVelocities = [];

        for (var i = 0; i < dropCount; i++) {
            var x = (Math.random() - 0.5) * 18;
            var y = Math.random() * 20 - 5;
            var z = (Math.random() - 0.5) * 14 + 1;
            var len = 0.5 + Math.random() * 0.4;

            positions[i * 6] = x;
            positions[i * 6 + 1] = y;
            positions[i * 6 + 2] = z;

            positions[i * 6 + 3] = x - 0.08;
            positions[i * 6 + 4] = y - len;
            positions[i * 6 + 5] = z;

            this.rainVelocities.push(0.35 + Math.random() * 0.25);
        }

        rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        var rainMat = new THREE.LineBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.65,
            blending: THREE.AdditiveBlending
        });

        this.rainLines = new THREE.LineSegments(rainGeo, rainMat);
        this.rainGroup.add(this.rainLines);

        // Splash Ripples Pool
        this.ripples = [];
        var rippleGeo = new THREE.RingGeometry(0.08, 0.16, 16);
        rippleGeo.rotateX(-Math.PI / 2);
        var rippleMat = new THREE.MeshBasicMaterial({
            color: 0x7dd3fc,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });

        for (var r = 0; r < 20; r++) {
            var rip = new THREE.Mesh(rippleGeo, rippleMat.clone());
            rip.position.set((Math.random() - 0.5) * 14, -5.5, (Math.random() - 0.5) * 10);
            rip.scale.set(0.1, 0.1, 0.1);
            rip.visible = false;
            rip.userData = { life: 0, maxLife: 30 };
            this.rainGroup.add(rip);
            this.ripples.push(rip);
        }

        this.rainGroup.visible = false;
    };

    /**
     * 3D Fluttering Snowflake System
     */
    Weather3D.prototype.buildSnow = function () {
        var flakeCount = 450;
        var snowGeo = new THREE.BufferGeometry();
        var positions = new Float32Array(flakeCount * 3);
        this.snowVelocities = [];

        for (var i = 0; i < flakeCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 20;
            positions[i * 3 + 1] = Math.random() * 20 - 5;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 14;

            this.snowVelocities.push({
                y: 0.04 + Math.random() * 0.05,
                swaySpeed: 1.5 + Math.random() * 2.0,
                swayAmp: 0.02 + Math.random() * 0.03,
                rotSpeed: 0.02 + Math.random() * 0.04,
                phase: Math.random() * Math.PI * 2
            });
        }

        snowGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        var snowMat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.22,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending
        });

        this.snowPoints = new THREE.Points(snowGeo, snowMat);
        this.snowGroup.add(this.snowPoints);
        this.snowGroup.visible = false;
    };

    /**
     * Dynamic Weather State Transitions
     */
    Weather3D.prototype.setCondition = function (condition, isDay) {
        this.currentCondition = (condition || 'clear').toLowerCase();
        this.isDay = isDay !== undefined ? isDay : true;

        var isStorm = this.currentCondition.indexOf('thunder') !== -1 || this.currentCondition.indexOf('storm') !== -1;
        var isRain = this.currentCondition.indexOf('rain') !== -1 || this.currentCondition.indexOf('drizzle') !== -1 || isStorm;
        var isSnow = this.currentCondition.indexOf('snow') !== -1 || this.currentCondition.indexOf('ice') !== -1;
        var isCloudy = this.currentCondition.indexOf('cloud') !== -1 || this.currentCondition.indexOf('overcast') !== -1;
        var isClear = !isRain && !isSnow && !isCloudy;

        // Visibility of 3D Celestial Elements
        if (this.isDay) {
            this.sunGroup.visible = true;
            this.moonGroup.visible = false;
            this.starField.visible = false;
            this.sunLight.color.setHex(0xfff7ed);
            this.sunLight.intensity = isCloudy || isRain ? 1.5 : 2.8;
            this.ambientLight.color.setHex(isRain ? 0x64748b : 0xe0f2fe);
            this.ambientLight.intensity = isRain ? 0.9 : 1.3;
        } else {
            this.sunGroup.visible = false;
            this.moonGroup.visible = true;
            this.starField.visible = true;
            this.sunLight.color.setHex(0x93c5fd);
            this.sunLight.intensity = 1.0;
            this.ambientLight.color.setHex(0x1e293b);
            this.ambientLight.intensity = 0.8;
        }

        // Visibility and Shading of Clouds
        if (isClear) {
            this.cloudGroup.visible = false;
        } else {
            this.cloudGroup.visible = true;
            var cloudColor = 0xffffff;
            if (isStorm) {
                cloudColor = 0x334155;
            } else if (isRain) {
                cloudColor = 0x64748b;
            } else if (!this.isDay) {
                cloudColor = 0x475569;
            }

            for (var p = 0; p < this.cloudPuffs.length; p++) {
                this.cloudPuffs[p].material.color.setHex(cloudColor);
            }
        }

        // Precipitation
        this.rainGroup.visible = isRain;
        this.snowGroup.visible = isSnow;

        // Position adjustment: if sunny/clear, center the sun/moon hero
        if (isClear) {
            if (this.isDay) {
                this.sunGroup.position.set(0, 0, 0);
            } else {
                this.moonGroup.position.set(0, 0, 0);
            }
        } else {
            this.sunGroup.position.set(3.8, 2.8, -2.5);
            this.moonGroup.position.set(3.8, 2.8, -2.5);
        }

        this.isStorm = isStorm;
        this.lightningTimer = 0;
    };

    Weather3D.prototype.setupEventListeners = function () {
        var self = this;
        var dom = this.renderer.domElement;

        // Mouse Drag Interaction
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

        // Touch Interaction
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

        // Window Resize handling
        window.addEventListener('resize', function () {
            self.onWindowResize();
        });

        // Device Orientation Gyroscope Parallax (Mobile)
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
     * Animation Loop - 60 FPS Optimized
     */
    Weather3D.prototype.animate = function () {
        var self = this;
        requestAnimationFrame(function () {
            self.animate();
        });

        var delta = this.clock.getDelta();
        var elapsed = this.clock.getElapsedTime();

        // Smooth Parallax Damping
        this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.08;
        this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.08;

        // Orbital Rotation Damping
        if (this.options.autoRotate && !this.orbit.isDragging) {
            this.orbit.targetRotY += delta * this.options.autoRotateSpeed * 0.2;
        }
        this.orbit.rotX += (this.orbit.targetRotX - this.orbit.rotX) * 0.1;
        this.orbit.rotY += (this.orbit.targetRotY - this.orbit.rotY) * 0.1;

        // Apply transforms to scene container
        this.mainGroup.rotation.y = this.orbit.rotY + this.mouse.x * 0.5;
        this.mainGroup.rotation.x = Math.max(-0.6, Math.min(0.6, this.orbit.rotX - this.mouse.y * 0.5));

        // 1. Sun Animations
        if (this.sunGroup.visible) {
            this.solarRays.rotation.z += delta * 0.25;
            var sunScale = 1.0 + Math.sin(elapsed * 2.2) * 0.04;
            this.sunCorona.scale.set(sunScale, sunScale, sunScale);
            this.sunCore.rotation.y += delta * 0.05;
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

        // 4. Rain Particles Physics
        if (this.rainGroup.visible && this.rainLines) {
            var rainPositions = this.rainLines.geometry.attributes.position.array;
            var dropCount = rainPositions.length / 6;

            for (var r = 0; r < dropCount; r++) {
                var idx = r * 6;
                var vel = this.rainVelocities[r];
                rainPositions[idx + 1] -= vel;
                rainPositions[idx + 4] -= vel;

                // Wind angle
                rainPositions[idx] -= vel * 0.18;
                rainPositions[idx + 3] -= vel * 0.18;

                // Reset drop to top when it reaches bottom
                if (rainPositions[idx + 1] < -6.0) {
                    var newX = (Math.random() - 0.5) * 18 + 2;
                    var newY = 10.0 + Math.random() * 3;
                    var newZ = (Math.random() - 0.5) * 14 + 1;
                    var len = 0.5 + Math.random() * 0.4;

                    rainPositions[idx] = newX;
                    rainPositions[idx + 1] = newY;
                    rainPositions[idx + 2] = newZ;

                    rainPositions[idx + 3] = newX - 0.08;
                    rainPositions[idx + 4] = newY - len;
                    rainPositions[idx + 5] = newZ;

                    // Trigger ground ripple
                    if (this.ripples && this.ripples[r % this.ripples.length]) {
                        var rip = this.ripples[r % this.ripples.length];
                        if (!rip.visible) {
                            rip.position.set(newX, -5.5, newZ);
                            rip.scale.set(0.1, 0.1, 0.1);
                            rip.material.opacity = 0.55;
                            rip.visible = true;
                            rip.userData.life = 0;
                        }
                    }
                }
            }
            this.rainLines.geometry.attributes.position.needsUpdate = true;

            // Update ripples
            for (var ripIdx = 0; ripIdx < this.ripples.length; ripIdx++) {
                var ripple = this.ripples[ripIdx];
                if (ripple.visible) {
                    ripple.userData.life += 1;
                    var prog = ripple.userData.life / ripple.userData.maxLife;
                    var s = 0.1 + prog * 1.5;
                    ripple.scale.set(s, s, s);
                    ripple.material.opacity = 0.55 * (1.0 - prog);
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
                    snowPositions[sPos] = (Math.random() - 0.5) * 20;
                    snowPositions[sPos + 1] = 10.0 + Math.random() * 3;
                    snowPositions[sPos + 2] = (Math.random() - 0.5) * 14;
                }
            }
            this.snowPoints.geometry.attributes.position.needsUpdate = true;
        }

        // 6. Thunderstorm Dynamic Lightning
        if (this.isStorm) {
            this.lightningTimer += delta;
            if (this.lightningTimer > 3.5 + Math.random() * 4.0) {
                this.lightningTimer = 0;
                var selfRef = this;
                this.lightningLight.intensity = 8.5;
                this.renderer.toneMappingExposure = 2.4;
                setTimeout(function () {
                    selfRef.lightningLight.intensity = 0;
                    selfRef.renderer.toneMappingExposure = 1.15;
                }, 75);
                setTimeout(function () {
                    selfRef.lightningLight.intensity = 5.0;
                    setTimeout(function () {
                        selfRef.lightningLight.intensity = 0;
                    }, 50);
                }, 130);
            }
        }

        // 7. Twinkling Stars
        if (this.starField.visible) {
            this.starField.rotation.y = elapsed * 0.01;
        }

        this.renderer.render(this.scene, this.camera);
    };

    // Export to window
    window.Weather3D = Weather3D;

})(window);
