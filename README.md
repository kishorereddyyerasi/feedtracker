# 🤱 FeedTracker

A newborn baby care app for Android — tracks breastfeeding, baby tracker (urine/motion/diaper), medicines, and more.

## Features
- 🍼 Breastfeeding timer (left/right side, pause, manual entry)
- ⏱ Next feed countdown with configurable interval + push notification
- 💧💩🔄 Baby tracker — urine, motion, diaper (daily counts + 10-day history)
- 💊 Medicine/syrup tracker — dosage, frequency, dose logging
- 👶 Baby profile — name, mother's name, DOB with auto age display
- 📥 Export all data to CSV
- 🌙 Dark mode

## Install on Android

1. Go to **[Releases](../../releases)** on this GitHub page
2. Download the latest `app-debug.apk`
3. On your Android phone:
   - Go to **Settings → Security** (or **Settings → Apps → Special app access**)
   - Enable **"Install unknown apps"** for your browser/file manager
4. Open the downloaded APK and tap **Install**
5. Open **FeedTracker** from your app drawer

## For Developers — Build Locally

### Prerequisites
- Node.js 18+
- Android Studio with SDK installed
- Java 17

### Steps
```bash
git clone https://github.com/YOUR_USERNAME/feedtracker.git
cd feedtracker
npm install
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
```
APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`

## Support
For any support or issues, please reach out to **Kishore Reddy Yerasi**
