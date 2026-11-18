# ☀️ Atmosphere 3D - Premium Modern Weather Application

An immersive, futuristic, 3D weather application engineered with **Three.js WebGL** and **Google Stitch's** raytraced glassmorphic design language. The application features a dual-runtime architecture: running as a high-performance **native Android application** with a hardware-accelerated JavaScript bridge and as a **responsive standalone web application** for desktop, tablet, and mobile.

---

## 🌟 Key 3D & Visual Highlights

### 🎨 3D Visual Experience (Three.js WebGL Engine)
- **Volumetric 3D Clouds**: Procedurally generated, puffy cloud clusters with realistic Fresnel rim lighting, soft transmission, and wind-drift physics.
- **Radiant 3D Sun**: Luminous solar core with multi-layered coronal glow, pulsating flares, rotating rays, and dynamic scene illumination.
- **Realistic 3D Moon**: Detailed lunar sphere with dark craters, silver rim specular highlights, and a twinkling celestial starfield.
- **3D Particle Precipitation Physics**:
  - **Rain & Thunderstorm**: 600+ falling rain particles with wind deflection, ground splash ripple rings, and realistic randomized lightning flashes that dynamically light up the cloud volume.
  - **Snowfall**: 450+ 3D crystalline snowflakes tumbling, swirling, and drifting with air turbulence.
- **Day & Night Atmospheric Shifts**: Dynamic sky transitions between bright cyan daylight, golden amber sunset, and cosmic obsidian night.
- **Interactive 360° Orbit & Parallax**: Drag/touch to inspect the 3D weather scene from any angle; subtle gyro/mouse parallax gives deep 3D perspective.

### 💎 Modern Google Stitch Glassmorphic UI
- **Deep Obsidian & Midnight Sapphire Surfaces**: Immersive background palette (`#080e1d`, `#0d1322`, `#151b2b`, `#191f2f`, `#242a3a`).
- **Specular Glass Panels**: Frosted glass cards featuring `backdrop-filter: blur(28px)`, specular borders, and interactive 3D card tilt on hover/touch (`perspective(1000px) rotateX(...) rotateY(...)`).
- **Animated Auroral Radiance Spheres**: Multi-layered blurred ambient glow orbs that softly float in the background.
- **Interactive Preset Toolbar**: Instant testing buttons (`Auto`, `Sun`, `Rain`, `Storm`, `Snow`, `Night`) to preview every 3D weather state.

### 📊 Precision Weather Dashboard & Bento Grid
- **Hero Temperature & Condition**: Ultra-crisp typography with high/low summary capsule and glowing condition pill.
- **3D Hourly Forecast Carousel**: Horizontal scroll cards for the next 24 hours with precipitation probabilities and condition icons.
- **7-Day Bento Forecast**: Apple Weather-style temperature range gradients with glowing current temperature marker dot.
- **Precision Telemetry Grid (6 Metrics)**:
  1. **Air Quality Index (AQI)**: Numeric rating, quality text, and color-coded status bar.
  2. **Wind Telemetry**: Speed in km/h, 3D rotating compass needle, direction badge, and gust speeds.
  3. **UV Index**: Category rating with multi-color spectrum gradient bar.
  4. **Humidity**: Real-time percentage, dew point, and liquid fill bar.
  5. **Visibility**: Metric clarity index in kilometers with horizon rating.
  6. **Atmospheric Pressure**: Barometric reading in hPa with trend indicator.
- **Solar Ephemeris & Daylight Trajectory**: Curved solar trajectory arc showing sunrise, sunset, and live sun position marker.
- **Doppler Precipitation Radar**: Stylized radar viewport with range rings, rotating sweep beam, and Doppler rain blooms.
- **Severe Weather Alert Banner**: Dynamic amber advisory banner alerting to high winds, thunderstorms, or precipitation.

---

## 🛠️ Architecture & Tech Stack

### Dual-Target Architecture
1. **Android Native App (`app/`)**:
   - **Language**: Java 8+ / Kotlin DSL
   - **Target SDK**: 34 (Android 14) / **Min SDK**: 21 (Android 5.0)
   - **WebView Bridge**: Hardware-accelerated WebGL WebView (`android:hardwareAccelerated="true"`, `LAYER_TYPE_HARDWARE`) loading local assets with zero network latency (`file:///android_asset/weather3d/`).
   - **Bidirectional Bridge (`WeatherAppBridge`)**:
     - `bridge.searchCity(city)` & `bridge.requestCurrentLocation()` -> triggers native `WeatherAPIClient` & GPS `LocationManager`.
     - `MainActivity.onWeatherDataReceived` -> pushes structured JSON directly to Three.js via `window.updateWeatherFromAndroid(data)`.
   - **Resilience**: 100% backward-compatible layout retaining classic native view IDs.

2. **Responsive Web Application (`web/`)**:
   - Runs directly in any modern browser on desktop, tablet, and mobile.
   - Built with **Three.js r128**, pure modern CSS Grid/Flexbox, and vanilla JavaScript.
   - Includes Web Audio API ambient audio synthesis (tap chimes, subtle wind/rain toggles).

---

## 🚀 Getting Started

### 1. Build and Run on Android
```bash
# On Windows
.\gradlew.bat assembleDebug

# On macOS / Linux
./gradlew assembleDebug
```
The compiled APK is output at `app/build/outputs/apk/debug/app-debug.apk` and copied to `weatherapp-3d-atmosphere.apk`.

### 2. Run Standalone in Web Browser
Open `web/index.html` directly in Google Chrome, Microsoft Edge, or Safari, or start a local static server:
```bash
# Using Node.js
npx serve web

# Or using Python
python -m http.server 8000 -d web
```
Then visit `http://localhost:8000`.

---

## 🔒 Configuration & Security

- Store your OpenWeatherMap API key securely in `.env`:
  ```env
  OPENWEATHER_API_KEY=your_actual_api_key_here
  API_KEY=your_actual_api_key_here
  ```
- The key is injected at compile time via Gradle into `BuildConfig.API_KEY` and is never committed to Git.

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
