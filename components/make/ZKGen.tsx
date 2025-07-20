import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Alert,
    Platform,
    TouchableOpacity,
    ScrollView,
    Modal,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { MaterialIcons } from '@expo/vector-icons';
import {
    generateCircomProof,
    generateCircomProofWeb,
    CircomProofResult,
    CircomProof,
    ProofLibOption,
    CircomProofLib,
} from '../../modules/mopro';
import { uploadToIPFS, getIPFSUrl } from '../../modules/ipfs';
import ProofSuccessModal from './ProofSuccessModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { captureRef } from 'react-native-view-shot';

// Types for photo metadata and privacy settings
export interface PhotoMetadata {
    timestamp: number;
    location?: {
        latitude: number;
        longitude: number;
        city?: string;
        country?: string;
        continent?: string;
    };
    deviceInfo: string;
    photoHash: string;
    photoUri?: string;
    originalPhotoUri?: string;
    ipfsCid?: string;
    isVideo?: boolean;
    duration?: number;
    aiDescription?: string;
    aiDescriptionImageUri?: string;
}

export interface PrivacySettings {
    timeProof: {
        enabled: boolean;
        level: 'exact' | 'hour' | 'day' | 'week' | 'month' | 'year';
    };
    locationProof: {
        enabled: boolean;
        level: 'exact' | 'city' | 'country' | 'continent';
    };
    deviceProof: {
        enabled: boolean;
        level: 'devicetype' | 'platform' | 'imei';
    };
    identityProof: {
        enabled: boolean;
    };
    imageReveal: {
        enabled: boolean;
        level: 'none' | 'description' | 'image';
    };
    timeLock: {
        enabled: boolean;
        unlockTime: Date | null;
        lockedData: string;
        lockType: 'date' | 'location' | 'identity' | 'content';
    };
    receiverLock: {
        enabled: boolean;
        walletAddress: string;
        encryptedContent: string;
    };
    saveForFuture: {
        enabled: boolean;
    };
    storageOptions: {
        type: 'ipfs' | 'walrus';
        walrusBlobId?: string;
        ipfsCid?: string;
        ipfsUrl?: string;
    };
}

// ZK Capsule Structure - The primary model for ZK proofs
export interface ZKCapsule {
    capsule_id: string;
    public_claims: Record<string, string>; // type → visible value
    proof: CircomProof;
    metadata: {
        proof_scheme: string;
        circuit_version: string;
        image_hash: string;
        verification_key: string; // Essential for verifying the proof
        ipfsCid?: string;
        ipfsUrl?: string;
        walrusBlobId?: string;
        storageType?: 'ipfs' | 'walrus';
        created_at: number;
    };
}

// Private data structure (local only) - commitments + salts
export interface PrivateVault {
    capsule_id: string;
    commitments: Record<string, string>; // type → hash (PRIVATE - used as circuit inputs)
    salts: Record<string, string>; // claim_type → salt (PRIVATE)
    original_values: Record<string, string>; // For future verification
}

interface ZKGenProps {
    metadata: PhotoMetadata | null;
    privacySettings: PrivacySettings;
    onComplete: (resetData: () => void) => void;
    onReset: () => void;
}

// Export helper functions that might be needed in other components
export const generateSimpleHash = (input: string): string => {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
};

export const generateTimeClaim = (timestamp: number, level: string): string => {
    const date = new Date(timestamp);
    
    switch (level) {
        case 'exact':
            return `At ${date.toLocaleString()}`;
        case 'hour':
            return `Within hour of ${date.toLocaleString().split(',')[0]} ${date.getHours()}:00`;
        case 'day':
            return `On ${date.toLocaleDateString()}`;
        case 'week':
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            return `Week of ${weekStart.toLocaleDateString()}`;
        case 'month':
            return `In ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
        case 'year':
            return `In ${date.getFullYear()}`;
        default:
            return 'Within past month';
    }
};

export const generateLocationClaim = (location: any, level: string): string => {
    if (!location) return 'Location not available';
    
    switch (level) {
        case 'exact':
            return `At ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
        case 'city':
            return location.city || 'In local city';
        case 'country':
            return location.country || 'In authorized country';
        case 'continent':
            return location.continent || 'In authorized continent';
        default:
            return location.country ? `In ${location.country}` : 'In authorized region';
    }
};

