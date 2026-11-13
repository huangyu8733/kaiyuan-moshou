package me.hhkj.warcraft;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * The game is a page: this activity is a window onto it, exactly as the desktop launcher is a
 * window onto the same build. Nothing is copied into the APK, so the app weighs a few megabytes and
 * an update is a reload rather than a new release.
 *
 * The page asks to READ the player's Warcraft III folder, which Android's WebView cannot grant
 * (no File System Access API). The browser build falls back to its normal "pick a folder" prompt,
 * which on this platform means the game runs only once a folder can be provided — the shell exists
 * to open the site, not to pretend the phone can host an install.
 */
public class MainActivity extends Activity {
    private static final String PAGE = "https://warcraft.hhkj.me/play/";
    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        setContentView(web);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        // The page is our own build: it keeps its cookies and storage across launches so the
        // install folder and settings survive a restart, and links stay inside the app.
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        WebView.setWebContentsDebuggingEnabled(true);

        // Edge-to-edge, with the cutout and the system bars out of the picture: the game draws its
        // own frame and a stray status bar would sit on top of it.
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);

        if (savedInstanceState == null) web.loadUrl(PAGE);
        else web.restoreState(savedInstanceState);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    /** Back steps through the page's own history, and only leaves the app when there is none. */
    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
