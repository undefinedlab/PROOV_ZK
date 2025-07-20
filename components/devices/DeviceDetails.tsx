import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useTheme from '@/hooks/useTheme';
import { TrustedDevice } from './PairDevice';
import ShareWifi from './ShareWifi';

interface DeviceDetailsProps {
    device: TrustedDevice;
    onClose: () => void;
    onSync: () => void;
    onConnect: () => void;
    onRemove: () => void;
}

export default function DeviceDetails({ 
    device, 
    onClose,
    onSync,
    onConnect,
    onRemove
}: DeviceDetailsProps) {
    const theme = useTheme();
    const [shareWifiVisible, setShareWifiVisible] = useState(false);
    
    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    
    const getDeviceStatusText = () => {
        if (!device.status || device.status === 'unknown') {
            return 'Unknown';
        } else if (device.status === 'connected') {
            return 'Connected';
        } else {
            return 'Disconnected';
        }
    };
    
    const getDeviceStatusColor = () => {
        if (!device.status || device.status === 'unknown') {
            return theme.inactive;
        } else if (device.status === 'connected') {
            return theme.success;
        } else {
            return theme.error;
        }
    };
    
    const getDeviceTypeIcon = () => {
        const type = device.type.toLowerCase();
        
        if (type.includes('esp32-cam') || type.includes('camera')) {
            return <Ionicons name="camera" size={48} color={theme.primary} />;
        } else if (type.includes('esp32') || type.includes('esp-32') || type === 'esp32-ble') {
            return <Ionicons name="hardware-chip" size={48} color={theme.primary} />;
        } else if (type.includes('bluetooth') || type.includes('ble')) {
            return <Ionicons name="bluetooth" size={48} color={theme.primary} />;
        }
        
        // Default icon
        return <Ionicons name="hardware-chip" size={48} color={theme.primary} />;
    };
    
    // Handle opening ShareWifi modal
    const openShareWifi = () => {
        setShareWifiVisible(true);
    };
    
    // Handle closing ShareWifi modal
    const closeShareWifi = () => {
        setShareWifiVisible(false);
    };
    
    // Handle successful WiFi configuration
    const handleWifiSuccess = () => {
        closeShareWifi();
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
            
            <View style={styles.header}>
                <TouchableOpacity 
                    style={styles.closeButton}
                    onPress={onClose}
                >
                    <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.text }]}>Device Details</Text>
            </View>
            
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={[styles.deviceHeader, { borderBottomColor: theme.border }]}>
                    <View style={styles.deviceIconContainer}>
                        {getDeviceTypeIcon()}
                    </View>
                    
                    <Text style={[styles.deviceName, { color: theme.text }]}>
                        {device.name}
                    </Text>
                    
                    <View style={[styles.statusBadge, { backgroundColor: getDeviceStatusColor() }]}>
                        <Text style={styles.statusText}>
                            {getDeviceStatusText()}
                        </Text>
                    </View>
                </View>
                
                <View style={styles.infoSection}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Information</Text>
                    
                    <View style={[styles.infoItem, { borderBottomColor: theme.border }]}>
                        <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Type</Text>
                        <Text style={[styles.infoValue, { color: theme.text }]}>{device.type}</Text>
                    </View>
                    
                    <View style={[styles.infoItem, { borderBottomColor: theme.border }]}>
                        <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Device ID</Text>
                        <Text style={[styles.infoValue, { color: theme.text }]}>{device.id}</Text>
                    </View>
                    
                    <View style={[styles.infoItem, { borderBottomColor: theme.border }]}>
                        <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Added On</Text>
                        <Text style={[styles.infoValue, { color: theme.text }]}>{formatDate(device.dateAdded)}</Text>
                    </View>
                    
                    <View style={[styles.infoItem, { borderBottomColor: theme.border }]}>
                        <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Last Used</Text>
                        <Text style={[styles.infoValue, { color: theme.text }]}>{formatDate(device.lastUsed)}</Text>
                    </View>
                </View>
                
                <View style={styles.actionSection}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Actions</Text>
                    
                    <View style={styles.actionButtons}>
                        <TouchableOpacity 
                            style={[styles.actionButton, { backgroundColor: theme.primary }]} 
                            onPress={onConnect}
                        >
                            <Ionicons name="bluetooth" size={24} color="#FFFFFF" />
                            <Text style={styles.actionButtonText}>Connect</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={[styles.actionButton, { backgroundColor: theme.secondary }]} 
                            onPress={onSync}
                        >
                            <Ionicons name="sync" size={24} color="#FFFFFF" />
                            <Text style={styles.actionButtonText}>Sync</Text>
                        </TouchableOpacity>
                    </View>
                    
                    <TouchableOpacity 
                        style={[styles.wifiButton, { backgroundColor: theme.accent || '#6200EE' }]} 
                        onPress={openShareWifi}
                    >
                        <Ionicons name="wifi" size={20} color="#FFFFFF" />
                        <Text style={styles.buttonText}>Share WiFi Credentials</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        style={[styles.removeButton, { borderColor: theme.error }]} 
                        onPress={onRemove}
                    >
                        <Ionicons name="trash-outline" size={20} color={theme.error} />
                        <Text style={[styles.removeButtonText, { color: theme.error }]}>Remove Device</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
            
            {/* ShareWifi Modal */}
            <Modal
                animationType="slide"
                transparent={false}
                visible={shareWifiVisible}
                onRequestClose={closeShareWifi}
            >
                <ShareWifi
                    device={device}
                    onClose={closeShareWifi}
                    onSuccess={handleWifiSuccess}
                />
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    closeButton: {
        marginRight: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
    },
    content: {
        flex: 1,
    },
    deviceHeader: {
        alignItems: 'center',
        paddingVertical: 24,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        marginBottom: 24,
    },
    deviceIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0,0,0,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    deviceName: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 8,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginBottom: 8,
    },
    statusText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    infoSection: {
        paddingHorizontal: 24,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    infoItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    infoLabel: {
        fontSize: 16,
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '500',
    },
    actionSection: {
        paddingHorizontal: 24,
        marginBottom: 40,
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
        flex: 0.48,
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    wifiButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        marginBottom: 16,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    removeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
        borderWidth: 1,
    },
    removeButtonText: {
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
}); 