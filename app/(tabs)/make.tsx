import React, { useState, useEffect, useRef } from 'react';
import {
    Alert,
    Platform,
    View,
    StyleSheet,
    Modal,
    Text,
    TouchableOpacity,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import our modular components
import ZKGen, {
    PhotoMetadata,
    PrivacySettings,
    ZKCapsule,
    generateSimpleHash
} from '../../components/make/ZKGen';
import PrivacySettingsScreen from '../../components/make/PrivacySettings';

export default function ZKPhotoVerifierScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ mediaType?: string }>();
    const mediaType = (params.mediaType === 'video') ? 'video' : 'photo'; // Ensure valid value
    const [metadata, setMetadata] = useState<PhotoMetadata | null>(null);
    const [showDateTimePicker, setShowDateTimePicker] = useState(false);
    const [tempDate, setTempDate] = useState(new Date());
    const [privacyApproach, setPrivacyApproach] = useState<'essential' | 'advanced'>('essential');
    const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
        timeProof: {
            enabled: false,
            level: 'month',
        },
        locationProof: {
            enabled: false,
            level: 'country',
        },
        deviceProof: {
            enabled: false,
            level: 'devicetype',
        },
        identityProof: {
            enabled: false,
        },
        imageReveal: {
            enabled: false,
            level: 'none',
        },
        timeLock: {
            enabled: false,
            unlockTime: null,
            lockedData: '',
            lockType: 'date',
        },
        receiverLock: {
            enabled: false,
            walletAddress: '',
            encryptedContent: '',
        },
        saveForFuture: {
            enabled: false,
        },
        storageOptions: {
            type: 'walrus',
            walrusBlobId: undefined,
            ipfsCid: undefined,
            ipfsUrl: undefined,
        },
    });
    const [currentStep, setCurrentStep] = useState<'loading' | 'processing' | 'settings' | 'proof'>('loading');
    // Add a ref to track if camera has been launched
    const cameraLaunchedRef = useRef(false);

    // Check if permissions are granted when component mounts
    useEffect(() => {
        checkPermissionsAndProceed();
    }, []);

    // Check permissions and proceed with camera if granted
    const checkPermissionsAndProceed = async () => {
        try {
            // Don't proceed if we already have metadata (user is in settings or proof step)
            if (metadata) {
                console.log('Metadata already exists, skipping camera launch');
                return;
            }

            console.log(`Checking permissions for media type: ${mediaType}`);
            const permissionsRequested = await AsyncStorage.getItem('@permissions_requested');
            
            if (permissionsRequested === 'true') {
                // Permissions have been requested during onboarding
                // Check if we have camera permission
                const cameraStatus = await ImagePicker.getCameraPermissionsAsync();
                
                if (cameraStatus.status === 'granted') {
                    // Camera permission is granted, proceed with taking media
                    console.log(`Permissions granted, capturing media of type: ${mediaType}`);
                    cameraLaunchedRef.current = true; // Mark camera as launched
                    captureMedia();
                } else {
                    // Camera permission is not granted, show alert
                    Alert.alert(
                        'Camera Permission Required',
                        'This app needs camera access to capture media for verification. Please grant camera permission in your device settings.',
                        [{ text: 'OK' }]
                    );
                }
            } else {
                // Permissions have not been requested yet, show alert
                Alert.alert(
                    'Permissions Required',
                    'This app needs camera and location access to verify media. Please grant permissions when prompted.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.error('Error checking permissions:', error);
        }
    };

    // Capture media based on the mediaType parameter
    const captureMedia = async () => {
        try {
            // Don't capture if we already have metadata
            if (metadata) {
                console.log('Metadata already exists, skipping media capture');
                return;
            }

            console.log(`Starting media capture for type: ${mediaType}`);
            if (mediaType === 'photo') {
                console.log('Taking picture...');
                await takePicture();
            } else if (mediaType === 'video') {
                console.log('Recording video...');
                await recordVideo();
            } else {
                console.log(`Unknown media type: ${mediaType}, defaulting to photo`);
                await takePicture();
            }
        } catch (error) {
            console.error(`Error capturing ${mediaType}:`, error);
            Alert.alert('Error', `Failed to capture ${mediaType}. Please try again.`);
        }
    };

    // Take picture function
    const takePicture = async () => {
        try {
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                // Set to processing state while handling the photo
                setCurrentStep('processing');
                const asset = result.assets[0];
                await processPhoto(asset);
            } else {
                // If user canceled, go back instead of restarting camera
                router.back();
            }
        } catch (error) {
            console.error('Error taking picture:', error);
            Alert.alert('Error', 'Failed to take picture. Please try again.');
            router.back();
        }
    };

    // Record video function
    const recordVideo = async () => {
        try {
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsEditing: false,
                quality: 0.8,
                videoMaxDuration: 60, // 60 seconds max duration
            });

            if (!result.canceled && result.assets[0]) {
                // Set to processing state while handling the video
                setCurrentStep('processing');
                const asset = result.assets[0];
                await processVideo(asset);
            } else {
                // If user canceled, go back instead of restarting camera
                router.back();
            }
        } catch (error) {
            console.error('Error recording video:', error);
            Alert.alert('Error', 'Failed to record video. Please try again.');
            router.back();
        }
    };

    // Process video (similar to processPhoto but for videos)
    const processVideo = async (asset: ImagePicker.ImagePickerAsset) => {
        try {
            const currentTime = Date.now();
            let locationData = undefined;

            // Get location data (same as in processPhoto)
            try {
                // Reuse the location detection code from processPhoto
                let retryCount = 0;
                const maxRetries = 3;
                
                while (retryCount < maxRetries && !locationData) {
                    try {
                        console.log(`Getting location... (attempt ${retryCount + 1}/${maxRetries})`);
                        
                        // Try with high accuracy first
                        let location;
                        try {
                            location = await Location.getCurrentPositionAsync({
                                accuracy: Location.Accuracy.High,
                            });
                        } catch (highAccuracyError) {
                            console.log('High accuracy failed, trying balanced accuracy:', highAccuracyError);
                            // Fallback to balanced accuracy
                            location = await Location.getCurrentPositionAsync({
                                accuracy: Location.Accuracy.Balanced,
                            });
                        }
                        
                        console.log('Location obtained:', location.coords);
                        
                        // Get reverse geocoding data to determine location details
                        let city = "Unknown City";
                        let country = "Unknown Country";
                        let continent = "Unknown Continent";
                        
                        try {
                            console.log('Starting reverse geocoding...');
                            // Try to get location details from reverse geocoding
                            const reverseGeocode = await Location.reverseGeocodeAsync({
                                latitude: location.coords.latitude,
                                longitude: location.coords.longitude
                            });
                            
                            console.log('Reverse geocode result:', reverseGeocode);
                            
                            if (reverseGeocode && reverseGeocode.length > 0) {
                                const locationInfo = reverseGeocode[0];
                                
                                // Use city or district or subregion, whatever is available
                                city = locationInfo.city || locationInfo.district || 
                                       locationInfo.subregion || locationInfo.region || "Unknown City";
                                       
                                // Use country or region
                                country = locationInfo.country || locationInfo.region || "Unknown Country";
                                
                                // Determine continent based on country code
                                const countryCode = locationInfo.isoCountryCode;
                                if (countryCode) {
                                    // Simple mapping of country codes to continents
                                    if (['US', 'CA', 'MX'].includes(countryCode)) {
                                        continent = "North America";
                                    } else if (['BR', 'AR', 'CO', 'PE', 'CL'].includes(countryCode)) {
                                        continent = "South America";
                                    } else if (['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'GR'].includes(countryCode)) {
                                        continent = "Europe";
                                    } else if (['CN', 'JP', 'KR', 'IN', 'RU', 'ID', 'PK', 'TH', 'MY', 'SG'].includes(countryCode)) {
                                        continent = "Asia";
                                    } else if (['AU', 'NZ'].includes(countryCode)) {
                                        continent = "Australia/Oceania";
                                    } else if (['ZA', 'NG', 'EG', 'MA', 'KE', 'ET', 'GH', 'TZ'].includes(countryCode)) {
                                        continent = "Africa";
                                    } else {
                                        continent = "Unknown Continent";
                                    }
                                }
                            }
                        } catch (geocodeError) {
                            console.log('Reverse geocoding failed:', geocodeError);
                            // Fallback location code can be kept as is
                        }
                        
                        locationData = {
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                            city: city,
                            country: country,
                            continent: continent
                        };
                        
                        console.log('Final location data:', locationData);
                        break; // Success, exit retry loop
                        
                    } catch (error) {
                        retryCount++;
                        console.log(`Location attempt ${retryCount} failed:`, error);
                        
                        if (retryCount < maxRetries) {
                            console.log(`Retrying location detection in 2 seconds...`);
                            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
                        } else {
                            console.log('All location attempts failed');
                            Alert.alert(
                                'Location Error', 
                                'Could not get current location after multiple attempts. Please ensure location services are enabled and try again.',
                                [{ text: 'OK' }]
                            );
                        }
                    }
                }
            } catch (error) {
                console.log('Location permission not granted or error:', error);
            }

            // Generate video hash based on URI and timestamp
            const videoHash = generateSimpleHash(asset.uri + currentTime);

            const videoMetadata: PhotoMetadata = {
                timestamp: currentTime,
                location: locationData,
                deviceInfo: Platform.OS === 'ios' ? 'iOS Camera' : 'Android Camera',
                photoHash: videoHash,
                photoUri: asset.uri,
                isVideo: true, // Add this flag to indicate it's a video
                duration: asset.duration || 0, // Video duration in seconds
            };

            setMetadata(videoMetadata);
            setCurrentStep('settings'); // Change from loading to settings step
        } catch (error) {
            console.error('Error processing video:', error);
            Alert.alert('Error', 'Failed to process video metadata.');
        }
    };

    // Process the captured photo
    const processPhoto = async (asset: ImagePicker.ImagePickerAsset) => {
        try {
            const currentTime = Date.now();
            let locationData = undefined;

            // Get location if permission is granted - Improved location detection with retry
            try {
                let retryCount = 0;
                const maxRetries = 3;
                
                while (retryCount < maxRetries && !locationData) {
                    try {
                        console.log(`Getting location... (attempt ${retryCount + 1}/${maxRetries})`);
                        
                        // Try with high accuracy first
                        let location;
                        try {
                            location = await Location.getCurrentPositionAsync({
                                accuracy: Location.Accuracy.High,
                            });
                        } catch (highAccuracyError) {
                            console.log('High accuracy failed, trying balanced accuracy:', highAccuracyError);
                            // Fallback to balanced accuracy
                            location = await Location.getCurrentPositionAsync({
                                accuracy: Location.Accuracy.Balanced,
                            });
                        }
                        
                        console.log('Location obtained:', location.coords);
                        
                        // Get reverse geocoding data to determine location details
                        let city = "Unknown City";
                        let country = "Unknown Country";
                        let continent = "Unknown Continent";
                        
                        try {
                            console.log('Starting reverse geocoding...');
                            // Try to get location details from reverse geocoding
                            const reverseGeocode = await Location.reverseGeocodeAsync({
                                latitude: location.coords.latitude,
                                longitude: location.coords.longitude
                            });
                            
                            console.log('Reverse geocode result:', reverseGeocode);
                            
                            if (reverseGeocode && reverseGeocode.length > 0) {
                                const locationInfo = reverseGeocode[0];
                                
                                // Use city or district or subregion, whatever is available
                                city = locationInfo.city || locationInfo.district || 
                                       locationInfo.subregion || locationInfo.region || "Unknown City";
                                       
                                // Use country or region
                                country = locationInfo.country || locationInfo.region || "Unknown Country";
                                
                                // Determine continent based on country code
                                const countryCode = locationInfo.isoCountryCode;
                                if (countryCode) {
                                    // Simple mapping of country codes to continents
                                    if (['US', 'CA', 'MX'].includes(countryCode)) {
                                        continent = "North America";
                                    } else if (['BR', 'AR', 'CO', 'PE', 'CL'].includes(countryCode)) {
                                        continent = "South America";
                                    } else if (['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'GR'].includes(countryCode)) {
                                        continent = "Europe";
                                    } else if (['CN', 'JP', 'KR', 'IN', 'RU', 'ID', 'PK', 'TH', 'MY', 'SG'].includes(countryCode)) {
                                        continent = "Asia";
                                    } else if (['AU', 'NZ'].includes(countryCode)) {
                                        continent = "Australia/Oceania";
                                    } else if (['ZA', 'NG', 'EG', 'MA', 'KE', 'ET', 'GH', 'TZ'].includes(countryCode)) {
                                        continent = "Africa";
                                    } else {
                                        continent = "Unknown Continent";
                                    }
                                }
                            }
                        } catch (geocodeError) {
                            console.log('Reverse geocoding failed:', geocodeError);
                            
                            // Fallback to simple region detection
                            const lat = location.coords.latitude;
                            const lng = location.coords.longitude;
                            
                            // Simplified fallback region detection
                            if (lat >= 24.4 && lat <= 49.4 && lng >= -125.0 && lng <= -66.9) {
                                country = "United States";
                                continent = "North America";
                            } else if (lat >= 35.0 && lat <= 71.0 && lng >= -25.0 && lng <= 40.0) {
                                continent = "Europe";
                            } else if (lat >= 10.0 && lat <= 55.0 && lng >= 25.0 && lng <= 180.0) {
                                continent = "Asia";
                            } else if (lat >= -43.6 && lat <= -10.7 && lng >= 113.3 && lng <= 153.6) {
                                country = "Australia";
                                continent = "Australia/Oceania";
                            }
                        }
                        
                        locationData = {
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                            city: city,
                            country: country,
                            continent: continent
                        };
                        
                        console.log('Final location data:', locationData);
                        break; // Success, exit retry loop
                        
                    } catch (error) {
                        retryCount++;
                        console.log(`Location attempt ${retryCount} failed:`, error);
                        
                        if (retryCount < maxRetries) {
                            console.log(`Retrying location detection in 2 seconds...`);
                            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
                        } else {
                            console.log('All location attempts failed');
                            Alert.alert(
                                'Location Error', 
                                'Could not get current location after multiple attempts. Please ensure location services are enabled and try again.',
                                [{ text: 'OK' }]
                            );
                        }
                    }
                }
            } catch (error) {
                console.log('Location permission not granted or error:', error);
            }

            // Generate photo hash based on URI and timestamp
            const photoHash = generateSimpleHash(asset.uri + currentTime);

            const photoMetadata: PhotoMetadata = {
                timestamp: currentTime,
                location: locationData,
                deviceInfo: Platform.OS === 'ios' ? 'iOS Camera' : 'Android Camera',
                photoHash: photoHash,
                photoUri: asset.uri, // Use original photo for now
            };

            setMetadata(photoMetadata);
            setCurrentStep('settings'); // Change from loading to settings step
        } catch (error) {
            console.error('Error processing photo:', error);
            Alert.alert('Error', 'Failed to process photo metadata.');
        }
    };

    // Generate ZK proof using the ZKGen component
    const generateZKProof = async () => {
        if (!metadata) {
            Alert.alert('Error', 'No photo metadata available');
            return;
        }
        setCurrentStep('proof');
    };

    // Reset function to ensure a complete reset
    const resetData = () => {
        setMetadata(null);
        setCurrentStep('loading'); // Reset to loading step to trigger camera
        // Reset camera launched ref to allow camera to launch again
        cameraLaunchedRef.current = false;
        // Don't reset privacy settings if saveForFuture is enabled
        if (!privacySettings.saveForFuture.enabled) {
            setPrivacySettings({
                timeProof: {
                    enabled: false,
                    level: 'month',
                },
                locationProof: {
                    enabled: false,
                    level: 'country',
                },
                deviceProof: {
                    enabled: false,
                    level: 'devicetype',
                },
                identityProof: {
                    enabled: false,
                },
                imageReveal: {
                    enabled: false,
                    level: 'none',
                },
                timeLock: {
                    enabled: false,
                    unlockTime: null,
                    lockedData: '',
                    lockType: 'date',
                },
                receiverLock: {
                    enabled: false,
                    walletAddress: '',
                    encryptedContent: '',
                },
                saveForFuture: {
                    enabled: false,
                },
                storageOptions: {
                    type: 'walrus',
                    walrusBlobId: undefined,
                    ipfsCid: undefined,
                    ipfsUrl: undefined,
                },
            });
        }
        // Force a small delay to ensure state is reset before camera launches
        setTimeout(() => {
            checkPermissionsAndProceed();
        }, 100);
    };

    // Use focus effect to reset and launch camera when tab is focused
    useFocusEffect(
        React.useCallback(() => {
            // Only reset and launch camera if we're in loading state AND don't have metadata
            if (currentStep === 'loading' && !metadata) {
                // Reset camera launched ref when tab is focused and we're loading
                cameraLaunchedRef.current = false;
                
                // Wait a moment for permissions to be checked
                const timer = setTimeout(() => {
                    checkPermissionsAndProceed();
                }, 300);
                
                return () => clearTimeout(timer);
            }
            // Don't do anything if we're not in loading state or already have metadata
            return () => {};
        }, [mediaType, currentStep, metadata])
    );

    // Date Time Picker Modal
    const renderDateTimePicker = () => (
        <Modal
            visible={showDateTimePicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowDateTimePicker(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.dateTimeModal}>
                    <View style={styles.dateTimeHeader}>
                        <Text style={styles.dateTimeTitle}>Select Unlock Time</Text>
                        <TouchableOpacity onPress={() => setShowDateTimePicker(false)}>
                            <MaterialIcons name="close" size={24} color="#64748B" />
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.dateTimeContent}>
                        <Text style={styles.currentTimeLabel}>Current selection:</Text>
                        <Text style={styles.currentTimeText}>
                            {tempDate.toLocaleDateString()} at {tempDate.toLocaleTimeString()}
                        </Text>
                        
                        <View style={styles.quickSelectContainer}>
                            <Text style={styles.quickSelectLabel}>Quick Select:</Text>
                            <View style={styles.quickSelectRow}>
                                <TouchableOpacity 
                                    style={styles.quickSelectButton}
                                    onPress={() => {
                                        const time = new Date();
                                        time.setHours(time.getHours() + 1);
                                        setTempDate(time);
                                    }}
                                >
                                    <MaterialIcons name="schedule" size={14} color="#64748B" />
                                    <Text style={styles.quickSelectText}>1 Hour</Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    style={styles.quickSelectButton}
                                    onPress={() => {
                                        const time = new Date();
                                        time.setDate(time.getDate() + 1);
                                        setTempDate(time);
                                    }}
                                >
                                    <MaterialIcons name="today" size={14} color="#64748B" />
                                    <Text style={styles.quickSelectText}>1 Day</Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    style={styles.quickSelectButton}
                                    onPress={() => {
                                        const time = new Date();
                                        time.setDate(time.getDate() + 7);
                                        setTempDate(time);
                                    }}
                                >
                                    <MaterialIcons name="date-range" size={14} color="#64748B" />
                                    <Text style={styles.quickSelectText}>1 Week</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        
                        <View style={styles.customTimeContainer}>
                            <Text style={styles.customTimeLabel}>Custom Time:</Text>
                            <View style={styles.timeInputRow}>
                                <TouchableOpacity 
                                    style={styles.timeInputButton}
                                    onPress={() => {
                                        const hours = tempDate.getHours();
                                        const newHours = hours >= 23 ? 0 : hours + 1;
                                        const newDate = new Date(tempDate);
                                        newDate.setHours(newHours);
                                        setTempDate(newDate);
                                    }}
                                >
                                    <Text style={styles.timeInputText}>Hour: {tempDate.getHours()}</Text>
                                    <MaterialIcons name="keyboard-arrow-up" size={16} color="#64748B" />
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    style={styles.timeInputButton}
                                    onPress={() => {
                                        const minutes = tempDate.getMinutes();
                                        const newMinutes = minutes >= 59 ? 0 : minutes + 15;
                                        const newDate = new Date(tempDate);
                                        newDate.setMinutes(newMinutes);
                                        setTempDate(newDate);
                                    }}
                                >
                                    <Text style={styles.timeInputText}>Min: {tempDate.getMinutes()}</Text>
                                    <MaterialIcons name="keyboard-arrow-up" size={16} color="#64748B" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                    
                    <View style={styles.dateTimeActions}>
                        <TouchableOpacity 
                            style={styles.cancelButton}
                            onPress={() => setShowDateTimePicker(false)}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={styles.confirmButton}
                            onPress={() => {
                                setPrivacySettings(prev => ({
                                    ...prev,
                                    timeLock: { ...prev.timeLock, unlockTime: tempDate }
                                }));
                                setShowDateTimePicker(false);
                            }}
                        >
                            <Text style={styles.confirmButtonText}>Confirm</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    // Render the Privacy Settings screen
    const renderSettingsStep = () => (
        <PrivacySettingsScreen 
            metadata={metadata}
            privacySettings={privacySettings}
            privacyApproach={privacyApproach}
            setPrivacyApproach={setPrivacyApproach}
            setPrivacySettings={setPrivacySettings}
            onBackPress={() => router.back()}
            onGenerateProof={generateZKProof}
        />
    );

    // Render the ZKGen component for proof generation
    const renderProofStep = () => (
        <ZKGen
            metadata={metadata}
            privacySettings={privacySettings}
            onComplete={(resetFunc) => {
                // Do nothing with resetFunc, let ProofSuccessModal handle it
                console.log("Proof generation complete, showing success screen");
            }}
            onReset={resetData}
        />
    );

    // Add a loading step renderer for camera startup
    const renderLoadingStep = () => (
        <View style={styles.loadingContainer}>
            <View style={styles.loadingCircle}>
                <MaterialIcons 
                    name={mediaType === 'video' ? "videocam" : "camera-alt"} 
                    size={40} 
                    color="#64748B" 
                />
            </View>
            <Text style={styles.loadingTitle}>
                {mediaType === 'video' ? 'Starting Video Camera' : 'Starting Camera'}
            </Text>
            <Text style={styles.loadingSubtitle}>
                {mediaType === 'video' 
                    ? 'Preparing to record a new video...' 
                    : 'Preparing to take a new photo...'}
            </Text>
        </View>
    );
    
    // Add a processing step renderer for after media capture
    const renderProcessingStep = () => (
        <View style={styles.loadingContainer}>
            <View style={styles.loadingCircle}>
                <MaterialIcons 
                    name={mediaType === 'video' ? "movie" : "image"} 
                    size={40} 
                    color="#64748B" 
                />
            </View>
            <Text style={styles.loadingTitle}>
                {mediaType === 'video' ? 'Processing Video' : 'Processing Photo'}
            </Text>
            <Text style={styles.loadingSubtitle}>
                Analyzing metadata and preparing settings...
            </Text>
        </View>
    );

    // Render the appropriate screen based on current step
    return currentStep === 'proof' ?
        renderProofStep() :
        currentStep === 'loading' ?
            renderLoadingStep() :
            currentStep === 'processing' ?
                renderProcessingStep() :
                <>
                    {renderSettingsStep()}
                    {renderDateTimePicker()}
                </>;
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
    },
    loadingCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    loadingTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 12,
    },
    loadingSubtitle: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    // Modal styles for date time picker
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    dateTimeModal: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
    },
    dateTimeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    dateTimeTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    dateTimeContent: {
        marginBottom: 24,
    },
    currentTimeLabel: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 4,
    },
    currentTimeText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 20,
    },
    quickSelectContainer: {
        marginBottom: 20,
    },
    quickSelectLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 8,
    },
    quickSelectRow: {
        flexDirection: 'row',
        gap: 8,
    },
    quickSelectButton: {
        flex: 1,
        backgroundColor: 'rgba(248, 250, 252, 0.9)',
        borderWidth: 1,
        borderColor: 'rgba(203, 213, 225, 0.5)',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 4,
    },
    quickSelectText: {
        fontSize: 14,
        color: '#1E293B',
        fontWeight: '500',
    },
    customTimeContainer: {
        marginTop: 8,
    },
    customTimeLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 8,
    },
    timeInputRow: {
        flexDirection: 'row',
        gap: 12,
    },
    timeInputButton: {
        flex: 1,
        backgroundColor: 'rgba(248, 250, 252, 0.9)',
        borderWidth: 1,
        borderColor: 'rgba(203, 213, 225, 0.5)',
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    timeInputText: {
        fontSize: 14,
        color: '#1E293B',
        fontWeight: '500',
    },
    dateTimeActions: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: 'rgba(248, 250, 252, 0.9)',
        borderWidth: 1,
        borderColor: 'rgba(203, 213, 225, 0.5)',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        color: '#64748B',
        fontWeight: '600',
    },
    confirmButton: {
        flex: 1,
        backgroundColor: '#3B82F6',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    confirmButtonText: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '600',
    },
}); 