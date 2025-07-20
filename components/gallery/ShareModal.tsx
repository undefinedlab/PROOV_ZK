import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Image,
    Modal,
    StatusBar,
    Dimensions,
    Alert,
    ActivityIndicator,
    SafeAreaView,
    Switch,
    ScrollView,
    Platform,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import Marker, { Position, ImageFormat } from 'react-native-image-marker';
import { MaterialIcons } from '@expo/vector-icons';
import QRCode from 'react-qr-code';
import ViewShot from 'react-native-view-shot';
import { Video, ResizeMode } from 'expo-av';
import { uploadJSONToIPFS, getIPFSUrl } from '../../modules/ipfs';

const { width, height } = Dimensions.get('window');

interface ZKCapsule {
    capsule_id: string;
    public_claims: Record<string, string>;
    proof: any;
    metadata: {
        proof_scheme: string;
        circuit_version: string;
        image_hash: string;
        verification_key: string;
        ipfsCid?: string;
        ipfsUrl?: string;
        created_at: number;
    };
}

interface ShareModalProps {
    visible: boolean;
    photoUri: string;
    capsule?: ZKCapsule;
    onClose: () => void;
    isVideo?: boolean;
}

export default function ShareModal({
    visible,
    photoUri,
    capsule,
    onClose,
    isVideo = false
}: ShareModalProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [qrCodeData, setQrCodeData] = useState<string>('');
    const [showQRCode, setShowQRCode] = useState(true);
    const [capsuleCID, setCapsuleCID] = useState<string>('');
    const [isUploadingCapsule, setIsUploadingCapsule] = useState(false);
    const combinedViewRef = useRef<ViewShot>(null);
    const qrOnlyViewRef = useRef<ViewShot>(null);

    // Upload capsule to IPFS and generate QR code data when modal opens
    useEffect(() => {
        if (visible && capsule) {
            uploadCapsuleToIPFS();
        } else {
            setQrCodeData('');
            setCapsuleCID('');
        }
    }, [visible, capsule]);

    const uploadCapsuleToIPFS = async () => {
        if (!capsule) return;
        
        setIsUploadingCapsule(true);
        try {
            console.log('Uploading ZK Capsule to IPFS...');
            
            // Upload the capsule to IPFS
            const cid = await uploadJSONToIPFS(capsule, {
                name: `ZK Capsule ${capsule.capsule_id}`,
                capsule_id: capsule.capsule_id,
                created_at: capsule.metadata.created_at
            });
            
            setCapsuleCID(cid);
            
            // Create QR code data with just the IPFS URL
            // When scanned, this will directly return the raw capsule data
            const ipfsUrl = getIPFSUrl(cid);
            setQrCodeData(ipfsUrl);
            
            console.log('QR Code Data (IPFS URL):', ipfsUrl);
            console.log('QR Code Data Size:', ipfsUrl.length, 'bytes');
            console.log('Original capsule size:', JSON.stringify(capsule).length, 'bytes');
            console.log('Size reduction:', Math.round((1 - ipfsUrl.length / JSON.stringify(capsule).length) * 100), '%');
        } catch (error) {
            console.error('Error uploading capsule to IPFS:', error);
            Alert.alert('Upload Error', 'Failed to upload capsule to IPFS. QR code will contain full capsule data.');
            
            // Fallback to full capsule data if IPFS upload fails
            const fallbackData = JSON.stringify(capsule, null, 2);
            setQrCodeData(fallbackData);
        } finally {
            setIsUploadingCapsule(false);
        }
    };

    const createCombinedImageWithMarker = async () => {
        try {
            console.log('Creating combined image using react-native-image-marker...');
            
            if (!qrCodeData || !qrOnlyViewRef.current?.capture) {
                throw new Error('QR code data or ref not available');
            }

            // First capture the QR code
            const qrCodeImageUri = await qrOnlyViewRef.current.capture();
            console.log('QR code captured:', qrCodeImageUri);

            if (!qrCodeImageUri) {
                throw new Error('Failed to capture QR code');
            }

            // Create combined image using react-native-image-marker
            const result = await Marker.markImage({
                backgroundImage: {
                    src: photoUri,
                    scale: 1
                },
                watermarkImages: [{
                    src: qrCodeImageUri,
                    scale: 0.3, // Adjust size as needed
                    position: {
                        position: Position.bottomRight
                    }
                }],
                quality: 90,
                saveFormat: ImageFormat.jpg
            });

            console.log('Combined image created with marker:', result);
            return result;
        } catch (error) {
            console.error('Error creating combined image with marker:', error);
            return null;
        }
    };

    const shareMedia = async () => {
        if (!photoUri) {
            Alert.alert('Error', `No ${isVideo ? 'video' : 'image'} available to share`);
            return;
        }

        setIsGenerating(true);
        try {
            // For videos, just share the video directly without QR code overlay
            if (isVideo) {
                const isAvailable = await Sharing.isAvailableAsync();
                if (isAvailable) {
                    console.log('Starting video share...');
                    await Sharing.shareAsync(photoUri, {
                        mimeType: 'video/mp4',
                        dialogTitle: 'Share ZK Verified Video',
                    });
                    console.log('Video share completed successfully');
                } else {
                    Alert.alert('Sharing not available', 'Sharing is not supported on this device');
                }
                setIsGenerating(false);
                return;
            }

            // For images, continue with existing image sharing logic
            let imageToShare: string;

            if (showQRCode && qrCodeData) {
                console.log('Attempting to capture combined image with QR code...');
                
                // Give ViewShot a moment to properly render
                await new Promise(resolve => setTimeout(resolve, 500));
                
                let capturedUri: string | null = null;
                
                // Try ViewShot first
                if (combinedViewRef.current?.capture) {
                    try {
                        capturedUri = await combinedViewRef.current.capture();
                        console.log('ViewShot capture result:', capturedUri);
                    } catch (viewShotError) {
                        console.log('ViewShot capture failed:', viewShotError);
                    }
                }
                
                // If ViewShot failed, try react-native-image-marker
                if (!capturedUri) {
                    console.log('ViewShot failed, trying react-native-image-marker...');
                    capturedUri = await createCombinedImageWithMarker();
                }
                
                if (!capturedUri) {
                    console.log('All capture methods failed, using original image');
                    imageToShare = photoUri;
                } else {
                    // Ensure the captured image has the correct file:// prefix
                    imageToShare = capturedUri.startsWith('file://') ? capturedUri : `file://${capturedUri}`;
                    console.log('Using captured image:', imageToShare);
                    
                    // Verify the captured file exists
                    try {
                        const fileInfo = await FileSystem.getInfoAsync(imageToShare);
                        if (!fileInfo.exists) {
                            console.log('Captured file does not exist, falling back to original');
                            imageToShare = photoUri;
                        } else {
                            console.log('Captured file verified, size:', fileInfo.size, 'bytes');
                        }
                    } catch (fileCheckError) {
                        console.log('Error checking file, falling back to original:', fileCheckError);
                        imageToShare = photoUri;
                    }
                }
            } else {
                // Share original image only
                console.log('Using original image for sharing');
                imageToShare = photoUri;
            }

            // Ensure the share image has correct file:// prefix
            if (!imageToShare.startsWith('file://')) {
                imageToShare = `file://${imageToShare}`;
            }

            console.log('Final image path for sharing:', imageToShare);

            // Check if sharing is available
            const isAvailable = await Sharing.isAvailableAsync();
            console.log('Sharing available:', isAvailable);
            
            if (isAvailable) {
                console.log('Starting share...');
                await Sharing.shareAsync(imageToShare, {
                    mimeType: 'image/jpeg',
                    dialogTitle: 'Share ZK Verified Photo',
                });
                console.log('Share completed successfully');
            } else {
                Alert.alert('Sharing not available', 'Sharing is not supported on this device');
            }
        } catch (error: any) {
            console.error(`Error sharing ${isVideo ? 'video' : 'photo'}:`, error);
            console.error('Error details:', error.message, error.stack);
            Alert.alert('Error', `Failed to share ${isVideo ? 'video' : 'photo'}: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const saveToGallery = async () => {
        if (!photoUri) {
            Alert.alert('Error', 'No image available to save');
            return;
        }

        setIsGenerating(true);
        try {
            // Request permissions
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please grant permission to save photos to your gallery.');
                setIsGenerating(false);
                return;
            }

            let imageToSave: string;

            if (showQRCode && qrCodeData && combinedViewRef.current?.capture) {
                console.log('Attempting to capture combined image for saving...');
                
                // Capture combined image with QR code
                const capturedUri = await combinedViewRef.current.capture();
                console.log('Save capture result:', capturedUri);
                
                if (!capturedUri) {
                    console.log('ViewShot capture failed, using original image');
                    imageToSave = photoUri;
                } else {
                    // Ensure the captured image has the correct file:// prefix
                    imageToSave = capturedUri.startsWith('file://') ? capturedUri : `file://${capturedUri}`;
                    console.log('Using captured image for save:', imageToSave);
                    
                    // Verify the captured file exists
                    const fileInfo = await FileSystem.getInfoAsync(imageToSave);
                    if (!fileInfo.exists) {
                        console.log('Captured file does not exist, falling back to original');
                        imageToSave = photoUri;
                    } else {
                        console.log('Captured file verified for save, size:', fileInfo.size, 'bytes');
                    }
                }
            } else {
                // Save original image only
                console.log('Using original image for saving');
                imageToSave = photoUri;
            }

            // Ensure the save image has correct file:// prefix
            if (!imageToSave.startsWith('file://')) {
                imageToSave = `file://${imageToSave}`;
            }

            console.log('Final image path for saving:', imageToSave);

            // Save to media library
            const asset = await MediaLibrary.createAssetAsync(imageToSave);
            await MediaLibrary.createAlbumAsync('ZK Photos', asset, false);

            Alert.alert('Success!', `${showQRCode ? 'Combined image with QR code' : 'Original photo'} saved to your gallery in "ZK Photos" album`);
        } catch (error: any) {
            console.error('Error saving to gallery:', error);
            console.error('Save error details:', error.message, error.stack);
            Alert.alert('Error', `Failed to save photo to gallery: ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const downloadQRCode = async () => {
        if (!qrCodeData || !qrOnlyViewRef.current?.capture) {
            Alert.alert('Error', 'QR code not available');
            return;
        }

        setIsGenerating(true);
        try {
            // Request permissions
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Please grant permission to save QR code to your gallery.');
                setIsGenerating(false);
                return;
            }

            // Capture QR code only
            const qrCodeImage = await qrOnlyViewRef.current.capture();
            
            // Save to media library
            const asset = await MediaLibrary.createAssetAsync(qrCodeImage);
            await MediaLibrary.createAlbumAsync('ZK Photos', asset, false);

            Alert.alert('Success!', 'QR code saved to your gallery in "ZK Photos" album');
        } catch (error: any) {
            console.error('Error saving QR code:', error);
            Alert.alert('Error', 'Failed to save QR code');
        } finally {
            setIsGenerating(false);
        }
    };

    const CombinedImageView = () => (
        <ViewShot
            ref={combinedViewRef}
            options={{ 
                format: 'jpg', 
                quality: 0.9,
                result: 'tmpfile',
                width: undefined,
                height: undefined,
            }}
            style={styles.combinedCaptureContainer}
        >
            <View style={styles.combinedImageLayout}>
                {/* Main Image */}
                <View style={styles.mainImageContainer}>
                    <Image 
                        source={{ uri: photoUri }} 
                        style={styles.mainImage}
                        resizeMode="contain"
                    />
                </View>
                
                {/* QR Code Overlay */}
                {showQRCode && qrCodeData && (
                    <View style={styles.qrCodeOverlay}>
                        <View style={styles.qrCodeContainer}>
                            <QRCode
                                value={qrCodeData}
                                size={110}
                                bgColor="#FFFFFF"
                                fgColor="#000000"
                                level="M"
                                title="ZK Proof QR Code"
                            />
                        </View>
                    </View>
                )}
            </View>
        </ViewShot>
    );

    const QRCodeOnlyView = () => (
        <ViewShot
            ref={qrOnlyViewRef}
            options={{ 
                format: 'png', 
                quality: 1.0,
                result: 'tmpfile'
            }}
            style={styles.qrOnlyContainer}
        >
            <View style={styles.qrOnlyLayout}>
                <QRCode
                    value={qrCodeData || 'placeholder'}
                    size={280}
                    bgColor="#FFFFFF"
                    fgColor="#000000"
                    level="M"
                    title="ZK Proof QR Code"
                />
            </View>
        </ViewShot>
    );

    return (
        <Modal
            visible={visible}
            transparent={false}
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
                
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <MaterialIcons name="close" size={24} color="#64748B" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Share Photo</Text>
                    <View style={styles.placeholder} />
                </View>
                
                <ScrollView 
                    style={styles.content} 
                    showsVerticalScrollIndicator={false}
                    bounces={true}
                    contentContainerStyle={styles.scrollContent}
                >
                    {/* Preview */}
                    <View style={styles.previewSection}>
                        <View style={styles.previewContainer}>
                            {isVideo ? (
                                <Video
                                    source={{ uri: photoUri }}
                                    style={styles.mediaPreview}
                                    useNativeControls
                                    resizeMode={ResizeMode.CONTAIN}
                                    shouldPlay={false}
                                />
                            ) : (
                                <Image
                                    source={{ uri: photoUri }}
                                    style={styles.mediaPreview}
                                    resizeMode="cover"
                                />
                            )}
                        </View>
                    </View>

                    {/* IPFS Upload Status */}
                    {isUploadingCapsule && (
                        <View style={styles.uploadStatusSection}>
                            <View style={styles.uploadStatusContainer}>
                                <ActivityIndicator size="small" color="#3B82F6" />
                                <Text style={styles.uploadStatusText}>Uploading capsule to IPFS...</Text>
                            </View>
                        </View>
                    )}

                    {/* IPFS Info */}
                    {capsuleCID && (
                        <View style={styles.ipfsInfoSection}>
                            <View style={styles.ipfsInfoContainer}>
                                <MaterialIcons name="cloud-done" size={20} color="#10B981" />
                                <View style={styles.ipfsInfoText}>
                                    <Text style={styles.ipfsInfoTitle}>Capsule stored on IPFS</Text>
                                    <Text style={styles.ipfsInfoSubtitle}>CID: {capsuleCID.substring(0, 20)}...</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* QR Code Toggle */}
                    <View style={styles.toggleSection}>
                        <View style={styles.toggleRow}>
                            <View style={styles.toggleInfo}>
                                <Text style={styles.toggleTitle}>Include ZK Proof QR Code</Text>
                                <Text style={styles.toggleDescription}>
                                    {showQRCode 
                                        ? capsuleCID 
                                            ? "QR code contains IPFS link to cryptographic proof"
                                            : "QR code contains cryptographic proof for verification"
                                        : "Share photo only, without verification code"}
                                </Text>
                            </View>
                            <Switch
                                value={showQRCode}
                                onValueChange={setShowQRCode}
                                trackColor={{ false: '#E2E8F0', true: '#93C5FD' }}
                                thumbColor={showQRCode ? '#3B82F6' : '#FFFFFF'}
                                ios_backgroundColor="#E2E8F0"
                                disabled={isUploadingCapsule}
                            />
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionsSection}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.shareButton, (isGenerating || isUploadingCapsule) && styles.disabledButton]}
                            onPress={shareMedia}
                            disabled={isGenerating || isUploadingCapsule}
                        >
                            {isGenerating ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <>
                                    <MaterialIcons name="share" size={24} color="#FFFFFF" />
                                    <Text style={styles.shareButtonText}>
                                        Share {isVideo ? 'Video' : 'Image'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            style={[styles.actionButton, styles.saveButton, (isGenerating || isUploadingCapsule) && styles.disabledButton]}
                            onPress={saveToGallery}
                            disabled={isGenerating || isUploadingCapsule}
                        >
                            {isGenerating ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <MaterialIcons name="save" size={20} color="#FFFFFF" />
                            )}
                            <Text style={styles.saveButtonText}>
                                Save {showQRCode ? 'with QR Code' : 'Photo Only'}
                            </Text>
                        </TouchableOpacity>

                        {showQRCode && qrCodeData && (
                            <TouchableOpacity 
                                style={[styles.actionButton, styles.qrButton, (isGenerating || isUploadingCapsule) && styles.disabledButton]}
                                onPress={downloadQRCode}
                                disabled={isGenerating || isUploadingCapsule}
                            >
                                {isGenerating ? (
                                    <ActivityIndicator size="small" color="#1E293B" />
                                ) : (
                                    <MaterialIcons name="qr-code" size={20} color="#1E293B" />
                                )}
                                <Text style={styles.qrButtonText}>Save QR Code Only</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </ScrollView>

                {/* Hidden views for capture */}
                <View style={styles.hiddenContainer}>
                    <CombinedImageView />
                    <QRCodeOnlyView />
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1E293B',
    },
    placeholder: {
        width: 40,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    previewSection: {
        marginBottom: 20,
        marginTop: 16,
    },
    previewContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 12,
        padding: 8,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    mediaPreview: {
        width: '100%',
        height: 200,
        borderRadius: 8,
    },
    combinedCaptureContainer: {
        backgroundColor: 'transparent',
    },
    combinedImageLayout: {
        position: 'relative',
        width: '100%',
        height: 300,
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        overflow: 'hidden',
    },
    mainImageContainer: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    mainImage: {
        width: '100%',
        height: '100%',
    },
    qrCodeOverlay: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        alignItems: 'center',
    },
    qrCodeContainer: {
        backgroundColor: '#FFFFFF',
        padding: 4,
        borderRadius: 4,
    },
    toggleSection: {
        marginBottom: 20,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    toggleInfo: {
        flex: 1,
        marginRight: 16,
    },
    toggleTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 4,
    },
    toggleDescription: {
        fontSize: 14,
        color: '#64748B',
        lineHeight: 20,
    },
    actionsSection: {
        gap: 12,
        marginBottom: 20,
    },
    actionButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        gap: 8,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    shareButton: {
        backgroundColor: '#3B82F6',
    },
    shareButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: '#10B981',
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    qrButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    qrButtonText: {
        color: '#1E293B',
        fontSize: 16,
        fontWeight: '600',
    },
    hiddenContainer: {
        position: 'absolute',
        top: -10000,
        left: -10000,
        opacity: 0,
    },
    qrOnlyContainer: {
        backgroundColor: 'transparent',
    },
    qrOnlyLayout: {
        backgroundColor: '#FFFFFF',
        padding: 40,
        alignItems: 'center',
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    disabledButton: {
        opacity: 0.6,
    },
    uploadStatusSection: {
        marginBottom: 16,
    },
    uploadStatusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.2)',
    },
    uploadStatusText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#3B82F6',
        fontWeight: '600',
    },
    ipfsInfoSection: {
        marginBottom: 16,
    },
    ipfsInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.2)',
    },
    ipfsInfoText: {
        marginLeft: 8,
        flex: 1,
    },
    ipfsInfoTitle: {
        fontSize: 14,
        color: '#10B981',
        fontWeight: '600',
    },
    ipfsInfoSubtitle: {
        fontSize: 12,
        color: '#059669',
        marginTop: 2,
        fontFamily: 'monospace',
    },
}); 