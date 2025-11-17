import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

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
    <LinearGradient
      colors={['#87CEFA', '#FFFFFF']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>CleanConnect</Text>
            <Text style={styles.tagline}>
              La solution simple pour tous vos besoins de nettoyage en Israël
            </Text>
          </View>

          <View style={styles.optionsContainer}>
            <Text style={styles.optionsTitle}>
              Choisissez comment vous souhaitez utiliser CleanConnect
            </Text>
            
            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleClientRegistration}
            >
              <View style={styles.optionIconContainer}>
                <Ionicons name="home-outline" size={28} color="#3498db" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Je cherche un service</Text>
                <Text style={styles.optionDescription}>
                  Trouvez des professionnels pour nettoyer votre domicile ou bureau
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleProviderRegistration}
            >
              <View style={styles.optionIconContainer}>
                <Ionicons name="briefcase-outline" size={28} color="#3498db" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Je propose des services</Text>
                <Text style={styles.optionDescription}>
                  Rejoignez notre réseau de professionnels du nettoyage
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#999" />
            </TouchableOpacity>
          </View>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Déjà un compte ?</Text>
            <TouchableOpacity onPress={handleLogin}>
              <Text style={styles.loginButton}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3498db',
    marginBottom: 10,
  },
  tagline: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    maxWidth: width * 0.8,
  },
  optionsContainer: {
    marginTop: 40,
  },
  optionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  optionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ecf5fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loginText: {
    fontSize: 16,
    color: '#666',
  },
  loginButton: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default WelcomeScreen;