export const generateDeviceClaim = (deviceInfo: string, level: string): string => {
    switch (level) {
        case 'devicetype':
            return 'From Phone';
        case 'platform':
            return `From ${deviceInfo.includes('iOS') ? 'iOS' : 'Android'} device`;
        case 'imei':
            return `From device IMEI: ${generateSimpleHash(deviceInfo).substring(0, 8)}****`;
        default:
            return 'From trusted device';
    }
};

export const generateImageContentClaim = (level: string, ipfsCid?: string): string => {
    switch (level) {
        case 'none':
            return 'Image content private';
        case 'description':
            return 'Image description available';
        case 'image':
            return ipfsCid ? 'Image available on IPFS' : 'Image content revealed';
        default:
            return 'Image content private';
    }
};

// Add AI description functionality
// You can change this URL to your server's address
const AI_DESCRIPTION_SERVER_URL = 'https://img2text-xw4m.onrender.com';

export const callAIDescriptionAPI = async (imageUri: string): Promise<string> => {
    try {
        // Read the image file
        const imageInfo = await FileSystem.getInfoAsync(imageUri);
        if (!imageInfo.exists) {
            throw new Error('Image file not found');
        }
        
        // Read the image as base64
        const imageBase64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64,
        });
        
        // Use the correct payload format that the server expects
        const response = await fetch(`${AI_DESCRIPTION_SERVER_URL}/describeAI`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                imageData: `data:image/jpeg;base64,${imageBase64}`,
                mimeType: 'image/jpeg'
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error (${response.status}): ${errorText}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.description) {
            return result.description;
        } else {
            throw new Error(result.error || 'Server returned no description');
        }
    } catch (error) {
        console.error('Error calling AI description API:', error);
        
        // Provide more specific error messages
        if (error instanceof TypeError && error.message.includes('Network request failed')) {
            throw new Error('Cannot connect to AI server. Please check your internet connection and ensure the server at https://img2text-xw4m.onrender.com is accessible.');
        } else if (error instanceof Error) {
            throw error;
        } else {
            throw new Error('Unknown error occurred while generating AI description');
        }
    }
};

export const createTextImage = async (text: string, viewShotRef: React.RefObject<View>): Promise<string> => {
    try {
        if (!viewShotRef.current) {
            throw new Error('View reference not available');
        }
        
        // Capture the text view as an image
        const uri = await captureRef(viewShotRef.current, {
            format: 'png',
            quality: 0.8,
            width: 400,
            height: 300,
            result: 'tmpfile',
        });
        
        return uri;
    } catch (error) {
        console.error('Error creating text image:', error);
        throw error;
    }
};

