export default {
  expo: {
    name: "아이고",
    slug: "aigo",
    version: "1.0.4",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    scheme: "aigo",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#FFF8F0",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.aigo.app",
      googleServicesFile: "./GoogleService-Info.plist",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        LSApplicationQueriesSchemes: ["coupang", "itms-appss"],
      },
      entitlements: {
        "com.apple.security.application-groups": [
          "group.com.aigo.app",
        ],
      },
    },
    android: {
      versionCode: 52,
      package: "com.aigo.app",
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
      adaptiveIcon: {
        backgroundColor: "#FFF8F0",
        foregroundImage: "./assets/icon.png",
      },
      allowBackup: false,
      predictiveBackGestureEnabled: false,
      // intentFilters에서 coupang scheme 제거 (BUG-12)
      // 아이고 앱이 coupang:// intent 수신 대상이 되면 WebView에서 앱 선택기 발생
      // 공유 수신은 expo-share-intent (SEND action)이 처리하므로 VIEW intent 불필요
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-notifications",
        {
          sounds: [],
        },
      ],
      [
        "expo-share-intent",
        {
          iosShareExtensionName: "AigoShareExtension",
          iosActivationRules: {
            NSExtensionActivationSupportsText: true,
            NSExtensionActivationSupportsWebURLWithMaxCount: 1,
          },
        },
      ],
      "@react-native-google-signin/google-signin",
    ],
    extra: {
      router: {},
      eas: {
        projectId: "caf70306-f2c6-40d7-8e12-817fa67b6477",
      },
    },
    owner: "june56189906",
  },
};
