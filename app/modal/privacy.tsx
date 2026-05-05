import { useEffect } from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';

const PRIVACY_URL = 'https://tegisee.github.io/aigo/privacy-policy/';

export default function PrivacyScreen() {
  const router = useRouter();

  useEffect(() => {
    Linking.openURL(PRIVACY_URL);
    router.back();
  }, []);

  return null;
}
