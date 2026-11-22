/**
 * Atmosphere 3D - World-Class Application Controller & Real-Time Engine
 * Connects Three.js 3D Weather Environment with Interactive UI, Charting, and Android Runtime
 */

(function (window) {
    'use strict';

    var app = {
        weather3D: null,
        currentUnit: 'C', // 'C' or 'F'
        currentTheme: 'dark', // 'dark' or 'light'
        chartMode: 'temp', // 'temp' or 'rain'
        isSoundEnabled: false,
        audioCtx: null,
        weatherData: null,
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

            // Load saved settings from localStorage
            try {
                var storedUnit = localStorage.getItem('atmosphere_unit');
                if (storedUnit) this.currentUnit = storedUnit;

                var storedTheme = localStorage.getItem('atmosphere_theme');
                if (storedTheme) this.currentTheme = storedTheme;

                var storedCities = localStorage.getItem('atmosphere_saved_cities');
                if (storedCities) this.savedCities = JSON.parse(storedCities);
            } catch (e) {}

            this.applyTheme(this.currentTheme);

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

            // Search Bar
            var searchInput = document.getElementById('citySearchInput');
            if (searchInput) {
                searchInput.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter') {
                        var query = searchInput.value.trim();
                        if (query) {
                            self.performSearch(query);
                            searchInput.blur();
                        }
                    }
                });
            }

            // Preset 3D Switcher (Auto, Sun, Rain, Storm, Snow, Cloud, Sunset, Night)
            var presetBtns = document.querySelectorAll('.scene-btn[data-condition]');
            presetBtns.forEach(function (btn) {
                btn.addEventListener('click', function () {
                    presetBtns.forEach(function (b) { b.classList.remove('active'); });
                    btn.classList.add('active');
                    var cond = btn.getAttribute('data-condition');
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

            // Radar Play Loop toggle
            var radarPlayBtn = document.getElementById('radarPlayBtn');
            if (radarPlayBtn) {
                radarPlayBtn.addEventListener('click', function () {
                    var isPlaying = radarPlayBtn.classList.toggle('playing');
                    radarPlayBtn.style.background = isPlaying ? 'var(--emerald-green)' : 'var(--primary-cyan)';
                });
            }

            // Window resize -> Redraw chart
            window.addEventListener('resize', function () {
                if (self.weatherData) {
                    self.renderTemperatureChart(self.weatherData.forecast);
                }
            });
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
            else if (tab === 'radar') targetId = 'radarSection';
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

            // City & Date
            var cityEl = document.getElementById('tvCityName');
            if (cityEl) cityEl.textContent = data.city || 'San Francisco';

            var dateEl = document.getElementById('tvCurrentDate');
            if (dateEl) {
                var now = new Date();
                dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            }

            // Temperature Metrics
            var tempVal = this.convertTemp(data.temperature);
            var tempEl = document.getElementById('tvHeroTemperature');
            if (tempEl) tempEl.textContent = tempVal;

            var unitSymbolEl = document.getElementById('tvTempUnitSymbol');
            if (unitSymbolEl) unitSymbolEl.textContent = '°' + this.currentUnit;

            // Condition Pill
            var condDesc = data.description || 'Partly Cloudy';
            var condEl = document.getElementById('tvConditionText');
            if (condEl) condEl.textContent = this.capitalize(condDesc);

            // High / Low & Feels Like
            var feelsVal = this.convertTemp(data.feelsLike !== undefined ? data.feelsLike : data.temperature);
            var highVal = this.convertTemp(data.tempMax !== undefined ? data.tempMax : data.temperature + 3);
            var lowVal = this.convertTemp(data.tempMin !== undefined ? data.tempMin : data.temperature - 4);
            var highLowEl = document.getElementById('tvHighLowSummary');
            if (highLowEl) {
                highLowEl.innerHTML = 'Feels like ' + feelsVal + '° <span class="dot">·</span> H: ' + highVal + '° <span class="dot">·</span> L: ' + lowVal + '°';
            }

            // Update 3D Engine State
            var auroraBg = document.querySelector('.aurora-bg');
            if (this.weather3D) {
                var isDayTime = true;
                var isSunset = (condDesc.toLowerCase().indexOf('sunset') !== -1);

                if (data.isDay !== undefined) {
                    isDayTime = data.isDay;
                } else if (data.sunset && data.sunrise) {
                    var currentHour = new Date().getHours();
                    isDayTime = currentHour >= 6 && currentHour < 19;
                    if (currentHour === 18 || currentHour === 19) isSunset = true;
                }

                if (auroraBg) {
                    if (isSunset) auroraBg.classList.add('sunset-theme');
                    else auroraBg.classList.remove('sunset-theme');
                }

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
            // 1. AQI
            var aqiVal = data.aqi || 1;
            var aqiNumberEl = document.getElementById('tvAqiNumber');
            var aqiDescEl = document.getElementById('tvAqiDescription');
            var aqiDot = document.getElementById('aqiDot');
            var aqiFill = document.getElementById('aqiFill');
            var aqiColor = '#34d399';
            var aqiText = 'Good';

            if (aqiVal <= 1 || aqiVal <= 50) { aqiText = 'Good'; aqiColor = '#34d399'; }
            else if (aqiVal <= 2 || aqiVal <= 100) { aqiText = 'Moderate'; aqiColor = '#facc15'; }
            else if (aqiVal <= 3 || aqiVal <= 150) { aqiText = 'Unhealthy (Sens.)'; aqiColor = '#fb923c'; }
            else { aqiText = 'Unhealthy'; aqiColor = '#f87171'; }

            if (aqiNumberEl) aqiNumberEl.textContent = aqiVal;
            if (aqiDescEl) { aqiDescEl.textContent = aqiText + ' Quality'; aqiDescEl.style.color = aqiColor; }
            if (aqiDot) aqiDot.style.backgroundColor = aqiColor;
            if (aqiFill) { aqiFill.style.width = Math.min(100, (aqiVal * 20)) + '%'; aqiFill.style.backgroundColor = aqiColor; }

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

            // 3. UV Index
            var uv = data.uvIndex !== undefined ? data.uvIndex : 3.0;
            var uvEl = document.getElementById('tvUvVal');
            var uvDescEl = document.getElementById('tvUvDesc');
            var uvFill = document.getElementById('uvFill');
            var uvText = 'Moderate';
            if (uv <= 2) uvText = 'Low';
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

            // Ephemeris Sunrise & Sunset
            var sunriseEl = document.getElementById('tvSunriseTime');
            var sunsetEl = document.getElementById('tvSunsetTime');
            if (sunriseEl) sunriseEl.textContent = data.sunrise || '6:28 AM';
            if (sunsetEl) sunsetEl.textContent = data.sunset || '7:42 PM';

            // Render Hourly, Interactive Curve Chart, and 7-Day Forecast
            this.renderHourlyForecast(data.forecast);
            this.renderTemperatureChart(data.forecast);
            this.renderWeeklyForecast(data.forecast, tempVal);
        },

        renderHourlyForecast: function (forecastList) {
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
                var el = document.createElement('div');
                el.className = 'hourly-item' + (idx === 0 ? ' active' : '');
                el.innerHTML = [
                    '<span class="hourly-time">' + it.time + '</span>',
                    self.getWeatherSvgIcon(it.desc, 28),
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

        getWeatherSvgIcon: function (desc, size) {
            desc = (desc || '').toLowerCase();
            size = size || 24;

            if (desc.indexOf('rain') !== -1 || desc.indexOf('drizzle') !== -1) {
                return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M16 13v6M8 13v6M12 15v6M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/></svg>';
            } else if (desc.indexOf('snow') !== -1) {
                return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2"><path d="M12 3v18M3 12h18M6 6l12 12M6 18L18 6"/></svg>';
            } else if (desc.indexOf('clear') !== -1 || desc.indexOf('sun') !== -1) {
                return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="#fde047" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
            } else {
                return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="#8ed5ff" stroke-width="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>';
            }
        },

        setConditionPreset: function (cond, isDay, isSunset) {
            this.playChime();
            var auroraBg = document.querySelector('.aurora-bg');
            if (auroraBg) {
                if (isSunset) auroraBg.classList.add('sunset-theme');
                else auroraBg.classList.remove('sunset-theme');
            }

            if (this.weather3D) {
                this.weather3D.setCondition(cond, isDay, isSunset);
            }
            if (this.weatherData) {
                this.weatherData.description = isSunset ? 'Golden Hour Sunset' : cond;
                this.weatherData.isDay = isDay;
                this.renderWeather(this.weatherData);
            }
        },

        loadInitialSampleData: function () {
            this.renderWeather({
                city: 'San Francisco, US',
                temperature: 22,
                feelsLike: 23,
                tempMin: 16,
                tempMax: 26,
                description: 'Partly Cloudy',
                humidity: 64,
                windSpeed: 4.2,
                windDeg: 315,
                visibility: 10.0,
                aqi: 42,
                pressure: 1014,
                uvIndex: 3.5,
                sunrise: '6:28 AM',
                sunset: '7:42 PM',
                isDay: true,
                forecast: [
                    { time: 'Now', temperature: 22, description: 'Partly Cloudy' },
                    { time: '13:00', temperature: 23, description: 'Partly Cloudy' },
                    { time: '14:00', temperature: 24, description: 'Cloudy' },
                    { time: '15:00', temperature: 23, description: 'Rain' },
                    { time: '16:00', temperature: 21, description: 'Rain' },
                    { time: '17:00', temperature: 20, description: 'Cloudy' },
                    { time: '18:00', temperature: 19, description: 'Sunset' }
                ]
            });
        },

        /**
         * Live OpenWeatherMap API Direct Query (Standalone Web Mode)
         */
        fetchWeatherByCity: function (city) {
            var self = this;
            var url = 'https://api.openweathermap.org/data/2.5/weather?q=' + encodeURIComponent(city) + '&appid=' + this.apiKey + '&units=metric';
            var forecastUrl = 'https://api.openweathermap.org/data/2.5/forecast?q=' + encodeURIComponent(city) + '&appid=' + this.apiKey + '&units=metric';

            fetch(url)
                .then(function (res) {
                    if (!res.ok) throw new Error('City not found');
                    return res.json();
                })
                .then(function (cur) {
                    fetch(forecastUrl)
                        .then(function (r2) { return r2.json(); })
                        .then(function (fore) {
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

                            var sunriseTime = '6:30 AM';
                            var sunsetTime = '7:30 PM';
                            if (cur.sys) {
                                sunriseTime = new Date(cur.sys.sunrise * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                sunsetTime = new Date(cur.sys.sunset * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            }

                            var d = {
                                city: cur.name + ', ' + (cur.sys ? cur.sys.country : ''),
                                temperature: cur.main.temp,
                                feelsLike: cur.main.feels_like,
                                tempMin: cur.main.temp_min,
                                tempMax: cur.main.temp_max,
                                description: cur.weather[0].description,
                                humidity: cur.main.humidity,
                                windSpeed: cur.wind.speed,
                                windDeg: cur.wind.deg || 0,
                                visibility: cur.visibility ? (cur.visibility / 1000) : 10.0,
                                aqi: 42,
                                pressure: cur.main.pressure || 1013,
                                uvIndex: 3.5,
                                sunrise: sunriseTime,
                                sunset: sunsetTime,
                                isDay: true,
                                forecast: fItems
                            };
                            self.renderWeather(d);
                        })
                        .catch(function () {
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
                'tokyo': { city: 'Tokyo, JP', temperature: 18, description: 'Rain', humidity: 82, windSpeed: 5.5, aqi: 28, uvIndex: 2.0 },
                'london': { city: 'London, UK', temperature: 14, description: 'Overcast Clouds', humidity: 76, windSpeed: 6.2, aqi: 35, uvIndex: 1.5 },
                'new york': { city: 'New York, US', temperature: 27, description: 'Clear Sky', humidity: 52, windSpeed: 3.4, aqi: 48, uvIndex: 7.0 },
                'reykjavik': { city: 'Reykjavik, IS', temperature: 1, description: 'Light Snow', humidity: 88, windSpeed: 8.0, aqi: 12, uvIndex: 0.5 },
                'paris': { city: 'Paris, FR', temperature: 19, description: 'Scattered Clouds', humidity: 60, windSpeed: 4.1, aqi: 38, uvIndex: 4.0 },
                'ujjain': { city: 'Ujjain, IN', temperature: 25, description: 'Clear Sky', humidity: 45, windSpeed: 3.2, aqi: 55, uvIndex: 6.0 }
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
        }
    };

    /**
     * Global Hook called by Android Java Runtime
     */
    window.updateWeatherFromAndroid = function (jsonData) {
        try {
            var data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            console.log('Received weather data from Android:', data);
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
