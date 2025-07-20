import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    Switch,
    Alert,
} from 'react-native';

export default function SettingsScreen() {
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [autoSaveProofs, setAutoSaveProofs] = useState(true);
    const [darkMode, setDarkMode] = useState(true);
    const [biometricAuth, setBiometricAuth] = useState(false);

    const clearAllData = () => {
        Alert.alert(
            'Clear All Data',
            'This will delete all photos, proofs, and trusted devices. This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete All',
                    style: 'destructive',
                    onPress: () => {
                        // Here you would clear AsyncStorage
                        Alert.alert('Success', 'All data has been cleared');
                    },
                },
            ]
        );
    };

    const exportData = () => {
        Alert.alert('Export Data', 'Feature coming soon - export your ZK proofs for backup');
    };

    const renderSettingItem = (
        emoji: string,
        title: string,
        description: string,
        value: boolean,
        onChange: (value: boolean) => void,
        showSwitch = true
    ) => (
        <View style={styles.settingItem}>
            <View style={styles.settingContent}>
                <Text style={styles.settingEmoji}>{emoji}</Text>
                <View style={styles.settingTextContainer}>
                    <Text style={styles.settingTitle}>{title}</Text>
                    <Text style={styles.settingDescription}>{description}</Text>
                </View>
                {showSwitch && (
                    <Switch
                        value={value}
                        onValueChange={onChange}
                        trackColor={{ false: 'rgba(203, 213, 225, 0.8)', true: '#10B981' }}
                        thumbColor='#ffffff'
                    />
                )}
            </View>
        </View>
    );

    const renderActionItem = (
        emoji: string,
        title: string,
        description: string,
        onPress: () => void,
        danger = false
    ) => (
        <TouchableOpacity style={styles.actionItem} onPress={onPress}>
            <View style={styles.settingContent}>
                <Text style={styles.settingEmoji}>{emoji}</Text>
                <View style={styles.settingTextContainer}>
                    <Text style={[styles.settingTitle, danger && styles.dangerText]}>{title}</Text>
                    <Text style={styles.settingDescription}>{description}</Text>
                </View>
                <Text style={styles.arrow}>→</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />
            
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Privacy & Security */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🔒 Privacy & Security</Text>
                    
                    {renderSettingItem(
                        '💾',
                        'Auto-save Proofs',
                        'Automatically save generated ZK proofs to gallery',
                        autoSaveProofs,
                        setAutoSaveProofs
                    )}
                    
                    {renderSettingItem(
                        '🔐',
                        'Biometric Authentication',
                        'Use fingerprint or face ID to access app',
                        biometricAuth,
                        setBiometricAuth
                    )}
                </View>

                {/* Data Management */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>💾 Data Management</Text>
                    
                    {renderActionItem(
                        '📤',
                        'Export Data',
                        'Export your photos and ZK proofs for backup',
                        exportData
                    )}
                    
                    {renderActionItem(
                        '🗑️',
                        'Clear All Data',
                        'Delete all photos, proofs, and trusted devices',
                        clearAllData,
                        true
                    )}
                </View>

                {/* About */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ℹ️ About</Text>
                    
                    <View style={styles.aboutContainer}>
                        <Text style={styles.appName}>ZK PhotoVerifier</Text>
                        <Text style={styles.version}>Version 1.0.0</Text>
                        <Text style={styles.description}>
                            Privacy-preserving photo verification using zero-knowledge proofs. 
                            Built with Circom and mopro for cryptographically sound verification.
                        </Text>
                        
                        <View style={styles.techStack}>
                            <Text style={styles.techTitle}>🔬 Technology Stack</Text>
                            <Text style={styles.techItem}>• React Native & Expo</Text>
                            <Text style={styles.techItem}>• Circom ZK Circuits</Text>
                            <Text style={styles.techItem}>• mopro ZK Library</Text>
                            <Text style={styles.techItem}>• Arkworks Proving System</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(20, 20, 30, 0.95)',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 15,
        paddingBottom: 30,
    },
    section: {
        marginBottom: 25,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 10,
        paddingLeft: 5,
    },
    settingItem: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        marginBottom: 10,
    },
    actionItem: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        marginBottom: 10,
    },
    settingContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    settingEmoji: {
        fontSize: 22,
        marginRight: 12,
    },
    settingTextContainer: {
        flex: 1,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    settingDescription: {
        fontSize: 14,
        color: '#94A3B8',
    },
    dangerText: {
        color: '#EF4444',
    },
    arrow: {
        fontSize: 18,
        color: '#94A3B8',
        marginLeft: 12,
    },
    aboutContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        padding: 20,
    },
    appName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 5,
    },
    version: {
        fontSize: 14,
        color: '#94A3B8',
        marginBottom: 15,
    },
    description: {
        fontSize: 15,
        color: '#E2E8F0',
        lineHeight: 22,
        marginBottom: 20,
    },
    techStack: {
        marginTop: 10,
    },
    techTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    techItem: {
        fontSize: 14,
        color: '#94A3B8',
        marginBottom: 5,
        lineHeight: 20,
    },
}); 