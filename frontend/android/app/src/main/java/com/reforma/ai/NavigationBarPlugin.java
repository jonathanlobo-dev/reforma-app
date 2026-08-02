package com.reforma.ai;

import android.graphics.Color;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Plugin nativo mínimo: no hay un plugin oficial de Capacitor para la barra
 * de navegación de Android (a diferencia de la de estado, que ya cubre
 * @capacitor/status-bar). Solo expone setStyle(color, light) para que
 * frontend/src/ui/tema.ts pueda hacer que la barra de navegación siga el
 * tema claro/oscuro de la app en tiempo real.
 */
@CapacitorPlugin(name = "NavigationBar")
public class NavigationBarPlugin extends Plugin {

    @PluginMethod
    public void setStyle(PluginCall call) {
        String colorHex = call.getString("color", "#0C0C10");
        boolean light = Boolean.TRUE.equals(call.getBoolean("light", false));

        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            try {
                window.setNavigationBarColor(Color.parseColor(colorHex));
            } catch (IllegalArgumentException ignored) {
                // Color mal formado: se deja el color actual, no rompe la app.
            }
            WindowInsetsControllerCompat controller =
                    WindowCompat.getInsetsController(window, window.getDecorView());
            if (controller != null) {
                controller.setAppearanceLightNavigationBars(light);
            }
        });
        call.resolve();
    }
}
