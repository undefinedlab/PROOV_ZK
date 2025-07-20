import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    TextInput,
    Alert,
    Dimensions,
    Image,
    Linking,
    ActivityIndicator,
    Modal,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { BarCodeScanner } from 'expo-barcode-scanner';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FallingPhrases from '../../components/verify/FallingPhrases';
import { useLocalSearchParams } from 'expo-router';

// Import phrases from JSON file
const phrasesData = require('../../assets/phrases.json');

const { width, height } = Dimensions.get('window');

// Updated to match new ZK Capsule structure
interface ZKCapsule {
    capsule_id: string;
    public_claims: Record<string, string>; // type → visible value
    proof: {
        a: any;
        b: any;
        c: any;
        protocol: string;
        curve: string;
    };
    metadata: {
        proof_scheme: string;
        circuit_version: string;
        image_hash: string;
        verification_key: string;
    };
}

// Private data structure (local only) - commitments + salts
interface PrivateVault {
    capsule_id: string;
    commitments: Record<string, string>; // type → hash (PRIVATE - used as circuit inputs)
    salts: Record<string, string>; // claim_type → salt (PRIVATE)
    original_values: Record<string, string>; // For future verification
}

// Offer interface
interface Offer {
    id: string;
    capsule_id: string;
    data_type: string;
    data_label: string;
    amount: number;
    currency: string;
    timestamp: number;
    status: 'pending' | 'accepted' | 'rejected';
    offerer_address?: string;
}

// Time lock state interface
interface TimeLockState {
    isLocked: boolean;
    unlockTime: Date | null;
    lockedData: string | null;
    currentTime: Date | null;
    timeRemaining: number; // milliseconds
}

// Wallet lock state interface
interface WalletLockState {
    isLocked: boolean;
    allowedAddress: string | null;
    connectedWallet: string | null;
    encryptedContent: string | null;
    decryptedContent: string | null;
    isConnecting: boolean;
}

