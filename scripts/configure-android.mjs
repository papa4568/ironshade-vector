import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifestPath = resolve('android/app/src/main/AndroidManifest.xml');
const activityPath = resolve('android/app/src/main/java/app/ironshade/vector/MainActivity.java');

if (!existsSync(manifestPath) || !existsSync(activityPath)) {
  throw new Error('Android platform has not been generated. Run npx cap add android first.');
}

let manifest = readFileSync(manifestPath, 'utf8');
if (!manifest.includes('android:screenOrientation="sensorLandscape"')) {
  manifest = manifest.replace(
    'android:exported="true">',
    'android:exported="true"\n            android:screenOrientation="sensorLandscape"\n            android:keepScreenOn="true">',
  );
}
writeFileSync(manifestPath, manifest);

writeFileSync(activityPath, `package app.ironshade.vector;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        enterImmersiveMode();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterImmersiveMode();
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

console.log('ANDROID_GAME_SHELL_CONFIGURED landscape=sensor fullscreen=immersive');
