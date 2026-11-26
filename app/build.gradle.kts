import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
}

// Helper to load properties from .env or local.properties
fun loadApiKey(): String {
    val envFile = rootProject.file(".env")
    if (envFile.exists()) {
        val envProps = Properties()
        FileInputStream(envFile).use { envProps.load(it) }
        val key = envProps.getProperty("OPENWEATHER_API_KEY") ?: envProps.getProperty("API_KEY")
        if (!key.isNullOrBlank()) return key.trim()
    }
    val localPropertiesFile = rootProject.file("local.properties")
    if (localPropertiesFile.exists()) {
        val localProps = Properties()
        FileInputStream(localPropertiesFile).use { localProps.load(it) }
        val key = localProps.getProperty("OPENWEATHER_API_KEY") ?: localProps.getProperty("API_KEY")
        if (!key.isNullOrBlank()) return key.trim()
    }
    return System.getenv("OPENWEATHER_API_KEY") ?: System.getenv("API_KEY") ?: ""
}

val weatherApiKey = loadApiKey()

android {
    namespace = "com.example.weatherapp"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.example.weatherapp"
        minSdk = 21
        targetSdk = 34
        versionCode = 10
        versionName = "2.8.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        buildConfigField("String", "OPENWEATHER_API_KEY", "\"$weatherApiKey\"")
        buildConfigField("String", "API_KEY", "\"$weatherApiKey\"")
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.10.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.recyclerview:recyclerview:1.3.2")
    implementation("androidx.cardview:cardview:1.0.0")
    implementation("com.squareup.okhttp3:okhttp:4.11.0")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
}
