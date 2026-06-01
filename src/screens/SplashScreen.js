import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function CustomSplash({ onFinish }) {
  useEffect(() => {
    const prepare = async () => {
      await SplashScreen.hideAsync();
      setTimeout(() => onFinish(), 1800);
    };
    prepare();
  }, []);

  return (
    <View style={styles.container}>
      
      <View style={styles.logoContainer}>
        <Image source={require('../assets/icon.png')} style={styles.logo} />
      </View>

      <Text style={styles.title}>CleanCo</Text>

      <Text style={styles.subtitle}>
        ניקוי מהיר • ביצועים • אבטחה
      </Text>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2D8FEF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 20,
    borderRadius: 30,
    marginBottom: 30,
  },

  logo: {
    width: 90,
    height: 90,
  },

  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 3,
  },

  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 10,
    letterSpacing: 1,
  },
});