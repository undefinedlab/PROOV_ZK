import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Dimensions,
    StatusBar,
    Image,
    SafeAreaView,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import useTheme from '@/hooks/useTheme';
import { Permissions } from '.';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

interface WelcomeScreenProps {
    visible: boolean;
    onComplete: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ visible, onComplete }) => {
    const [currentScreen, setCurrentScreen] = useState(0);
    const [showPermissions, setShowPermissions] = useState(false);
    const theme = useTheme();

    const screens = [
        {
            icon: 'verified',
            title: 'Welcome to ',
            subtitle: 'Verify photos with zero-knowledge proofs',
            description: 'Proove lets you take photos and generate cryptographic proofs about when and where they were taken, while keeping your privacy intact.',
            primaryColor: theme.primary,
            secondaryColor: theme.accent,
        },
        {
            icon: 'security',
            title: 'Privacy First',
            subtitle: 'Your data stays private',
            description: 'Using zero-knowledge proofs, you can prove facts about your photos without revealing sensitive details like exact location or timestamp.',
            primaryColor: theme.secondary,
            secondaryColor: theme.accent,
        },
        {
            icon: 'camera-alt',
            title: 'Capture & Verify',
            subtitle: 'Take authenticated photos',
            description: 'Every photo you take includes cryptographic metadata and generates a ZK proof that validates its authenticity and properties.',
            primaryColor: theme.primary,
            secondaryColor: theme.secondary,
        },
        {
            icon: 'share',
            title: 'Share Securely',
            subtitle: 'Control what you reveal',
            description: 'Share your photos with customizable privacy claims. Choose exactly what information to reveal while maintaining cryptographic proof.',
            primaryColor: theme.accent,
            secondaryColor: theme.secondary,
        },
    ];

    const handleNext = () => {
        if (currentScreen < screens.length - 1) {
            setCurrentScreen(currentScreen + 1);
        } else {
            // Show permissions screen instead of completing directly
            setShowPermissions(true);
        }
    };

    const handlePrevious = () => {
        if (currentScreen > 0) {
            setCurrentScreen(currentScreen - 1);
        }
    };

    const handleSkip = () => {
        // Show permissions screen instead of completing directly
        setShowPermissions(true);
    };

    const handlePermissionsComplete = async (success: boolean) => {
        // Remove storing welcome completion status so it shows every time
        onComplete();
    };

    if (!visible) return null;

    // Show permissions screen if we're at that stage
    if (showPermissions) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
                <Permissions onComplete={handlePermissionsComplete} />
            </View>
        );
    }

    const currentScreenData = screens[currentScreen];

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            
            {/* Background Layers */}
            <View style={[styles.backgroundLayer1, { backgroundColor: theme.background }]} />
            <View style={[styles.backgroundLayer2, { backgroundColor: theme.card }]} />
            <View style={[styles.backgroundLayer3, { backgroundColor: theme.card }]} />
            
            {/* Skip Button */}
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>

            {/* Main Content */}
            <View style={styles.content}>
                {/* Icon Section */}
                <View style={styles.iconSection}>
                    <View style={[styles.iconContainer, { backgroundColor: currentScreenData.primaryColor }]}>
                        <View style={[styles.iconOverlay, { backgroundColor: currentScreenData.secondaryColor }]} />
                        <MaterialIcons 
                            name={currentScreenData.icon as any} 
                            size={60} 
                            color="#FFFFFF" 
                            style={{ zIndex: 2 }}
                        />
                    </View>
                </View>

                {/* Text Content */}
                <View style={styles.textContainer}>
                    <View style={styles.glassCard}>
                        <Text style={styles.title}>{currentScreenData.title}</Text>
                        <Text style={styles.subtitle}>{currentScreenData.subtitle}</Text>
                        <Text style={styles.description}>{currentScreenData.description}</Text>
                    </View>
                </View>

                {/* Progress Indicators */}
                <View style={styles.progressContainer}>
                    {screens.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.progressDot,
                                index === currentScreen && styles.progressDotActive,
                                index === currentScreen && { backgroundColor: currentScreenData.primaryColor }
                            ]}
                        />
                    ))}
                </View>

                {/* Navigation Buttons */}
                <View style={styles.navigationContainer}>
                    {currentScreen > 0 && (
                        <TouchableOpacity style={styles.backButton} onPress={handlePrevious}>
                            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    )}
                    
                    <View style={styles.spacer} />
                    
                    <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                        <View style={[styles.nextButtonGradient, { backgroundColor: currentScreenData.primaryColor }]}>
                            <View style={[styles.nextButtonOverlay, { backgroundColor: currentScreenData.secondaryColor }]} />
                            <Text style={styles.nextText}>
                                {currentScreen === screens.length - 1 ? 'Get Started' : 'Next'}
                            </Text>
                            <Ionicons 
                                name={currentScreen === screens.length - 1 ? "checkmark" : "arrow-forward"} 
                                size={20} 
                                color="#FFFFFF" 
                                style={{ zIndex: 2 }}
                            />
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: width,
        height: height,
        zIndex: 10000,
    },
    backgroundLayer1: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    backgroundLayer2: {
        position: 'absolute',
        top: height * 0.3,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.8,
    },
    backgroundLayer3: {
        position: 'absolute',
        top: height * 0.6,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.6,
    },
    skipButton: {
        position: 'absolute',
        top: 60,
        right: 20,
        zIndex: 1000,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    skipText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 100,
        paddingBottom: 50,
    },
    iconSection: {
        marginBottom: 40,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.3,
        shadowRadius: 30,
        elevation: 15,
        overflow: 'hidden',
        position: 'relative',
    },
    iconOverlay: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: '60%',
        height: '100%',
        opacity: 0.7,
    },
    textContainer: {
        width: '100%',
        marginBottom: 50,
    },
    glassCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 24,
        padding: 32,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
        marginBottom: 16,
    },
    description: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.7)',
        textAlign: 'center',
        lineHeight: 22,
        fontWeight: '400',
    },
    progressContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
        gap: 12,
    },
    progressDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    progressDotActive: {
        width: 40,
        borderRadius: 6,
    },
    navigationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 0,
    },
    backButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    spacer: {
        flex: 1,
    },
    nextButton: {
        borderRadius: 25,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 8,
    },
    nextButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 32,
        gap: 8,
        position: 'relative',
        overflow: 'hidden',
    },
    nextButtonOverlay: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: '50%',
        height: '100%',
        opacity: 0.6,
    },
    nextText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        zIndex: 2,
    },
});

export default WelcomeScreen; 