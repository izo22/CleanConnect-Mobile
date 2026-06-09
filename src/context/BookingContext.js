// src/context/BookingContext.js
// ✅ VERSION COMPLÈTE - Logique existante + Intégration Escrow API + MAPPING HÉBREU + DEBUG LOG
// 🔧 FIX: Calcul de prix corrigé pour utiliser le tarif du SERVICE SPÉCIFIQUE au lieu de la moyenne
// 🐛 FIX: Ajout de normalizeServiceType pour mapper anglais → hébreu
// ✅ FIX: BACKEND_API_URL supprimé → utilise API_URL depuis constants.js

import React, { createContext, useState, useContext, useCallback, useMemo, useEffect } from 'react';
import axios from 'axios';
import { API_URL, SERVICE_TYPES, STORAGE_KEYS } from '../config/constants';
import { useAuth } from './AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BookingContext = createContext();

export const BookingProvider = ({ children }) => {
  const { userToken, userInfo } = useAuth();
  
  const [currentBooking, setCurrentBooking] = useState({
    serviceType: null,
    selectedProvider: null,
    address: null,
    dateTime: null,
    duration: 2,
    frequency: 'one_time',
    notes: '',
    price: 0,
  });
  
  const [userBookings, setUserBookings] = useState([]);
  useEffect(() => {
    console.log('🔍 STATE userBookings MIS À JOUR:', userBookings.length, 'bookings');
    console.log('🔍 CONTENU:', userBookings);
  }, [userBookings]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [bookingError, setBookingError] = useState(null);

  // Charger les bookings sauvegardés au démarrage
  useEffect(() => {
    const loadSavedBookings = async () => {
      try {
        const savedBookings = await AsyncStorage.getItem(STORAGE_KEYS.USER_BOOKINGS);
        if (savedBookings) {
          setUserBookings(JSON.parse(savedBookings));
        }
      } catch (error) {
        console.error('Error loading saved bookings:', error);
      }
    };
    
    loadSavedBookings();
  }, []);

 

  // Sauvegarder les bookings automatiquement
  useEffect(() => {
    const saveBookings = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.USER_BOOKINGS, JSON.stringify(userBookings));
      } catch (error) {
        console.error('Error saving bookings:', error);
      }
    };
    
    if (userBookings.length > 0) {
      saveBookings();
    }
  }, [userBookings]);

  // Mettre à jour le booking actuel
  const updateBooking = useCallback((data) => {
    setCurrentBooking(prev => ({ ...prev, ...data }));
  }, []);

  // ✅ Sélectionner un prestataire
  const selectProvider = useCallback((provider) => {
    console.log('🔍 SELECTING PROVIDER:', provider);
    console.log('   - name:', provider.name);
    console.log('   - firstName/lastName:', provider.firstName, provider.lastName);
    console.log('   - serviceDetails:', provider.serviceDetails);
    console.log('   - services:', provider.services);
    console.log('   - price:', provider.price);
    console.log('   - hourlyRate (moyenne):', provider.hourlyRate);
    
    setCurrentBooking(prev => ({
      ...prev,
      selectedProvider: {
        _id: provider._id,
        name: provider.name || `${provider.firstName} ${provider.lastName}`,
        hourlyRate: provider.hourlyRate,
        rating: provider.rating,
        phone: provider.phone,
        serviceDetails: provider.serviceDetails,
        services: provider.services,
        price: provider.price,
      },
    }));
  }, []);

  // Réinitialiser le booking
  const resetBooking = useCallback(() => {
    setCurrentBooking({
      serviceType: null,
      selectedProvider: null,
      address: null,
      dateTime: null,
      duration: 2,
      frequency: 'one_time',
      notes: '',
      price: 0,
    });
  }, []);

  // Charger les prestataires disponibles
  const loadAvailableProviders = useCallback(async (criteria = {}) => {
    try {
      const params = {
        serviceType: criteria.serviceType || currentBooking.serviceType || SERVICE_TYPES.HOME,
        date: criteria.date || (currentBooking.dateTime ? new Date(currentBooking.dateTime).toISOString().split('T')[0] : null),
        location: criteria.location || (currentBooking.address ? currentBooking.address.coordinates : null),
        ...criteria,
      };

      const mockProviders = [
        {
          _id: 'provider-1',
          name: 'CleanPro Services',
          rating: 4.8,
          description: 'Service de nettoyage professionnel pour domiciles',
          services: ['home'],
          price: { home: 85, office: 100 },
          hourlyRate: 85,
          reviewCount: 42,
          availability: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          languages: ['hebrew', 'english', 'french']
        },
        {
          _id: 'provider-2',
          name: 'Office Clean Ltd',
          rating: 4.6,
          description: 'Spécialistes du nettoyage de bureaux et espaces professionnels',
          services: ['office', 'home'],
          price: { office: 90, home: 95 },
          hourlyRate: 90,
          reviewCount: 28,
          availability: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'sunday'],
          languages: ['hebrew', 'english']
        },
        {
          _id: 'provider-3',
          name: 'Building Maintenance Co.',
          rating: 4.9,
          description: 'Entretien complet d\'immeubles et de propriétés',
          services: ['building', 'office'],
          price: { building: 120, office: 110 },
          hourlyRate: 120,
          reviewCount: 36,
          availability: ['monday', 'tuesday', 'wednesday', 'thursday', 'sunday'],
          languages: ['hebrew', 'arabic', 'english']
        }
      ];
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
      return { success: true, providers: mockProviders };
    } catch (error) {
      setBookingError('Impossible de charger les prestataires disponibles');
      return { success: false, message: error.response?.data?.message || 'Erreur de chargement' };
    }
  }, [currentBooking.serviceType, currentBooking.dateTime, currentBooking.address]);

  // 🐛 FIX CRITIQUE: Fonction de normalisation des types de service (anglais → hébreu)
  const normalizeServiceType = useCallback((type) => {
    if (!type) return null;
    
    const mapping = {
      'home': 'בית',
      'office': 'משרד',
      'building': 'בניין',
      'airbnb': 'אירבנב',
      'בית': 'בית',
      'משרד': 'משרד',
      'בניין': 'בניין',
      'אירבנב': 'אירבנב',
    };
    
    const normalized = mapping[type] || type;
    console.log(`🔄 normalizeServiceType: "${type}" → "${normalized}"`);
    return normalized;
  }, []);

  // 🔧 FIX: Calcul de prix
  const calculatePrice = useCallback(async () => {
    if (!currentBooking.serviceType || !currentBooking.duration) {
      console.log('❌ Calcul prix impossible: serviceType ou duration manquant');
      return 0;
    }

    try {
      console.log('💰 === DÉBUT CALCUL PRIX ===');
      console.log('   Service Type (app):', currentBooking.serviceType);
      console.log('   Duration:', currentBooking.duration, 'heures');
      console.log('   Provider:', currentBooking.selectedProvider);
      
      const normalizedSearchType = normalizeServiceType(currentBooking.serviceType);
      console.log('   Service Type (normalized):', normalizedSearchType);
      
      let hourlyRate = 85;
      
      if (currentBooking.selectedProvider) {
        console.log('   🔍 Recherche du tarif spécifique...');
        
        if (currentBooking.selectedProvider.serviceDetails && Array.isArray(currentBooking.selectedProvider.serviceDetails)) {
          console.log('   → Checking serviceDetails:', currentBooking.selectedProvider.serviceDetails);
          
          const serviceDetail = currentBooking.selectedProvider.serviceDetails.find(s => {
            const normalizedServiceType = normalizeServiceType(s.type);
            const match = normalizedServiceType === normalizedSearchType;
            console.log(`      Comparing: "${s.type}" (${normalizedServiceType}) === ${normalizedSearchType} ? ${match}`);
            return match;
          });
          
          if (serviceDetail && serviceDetail.hourlyRate) {
            hourlyRate = serviceDetail.hourlyRate;
            console.log('   ✅ Prix trouvé dans serviceDetails:', hourlyRate, '₪/h pour', normalizedSearchType);
          } else {
            console.log('   ⚠️  Pas trouvé dans serviceDetails');
          }
        }
        else if (currentBooking.selectedProvider.services && Array.isArray(currentBooking.selectedProvider.services)) {
          console.log('   → Checking services array:', currentBooking.selectedProvider.services);
          
          const serviceDetail = currentBooking.selectedProvider.services.find(s => {
            const normalizedServiceType = normalizeServiceType(s.type);
            return normalizedServiceType === normalizedSearchType;
          });
          
          if (serviceDetail && serviceDetail.hourlyRate) {
            hourlyRate = serviceDetail.hourlyRate;
            console.log('   ✅ Prix trouvé dans services:', hourlyRate, '₪/h pour', normalizedSearchType);
          }
        }
        else if (currentBooking.selectedProvider.price) {
          console.log('   → Checking price object:', currentBooking.selectedProvider.price);
          
          if (typeof currentBooking.selectedProvider.price === 'object') {
            hourlyRate = currentBooking.selectedProvider.price[normalizedSearchType] || 
                        currentBooking.selectedProvider.price[currentBooking.serviceType] || 
                        85;
            console.log('   ✅ Prix trouvé dans price object:', hourlyRate, '₪/h pour', normalizedSearchType);
          } else if (typeof currentBooking.selectedProvider.price === 'number') {
            hourlyRate = currentBooking.selectedProvider.price;
            console.log('   ✅ Prix unique trouvé:', hourlyRate, '₪/h');
          }
        }
        else if (currentBooking.selectedProvider.hourlyRate) {
          hourlyRate = currentBooking.selectedProvider.hourlyRate;
          console.warn('   ⚠️  Utilisation du tarif moyen (fallback):', hourlyRate, '₪/h');
        }
      } else {
        console.log('   ⚠️  Pas de fournisseur sélectionné, utilisation du tarif par défaut:', hourlyRate, '₪/h');
      }
      
      let price = hourlyRate * currentBooking.duration;
      console.log('   📊 Prix de base:', price, '₪ (', hourlyRate, '₪/h ×', currentBooking.duration, 'h)');
      
      if (currentBooking.frequency === 'weekly') {
        price = price * 0.9;
        console.log('   💵 Réduction hebdomadaire (10%):', price, '₪');
      } else if (currentBooking.frequency === 'bi_weekly') {
        price = price * 0.95;
        console.log('   💵 Réduction bi-hebdomadaire (5%):', price, '₪');
      } else if (currentBooking.frequency === 'monthly') {
        price = price * 0.97;
        console.log('   💵 Réduction mensuelle (3%):', price, '₪');
      }
      
      price = Math.round(price * 100) / 100;
      
      console.log('   ✅ PRIX FINAL:', price, '₪');
      console.log('💰 === FIN CALCUL PRIX ===\n');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      updateBooking({ price });
      return price;
    } catch (error) {
      console.error('❌ Error calculating price:', error);
      return 0;
    }
  }, [currentBooking.serviceType, currentBooking.duration, currentBooking.frequency, currentBooking.selectedProvider, updateBooking, normalizeServiceType]);

  // Synchroniser booking vers le prestataire (AsyncStorage)
  const syncBookingToProvider = useCallback(async (booking) => {
    try {
      const providerRequestsKey = `provider_requests_${booking.selectedProvider._id}`;
      
      const existingRequests = await AsyncStorage.getItem(providerRequestsKey);
      const requests = existingRequests ? JSON.parse(existingRequests) : [];
      
      const providerRequest = {
        _id: booking._id,
        clientId: userInfo?.id || 'current-user-id',
        clientName: userInfo?.name || userInfo?.firstName || 'Client',
        serviceType: booking.serviceType,
        dateTime: booking.dateTime,
        duration: booking.duration,
        status: booking.status,
        price: booking.price,
        address: booking.address,
        notes: booking.notes,
        date: booking.created,
        payment: booking.payment
      };
      
      requests.unshift(providerRequest);
      
      await AsyncStorage.setItem(providerRequestsKey, JSON.stringify(requests));
      
      console.log('✅ Booking synced to provider:', booking.selectedProvider._id);
    } catch (error) {
      console.error('Error syncing to provider:', error);
    }
  }, [userInfo]);

  // Ajouter un booking à la liste
  const addBooking = useCallback((newBooking) => {
    setUserBookings(prevBookings => {
      const updatedBookings = [newBooking, ...prevBookings];
      return updatedBookings;
    });
    return { success: true, booking: newBooking };
  }, []);

  // ✅ ESCROW - Créer une réservation avec paiement
  const createBooking = useCallback(async (paymentData = {}) => {
    try {
      if (!userToken) {
        setBookingError('Veuillez vous connecter pour réserver un service');
        return { success: false, message: 'Authentification requise' };
      }

      if (!currentBooking.serviceType || !currentBooking.selectedProvider || !currentBooking.dateTime) {
        setBookingError('Veuillez remplir tous les champs obligatoires');
        return { success: false, message: 'Informations incomplètes' };
      }

      console.log('📝 Creating booking with payment...');
      console.log('   Provider:', currentBooking.selectedProvider._id);
      console.log('   DateTime:', currentBooking.dateTime);
      console.log('   Payment:', paymentData);

      const mappedServiceType = normalizeServiceType(currentBooking.serviceType);
      console.log('   ServiceType mapping:', currentBooking.serviceType, '→', mappedServiceType);

      const token = await AsyncStorage.getItem('token');
      
      // ✅ FIX: utilise API_URL depuis constants.js
      const response = await fetch(`${API_URL}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          providerId: currentBooking.selectedProvider._id,
          serviceType: mappedServiceType,
          propertyType: currentBooking.propertyType || 'דירה',
          scheduledDate: currentBooking.dateTime,
          address: currentBooking.address?.fullAddress || currentBooking.address || 'À définir',
          description: currentBooking.notes || '',
          price: currentBooking.price || 0,
          duration: currentBooking.duration || 2,
          paymentIntentId: paymentData.paymentIntentId || null,
          paymentMethod: paymentData.paymentMethod || 'card'
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Échec de création de la réservation');
      }

      console.log('✅ Booking created via API:', data.booking._id);

      const newBooking = {
        _id: data.booking._id,
        serviceType: currentBooking.serviceType,
        dateTime: currentBooking.dateTime,
        duration: currentBooking.duration,
        frequency: currentBooking.frequency,
        price: currentBooking.price,
        status: data.booking.status || 'pending_payment',
        selectedProvider: {
          _id: currentBooking.selectedProvider._id,
          name: currentBooking.selectedProvider.name,
          rating: currentBooking.selectedProvider.rating || 4.8,
          phone: data.booking.provider?.phone || currentBooking.selectedProvider.phone
        },
        address: currentBooking.address || {
          id: '1',
          name: 'Domicile',
          fullAddress: 'Adresse non spécifiée',
        },
        notes: currentBooking.notes,
        created: new Date().toISOString(),
        payment: data.booking.payment || {
          intentId: paymentData.paymentIntentId,
          status: 'held',
          amount: 0
        },
        providerPhoneVisible: data.booking.providerPhoneVisible || false
      };
      
      addBooking(newBooking);
      await syncBookingToProvider(newBooking);
      resetBooking();
      
      return { success: true, booking: newBooking };

    } catch (error) {
      console.error('❌ Error creating booking:', error);
      const message = error.message || 'Erreur lors de la création de la réservation';
      setBookingError(message);
      return { success: false, message };
    }
  }, [currentBooking, userToken, resetBooking, addBooking, syncBookingToProvider, normalizeServiceType]);

  // ✅ ESCROW - Récupérer les bookings de l'utilisateur
  const fetchUserBookings = useCallback(async (forceRefresh = false) => {
    if (!userToken) return [];

    setIsLoadingBookings(true);
    setBookingError(null);
    
    try {
      const token = await AsyncStorage.getItem('token');
      
      // ✅ FIX: utilise API_URL depuis constants.js
      try {
        const response = await fetch(`${API_URL}/bookings`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.success && data.data) {
            console.log('✅ Bookings loaded from API:', data.data.length);
            console.log('🔍 PREMIER BOOKING:', JSON.stringify(data.data[0], null, 2));
            setUserBookings(data.data);
            await AsyncStorage.setItem(STORAGE_KEYS.USER_BOOKINGS, JSON.stringify(data.data));
            setIsLoadingBookings(false);
            return data.data;
          }
        }
      } catch (apiError) {
        console.log('⚠️  API fetch failed, falling back to AsyncStorage');
      }
      
      const savedBookings = await AsyncStorage.getItem(STORAGE_KEYS.USER_BOOKINGS);
      
      if (savedBookings) {
        const bookingsData = JSON.parse(savedBookings);
        console.log('✅ Bookings loaded from AsyncStorage:', bookingsData.length);
        setUserBookings([...bookingsData]);
        setIsLoadingBookings(false);
        return bookingsData;
      } else {
        setUserBookings([]);
        setIsLoadingBookings(false);
        return [];
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setBookingError('Impossible de charger vos réservations');
      setUserBookings([]);
      return [];
    } finally {
      setIsLoadingBookings(false);
    }
  }, [userToken]);

  // Mettre à jour le statut d'un booking
  const updateBookingStatus = useCallback(async (bookingId, status) => {
    try {
      setUserBookings(prev => 
        prev.map(booking => 
          booking._id === bookingId 
            ? { ...booking, status } 
            : booking
        )
      );
      
      const updatedBooking = userBookings.find(booking => booking._id === bookingId);
      await new Promise(resolve => setTimeout(resolve, 600));
      return { success: true, booking: updatedBooking };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Erreur de mise à jour' };
    }
  }, [userBookings]);

  // ✅ ESCROW - Annuler un booking
  const cancelBooking = useCallback(async (bookingId) => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      // ✅ FIX: utilise API_URL depuis constants.js
      try {
        const response = await fetch(`${API_URL}/bookings/${bookingId}/cancel`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.success) {
            console.log('✅ Booking cancelled via API');
            setUserBookings(prev => 
              prev.map(booking => 
                booking._id === bookingId 
                  ? { ...booking, status: 'cancelled' } 
                  : booking
              )
            );
            return { success: true };
          }
        }
      } catch (apiError) {
        console.log('⚠️  API cancel failed, updating locally');
      }
      
      setUserBookings(prev => 
        prev.map(booking => 
          booking._id === bookingId 
            ? { ...booking, status: 'cancelled' } 
            : booking
        )
      );
      
      await new Promise(resolve => setTimeout(resolve, 600));
      return { success: true };
    } catch (error) {
      console.error('Error canceling booking:', error);
      return { success: false, message: error.message || 'Erreur lors de l\'annulation' };
    }
  }, []);

  // Supprimer tous les bookings
  const clearAllBookings = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_BOOKINGS);
      setUserBookings([]);
      return { success: true };
    } catch (error) {
      return { success: false, message: 'Erreur lors de la suppression des réservations' };
    }
  }, []);

  const contextValue = useMemo(() => ({
    currentBooking,
    updateBooking,
    selectProvider,
    resetBooking,
    loadAvailableProviders,
    calculatePrice,
    createBooking,
    fetchUserBookings,
    updateBookingStatus,
    cancelBooking,
    userBookings,
    isLoadingBookings,
    bookingError,
    addBooking,
    clearAllBookings,
    syncBookingToProvider,
  }), [
    currentBooking,
    updateBooking,
    selectProvider,
    resetBooking,
    loadAvailableProviders,
    calculatePrice,
    createBooking,
    fetchUserBookings,
    updateBookingStatus,
    cancelBooking,
    userBookings,
    isLoadingBookings,
    bookingError,
    addBooking,
    clearAllBookings,
    syncBookingToProvider,
  ]);

  return (
    <BookingContext.Provider value={contextValue}>
      {children}
    </BookingContext.Provider>
  );
};

export const useBooking = () => {
  const context = useContext(BookingContext);
  
  if (context === undefined) {
    throw new Error('useBooking doit être utilisé dans un BookingProvider');
  }
  
  return context;
};