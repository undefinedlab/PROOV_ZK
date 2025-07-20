import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Switch,
    Dimensions,
    StatusBar,
    ScrollView,
    Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// Hardcoded simulation types and functions
interface PhotoMetadata {
    photoUri?: string;
    timestamp?: number;
    location?: {
        country?: string;
        city?: string;
        latitude?: number;
        longitude?: number;
    };
    deviceInfo?: string;
}

interface PrivacySettings {
    timeProof: {
        enabled: boolean;
        level: 'exact';
    };
    locationProof: {
        enabled: boolean;
        level: 'exact';
    };
    deviceProof: {
        enabled: boolean;
        level: 'devicetype';
    };
    identityProof: {
        enabled: boolean;
    };
    imageReveal: {
        enabled: boolean;
        level: 'image';
    };
    saveForFuture: {
        enabled: boolean;
    };
}

// Hardcoded simulation functions
const generateTimeClaim = (timestamp: number, level: string): string => {
    const date = new Date(timestamp);
    return `Photo taken on ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
};

const generateLocationClaim = (location: any, level: string): string => {
    if (!location) return "Location unknown";
    if (location.city && location.country) {
        return `Photo taken in ${location.city}, ${location.country}`;
    } else if (location.country) {
        return `Photo taken in ${location.country}`;
    }
    return "Location available";
};

const generateDeviceClaim = (deviceInfo: string, level: string): string => {
    if (level === 'devicetype') {
        if (deviceInfo.toLowerCase().includes('iphone')) return "iPhone device";
        if (deviceInfo.toLowerCase().includes('android')) return "Android device";
        return "Mobile device";
    }
    return deviceInfo || "Unknown device";
};

const generateImageContentClaim = (level: string): string => {
    if (level === 'image') {
        return "Full image content available";
    }
    return "Image content private";
};

interface PrivacySettingsProps {
    metadata: PhotoMetadata | null;
    privacySettings: PrivacySettings;
    setPrivacySettings: React.Dispatch<React.SetStateAction<PrivacySettings>>;
    onBackPress: () => void;
    onGenerateProof: () => void;
}

const PrivacySettingsScreen: React.FC<PrivacySettingsProps> = ({
    metadata,
    privacySettings,
    setPrivacySettings,
    onBackPress,
    onGenerateProof
}) => {
    return (
        <ScrollView 
            style={styles.container} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
            <View style={styles.fullScreenHeader}>
                <TouchableOpacity onPress={onBackPress} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color="#64748B" />
                </TouchableOpacity>
                <Text style={styles.fullScreenTitle}>Privacy Settings</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Photo Preview Section */}
            {metadata?.photoUri && (
                <View style={styles.photoPreviewSection}>
                    <View style={styles.photoContainer}>
                        <Image source={{ uri: metadata.photoUri }} style={styles.previewImage} />
                        <View style={styles.photoOverlay}>
                            <Text style={styles.overlayText}>
                                {`${new Date(metadata?.timestamp || Date.now()).toLocaleString()}${metadata?.location?.country ? ` • ${metadata.location.country}` : ''}`}
                            </Text>
                        </View>
                    </View>
                </View>
            )}
            
            {/* Privacy Controls */}
            <View style={styles.privacyControlsContainer}>
                <View style={styles.privacyCard}>
                    <Text style={styles.privacyCardTitle}>Public Claims</Text>
                    
                    {/* Time Claim */}
                    <View style={styles.claimContainer}>
                        <View style={styles.claimToggleRow}>
                            <View style={styles.claimInfo}>
                                <View style={styles.proofIconContainer}>
                                    <MaterialCommunityIcons name="clock-outline" size={18} color="#64748B" />
                                </View>
                                <View style={styles.claimTextContainer}>
                                    <Text style={styles.claimTitle}>Time</Text>
                                    <Text style={styles.claimDescription}>
                                        {privacySettings.timeProof.enabled ? 
                                            generateTimeClaim(metadata?.timestamp || Date.now(), 'exact') : 
                                            "Private"}
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={privacySettings.timeProof.enabled}
                                onValueChange={(value) => setPrivacySettings(prev => ({
                                    ...prev, 
                                    timeProof: { 
                                        ...prev.timeProof, 
                                        enabled: value,
                                        level: 'exact'
                                    }
                                }))}
                                trackColor={{ false: 'rgba(203, 213, 225, 0.8)', true: '#94A3B8' }}
                                thumbColor='#ffffff'
                            />
                        </View>
                    </View>
                    
                    {/* Location Claim */}
                    <View style={styles.claimContainer}>
                        <View style={styles.claimToggleRow}>
                            <View style={styles.claimInfo}>
                                <View style={styles.proofIconContainer}>
                                    <Ionicons name="location-outline" size={18} color="#64748B" />
                                </View>
                                <View style={styles.claimTextContainer}>
                                    <Text style={styles.claimTitle}>Location</Text>
                                    <Text style={styles.claimDescription}>
                                        {privacySettings.locationProof.enabled ? 
                                            generateLocationClaim(metadata?.location, 'exact') : 
                                            "Private"}
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={privacySettings.locationProof.enabled}
                                onValueChange={(value) => setPrivacySettings(prev => ({
                                    ...prev, 
                                    locationProof: { 
                                        ...prev.locationProof, 
                                        enabled: value,
                                        level: 'exact'
                                    }
                                }))}
                                trackColor={{ false: 'rgba(203, 213, 225, 0.8)', true: '#94A3B8' }}
                                thumbColor='#ffffff'
                            />
                        </View>
                    </View>
                    
                    {/* Device Claim */}
                    <View style={styles.claimContainer}>
                        <View style={styles.claimToggleRow}>
                            <View style={styles.claimInfo}>
                                <View style={styles.proofIconContainer}>
                                    <MaterialIcons name="smartphone" size={18} color="#64748B" />
                                </View>
                                <View style={styles.claimTextContainer}>
                                    <Text style={styles.claimTitle}>Device</Text>
                                    <Text style={styles.claimDescription}>
                                        {privacySettings.deviceProof.enabled ? 
                                            generateDeviceClaim(metadata?.deviceInfo || "Unknown device", 'devicetype') : 
                                            "Private"}
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={privacySettings.deviceProof.enabled}
                                onValueChange={(value) => setPrivacySettings(prev => ({
                                    ...prev, 
                                    deviceProof: { 
                                        ...prev.deviceProof, 
                                        enabled: value,
                                        level: 'devicetype'
                                    }
                                }))}
                                trackColor={{ false: 'rgba(203, 213, 225, 0.8)', true: '#94A3B8' }}
                                thumbColor='#ffffff'
                            />
                        </View>
                    </View>
                    
                    {/* Identity Claim */}
                    <View style={styles.claimContainer}>
                        <View style={styles.claimToggleRow}>
                            <View style={styles.claimInfo}>
                                <View style={styles.proofIconContainer}>
                                    <MaterialIcons name="person" size={18} color="#64748B" />
                                </View>
                                <View style={styles.claimTextContainer}>
                                    <Text style={styles.claimTitle}>Identity</Text>
                                    <Text style={styles.claimDescription}>
                                        {privacySettings.identityProof.enabled ? 
                                            "Identity verified" : 
                                            "Private"}
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={privacySettings.identityProof.enabled}
                                onValueChange={(value) => setPrivacySettings(prev => ({
                                    ...prev, 
                                    identityProof: { ...prev.identityProof, enabled: value }
                                }))}
                                trackColor={{ false: 'rgba(203, 213, 225, 0.8)', true: '#94A3B8' }}
                                thumbColor='#ffffff'
                            />
                        </View>
                    </View>
                    
                    {/* Image Content Claim */}
                    <View style={styles.claimContainer}>
                        <View style={styles.claimToggleRow}>
                            <View style={styles.claimInfo}>
                                <View style={styles.proofIconContainer}>
                                    <MaterialIcons name="image" size={18} color="#64748B" />
                                </View>
                                <View style={styles.claimTextContainer}>
                                    <Text style={styles.claimTitle}>Image Content</Text>
                                    <Text style={styles.claimDescription}>
                                        {privacySettings.imageReveal.enabled ? 
                                            generateImageContentClaim('image') : 
                                            "Private"}
                                    </Text>
                                </View>
                            </View>
                            <Switch
                                value={privacySettings.imageReveal.enabled}
                                onValueChange={(value) => setPrivacySettings(prev => ({
                                    ...prev, 
                                    imageReveal: { 
                                        ...prev.imageReveal, 
                                        enabled: value,
                                        level: 'image'
                                    }
                                }))}
                                trackColor={{ false: 'rgba(203, 213, 225, 0.8)', true: '#94A3B8' }}
                                thumbColor='#ffffff'
                            />
                        </View>
                    </View>
                </View>

                {/* Save for Future Pictures Toggle */}
                <View style={styles.saveToggleCard}>
                    <View style={styles.saveToggleRow}>
                        <View style={styles.saveToggleTextContainer}>
                            <Text style={styles.saveToggleTitle}>Save these settings for future pictures</Text>
                            <Text style={styles.saveToggleDescription}>
                                {privacySettings.saveForFuture.enabled ? 
                                    "Settings will be remembered" : 
                                    "Settings will reset each time"}
                            </Text>
                        </View>
                        <Switch
                            value={privacySettings.saveForFuture.enabled}
                            onValueChange={(value) => setPrivacySettings(prev => ({
                                ...prev, 
                                saveForFuture: { ...prev.saveForFuture, enabled: value }
                            }))}
                            trackColor={{ false: 'rgba(203, 213, 225, 0.8)', true: '#94A3B8' }}
                            thumbColor='#ffffff'
                        />
                    </View>
                </View>
            </View>
            
            {/* Generate proof button */}
            <View style={styles.buttonContainer}>
                <TouchableOpacity 
                    style={styles.glassmorphicGenerateButton} 
                    onPress={onGenerateProof}
                >
                    <View style={styles.generateButtonContent}>
                        <MaterialIcons name="shield" size={20} color="#1E293B" />
                        <Text style={styles.glassmorphicGenerateButtonText}>Generate ZK Proof</Text>
                    </View>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    scrollContent: {
        paddingBottom: 70,
    },
    fullScreenHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.8)',
    },
    fullScreenTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    placeholder: {
        width: 60,
    },
    photoPreviewSection: {
        marginHorizontal: 20,
        marginBottom: 24,
        alignItems: 'center',
    },
    photoContainer: {
        position: 'relative',
        width: width - 40,
        height: 280,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.8)',
    },
    previewImage: {
        width: '100%',
        height: '100%',
        borderRadius: 20,
    },
    photoOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    overlayText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    privacyControlsContainer: {
        paddingHorizontal: 16,
        marginBottom: 20,
        width: '100%',
    },
    privacyCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        padding: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginBottom: 16,
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(203, 213, 225, 0.5)',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
    },
    privacyCardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 12,
    },
    claimContainer: {
        marginBottom: 14,
        width: '100%',
    },
    claimToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    claimInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    claimTextContainer: {
        flex: 1,
    },
    claimTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 1,
    },
    claimDescription: {
        fontSize: 12,
        color: '#64748B',
    },
    proofIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 3,
        elevation: 1,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.8)',
    },
    saveToggleCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(203, 213, 225, 0.5)',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4,
    },
    saveToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    saveToggleTextContainer: {
        flex: 1,
    },
    saveToggleTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 1,
    },
    saveToggleDescription: {
        fontSize: 12,
        color: '#64748B',
    },
    buttonContainer: {
        padding: 16,
        width: '100%',
    },
    glassmorphicGenerateButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        paddingVertical: 16,
        borderRadius: 12,
        marginTop: 16,
        marginBottom: 40,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        width: '100%',
    },
    generateButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    glassmorphicGenerateButtonText: {
        color: '#1E293B',
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: 0.3,
        marginLeft: 8,
    },
});

export default PrivacySettingsScreen; 