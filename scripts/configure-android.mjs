import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifestPath = resolve('android/app/src/main/AndroidManifest.xml');
const activityPath = resolve('android/app/src/main/java/app/ironshade/vector/MainActivity.java');
const appGradlePath = resolve('android/app/build.gradle');

for (const requiredPath of [manifestPath, activityPath, appGradlePath]) {
  if (!existsSync(requiredPath)) {
    throw new Error('Android platform has not been generated. Run npx cap add android first.');
  }
}

let manifest = readFileSync(manifestPath, 'utf8');
if (!manifest.includes('android:hardwareAccelerated=')) {
  manifest = manifest.replace('<application', '<application\n        android:hardwareAccelerated="true"');
} else {
  manifest = manifest.replace(/android:hardwareAccelerated="[^"]*"/, 'android:hardwareAccelerated="true"');
}
if (!manifest.includes('android:screenOrientation="sensorLandscape"')) {
  manifest = manifest.replace(
    'android:exported="true">',
    'android:exported="true"\n            android:screenOrientation="sensorLandscape"\n            android:keepScreenOn="true">',
  );
}
writeFileSync(manifestPath, manifest);

let appGradle = readFileSync(appGradlePath, 'utf8');
const versionCodeRaw = process.env.ANDROID_VERSION_CODE ?? '1';
const versionCode = Number.parseInt(versionCodeRaw, 10);
if (!Number.isInteger(versionCode) || versionCode < 1 || versionCode > 2_100_000_000) {
  throw new Error(`Invalid ANDROID_VERSION_CODE: ${versionCodeRaw}`);
}
const versionName = (process.env.ANDROID_VERSION_NAME ?? '1.0').trim();
if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/.test(versionName)) {
  throw new Error(`Invalid ANDROID_VERSION_NAME: ${versionName}`);
}
if (!/versionCode\s+\d+/.test(appGradle) || !/versionName\s+["'][^"']+["']/.test(appGradle)) {
  throw new Error('Unable to locate Android versionCode/versionName fields.');
}
appGradle = appGradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
appGradle = appGradle.replace(/versionName\s+["'][^"']+["']/, `versionName "${versionName}"`);

const signingMarker = '// IRONSHADE_RELEASE_SIGNING';
if (!appGradle.includes(signingMarker)) {
  const buildTypesMatch = appGradle.match(/\n(\s*)buildTypes\s*\{/);
  if (!buildTypesMatch || buildTypesMatch.index === undefined) {
    throw new Error('Unable to locate Android buildTypes block for release-signing configuration.');
  }

  const indent = buildTypesMatch[1];
  const signingBlock = `\n${indent}${signingMarker}\n${indent}signingConfigs {\n${indent}    release {\n${indent}        def signingStore = System.getenv("ANDROID_SIGNING_STORE_FILE")\n${indent}        if (signingStore) {\n${indent}            storeFile file(signingStore)\n${indent}            storePassword System.getenv("ANDROID_SIGNING_STORE_PASSWORD")\n${indent}            keyAlias System.getenv("ANDROID_SIGNING_KEY_ALIAS")\n${indent}            keyPassword System.getenv("ANDROID_SIGNING_KEY_PASSWORD")\n${indent}        }\n${indent}    }\n${indent}}\n`;
  appGradle = appGradle.slice(0, buildTypesMatch.index) + signingBlock + appGradle.slice(buildTypesMatch.index);

  const buildTypesIndex = appGradle.indexOf('buildTypes');
  const releaseNeedle = 'release {';
  const releaseIndex = appGradle.indexOf(releaseNeedle, buildTypesIndex);
  if (releaseIndex === -1) {
    throw new Error('Unable to locate Android release build type for signing configuration.');
  }
  const releaseInsert = releaseIndex + releaseNeedle.length;
  const signingAssignment = `\n${indent}        if (System.getenv("ANDROID_SIGNING_STORE_FILE")) {\n${indent}            signingConfig signingConfigs.release\n${indent}        }`;
  appGradle = appGradle.slice(0, releaseInsert) + signingAssignment + appGradle.slice(releaseInsert);
}
writeFileSync(appGradlePath, appGradle);

writeFileSync(activityPath, `package app.ironshade.vector;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureGameWebView();
        enterImmersiveMode();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterImmersiveMode();
    }

    private void configureGameWebView() {
        WebView webView = getBridge().getWebView();
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setVerticalScrollBarEnabled(false);
    }

    private void enterImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.hide(WindowInsetsCompat.Type.systemBars());
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }
    }
}
`);

console.log(`ANDROID_GAME_SHELL_CONFIGURED landscape=sensor fullscreen=immersive hardwareAcceleration=true releaseSigning=env-backed version=${versionName}(${versionCode})`);
