package com.notarunner.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Helps install app updates: says whether this app may install APKs, and opens the settings that
 * control it (this app's "Install unknown apps" switch, and Security and privacy, where Samsung
 * puts Auto Blocker; Samsung offers no public way to open Auto Blocker itself).
 */
@CapacitorPlugin(name = "InstallHelp")
public class InstallHelpPlugin extends Plugin {

    @PluginMethod
    public void info(PluginCall call) {
        JSObject r = new JSObject();
        r.put("manufacturer", Build.MANUFACTURER);
        boolean canInstall = Build.VERSION.SDK_INT < Build.VERSION_CODES.O
            || getContext().getPackageManager().canRequestPackageInstalls();
        r.put("canInstall", canInstall);
        call.resolve(r);
    }

    @PluginMethod
    public void openInstallSources(PluginCall call) {
        Intent i;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
        } else {
            i = new Intent(Settings.ACTION_SECURITY_SETTINGS);
        }
        start(i);
        call.resolve();
    }

    @PluginMethod
    public void openSecurity(PluginCall call) {
        start(new Intent(Settings.ACTION_SECURITY_SETTINGS));
        call.resolve();
    }

    private void start(Intent i) {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(i);
        } catch (ActivityNotFoundException e) {
            Intent fallback = new Intent(Settings.ACTION_SETTINGS);
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(fallback);
        }
    }
}
