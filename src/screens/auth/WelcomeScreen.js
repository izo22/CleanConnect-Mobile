import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

const WelcomeScreen = () => {
  const navigation = useNavigation();

  const handleClientRegistration = () => {
    navigation.navigate('ClientRegistration');
  };

  const handleProviderRegistration = () => {
    navigation.navigate('ProviderRegistration');
  };

  const handleLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#D6EAF8', '#E8F4F8', '#EBF5FB']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="dark-content" />
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Logo Section */}
            <View style={styles.logoSection}>
              <Text style={styles.logoText}>
                <Text style={styles.logoClean}>Clean</Text>
                <Text style={styles.logoCo}>Co</Text>
              </Text>
              <Text style={styles.tagline}>
                הפתרון הפשוט לכל צרכי הניקיון שלך
              </Text>
            </View>

            {/* Options Section */}
            <View style={styles.optionsSection}>
              <Text style={styles.sectionTitle}>
                איך נוכל לעזור לך?
              </Text>
              
              {/* Card Client */}
              <TouchableOpacity
                style={styles.optionCard}
                onPress={handleClientRegistration}
                activeOpacity={0.8}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="home" size={32} color="#2E86C1" />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>אני מחפש שירות</Text>
                  <Text style={styles.cardDescription}>
                    מצא מנקים מקצועיים באזור שלך
                  </Text>
                </View>
                <View style={styles.arrowBubble}>
                  <Ionicons name="chevron-back" size={22} color="#2E86C1" />
                </View>
              </TouchableOpacity>

              {/* Card Provider */}
              <TouchableOpacity
                style={styles.optionCard}
                onPress={handleProviderRegistration}
                activeOpacity={0.8}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="briefcase" size={32} color="#2E86C1" />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>אני מציע שירותים</Text>
                  <Text style={styles.cardDescription}>
                    הצטרף למקצוענים שלנו והתחל לעבוד
                  </Text>
                </View>
                <View style={styles.arrowBubble}>
                  <Ionicons name="chevron-back" size={22} color="#2E86C1" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Login Section */}
            <View style={styles.loginSection}>
              <Text style={styles.loginText}>כבר יש לך חשבון?</Text>
              <TouchableOpacity 
                style={styles.loginButton}
                onPress={handleLogin}
                activeOpacity={0.7}
              >
                <Text style={styles.loginButtonText}>התחבר</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  
  // Logo Section
  logoSection: {
    alignItems: 'center',
    marginTop: 80,
    marginBottom: 60,
  },
  logoText: {
    fontSize: 50,
    marginBottom: 12,
  },
  logoClean: {
    fontWeight: '700',
    color: '#2E86C1',
    fontStyle: 'italic',
  },
  logoCo: {
    fontWeight: '300',
    color: '#F8F9FA',
    textShadowColor: '#2E86C1',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '400',
    color: '#4B5563',
    textAlign: 'center',
    maxWidth: '85%',
    lineHeight: 24,
  },
  
  // Options Section
  optionsSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 28,
    textAlign: 'center',
  },
  optionCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 18,
    shadowColor: '#2E86C1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E8F4F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  cardContent: {
    flex: 1,
    marginRight: 16,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
    textAlign: 'right',
  },
  cardDescription: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'right',
    lineHeight: 20,
  },
  arrowBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Login Section
  loginSection: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  loginText: {
    fontSize: 15,
    fontWeight: '400',
    color: '#6B7280',
    marginLeft: 8,
  },
  loginButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  loginButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2E86C1',
  },
});

export default WelcomeScreen;