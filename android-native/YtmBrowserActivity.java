package com.bostrading.ytmanager;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import android.graphics.Typeface;
import androidx.webkit.Profile;
import androidx.webkit.ProfileStore;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

public class YtmBrowserActivity extends Activity {
    private WebView webView;
    private EditText address;
    private ProgressBar progress;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String rawProfileId = getIntent().getStringExtra("profileId");
        String accountName = getIntent().getStringExtra("accountName");
        if (rawProfileId == null || rawProfileId.trim().isEmpty()) {
            Toast.makeText(this, "Profil akun tidak ditemukan. Browser tidak dibuka.", Toast.LENGTH_LONG).show();
            finish();
            return;
        }
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)) {
            Toast.makeText(this, "WebView perangkat belum mendukung sesi multi-akun. Perbarui Android System WebView melalui Play Store.", Toast.LENGTH_LONG).show();
            finish();
            return;
        }
        getWindow().setStatusBarColor(Color.rgb(18, 24, 38));
        getWindow().setNavigationBarColor(Color.BLACK);
        buildBrowser(rawProfileId, accountName == null ? "Akun YouTube" : accountName);
        String initialUrl = getIntent().getStringExtra("url");
        if (initialUrl == null || initialUrl.isEmpty()) initialUrl = "https://www.youtube.com";
        loadAddress(initialUrl);
    }

    private void buildBrowser(String rawProfileId, String accountName) {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setPadding(8, 8, 8, 8);
        toolbar.setBackgroundColor(Color.rgb(18, 24, 38));

        Button back = button("‹");
        back.setOnClickListener(v -> { if (webView.canGoBack()) webView.goBack(); else finish(); });
        toolbar.addView(back, new LinearLayout.LayoutParams(dp(42), dp(44)));

        address = new EditText(this);
        address.setSingleLine(true);
        address.setTextColor(Color.WHITE);
        address.setHintTextColor(Color.LTGRAY);
        address.setHint("https://www.youtube.com");
        address.setTextSize(13);
        address.setPadding(dp(8), 0, dp(8), 0);
        address.setSelectAllOnFocus(true);
        address.setImeOptions(EditorInfo.IME_ACTION_GO);
        address.setInputType(android.text.InputType.TYPE_TEXT_VARIATION_URI);
        address.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_GO || actionId == EditorInfo.IME_ACTION_DONE) {
                loadAddress(address.getText().toString());
                return true;
            }
            return false;
        });
        toolbar.addView(address, new LinearLayout.LayoutParams(0, dp(44), 1));

        Button reload = button("↻");
        reload.setOnClickListener(v -> webView.reload());
        toolbar.addView(reload, new LinearLayout.LayoutParams(dp(42), dp(44)));

        Button close = button("×");
        close.setOnClickListener(v -> finish());
        toolbar.addView(close, new LinearLayout.LayoutParams(dp(42), dp(44)));

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setVisibility(View.GONE);
        root.addView(toolbar);
        root.addView(profileLabel);
        root.addView(progress, new LinearLayout.LayoutParams(-1, dp(3)));

        webView = new WebView(this);
        String profileName = "account_" + rawProfileId.replaceAll("[^A-Za-z0-9_-]", "_");
        Profile profile = ProfileStore.getInstance().getOrCreateProfile(profileName);
        WebViewCompat.setProfile(webView, profileName);
        Profile appliedProfile = WebViewCompat.getProfile(webView);
        if (appliedProfile == null || !profileName.equals(appliedProfile.getName())) {
            Toast.makeText(this, "Profil browser gagal dipisahkan untuk " + accountName, Toast.LENGTH_LONG).show();
            webView.destroy();
            finish();
            return;
        }

        TextView profileLabel = new TextView(this);
        profileLabel.setText("PROFIL AKTIF  •  " + accountName);
        profileLabel.setTextColor(Color.rgb(232, 198, 110));
        profileLabel.setTextSize(11);
        profileLabel.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        profileLabel.setPadding(dp(14), dp(5), dp(14), dp(5));
        profileLabel.setBackgroundColor(Color.rgb(28, 25, 19));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        profile.getCookieManager().setAcceptCookie(true);
        profile.getCookieManager().setAcceptThirdPartyCookies(webView, true);
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int newProgress) {
                progress.setProgress(newProgress);
                progress.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                address.setText(url);
                progress.setVisibility(View.VISIBLE);
            }
            @Override public void onPageFinished(WebView view, String url) {
                address.setText(url);
                profile.getCookieManager().flush();
            }
        });
        root.addView(webView, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
    }

    private Button button(String label) {
        Button b = new Button(this);
        b.setText(label);
        b.setTextColor(Color.WHITE);
        b.setTextSize(20);
        b.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        b.setPadding(0, 0, 0, 0);
        b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(35, 45, 65)));
        return b;
    }

    private void loadAddress(String raw) {
        if (raw == null) return;
        String value = raw.trim();
        if (!value.startsWith("https://")) value = "https://" + value.replaceFirst("^http://", "");
        if (!android.util.Patterns.WEB_URL.matcher(value).matches()) {
            Toast.makeText(this, "Alamat URL tidak valid.", Toast.LENGTH_SHORT).show();
            return;
        }
        address.setText(value);
        webView.loadUrl(value);
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
