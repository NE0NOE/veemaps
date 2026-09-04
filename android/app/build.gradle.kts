plugins {
  alias(libs.plugins.android.application)
}

android {
    namespace = "com.veemaps.geotremaps"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.veemaps.geotremaps"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "2.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
        debug {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
      compose = false
      viewBinding = false
      aidl = false
      buildConfig = true
      shaders = false
    }

    packaging {
      resources {
        excludes += "/META-INF/{AL2.0,LGPL2.1}"
      }
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
  // AndroidX Core, Activity & AppCompat
  implementation(libs.androidx.core.ktx)
  implementation(libs.androidx.activity)
  implementation(libs.androidx.appcompat)
  implementation(libs.androidx.lifecycle.runtime.ktx)
  
  // WebKit with WebViewAssetLoader for 100% offline local asset loading
  implementation(libs.androidx.webkit)

  // Local unit testing
  testImplementation(libs.junit)
  testImplementation(libs.kotlinx.coroutines.test)
}

// Gradle task to synchronize web assets before building APK
tasks.register<Copy>("syncWebAssets") {
    from("${rootProject.projectDir}/..") {
        include("index.html")
        include("manifest.json")
        include("sw.js")
        include("css/**")
        include("js/**")
        include("vendor/**")
    }
    into("${projectDir}/src/main/assets/www")
}

tasks.named("preBuild") {
    dependsOn("syncWebAssets")
}
