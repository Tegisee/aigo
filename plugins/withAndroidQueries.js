const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAndroidQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // <queries> 섹션 추가 (Android 11+ 패키지 가시성)
    if (!manifest.queries) {
      manifest.queries = [];
    }

    // coupang scheme 쿼리 제거 (BUG-12: WebView에서 앱 선택기 유발)
    // https scheme만 유지 — 쿠팡 앱 설치 여부 확인용
    manifest.queries.push({
      package: [
        { $: { 'android:name': 'com.coupang.mobile' } },
      ],
      intent: [
        {
          action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
          data: [{ $: { 'android:scheme': 'https' } }],
        },
      ],
    });

    return config;
  });
};
