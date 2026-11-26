/**
 * Atmosphere 3D - World-Class Application Controller & Real-Time Engine
 * Connects Three.js 3D Weather Environment with Interactive UI, Charting, and Android Runtime
 */

(function (window) {
    'use strict';

    var app = {
        weather3D: null,
        currentUnit: 'C', // 'C' or 'F'
        currentTheme: 'light', // Light theme is primary default
        chartMode: 'temp', // 'temp' or 'rain'
        isSoundEnabled: false,
        audioCtx: null,
        weatherData: null,
        weatherCache: {},
        apiKey: 'fe0fd088524b43a952088ea92d879d93',

        savedCities: [
            { name: 'San Francisco', country: 'United States', tempC: 22, cond: 'Partly Cloudy', icon: 'partly_cloudy' },
            { name: 'Tokyo', country: 'Japan', tempC: 18, cond: 'Rain', icon: 'rain' },
            { name: 'London', country: 'United Kingdom', tempC: 14, cond: 'Cloudy', icon: 'cloudy' },
            { name: 'New York', country: 'United States', tempC: 27, cond: 'Sunny', icon: 'sunny' },
            { name: 'Reykjavik', country: 'Iceland', tempC: 1, cond: 'Snow', icon: 'snow' },
            { name: 'Ujjain', country: 'India', tempC: 25, cond: 'Clear Sky', icon: 'sunny' }
        ],

        init: function () {
            var self = this;

            // Load saved settings from localStorage (Light theme primary default)
            try {
                var storedUnit = localStorage.getItem('atmosphere_unit');
                if (storedUnit) this.currentUnit = storedUnit;

                var storedTheme = localStorage.getItem('atmosphere_theme');
                this.currentTheme = storedTheme ? storedTheme : 'light';

                var storedCities = localStorage.getItem('atmosphere_saved_cities');
                if (storedCities) this.savedCities = JSON.parse(storedCities);
            } catch (e) {}

            this.applyTheme(this.currentTheme);

            // Automatic periodic day/night sync timer (every 45s without page reload)
            setInterval(function () {
                if (self.weatherData) {
                    var currentIsDay = self.weatherData.isDay;
                    var updatedIsDay = true;
                    if (self.weatherData.sunriseRaw && self.weatherData.sunsetRaw) {
                        var nowUtc = Math.floor(Date.now() / 1000);
                        updatedIsDay = (nowUtc >= self.weatherData.sunriseRaw && nowUtc < self.weatherData.sunsetRaw);
                    } else if (self.weatherData.timezone !== undefined) {
                        var utcMs = Date.now() + (new Date().getTimezoneOffset() * 60000);
                        var cityHour = new Date(utcMs + (self.weatherData.timezone * 1000)).getHours();
                        updatedIsDay = (cityHour >= 6 && cityHour < 19);
                    }
                    if (currentIsDay !== undefined && currentIsDay !== updatedIsDay) {
                        self.weatherData.isDay = updatedIsDay;
                        self.renderWeather(self.weatherData);
                    }
                }
            }, 45000);

            // Initialize Three.js 3D Engine
            if (window.Weather3D) {
                this.weather3D = new window.Weather3D('heroWeatherCanvas', {
                    initialCondition: 'partly_cloudy',
                    isDay: true,
                    autoRotate: true,
                    autoRotateSpeed: 0.35
                });
            }

            this.setupUI();
            this.setupCardTilt();
            this.setupAudio();
            this.renderSavedCities();
            this.initDopplerRadar();
            this.setupCitySuggestions();

            // Initial Sample Data (Google Stitch benchmark)
            this.loadInitialSampleData();

            // Notify Android Bridge that Web UI is ready
            if (window.AndroidBridge && window.AndroidBridge.onWebReady) {
                try {
                    window.AndroidBridge.onWebReady();
                } catch (e) {
                    console.log('AndroidBridge call error:', e);
                }
            }
        },

        setupUI: function () {
            var self = this;

            // Unit Switcher (°C / °F)
            var unitBtn = document.getElementById('unitToggleBtn');
            if (unitBtn) {
                unitBtn.textContent = '°' + self.currentUnit;
                unitBtn.addEventListener('click', function () {
                    self.currentUnit = self.currentUnit === 'C' ? 'F' : 'C';
                    unitBtn.textContent = '°' + self.currentUnit;
                    try { localStorage.setItem('atmosphere_unit', self.currentUnit); } catch (e) {}
                    self.renderWeather(self.weatherData);
                });
            }

            // Theme Switcher (Dark / Light Mode)
            var themeBtn = document.getElementById('themeToggleBtn');
            if (themeBtn) {
                themeBtn.addEventListener('click', function () {
                    self.toggleTheme();
                });
            }

            // Current GPS Location Detection
            var locBtn = document.getElementById('locationBtn');
            if (locBtn) {
                locBtn.addEventListener('click', function () {
                    self.playChime();
                    self.showLoading('Detecting GPS Position', 'Triangulating live coordinates...');
                    if (window.AndroidBridge && window.AndroidBridge.requestCurrentLocation) {
                        window.AndroidBridge.requestCurrentLocation();
                    } else if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(function (pos) {
                            self.fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
                        }, function (err) {
                            self.hideLoading();
                            alert('Location permission denied or unavailable.');
                        });
                    } else {
                        self.hideLoading();
                    }
                });
            }

            // Search Bar is initialized with live autocomplete in setupCitySuggestions()

            // Preset 3D Switcher (Auto, Sun, Rain, Storm, Snow, Cloud, Sunset, Night)
            var presetBtns = document.querySelectorAll('.scene-btn[data-condition]');
            presetBtns.forEach(function (btn) {
                btn.addEventListener('click', function () {
                    presetBtns.forEach(function (b) { b.classList.remove('active'); });
                    btn.classList.add('active');
                    var cond = btn.getAttribute('data-condition');
                    if (cond === 'auto') {
                        self.isManualPresetActive = false;
                        if (self.originalWeatherData) {
                            self.renderWeather(self.originalWeatherData);
                        } else if (self.weatherData) {
                            self.renderWeather(self.weatherData);
                        }
                        return;
                    }
                    var isDay = btn.getAttribute('data-day') !== 'false';
                    var isSunset = btn.getAttribute('data-sunset') === 'true';
                    self.setConditionPreset(cond, isDay, isSunset);
                });
            });

            // Chart Metric Switcher (Temperature vs Rain Probability)
            var chartPills = document.querySelectorAll('.chart-pill-btn');
            chartPills.forEach(function (pill) {
                pill.addEventListener('click', function () {
                    chartPills.forEach(function (p) { p.classList.remove('active'); });
                    pill.classList.add('active');
                    self.chartMode = pill.getAttribute('data-chart');
                    self.renderTemperatureChart(self.weatherData ? self.weatherData.forecast : null);
                });
            });

            // Bottom Navigation Tabs
            var dockBtns = document.querySelectorAll('.dock-btn');
            dockBtns.forEach(function (btn) {
                btn.addEventListener('click', function () {
                    dockBtns.forEach(function (b) { b.classList.remove('active'); });
                    btn.classList.add('active');
                    var tab = btn.getAttribute('data-tab');
                    self.handleTabSwitch(tab);
                });
            });

            // Drawers (Saved Locations & Settings)
            var searchDrawerBtn = document.getElementById('openSearchDrawerBtn');
            var settingsDrawerBtn = document.getElementById('openSettingsDrawerBtn');
            var closeDrawerBtns = document.querySelectorAll('.close-drawer-btn');
            var drawerBackdrop = document.getElementById('drawerBackdrop');

            if (searchDrawerBtn) {
                searchDrawerBtn.addEventListener('click', function () {
                    self.openDrawer('locationsDrawer');
                });
            }

            if (settingsDrawerBtn) {
                settingsDrawerBtn.addEventListener('click', function () {
                    if (window.AndroidBridge && window.AndroidBridge.toggleMenu) {
                        window.AndroidBridge.toggleMenu();
                    } else {
                        self.openDrawer('settingsDrawer');
                    }
                });
            }

            closeDrawerBtns.forEach(function (btn) {
                btn.addEventListener('click', function () {
                    self.closeDrawers();
                });
            });

            if (drawerBackdrop) {
                drawerBackdrop.addEventListener('click', function () {
                    self.closeDrawers();
                });
            }

            // Add New City to Saved Locations
            var addCityBtn = document.getElementById('btnAddSavedCity');
            var addCityInput = document.getElementById('inputAddSavedCity');
            if (addCityBtn && addCityInput) {
                var handleAdd = function () {
                    var cityName = addCityInput.value.trim();
                    if (cityName) {
                        self.addSavedCity(cityName);
                        addCityInput.value = '';
                    }
                };
                addCityBtn.addEventListener('click', handleAdd);
                addCityInput.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter') handleAdd();
                });
            }

            // Window resize -> Redraw chart
            window.addEventListener('resize', function () {
                if (self.weatherData) {
                    self.renderTemperatureChart(self.weatherData.forecast);
                }
            });

            // Hero 3D Stage Interactive Tap Surge (Pulse Waves & Chime)
            var heroCanvas = document.getElementById('heroWeatherCanvas');
            var heroStage = document.querySelector('.hero-3d-stage');
            var handleHeroTap = function () {
                if (self.weather3D && self.weather3D.triggerPulse) {
                    self.weather3D.triggerPulse();
                }
                self.playChime();
            };
            if (heroCanvas) heroCanvas.addEventListener('click', handleHeroTap);
            if (heroStage) heroStage.addEventListener('click', handleHeroTap);
        },

        toggleTheme: function () {
            this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
            try { localStorage.setItem('atmosphere_theme', this.currentTheme); } catch (e) {}
            this.applyTheme(this.currentTheme);
            if (this.weatherData) {
                this.renderWeather(this.weatherData);
            }
        },

        applyTheme: function (theme) {
            document.documentElement.setAttribute('data-theme', theme);
            var themeBtn = document.getElementById('themeToggleBtn');
            if (themeBtn) {
                themeBtn.innerHTML = theme === 'dark' 
                    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
                    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
            }
            if (this.weather3D && this.weather3D.setTheme) {
                this.weather3D.setTheme(theme);
            }
        },

        showLoading: function (title, subtitle) {
            var overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                var tEl = overlay.querySelector('.loading-title');
                var sEl = overlay.querySelector('.loading-subtitle');
                if (tEl && title) tEl.textContent = title;
                if (sEl && subtitle) sEl.textContent = subtitle;
                overlay.classList.add('active');
            }
        },

        hideLoading: function () {
            var overlay = document.getElementById('loadingOverlay');
            if (overlay) overlay.classList.remove('active');
        },

        handleTabSwitch: function (tab) {
            this.playChime();
            var targetId = '';
            if (tab === 'forecast') targetId = 'hourlySection';
            else if (tab === 'chart') targetId = 'chartSection';
            else if (tab === 'radar') {
                targetId = 'radarSection';
                if (this.radarMap) {
                    setTimeout(() => {
                        this.radarMap.invalidateSize();
                    }, 300);
                }
            }
            else if (tab === 'telemetry') targetId = 'telemetrySection';
            else if (tab === 'cities') {
                this.openDrawer('locationsDrawer');
                return;
            } else if (tab === 'settings') {
                if (window.AndroidBridge && window.AndroidBridge.toggleMenu) {
                    window.AndroidBridge.toggleMenu();
                    return;
                }
                this.openDrawer('settingsDrawer');
                return;
            }

            if (targetId) {
                var el = document.getElementById(targetId);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        },

        openDrawer: function (drawerId) {
            this.closeDrawers();
            var backdrop = document.getElementById('drawerBackdrop');
            var drawer = document.getElementById(drawerId);
            if (backdrop) backdrop.classList.add('open');
            if (drawer) drawer.classList.add('open');
        },

        closeDrawers: function () {
            var backdrop = document.getElementById('drawerBackdrop');
            var drawers = document.querySelectorAll('.side-drawer');
            if (backdrop) backdrop.classList.remove('open');
            drawers.forEach(function (d) { d.classList.remove('open'); });
        },

        performSearch: function (query) {
            this.playChime();
            this.showLoading('Searching ' + query, 'Retrieving global atmospheric radar...');
            if (window.AndroidBridge && window.AndroidBridge.searchCity) {
                window.AndroidBridge.searchCity(query);
            } else {
                this.fetchWeatherByCity(query);
            }
        },

        setupCardTilt: function () {
            var cards = document.querySelectorAll('.glass-panel');
            cards.forEach(function (card) {
                card.addEventListener('mousemove', function (e) {
                    var rect = card.getBoundingClientRect();
                    var x = e.clientX - rect.left;
                    var y = e.clientY - rect.top;
                    var centerX = rect.width / 2;
                    var centerY = rect.height / 2;
                    var rotateX = ((y - centerY) / centerY) * -5.5;
                    var rotateY = ((x - centerX) / centerX) * 5.5;

                    card.style.transform = 'perspective(1000px) rotateX(' + rotateX.toFixed(2) + 'deg) rotateY(' + rotateY.toFixed(2) + 'deg) scale3d(1.01, 1.01, 1.01)';
                });

                card.addEventListener('mouseleave', function () {
                    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
                });
            });
        },

        setupAudio: function () {
            var self = this;
            var soundBtn = document.getElementById('soundToggleBtn');
            if (soundBtn) {
                soundBtn.addEventListener('click', function () {
                    self.isSoundEnabled = !self.isSoundEnabled;
                    soundBtn.style.color = self.isSoundEnabled ? 'var(--primary-cyan)' : 'var(--text-muted)';
                    if (self.isSoundEnabled) {
                        self.playChime();
                    }
                });
            }
        },

        playChime: function () {
            if (!this.isSoundEnabled) return;
            try {
                if (!this.audioCtx) {
                    var AudioContext = window.AudioContext || window.webkitAudioContext;
                    this.audioCtx = new AudioContext();
                }
                var ctx = this.audioCtx;
                var osc = ctx.createOscillator();
                var gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
                osc.frequency.exponentialRampToValueAtTime(987.77, ctx.currentTime + 0.16); // B5
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.36);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.36);
            } catch (e) {}
        },

        convertTemp: function (celsius) {
            if (this.currentUnit === 'F') {
                return Math.round((celsius * 9 / 5) + 32);
            }
            return Math.round(celsius);
        },

        /**
         * Renders weather data across all UI components, charts, and 3D scenes
         */
        renderWeather: function (data) {
            if (!data) return;
            this.weatherData = data;
            this.hideLoading();

            if (!this.isManualPresetActive) {
                this.originalWeatherData = Object.assign({}, data);
                var presetBtns = document.querySelectorAll('.scene-btn');
                presetBtns.forEach(function (b) {
                    if (b.getAttribute('data-condition') === 'auto' || b.textContent.trim() === 'Auto') {
                        b.classList.add('active');
                    } else {
                        b.classList.remove('active');
                    }
                });
            }

            // City & Local Date/Time
            var cityEl = document.getElementById('tvCityName');
            if (cityEl) cityEl.textContent = data.city || 'San Francisco';

            var dateEl = document.getElementById('tvCurrentDate');
            if (dateEl) {
                if (data.localTime) {
                    dateEl.textContent = data.localTime;
                } else if (data.timezone !== undefined) {
                    var utcMs = Date.now() + (new Date().getTimezoneOffset() * 60000);
                    var cityDate = new Date(utcMs + (data.timezone * 1000));
                    dateEl.textContent = cityDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                } else {
                    var now = new Date();
                    dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                }
            }

            // Temperature Metrics
            var tempVal = this.convertTemp(data.temperature);
            var tempEl = document.getElementById('tvHeroTemperature');
            if (tempEl) tempEl.textContent = tempVal;

            var unitSymbolEl = document.getElementById('tvTempUnitSymbol');
            if (unitSymbolEl) unitSymbolEl.textContent = '°' + this.currentUnit;

            // Intelligent Location-Aware Day/Night Determination
            var isDayTime = true;
            if (data.isDay !== undefined) {
                isDayTime = !!data.isDay;
            } else if (data.dt && data.sunriseRaw && data.sunsetRaw) {
                isDayTime = (data.dt >= data.sunriseRaw && data.dt < data.sunsetRaw);
            } else if (data.timezone !== undefined) {
                var utcMs2 = Date.now() + (new Date().getTimezoneOffset() * 60000);
                var cityHour = new Date(utcMs2 + (data.timezone * 1000)).getHours();
                isDayTime = (cityHour >= 6 && cityHour < 19);
            } else if (data.sunset && data.sunrise) {
                var currentHour = new Date().getHours();
                isDayTime = currentHour >= 6 && currentHour < 19;
            }

            // Condition Pill & Smart Sun/Moon Icon
            var condDesc = data.description || 'Partly Cloudy';
            var condEl = document.getElementById('tvConditionText');
            if (condEl) condEl.textContent = this.capitalize(condDesc);

            var condIconEl = document.getElementById('tvConditionIcon');
            if (condIconEl) {
                condIconEl.innerHTML = this.getWeatherSvgIcon(condDesc, 18, isDayTime);
            }

            // High / Low & Feels Like
            var feelsVal = this.convertTemp(data.feelsLike !== undefined ? data.feelsLike : data.temperature);
            var highVal = this.convertTemp(data.tempMax !== undefined ? data.tempMax : data.temperature + 3);
            var lowVal = this.convertTemp(data.tempMin !== undefined ? data.tempMin : data.temperature - 4);
            var highLowEl = document.getElementById('tvHighLowSummary');
            if (highLowEl) {
                highLowEl.innerHTML = 'Feels like ' + feelsVal + '° <span class="dot">·</span> H: ' + highVal + '° <span class="dot">·</span> L: ' + lowVal + '°';
            }

            // Update 3D Engine State & Dynamic Weather Aurora Themes
            var isSunset = (condDesc.toLowerCase().indexOf('sunset') !== -1);
            this.updateAtmosphereTheme(condDesc, isDayTime, isSunset);

            if (this.weather3D) {
                this.weather3D.setCondition(condDesc, isDayTime, isSunset);
            }

            // Weather Advisory Banner
            var alertBanner = document.getElementById('alertBanner');
            var alertTitle = document.getElementById('alertTitle');
            var alertDesc = document.getElementById('alertDesc');
            if (alertBanner && alertTitle && alertDesc) {
                var windSpeedKmh = (data.windSpeed || 4) * 3.6;
                var descLower = (data.description || '').toLowerCase();

                if (windSpeedKmh > 35) {
                    alertBanner.style.display = 'flex';
                    alertTitle.textContent = 'High Wind Advisory';
                    alertDesc.textContent = 'Gusts up to ' + Math.round(windSpeedKmh) + ' km/h across elevated spans';
                } else if (descLower.indexOf('thunder') !== -1 || descLower.indexOf('storm') !== -1) {
                    alertBanner.style.display = 'flex';
                    alertTitle.textContent = 'Severe Thunderstorm Warning';
                    alertDesc.textContent = 'Active lightning discharge and torrential downpours detected';
                } else if (descLower.indexOf('snow') !== -1 || descLower.indexOf('ice') !== -1) {
                    alertBanner.style.display = 'flex';
                    alertTitle.textContent = 'Winter Weather Advisory';
                    alertDesc.textContent = 'Snow accumulation and icy surfaces monitored';
                } else {
                    alertBanner.style.display = 'none';
                }
            }

            // Telemetry Cards
            // 1. AQI (Official India CPCB NAQI 0 - 500 Scale)
            var aqiVal = data.aqi !== undefined ? data.aqi : 45;
            var aqiCategory = data.aqiCategory;
            var aqiColor = '#10b981';

            if (!aqiCategory) {
                if (aqiVal <= 50) { aqiCategory = 'Good'; aqiColor = '#10b981'; }
                else if (aqiVal <= 100) { aqiCategory = 'Satisfactory'; aqiColor = '#84cc16'; }
                else if (aqiVal <= 200) { aqiCategory = 'Moderate'; aqiColor = '#eab308'; }
                else if (aqiVal <= 300) { aqiCategory = 'Poor'; aqiColor = '#f97316'; }
                else if (aqiVal <= 400) { aqiCategory = 'Very Poor'; aqiColor = '#ef4444'; }
                else { aqiCategory = 'Severe'; aqiColor = '#7f1d1d'; }
            } else {
                var cLower = aqiCategory.toLowerCase();
                if (cLower.indexOf('good') !== -1) aqiColor = '#10b981';
                else if (cLower.indexOf('satisfactory') !== -1) aqiColor = '#84cc16';
                else if (cLower.indexOf('moderate') !== -1) aqiColor = '#eab308';
                else if (cLower.indexOf('very poor') !== -1) aqiColor = '#ef4444';
                else if (cLower.indexOf('poor') !== -1) aqiColor = '#f97316';
                else if (cLower.indexOf('severe') !== -1 || cLower.indexOf('hazard') !== -1) aqiColor = '#7f1d1d';
                else aqiColor = '#eab308';
            }

            var aqiNumberEl = document.getElementById('tvAqiNumber');
            var aqiDescEl = document.getElementById('tvAqiDescription');
            var aqiDot = document.getElementById('aqiDot');
            var aqiFill = document.getElementById('aqiFill');
            var pm25El = document.getElementById('tvPm25Val');
            var pm10El = document.getElementById('tvPm10Val');

            if (aqiNumberEl) aqiNumberEl.textContent = aqiVal;
            if (aqiDescEl) {
                aqiDescEl.textContent = aqiCategory;
                aqiDescEl.style.color = aqiColor;
            }
            if (aqiDot) aqiDot.style.backgroundColor = aqiColor;
            if (aqiFill) {
                var pct = Math.min(100, Math.max(6, Math.round((aqiVal / 500) * 100)));
                aqiFill.style.width = pct + '%';
                aqiFill.style.backgroundColor = aqiColor;
            }

            if (pm25El) {
                var pm25Val = data.pm25 !== undefined && data.pm25 > 0 ? Math.round(data.pm25) : Math.round(aqiVal * 0.6);
                pm25El.textContent = pm25Val;
            }
            if (pm10El) {
                var pm10Val = data.pm10 !== undefined && data.pm10 > 0 ? Math.round(data.pm10) : Math.round(aqiVal * 0.7);
                pm10El.textContent = pm10Val;
            }

            // 2. Wind
            var windKmh = ((data.windSpeed || 3.8) * 3.6).toFixed(1);
            var windSpeedEl = document.getElementById('tvWindSpeedVal');
            var windDirEl = document.getElementById('tvWindDirectionBadge');
            var windNeedle = document.getElementById('windNeedleIcon');
            if (windSpeedEl) windSpeedEl.textContent = windKmh;
            if (windDirEl) {
                var dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
                var deg = data.windDeg || 45;
                var idx = Math.round((deg % 360) / 45) % 8;
                windDirEl.textContent = dirs[idx];
            }
            if (windNeedle) {
                windNeedle.style.transform = 'rotate(' + (data.windDeg || 45) + 'deg)';
            }

            // 3. UV Index (Accurate Solar / Lunar Physics)
            var uv = 0.0;
            if (isDayTime) {
                uv = data.uvIndex !== undefined ? data.uvIndex : 3.0;
            } else {
                uv = 0.0;
            }
            var uvEl = document.getElementById('tvUvVal');
            var uvDescEl = document.getElementById('tvUvDesc');
            var uvFill = document.getElementById('uvFill');
            var uvText = 'Low';
            if (uv === 0) uvText = 'None';
            else if (uv <= 2) uvText = 'Low';
            else if (uv <= 5) uvText = 'Moderate';
            else if (uv <= 7) uvText = 'High';
            else uvText = 'Very High';

            if (uvEl) uvEl.textContent = uv.toFixed(0);
            if (uvDescEl) uvDescEl.textContent = uvText;
            if (uvFill) uvFill.style.width = Math.min(100, (uv / 11) * 100) + '%';

            // 4. Humidity
            var humidity = data.humidity || 64;
            var humEl = document.getElementById('tvHumidityVal');
            var humFill = document.getElementById('humFill');
            if (humEl) humEl.textContent = humidity + '%';
            if (humFill) humFill.style.width = humidity + '%';

            // 5. Visibility
            var visKm = (data.visibility !== undefined ? data.visibility : 10).toFixed(1);
            var visEl = document.getElementById('tvVisibilityVal');
            if (visEl) visEl.textContent = visKm;

            // 6. Pressure
            var pressure = data.pressure || 1014;
            var pressEl = document.getElementById('tvPressureVal');
            if (pressEl) pressEl.textContent = pressure;

            // Quick Highlights Bento Strip Updates
            var hlRain = document.getElementById('tvHlRain');
            var hlWind = document.getElementById('tvHlWind');
            var hlAqi = document.getElementById('tvHlAqi');
            var hlUv = document.getElementById('tvHlUv');

            if (hlRain) {
                var rainPct = 10;
                if (data.rainChance !== undefined) {
                    rainPct = data.rainChance;
                } else if (data.forecast && data.forecast[0] && data.forecast[0].rainChance !== undefined) {
                    rainPct = data.forecast[0].rainChance;
                } else if (condDesc.toLowerCase().indexOf('rain') !== -1) {
                    rainPct = 85;
                } else if (condDesc.toLowerCase().indexOf('cloud') !== -1) {
                    rainPct = 25;
                }
                hlRain.textContent = rainPct + '%';
            }
            if (hlWind) {
                var dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
                var deg = data.windDeg || 45;
                var idx = Math.round((deg % 360) / 45) % 8;
                hlWind.textContent = windKmh + ' km/h ' + dirs[idx];
            }
            if (hlAqi) {
                hlAqi.textContent = aqiVal + ' · ' + aqiCategory;
                hlAqi.style.color = aqiColor;
            }
            if (hlUv) {
                hlUv.textContent = uv.toFixed(0) + ' · ' + uvText;
            }

            // Ephemeris Sunrise & Sunset
            var sunriseEl = document.getElementById('tvSunriseTime');
            var sunsetEl = document.getElementById('tvSunsetTime');
            if (sunriseEl) sunriseEl.textContent = data.sunrise || '6:28 AM';
            if (sunsetEl) sunsetEl.textContent = data.sunset || '7:42 PM';

            // Render Hourly, Interactive Curve Chart, and 7-Day Forecast
            this.renderHourlyForecast(data.forecast, isDayTime, data.timezone);
            this.renderTemperatureChart(data.forecast);
            this.renderWeeklyForecast(data.forecast, tempVal);

            // Update Live Doppler Radar location
            var rLat = data.lat !== undefined ? data.lat : (data.coord ? data.coord.lat : null);
            var rLon = data.lon !== undefined ? data.lon : (data.coord ? data.coord.lon : null);
            if (rLat !== null && rLon !== null) {
                this.updateRadarLocation(rLat, rLon, data.city);
            }
        },

        renderHourlyForecast: function (forecastList, isDayTime, timezoneOffset) {
            var track = document.getElementById('hourlyTrack');
            if (!track) return;
            track.innerHTML = '';

            var items = [];
            if (forecastList && forecastList.length > 0) {
                for (var i = 0; i < Math.min(12, forecastList.length); i++) {
                    var item = forecastList[i];
                    var timeStr = 'Now';
                    if (i > 0 && item.time) {
                        var parts = item.time.split(' ');
                        timeStr = parts.length > 1 ? parts[1].substring(0, 5) : item.time;
                    }
                    items.push({
                        time: timeStr,
                        temp: this.convertTemp(item.temperature),
                        desc: item.description || 'Partly Cloudy',
                        rainChance: (10 + i * 5) % 65
                    });
                }
            } else {
                var hours = ['Now', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM'];
                for (var h = 0; h < hours.length; h++) {
                    items.push({
                        time: hours[h],
                        temp: this.convertTemp(22 + Math.sin(h * 0.5) * 3),
                        desc: h > 3 ? 'Rain' : 'Partly Cloudy',
                        rainChance: (15 + h * 8) % 75
                    });
                }
            }

            var self = this;
            items.forEach(function (it, idx) {
                var itemIsDay = isDayTime;
                if (idx > 0 && it.time) {
                    var hourMatch = it.time.match(/(\d+):/);
                    if (hourMatch) {
                        var hVal = parseInt(hourMatch[1], 10);
                        itemIsDay = (hVal >= 6 && hVal < 19);
                    } else if (it.time.indexOf('PM') !== -1 || it.time.indexOf('AM') !== -1) {
                        var isPM = it.time.indexOf('PM') !== -1;
                        var hNum = parseInt(it.time, 10);
                        if (isPM && hNum !== 12) hNum += 12;
                        if (!isPM && hNum === 12) hNum = 0;
                        itemIsDay = (hNum >= 6 && hNum < 19);
                    }
                }
                var el = document.createElement('div');
                el.className = 'hourly-item' + (idx === 0 ? ' active' : '');
                el.innerHTML = [
                    '<span class="hourly-time">' + it.time + '</span>',
                    self.getWeatherSvgIcon(it.desc, 28, itemIsDay),
                    '<span class="hourly-rain">' + it.rainChance + '%</span>',
                    '<span class="hourly-temp">' + it.temp + '°</span>'
                ].join('');
                el.addEventListener('click', function () {
                    document.querySelectorAll('.hourly-item').forEach(function (c) { c.classList.remove('active'); });
                    el.classList.add('active');
                });
                track.appendChild(el);
            });
        },

        /**
         * 📈 Interactive 24-Hour Temperature Curve Canvas Chart
         */
        renderTemperatureChart: function (forecastList) {
            var canvas = document.getElementById('tempCurveCanvas');
            if (!canvas) return;

            var ctx = canvas.getContext('2d');
            var width = canvas.parentElement.clientWidth || 600;
            var height = 180;
            canvas.width = width * (window.devicePixelRatio || 1);
            canvas.height = height * (window.devicePixelRatio || 1);
            ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

            // Prepare chart data points
            var dataPoints = [];
            if (forecastList && forecastList.length >= 6) {
                for (var i = 0; i < Math.min(8, forecastList.length); i++) {
                    var it = forecastList[i];
                    var val = (this.chartMode === 'rain') 
                        ? ((15 + i * 9) % 75) 
                        : this.convertTemp(it.temperature);
                    var label = i === 0 ? 'Now' : it.time.split(' ')[1] ? it.time.split(' ')[1].substring(0, 5) : it.time;
                    dataPoints.push({ label: label, value: val });
                }
            } else {
                var labels = ['12 PM', '3 PM', '6 PM', '9 PM', '12 AM', '3 AM', '6 AM', '9 AM'];
                for (var j = 0; j < labels.length; j++) {
                    var mockVal = (this.chartMode === 'rain')
                        ? (20 + Math.sin(j) * 35)
                        : this.convertTemp(22 + Math.sin(j * 0.6) * 4);
                    dataPoints.push({ label: labels[j], value: Math.round(mockVal) });
                }
            }

            var padding = { left: 35, right: 35, top: 25, bottom: 35 };
            var chartWidth = width - padding.left - padding.right;
            var chartHeight = height - padding.top - padding.bottom;

            var minVal = Infinity;
            var maxVal = -Infinity;
            dataPoints.forEach(function (dp) {
                if (dp.value < minVal) minVal = dp.value;
                if (dp.value > maxVal) maxVal = dp.value;
            });
            if (minVal === maxVal) { minVal -= 2; maxVal += 2; }
            var valRange = maxVal - minVal;

            ctx.clearRect(0, 0, width, height);

            var coords = [];
            for (var k = 0; k < dataPoints.length; k++) {
                var cx = padding.left + (k / (dataPoints.length - 1)) * chartWidth;
                var cy = padding.top + chartHeight - ((dataPoints[k].value - minVal) / valRange) * chartHeight;
                coords.push({ x: cx, y: cy, label: dataPoints[k].label, value: dataPoints[k].value });
            }

            // 1. Draw glowing gradient fill under curve
            var grad = ctx.createLinearGradient(0, padding.top, 0, height);
            var isRain = this.chartMode === 'rain';
            var strokeColor = isRain ? '#38bdf8' : '#8ed5ff';

            if (isRain) {
                grad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
                grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
            } else {
                grad.addColorStop(0, 'rgba(142, 213, 255, 0.45)');
                grad.addColorStop(1, 'rgba(129, 140, 248, 0.0)');
            }

            ctx.beginPath();
            ctx.moveTo(coords[0].x, coords[0].y);
            for (var c = 0; c < coords.length - 1; c++) {
                var xc = (coords[c].x + coords[c + 1].x) / 2;
                var yc = (coords[c].y + coords[c + 1].y) / 2;
                ctx.quadraticCurveTo(coords[c].x, coords[c].y, xc, yc);
            }
            ctx.quadraticCurveTo(coords[coords.length - 1].x, coords[coords.length - 1].y, coords[coords.length - 1].x, coords[coords.length - 1].y);
            ctx.lineTo(coords[coords.length - 1].x, height - padding.bottom);
            ctx.lineTo(coords[0].x, height - padding.bottom);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();

            // 2. Draw smooth stroke curve
            ctx.beginPath();
            ctx.moveTo(coords[0].x, coords[0].y);
            for (var s = 0; s < coords.length - 1; s++) {
                var xmid = (coords[s].x + coords[s + 1].x) / 2;
                var ymid = (coords[s].y + coords[s + 1].y) / 2;
                ctx.quadraticCurveTo(coords[s].x, coords[s].y, xmid, ymid);
            }
            ctx.quadraticCurveTo(coords[coords.length - 1].x, coords[coords.length - 1].y, coords[coords.length - 1].x, coords[coords.length - 1].y);
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 3;
            ctx.stroke();

            // 3. Draw nodes, values, and time labels
            ctx.textAlign = 'center';
            for (var n = 0; n < coords.length; n++) {
                var pt = coords[n];

                // Value Text above point
                ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
                ctx.fillStyle = this.currentTheme === 'light' ? '#0f172a' : '#ffffff';
                ctx.fillText(pt.value + (isRain ? '%' : '°'), pt.x, pt.y - 10);

                // Circular Node
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
                ctx.fillStyle = strokeColor;
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();

                // Bottom Time Label
                ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
                ctx.fillStyle = this.currentTheme === 'light' ? '#475569' : '#94a3b8';
                ctx.fillText(pt.label, pt.x, height - 10);
            }
        },

        renderWeeklyForecast: function (forecastList, currentTemp) {
            var container = document.getElementById('dailyRowsContainer');
            if (!container) return;
            container.innerHTML = '';

            var days = ['Today', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'];
            var self = this;

            for (var d = 0; d < days.length; d++) {
                var row = document.createElement('div');
                row.className = 'daily-row' + (d === 0 ? ' today' : '');

                var min = this.convertTemp(16 + Math.sin(d) * 2);
                var max = this.convertTemp(24 + Math.cos(d) * 3);
                var fillLeft = 15 + d * 4;
                var fillWidth = 55 + Math.sin(d) * 15;

                row.innerHTML = [
                    '<span class="daily-day">' + days[d] + '</span>',
                    '<div class="daily-icon-wrap">' + self.getWeatherSvgIcon(d === 2 || d === 3 ? 'sunny' : (d === 5 ? 'rain' : 'partly_cloudy'), 22) + '</div>',
                    '<div class="temp-range-bar-wrap">',
                    '  <span class="temp-min">' + min + '°</span>',
                    '  <div class="temp-bar-track">',
                    '    <div class="temp-bar-fill" style="left: ' + fillLeft + '%; width: ' + fillWidth + '%;"></div>',
                    (d === 0 ? '    <div class="current-temp-pin" style="left: 65%;"></div>' : ''),
                    '  </div>',
                    '  <span class="temp-max">' + max + '°</span>',
                    '</div>'
                ].join('');
                container.appendChild(row);
            }
        },

        setupCitySuggestions: function () {
            var self = this;
            var input = document.getElementById('citySearchInput');
            var dropdown = document.getElementById('searchSuggestionsDropdown');
            var clearBtn = document.getElementById('searchClearBtn');
            var spinner = document.getElementById('searchSpinner');
            var wrap = document.getElementById('searchBarWrap');
            if (!input || !dropdown) return;

            var debounceTimer = null;
            var selectedIndex = -1;
            var currentResults = [];

            var popularCities = [
                { name: 'Ujjain', admin1: 'Madhya Pradesh', country: 'India', countryCode: 'IN', lat: 23.1824, lon: 75.7764 },
                { name: 'New Delhi', admin1: 'Delhi', country: 'India', countryCode: 'IN', lat: 28.6139, lon: 77.2090 },
                { name: 'Mumbai', admin1: 'Maharashtra', country: 'India', countryCode: 'IN', lat: 19.0760, lon: 72.8777 },
                { name: 'Bengaluru', admin1: 'Karnataka', country: 'India', countryCode: 'IN', lat: 12.9716, lon: 77.5946 },
                { name: 'Indore', admin1: 'Madhya Pradesh', country: 'India', countryCode: 'IN', lat: 22.7196, lon: 75.8577 },
                { name: 'London', admin1: 'England', country: 'United Kingdom', countryCode: 'GB', lat: 51.5074, lon: -0.1278 },
                { name: 'New York', admin1: 'New York', country: 'United States', countryCode: 'US', lat: 40.7128, lon: -74.0060 },
                { name: 'Tokyo', admin1: 'Tokyo', country: 'Japan', countryCode: 'JP', lat: 35.6762, lon: 139.6503 },
                { name: 'Dubai', admin1: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE', lat: 25.2048, lon: 55.2708 },
                { name: 'Paris', admin1: 'Île-de-France', country: 'France', countryCode: 'FR', lat: 48.8566, lon: 2.3522 },
                { name: 'Singapore', admin1: 'Central Region', country: 'Singapore', countryCode: 'SG', lat: 1.3521, lon: 103.8198 },
                { name: 'Sydney', admin1: 'New South Wales', country: 'Australia', countryCode: 'AU', lat: -33.8688, lon: 151.2093 }
            ];

            function getCountryFlag(code) {
                if (!code || typeof code !== 'string' || code.length !== 2) return '📍';
                try {
                    var c = code.toUpperCase();
                    return String.fromCodePoint(c.charCodeAt(0) + 127397, c.charCodeAt(1) + 127397);
                } catch (e) {
                    return '📍';
                }
            }

            function getRecentSearches() {
                try {
                    var data = localStorage.getItem('weather_recent_searches');
                    return data ? JSON.parse(data) : [];
                } catch (e) {
                    return [];
                }
            }

            function saveRecentSearch(city) {
                try {
                    var recents = getRecentSearches();
                    recents = recents.filter(function (r) {
                        return r.name.toLowerCase() !== city.name.toLowerCase();
                    });
                    recents.unshift(city);
                    if (recents.length > 5) recents = recents.slice(0, 5);
                    localStorage.setItem('weather_recent_searches', JSON.stringify(recents));
                } catch (e) {}
            }

            function clearRecentSearches() {
                try {
                    localStorage.removeItem('weather_recent_searches');
                } catch (e) {}
                renderDefault();
            }

            function selectCity(city) {
                if (!city) return;
                self.playChime();
                input.value = city.name;
                if (clearBtn) clearBtn.classList.remove('hidden');
                saveRecentSearch(city);
                hideDropdown();
                input.blur();

                if (window.AndroidBridge && window.AndroidBridge.searchCoordinates && city.lat && city.lon) {
                    window.AndroidBridge.searchCoordinates(city.lat, city.lon, city.name);
                } else if (window.AndroidBridge && window.AndroidBridge.searchCity) {
                    window.AndroidBridge.searchCity(city.name);
                } else {
                    self.fetchWeatherByCity(city.name);
                }

                if (self.updateRadarLocation && city.lat && city.lon) {
                    self.updateRadarLocation(city.lat, city.lon, city.name);
                }
            }

            function renderDefault() {
                var recents = getRecentSearches();
                var html = '';

                if (recents && recents.length > 0) {
                    html += '<div class="suggestions-section-header recent">' +
                        '<span>Recent Searches</span>' +
                        '<button type="button" class="btn-clear-recent" id="btnClearRecents">Clear</button>' +
                        '</div>';
                    html += '<div class="popular-chips-wrap" style="padding-bottom: 6px;">';
                    recents.forEach(function (c, idx) {
                        var flag = getCountryFlag(c.countryCode || 'IN');
                        html += '<div class="popular-chip" data-recent-index="' + idx + '">' +
                            '<span class="chip-flag">' + flag + '</span>' +
                            '<span>' + c.name + '</span>' +
                            '</div>';
                    });
                    html += '</div>';
                }

                html += '<div class="suggestions-section-header">' +
                    '<span>Popular Cities Worldwide</span>' +
                    '</div>';
                html += '<div class="popular-chips-wrap">';
                popularCities.forEach(function (c, idx) {
                    var flag = getCountryFlag(c.countryCode);
                    html += '<div class="popular-chip" data-popular-index="' + idx + '">' +
                        '<span class="chip-flag">' + flag + '</span>' +
                        '<span>' + c.name + '</span>' +
                        '</div>';
                });
                html += '</div>';

                dropdown.innerHTML = html;
                dropdown.classList.remove('hidden');
                currentResults = [];
                selectedIndex = -1;

                var btnClear = document.getElementById('btnClearRecents');
                if (btnClear) {
                    btnClear.addEventListener('click', function (e) {
                        e.stopPropagation();
                        clearRecentSearches();
                    });
                }

                dropdown.querySelectorAll('.popular-chip[data-recent-index]').forEach(function (chip) {
                    var handleSelect = function (e) {
                        e.preventDefault();
                        var idx = parseInt(chip.getAttribute('data-recent-index'), 10);
                        if (recents[idx]) selectCity(recents[idx]);
                    };
                    chip.addEventListener('pointerdown', handleSelect);
                    chip.addEventListener('click', handleSelect);
                });

                dropdown.querySelectorAll('.popular-chip[data-popular-index]').forEach(function (chip) {
                    var handleSelect = function (e) {
                        e.preventDefault();
                        var idx = parseInt(chip.getAttribute('data-popular-index'), 10);
                        if (popularCities[idx]) selectCity(popularCities[idx]);
                    };
                    chip.addEventListener('pointerdown', handleSelect);
                    chip.addEventListener('click', handleSelect);
                });
            }

            function highlightMatch(text, query) {
                if (!query) return text;
                var idx = text.toLowerCase().indexOf(query.toLowerCase());
                if (idx === -1) return text;
                return text.substring(0, idx) +
                    '<mark>' + text.substring(idx, idx + query.length) + '</mark>' +
                    text.substring(idx + query.length);
            }

            function renderResults(results, query) {
                currentResults = results;
                selectedIndex = -1;

                if (!results || results.length === 0) {
                    dropdown.innerHTML = '<div class="suggestions-empty">' +
                        '<div class="suggestions-empty-icon">🔍</div>' +
                        '<div>No cities found for <strong>"' + query + '"</strong></div>' +
                        '<div style="font-size: 11px; margin-top: 4px; opacity: 0.7;">Check spelling or try searching nearby major cities</div>' +
                        '</div>';
                    dropdown.classList.remove('hidden');
                    return;
                }

                var html = '<div class="suggestions-section-header">' +
                    '<span>Found ' + results.length + ' Suggestions</span>' +
                    '</div><ul class="suggestions-list">';

                results.forEach(function (r, idx) {
                    var flag = getCountryFlag(r.countryCode);
                    var highlighted = highlightMatch(r.name, query);
                    var sub = [r.admin1, r.country].filter(Boolean).join(', ');

                    html += '<li class="suggestion-item" data-index="' + idx + '">' +
                        '<span class="suggestion-flag">' + flag + '</span>' +
                        '<div class="suggestion-info">' +
                        '<div class="suggestion-title">' + highlighted + '</div>' +
                        '<div class="suggestion-sub">' + (sub || 'Worldwide') + '</div>' +
                        '</div>' +
                        '<span class="suggestion-badge">' + (r.countryCode || 'LOC') + '</span>' +
                        '<span class="suggestion-action-icon">↗</span>' +
                        '</li>';
                });

                html += '</ul>';
                dropdown.innerHTML = html;
                dropdown.classList.remove('hidden');

                dropdown.querySelectorAll('.suggestion-item').forEach(function (item) {
                    var handleSelect = function (e) {
                        e.preventDefault();
                        var idx = parseInt(item.getAttribute('data-index'), 10);
                        if (currentResults[idx]) selectCity(currentResults[idx]);
                    };
                    item.addEventListener('pointerdown', handleSelect);
                    item.addEventListener('click', handleSelect);
                });
            }

            function searchCities(query) {
                if (spinner) spinner.classList.remove('hidden');
                if (clearBtn) clearBtn.classList.add('hidden');

                fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(query) + '&count=8&language=en&format=json')
                    .then(function (res) { return res.json(); })
                    .then(function (data) {
                        if (spinner) spinner.classList.add('hidden');
                        if (clearBtn && input.value.trim().length > 0) clearBtn.classList.remove('hidden');

                        var list = [];
                        if (data && data.results && data.results.length > 0) {
                            list = data.results.map(function (item) {
                                return {
                                    name: item.name,
                                    admin1: item.admin1 || '',
                                    country: item.country || '',
                                    countryCode: item.country_code || '',
                                    lat: item.latitude,
                                    lon: item.longitude,
                                    population: item.population || 0
                                };
                            });

                            var qLower = query.toLowerCase();
                            list.sort(function (a, b) {
                                var aStarts = a.name.toLowerCase().indexOf(qLower) === 0 ? 1 : 0;
                                var bStarts = b.name.toLowerCase().indexOf(qLower) === 0 ? 1 : 0;
                                if (aStarts !== bStarts) return bStarts - aStarts;
                                return (b.population || 0) - (a.population || 0);
                            });
                        }

                        renderResults(list, query);
                    })
                    .catch(function (err) {
                        console.log('Geocoding error, filtering local list:', err);
                        if (spinner) spinner.classList.add('hidden');
                        if (clearBtn && input.value.trim().length > 0) clearBtn.classList.remove('hidden');

                        var qLower = query.toLowerCase();
                        var filtered = popularCities.filter(function (c) {
                            return c.name.toLowerCase().indexOf(qLower) !== -1 ||
                                c.country.toLowerCase().indexOf(qLower) !== -1;
                        });
                        renderResults(filtered, query);
                    });
            }

            function hideDropdown() {
                dropdown.classList.add('hidden');
                dropdown.innerHTML = '';
                currentResults = [];
                selectedIndex = -1;
            }

            function updateActiveSuggestion() {
                var items = dropdown.querySelectorAll('.suggestion-item');
                items.forEach(function (item, idx) {
                    if (idx === selectedIndex) {
                        item.classList.add('active');
                        item.scrollIntoView({ block: 'nearest' });
                    } else {
                        item.classList.remove('active');
                    }
                });
            }

            // Input Events
            input.addEventListener('focus', function () {
                var q = input.value.trim();
                if (q.length < 2) {
                    renderDefault();
                } else {
                    searchCities(q);
                }
            });

            input.addEventListener('input', function () {
                var q = input.value.trim();
                if (clearBtn) {
                    if (q.length > 0) clearBtn.classList.remove('hidden');
                    else clearBtn.classList.add('hidden');
                }

                if (debounceTimer) clearTimeout(debounceTimer);

                if (q.length === 0) {
                    renderDefault();
                    return;
                }

                if (q.length < 2) {
                    renderDefault();
                    return;
                }

                debounceTimer = setTimeout(function () {
                    searchCities(q);
                }, 220);
            });

            input.addEventListener('keydown', function (e) {
                if (dropdown.classList.contains('hidden') || currentResults.length === 0) {
                    if (e.key === 'Enter') {
                        var q = input.value.trim();
                        if (q) {
                            self.performSearch(q);
                            hideDropdown();
                            input.blur();
                        }
                    }
                    return;
                }

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    selectedIndex = (selectedIndex + 1) % currentResults.length;
                    updateActiveSuggestion();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    selectedIndex = (selectedIndex - 1 + currentResults.length) % currentResults.length;
                    updateActiveSuggestion();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (selectedIndex >= 0 && currentResults[selectedIndex]) {
                        selectCity(currentResults[selectedIndex]);
                    } else {
                        var q = input.value.trim();
                        if (q) {
                            self.performSearch(q);
                            hideDropdown();
                            input.blur();
                        }
                    }
                } else if (e.key === 'Escape') {
                    hideDropdown();
                }
            });

            // Clear Button
            if (clearBtn) {
                clearBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    input.value = '';
                    clearBtn.classList.add('hidden');
                    input.focus();
                    renderDefault();
                });
            }

            // Click Outside to Dismiss
            document.addEventListener('click', function (e) {
                if (wrap && !wrap.contains(e.target)) {
                    hideDropdown();
                }
            });
        },

        renderSavedCities: function () {
            var container = document.getElementById('savedCitiesList');
            if (!container) return;
            container.innerHTML = '';

            var self = this;
            this.savedCities.forEach(function (city, idx) {
                var card = document.createElement('div');
                card.className = 'saved-city-card';
                card.innerHTML = [
                    '<div>',
                    '  <div class="saved-city-name">' + city.name + '</div>',
                    '  <div class="saved-city-country">' + city.country + ' · ' + city.cond + '</div>',
                    '</div>',
                    '<div style="display: flex; align-items: center;">',
                    '  <div class="saved-city-temp">' + self.convertTemp(city.tempC) + '°</div>',
                    '  <button class="remove-city-btn" data-index="' + idx + '" title="Remove city">×</button>',
                    '</div>'
                ].join('');

                card.addEventListener('click', function (e) {
                    if (e.target.classList.contains('remove-city-btn')) {
                        e.stopPropagation();
                        self.removeSavedCity(idx);
                        return;
                    }
                    self.performSearch(city.name);
                    self.closeDrawers();
                });

                container.appendChild(card);
            });
        },

        addSavedCity: function (cityName) {
            cityName = this.capitalize(cityName.trim());
            var exists = this.savedCities.some(function (c) {
                return c.name.toLowerCase() === cityName.toLowerCase();
            });

            if (!exists) {
                this.savedCities.unshift({
                    name: cityName,
                    country: 'Saved Location',
                    tempC: 22,
                    cond: 'Clear Sky',
                    icon: 'sunny'
                });
                try { localStorage.setItem('atmosphere_saved_cities', JSON.stringify(this.savedCities)); } catch (e) {}
                this.renderSavedCities();
            }
        },

        removeSavedCity: function (index) {
            this.savedCities.splice(index, 1);
            try { localStorage.setItem('atmosphere_saved_cities', JSON.stringify(this.savedCities)); } catch (e) {}
            this.renderSavedCities();
        },

        getWeatherSvgIcon: function (desc, size, isDay) {
            desc = (desc || '').toLowerCase();
            size = size || 24;
            var day = (isDay !== undefined) ? !!isDay : true;

            if (desc.indexOf('thunder') !== -1 || desc.indexOf('storm') !== -1) {
                return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/><polyline points="13 11 9 17 15 17 11 23"/></svg>';
            } else if (desc.indexOf('rain') !== -1 || desc.indexOf('drizzle') !== -1 || desc.indexOf('shower') !== -1) {
                return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2"><path d="M16 13v6M8 13v6M12 15v6M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/></svg>';
            } else if (desc.indexOf('snow') !== -1 || desc.indexOf('ice') !== -1 || desc.indexOf('blizzard') !== -1) {
                return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M12 3v18M3 12h18M6 6l12 12M6 18L18 6"/></svg>';
            } else if (desc.indexOf('clear') !== -1 || desc.indexOf('sun') !== -1) {
                if (!day) {
                    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
                } else {
                    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
                }
            } else if (desc.indexOf('partly') !== -1 || desc.indexOf('scattered') !== -1) {
                if (!day) {
                    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" stroke="#818cf8"/><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" stroke="#94a3b8"/></svg>';
                } else {
                    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v2M4.93 4.93l1.41 1.41M2 12h2M20 12h2M19.07 4.93l-1.41 1.41" stroke="#f59e0b"/><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" stroke="#0284c7"/></svg>';
                }
            } else {
                return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>';
            }
        },

        updateAtmosphereTheme: function (condition, isDay, isSunset) {
            var auroraBg = document.querySelector('.aurora-bg');
            if (!auroraBg) return;

            var themes = ['sunset-theme', 'sunny-theme', 'rain-theme', 'storm-theme', 'snow-theme', 'cloudy-theme', 'night-theme'];
            themes.forEach(function (t) { auroraBg.classList.remove(t); });

            var cond = (condition || '').toLowerCase();
            if (isSunset) {
                auroraBg.classList.add('sunset-theme');
            } else if (!isDay) {
                auroraBg.classList.add('night-theme');
            } else if (cond.indexOf('thunder') !== -1 || cond.indexOf('storm') !== -1 || cond.indexOf('lightning') !== -1) {
                auroraBg.classList.add('storm-theme');
            } else if (cond.indexOf('rain') !== -1 || cond.indexOf('drizzle') !== -1 || cond.indexOf('shower') !== -1) {
                auroraBg.classList.add('rain-theme');
            } else if (cond.indexOf('snow') !== -1 || cond.indexOf('ice') !== -1 || cond.indexOf('blizzard') !== -1 || cond.indexOf('sleet') !== -1) {
                auroraBg.classList.add('snow-theme');
            } else if (cond.indexOf('cloud') !== -1 || cond.indexOf('overcast') !== -1 || cond.indexOf('mist') !== -1 || cond.indexOf('fog') !== -1 || cond.indexOf('haze') !== -1) {
                auroraBg.classList.add('cloudy-theme');
            } else {
                auroraBg.classList.add('sunny-theme');
            }
        },

        setConditionPreset: function (cond, isDay, isSunset) {
            this.isManualPresetActive = true;
            this.playChime();
            this.updateAtmosphereTheme(cond, isDay, isSunset);

            if (this.weather3D) {
                this.weather3D.setCondition(cond, isDay, isSunset);
            }
            if (this.weatherData) {
                var clone = Object.assign({}, this.weatherData);
                clone.description = isSunset ? 'Golden Hour Sunset' : cond;
                clone.isDay = isDay;
                this.renderWeather(clone);
            }
        },

        loadInitialSampleData: function () {
            this.renderWeather({
                city: 'Ujjain, IN',
                lat: 23.1789,
                lon: 75.7859,
                temperature: 22,
                feelsLike: 21,
                tempMin: 18,
                tempMax: 26,
                description: 'Clear Sky',
                humidity: 57,
                windSpeed: 3.4,
                windDeg: 45,
                visibility: 10.0,
                aqi: 103,
                aqiCategory: 'Moderate',
                pm25: 61,
                pm10: 67,
                pressure: 1019,
                uvIndex: 3.5,
                sunrise: '6:45 AM',
                sunset: '5:40 PM',
                isDay: false,
                forecast: [
                    { time: 'Now', temperature: 22, description: 'Clear Sky' },
                    { time: '23:00', temperature: 21, description: 'Clear Sky' },
                    { time: '02:00', temperature: 19, description: 'Clear Sky' },
                    { time: '05:00', temperature: 18, description: 'Clear Sky' },
                    { time: '08:00', temperature: 22, description: 'Sunny' },
                    { time: '11:00', temperature: 25, description: 'Sunny' },
                    { time: '14:00', temperature: 26, description: 'Sunny' }
                ]
            });
        },

        /**
         * Calculates CPCB National Air Quality Index (NAQI) for India (0-500 standard scale)
         */
        calculateCpcbAqi: function (comp) {
            if (!comp) return { aqi: 45, category: 'Good', color: '#10b981', dominant: 'PM2.5', pm25: 15, pm10: 25 };

            var pm25 = comp.pm2_5 !== undefined ? comp.pm2_5 : (comp.pm25 || 0);
            var pm10 = comp.pm10 || 0;
            var no2 = comp.no2 || 0;
            var so2 = comp.so2 || 0;
            var co = (comp.co || 0) > 50 ? (comp.co / 1000.0) : (comp.co || 0); // mg/m³
            var o3 = comp.o3 || 0;

            function calcSub(val, c, iScale) {
                if (val <= 0) return 0;
                for (var i = 0; i < c.length - 1; i++) {
                    if (val >= c[i] && val <= c[i + 1]) {
                        var frac = (val - c[i]) / (c[i + 1] - c[i]);
                        return Math.round(iScale[i] + frac * (iScale[i + 1] - iScale[i]));
                    }
                }
                if (val > c[c.length - 1]) return 500;
                return 0;
            }

            var subPm25 = calcSub(pm25, [0, 30, 60, 90, 120, 250, 380], [0, 50, 100, 200, 300, 400, 500]);
            var subPm10 = calcSub(pm10, [0, 50, 100, 250, 350, 430, 500], [0, 50, 100, 200, 300, 400, 500]);
            var subNo2  = calcSub(no2,  [0, 40, 80, 180, 280, 400, 600],  [0, 50, 100, 200, 300, 400, 500]);
            var subSo2  = calcSub(so2,  [0, 40, 80, 380, 800, 1600, 2000], [0, 50, 100, 200, 300, 400, 500]);
            var subCo   = calcSub(co,   [0, 1.0, 2.0, 10.0, 17.0, 34.0, 50.0], [0, 50, 100, 200, 300, 400, 500]);
            var subO3   = calcSub(o3,   [0, 50, 100, 168, 208, 748, 1000], [0, 50, 100, 200, 300, 400, 500]);

            var maxAqi = subPm25;
            var dominant = 'PM2.5';
            if (subPm10 > maxAqi) { maxAqi = subPm10; dominant = 'PM10'; }
            if (subNo2 > maxAqi)  { maxAqi = subNo2; dominant = 'NO2'; }
            if (subSo2 > maxAqi)  { maxAqi = subSo2; dominant = 'SO2'; }
            if (subCo > maxAqi)   { maxAqi = subCo; dominant = 'CO'; }
            if (subO3 > maxAqi)   { maxAqi = subO3; dominant = 'O3'; }

            if (maxAqi < 1) { maxAqi = 25; }

            var cat = 'Good';
            var col = '#10b981';
            if (maxAqi <= 50) { cat = 'Good'; col = '#10b981'; }
            else if (maxAqi <= 100) { cat = 'Satisfactory'; col = '#84cc16'; }
            else if (maxAqi <= 200) { cat = 'Moderate'; col = '#eab308'; }
            else if (maxAqi <= 300) { cat = 'Poor'; col = '#f97316'; }
            else if (maxAqi <= 400) { cat = 'Very Poor'; col = '#ef4444'; }
            else { cat = 'Severe'; col = '#7f1d1d'; }

            return {
                aqi: maxAqi,
                category: cat,
                color: col,
                dominant: dominant,
                pm25: pm25,
                pm10: pm10
            };
        },

        /**
         * Live OpenWeatherMap API Direct Query (Standalone Web Mode with In-Memory Caching)
         */
        fetchWeatherByCity: function (city) {
            var self = this;
            var cacheKey = city.toLowerCase().trim();
            var nowTs = Date.now();
            if (this.weatherCache && this.weatherCache[cacheKey] && (nowTs - this.weatherCache[cacheKey].timestamp < 480000)) {
                this.renderWeather(this.weatherCache[cacheKey].data);
                return;
            }

            var url = 'https://api.openweathermap.org/data/2.5/weather?q=' + encodeURIComponent(city) + '&appid=' + this.apiKey + '&units=metric';
            var forecastUrl = 'https://api.openweathermap.org/data/2.5/forecast?q=' + encodeURIComponent(city) + '&appid=' + this.apiKey + '&units=metric';

            fetch(url)
                .then(function (res) {
                    if (!res.ok) throw new Error('City not found');
                    return res.json();
                })
                .then(function (cur) {
                    var lat = cur.coord ? cur.coord.lat : 0;
                    var lon = cur.coord ? cur.coord.lon : 0;
                    var aqiUrl = 'https://api.openweathermap.org/data/2.5/air_pollution?lat=' + lat + '&lon=' + lon + '&appid=' + self.apiKey;

                    Promise.all([
                        fetch(forecastUrl).then(function (r) { return r.json(); }).catch(function () { return null; }),
                        fetch(aqiUrl).then(function (r) { return r.json(); }).catch(function () { return null; })
                    ]).then(function (results) {
                        var fore = results[0];
                        var aqiRes = results[1];

                        var fItems = [];
                        if (fore && fore.list) {
                            for (var f = 0; f < Math.min(8, fore.list.length); f++) {
                                var item = fore.list[f];
                                fItems.push({
                                    time: item.dt_txt,
                                    temperature: item.main.temp,
                                    description: item.weather[0].description
                                });
                            }
                        }

                        var cpcb = { aqi: 103, category: 'Moderate', color: '#eab308', dominant: 'PM2.5', pm25: 61, pm10: 67 };
                        if (aqiRes && aqiRes.list && aqiRes.list.length > 0 && aqiRes.list[0].components) {
                            cpcb = self.calculateCpcbAqi(aqiRes.list[0].components);
                        }

                        var cityTzOffset = cur.timezone !== undefined ? cur.timezone : 0;
                        var dtUtc = cur.dt || Math.floor(Date.now() / 1000);
                        var sunriseUtc = cur.sys ? cur.sys.sunrise : 0;
                        var sunsetUtc = cur.sys ? cur.sys.sunset : 0;

                        var isDay = true;
                        if (sunriseUtc > 0 && sunsetUtc > 0) {
                            isDay = (dtUtc >= sunriseUtc && dtUtc < sunsetUtc);
                        } else {
                            var localHour = new Date(Date.now() + (cityTzOffset * 1000) + (new Date().getTimezoneOffset() * 60000)).getHours();
                            isDay = (localHour >= 6 && localHour < 19);
                        }

                        var sunriseTime = '6:30 AM';
                        var sunsetTime = '7:30 PM';
                        if (sunriseUtc > 0 && sunsetUtc > 0) {
                            var sRiseDate = new Date((sunriseUtc + cityTzOffset + (new Date().getTimezoneOffset() * 60)) * 1000);
                            var sSetDate = new Date((sunsetUtc + cityTzOffset + (new Date().getTimezoneOffset() * 60)) * 1000);
                            sunriseTime = sRiseDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            sunsetTime = sSetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        }

                        var localCityDate = new Date(Date.now() + (cityTzOffset * 1000) + (new Date().getTimezoneOffset() * 60000));
                        var localTimeStr = localCityDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

                        var d = {
                            city: cur.name + ', ' + (cur.sys ? cur.sys.country : ''),
                            lat: lat,
                            lon: lon,
                            temperature: cur.main.temp,
                            feelsLike: cur.main.feels_like,
                            tempMin: cur.main.temp_min,
                            tempMax: cur.main.temp_max,
                            description: cur.weather[0].description,
                            humidity: cur.main.humidity,
                            windSpeed: cur.wind.speed,
                            windDeg: cur.wind.deg || 0,
                            visibility: cur.visibility ? (cur.visibility / 1000) : 10.0,
                            aqi: cpcb.aqi,
                            aqiCategory: cpcb.category,
                            aqiProminent: cpcb.dominant,
                            pm25: cpcb.pm25,
                            pm10: cpcb.pm10,
                            pressure: cur.main.pressure || 1013,
                            uvIndex: 3.5,
                            sunrise: sunriseTime,
                            sunset: sunsetTime,
                            dt: dtUtc,
                            timezone: cityTzOffset,
                            isDay: isDay,
                            sunriseRaw: sunriseUtc,
                            sunsetRaw: sunsetUtc,
                            localTime: localTimeStr,
                            forecast: fItems
                        };

                        if (!self.weatherCache) self.weatherCache = {};
                        self.weatherCache[cacheKey] = { timestamp: nowTs, data: d };
                        self.renderWeather(d);
                    }).catch(function () {
                        self.fallbackLocalCity(city);
                    });
                })
                .catch(function (err) {
                    console.log('OpenWeather API fallback to local data:', err);
                    self.fallbackLocalCity(city);
                });
        },

        fetchWeatherByCoords: function (lat, lon) {
            var self = this;
            var url = 'https://api.openweathermap.org/data/2.5/weather?lat=' + lat + '&lon=' + lon + '&appid=' + this.apiKey + '&units=metric';

            fetch(url)
                .then(function (res) { return res.json(); })
                .then(function (cur) {
                    self.fetchWeatherByCity(cur.name || 'Current Location');
                })
                .catch(function () {
                    self.hideLoading();
                });
        },

        fallbackLocalCity: function (city) {
            var self = this;
            var mockCities = {
                'tokyo': { city: 'Tokyo, JP', lat: 35.6762, lon: 139.6503, temperature: 18, description: 'Rain', humidity: 82, windSpeed: 5.5, aqi: 28, aqiCategory: 'Good', pm25: 14, pm10: 22, uvIndex: 2.0 },
                'london': { city: 'London, UK', lat: 51.5074, lon: -0.1278, temperature: 14, description: 'Overcast Clouds', humidity: 76, windSpeed: 6.2, aqi: 35, aqiCategory: 'Good', pm25: 18, pm10: 28, uvIndex: 1.5 },
                'new york': { city: 'New York, US', lat: 40.7128, lon: -74.0060, temperature: 27, description: 'Clear Sky', humidity: 52, windSpeed: 3.4, aqi: 48, aqiCategory: 'Good', pm25: 24, pm10: 36, uvIndex: 7.0 },
                'reykjavik': { city: 'Reykjavik, IS', lat: 64.1466, lon: -21.9426, temperature: 1, description: 'Light Snow', humidity: 88, windSpeed: 8.0, aqi: 18, aqiCategory: 'Good', pm25: 6, pm10: 10, uvIndex: 0.5 },
                'paris': { city: 'Paris, FR', lat: 48.8566, lon: 2.3522, temperature: 19, description: 'Scattered Clouds', humidity: 60, windSpeed: 4.1, aqi: 42, aqiCategory: 'Good', pm25: 22, pm10: 34, uvIndex: 4.0 },
                'ujjain': { city: 'Ujjain, IN', lat: 23.1789, lon: 75.7859, temperature: 25, description: 'Clear Sky', humidity: 45, windSpeed: 3.2, aqi: 103, aqiCategory: 'Moderate', pm25: 61, pm10: 67, uvIndex: 6.0 },
                'delhi': { city: 'Delhi, IN', lat: 28.6139, lon: 77.2090, temperature: 24, description: 'Haze', humidity: 55, windSpeed: 2.5, aqi: 241, aqiCategory: 'Poor', pm25: 102, pm10: 123, uvIndex: 4.5 }
            };

            var key = city.toLowerCase().trim();
            if (mockCities[key]) {
                var d = Object.assign({}, self.weatherData, mockCities[key]);
                self.renderWeather(d);
                return;
            }

            if (self.weatherData) {
                var d2 = Object.assign({}, self.weatherData);
                d2.city = self.capitalize(city);
                self.renderWeather(d2);
            }
            self.hideLoading();
        },

        capitalize: function (str) {
            if (!str) return '';
            return str.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        },

        /* ==========================================================================
           Live Doppler Radar Controller (Powered by RainViewer Global Radar Feed)
           ========================================================================== */
        initDopplerRadar: function () {
            var self = this;
            var radarMapEl = document.getElementById('radarMap');
            if (!radarMapEl) return;

            this.radarLat = (this.weatherData && this.weatherData.lat) ? this.weatherData.lat : 23.1789;
            this.radarLon = (this.weatherData && this.weatherData.lon) ? this.weatherData.lon : 75.7859;
            this.radarFrames = [];
            this.radarFrameIndex = 0;
            this.radarTimer = null;
            this.radarLayer = null;
            this.radarLayerType = 'radar';
            this.radarHost = 'https://tilecache.rainviewer.com';

            try {
                if (window.L) {
                    this.radarMap = L.map('radarMap', {
                        center: [this.radarLat, this.radarLon],
                        zoom: 7,
                        minZoom: 3,
                        maxZoom: 15,
                        zoomControl: false,
                        attributionControl: false,
                        fadeAnimation: true,
                        zoomAnimation: true
                    });

                    // ESRI Dark Gray Canvas basemap (free, keyless, high performance dark theme)
                    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
                        maxZoom: 16,
                        attribution: ''
                    }).addTo(this.radarMap);

                    // ESRI Dark Gray Reference overlay for boundaries and place names
                    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
                        maxZoom: 16,
                        zIndex: 300,
                        attribution: ''
                    }).addTo(this.radarMap);

                    // Pulse Beacon Marker on map
                    var beaconIcon = L.divIcon({
                        className: 'radar-marker-pulse',
                        html: '<div class="marker-ring"></div><div class="marker-core"></div>',
                        iconSize: [22, 22],
                        iconAnchor: [11, 11]
                    });
                    this.radarBeacon = L.marker([this.radarLat, this.radarLon], { icon: beaconIcon, zIndexOffset: 1000 }).addTo(this.radarMap);

                    setTimeout(function () {
                        if (self.radarMap) self.radarMap.invalidateSize();
                    }, 400);

                    this.fetchRainViewerFrames();
                } else {
                    console.log('Leaflet not loaded, activating canvas radar simulation');
                    this.initFallbackRadarCanvas();
                }
            } catch (err) {
                console.error('Error initializing Leaflet radar:', err);
                this.initFallbackRadarCanvas();
            }

            this.setupRadarControls();
        },

        fetchRainViewerFrames: function () {
            var self = this;
            var statusText = document.getElementById('radarStatusText');
            if (statusText) statusText.textContent = 'Syncing...';

            fetch('https://api.rainviewer.com/public/weather-maps.json')
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    self.radarHost = data.host || 'https://tilecache.rainviewer.com';
                    self.radarData = data;

                    var frames = [];
                    if (self.radarLayerType === 'satellite' && data.satellite && data.satellite.infrared) {
                        frames = data.satellite.infrared;
                    } else if (data.radar && data.radar.past) {
                        frames = data.radar.past.concat(data.radar.nowcast || []);
                    }

                    self.radarFrames = frames;
                    if (frames.length > 0) {
                        self.radarFrameIndex = frames.length - 1;
                        self.showRadarFrame(self.radarFrameIndex);
                    }

                    if (statusText) statusText.textContent = 'Active Doppler';
                })
                .catch(function (err) {
                    console.log('RainViewer fetch fallback:', err);
                    if (statusText) statusText.textContent = 'Radar Active';
                    self.initFallbackRadarCanvas();
                });
        },

        showRadarFrame: function (index) {
            if (!this.radarMap || !this.radarFrames || this.radarFrames.length === 0) return;
            var frame = this.radarFrames[index];
            if (!frame) return;

            var tileUrl = '';
            if (this.radarLayerType === 'satellite') {
                tileUrl = this.radarHost + frame.path + '/256/{z}/{x}/{y}/0/0_0.png';
            } else {
                // Scheme 2: multi-color Doppler precipitation palette
                tileUrl = this.radarHost + frame.path + '/256/{z}/{x}/{y}/2/1_1.png';
            }

            if (this.radarLayer) {
                this.radarMap.removeLayer(this.radarLayer);
            }

            this.radarLayer = L.tileLayer(tileUrl, {
                opacity: 0.78,
                zIndex: 200,
                maxZoom: 18
            }).addTo(this.radarMap);

            var total = this.radarFrames.length;
            var pct = total > 1 ? (index / (total - 1)) * 100 : 100;
            var fill = document.getElementById('radarTimelineFill');
            var thumb = document.getElementById('radarTimelineThumb');
            if (fill) fill.style.width = pct + '%';
            if (thumb) thumb.style.left = pct + '%';

            var timeBadge = document.getElementById('radarTimestampText');
            if (timeBadge && frame.time) {
                var d = new Date(frame.time * 1000);
                var isLatest = index === total - 1;
                var timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                timeBadge.textContent = isLatest ? 'Live (' + timeStr + ')' : timeStr;
            }
        },

        toggleRadarPlayback: function () {
            var self = this;
            var playBtn = document.getElementById('radarPlayBtn');
            var playIcon = document.getElementById('radarPlayIcon');
            var pauseIcon = document.getElementById('radarPauseIcon');

            if (this.radarTimer) {
                clearInterval(this.radarTimer);
                this.radarTimer = null;
                if (playBtn) playBtn.classList.remove('playing');
                if (playIcon) playIcon.classList.remove('hidden');
                if (pauseIcon) pauseIcon.classList.add('hidden');
            } else {
                if (playBtn) playBtn.classList.add('playing');
                if (playIcon) playIcon.classList.add('hidden');
                if (pauseIcon) pauseIcon.classList.remove('hidden');

                this.radarTimer = setInterval(function () {
                    if (!self.radarFrames || self.radarFrames.length === 0) return;
                    self.radarFrameIndex = (self.radarFrameIndex + 1) % self.radarFrames.length;
                    self.showRadarFrame(self.radarFrameIndex);
                }, 650);
            }
        },

        setupRadarControls: function () {
            var self = this;

            var playBtn = document.getElementById('radarPlayBtn');
            if (playBtn) {
                playBtn.addEventListener('click', function () {
                    self.toggleRadarPlayback();
                });
            }

            var track = document.getElementById('radarTimelineTrack');
            if (track) {
                var handleScrub = function (e) {
                    if (!self.radarFrames || self.radarFrames.length === 0) return;
                    var rect = track.getBoundingClientRect();
                    var clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : rect.left);
                    var x = Math.max(0, Math.min(rect.width, clientX - rect.left));
                    var ratio = x / rect.width;
                    var targetIndex = Math.round(ratio * (self.radarFrames.length - 1));
                    self.radarFrameIndex = targetIndex;
                    self.showRadarFrame(targetIndex);
                };

                track.addEventListener('click', handleScrub);
                track.addEventListener('touchmove', handleScrub);
            }

            var btnPrecip = document.getElementById('btnRadarPrecip');
            var btnSat = document.getElementById('btnRadarSatellite');
            if (btnPrecip && btnSat) {
                btnPrecip.addEventListener('click', function () {
                    btnPrecip.classList.add('active');
                    btnSat.classList.remove('active');
                    self.radarLayerType = 'radar';
                    self.fetchRainViewerFrames();
                });

                btnSat.addEventListener('click', function () {
                    btnSat.classList.add('active');
                    btnPrecip.classList.remove('active');
                    self.radarLayerType = 'satellite';
                    self.fetchRainViewerFrames();
                });
            }

            var btnRecenter = document.getElementById('btnRadarRecenter');
            if (btnRecenter) {
                btnRecenter.addEventListener('click', function () {
                    if (self.radarMap) {
                        self.radarMap.flyTo([self.radarLat, self.radarLon], 7, { animate: true, duration: 0.8 });
                    }
                });
            }

            var btnZoomIn = document.getElementById('btnRadarZoomIn');
            if (btnZoomIn) {
                btnZoomIn.addEventListener('click', function () {
                    if (self.radarMap) self.radarMap.zoomIn();
                });
            }

            var btnZoomOut = document.getElementById('btnRadarZoomOut');
            if (btnZoomOut) {
                btnZoomOut.addEventListener('click', function () {
                    if (self.radarMap) self.radarMap.zoomOut();
                });
            }
        },

        updateRadarLocation: function (lat, lon, cityName) {
            this.radarLat = lat;
            this.radarLon = lon;

            var beaconCity = document.getElementById('radarBeaconCity');
            if (beaconCity && cityName) {
                beaconCity.textContent = cityName.split(',')[0];
            }

            if (this.radarMap) {
                this.radarMap.flyTo([lat, lon], 7, { animate: true, duration: 1.0 });
                if (this.radarBeacon) {
                    this.radarBeacon.setLatLng([lat, lon]);
                }
                setTimeout(function () {
                    if (window.WeatherApp && window.WeatherApp.radarMap) {
                        window.WeatherApp.radarMap.invalidateSize();
                    }
                }, 300);
            }
        },

        initFallbackRadarCanvas: function () {
            var canvas = document.getElementById('radarFallbackCanvas');
            if (!canvas) return;
            canvas.classList.remove('hidden');

            var ctx = canvas.getContext('2d');
            var width = canvas.width = canvas.offsetWidth || 300;
            var height = canvas.height = canvas.offsetHeight || 200;
            var cx = width / 2;
            var cy = height / 2;
            var maxR = Math.min(width, height) * 0.45;
            var angle = 0;

            function draw() {
                ctx.clearRect(0, 0, width, height);

                ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
                ctx.lineWidth = 1;
                for (var r = maxR / 3; r <= maxR; r += maxR / 3) {
                    ctx.beginPath();
                    ctx.arc(cx, cy, r, 0, Math.PI * 2);
                    ctx.stroke();
                }

                ctx.beginPath();
                ctx.moveTo(cx - maxR, cy); ctx.lineTo(cx + maxR, cy);
                ctx.moveTo(cx, cy - maxR); ctx.lineTo(cx, cy + maxR);
                ctx.stroke();

                angle += 0.035;
                var sweepX = cx + Math.cos(angle) * maxR;
                var sweepY = cy + Math.sin(angle) * maxR;

                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(sweepX, sweepY);
                ctx.stroke();

                ctx.fillStyle = 'rgba(52, 211, 153, 0.35)';
                ctx.beginPath();
                ctx.arc(cx + 35, cy - 25, 20, 0, Math.PI * 2);
                ctx.fill();

                requestAnimationFrame(draw);
            }
            draw();
        }
    };

    /**
     * Global Hook called by Android Java Runtime
     */
    window.updateWeatherFromAndroid = function (jsonData) {
        try {
            var data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            console.log('Received weather data from Android:', data);
            app.isManualPresetActive = false;
            app.renderWeather(data);
        } catch (e) {
            console.error('Failed to parse weather data from Android:', e);
        }
    };

    window.AtmosphereApp = app;

    document.addEventListener('DOMContentLoaded', function () {
        app.init();
    });

})(window);
