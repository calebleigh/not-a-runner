package com.notarunner.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own native helpers (registered before the bridge starts).
        registerPlugin(InstallHelpPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
