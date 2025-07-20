import React from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useTheme from '@/hooks/useTheme';
import { TrustedDevice } from './PairDevice';

const { width } = Dimensions.get('window');
const cardSize = (width - 48) / 2; // 2 cards per row with proper spacing

interface DeviceCardProps {
    device: TrustedDevice;
    onRemove: () => void;
    onConnect: () => void;
    onPress: () => void;
}

export default function DeviceCard({ device, onRemove, onConnect, onPress }: DeviceCardProps) {
    const theme = useTheme();
    
    // Determine appropriate icon based on device type
    const getDeviceIcon = () => {
        const type = device.type.toLowerCase();
        
        if (type.includes('esp32') || type.includes('esp-32') || type === 'esp32-ble') {
            return <Ionicons name="hardware-chip" size={28} color={theme.primary} />;
        } else if (type.includes('cam')) {
            return <Ionicons name="camera" size={28} color={theme.primary} />;
        } else if (type.includes('bluetooth') || type.includes('ble')) {
            return <Ionicons name="bluetooth" size={28} color={theme.primary} />;
        } else if (type.includes('ios')) {
            return <Ionicons name="phone-portrait" size={28} color={theme.primary} />;
        } else if (type.includes('android')) {
            return <Ionicons name="logo-android" size={28} color={theme.primary} />;
        }
        
        // Default icon
        return <Ionicons name="hardware-chip" size={28} color={theme.primary} />;
    };
    
    // Format the last used date
    const formatLastUsed = () => {
        if (!device.lastUsed) return 'Never used';
        
        const lastUsed = new Date(device.lastUsed);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return `${diffDays} days ago`;
        } else {
            return lastUsed.toLocaleDateString();
        }
    };
    
    // Get status indicator color
    const getStatusColor = () => {
        if (!device.status || device.status === 'unknown') {
            return theme.inactive;
        } else if (device.status === 'connected') {
            return theme.success;
        } else {
            return theme.error;
        }
    };
    
    return (
        <TouchableOpacity 
            style={[
                styles.deviceCard, 
                { 
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    width: cardSize,
                }
            ]}
            onPress={onPress}
        >
            <View style={styles.iconContainer}>
                {getDeviceIcon()}
            </View>
            
            <Text style={[styles.deviceName, { color: theme.text }]} numberOfLines={1}>
                {device.name}
            </Text>
            
            <Text style={[styles.deviceType, { color: theme.textSecondary }]} numberOfLines={1}>
                {device.type}
            </Text>
            
            <View style={styles.statusRow}>
                {device.status === 'unknown' ? (
                    <ActivityIndicator size="small" color={theme.primary} style={styles.statusIndicator} />
                ) : (
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                )}
                <Text style={[styles.lastUsed, { color: theme.textSecondary }]}>
                    {device.status === 'connected' ? 'Connected' : formatLastUsed()}
                </Text>
            </View>
            
            <TouchableOpacity 
                style={[styles.removeButton, { backgroundColor: theme.error }]}
                onPress={onRemove}
            >
                <Text style={styles.removeButtonText}>×</Text>
            </TouchableOpacity>
            
            {device.status === 'connected' && (
                <View style={[styles.connectedIndicator, { backgroundColor: theme.success }]}>
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    deviceCard: {
        height: cardSize,
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    iconContainer: {
        marginBottom: 12,
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    deviceName: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 4,
        textAlign: 'center',
        letterSpacing: -0.2,
    },
    deviceType: {
        fontSize: 11,
        textAlign: 'center',
        fontWeight: '500',
        marginBottom: 8,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 4,
    },
    statusIndicator: {
        marginRight: 4,
        width: 6,
        height: 6,
    },
    lastUsed: {
        fontSize: 10,
        opacity: 0.7,
    },
    removeButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        borderRadius: 16,
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    removeButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        lineHeight: 16,
    },
    connectedIndicator: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        borderRadius: 12,
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
}); 