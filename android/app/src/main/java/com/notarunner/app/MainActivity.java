package com.notarunner.app;

import android.os.Bundle;
import android.view.View;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own native helpers (registered before the bridge starts).
        registerPlugin(InstallHelpPlugin.class);
        registerPlugin(WorkoutNoticePlugin.class);
        super.onCreate(savedInstanceState);
        // No Android stretch when scrolling past the top or bottom.
        if (getBridge() != null) getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
    }
}
