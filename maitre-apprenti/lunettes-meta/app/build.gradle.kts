import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
  alias(libs.plugins.android.application)
  alias(libs.plugins.jetbrains.kotlin.android)
}

val localProperties =
    Properties().apply {
      val file = rootDir.resolve("local.properties")
      if (file.exists()) file.inputStream().use { load(it) }
    }

android {
  namespace = "com.maitreapprenti.lunettes"
  compileSdk = 36

  defaultConfig {
    applicationId = "com.maitreapprenti.lunettes"
    minSdk = 31
    targetSdk = 36
    versionCode = 1
    versionName = "0.1.0"

    // Identifiants de l'appli dans le Wearables Developer Center de Meta.
    // En mode développeur, "0" suffit (voir le README).
    manifestPlaceholders["mwdat_application_id"] = localProperties.getProperty("mwdat_application_id", "0")
    manifestPlaceholders["mwdat_client_token"] = localProperties.getProperty("mwdat_client_token", "0")
  }

  buildTypes {
    release {
      isMinifyEnabled = false
    }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  testOptions { unitTests.isReturnDefaultValues = true }
}

kotlin { compilerOptions { jvmTarget = JvmTarget.JVM_17 } }

dependencies {
  implementation(libs.androidx.activity)
  implementation(libs.androidx.lifecycle.runtime)
  implementation(libs.mwdat.core)
  implementation(libs.mwdat.camera)
  implementation(libs.mwdat.display)
  implementation(libs.mwdat.speech)
  testImplementation(libs.junit)
  testImplementation(libs.kotlinx.coroutines.test)
  // org.json est fourni par Android sur le téléphone, mais pas dans les tests sur ordinateur.
  testImplementation(libs.json)
}
