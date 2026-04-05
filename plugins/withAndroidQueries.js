const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAndroidQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // <queries> 섹션 추가 (Android 11+ 패키지 가시성)
    if (!manifest.queries) {
      manifest.queries = [];
    }

    manifest.queries.push({
      package: [
        { $: { 'android:name': 'com.coupang.mobile' } },
      ],
      intent: [
        {
          action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
          data: [{ $: { 'android:scheme': 'coupang' } }],
        },
        {
          action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
          data: [{ $: { 'android:scheme': 'https' } }],
        },
      ],
    });

    return config;
  });
};
