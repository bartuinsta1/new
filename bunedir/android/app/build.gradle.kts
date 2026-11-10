import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val local = Properties().apply {
    rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) }
}
fun cfg(key: String, env: String) = (local.getProperty(key) ?: System.getenv(env) ?: "").replace("\"", "")

android {
    namespace = "app.bunedir"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.bunedir.android"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "SUPABASE_URL", "\"${cfg("bunedir.supabaseUrl", "BUNEDIR_SUPABASE_URL")}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"${cfg("bunedir.supabaseAnonKey", "BUNEDIR_SUPABASE_ANON_KEY")}\"")
    }

    // İçerik kopyalanmaz: depodaki ../../content klasörü assets köküne girer (words.json, covers/, scenes/).
    sourceSets["main"].assets.srcDir("../../content")

    signingConfigs {
        create("release") {
            // Play Console yüklemesi için: ortam değişkenleriyle (CI) ya da local.properties ile.
            val store = cfg("bunedir.keystore", "BUNEDIR_KEYSTORE")
            if (store.isNotEmpty()) {
                storeFile = file(store)
                storePassword = cfg("bunedir.keystorePassword", "BUNEDIR_KEYSTORE_PASSWORD")
                keyAlias = cfg("bunedir.keyAlias", "BUNEDIR_KEY_ALIAS")
                keyPassword = cfg("bunedir.keyPassword", "BUNEDIR_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.getByName("release").takeIf { it.storeFile != null }
        }
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    testOptions { unitTests.isReturnDefaultValues = true }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.glance:glance-appwidget:1.1.1")
    implementation("androidx.work:work-runtime-ktx:2.10.0")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    testImplementation("junit:junit:4.13.2")
    // Birim testlerinde android.jar'daki org.json taslak; gerçeğini kullan.
    testImplementation("org.json:json:20240303")
}
