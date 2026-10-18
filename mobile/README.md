# SG4DMyanmar - Android Mobile App (APK)

This directory contains the production-ready Android wrapper and build scripts to export clean Android APK packages for **SG4DMyanmar**.

---

## 📱 Features
- **Electric Purple Dark Mode Theme**: Matches the web platform branding with customized status bar and navigation colors.
- **Hardware Acceleration**: Enabled for smooth animations and instantaneous betting interaction.
- **Swipe-to-Refresh**: Native pull-to-refresh with electric purple spinner.
- **Payment Slip File Chooser**: Supports camera snapshot and gallery file upload for KPay, WavePay, and AYA Pay receipts.
- **Myanmar Timezone (MMT UTC+6:30)**: Real-time clock and 15-minute expiry synchronization.

---

## 🛠️ Prerequisites
1. **Java Development Kit (JDK 17 or higher)**:
   ```bash
   java -version
   ```
2. **Android SDK** (API Level 34):
   - Set environment variable: `ANDROID_HOME=C:\Users\<user>\AppData\Local\Android\Sdk`

---

## 🚀 Building the APK

### 1. Build Debug APK (For Testing)
On Windows PowerShell:
```powershell
cd d:\SG4DMyanmar\mobile\scripts
.\build_apk.ps1 -BuildType debug
```
Or directly using Gradle:
```bash
cd d:\SG4DMyanmar\mobile\android
gradle assembleDebug
```
**Output Location:**
`mobile/android/app/build/outputs/apk/debug/SG4DMyanmar-v1.0.0-debug.apk`

---

### 2. Build Release APK (For Production Distribution)
On Windows PowerShell:
```powershell
cd d:\SG4DMyanmar\mobile\scripts
.\build_apk.ps1 -BuildType release
```
Or directly using Gradle:
```bash
cd d:\SG4DMyanmar\mobile\android
gradle assembleRelease
```
**Output Location:**
`mobile/android/app/build/outputs/apk/release/SG4DMyanmar-v1.0.0-release.apk`

---

## 🔐 Generating Release Signing Key (Optional for Google Play / Sideloading)
To sign your APK with a custom keystore:
```bash
keytool -genkey -v -keystore sg4d-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias sg4dmyanmar
```
Place `sg4d-release-key.jks` in `mobile/android/app/` and add to `mobile/android/gradle.properties`:
```properties
SG4D_RELEASE_STORE_FILE=sg4d-release-key.jks
SG4D_RELEASE_KEY_ALIAS=sg4dmyanmar
SG4D_RELEASE_STORE_PASSWORD=your_keystore_password
SG4D_RELEASE_KEY_PASSWORD=your_key_password
```

---

## 📲 Installing on Device via ADB
```bash
adb install -r mobile/android/app/build/outputs/apk/release/SG4DMyanmar-v1.0.0-release.apk
```
