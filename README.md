# ☀️ Weather App (Android)

A modern, responsive Android weather application built in Java. It provides real-time weather forecasts, current meteorological observations, and Air Quality Index (AQI) data using the OpenWeatherMap API.

---

## 📱 Features

- **Real-Time Weather**: Displays temperature, weather condition, humidity, wind speed, and visibility.
- **Air Quality Index (AQI)**: Shows live pollution index with air quality metrics.
- **5-Day Weather Forecast**: Interactive forecast cards powered by `RecyclerView`.
- **GPS Location Detection**: Automatically fetches weather for your current GPS coordinates.
- **City Search**: Search for weather in any city worldwide with instant results.
- **Pull to Refresh**: Seamlessly refresh conditions with `SwipeRefreshLayout`.
- **Secure Architecture**: API keys are isolated in `.env` and injected via Gradle `BuildConfig`. Secrets are never committed to version control.

---

## 🛠️ Tech Stack & Requirements

- **Platform**: Android (Min SDK: 21 / Android 5.0, Target SDK: 34 / Android 14)
- **Language**: Java 8+
- **Build System**: Gradle 8.7 (Kotlin DSL)
- **Android Gradle Plugin (AGP)**: 8.6.0
- **Networking**: [OkHttp 4](https://square.github.io/okhttp/)
- **UI Components**: Material Components, ConstraintLayout, CardView, RecyclerView, SwipeRefreshLayout
- **Data Source**: [OpenWeatherMap API](https://openweathermap.org/api)

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/someshwar-songara/weatherapp.git
cd weatherapp
```

### 2. Configure Your API Key
1. Create a free account at [OpenWeatherMap](https://openweathermap.org/api) and generate an API key.
2. Copy the sample environment file:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and add your API key:
   ```env
   OPENWEATHER_API_KEY=your_actual_api_key_here
   API_KEY=your_actual_api_key_here
   ```
*(Note: You can also specify `OPENWEATHER_API_KEY=...` in your `local.properties` file).*

### 3. Build & Run
Open the project in **Android Studio** and click **Run**, or build using Gradle:

```bash
# On Windows
gradlew.bat assembleDebug

# On Linux / macOS
./gradlew assembleDebug
```

The compiled APK will be generated at `app/build/outputs/apk/debug/app-debug.apk`.

---

## 🔒 Security Best Practices

- The `.env` file is included in `.gitignore` and `.htaccess`. It will **never** be checked into version control.
- API keys are injected at build time into `BuildConfig.API_KEY` and are not hardcoded anywhere in the Java source files.
- Collaborators should clone the repo and create their own `.env` from `.env.example`.

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