export default function VerifyScreen() {
    const params = useLocalSearchParams();
    const [proofData, setProofData] = useState('');
    const [verificationResult, setVerificationResult] = useState<null | 'valid' | 'invalid'>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [parsedCapsule, setParsedCapsule] = useState<ZKCapsule | null>(null);
    const [showResultsModal, setShowResultsModal] = useState(false);
    const [isLoadingImage, setIsLoadingImage] = useState(false);
    const [imageError, setImageError] = useState<string | null>(null);
    const [showFallingPhrases, setShowFallingPhrases] = useState(true);
    const [timeLockState, setTimeLockState] = useState<TimeLockState>({
        isLocked: false,
        unlockTime: null,
        lockedData: null,
        currentTime: null,
        timeRemaining: 0,
    });
    const [walletLockState, setWalletLockState] = useState<WalletLockState>({
        isLocked: false,
        allowedAddress: null,
        connectedWallet: null,
        encryptedContent: null,
        decryptedContent: null,
        isConnecting: false,
    });
    const [isLoadingTime, setIsLoadingTime] = useState(false);
    
    // QR Scanner states
    const [showScanner, setShowScanner] = useState(false);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [scanned, setScanned] = useState(false);

    // Add a state for displaying truncated proof data
    const [displayProofData, setDisplayProofData] = useState('');

    // Reference for the verify button to measure its position
    const [verifyButtonYPosition, setVerifyButtonYPosition] = useState(300);

    // Offers states
    const [offers, setOffers] = useState<Offer[]>([]);
    const [showOfferModal, setShowOfferModal] = useState(false);
    const [selectedDataType, setSelectedDataType] = useState<string>('');
    const [offerAmount, setOfferAmount] = useState('');
    const [offerCurrency, setOfferCurrency] = useState('USDT');
    const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);

    // Check if we should open the scanner on mount or when params change
    useEffect(() => {
        if (params.openScanner === 'true') {
            openScanner();
        }
    }, [params.openScanner]);

    // Get camera permissions when component mounts
    useEffect(() => {
        getCameraPermissions();
    }, []);

    // Load offers for a specific capsule
    const loadOffers = async (capsuleId: string) => {
        try {
            const offersData = await AsyncStorage.getItem(`@offers_${capsuleId}`);
            if (offersData) {
                const savedOffers: Offer[] = JSON.parse(offersData);
                setOffers(savedOffers);
                console.log('Loaded offers for capsule:', capsuleId, savedOffers);
            }
        } catch (error) {
            console.error('Error loading offers:', error);
        }
    };

    // Save offers to storage
    const saveOffers = async (capsuleId: string, offersToSave: Offer[]) => {
        try {
            await AsyncStorage.setItem(`@offers_${capsuleId}`, JSON.stringify(offersToSave));
            console.log('Saved offers for capsule:', capsuleId);
        } catch (error) {
            console.error('Error saving offers:', error);
        }
    };

    // Get available private data types that can be offered on
    const getAvailablePrivateDataTypes = (capsule: ZKCapsule): { type: string; label: string; description: string }[] => {
        const privateDataTypes: { type: string; label: string; description: string }[] = [];
        
        // Check what's NOT revealed in public claims
        const publicClaims = capsule.public_claims;
        
        // Time data
        if (!publicClaims.date_exact && !publicClaims.date_day && !publicClaims.date_month && !publicClaims.date_year) {
            privateDataTypes.push({
                type: 'time_data',
                label: 'Exact Time',
                description: 'When this photo was taken (exact timestamp)'
            });
        }
        
        // Location data
        if (!publicClaims.location_exact && !publicClaims.location_city && !publicClaims.location_country) {
            privateDataTypes.push({
                type: 'location_data',
                label: 'Exact Location',
                description: 'GPS coordinates where this photo was taken'
            });
        }
        
        // Device data
        if (!publicClaims.device_type && !publicClaims.device_platform && !publicClaims.device_info) {
            privateDataTypes.push({
                type: 'device_data',
                label: 'Device Details',
                description: 'Detailed information about the device used'
            });
        }
        
        // Image content
        if (!publicClaims.image_cid && !publicClaims.image_description) {
            privateDataTypes.push({
                type: 'image_content',
                label: 'Image Content',
                description: 'The actual image or detailed description'
            });
        }
        
        // Identity data
        if (!publicClaims.identity_verified) {
            privateDataTypes.push({
                type: 'identity_data',
                label: 'Identity Info',
                description: 'Information about who took this photo'
            });
        }
        
        // Check for time-locked data
        if (timeLockState.isLocked) {
            privateDataTypes.push({
                type: 'time_locked_data',
                label: 'Time-Locked Secret',
                description: 'Secret data that will unlock at a specific time'
            });
        }
        
        // Check for wallet-locked data
        if (walletLockState.isLocked) {
            privateDataTypes.push({
                type: 'wallet_locked_data',
                label: 'Wallet-Locked Content',
                description: 'Content encrypted for a specific wallet address'
            });
        }
        
        return privateDataTypes;
    };

    // Create a new offer
    const createOffer = async () => {
        if (!parsedCapsule || !selectedDataType || !offerAmount) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }

        const amount = parseFloat(offerAmount);
        if (isNaN(amount) || amount <= 0) {
            Alert.alert('Error', 'Please enter a valid amount');
            return;
        }

        setIsSubmittingOffer(true);

        try {
            const availableTypes = getAvailablePrivateDataTypes(parsedCapsule);
            const selectedType = availableTypes.find(t => t.type === selectedDataType);
            
            if (!selectedType) {
                Alert.alert('Error', 'Selected data type is not available');
                return;
            }

            const newOffer: Offer = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                capsule_id: parsedCapsule.capsule_id,
                data_type: selectedDataType,
                data_label: selectedType.label,
                amount: amount,
                currency: offerCurrency,
                timestamp: Date.now(),
                status: 'pending',
                offerer_address: `0x${Math.random().toString(16).substr(2, 40)}` // Simulated wallet address
            };

            const updatedOffers = [...offers, newOffer];
            setOffers(updatedOffers);
            await saveOffers(parsedCapsule.capsule_id, updatedOffers);

            // Reset form
            setSelectedDataType('');
            setOfferAmount('');
            setShowOfferModal(false);

            Alert.alert('Success!', `Your offer of ${amount} ${offerCurrency} for ${selectedType.label} has been submitted!`);
        } catch (error) {
            console.error('Error creating offer:', error);
            Alert.alert('Error', 'Failed to create offer');
        } finally {
            setIsSubmittingOffer(false);
        }
    };

    // Load offers when capsule is parsed
    useEffect(() => {
        if (parsedCapsule) {
            loadOffers(parsedCapsule.capsule_id);
        }
    }, [parsedCapsule]);

    // Update timer every second when locked
    useEffect(() => {
        let interval: NodeJS.Timeout | undefined;
        
        if (timeLockState.isLocked && timeLockState.unlockTime && timeLockState.currentTime) {
            interval = setInterval(() => {
                const now = new Date();
                const remaining = timeLockState.unlockTime!.getTime() - now.getTime();
                
                if (remaining <= 0) {
                    // Time to unlock!
                    setTimeLockState(prev => ({ ...prev, isLocked: false, timeRemaining: 0 }));
                    // Refresh the verification to show unlocked data
                    if (parsedCapsule) {
                        checkTimeLockStatus(parsedCapsule);
                    }
                } else {
                    setTimeLockState(prev => ({ ...prev, timeRemaining: remaining, currentTime: now }));
                }
            }, 1000) as unknown as NodeJS.Timeout;
        }
        
        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [timeLockState.isLocked, timeLockState.unlockTime, parsedCapsule]);

    // Fetch global internet time
    const fetchGlobalTime = async (): Promise<Date> => {
        try {
            setIsLoadingTime(true);
            
            // Try multiple time services for reliability
            const timeAPIs = [
                'https://worldtimeapi.org/api/timezone/Etc/UTC',
                'https://api.ipgeolocation.io/timezone?apiKey=free',
                'http://worldclockapi.com/api/json/utc/now'
            ];
            
            for (const api of timeAPIs) {
                try {
                    const response = await fetch(api, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                        },
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        let timeString: string;
                        
                        if (data.datetime) {
                            timeString = data.datetime; // WorldTimeAPI format
                        } else if (data.date_time) {
                            timeString = data.date_time; // IP Geolocation format
                        } else if (data.currentDateTime) {
                            timeString = data.currentDateTime; // WorldClockAPI format
                        } else {
                            throw new Error('Unknown time format');
                        }
                        
                        const globalTime = new Date(timeString);
                        console.log(`Global time fetched from ${api}:`, globalTime.toISOString());
                        return globalTime;
                    }
                } catch (apiError) {
                    console.log(`Failed to fetch time from ${api}:`, apiError);
                    continue;
                }
            }
            
            // Fallback to device time with warning
            console.warn('All time APIs failed, falling back to device time');
            Alert.alert(
                'Time Sync Warning',
                'Could not verify with global time servers. Using device time as fallback.',
                [{ text: 'OK' }]
            );
            return new Date();
            
        } catch (error) {
            console.error('Error fetching global time:', error);
            // Fallback to device time
            return new Date();
        } finally {
            setIsLoadingTime(false);
        }
    };

    // Load private vault data for time-locked content
    const loadPrivateVault = async (capsuleId: string): Promise<PrivateVault | null> => {
        try {
            const vaultData = await AsyncStorage.getItem(`@private_vault_${capsuleId}`);
            if (vaultData) {
                return JSON.parse(vaultData) as PrivateVault;
            }
        } catch (error) {
            console.error('Error loading private vault:', error);
        }
        return null;
    };

    // Check time lock status for a capsule
    const checkTimeLockStatus = async (capsule: ZKCapsule) => {
        // Check if capsule has time lock
        if (capsule.public_claims.time_lock_until) {
            const unlockTime = new Date(capsule.public_claims.time_lock_until);
            const currentTime = await fetchGlobalTime();
            const isLocked = currentTime < unlockTime;
            const timeRemaining = isLocked ? unlockTime.getTime() - currentTime.getTime() : 0;
            
            let lockedData: string | null = null;
            
            if (!isLocked) {
                // Time to reveal the locked data - load from private vault
                const privateVault = await loadPrivateVault(capsule.capsule_id);
                if (privateVault && privateVault.original_values.time_lock_data) {
                    lockedData = privateVault.original_values.time_lock_data;
                    console.log('🔓 Time lock unlocked! Revealing data:', lockedData);
                } else {
                    console.log('⚠️ No private vault found for unlocked time lock');
                }
            }
            
            setTimeLockState({
                isLocked,
                unlockTime,
                lockedData,
                currentTime,
                timeRemaining,
            });
            
            console.log('🕐 Time lock status:', {
                isLocked,
                unlockTime: unlockTime.toISOString(),
                currentTime: currentTime.toISOString(),
                timeRemainingHours: timeRemaining / (1000 * 60 * 60),
                hasLockedData: !!lockedData,
            });
        } else {
            // No time lock
            setTimeLockState({
                isLocked: false,
                unlockTime: null,
                lockedData: null,
                currentTime: null,
                timeRemaining: 0,
            });
        }
    };

    // Check wallet lock status for a capsule
    const checkWalletLockStatus = async (capsule: ZKCapsule) => {
        if (capsule.public_claims.allowed_address) {
            const allowedAddress: string = capsule.public_claims.allowed_address;
            
            // Load private vault to get encrypted content
            const privateVault = await loadPrivateVault(capsule.capsule_id);
            let encryptedContent: string | null = null;
            let decryptedContent: string | null = null;
            
            if (privateVault && privateVault.original_values.receiver_lock_data) {
                encryptedContent = privateVault.original_values.receiver_lock_data;
                console.log('🔐 Found wallet-locked content for address:', allowedAddress);
            }
            
            // In a real implementation, you would check if user's wallet is connected
            // and if it matches the allowed address, then decrypt the content
            // For demo purposes, we'll simulate this
            const connectedWallet: string | null = null; // This would come from actual wallet connection
            let isLocked = true;
            if (connectedWallet !== null) {
                // Fix the type error with type assertion
                isLocked = (connectedWallet as string).toLowerCase() !== allowedAddress.toLowerCase();
            }
            
            if (!isLocked && encryptedContent) {
                // In real implementation, this would be actual decryption with the wallet's private key
                decryptedContent = encryptedContent; // Simulated decryption
                console.log('🔓 Wallet match! Content decrypted:', decryptedContent);
            }
            
            setWalletLockState({
                isLocked,
                allowedAddress,
                connectedWallet,
                encryptedContent,
                decryptedContent,
                isConnecting: false,
            });
            
            console.log('👛 Wallet lock status:', {
                isLocked,
                allowedAddress,
                connectedWallet,
                hasEncryptedContent: !!encryptedContent,
                hasDecryptedContent: !!decryptedContent,
            });
        } else {
            // No wallet lock
            setWalletLockState({
                isLocked: false,
                allowedAddress: null,
                connectedWallet: null,
                encryptedContent: null,
                decryptedContent: null,
                isConnecting: false,
            });
        }
    };

    // Simulate wallet connection
    const connectWallet = async () => {
        if (!walletLockState.allowedAddress) return;
        
        setWalletLockState(prev => ({ ...prev, isConnecting: true }));
        
        try {
            // Simulate wallet connection delay
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // For demo, let's simulate different scenarios
            const userChoice = await new Promise<string>((resolve) => {
                Alert.alert(
                    'Wallet Connection Simulation',
                    'Choose a scenario for testing:',
                    [
                        { text: 'Correct Wallet', onPress: () => resolve('correct') },
                        { text: 'Wrong Wallet', onPress: () => resolve('wrong') },
                        { text: 'Cancel', onPress: () => resolve('cancel'), style: 'cancel' },
                    ]
                );
            });
            
            if (userChoice === 'cancel') {
                setWalletLockState(prev => ({ ...prev, isConnecting: false }));
                return;
            }
            
            let simulatedWallet: string;
            if (userChoice === 'correct') {
                simulatedWallet = walletLockState.allowedAddress!;
            } else {
                simulatedWallet = '0x' + Math.random().toString(16).substring(2, 42).padEnd(40, '0');
            }
            
            const isMatch = simulatedWallet.toLowerCase() === walletLockState.allowedAddress!.toLowerCase();
            let decryptedContent: string | null = null;
            
            if (isMatch && walletLockState.encryptedContent) {
                // Simulate decryption
                decryptedContent = walletLockState.encryptedContent;
                Alert.alert('Success!', 'Wallet connected and content decrypted!');
            } else if (!isMatch) {
                Alert.alert('Access Denied', 'This wallet is not authorized to view this content.');
            }
            
            setWalletLockState(prev => ({
                ...prev,
                connectedWallet: simulatedWallet,
                isLocked: !isMatch,
                decryptedContent,
                isConnecting: false,
            }));
            
        } catch (error) {
            console.error('Wallet connection error:', error);
            Alert.alert('Error', 'Failed to connect wallet');
            setWalletLockState(prev => ({ ...prev, isConnecting: false }));
        }
    };

    const getCameraPermissions = async () => {
        const { status } = await BarCodeScanner.requestPermissionsAsync();
        setHasPermission(status === 'granted');
    };

    const checkClipboard = async () => {
        try {
            const clipboardText = await Clipboard.getStringAsync();
            if (clipboardText && clipboardText.includes('capsule_id') && clipboardText.includes('public_claims')) {
                console.log('Found potential capsule in clipboard');
            }
        } catch (error) {
            console.log('Could not check clipboard:', error);
        }
    };

    const pasteFromClipboard = async () => {
        try {
            const clipboardText = await Clipboard.getStringAsync();
            if (clipboardText) {
                setProofData(clipboardText);
                // No alert needed - just paste silently
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to paste from clipboard');
        }
    };

    const clearResults = () => {
        setProofData('');
        setVerificationResult(null);
        setParsedCapsule(null);
        setShowResultsModal(false);
        setTimeLockState({
            isLocked: false,
            unlockTime: null,
            lockedData: null,
            currentTime: null,
            timeRemaining: 0,
        });
        setWalletLockState({
            isLocked: false,
            allowedAddress: null,
            connectedWallet: null,
            encryptedContent: null,
            decryptedContent: null,
            isConnecting: false,
        });
    };

    const openScanner = async () => {
        if (hasPermission === null) {
            const { status } = await BarCodeScanner.requestPermissionsAsync();
            setHasPermission(status === 'granted');
        }
        
        if (hasPermission === false) {
            Alert.alert('Camera Permission Required', 'Please grant camera permission to scan QR codes.');
            return;
        }

        setScanned(false);
        setShowScanner(true);
    };

    const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
        setScanned(true);
        setShowScanner(false);
        
        // Set the scanned data to the input field
        setProofData(data);
        
        console.log(`Bar code with type ${type} and data ${data} has been scanned!`);
        
        // Optional: Show a success message
        Alert.alert('QR Code Scanned', 'QR code data has been added to the input field.');
    };

    const renderScanner = () => {
        if (!showScanner) return null;

        return (
            <Modal
                visible={showScanner}
                transparent={false}
                animationType="slide"
                onRequestClose={() => setShowScanner(false)}
                statusBarTranslucent={true}
            >
                <View style={styles.scannerContainer}>
                    <StatusBar hidden={true} />
                    
                    {/* Scanner Header */}
                    <View style={styles.scannerHeader}>
                        <TouchableOpacity
                            style={styles.scannerCloseButton}
                            onPress={() => setShowScanner(false)}
                        >
                            <MaterialIcons name="close" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Text style={styles.scannerTitle}>Scan QR Code</Text>
                        <View style={styles.scannerPlaceholder} />
                    </View>

                    {/* Camera View */}
                    <View style={styles.cameraContainer}>
                        <BarCodeScanner
                            onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
                            style={styles.camera}
                            barCodeTypes={[BarCodeScanner.Constants.BarCodeType.qr]}
                        />
                        
                        {/* Scanning Overlay */}
                        <View style={styles.scannerOverlay}>
                            <View style={styles.scannerFrame} />
                            <Text style={styles.scannerInstructions}>
                                Position the QR code within the frame
                            </Text>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };

    const verifyProof = async () => {
        if (!proofData.trim()) {
            Alert.alert('Error', 'Please enter capsule data to verify');
            return;
        }

        setIsVerifying(true);
        setVerificationResult(null);
        setParsedCapsule(null);
        
        // Always ensure phrases are visible
        setShowFallingPhrases(true);
        console.log('Setting falling phrases to visible');
        
        try {
            let capsuleData = proofData.trim();
            
            // Check if input is an IPFS URL
            if (capsuleData.startsWith('https://gateway.pinata.cloud/ipfs/') || 
                capsuleData.startsWith('https://ipfs.io/ipfs/') ||
                capsuleData.startsWith('https://') && capsuleData.includes('/ipfs/')) {
                
                console.log('Detected IPFS URL, fetching capsule data...');
                
                try {
                    const response = await fetch(capsuleData);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    const fetchedData = await response.text();
                    console.log('Successfully fetched data from IPFS');
                    capsuleData = fetchedData;
                } catch (fetchError) {
                    console.error('Error fetching from IPFS:', fetchError);
                    Alert.alert('IPFS Error', 'Failed to fetch capsule data from IPFS URL. Please check the URL and try again.');
                    setIsVerifying(false);
                    return;
                }
            }
            
            // Try to parse the capsule data
            const parsed: ZKCapsule = JSON.parse(capsuleData);
            
            // Validate new capsule structure
            if (!parsed.capsule_id || !parsed.public_claims || !parsed.proof || !parsed.metadata) {
                throw new Error('Invalid capsule structure - missing required fields');
            }

            // Validate metadata structure
            if (!parsed.metadata.verification_key || !parsed.metadata.proof_scheme) {
                throw new Error('Invalid metadata structure');
            }

            // Simulate proof verification
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check if it has required ZK proof components
            const hasValidProof = parsed.proof.a && parsed.proof.b && parsed.proof.c;
            const hasValidMetadata = parsed.metadata.verification_key && parsed.metadata.image_hash;
            const hasValidCapsuleId = parsed.capsule_id && parsed.capsule_id.length > 0;
            
            const isValid = hasValidProof && hasValidMetadata && hasValidCapsuleId;
            
            if (isValid) {
                setParsedCapsule(parsed);
                setVerificationResult('valid');
                
                // Check time lock status
                await checkTimeLockStatus(parsed);
                
                // Check wallet lock status
                await checkWalletLockStatus(parsed);
                
                setShowResultsModal(true);
            } else {
                setVerificationResult('invalid');
                Alert.alert('Verification Failed', 'Invalid capsule format or corrupted data');
            }
            
        } catch (error) {
            console.error('Verification error:', error);
            setVerificationResult('invalid');
            Alert.alert('Verification Failed', 'Invalid capsule format or corrupted data');
        } finally {
            setIsVerifying(false);
        }
    };

    const closeModal = () => {
        setShowResultsModal(false);
    };

    // Format time remaining for display
    const formatTimeRemaining = (milliseconds: number): string => {
        if (milliseconds <= 0) return "Unlocked";
        
        const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
        const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
        
        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    };

    const renderTimeLockSection = () => {
        if (!parsedCapsule?.public_claims.time_lock_until) return null;
        
        return (
            <View style={styles.timeLockCard}>
                <Text style={styles.sectionTitle}>🔐 Time Lock</Text>
                
                {timeLockState.isLocked ? (
                    <View style={styles.lockedContainer}>
                        <View style={styles.lockIconContainer}>
                            <MaterialCommunityIcons name="lock-clock" size={40} color="#EF4444" />
                        </View>
                        
                        <Text style={styles.lockedTitle}>Data Locked</Text>
                        <Text style={styles.lockedDescription}>
                            This data will be revealed when the timer reaches zero
                        </Text>
                        
                        <View style={styles.timerContainer}>
                            <Text style={styles.timerLabel}>Unlocks in:</Text>
                            <Text style={styles.timerText}>
                                {formatTimeRemaining(timeLockState.timeRemaining)}
                            </Text>
                        </View>
                        
                        <View style={styles.unlockTimeContainer}>
                            <Text style={styles.unlockTimeLabel}>Unlock Time:</Text>
                            <Text style={styles.unlockTimeText}>
                                {timeLockState.unlockTime?.toLocaleString()}
                            </Text>
                        </View>
                        
                        {isLoadingTime && (
                            <View style={styles.syncingContainer}>
                                <ActivityIndicator size="small" color="#64748B" />
                                <Text style={styles.syncingText}>Syncing with global time...</Text>
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={styles.unlockedContainer}>
                        <View style={styles.unlockIconContainer}>
                            <MaterialCommunityIcons name="clock-check" size={40} color="#10B981" />
                        </View>
                        
                        <Text style={styles.unlockedTitle}>Data Unlocked!</Text>
                        <Text style={styles.unlockedDescription}>
                            The time lock has expired. Secret data revealed:
                        </Text>
                        
                        <View style={styles.revealedDataContainer}>
                            <Text style={styles.revealedDataLabel}>Locked Data:</Text>
                            <View style={styles.revealedDataBox}>
                                <Text style={styles.revealedDataText}>
                                    {timeLockState.lockedData || 'No data available'}
                                </Text>
                            </View>
                            
                            {timeLockState.lockedData && (
                                <TouchableOpacity 
                                    style={styles.copyDataButton}
                                    onPress={async () => {
                                        try {
                                            await Clipboard.setStringAsync(timeLockState.lockedData!);
                                            Alert.alert('Copied', 'Locked data copied to clipboard');
                                        } catch (error) {
                                            Alert.alert('Error', 'Failed to copy data');
                                        }
                                    }}
                                >
                                    <MaterialIcons name="content-copy" size={16} color="#10B981" />
                                    <Text style={styles.copyDataButtonText}>Copy Data</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        
                        <View style={styles.unlockTimeContainer}>
                            <Text style={styles.unlockTimeLabel}>Unlocked at:</Text>
                            <Text style={styles.unlockTimeText}>
                                {timeLockState.currentTime?.toLocaleString()}
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        );
    };

    const renderWalletLockSection = () => {
        if (!parsedCapsule?.public_claims.allowed_address) return null;
        
        return (
            <View style={styles.walletLockCard}>
                <Text style={styles.sectionTitle}>👛 Wallet Lock</Text>
                
                {walletLockState.isLocked ? (
                    <View style={styles.lockedContainer}>
                        <View style={styles.lockIconContainer}>
                            <MaterialCommunityIcons name="wallet-outline" size={40} color="#F59E0B" />
                        </View>
                        
                        <Text style={styles.walletLockedTitle}>Wallet Required</Text>
                        <Text style={styles.walletLockedDescription}>
                            Connect the authorized wallet to decrypt and view this content
                        </Text>
                        
                        <View style={styles.walletInfoContainer}>
                            <Text style={styles.walletInfoLabel}>Allowed Address:</Text>
                            <Text style={styles.walletInfoText}>
                                {walletLockState.allowedAddress}
                            </Text>
                        </View>
                        
                        {walletLockState.connectedWallet && (
                            <View style={styles.connectedWalletContainer}>
                                <Text style={styles.connectedWalletLabel}>Connected Wallet:</Text>
                                <Text style={styles.connectedWalletText}>
                                    {walletLockState.connectedWallet}
                                </Text>
                                <Text style={styles.walletMismatchText}>
                                    ❌ Wallet does not match
                                </Text>
                            </View>
                        )}
                        
                        <TouchableOpacity 
                            style={[styles.connectWalletButton, walletLockState.isConnecting && styles.connectingButton]}
                            onPress={connectWallet}
                            disabled={walletLockState.isConnecting}
                        >
                            {walletLockState.isConnecting ? (
                                <>
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                    <Text style={styles.connectWalletButtonText}>Connecting...</Text>
                                </>
                            ) : (
                                <>
                                    <MaterialCommunityIcons name="wallet-plus" size={20} color="#FFFFFF" />
                                    <Text style={styles.connectWalletButtonText}>Connect Wallet</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.unlockedContainer}>
                        <View style={styles.unlockIconContainer}>
                            <MaterialCommunityIcons name="wallet-outline" size={40} color="#10B981" />
                        </View>
                        
                        <Text style={styles.unlockedTitle}>Wallet Authorized!</Text>
                        <Text style={styles.unlockedDescription}>
                            Your wallet has been verified. Encrypted content revealed:
                        </Text>
                        
                        <View style={styles.revealedDataContainer}>
                            <Text style={styles.revealedDataLabel}>Decrypted Content:</Text>
                            <View style={styles.revealedDataBox}>
                                <Text style={styles.revealedDataText}>
                                    {walletLockState.decryptedContent || 'No content available'}
                                </Text>
                            </View>
                            
                            {walletLockState.decryptedContent && (
                                <TouchableOpacity 
                                    style={styles.copyDataButton}
                                    onPress={async () => {
                                        try {
                                            await Clipboard.setStringAsync(walletLockState.decryptedContent!);
                                            Alert.alert('Copied', 'Decrypted content copied to clipboard');
                                        } catch (error) {
                                            Alert.alert('Error', 'Failed to copy content');
                                        }
                                    }}
                                >
                                    <MaterialIcons name="content-copy" size={16} color="#10B981" />
                                    <Text style={styles.copyDataButtonText}>Copy Content</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        
                        <View style={styles.walletInfoContainer}>
                            <Text style={styles.walletInfoLabel}>Authorized Wallet:</Text>
                            <Text style={styles.walletInfoText}>
                                {walletLockState.connectedWallet}
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        );
    };

    const renderResultsModal = () => {
        if (!parsedCapsule) return null;

        return (
            <Modal
                visible={showResultsModal}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={closeModal}
                statusBarTranslucent={true}
            >
                <View style={styles.modalContainer}>
                    <StatusBar hidden={true} />
                    
                    {/* Modal Header */}
                    <View style={styles.modalHeader}>
                        <View style={styles.modalTitleContainer}>
                            <MaterialIcons name="verified" size={28} color="#10B981" />
                            <Text style={styles.modalTitle}>Capsule Verified</Text>
                        </View>
                        <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
                            <MaterialIcons name="close" size={24} color="#64748B" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView 
                        style={styles.modalScroll} 
                        contentContainerStyle={styles.modalContentContainer}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Time Lock Section - First */}
                        {renderTimeLockSection()}

                        {/* Wallet Lock Section - Second */}
                        {renderWalletLockSection()}

                        {/* Public Claims - Third */}
                        <View style={styles.publicClaimsCard}>
                            <Text style={styles.sectionTitle}>📢 Public Claims</Text>
                            {Object.keys(parsedCapsule.public_claims).length > 0 ? (
                                <View style={styles.claimsGrid}>
                                    {Object.entries(parsedCapsule.public_claims)
                                        .filter(([key, value]) => 
                                            key !== 'time_lock_until' && 
                                            key !== 'time_lock_type' && 
                                            key !== 'allowed_address' &&
                                            value.toLowerCase() !== 'true' &&
                                            value.toLowerCase() !== 'false'
                                        )
                                        .map(([key, value]) => {
                                        // Map claim types to icons and titles
                                        const claimInfo = {
                                            'date_exact': { icon: 'clock-outline', iconType: 'MaterialCommunityIcons', title: 'Exact Date' },
                                            'date_day': { icon: 'clock-outline', iconType: 'MaterialCommunityIcons', title: 'Day' },
                                            'date_month': { icon: 'clock-outline', iconType: 'MaterialCommunityIcons', title: 'Month' },
                                            'date_year': { icon: 'clock-outline', iconType: 'MaterialCommunityIcons', title: 'Year' },
                                            'location_exact': { icon: 'location-outline', iconType: 'Ionicons', title: 'Exact Location' },
                                            'location_city': { icon: 'location-outline', iconType: 'Ionicons', title: 'City' },
                                            'location_country': { icon: 'location-outline', iconType: 'Ionicons', title: 'Country' },
                                            'location_continent': { icon: 'location-outline', iconType: 'Ionicons', title: 'Continent' },
                                            'device_type': { icon: 'smartphone', iconType: 'MaterialIcons', title: 'Device Type' },
                                            'device_platform': { icon: 'smartphone', iconType: 'MaterialIcons', title: 'Platform' },
                                            'device_info': { icon: 'smartphone', iconType: 'MaterialIcons', title: 'Device Info' },
                                            'identity_verified': { icon: 'verified', iconType: 'MaterialIcons', title: 'Identity' },
                                            'image_cid': { icon: 'image', iconType: 'MaterialIcons', title: 'Image CID' },
                                            'image_description': { icon: 'image', iconType: 'MaterialIcons', title: 'Image Description' },
                                        };
                                        
                                        const info = claimInfo[key as keyof typeof claimInfo] || 
                                                   { icon: 'info', iconType: 'MaterialIcons', title: key.replace('_', ' ').toUpperCase() };
                                        
                                        return (
                                            <View key={key} style={styles.claimItem}>
                                                <View style={styles.claimIconContainer}>
                                                    {info.iconType === 'MaterialCommunityIcons' && (
                                                        <MaterialCommunityIcons name={info.icon as any} size={20} color="#64748B" />
                                                    )}
                                                    {info.iconType === 'Ionicons' && (
                                                        <Ionicons name={info.icon as any} size={20} color="#64748B" />
                                                    )}
                                                    {info.iconType === 'MaterialIcons' && (
                                                        <MaterialIcons name={info.icon as any} size={20} color="#64748B" />
                                                    )}
                                                </View>
                                                <Text style={styles.claimTitle}>{info.title}</Text>
                                                <Text style={styles.claimValue}>{value}</Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            ) : (
                                <View style={styles.noClaimsContainer}>
                                    <Text style={styles.noClaimsText}>No public claims revealed</Text>
                                    <Text style={styles.noClaimsSubtext}>All data kept private</Text>
                                </View>
                            )}
                        </View>

                        {/* Capsule Info with Technical Details */}
                        <View style={styles.capsuleInfoCard}>
                            <Text style={styles.sectionTitle}>📦 Capsule Information</Text>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Capsule ID:</Text>
                                <Text style={styles.infoValue}>{parsedCapsule.capsule_id}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Proof Scheme:</Text>
                                <Text style={styles.infoValue}>{parsedCapsule.metadata.proof_scheme}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Circuit Version:</Text>
                                <Text style={styles.infoValue}>{parsedCapsule.metadata.circuit_version}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Verification Key:</Text>
                                <Text style={styles.infoValue}>
                                    {parsedCapsule.metadata.verification_key.substring(0, 16)}...
                                </Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Image Hash:</Text>
                                <Text style={styles.infoValue}>{parsedCapsule.metadata.image_hash}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Proof Protocol:</Text>
                                <Text style={styles.infoValue}>{parsedCapsule.proof.protocol || 'groth16'}</Text>
                            </View>
                        </View>

                        {/* Offers Section - After Capsule Info */}
                        <View style={styles.offersCard}>
                            <View style={styles.offersHeader}>
                                <Text style={styles.sectionTitle}>💰 Offers</Text>
                                <TouchableOpacity 
                                    style={styles.makeOfferButton}
                                    onPress={() => setShowOfferModal(true)}
                                >
                                    <MaterialIcons name="add" size={20} color="#FFFFFF" />
                                    <Text style={styles.makeOfferButtonText}>Make Offer</Text>
                                </TouchableOpacity>
                            </View>
                            
                            {offers.length > 0 ? (
                                <View style={styles.offersList}>
                                    {offers.map((offer) => (
                                        <View key={offer.id} style={styles.offerItem}>
                                            <View style={styles.offerHeader}>
                                                <Text style={styles.offerTitle}>{offer.data_label}</Text>
                                                <View style={[styles.offerStatusBadge, 
                                                    offer.status === 'pending' && styles.pendingBadge,
                                                    offer.status === 'accepted' && styles.acceptedBadge,
                                                    offer.status === 'rejected' && styles.rejectedBadge
                                                ]}>
                                                    <Text style={styles.offerStatusText}>
                                                        {offer.status.toUpperCase()}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={styles.offerDetails}>
                                                <Text style={styles.offerAmount}>
                                                    {offer.amount} {offer.currency}
                                                </Text>
                                                <Text style={styles.offerDate}>
                                                    {new Date(offer.timestamp).toLocaleDateString()}
                                                </Text>
                                            </View>
                                            <Text style={styles.offerAddress}>
                                                From: {offer.offerer_address?.substring(0, 10)}...
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <View style={styles.noOffersContainer}>
                                    <MaterialIcons name="attach-money" size={48} color="#94A3B8" />
                                    <Text style={styles.noOffersText}>No offers yet</Text>
                                    <Text style={styles.noOffersSubtext}>
                                        Be the first to make an offer for private data!
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* IPFS Image if available */}
                        {parsedCapsule.public_claims.image_cid && (
                            <View style={styles.ipfsImageCard}>
                                <Text style={styles.sectionTitle}>🖼️ Verified Image</Text>
                                <View style={styles.ipfsImageWrapper}>
                                    {isLoadingImage && (
                                        <View style={styles.imageLoadingContainer}>
                                            <ActivityIndicator size="large" color="#10B981" />
                                            <Text style={styles.imageLoadingText}>Loading from IPFS...</Text>
                                        </View>
                                    )}
                                    
                                    {imageError && (
                                        <View style={styles.imageErrorContainer}>
                                            <MaterialIcons name="error-outline" size={40} color="#EF4444" />
                                            <Text style={styles.imageErrorText}>{imageError}</Text>
                                        </View>
                                    )}
                                    
                                    {!imageError && (
                                        <Image 
                                            source={{ uri: `https://gateway.pinata.cloud/ipfs/${parsedCapsule.public_claims.image_cid}` }}
                                            style={styles.ipfsImage}
                                            resizeMode="contain"
                                            onLoadStart={() => {
                                                setIsLoadingImage(true);
                                                setImageError(null);
                                            }}
                                            onLoad={() => setIsLoadingImage(false)}
                                            onError={() => {
                                                setIsLoadingImage(false);
                                                setImageError('Could not load image from IPFS');
                                            }}
                                        />
                                    )}
                                </View>
                                
                                <View style={styles.ipfsButtonsRow}>
                                    <TouchableOpacity 
                                        style={styles.ipfsButton}
                                        onPress={() => {
                                            const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${parsedCapsule.public_claims.image_cid}`;
                                            Linking.openURL(ipfsUrl).catch(err => {
                                                console.error('Error opening URL:', err);
                                                Alert.alert('Error', 'Could not open IPFS URL');
                                            });
                                        }}
                                    >
                                        <MaterialIcons name="open-in-new" size={16} color="#FFFFFF" />
                                        <Text style={styles.ipfsButtonText}>Open IPFS</Text>
                                    </TouchableOpacity>
                                    
                                    <TouchableOpacity 
                                        style={styles.ipfsButton}
                                        onPress={async () => {
                                            try {
                                                const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${parsedCapsule.public_claims.image_cid}`;
                                                await Clipboard.setStringAsync(ipfsUrl);
                                                Alert.alert('Copied', 'IPFS URL copied to clipboard');
                                            } catch (error) {
                                                Alert.alert('Error', 'Failed to copy URL');
                                            }
                                        }}
                                    >
                                        <MaterialIcons name="content-copy" size={16} color="#FFFFFF" />
                                        <Text style={styles.ipfsButtonText}>Copy URL</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* Copy Capsule Button */}
                        <TouchableOpacity 
                            style={styles.copyCapsuleButton}
                            onPress={async () => {
                                try {
                                    await Clipboard.setStringAsync(JSON.stringify(parsedCapsule, null, 2));
                                    Alert.alert('Copied!', 'Capsule copied to clipboard');
                                } catch (error) {
                                    Alert.alert('Error', 'Failed to copy capsule');
                                }
                            }}
                        >
                            <MaterialIcons name="content-copy" size={20} color="#1E293B" />
                            <Text style={styles.copyCapsuleButtonText}>Copy Capsule</Text>
                        </TouchableOpacity>

                        <View style={styles.modalBottomPadding} />
                    </ScrollView>
                </View>
            </Modal>
        );
    };

    // Update display text when proofData changes
    useEffect(() => {
        if (proofData.length > 50) {
            setDisplayProofData(`${proofData.substring(0, 50)}...`);
        } else {
            setDisplayProofData(proofData);
        }
    }, [proofData]);

    // Handle input change
    const handleInputChange = (text: string) => {
        setProofData(text);
        if (text.length > 50) {
            setDisplayProofData(`${text.substring(0, 50)}...`);
        } else {
            setDisplayProofData(text);
        }
    };

    // Add a useEffect to log the state
    useEffect(() => {
        console.log('Verify screen mounted, showing falling phrases:', showFallingPhrases);
    }, []);

    // Render offer creation modal
    const renderOfferModal = () => {
        if (!parsedCapsule) return null;

        const availableDataTypes = getAvailablePrivateDataTypes(parsedCapsule);
        const currencies = ['USDT', 'USDC', 'ETH', 'BTC', 'USD'];

        return (
            <Modal
                visible={showOfferModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowOfferModal(false)}
            >
                <View style={styles.offerModalContainer}>
                    <View style={styles.offerModalContent}>
                        <View style={styles.offerModalHeader}>
                            <Text style={styles.offerModalTitle}>💰 Make an Offer</Text>
                            <TouchableOpacity 
                                style={styles.offerModalCloseButton}
                                onPress={() => setShowOfferModal(false)}
                            >
                                <MaterialIcons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.offerModalScroll}>
                            <Text style={styles.offerModalDescription}>
                                Select what private data you'd like to access and make an offer to the capsule owner.
                            </Text>

                            {/* Data Type Selection */}
                            <View style={styles.offerFormSection}>
                                <Text style={styles.offerFormLabel}>What data do you want?</Text>
                                {availableDataTypes.length > 0 ? (
                                    <View style={styles.dataTypesList}>
                                        {availableDataTypes.map((dataType) => (
                                            <TouchableOpacity
                                                key={dataType.type}
                                                style={[
                                                    styles.dataTypeOption,
                                                    selectedDataType === dataType.type && styles.selectedDataType
                                                ]}
                                                onPress={() => setSelectedDataType(dataType.type)}
                                            >
                                                <View style={styles.dataTypeHeader}>
                                                    <Text style={[
                                                        styles.dataTypeTitle,
                                                        selectedDataType === dataType.type && styles.selectedDataTypeText
                                                    ]}>
                                                        {dataType.label}
                                                    </Text>
                                                    {selectedDataType === dataType.type && (
                                                        <MaterialIcons name="check-circle" size={20} color="#10B981" />
                                                    )}
                                                </View>
                                                <Text style={styles.dataTypeDescription}>
                                                    {dataType.description}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                ) : (
                                    <View style={styles.noDataTypesContainer}>
                                        <Text style={styles.noDataTypesText}>
                                            No private data available to offer on
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* Amount Input */}
                            <View style={styles.offerFormSection}>
                                <Text style={styles.offerFormLabel}>How much do you offer?</Text>
                                <View style={styles.amountInputContainer}>
                                    <TextInput
                                        style={styles.amountInput}
                                        placeholder="Enter amount"
                                        placeholderTextColor="#94A3B8"
                                        value={offerAmount}
                                        onChangeText={setOfferAmount}
                                        keyboardType="numeric"
                                    />
                                    <View style={styles.currencySelector}>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                            {currencies.map((currency) => (
                                                <TouchableOpacity
                                                    key={currency}
                                                    style={[
                                                        styles.currencyOption,
                                                        offerCurrency === currency && styles.selectedCurrency
                                                    ]}
                                                    onPress={() => setOfferCurrency(currency)}
                                                >
                                                    <Text style={[
                                                        styles.currencyText,
                                                        offerCurrency === currency && styles.selectedCurrencyText
                                                    ]}>
                                                        {currency}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                </View>
                            </View>

                            {/* Submit Button */}
                            <TouchableOpacity
                                style={[
                                    styles.submitOfferButton,
                                    (!selectedDataType || !offerAmount || isSubmittingOffer) && styles.disabledSubmitButton
                                ]}
                                onPress={createOffer}
                                disabled={!selectedDataType || !offerAmount || isSubmittingOffer}
                            >
                                {isSubmittingOffer ? (
                                    <>
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                        <Text style={styles.submitOfferButtonText}>Submitting...</Text>
                                    </>
                                ) : (
                                    <>
                                        <MaterialIcons name="send" size={20} color="#FFFFFF" />
                                        <Text style={styles.submitOfferButtonText}>Submit Offer</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        );
    };

    return (
        <View style={styles.container}>
            {/* Background layer (lowest z-index) */}
            <View style={styles.gradientBackground} />
            
            {/* Middle layer: FallingPhrases */}
            <FallingPhrases 
                phrases={phrasesData.phrases} 
                active={showFallingPhrases}
            />
            
            {/* Top layer: Content */}
            <View style={styles.centeredContent}>
                {/* Logo/Title */}
                <View style={styles.logoContainer}>
                    <Text style={styles.logoText}>Proov!</Text>
                </View>
                
                {/* Verify button */}
                <TouchableOpacity 
                    style={[styles.verifyButton, isVerifying && styles.disabledButton]}
                    onPress={verifyProof}
                    disabled={isVerifying}
                    onLayout={(event) => {
                        const { y, height } = event.nativeEvent.layout;
                        setVerifyButtonYPosition(y + height);
                    }}
                >
                    <MaterialIcons name="verified" size={20} color="#FFFFFF" />
                    <Text style={styles.verifyButtonText}>
                        {isVerifying ? 'Proooooving...' : 'Proove it ...'}
                    </Text>
                </TouchableOpacity>
            </View>

            {verificationResult === 'valid' && renderResultsModal()}
            {renderScanner()}
            {renderOfferModal()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0)',
    },
    gradientBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0)',
        zIndex: 0, // Lowest z-index (background)
    },
    centeredContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        zIndex: 2, // Highest z-index (content)
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoText: {
        fontSize: 80,
        fontWeight: 'bold',
        color: '#FFFFFF',
        letterSpacing: 1,
    },
   
    disabledButton: {
        backgroundColor: 'rgba(148, 163, 184, 0.6)',
        opacity: 0.6,
    },
    resultContainer: {
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    validResult: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgba(16, 185, 129, 0.3)',
        borderWidth: 2,
    },
    invalidResult: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.3)',
        borderWidth: 2,
    },
    resultEmoji: {
        fontSize: 40,
        marginBottom: 12,
    },
    resultTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 8,
    },
    resultDescription: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 22,
    },
    clearButton: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    verificationDetails: {
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 16,
        padding: 20,
        marginTop: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    verificationTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 16,
        textAlign: 'center',
    },
    proofInfo: {
        marginBottom: 20,
    },
    proofInfoTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#10B981',
        marginBottom: 12,
    },
    proofInfoText: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 6,
    },
    zkProofClaims: {
        marginBottom: 20,
    },
    claimsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    claimItem: {
        width: '48%',
        backgroundColor: 'rgba(248, 250, 252, 0.9)',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(203, 213, 225, 0.5)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    claimTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 4,
        textAlign: 'center',
    },
    claimValue: {
        fontSize: 13,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 4,
    },
    claimStatus: {
        fontSize: 16,
    },
    technicalDetails: {
        backgroundColor: 'rgba(241, 245, 249, 0.8)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(203, 213, 225, 0.3)',
    },
    technicalText: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 6,
        fontFamily: 'monospace',
    },
    infoSection: {
        marginTop: 30,
        marginBottom: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(203, 213, 225, 0.3)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
    },
    infoTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 16,
    },
    infoList: {
        marginLeft: 8,
    },
    infoItem: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 8,
        lineHeight: 20,
    },
    privacyNotice: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.2)',
    },
    privacyTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#10B981',
        marginBottom: 12,
    },
    privacyText: {
        fontSize: 14,
        color: '#1E293B',
    },
    claimDescription: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 4,
        textAlign: 'center',
    },
    infoHighlight: {
        fontWeight: 'bold',
        color: '#10B981',
    },
    zkExample: {
        marginTop: 20,
        padding: 16,
        backgroundColor: 'rgba(241, 245, 249, 0.8)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(203, 213, 225, 0.3)',
    },
    zkExampleTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#10B981',
        marginBottom: 12,
    },
    zkExampleText: {
        fontSize: 14,
        color: '#1E293B',
        marginBottom: 6,
    },
    zkExampleNote: {
        fontSize: 12,
        color: '#64748B',
    },
    ipfsImageCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    ipfsImageWrapper: {
        width: '100%',
        height: 250,
        backgroundColor: 'rgba(241, 245, 249, 0.5)',
        borderRadius: 8,
        marginBottom: 12,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    ipfsImage: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
    },
    ipfsButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: 12,
    },
    ipfsButton: {
        backgroundColor: 'rgba(16, 185, 129, 0.9)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    ipfsButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: '#F8FAFC',
    },
    modalTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    modalTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 4,
    },
    closeButton: {
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
    modalContent: {
        flex: 1,
        padding: 20,
    },
    modalScroll: {
        flex: 1,
    },
    modalContentContainer: {
        paddingHorizontal: 20,
        paddingBottom: 100, // Ensures the button is not covered
    },
    capsuleInfoCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    infoLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
    },
    infoValue: {
        fontSize: 14,
        color: '#64748B',
    },
    publicClaimsCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    noClaimsContainer: {
        padding: 20,
        alignItems: 'center',
    },
    noClaimsText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 8,
    },
    noClaimsSubtext: {
        fontSize: 14,
        color: '#64748B',
    },
    imageLoadingContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(241, 245, 249, 0.7)',
    },
    imageLoadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#64748B',
    },
    imageErrorContainer: {
        padding: 16,
        alignItems: 'center',
    },
    imageErrorText: {
        marginTop: 12,
        fontSize: 14,
        color: '#EF4444',
        textAlign: 'center',
    },
    ipfsLinkContainer: {
        marginTop: 8,
    },
    ipfsLinkLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#64748B',
        marginBottom: 4,
    },
    ipfsLink: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 12,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 8,
    },
    copyCapsuleButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 16,
        marginTop: 16,
        marginBottom: 20,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.8)',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    copyCapsuleButtonText: {
        color: '#1E293B',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    modalBottomPadding: {
        height: 20,
    },
    claimIconContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(248, 250, 252, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    scanButton: {
        backgroundColor: '#111111',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        shadowColor: '#111111',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
        marginRight: 8,
    },
    scannerContainer: {
        flex: 1,
        backgroundColor: '#000000',
    },
    scannerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: '#000000',
    },
    scannerCloseButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.21)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.34)',
    },
    scannerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    scannerPlaceholder: {
        flex: 1,
    },
    cameraContainer: {
        flex: 1,
        backgroundColor: 'transparent',
        position: 'relative',
    },
    camera: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    scannerOverlay: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        bottom: 50,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    scannerFrame: {
        width: '80%',
        height: '80%',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        borderRadius: 8,
    },
    scannerInstructions: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginTop: 20,
    },
    scannerFooter: {
        flexDirection: 'row',
        justifyContent: 'center',
        padding: 20,
    },
    manualInputButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    manualInputText: {
        color: '#3B82F6',
        fontSize: 16,
        fontWeight: 'bold',
    },
    timeLockCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    lockedContainer: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    lockIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    lockedTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#EF4444',
        marginBottom: 8,
    },
    lockedDescription: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 20,
        paddingHorizontal: 20,
    },
    timerContainer: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
        alignItems: 'center',
    },
    timerLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 4,
    },
    timerText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#EF4444',
        fontFamily: 'monospace',
    },
    unlockTimeContainer: {
        alignItems: 'center',
    },
    unlockTimeLabel: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 4,
    },
    unlockTimeText: {
        fontSize: 14,
        color: '#1E293B',
        fontWeight: '500',
    },
    syncingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
    },
    syncingText: {
        fontSize: 12,
        color: '#64748B',
    },
    unlockedContainer: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    unlockIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: 'rgba(16, 185, 129, 0.2)',
    },
    unlockedTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#10B981',
        marginBottom: 8,
    },
    unlockedDescription: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 20,
        paddingHorizontal: 20,
    },
    revealedDataContainer: {
        width: '100%',
        marginBottom: 16,
    },
    revealedDataLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 8,
    },
    revealedDataBox: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderRadius: 8,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.2)',
        marginBottom: 12,
    },
    revealedDataText: {
        fontSize: 16,
        color: '#1E293B',
        lineHeight: 22,
    },
    copyDataButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.9)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 6,
        alignSelf: 'center',
    },
    copyDataButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    walletLockCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    walletLockedTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#F59E0B',
        marginBottom: 8,
    },
    walletLockedDescription: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 20,
        paddingHorizontal: 20,
    },
    walletInfoContainer: {
        backgroundColor: 'rgba(249, 250, 251, 0.8)',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(203, 213, 225, 0.3)',
        width: '100%',
    },
    walletInfoLabel: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 4,
        fontWeight: '600',
    },
    walletInfoText: {
        fontSize: 12,
        color: '#1E293B',
        fontFamily: 'monospace',
    },
    connectedWalletContainer: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
        width: '100%',
    },
    connectedWalletLabel: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 4,
        fontWeight: '600',
    },
    connectedWalletText: {
        fontSize: 12,
        color: '#1E293B',
        fontFamily: 'monospace',
        marginBottom: 8,
    },
    walletMismatchText: {
        fontSize: 12,
        color: '#EF4444',
        fontWeight: '600',
    },
    connectWalletButton: {
        backgroundColor: '#F59E0B',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 2,
    },
    connectingButton: {
        backgroundColor: '#94A3B8',
    },
    connectWalletButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 16,
    },
    offersCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    offersHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    makeOfferButton: {
        backgroundColor: '#10B981',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    makeOfferButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    offersList: {
        marginBottom: 16,
    },
    offerItem: {
        backgroundColor: 'rgba(248, 250, 252, 0.9)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(203, 213, 225, 0.5)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    offerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    offerTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
    },
    offerStatusBadge: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    offerStatusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    pendingBadge: {
        backgroundColor: '#FFB74D',
    },
    acceptedBadge: {
        backgroundColor: '#4CAF50',
    },
    rejectedBadge: {
        backgroundColor: '#EF5350',
    },
    offerDetails: {
        marginBottom: 4,
    },
    offerAmount: {
        fontSize: 14,
        color: '#64748B',
    },
    offerDate: {
        fontSize: 12,
        color: '#9E9E9E',
    },
    offerAddress: {
        fontSize: 12,
        color: '#64748B',
    },
    noOffersContainer: {
        padding: 20,
        alignItems: 'center',
    },
    noOffersText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 8,
    },
    noOffersSubtext: {
        fontSize: 14,
        color: '#64748B',
    },
    offerModalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 10,
    },
    offerModalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        width: '100%',
        height: '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
        overflow: 'hidden',
    },
    offerModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(203, 213, 225, 0.3)',
        backgroundColor: '#FFFFFF',
    },
    offerModalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    offerModalCloseButton: {
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
    offerModalScroll: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 20,
    },
    offerModalDescription: {
        fontSize: 16,
        color: '#64748B',
        marginBottom: 20,
        lineHeight: 22,
    },
    offerFormSection: {
        marginBottom: 20,
    },
    offerFormLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 12,
    },
    dataTypesList: {
        gap: 8,
    },
    dataTypeOption: {
        backgroundColor: 'rgba(248, 250, 252, 0.9)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(203, 213, 225, 0.5)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    selectedDataType: {
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
    },
    dataTypeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    dataTypeTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
    },
    selectedDataTypeText: {
        color: '#10B981',
    },
    dataTypeDescription: {
        fontSize: 14,
        color: '#64748B',
        lineHeight: 20,
    },
    noDataTypesContainer: {
        padding: 20,
        alignItems: 'center',
    },
    noDataTypesText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 8,
    },
    amountInputContainer: {
        marginBottom: 16,
    },
    amountInput: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#1E293B',
        borderWidth: 1,
        borderColor: 'rgba(203, 213, 225, 0.5)',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    currencySelector: {
        marginTop: 12,
    },
    currencyOption: {
        backgroundColor: 'rgba(248, 250, 252, 0.9)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'rgba(203, 213, 225, 0.5)',
    },
    selectedCurrency: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: '#10B981',
    },
    currencyText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
    },
    selectedCurrencyText: {
        color: '#10B981',
    },
    submitOfferButton: {
        backgroundColor: '#10B981',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        marginTop: 16,
        marginBottom: 20,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    submitOfferButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    disabledSubmitButton: {
        backgroundColor: 'rgba(148, 163, 184, 0.6)',
        opacity: 0.6,
    },
    verifyButton: {
        backgroundColor: '#10B981',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        marginTop: 20,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    verifyButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
}); 