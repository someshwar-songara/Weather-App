/**
 * Atmosphere 3D - Application Controller & Bridge
 * Connects Three.js 3D Weather Engine with UI and Android Native Runtime
 */

(function (window) {
    'use strict';

    var app = {
        weather3D: null,
        currentUnit: 'C', // 'C' or 'F'
        isSoundEnabled: false,
        audioCtx: null,
        weatherData: null,
        savedCities: [
            { name: 'San Francisco', country: 'United States', tempC: 22, tempF: 72, cond: 'Partly Cloudy', icon: 'partly_cloudy' },
            { name: 'Tokyo', country: 'Japan', tempC: 18, tempF: 64, cond: 'Rain', icon: 'rain' },
            { name: 'London', country: 'United Kingdom', tempC: 14, tempF: 58, cond: 'Cloudy', icon: 'cloudy' },
            { name: 'New York', country: 'United States', tempC: 27, tempF: 81, cond: 'Sunny', icon: 'sunny' },
            { name: 'Reykjavik', country: 'Iceland', tempC: 1, tempF: 34, cond: 'Snow', icon: 'snow' }
        ],

        init: function () {
            var self = this;

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

            // Default fallback / initial sample data matching Google Stitch
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
                unitBtn.addEventListener('click', function () {
                    self.currentUnit = self.currentUnit === 'C' ? 'F' : 'C';
                    unitBtn.textContent = '°' + self.currentUnit;
                    self.renderWeather(self.weatherData);
                });
            }

            // Location Current GPS click
            var locBtn = document.getElementById('locationBtn');
            if (locBtn) {
                locBtn.addEventListener('click', function () {
                    self.playChime();
                    if (window.AndroidBridge && window.AndroidBridge.requestCurrentLocation) {
                        window.AndroidBridge.requestCurrentLocation();
                    } else if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(function (pos) {
                            self.fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
                        }, function (err) {
                            alert('Location permission denied or unavailable.');
                        });
                    }
                });
            }

            // Search Input handling
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

            // 3D Weather Preset Switcher (Quick Test Toolbar)
            var presetBtns = document.querySelectorAll('.scene-btn[data-condition]');
            presetBtns.forEach(function (btn) {
                btn.addEventListener('click', function () {
                    presetBtns.forEach(function (b) { b.classList.remove('active'); });
                    btn.classList.add('active');
                    var cond = btn.getAttribute('data-condition');
                    var isDay = btn.getAttribute('data-day') !== 'false';
                    self.setConditionPreset(cond, isDay);
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

            // Saved Cities click
            var cityCards = document.querySelectorAll('.saved-city-card');
            cityCards.forEach(function (card) {
                card.addEventListener('click', function () {
                    var city = card.getAttribute('data-city');
                    if (city) {
                        self.performSearch(city);
                        self.closeDrawers();
                    }
                });
            });

            // Radar Play Loop toggle
            var radarPlayBtn = document.getElementById('radarPlayBtn');
            if (radarPlayBtn) {
                radarPlayBtn.addEventListener('click', function () {
                    var isPlaying = radarPlayBtn.classList.toggle('playing');
                    radarPlayBtn.style.background = isPlaying ? 'var(--emerald-green)' : 'var(--primary-cyan)';
                });
            }
        },

        handleTabSwitch: function (tab) {
            this.playChime();
            var targetId = '';
            if (tab === 'forecast') targetId = 'hourlySection';
            else if (tab === 'radar') targetId = 'radarSection';
            else if (tab === 'telemetry') targetId = 'telemetrySection';
            else if (tab === 'settings') {
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
            if (window.AndroidBridge && window.AndroidBridge.searchCity) {
                window.AndroidBridge.searchCity(query);
            } else {
                this.fetchWeatherByCity(query);
            }
        },

        /**
         * 3D Floating Perspective Tilt Micro-interaction on Cards
         */
        setupCardTilt: function () {
            var cards = document.querySelectorAll('.glass-panel');
            cards.forEach(function (card) {
                card.addEventListener('mousemove', function (e) {
                    var rect = card.getBoundingClientRect();
                    var x = e.clientX - rect.left;
                    var y = e.clientY - rect.top;
                    var centerX = rect.width / 2;
                    var centerY = rect.height / 2;
                    var rotateX = ((y - centerY) / centerY) * -6;
                    var rotateY = ((x - centerX) / centerX) * 6;

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
                osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
                osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.35);
            } catch (e) {}
        },

        convertTemp: function (celsius) {
            if (this.currentUnit === 'F') {
                return Math.round((celsius * 9 / 5) + 32);
            }
            return Math.round(celsius);
        },

        /**
         * Renders comprehensive weather data into the UI & 3D Engine
         */
        renderWeather: function (data) {
            if (!data) return;
            this.weatherData = data;

            // City & Date
            var cityEl = document.getElementById('tvCityName');
            if (cityEl) cityEl.textContent = data.city || 'San Francisco';

            var dateEl = document.getElementById('tvCurrentDate');
            if (dateEl) {
                var now = new Date();
                dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            }

            // Temperature
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
            if (this.weather3D) {
                var isDayTime = true;
                if (data.isDay !== undefined) {
                    isDayTime = data.isDay;
                } else if (data.sunset && data.sunrise) {
                    // compute based on local time
                    var currentHour = new Date().getHours();
                    isDayTime = currentHour >= 6 && currentHour < 19;
                }
                this.weather3D.setCondition(condDesc, isDayTime);
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
                    alertDesc.textContent = 'Gusts up to ' + Math.round(windSpeedKmh) + ' km/h across exposed areas';
                } else if (descLower.indexOf('thunder') !== -1 || descLower.indexOf('storm') !== -1) {
                    alertBanner.style.display = 'flex';
                    alertTitle.textContent = 'Severe Thunderstorm Warning';
                    alertDesc.textContent = 'Active electrical activity and heavy downpours detected';
                } else if (descLower.indexOf('snow') !== -1 || descLower.indexOf('ice') !== -1) {
                    alertBanner.style.display = 'flex';
                    alertTitle.textContent = 'Winter Weather Advisory';
                    alertDesc.textContent = 'Freezing temperatures and reduced roadway friction';
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
            var pressure = data.pressure || 1013;
            var pressEl = document.getElementById('tvPressureVal');
            if (pressEl) pressEl.textContent = pressure;

            // Ephemeris Sunrise & Sunset
            var sunriseEl = document.getElementById('tvSunriseTime');
            var sunsetEl = document.getElementById('tvSunsetTime');
            if (sunriseEl) sunriseEl.textContent = data.sunrise || '6:28 AM';
            if (sunsetEl) sunsetEl.textContent = data.sunset || '7:42 PM';

            // Hourly Forecast
            this.renderHourlyForecast(data.forecast);

            // 7-Day Forecast
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
                // Default 8-hour horizon
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
                    self.getWeatherSvgIcon(it.desc, 26),
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
                    '<div class="daily-icon-wrap">' + self.getWeatherSvgIcon(d === 2 || d === 3 ? 'sunny' : (d === 5 ? 'rain' : 'partly_cloudy'), 20) + '</div>',
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
                // Cloud / Partly Cloudy
                return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="#8ed5ff" stroke-width="2"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>';
            }
        },

        setConditionPreset: function (cond, isDay) {
            this.playChime();
            if (this.weather3D) {
                this.weather3D.setCondition(cond, isDay);
            }
            if (this.weatherData) {
                this.weatherData.description = cond;
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
                    { time: '18:00', temperature: 19, description: 'Sunny' }
                ]
            });
        },

        fetchWeatherByCity: function (city) {
            var self = this;
            // When running in standalone web mode without Android bridge:
            // Query OpenWeatherMap directly or provide responsive local mock
            var mockCities = {
                'tokyo': { city: 'Tokyo, JP', temperature: 18, description: 'Rain', humidity: 82, windSpeed: 5.5, aqi: 28, uvIndex: 2.0 },
                'london': { city: 'London, UK', temperature: 14, description: 'Overcast Clouds', humidity: 76, windSpeed: 6.2, aqi: 35, uvIndex: 1.5 },
                'new york': { city: 'New York, US', temperature: 27, description: 'Clear Sky', humidity: 52, windSpeed: 3.4, aqi: 48, uvIndex: 7.0 },
                'reykjavik': { city: 'Reykjavik, IS', temperature: 1, description: 'Light Snow', humidity: 88, windSpeed: 8.0, aqi: 12, uvIndex: 0.5 },
                'paris': { city: 'Paris, FR', temperature: 19, description: 'Scattered Clouds', humidity: 60, windSpeed: 4.1, aqi: 38, uvIndex: 4.0 }
            };

            var key = city.toLowerCase().trim();
            if (mockCities[key]) {
                var d = Object.assign({}, self.weatherData, mockCities[key]);
                self.renderWeather(d);
                return;
            }

            // Fallback: update city name dynamically with variations
            if (self.weatherData) {
                var d = Object.assign({}, self.weatherData);
                d.city = self.capitalize(city);
                self.renderWeather(d);
            }
        },

        fetchWeatherByCoords: function (lat, lon) {
            if (this.weatherData) {
                var d = Object.assign({}, this.weatherData);
                d.city = 'GPS Location (' + lat.toFixed(2) + '°, ' + lon.toFixed(2) + '°)';
                this.renderWeather(d);
            }
        },

        capitalize: function (str) {
            if (!str) return '';
            return str.charAt(0).toUpperCase() + str.slice(1);
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
