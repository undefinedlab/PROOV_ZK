import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Image,
    Modal,
    ScrollView,
    StatusBar,
    Dimensions,
    Alert,
    Switch,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import ShareModal from './ShareModal';
import { Video, ResizeMode } from 'expo-av';

const { width, height } = Dimensions.get('window');

// Updated interface to match new ZK Capsule structure
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

interface SavedPhoto {
    id: string;
    timestamp: number;
    photoUri: string;
    metadata: {
        location?: {
            latitude: number;
            longitude: number;
            city?: string;
            country?: string;
            continent?: string;
        };
        deviceInfo: string;
        photoHash: string;
        ipfsCid?: string;
        isVideo?: boolean;
        duration?: number;
    };
    zkCapsule: {
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
    };
}

interface PhotoDetailsModalProps {
    visible: boolean;
    photo: SavedPhoto | null;
    onClose: () => void;
    onShare: () => void;
    onDelete: (id: string) => void;
    onUpdatePhoto?: (updatedPhoto: SavedPhoto) => void;
}

export default function PhotoDetailsModal({ 
    visible, 
    photo, 
    onClose, 
    onShare, 
    onDelete,
    onUpdatePhoto
}: PhotoDetailsModalProps) {
    const [imageViewerVisible, setImageViewerVisible] = useState(false);
    const [shareModalVisible, setShareModalVisible] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [revealedClaims, setRevealedClaims] = useState({
        time: false,
        location: false,
        device: false,
        authentic: false,
        image: false
    });
    const [updatedPhoto, setUpdatedPhoto] = useState<SavedPhoto | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedLevels, setSelectedLevels] = useState({
        time: 'month',
        location: 'country'
    });
    const videoRef = useRef(null);

    // Initialize revealed claims based on photo data when photo changes
    useEffect(() => {
        if (photo) {
            setRevealedClaims({
                time: photo.zkCapsule.public_claims.time_within_month === "true" || false,
                location: photo.zkCapsule.public_claims.location_in_region === "true" || false,
                device: photo.zkCapsule.public_claims.device_trusted === "true" || false,
                authentic: photo.zkCapsule.public_claims.photo_authentic === "true" || false,
                image: photo.zkCapsule.public_claims.image_content_revealed === "true" || false
            });
            setUpdatedPhoto(photo);
            
            // Initialize selected levels based on claims
            setSelectedLevels({
                time: photo.zkCapsule.public_claims.time_level || 'month',
                location: photo.zkCapsule.public_claims.location_level || 'country'
            });
        }
    }, [photo]);

    if (!photo) return null;

    const isVideo = photo.metadata.isVideo === true;
    
    const toggleEditMode = () => {
        setEditMode(!editMode);
        if (!editMode) {
            // Entering edit mode - keep track of current state
            setUpdatedPhoto({...photo});
        }
    };

    const toggleClaimReveal = (claimType: string) => {
        const newRevealedClaims = { ...revealedClaims };
        
        // Toggle the claim on/off instead of only turning on
        switch (claimType) {
            case 'time':
                newRevealedClaims.time = !newRevealedClaims.time;
                break;
            case 'location':
                newRevealedClaims.location = !newRevealedClaims.location;
                break;
            case 'device':
                newRevealedClaims.device = !newRevealedClaims.device;
                break;
            case 'authentic':
                newRevealedClaims.authentic = !newRevealedClaims.authentic;
                break;
            case 'image':
                newRevealedClaims.image = !newRevealedClaims.image;
                break;
        }
        
        setRevealedClaims(newRevealedClaims);
        
        // Update the updatedPhoto state with new public_inputs
        if (updatedPhoto) {
            const newPublicInputs = { ...updatedPhoto.zkCapsule.public_claims };
            
            if (claimType === 'time') {
                newPublicInputs.time_within_month = !revealedClaims.time ? "false" : "true";
            } else if (claimType === 'location') {
                newPublicInputs.location_in_region = !revealedClaims.location ? "false" : "true";
            } else if (claimType === 'device') {
                newPublicInputs.device_trusted = !revealedClaims.device ? "false" : "true";
            } else if (claimType === 'authentic') {
                newPublicInputs.photo_authentic = !revealedClaims.authentic ? "false" : "true";
            } else if (claimType === 'image') {
                newPublicInputs.image_content_revealed = !revealedClaims.image ? "false" : "true";
            }
            
            setUpdatedPhoto({
                ...updatedPhoto,
                zkCapsule: {
                    ...updatedPhoto.zkCapsule,
                    public_claims: newPublicInputs
                }
            });
        }
    };

    const updateClaimLevel = (claimType: string, level: string) => {
        setSelectedLevels(prev => ({
            ...prev,
            [claimType]: level
        }));
        
        // Update the claim text based on the selected level
        if (updatedPhoto && updatedPhoto.zkCapsule.public_claims) {
            const newClaims = { ...updatedPhoto.zkCapsule.public_claims };
            
            if (claimType === 'time') {
                switch (level) {
                    case 'exact':
                        newClaims.time_claim = `At ${new Date(photo.timestamp).toLocaleString()}`;
                        break;
                    case 'day':
                        newClaims.time_claim = `On ${new Date(photo.timestamp).toLocaleDateString()}`;
                        break;
                    case 'week':
                        const weekStart = new Date(photo.timestamp);
                        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                        newClaims.time_claim = `Week of ${weekStart.toLocaleDateString()}`;
                        break;
                    case 'month':
                        newClaims.time_claim = `In ${new Date(photo.timestamp).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
                        break;
                    case 'year':
                        newClaims.time_claim = `In ${new Date(photo.timestamp).getFullYear()}`;
                        break;
                }
            } else if (claimType === 'location' && photo.metadata.location) {
                switch (level) {
                    case 'exact':
                        newClaims.location_claim = `At ${photo.metadata.location.latitude.toFixed(6)}, ${photo.metadata.location.longitude.toFixed(6)}`;
                        break;
                    case 'city':
                        newClaims.location_claim = photo.metadata.location.city || 'In local city';
                        break;
                    case 'country':
                        newClaims.location_claim = photo.metadata.location.country || 'In authorized country';
                        break;
                    case 'continent':
                        newClaims.location_claim = photo.metadata.location.continent || 'In authorized continent';
                        break;
                }
            }
            
            setUpdatedPhoto({
                ...updatedPhoto,
                zkCapsule: {
                    ...updatedPhoto.zkCapsule,
                    public_claims: newClaims
                }
            });
        }
    };

    // Generate simple hash function for IDs
    const generateSimpleHash = (input: string): string => {
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    };

    // Generate new capsule with updated public claims
    const generateUpdatedCapsule = (photo: SavedPhoto, revealedClaims: any, selectedLevels: any): ZKCapsule => {
        // Clone the existing capsule to avoid mutations
        const existingCapsule = photo.zkCapsule;
        
        // Create the new public claims based on revealed settings
        const newPublicClaims = {...existingCapsule.public_claims};
        
        // Update based on revealedClaims
        newPublicClaims.time_within_month = revealedClaims.time ? "true" : "false";
        newPublicClaims.location_in_region = revealedClaims.location ? "true" : "false";
        newPublicClaims.device_trusted = revealedClaims.device ? "true" : "false";
        newPublicClaims.photo_authentic = revealedClaims.authentic ? "true" : "false";
        newPublicClaims.image_content_revealed = revealedClaims.image ? "true" : "false";
        
        // Add level information
        newPublicClaims.time_level = selectedLevels.time;
        newPublicClaims.location_level = selectedLevels.location;
        
        let originalProof;
        try {
            originalProof = photo.zkCapsule.proof;
        } catch (error) {
            // Fallback proof structure
            originalProof = {
                a: { x: "0", y: "0", z: "1" },
                b: { x: ["0", "0"], y: ["0", "0"], z: ["1", "0"] },
                c: { x: "0", y: "0", z: "1" },
                protocol: "groth16",
                curve: "bn128"
            };
        }
        
        const newCapsule: ZKCapsule = {
            capsule_id: existingCapsule.capsule_id,
            public_claims: newPublicClaims,
            proof: originalProof,
            metadata: {
                proof_scheme: existingCapsule.metadata.proof_scheme,
                circuit_version: existingCapsule.metadata.circuit_version,
                image_hash: existingCapsule.metadata.image_hash,
                verification_key: existingCapsule.metadata.verification_key,
                ipfsCid: existingCapsule.metadata.ipfsCid,
                ipfsUrl: existingCapsule.metadata.ipfsUrl,
                created_at: existingCapsule.metadata.created_at || Date.now()
            }
        };
        
        return newCapsule;
    };

    const saveChanges = async () => {
        if (!updatedPhoto) return;
        
        setIsSaving(true);
        
        try {
            // Generate new capsule with updated claims
            const newCapsule = generateUpdatedCapsule(photo, revealedClaims, selectedLevels);
            
            // Update the photo with new capsule and public inputs
            const newPublicInputs = { ...updatedPhoto.zkCapsule.public_claims };
            newPublicInputs.time_within_month = revealedClaims.time ? "true" : "false";
            newPublicInputs.location_in_region = revealedClaims.location ? "true" : "false";
            newPublicInputs.device_trusted = revealedClaims.device ? "true" : "false";
            newPublicInputs.photo_authentic = revealedClaims.authentic ? "true" : "false";
            newPublicInputs.image_content_revealed = revealedClaims.image ? "true" : "false";

            const updatedPhotoWithCapsule = {
                ...updatedPhoto,
                zkCapsule: {
                    ...updatedPhoto.zkCapsule,
                    public_claims: newPublicInputs,
                }
            };

            // Get all photos from storage
            const photosString = await AsyncStorage.getItem('@zk_verified_photos');
            if (!photosString) {
                throw new Error('No photos found in storage');
            }

            const allPhotos: SavedPhoto[] = JSON.parse(photosString);
            
            // Find and update the specific photo
            const photoIndex = allPhotos.findIndex(p => p.id === updatedPhoto.id);
            if (photoIndex === -1) {
                throw new Error('Photo not found in storage');
            }
            
            // Update the photo with new capsule
            allPhotos[photoIndex] = updatedPhotoWithCapsule;
            
            // Save back to storage
            await AsyncStorage.setItem('@zk_verified_photos', JSON.stringify(allPhotos));
            
            // Update local state
            setUpdatedPhoto(updatedPhotoWithCapsule);
            
            // Notify parent component about the update if callback exists
            if (onUpdatePhoto) {
                onUpdatePhoto(updatedPhotoWithCapsule);
            }
            
            Alert.alert('Success', 'Photo claims have been updated and new capsule generated successfully');
            setEditMode(false);
        } catch (error) {
            console.error('Error saving changes:', error);
            Alert.alert('Error', 'Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    const cancelChanges = () => {
        // Reset to original photo state
        setUpdatedPhoto(photo);
        setRevealedClaims({
            time: photo.zkCapsule.public_claims.time_within_month === "true" || false,
            location: photo.zkCapsule.public_claims.location_in_region === "true" || false,
            device: photo.zkCapsule.public_claims.device_trusted === "true" || false,
            authentic: photo.zkCapsule.public_claims.photo_authentic === "true" || false,
            image: photo.zkCapsule.public_claims.image_content_revealed === "true" || false
        });
                        setEditMode(false);
    };

    const getClaimDescription = (claimType: string): string => {
        const currentPhoto = updatedPhoto || photo;
        
        switch (claimType) {
            case 'time':
                return revealedClaims.time && currentPhoto.zkCapsule.public_claims.time_claim
                    ? currentPhoto.zkCapsule.public_claims.time_claim
                    : 'Private';
            case 'location':
                return revealedClaims.location && currentPhoto.zkCapsule.public_claims.location_claim
                    ? currentPhoto.zkCapsule.public_claims.location_claim
                    : 'Private';
            case 'device':
                return revealedClaims.device && currentPhoto.zkCapsule.public_claims.device_claim
                    ? currentPhoto.zkCapsule.public_claims.device_claim
                    : 'Private';
            case 'authentic':
                return revealedClaims.authentic && currentPhoto.zkCapsule.public_claims.authenticity_claim
                    ? currentPhoto.zkCapsule.public_claims.authenticity_claim
                    : 'Private';
            case 'image':
                return revealedClaims.image && currentPhoto.zkCapsule.public_claims.image_content_claim
                    ? currentPhoto.zkCapsule.public_claims.image_content_claim
                    : 'Private';
            default:
                return 'Private';
        }
    };

    // Handle sharing with the new ShareModal - Updated to use capsule
    const handleShare = () => {
        setShareModalVisible(true);
    };

    // Update copy functionality to copy capsule instead of old proof
    const handleCopyProof = async () => {
        try {
            const currentPhoto = updatedPhoto || photo;
            
            // Use zkCapsule directly - it is already our complete capsule
            let capsuleToShare = currentPhoto.zkCapsule;
            
            const capsuleString = JSON.stringify(capsuleToShare, null, 2);
            await Clipboard.setStringAsync(capsuleString);
            
            Alert.alert('Success', 'ZK Capsule copied to clipboard');
        } catch (error) {
            console.error('Error copying capsule:', error);
            Alert.alert('Error', 'Failed to copy capsule');
        }
    };

    // In the getShareableCapsule function
    const getShareableCapsule = (currentPhoto: SavedPhoto): any => {
        try {
            // Return the capsule directly
            return currentPhoto.zkCapsule;
        } catch (error) {
            console.error("Error preparing capsule for sharing:", error);
            return null;
        }
    };

    const generateQRCodeData = (currentPhoto: SavedPhoto): string => {
        try {
            let capsuleToShare: any;
            
            // Use the zkCapsule directly - it is already our proof structure
            capsuleToShare = currentPhoto.zkCapsule;
            
            // Convert to JSON string for QR code
            return JSON.stringify({
                capsule_id: capsuleToShare.capsule_id,
                public_claims: capsuleToShare.public_claims,
                // Don't include the full proof in the QR to keep it smaller
                has_proof: true,
                metadata: capsuleToShare.metadata
            });
        } catch (error) {
            console.error("Error generating QR code data:", error);
            return "";
        }
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalContainer}>
                <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
                    
                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <MaterialIcons name="arrow-back" size={22} color="#64748B" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>
                            {isVideo ? 'Video Details' : 'Photo Details'}
                        </Text>
                    <View style={{width: 40}}></View>
                    </View>

                <ScrollView 
                    style={styles.modalScrollContainer} 
                    contentContainerStyle={styles.modalContent}
                    showsVerticalScrollIndicator={false}
                    bounces={true}
                >
                    {/* Media - Clickable to open zoom viewer */}
                    <TouchableOpacity 
                        style={styles.photoSection}
                        onPress={() => setImageViewerVisible(true)}
                    >
                        {isVideo ? (
                            <View style={styles.imageViewerContent}>
                                <Video 
                                    source={{ uri: photo.photoUri }}
                                    style={styles.zoomableVideo}
                                    useNativeControls
                                    resizeMode={ResizeMode.CONTAIN}
                                    isLooping={false}
                                    shouldPlay={false}
                                    posterSource={{ uri: photo.photoUri }}
                                    usePoster={true}
                                />
                            </View>
                        ) : (
                            <ScrollView
                                contentContainerStyle={styles.imageViewerContent}
                                maximumZoomScale={3}
                                minimumZoomScale={1}
                                showsHorizontalScrollIndicator={false}
                                showsVerticalScrollIndicator={false}
                            >
                                <Image 
                                    source={{ uri: photo.photoUri }} 
                                    style={styles.zoomableImage}
                                    resizeMode="contain"
                                />
                            </ScrollView>
                        )}
                        <View style={styles.zoomHint}>
                            <Text style={styles.zoomHintText}>
                                {isVideo ? 'Tap to view full screen' : 'Tap to zoom'}
                            </Text>
                        </View>
                </TouchableOpacity>

                    {/* Action Buttons - Unified row with icons */}
                    <View style={styles.actionButtonsRow}>
                        <TouchableOpacity style={styles.actionIconButton} onPress={handleShare}>
                            <MaterialIcons name="share" size={24} color="#64748B" />
                            <Text style={styles.actionIconText}>Share</Text>
                    </TouchableOpacity>
                        <TouchableOpacity style={styles.actionIconButton} onPress={handleCopyProof}>
                            <MaterialIcons name="content-copy" size={24} color="#64748B" />
                            <Text style={styles.actionIconText}>Copy Capsule</Text>
                    </TouchableOpacity>
                        <TouchableOpacity style={styles.actionIconButton} onPress={() => onDelete(photo.id)}>
                            <MaterialIcons name="delete-outline" size={24} color="#EF4444" />
                            <Text style={[styles.actionIconText, {color: "#EF4444"}]}>Delete</Text>
                    </TouchableOpacity>
                </View>

                    {/* Privacy Claims Section */}
                    <View style={styles.privacySection}>
                    <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Privacy Claims</Text>
                            <TouchableOpacity onPress={toggleEditMode} style={styles.editButton}>
                                <MaterialIcons name={editMode ? "close" : "edit"} size={22} color="#64748B" />
                        </TouchableOpacity>
                    </View>

                    {/* Time Claim */}
                    <View style={styles.claimContainer}>
                        <View style={styles.claimToggleRow}>
                            <View style={styles.claimInfo}>
                                <View style={styles.claimIconContainer}>
                                    <MaterialCommunityIcons name="clock-outline" size={22} color="#64748B" />
                                </View>
                                <View style={styles.claimTextContainer}>
                                    <Text style={styles.claimTitle}>Time</Text>
                                    <Text style={styles.claimDescription}>
                                        {getClaimDescription('time')}
                                    </Text>
                                </View>
                            </View>
                            {editMode && (
                                <Switch
                                    value={revealedClaims.time}
                                        onValueChange={() => toggleClaimReveal('time')}
                                    trackColor={{ false: '#E2E8F0', true: 'rgba(100, 116, 139, 0.3)' }}
                                    thumbColor={revealedClaims.time ? '#FFFFFF' : '#F1F5F9'}
                                    ios_backgroundColor="#E2E8F0"
                                />
                            )}
                        </View>
                        
                            {editMode && revealedClaims.time && (
                            <View style={styles.levelBubbles}>
                                    {['year', 'month', 'week', 'day', 'exact'].map((level) => (
                                        <TouchableOpacity
                                            key={level}
                                            style={[
                                                styles.levelBubble, 
                                                selectedLevels.time === level && styles.levelBubbleActive
                                            ]}
                                            onPress={() => updateClaimLevel('time', level)}
                                        >
                                            <Text style={[
                                                styles.levelBubbleText, 
                                                selectedLevels.time === level && styles.levelBubbleTextActive
                                            ]}>
                                                {level}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                            </View>
                        )}
                    </View>
                    
                    {/* Location Claim */}
                    <View style={styles.claimContainer}>
                        <View style={styles.claimToggleRow}>
                            <View style={styles.claimInfo}>
                                <View style={styles.claimIconContainer}>
                                    <Ionicons name="location-outline" size={22} color="#64748B" />
                                </View>
                                <View style={styles.claimTextContainer}>
                                    <Text style={styles.claimTitle}>Location</Text>
                                    <Text style={styles.claimDescription}>
                                        {getClaimDescription('location')}
                                    </Text>
                                </View>
                            </View>
                            {editMode && (
                                <Switch
                                    value={revealedClaims.location}
                                        onValueChange={() => toggleClaimReveal('location')}
                                    trackColor={{ false: '#E2E8F0', true: 'rgba(100, 116, 139, 0.3)' }}
                                    thumbColor={revealedClaims.location ? '#FFFFFF' : '#F1F5F9'}
                                    ios_backgroundColor="#E2E8F0"
                                />
                            )}
                        </View>
                        
                            {editMode && revealedClaims.location && (
                            <View style={styles.levelBubbles}>
                                    {['continent', 'country', 'city', 'exact'].map((level) => (
                                        <TouchableOpacity
                                            key={level}
                                            style={[
                                                styles.levelBubble, 
                                                selectedLevels.location === level && styles.levelBubbleActive
                                            ]}
                                            onPress={() => updateClaimLevel('location', level)}
                                        >
                                            <Text style={[
                                                styles.levelBubbleText, 
                                                selectedLevels.location === level && styles.levelBubbleTextActive
                                            ]}>
                                                {level}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                            </View>
                        )}
                    </View>
                    
                    {/* Device Claim */}
                    <View style={styles.claimContainer}>
                        <View style={styles.claimToggleRow}>
                            <View style={styles.claimInfo}>
                                <View style={styles.claimIconContainer}>
                                    <MaterialIcons name="smartphone" size={22} color="#64748B" />
                                </View>
                                <View style={styles.claimTextContainer}>
                                    <Text style={styles.claimTitle}>Device</Text>
                                    <Text style={styles.claimDescription}>
                                        {getClaimDescription('device')}
                                    </Text>
                                </View>
                            </View>
                            {editMode && (
                                <Switch
                                    value={revealedClaims.device}
                                        onValueChange={() => toggleClaimReveal('device')}
                                    trackColor={{ false: '#E2E8F0', true: 'rgba(100, 116, 139, 0.3)' }}
                                    thumbColor={revealedClaims.device ? '#FFFFFF' : '#F1F5F9'}
                                    ios_backgroundColor="#E2E8F0"
                                />
                            )}
                        </View>
                    </View>
                    
                    {/* Authenticity Claim */}
                    <View style={styles.claimContainer}>
                        <View style={styles.claimToggleRow}>
                            <View style={styles.claimInfo}>
                                <View style={styles.claimIconContainer}>
                                    <MaterialIcons name="verified" size={22} color="#64748B" />
                                </View>
                                <View style={styles.claimTextContainer}>
                                    <Text style={styles.claimTitle}>Authenticity</Text>
                                    <Text style={styles.claimDescription}>
                                        {getClaimDescription('authentic')}
                                    </Text>
                                </View>
                            </View>
                            {editMode && (
                                <Switch
                                    value={revealedClaims.authentic}
                                        onValueChange={() => toggleClaimReveal('authentic')}
                                    trackColor={{ false: '#E2E8F0', true: 'rgba(100, 116, 139, 0.3)' }}
                                    thumbColor={revealedClaims.authentic ? '#FFFFFF' : '#F1F5F9'}
                                    ios_backgroundColor="#E2E8F0"
                                />
                            )}
                        </View>
                    </View>
                    
                    {/* Image Content Claim */}
                    <View style={styles.claimContainer}>
                        <View style={styles.claimToggleRow}>
                            <View style={styles.claimInfo}>
                                <View style={styles.claimIconContainer}>
                                    <MaterialIcons name="image" size={22} color="#64748B" />
                                </View>
                                <View style={styles.claimTextContainer}>
                                    <Text style={styles.claimTitle}>Image Content</Text>
                                    <Text style={styles.claimDescription}>
                                        {getClaimDescription('image')}
                                    </Text>
                                </View>
                            </View>
                            {editMode && (
                                <Switch
                                    value={revealedClaims.image}
                                        onValueChange={() => toggleClaimReveal('image')}
                                    trackColor={{ false: '#E2E8F0', true: 'rgba(100, 116, 139, 0.3)' }}
                                    thumbColor={revealedClaims.image ? '#FFFFFF' : '#F1F5F9'}
                                    ios_backgroundColor="#E2E8F0"
                                />
                            )}
                        </View>
                    </View>

                    {editMode && (
                            <TouchableOpacity 
                                style={[styles.saveButton, isSaving && styles.savingButton]} 
                                onPress={saveChanges}
                                disabled={isSaving}
                            >
                                <Text style={styles.saveButtonText}>
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Combined Details & Information */}
                    <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Details & Information</Text>
                    <View style={styles.combinedDetails}>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Type:</Text>
                            <Text style={styles.detailValue}>{isVideo ? 'Video' : 'Photo'}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Taken:</Text>
                            <Text style={styles.detailValue}>{new Date(photo.timestamp).toLocaleString()}</Text>
                        </View>
                        {isVideo && photo.metadata.duration && (
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Duration:</Text>
                                <Text style={styles.detailValue}>
                                    {Math.floor(photo.metadata.duration / 60)}m {Math.floor(photo.metadata.duration % 60)}s
                                </Text>
                            </View>
                        )}
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Device:</Text>
                            <Text style={styles.detailValue}>{photo.metadata.deviceInfo}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Hash:</Text>
                            <Text style={styles.detailValue}>{photo.metadata.photoHash}</Text>
                        </View>
                        {photo.metadata.location && (
                            <>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Region:</Text>
                                    <Text style={styles.detailValue}>
                                        {photo.metadata.location.country || photo.metadata.location.city || 'Unknown'}
                                    </Text>
                                </View>
                                    {revealedClaims.location && (
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Coordinates:</Text>
                                    <Text style={styles.detailValue}>
                                        {photo.metadata.location.latitude.toFixed(6)}, {photo.metadata.location.longitude.toFixed(6)}
                                    </Text>
                                </View>
                                    )}
                            </>
                        )}
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Verification Key:</Text>
                            <Text style={styles.detailValue}>{photo.zkCapsule.metadata.verification_key.substring(0, 20)}...</Text>
                    </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Image Hash:</Text>
                            <Text style={styles.detailValue}>{photo.zkCapsule.metadata.image_hash}</Text>
                            </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Proof Generated:</Text>
                            <Text style={styles.detailValue}>{new Date(photo.zkCapsule.metadata.created_at).toLocaleString()}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Circuit:</Text>
                            <Text style={styles.detailValue}>{photo.zkCapsule.metadata.proof_scheme} {photo.zkCapsule.metadata.circuit_version}</Text>
                        </View>
                            {revealedClaims.image && photo.zkCapsule.metadata.ipfsUrl && (
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>IPFS URL:</Text>
                                    <Text style={styles.detailValue} numberOfLines={1} ellipsizeMode="middle">
                                        {photo.zkCapsule.metadata.ipfsUrl}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Extra bottom spacing to ensure scrolling works */}
                    <View style={styles.bottomSpacing} />
                </ScrollView>

            {/* Zoomable Image/Video Viewer */}
            <Modal
                visible={imageViewerVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setImageViewerVisible(false)}
            >
                <View style={styles.imageViewerContainer}>
                    <TouchableOpacity 
                        style={styles.imageViewerClose}
                        onPress={() => setImageViewerVisible(false)}
                    >
                        <MaterialIcons name="close" size={22} color="#1E293B" />
                    </TouchableOpacity>
                    {isVideo ? (
                        <View style={styles.imageViewerContent}>
                            <Video 
                                source={{ uri: photo.photoUri }}
                                style={styles.zoomableVideo}
                                useNativeControls
                                resizeMode={ResizeMode.CONTAIN}
                                isLooping
                                shouldPlay
                            />
                        </View>
                    ) : (
                        <ScrollView
                            contentContainerStyle={styles.imageViewerContent}
                            maximumZoomScale={3}
                            minimumZoomScale={1}
                            showsHorizontalScrollIndicator={false}
                            showsVerticalScrollIndicator={false}
                        >
                            <Image 
                                source={{ uri: photo.photoUri }} 
                                style={styles.zoomableImage}
                                resizeMode="contain"
                            />
                        </ScrollView>
                    )}
                </View>
            </Modal>

            {/* Share Modal */}
            <ShareModal
                visible={shareModalVisible}
                photoUri={photo.photoUri}
                capsule={getShareableCapsule(updatedPhoto || photo)}
                onClose={() => setShareModalVisible(false)}
                isVideo={isVideo}
            />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: '#FAFBFC',
        width: '100%',
        maxWidth: width,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 32,
        backgroundColor: '#FAFBFC',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    modalTitle: {
        fontSize: 25,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.5,
    },
    editButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    modalScrollContainer: {
        flex: 1,
        width: '100%',
    },
    modalContent: {
        paddingBottom: 120,
        flexGrow: 1,
        width: '100%',
    },
    photoSection: {
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 20,
        position: 'relative',
        width: '100%',
    },
    imageViewerContent: {
        width: width - 40,
        height: 300,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.8)',
    },
    zoomHint: {
        position: 'absolute',
        bottom: 30,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: 8,
        borderRadius: 12,
        alignItems: 'center',
    },
    zoomHintText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '600',
    },
    // New unified action buttons row
    actionButtonsRow: {
        flexDirection: 'row',
        marginHorizontal: 20,
        marginBottom: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 20,
        padding: 14,
        justifyContent: 'space-around',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.4)',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        backdropFilter: 'blur(18px)',
    },
    actionIconButton: {
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 20,
    },
    actionIconText: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 6,
    },
    privacySection: {
        marginHorizontal: 20,
        marginVertical: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.35)',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.4)',
        width: width - 40,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.5,
        marginBottom: 25,
    },
    sectionDivider: {
        height: 1,
        backgroundColor: 'rgba(203, 213, 225, 0.3)',
        marginBottom: 16,
        marginTop: 8,
    },
    editModeHint: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '500',
    },
    claimContainer: {
        marginBottom: 16,
        width: '100%',
    },
    claimToggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    claimInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    claimIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    claimTextContainer: {
        flex: 1,
        alignItems: 'flex-start',
    },
    claimTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 2,
        textAlign: 'left',
        letterSpacing: -0.2,
    },
    claimDescription: {
        fontSize: 12,
        color: '#64748B',
        textAlign: 'left',
        fontWeight: '500',
    },
    saveButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 20,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    savingButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
    saveButtonText: {
        color: '#0F172A',
        fontSize: 16,
        fontWeight: '700',
    },
    detailSection: {
        marginHorizontal: 20,
        marginVertical: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.35)',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.4)',
        width: width - 40,
    },
    combinedDetails: {
        marginBottom: 12,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
        paddingVertical: 4,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(203, 213, 225, 0.3)',
    },
    detailLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B',
        fontFamily: 'monospace',
        width: '40%',
    },
    detailValue: {
        fontSize: 13,
        color: '#0F172A',
        fontWeight: '500',
        fontFamily: 'monospace',
        width: '60%',
        textAlign: 'right',
    },
    bottomSpacing: {
        height: 80,
    },
    imageViewerContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageViewerClose: {
        position: 'absolute',
        top: 60,
        right: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)',
    },
    zoomableImage: {
        width: '100%',
        height: '100%',
        borderRadius: 20,
    },
    levelBubbles: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
        marginLeft: 40,
        marginBottom: 8,
    },
    levelBubble: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: 'rgba(203, 213, 225, 0.5)',
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.35)',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
        minWidth: 60,
        alignItems: 'center',
    },
    levelBubbleActive: {
        backgroundColor: 'rgba(226, 232, 240, 0.6)',
        borderColor: 'rgba(148, 163, 184, 0.7)',
        shadowColor: '#0F172A',
        shadowOpacity: 0.06,
    },
    levelBubbleText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#64748B',
        textAlign: 'center',
        textTransform: 'capitalize',
    },
    levelBubbleTextActive: {
        color: '#1E293B',
        fontWeight: '700',
    },
    zoomableVideo: {
        width: '100%',
        height: '100%',
        borderRadius: 20,
    },
}); 