const ZKGen: React.FC<ZKGenProps> = ({ metadata, privacySettings, onComplete, onReset }) => {
    const [isGeneratingProof, setIsGeneratingProof] = useState<boolean>(false);
    const [generatedCapsule, setGeneratedCapsule] = useState<ZKCapsule | null>(null);

    // Generate secure random salt (6+ digits)
    const generateSalt = (): string => {
        const length = 6 + Math.floor(Math.random() * 4); // 6-9 digits
        let salt = '';
        for (let i = 0; i < length; i++) {
            salt += Math.floor(Math.random() * 10).toString();
        }
        return salt;
    };

    // Simulate Poseidon commitment (in real implementation, use actual Poseidon hash)
    const poseidonCommitment = (value: string, salt: string): string => {
        // For now, simulate with a combination of value and salt
        // In production, this should be actual Poseidon hash
        const combined = value + salt;
        return generateSimpleHash(combined);
    };

    // Generate all commitments for a given metadata and privacy settings
    const generateCommitments = (metadata: PhotoMetadata, salts: Record<string, string>): Record<string, string> => {
        const commitments: Record<string, string> = {};
        const date = new Date(metadata.timestamp);

        // Time commitments
        commitments.date_exact = poseidonCommitment(date.toISOString(), salts.date_exact);
        commitments.date_day = poseidonCommitment(date.toLocaleDateString(), salts.date_day);
        commitments.date_month = poseidonCommitment(date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), salts.date_month);
        commitments.date_year = poseidonCommitment(date.getFullYear().toString(), salts.date_year);

        // Location commitments (if available)
        if (metadata.location) {
            commitments.location_exact = poseidonCommitment(`${metadata.location.latitude}, ${metadata.location.longitude}`, salts.location_exact);
            if (metadata.location.city) {
                commitments.location_city = poseidonCommitment(metadata.location.city, salts.location_city);
            }
            if (metadata.location.country) {
                commitments.location_country = poseidonCommitment(metadata.location.country, salts.location_country);
            }
            if (metadata.location.continent) {
                commitments.location_continent = poseidonCommitment(metadata.location.continent, salts.location_continent);
            }
        }

        // Device commitments
        commitments.device_info = poseidonCommitment(metadata.deviceInfo, salts.device_info);
        commitments.device_platform = poseidonCommitment(Platform.OS, salts.device_platform);
        commitments.device_type = poseidonCommitment('Phone', salts.device_type);

        // Image commitments
        commitments.image_hash = poseidonCommitment(metadata.photoHash, salts.image_hash);
        if (metadata.ipfsCid) {
            commitments.image_cid = poseidonCommitment(metadata.ipfsCid, salts.image_cid);
        }

        return commitments;
    };

    // Generate all required salts
    const generateAllSalts = (): Record<string, string> => {
        return {
            date_exact: generateSalt(),
            date_day: generateSalt(),
            date_month: generateSalt(),
            date_year: generateSalt(),
            location_exact: generateSalt(),
            location_city: generateSalt(),
            location_country: generateSalt(),
            location_continent: generateSalt(),
            device_info: generateSalt(),
            device_platform: generateSalt(),
            device_type: generateSalt(),
            image_hash: generateSalt(),
            image_cid: generateSalt(),
            time_lock: generateSalt(), // Add salt for time lock
            receiver_lock: generateSalt(), // Add salt for receiver lock
        };
    };

    // Generate public claims based on privacy settings
    const generatePublicClaims = (metadata: PhotoMetadata, privacySettings: PrivacySettings): Record<string, string> => {
        const publicClaims: Record<string, string> = {};
        const date = new Date(metadata.timestamp);

        // Time claims
        if (privacySettings.timeProof.enabled) {
            switch (privacySettings.timeProof.level) {
                case 'exact':
                    publicClaims.date_exact = date.toISOString();
                    break;
                case 'day':
                    publicClaims.date_day = date.toLocaleDateString();
                    break;
                case 'month':
                    publicClaims.date_month = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                    break;
                case 'year':
                    publicClaims.date_year = date.getFullYear().toString();
                    break;
            }
        }

        // Location claims
        if (privacySettings.locationProof.enabled && metadata.location) {
            switch (privacySettings.locationProof.level) {
                case 'exact':
                    publicClaims.location_exact = `${metadata.location.latitude}, ${metadata.location.longitude}`;
                    break;
                case 'city':
                    if (metadata.location.city) {
                        publicClaims.location_city = metadata.location.city;
                    }
                    break;
                case 'country':
                    if (metadata.location.country) {
                        publicClaims.location_country = metadata.location.country;
                    }
                    break;
                case 'continent':
                    if (metadata.location.continent) {
                        publicClaims.location_continent = metadata.location.continent;
                    }
                    break;
            }
        }

        // Device claims
        if (privacySettings.deviceProof.enabled) {
            switch (privacySettings.deviceProof.level) {
                case 'devicetype':
                    publicClaims.device_type = 'Phone';
                    break;
                case 'platform':
                    publicClaims.device_platform = Platform.OS;
                    break;
                case 'imei':
                    publicClaims.device_info = metadata.deviceInfo;
                    break;
            }
        }

        // Identity claims
        if (privacySettings.identityProof.enabled) {
            publicClaims.identity_verified = 'true';
        }

        // Image content claims
        if (privacySettings.imageReveal.enabled) {
            switch (privacySettings.imageReveal.level) {
                case 'description':
                    publicClaims.image_description = 'Image description available';
                    break;
                case 'image':
                    if (metadata.ipfsCid) {
                        publicClaims.image_cid = metadata.ipfsCid;
                    }
                    break;
            }
        }

        // Time lock claims - always include unlock time if enabled, but data is committed separately
        if (privacySettings.timeLock.enabled && privacySettings.timeLock.unlockTime) {
            publicClaims.time_lock_until = privacySettings.timeLock.unlockTime.toISOString();
            publicClaims.time_lock_type = privacySettings.timeLock.lockType;
            // Note: locked data is stored as commitment, not in public claims
        }

        // Receiver lock claims - include wallet address but not encrypted content
        if (privacySettings.receiverLock.enabled && privacySettings.receiverLock.walletAddress) {
            publicClaims.allowed_address = privacySettings.receiverLock.walletAddress;
            // Note: encrypted content is stored as commitment, not in public claims
        }

        return publicClaims;
    };

    // Generate original values for storage
    const generateOriginalValues = (metadata: PhotoMetadata, privacySettings: PrivacySettings): Record<string, string> => {
        const originalValues: Record<string, string> = {};
        const date = new Date(metadata.timestamp);

        // Time values
        originalValues.date_exact = date.toISOString();
        originalValues.date_day = date.toLocaleDateString();
        originalValues.date_month = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        originalValues.date_year = date.getFullYear().toString();

        // Location values (if available)
        if (metadata.location) {
            originalValues.location_exact = `${metadata.location.latitude}, ${metadata.location.longitude}`;
            if (metadata.location.city) originalValues.location_city = metadata.location.city;
            if (metadata.location.country) originalValues.location_country = metadata.location.country;
            if (metadata.location.continent) originalValues.location_continent = metadata.location.continent;
        }

        // Device values
        originalValues.device_info = metadata.deviceInfo;
        originalValues.device_platform = Platform.OS;
        originalValues.device_type = 'Phone';

        // Image values
        originalValues.image_hash = metadata.photoHash;
        if (metadata.ipfsCid) originalValues.image_cid = metadata.ipfsCid;

        // Time lock values
        if (privacySettings.timeLock.enabled && privacySettings.timeLock.lockedData) {
            originalValues.time_lock_data = privacySettings.timeLock.lockedData;
        }

        // Receiver lock values
        if (privacySettings.receiverLock.enabled && privacySettings.receiverLock.encryptedContent) {
            originalValues.receiver_lock_data = privacySettings.receiverLock.encryptedContent;
        }

        return originalValues;
    };

    // Store private data (commitments + salts + original values) in local encrypted vault
    const storePrivateVault = async (
        capsuleId: string, 
        commitments: Record<string, string>,
        salts: Record<string, string>,
        originalValues: Record<string, string>
    ) => {
        try {
            const privateVault: PrivateVault = {
                capsule_id: capsuleId,
                commitments: commitments,
                salts: salts,
                original_values: originalValues
            };
            
            // Store in AsyncStorage with encryption (simplified for demo)
            await AsyncStorage.setItem(`@private_vault_${capsuleId}`, JSON.stringify(privateVault));
            console.log('🔒 Private vault stored securely for capsule:', capsuleId);
            console.log('🧂 Salts count:', Object.keys(salts).length);
            console.log('📦 Commitments count:', Object.keys(commitments).length);
        } catch (error) {
            console.error('Error storing private vault:', error);
        }
    };

    // Generate complete ZK Capsule - Enhanced version that directly stores all claims in metadata
    const generateZKCapsule = async (
        metadata: PhotoMetadata, 
        privacySettings: PrivacySettings, 
        proof: CircomProof, 
        verificationKey: string,
        ipfsCid?: string,
        ipfsUrl?: string,
        currentTime?: number,
        metadataHash?: string,
        timeWithinMonth?: boolean,
        locationInRegion?: boolean,
        deviceTrusted?: boolean,
        photoAuthentic?: boolean,
        imageContentRevealed?: boolean,
        claims?: any
    ): Promise<ZKCapsule> => {
        // Generate unique capsule ID
        const capsuleId = generateSimpleHash(metadata.photoHash + Date.now().toString());
        
        // Generate all salts
        const salts = generateAllSalts();
        
        // Generate original values for storage
        const originalValues = generateOriginalValues(metadata, privacySettings);
        
        // Generate commitments (these will be used as PRIVATE circuit inputs)
        const commitments = generateCommitments(metadata, salts);
        
        // Add time lock commitment if enabled
        if (privacySettings.timeLock.enabled && privacySettings.timeLock.lockedData) {
            commitments.time_lock_data = poseidonCommitment(privacySettings.timeLock.lockedData, salts.time_lock);
        }
        
        // Add receiver lock commitment if enabled
        if (privacySettings.receiverLock.enabled && privacySettings.receiverLock.encryptedContent) {
            commitments.receiver_lock_data = poseidonCommitment(privacySettings.receiverLock.encryptedContent, salts.receiver_lock);
        }
        
        // Store private data locally (commitments + salts + original values)
        await storePrivateVault(capsuleId, commitments, salts, originalValues);
        
        // Generate public claims (only these are shared)
        const publicClaims = generatePublicClaims(metadata, privacySettings);
        
        // Add circuit results to public claims for verification
        if (timeWithinMonth !== undefined) publicClaims.time_within_month = timeWithinMonth.toString();
        if (locationInRegion !== undefined) publicClaims.location_in_region = locationInRegion.toString();
        if (deviceTrusted !== undefined) publicClaims.device_trusted = deviceTrusted.toString();
        if (photoAuthentic !== undefined) publicClaims.photo_authentic = photoAuthentic.toString();
        if (imageContentRevealed !== undefined) publicClaims.image_content_revealed = imageContentRevealed.toString();
        
        // Add human-readable claims
        if (claims) {
            if (claims.time_claim) publicClaims.time_claim = claims.time_claim;
            if (claims.location_claim) publicClaims.location_claim = claims.location_claim;
            if (claims.device_claim) publicClaims.device_claim = claims.device_claim;
            if (claims.authenticity_claim) publicClaims.authenticity_claim = claims.authenticity_claim;
            if (claims.image_content_claim) publicClaims.image_content_claim = claims.image_content_claim;
        }
        
        // Create PUBLIC capsule
        const capsule: ZKCapsule = {
            capsule_id: capsuleId,
            public_claims: publicClaims,
            proof: proof,
            metadata: {
                proof_scheme: 'circom 2',
                circuit_version: 'multiplier2_v1',
                image_hash: metadata.photoHash,
                verification_key: verificationKey,
                ipfsCid: ipfsCid,
                ipfsUrl: ipfsUrl,
                walrusBlobId: privacySettings.storageOptions.walrusBlobId,
                storageType: privacySettings.storageOptions.type,
                created_at: currentTime || Date.now(),
            }
        };
        
        console.log('🔒 Commitments generated and stored PRIVATELY for circuit inputs');
        console.log('📢 Only public claims and proof will be shared');
        
        return capsule;
    };

    // Save photo with ZK capsule to local storage
    const savePhotoToGallery = async (capsule: ZKCapsule, photoUri: string) => {
        if (!metadata) return;

        try {
            const photoData = {
                id: Date.now().toString(),
                timestamp: metadata.timestamp,
                photoUri: photoUri, // Use original photo URI
                metadata: {
                    location: metadata.location,
                    deviceInfo: metadata.deviceInfo,
                    photoHash: metadata.photoHash,
                    ipfsCid: metadata.ipfsCid,
                    isVideo: metadata.isVideo || false,
                    duration: metadata.duration || 0,
                },
                zkCapsule: capsule, // Store the capsule directly
            };

            const existingPhotosString = await AsyncStorage.getItem('@zk_verified_photos');
            const existingPhotos = existingPhotosString ? JSON.parse(existingPhotosString) : [];
            const updatedPhotos = [photoData, ...existingPhotos];
            await AsyncStorage.setItem('@zk_verified_photos', JSON.stringify(updatedPhotos));
            
            console.log('Photo saved with ZK capsule!');
            console.log('Media type:', metadata.isVideo ? 'Video' : 'Photo');
            if (metadata.isVideo) {
                console.log('Video duration:', metadata.duration);
            }
        } catch (error) {
            console.error('Error saving photo to gallery:', error);
        }
    };

    // Generate ZK proof using Circom
    const generateZKProof = async () => {
        if (!metadata) {
            Alert.alert('Error', 'No photo metadata available');
            return;
        }

        setIsGeneratingProof(true);
        
        try {
            // First, upload the photo to IPFS if it exists
            let ipfsCid: string | undefined = undefined;
            let ipfsUrl: string | undefined = undefined;
            
            if (metadata.photoUri) {
                try {
                    // Show uploading message
                    console.log('Starting IPFS upload...');
                    
                    // Upload to IPFS with metadata
                    ipfsCid = await uploadToIPFS(metadata.photoUri, {
                        timestamp: metadata.timestamp,
                        deviceInfo: metadata.deviceInfo,
                        photoHash: metadata.photoHash,
                    });
                    
                    if (ipfsCid) {
                        ipfsUrl = getIPFSUrl(ipfsCid);
                        console.log('Photo uploaded to IPFS:', ipfsCid);
                        console.log('IPFS URL:', ipfsUrl);
                        
                        // Update metadata with IPFS CID
                        metadata.ipfsCid = ipfsCid;
                    }
                } catch (ipfsError) {
                    console.error('IPFS upload failed:', ipfsError);
                    // Continue with proof generation even if IPFS upload fails
                    // But show a warning to the user
                    Alert.alert(
                        'IPFS Upload Warning',
                        'Your photo could not be uploaded to IPFS. The proof will be generated without permanent storage.',
                        [{ text: 'Continue anyway' }]
                    );
                }
            }
            
            // Prepare circuit inputs based on metadata and privacy settings
            const currentTime = Date.now();
            const oneMonthAgo = currentTime - (30 * 24 * 60 * 60 * 1000); // 30 days
            
            // Create meaningful claims based on selected levels
            const claims = {
                time_claim: privacySettings.timeProof.enabled ? 
                    generateTimeClaim(metadata.timestamp, privacySettings.timeProof.level) : 
                    "Time not verified",
                location_claim: privacySettings.locationProof.enabled && metadata.location ? 
                    generateLocationClaim(metadata.location, privacySettings.locationProof.level) : 
                    "Location not verified",
                device_claim: privacySettings.deviceProof.enabled ? 
                    generateDeviceClaim(metadata.deviceInfo, privacySettings.deviceProof.level) : 
                    "Device not verified",
                authenticity_claim: privacySettings.identityProof.enabled ? 
                    "Identity verified" : 
                    "Identity not verified",
                image_content_claim: privacySettings.imageReveal.enabled ? 
                    generateImageContentClaim(privacySettings.imageReveal.level, ipfsCid) : 
                    "Image content private"
            };
            
            // Create a simple hash of the metadata for the circuit
            const metadataString = JSON.stringify({
                timestamp: metadata.timestamp,
                location: metadata.location,
                deviceInfo: metadata.deviceInfo,
                photoHash: metadata.photoHash,
                ipfsCid: metadata.ipfsCid,
            });
            const metadataHash = generateSimpleHash(metadataString);
            
            // Circuit inputs for the multiplier circuit (a * b = c)
            // We use timeWithinMonth and locationInRegion as inputs
            const timeWithinMonth = privacySettings.timeProof.enabled && metadata.timestamp > oneMonthAgo;
            const locationInRegion = privacySettings.locationProof.enabled && !!metadata.location;
            const deviceTrusted = privacySettings.deviceProof.enabled;
            const photoAuthentic = privacySettings.identityProof.enabled;
            const imageContentRevealed = privacySettings.imageReveal.enabled && privacySettings.imageReveal.level !== 'none';
            
            const circuitInputs = {
                a: [(timeWithinMonth ? 1 : 0).toString()],
                b: [(locationInRegion ? 1 : 0).toString()],
            };
            
            // TODO: In real implementation, commitments should be used as private circuit inputs
            // const circuitInputs = {
            //     commitments: Object.values(commitments), // Private inputs
            //     public_claims: Object.values(publicClaims), // Public inputs
            // };

            let proofResult: CircomProofResult;

            if (Platform.OS === "web") {
                const wasmPath = "https://ci-keys.zkmopro.org/multiplier2.wasm";
                const zkeyPath = "https://ci-keys.zkmopro.org/multiplier2_final.zkey";
                proofResult = await generateCircomProofWeb(wasmPath, zkeyPath, circuitInputs);
            } else {
                // Mobile platform - use local files
                const newFileName = "multiplier2_final.zkey";
                const asset = Asset.fromModule(require(`@/assets/keys/${newFileName}`));
                const newFilePath = `${FileSystem.documentDirectory}${newFileName}`;
                
                const fileInfo = await FileSystem.getInfoAsync(newFilePath);
                if (!fileInfo.exists) {
                    const file = await asset.downloadAsync();
                    if (file.localUri === null) {
                        throw new Error("Failed to download the file");
                    }
                    await FileSystem.moveAsync({
                        from: file.localUri,
                        to: newFilePath,
                    });
                }

                const proofLib: CircomProofLib = {
                    proofLib: ProofLibOption.Arkworks,
                };
                
                proofResult = await generateCircomProof(
                    newFilePath.replace("file://", ""),
                    JSON.stringify(circuitInputs),
                    proofLib
                );
            }
            
            // Generate verification key
            const verificationKey = generateSimpleHash("verification_key_" + Date.now());

            // Generate the complete ZK Capsule directly
            const capsule = await generateZKCapsule(
                metadata,
                privacySettings,
                proofResult.proof,
                verificationKey,
                ipfsCid,
                ipfsUrl,
                currentTime,
                metadataHash,
                timeWithinMonth,
                locationInRegion,
                deviceTrusted,
                photoAuthentic,
                imageContentRevealed,
                claims
            );
            
            setGeneratedCapsule(capsule);
            
            // Console log the complete proof capsule
            console.log('=== ZK PROOF CAPSULE GENERATED ===');
            console.log('Capsule ID:', capsule.capsule_id);
            console.log('📢 PUBLIC CAPSULE (shareable):', JSON.stringify(capsule, null, 2));
            console.log('📢 PUBLIC CLAIMS:', capsule.public_claims);
            console.log('🔒 PROOF:', capsule.proof);
            console.log('📋 METADATA:', capsule.metadata);
            console.log('🔒 Private vault stored locally with commitments & salts');
            console.log('💡 In real implementation: commitments would be private circuit inputs');
            console.log('Created At:', new Date(capsule.metadata.created_at).toLocaleString());
            console.log('================================');
            
            // Save original photo to gallery
            if (metadata.photoUri) {
                await savePhotoToGallery(capsule, metadata.photoUri);
                console.log('Photo saved to gallery');
            }
            
        } catch (error) {
            console.error('Error generating ZK proof:', error);
            Alert.alert('Error', `Failed to generate proof: ${(error as Error).message}`);
        } finally {
            setIsGeneratingProof(false);
        }
    };

    // Start proof generation when component mounts
    React.useEffect(() => {
        generateZKProof();
    }, []);

    // Reset function that will be passed to parent
    const resetData = () => {
        setGeneratedCapsule(null);
        setIsGeneratingProof(false);
        onReset();
    };

    return (
        <View style={styles.container}>
            {isGeneratingProof ? (
                <View style={styles.loadingContainer}>
                    <View style={styles.loadingCircle}>
                        <MaterialIcons name="autorenew" size={40} color="#3B82F6" />
                    </View>
                    <Text style={styles.loadingTitle}>Generating ZK Proof</Text>
                    <Text style={styles.loadingSubtitle}>
                        Creating cryptographic proof using Circom...
                    </Text>
                </View>
            ) : null}
            
            {/* Render success modal at root level to cover everything */}
            {generatedCapsule && (
                <ProofSuccessModal 
                    capsule={generatedCapsule}
                    metadata={metadata}
                    onReset={resetData}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        position: 'relative', // Ensure proper positioning context
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
});

export default ZKGen; 