#!/usr/bin/env bash
set -e

# Directorio base del proyecto
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "========================================="
echo "   VeeMaps - Empaquetador de Release    "
echo "========================================="

# 1. Obtener la versión configurada en build.gradle.kts
VERSION=$(grep -o 'versionName = "[^"]*"' android/app/build.gradle.kts | cut -d'"' -f2)
if [ -z "$VERSION" ]; then
    VERSION="2.0.0"
fi
TAG="v$VERSION"

echo "📌 Versión detectada: $VERSION (Tag: $TAG)"

# 2. Compilar APK Release
echo "🔨 Compilando APK de Android (assembleRelease)..."
cd android
./gradlew assembleRelease
cd "$PROJECT_ROOT"

# 3. Crear carpeta de salida /dist
mkdir -p dist
APK_SOURCE="android/app/build/outputs/apk/release/app-release.apk"
APK_TARGET="dist/veemaps-$TAG.apk"
ZIP_TARGET="dist/veemaps-web-$TAG.zip"

if [ -f "$APK_SOURCE" ]; then
    cp "$APK_SOURCE" "$APK_TARGET"
    echo "✅ APK empaquetado y firmado: $APK_TARGET ($(du -h "$APK_TARGET" | cut -f1))"
else
    echo "⚠️ No se encontró el APK en $APK_SOURCE"
    exit 1
fi

# 4. Empaquetar versión Web / PWA en .zip
echo "📦 Empaquetando versión Web / PWA..."
rm -f "$ZIP_TARGET"
zip -r "$ZIP_TARGET" index.html manifest.json sw.js css js vendor > /dev/null
echo "✅ Versión Web comprimida: $ZIP_TARGET ($(du -h "$ZIP_TARGET" | cut -f1))"

echo ""
echo "========================================="
echo "   ¡Paquetes listos en la carpeta /dist! "
echo "========================================="
ls -lh dist/

echo ""
echo "🚀 Para publicar en GitHub Releases:"
echo ""
echo "Opción 1: Con GitHub CLI (gh):"
echo "  1) Inicia sesión si no lo has hecho:  gh auth login"
echo "  2) Publica el release con los archivos:"
echo "     gh release create $TAG dist/veemaps-$TAG.apk dist/veemaps-web-$TAG.zip --title \"VeeMaps $TAG\" --notes \"Novedades de la versión $VERSION\""
echo ""
echo "Opción 2: Automático con Git Tag (GitHub Actions):"
echo "  git tag $TAG"
echo "  git push origin $TAG"
echo "========================================="
