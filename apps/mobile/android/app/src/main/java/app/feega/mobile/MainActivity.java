package app.feega.mobile;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String SCHEME = "feega";
    private static final String AUTH_HOST = "auth";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        follow(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        follow(intent);
    }

    private void follow(Intent intent) {
        Uri link = intent == null ? null : intent.getData();
        if (link == null || !SCHEME.equals(link.getScheme()) || !AUTH_HOST.equals(link.getHost())) {
            return;
        }
        Uri web = Uri.parse(getBridge().getAppUrl());
        Uri target = web.buildUpon().encodedPath("/auth" + link.getEncodedPath()).encodedQuery(link.getEncodedQuery()).build();
        getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(target.toString()));
    }
}
