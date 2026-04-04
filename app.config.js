export default {
  expo: {
    name: "아이고",
    slug: "aigo",
    version: "1.0.0",
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
      package: "com.aigo.app",
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
      adaptiveIcon: {
        backgroundColor: "#FFF8F0",
        foregroundImage: "./assets/icon.png",
      },
      predictiveBackGestureEnabled: false,
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
