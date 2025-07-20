import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as MediaLibrary from 'expo-media-library';

interface PermissionsProps {
    onComplete: (success: boolean) => void;
}

const Permissions: React.FC<PermissionsProps> = ({ onComplete }) => {
    const [loading, setLoading] = useState(false);
    const [permissionsGranted, setPermissionsGranted] = useState({
        camera: false,
        location: false,
        mediaLibrary: false,
    });

    const requestCameraPermission = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            return status === 'granted';
        } catch (error) {
            console.error('Error requesting camera permission:', error);
            return false;
        }
    };

    const requestLocationPermission = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            return status === 'granted';
        } catch (error) {
            console.error('Error requesting location permission:', error);
            return false;
        }
    };

    const requestMediaLibraryPermission = async () => {
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            return status === 'granted';
        } catch (error) {
            console.error('Error requesting media library permission:', error);
            return false;
        }
    };

    const requestAllPermissions = async () => {
        setLoading(true);
        try {
            // Request all permissions
            const [cameraGranted, locationGranted, mediaLibraryGranted] = await Promise.all([
                requestCameraPermission(),
                requestLocationPermission(),
                requestMediaLibraryPermission(),
            ]);

            setPermissionsGranted({
                camera: cameraGranted,
                location: locationGranted,
                mediaLibrary: mediaLibraryGranted,
            });

            // Store that we've shown the welcome screen
            await AsyncStorage.setItem('@welcome_shown', 'true');
            await AsyncStorage.setItem('@permissions_requested', 'true');

            // Show results to user
            const grantedCount = [cameraGranted, locationGranted, mediaLibraryGranted].filter(Boolean).length;
            
            if (grantedCount === 3) {
                Alert.alert(
                    'Permissions Granted!',
                    'All permissions have been granted. You can now take photos and verify them with ZK proofs.',
                    [{ text: 'Get Started', onPress: () => onComplete(true) }]
                );
            } else if (grantedCount > 0) {
                Alert.alert(
                    'Partial Permissions',
                    `Some permissions were granted (${grantedCount}/3). You can still use the app, but some features may be limited. You can grant additional permissions later in your device settings.`,
                    [{ text: 'Continue', onPress: () => onComplete(true) }]
                );
            } else {
                Alert.alert(
                    'Permissions Required',
                    'No permissions were granted. The app needs camera and location access to verify photos. You can grant permissions later in your device settings.',
                    [{ text: 'Continue Anyway', onPress: () => onComplete(true) }]
                );
            }
        } catch (error) {
            console.error('Error requesting permissions:', error);
            Alert.alert(
                'Error',
                'There was an error requesting permissions. You can grant them later in your device settings.',
                [{ text: 'Continue', onPress: () => onComplete(true) }]
            );
        } finally {
            setLoading(false);
        }
    };

    const skipWelcome = async () => {
        try {
            await AsyncStorage.setItem('@welcome_shown', 'true');
            onComplete(true);
        } catch (error) {
            console.error('Error storing welcome status:', error);
            onComplete(true);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Permissions Required</Text>
            <Text style={styles.subtitle}>To verify photos with ZK proofs, we need access to your camera and location</Text>
            
            <View style={styles.permissionsList}>
                <View style={styles.permissionItem}>
                    <View style={styles.permissionIcon}>
                        <MaterialIcons 
                            name="camera-alt" 
                            size={24} 
                            color="#3B82F6" 
                        />
                    </View>
                    <View style={styles.permissionText}>
                        <Text style={styles.permissionTitle}>Camera Access</Text>
                        <Text style={styles.permissionDescription}>
                            Required to take photos for verification
                        </Text>
                    </View>
                </View>
                
                <View style={styles.permissionItem}>
                    <View style={styles.permissionIcon}>
                        <MaterialIcons 
                            name="location-on" 
                            size={24} 
                            color="#10B981" 
                        />
                    </View>
                    <View style={styles.permissionText}>
                        <Text style={styles.permissionTitle}>Location Access</Text>
                        <Text style={styles.permissionDescription}>
                            Required to verify where photos were taken
                        </Text>
                    </View>
                </View>
                
                <View style={styles.permissionItem}>
                    <View style={styles.permissionIcon}>
                        <MaterialIcons 
                            name="photo-library" 
                            size={24} 
                            color="#8B5CF6" 
                        />
                    </View>
                    <View style={styles.permissionText}>
                        <Text style={styles.permissionTitle}>Media Library</Text>
                        <Text style={styles.permissionDescription}>
                            Required to save verified photos to your device
                        </Text>
                    </View>
                </View>
            </View>

            <View style={styles.infoBox}>
                <MaterialIcons name="info" size={20} color="#F59E0B" />
                <Text style={styles.infoText}>
                    Your privacy is protected. We only use this data to generate ZK proofs and don't store your personal information.
                </Text>
            </View>
            
            <View style={styles.buttonContainer}>
                <TouchableOpacity 
                    style={styles.continueButton}
                    onPress={requestAllPermissions}
                    disabled={loading}
                >
                    <Text style={styles.continueButtonText}>
                        {loading ? 'Requesting Permissions...' : 'Grant Permissions'}
                    </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    style={styles.skipButton}
                    onPress={skipWelcome}
                >
                    <Text style={styles.skipButtonText}>Skip for Now</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#000000',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#AAAAAA',
        textAlign: 'center',
        marginBottom: 40,
    },
    permissionsList: {
        width: '100%',
        marginBottom: 30,
    },
    permissionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    permissionIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    permissionText: {
        flex: 1,
    },
    permissionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    permissionDescription: {
        fontSize: 14,
        color: '#AAAAAA',
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 30,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    infoText: {
        flex: 1,
        fontSize: 14,
        color: '#F59E0B',
        marginLeft: 12,
        lineHeight: 20,
    },
    buttonContainer: {
        width: '100%',
        gap: 12,
    },
    continueButton: {
        backgroundColor: '#3B82F6',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#1E40AF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    continueButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    skipButton: {
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    skipButtonText: {
        color: '#AAAAAA',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default Permissions; 