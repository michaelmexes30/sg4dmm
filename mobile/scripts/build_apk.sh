#!/usr/bin/env bash
# SG4DMyanmar Automated APK Build Script (Linux/macOS/CI-CD)
set -e

BUILD_TYPE=${1:-release}

echo "=========================================="
echo " SG4DMyanmar Android APK Export Pipeline "
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_DIR="$SCRIPT_DIR/../android"

cd "$ANDROID_DIR"

echo "[1/3] Setting permissions on Gradle wrapper..."
if [ -f "./gradlew" ]; then
    chmod +x ./gradlew
    GRADLE_CMD="./gradlew"
else
    GRADLE_CMD="gradle"
fi

echo "[2/3] Assembling $BUILD_TYPE APK..."
if [ "$BUILD_TYPE" = "release" ]; then
    $GRADLE_CMD assembleRelease
else
    $GRADLE_CMD assembleDebug
fi

echo "[3/3] Checking output APK..."
OUTPUT_DIR="$ANDROID_DIR/app/build/outputs/apk/$BUILD_TYPE"
if [ -d "$OUTPUT_DIR" ]; then
    find "$OUTPUT_DIR" -name "*.apk" -exec echo "Exported APK: {}" \;
else
    echo "Check APK in: $OUTPUT_DIR"
fi

echo "Done!"
