import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import Svg, { Rect, Circle } from 'react-native-svg';
import { ApiService } from '@/services/api';

const ParityLogo = ({ animatedValue }: { animatedValue: Animated.Value }) => {
  const rotation = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate: rotation }] }}>
      <Svg width="120" height="120" viewBox="0 0 100 100" fill="none">
        {/* Top Dark Blue Block */}
        <Rect x="20" y="25" width="60" fill="#19213D" height="20" />
        {/* Center Intersecting Line */}
        <Rect x="10" y="50" width="80" fill="#19213D" height="6" />
        {/* Bottom Dark Blue Block */}
        <Rect x="20" y="61" width="60" fill="#19213D" height="20" />
        {/* Parity Green Dot overlay accent */}
        <Circle cx="72" cy="18" r="4.5" fill="#7DB282" />
      </Svg>
    </Animated.View>
  );
};

export default function Index() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const [isReady, setIsReady] = useState(false);
  const spinValue = useRef(new Animated.Value(0)).current;

  // Endless rotation animation for the logo
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 3000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    ).start();
  }, []);

  useEffect(() => {
    if (rootNavigationState?.key) setIsReady(true);
  }, [rootNavigationState?.key]);

  useEffect(() => {
    if (!isReady) return;

    const checkAuth = async () => {
      const token = ApiService.getToken();
      if (token) {
        try {
          await ApiService.getProfile();
          router.replace('/(tabs)');
        } catch (error) {
          router.replace('/(auth)/login');
        }
      } else {
        // Force the new user to enter the Onboarding flow instead of instant login
        router.replace('/(auth)/register');
      }
    };

    setTimeout(() => checkAuth(), 800); // 800ms artificial delay to show off the logo
  }, [isReady]);

  return (
    <View style={styles.container}>
      <ParityLogo animatedValue={spinValue} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
