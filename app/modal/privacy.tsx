import { useEffect } from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';

const PRIVACY_URL = 'https://dafamstore.tistory.com/11';

export default function PrivacyScreen() {
  const router = useRouter();

  useEffect(() => {
    Linking.openURL(PRIVACY_URL);
    router.back();
  }, []);

  return null;
}
