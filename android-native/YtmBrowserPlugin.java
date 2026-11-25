package com.bostrading.ytmanager;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "YtmBrowser")
public class YtmBrowserPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        String rawUrl = call.getString("url");
        String profileId = call.getString("profileId");
        String accountName = call.getString("accountName", "Akun YouTube");
        if (rawUrl == null || rawUrl.trim().isEmpty()) {
            call.reject("URL tidak boleh kosong.");
            return;
        }
        if (profileId == null || profileId.trim().isEmpty()) {
            call.reject("Pilih akun terlebih dahulu agar sesi browser dapat dipisahkan.");
            return;
        }
        Uri uri = Uri.parse(rawUrl.trim());
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
            call.reject("Browser hanya menerima URL HTTPS yang valid.");
            return;
        }
        Intent intent = new Intent(getActivity(), YtmBrowserActivity.class);
        intent.putExtra("url", uri.toString());
        intent.putExtra("profileId", profileId.trim());
        intent.putExtra("accountName", accountName);
        getActivity().runOnUiThread(() -> {
            getActivity().startActivity(intent);
            call.resolve();
        });
    }
}
