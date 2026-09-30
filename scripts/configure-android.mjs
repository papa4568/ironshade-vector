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

function upsertAttribute(tag, name, value, indent) {
  const marker = name + '=\"';
  const start = tag.indexOf(marker);
  if (start >= 0) {
    const valueStart = start + marker.length;
    const valueEnd = tag.indexOf('\"', valueStart);
    if (valueEnd < 0) throw new Error('Malformed Android manifest attribute: ' + name);
    return tag.slice(0, start) + name + '=\"' + value + '\"' + tag.slice(valueEnd + 1);
  }
  const attribute = '\n' + indent + name + '=\"' + value + '\"';
  return tag.replace(/>$/, attribute + '>');
}

let manifest = readFileSync(manifestPath, 'utf8');
const applicationPattern = /<application\\b[^>]*>/;
const applicationMatch = manifest.match(applicationPattern);
if (!applicationMatch) throw new Error('Unable to locate Android application manifest tag.');
let applicationTag = applicationMatch[0];
applicationTag = upsertAttribute(applicationTag, 'android:hardwareAccelerated', 'true', '        ');
applicationTag = upsertAttribute(applicationTag, 'android:appCategory', 'game', '        ');
manifest = manifest.replace(applicationPattern, applicationTag);

const activityPattern = /<activity\\b(?=[^>]*android:name=\"\\.MainActivity\")[^>]*>/;
const activityMatch = manifest.match(activityPattern);
if (!activityMatch) throw new Error('Unable to locate generated MainActivity manifest tag.');
let activityTag = activityMatch[0].replace(/\\s+android:screenOrientation=\"[^\"]*\"/g, '');
activityTag = upsertAttribute(activityTag, 'android:resizeableActivity', 'true', '            ');
activityTag = upsertAttribute(activityTag, 'android:keepScreenOn', 'true', '            ');

const configMatch = activityTag.match(/android:configChanges=\"([^\"]*)\"/);
const configChanges = configMatch?.[1]
  ? configMatch[1].split('|').map(value => value.trim()).filter(Boolean)
  : [];
for (const requiredChange of [
  'orientation',
  'keyboardHidden',
  'keyboard',
  'screenSize',
  'smallestScreenSize',
  'screenLayout',
  'density',
]) {
  if (!configChanges.includes(requiredChange)) configChanges.push(requiredChange);
}
activityTag = upsertAttribute(activityTag, 'android:configChanges', configChanges.join('|'), '            ');
manifest = manifest.replace(activityPattern, activityTag);
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

import android.content.pm.ActivityInfo;
import android.content.pm.ApplicationInfo;
import android.content.res.Configuration;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int LARGE_SCREEN_SMALLEST_WIDTH_DP = 600;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureGameOrientation();
        configureGameWebView();
        enterImmersiveMode();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        configureGameOrientation();
        enterImmersiveMode();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterImmersiveMode();
    }

    private void configureGameOrientation() {
        int smallestWidthDp = getResources().getConfiguration().smallestScreenWidthDp;
        int requestedOrientation = smallestWidthDp >= LARGE_SCREEN_SMALLEST_WIDTH_DP
            ? ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            : ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
        if (getRequestedOrientation() != requestedOrientation) {
            setRequestedOrientation(requestedOrientation);
        }
    }

    private void configureGameWebView() {
        WebView webView = getBridge().getWebView();
        boolean debuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        if (debuggable) WebView.setWebContentsDebuggingEnabled(true);
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

console.log(`ANDROID_GAME_SHELL_CONFIGURED phoneLandscape=sensor largeScreen=adaptive-resizable thresholdDp=600 appCategory=game fullscreen=immersive hardwareAcceleration=true releaseSigning=env-backed version=${versionName}(${versionCode})`);
