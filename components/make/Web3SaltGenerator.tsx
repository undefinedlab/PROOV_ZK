import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Dimensions,
    ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';

// Mock Flow/wagmi imports - these would be real in a production app
// import { useAccount, useConnect, useDisconnect } from 'wagmi';
// import { useFlowConnect } from '@flow/react-sdk';
// import { FlowClient } from '@flow/client';
// import { sendTransaction, executeScript } from '@flow/fcl';
// import * as fcl from '@flow/fcl';

const { width } = Dimensions.get('window');

interface Web3SaltGeneratorProps {
    onSaltGenerated: (salt: string) => void;
    onClose: () => void;
}

interface WalletInfo {
    address: string;
    balance: string;
    network: string;
    chainId: number;
}

interface ContractInfo {
    address: string;
    name: string;
    version: string;
    gasPrice: string;
    note: string;
    language: string;
}

// Utility functions
const generateTransactionHash = (): string => {
    const chars = '0123456789abcdef';
    let hash = '0x';
    for (let i = 0; i < 64; i++) {
        hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
};

const generateSalt = (): string => {
    const chars = '0123456789abcdef';
    let salt = '';
    for (let i = 0; i < 32; i++) {
        salt += chars[Math.floor(Math.random() * chars.length)];
    }
    return salt;
};

// Cadence script for generating random salt
const GENERATE_SALT_SCRIPT = `
import RandomOracle from 0xF9878a331738A4E4c67960A1BA4befBA6D56d617

pub fun main(): String {
    let oracle = RandomOracle.getOracle()
    let entropy = oracle.generateEntropy()
    let salt = oracle.hashEntropy(entropy)
    return salt
}
`;

// Cadence transaction for requesting randomness
const REQUEST_RANDOMNESS_TRANSACTION = `
import RandomOracle from 0xF9878a331738A4E4c67960A1BA4befBA6D56d617

transaction {
    prepare(signer: AuthAccount) {
        let oracle = RandomOracle.getOracle()
        oracle.requestRandomness(signer: signer)
    }
    
    execute {
        log("Randomness requested successfully")
    }
}
`;

// Flow configuration
const FLOW_CONFIG = {
    mainnet: {
        accessNode: "https://rest-mainnet.onflow.org",
        discoveryWallet: "https://fcl-discovery.onflow.org/authn",
        network: "mainnet"
    },
    testnet: {
        accessNode: "https://rest-testnet.onflow.org", 
        discoveryWallet: "https://fcl-discovery.onflow.org/testnet/authn",
        network: "testnet"
    }
};

// Mock Flow SDK hooks - these would be real imports
const useFlowAccount = () => {
    const [user, setUser] = useState<any>(null);
    const [isConnected, setIsConnected] = useState(false);
    
    return { user, isConnected, setUser, setIsConnected };
};

const useFlowTransaction = () => {
    const [txStatus, setTxStatus] = useState<string | null>(null);
    const [txId, setTxId] = useState<string | null>(null);
    
    const sendTransaction = async (cadence: string, args: any[]) => {
        // Mock implementation
        const mockTxId = generateTransactionHash();
        setTxId(mockTxId);
        setTxStatus('PENDING');
        
        // Simulate transaction processing
        setTimeout(() => setTxStatus('SEALED'), 2000);
        
        return mockTxId;
    };
    
    return { sendTransaction, txStatus, txId };
};

const useFlowScript = () => {
    const executeScript = async (cadence: string, args: any[] = []) => {
        // Mock script execution
        await new Promise(resolve => setTimeout(resolve, 1000));
        return generateSalt();
    };
    
    return { executeScript };
};

const Web3SaltGenerator: React.FC<Web3SaltGeneratorProps> = ({ onSaltGenerated, onClose }) => {
    // Flow SDK hooks - these would be real in a production app
    const { user, isConnected, setUser, setIsConnected } = useFlowAccount();
    const { sendTransaction, txStatus, txId } = useFlowTransaction();
    const { executeScript } = useFlowScript();
    
    const [isConnecting, setIsConnecting] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
    const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
    const [transactionHash, setTransactionHash] = useState<string>('');
    const [generatedSalt, setGeneratedSalt] = useState<string>('');
    const [step, setStep] = useState<'connect' | 'generate' | 'complete'>('connect');

    // Flow network configuration
    useEffect(() => {
        // Configure Flow Client Library (FCL)
        // fcl.config({
        //     "accessNode.api": FLOW_CONFIG.mainnet.accessNode,
        //     "discovery.wallet": FLOW_CONFIG.mainnet.discoveryWallet,
        //     "0xRandomOracle": "0xF9878a331738A4E4c67960A1BA4befBA6D56d617"
        // });
    }, []);

    // Mock wallet data - in a real app this would come from Flow wallet connection
    const mockWallets: WalletInfo[] = [
        {
            address: '0x1cf0e2dad2d0b',
            balance: '125.43',
            network: 'Flow Mainnet',
            chainId: 1
        },
        {
            address: '0xa2bd05c4b65d1',
            balance: '89.21',
            network: 'Flow Testnet',
            chainId: 545
        }
    ];

    // Mock contract data - in a real app this would come from the Flow blockchain
    const mockContracts: ContractInfo[] = [
        {
            address: '0xF9878a331738A4E4c67960A1BA4befBA6D56d617',
            name: 'FlowRandomOracle',
            version: '1.2.3',
            gasPrice: '0.0001',
            note: 'Random Number Generator',
            language: 'Cadence'
        },
        {
            address: '0x8b148183c28ff88f89e6dfb84fcb22a90d64b7d',
            name: 'FlowEntropyProvider',
            version: '2.1.0',
            gasPrice: '0.0002',
            note: 'Backup RNG Contract',
            language: 'Cadence'
        }
    ];

    // Simulate Flow wallet connection using FCL
    const simulateFlowWalletConnection = async () => {
        setIsConnecting(true);
        
        try {
            // In a real app, this would be:
            // const user = await fcl.authenticate();
            // setUser(user);
            
            // Mock wallet connection
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const selectedWallet = mockWallets[Math.floor(Math.random() * mockWallets.length)];
            const selectedContract = mockContracts[Math.floor(Math.random() * mockContracts.length)];
            
            setWalletInfo(selectedWallet);
            setContractInfo(selectedContract);
            setIsConnected(true);
            setStep('generate');
            
        } catch (error) {
            console.error('Flow wallet connection failed:', error);
        } finally {
            setIsConnecting(false);
        }
    };

    // Simulate Cadence script execution for salt generation
    const simulateFlowSaltGeneration = async () => {
        setIsGenerating(true);
        
        try {
            // In a real app, this would execute the actual Cadence script:
            // const salt = await executeScript(GENERATE_SALT_SCRIPT);
            
            // First, send transaction to request randomness
            const txHash = await sendTransaction(REQUEST_RANDOMNESS_TRANSACTION, []);
            setTransactionHash(txHash);
            
            // Wait for transaction to be sealed
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Then execute script to get the generated salt
            const salt = await executeScript(GENERATE_SALT_SCRIPT);
            setGeneratedSalt(salt);
            
            // Callback with generated salt
            onSaltGenerated(salt);
            
            setStep('complete');
            
        } catch (error) {
            console.error('Flow salt generation failed:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const renderConnectStep = () => (
        <View style={styles.stepContainer}>
            <View style={styles.headerContainer}>
                <View style={styles.iconContainer}>
                    <MaterialCommunityIcons name="wallet-outline" size={32} color="#3B82F6" />
                </View>
                <Text style={styles.stepTitle}>Connect Web3 Wallet</Text>
                <Text style={styles.stepSubtitle}>
                    Connect your wallet to generate cryptographically secure random salts
                </Text>
            </View>
            
            <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                    <MaterialIcons name="security" size={20} color="#10B981" />
                    <Text style={styles.infoText}>Cryptographically secure randomness</Text>
                </View>
                <View style={styles.infoRow}>
                    <MaterialIcons name="link" size={20} color="#10B981" />
                    <Text style={styles.infoText}>Blockchain-verified entropy source</Text>
                </View>
                <View style={styles.infoRow}>
                    <MaterialIcons name="verified" size={20} color="#10B981" />
                    <Text style={styles.infoText}>Tamper-proof salt generation</Text>
                </View>
            </View>
            
            <TouchableOpacity 
                style={styles.connectButton}
                onPress={simulateFlowWalletConnection}
                disabled={isConnecting}
            >
                {isConnecting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                    <MaterialCommunityIcons name="wallet-plus" size={20} color="#FFFFFF" />
                )}
                <Text style={styles.connectButtonText}>
                    {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </Text>
            </TouchableOpacity>
        </View>
    );

    const renderGenerateStep = () => (
        <View style={styles.stepContainer}>
            <View style={styles.headerContainer}>
                <View style={styles.iconContainer}>
                    <MaterialIcons name="generating-tokens" size={32} color="#8B5CF6" />
                </View>
                <Text style={styles.stepTitle}>Generate Salt</Text>
                <Text style={styles.stepSubtitle}>
                    Request random salt from smart contract
                </Text>
            </View>
            
            {walletInfo && contractInfo && (
                <View style={styles.detailsContainer}>
                    <View style={styles.detailCard}>
                        <Text style={styles.detailCardTitle}>Wallet Connected</Text>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Address:</Text>
                            <Text style={styles.detailValue}>{walletInfo.address.slice(0, 6)}...{walletInfo.address.slice(-4)}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Balance:</Text>
                            <Text style={styles.detailValue}>{walletInfo.balance} FLOW</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Network:</Text>
                            <Text style={styles.detailValue}>{walletInfo.network}</Text>
                        </View>
                    </View>
                    
                    <View style={styles.detailCard}>
                        <Text style={styles.detailCardTitle}>Smart Contract</Text>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Contract:</Text>
                            <Text style={styles.detailValue}>{contractInfo.name}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Address:</Text>
                            <Text style={styles.detailValue}>{contractInfo.address.slice(0, 6)}...{contractInfo.address.slice(-4)}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Version:</Text>
                            <Text style={styles.detailValue}>v{contractInfo.version}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Function:</Text>
                            <Text style={styles.detailValue}>{contractInfo.note}</Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Gas Price:</Text>
                            <Text style={styles.detailValue}>{contractInfo.gasPrice} FLOW</Text>
                        </View>
                    </View>
                </View>
            )}
            
            {transactionHash && (
                <View style={styles.transactionCard}>
                    <Text style={styles.transactionTitle}>Transaction Submitted</Text>
                    <View style={styles.transactionRow}>
                        <Text style={styles.transactionLabel}>Hash:</Text>
                        <Text style={styles.transactionHash}>{transactionHash.slice(0, 10)}...{transactionHash.slice(-6)}</Text>
                    </View>
                    <View style={styles.transactionStatus}>
                        <ActivityIndicator size="small" color="#F59E0B" />
                        <Text style={styles.transactionStatusText}>Awaiting confirmation...</Text>
                    </View>
                </View>
            )}
            
            <TouchableOpacity 
                style={styles.generateButton}
                onPress={simulateFlowSaltGeneration}
                disabled={isGenerating}
            >
                {isGenerating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                    <MaterialIcons name="casino" size={20} color="#FFFFFF" />
                )}
                <Text style={styles.generateButtonText}>
                    {isGenerating ? 'Generating Salt...' : 'Generate Salt'}
                </Text>
            </TouchableOpacity>
        </View>
    );

    const renderCompleteStep = () => (
        <View style={styles.stepContainer}>
            <View style={styles.headerContainer}>
                <View style={styles.successIconContainer}>
                    <MaterialIcons name="check-circle" size={32} color="#10B981" />
                </View>
                <Text style={styles.stepTitle}>Salt Generated</Text>
                <Text style={styles.stepSubtitle}>
                    Cryptographically secure salt ready for use
                </Text>
            </View>
            
            <View style={styles.saltContainer}>
                <Text style={styles.saltLabel}>Generated Salt:</Text>
                <View style={styles.saltValueContainer}>
                    <Text style={styles.saltValue}>{generatedSalt}</Text>
                    <TouchableOpacity 
                        style={styles.copyButton}
                        onPress={() => {
                            // Mock copy functionality
                            Alert.alert('Copied', 'Salt copied to clipboard');
                        }}
                    >
                        <MaterialIcons name="content-copy" size={16} color="#64748B" />
                    </TouchableOpacity>
                </View>
            </View>
            
            {transactionHash && (
                <View style={styles.confirmationCard}>
                    <Text style={styles.confirmationTitle}>Transaction Confirmed</Text>
                    <View style={styles.confirmationRow}>
                        <Text style={styles.confirmationLabel}>Block:</Text>
                        <Text style={styles.confirmationValue}>#{Math.floor(Math.random() * 1000000 + 18000000)}</Text>
                    </View>
                    <View style={styles.confirmationRow}>
                        <Text style={styles.confirmationLabel}>Confirmations:</Text>
                        <Text style={styles.confirmationValue}>12/12</Text>
                    </View>
                    <View style={styles.confirmationRow}>
                        <Text style={styles.confirmationLabel}>Gas Used:</Text>
                        <Text style={styles.confirmationValue}>21,000</Text>
                    </View>
                </View>
            )}
            
            <TouchableOpacity 
                style={styles.completeButton}
                onPress={onClose}
            >
                <MaterialIcons name="done" size={20} color="#FFFFFF" />
                <Text style={styles.completeButtonText}>Complete</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Web3 Salt Generator</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <MaterialIcons name="close" size={24} color="#64748B" />
                </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {step === 'connect' && renderConnectStep()}
                {step === 'generate' && renderGenerateStep()}
                {step === 'complete' && renderCompleteStep()}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(226, 232, 240, 0.6)',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1E293B',
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
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    stepContainer: {
        paddingVertical: 20,
    },
    headerContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    successIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    stepTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 8,
        textAlign: 'center',
    },
    stepSubtitle: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 24,
    },
    infoCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 30,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.6)',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    infoText: {
        fontSize: 14,
        color: '#1E293B',
        marginLeft: 12,
        fontWeight: '500',
    },
    connectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#3B82F6',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
        gap: 8,
    },
    connectButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    detailsContainer: {
        marginBottom: 30,
    },
    detailCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.6)',
    },
    detailCardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 12,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    detailLabel: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
    },
    detailValue: {
        fontSize: 14,
        color: '#1E293B',
        fontWeight: '600',
        fontFamily: 'monospace',
    },
    transactionCard: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    transactionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 8,
    },
    transactionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    transactionLabel: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
    },
    transactionHash: {
        fontSize: 14,
        color: '#1E293B',
        fontWeight: '600',
        fontFamily: 'monospace',
    },
    transactionStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 8,
    },
    transactionStatusText: {
        fontSize: 14,
        color: '#F59E0B',
        fontWeight: '600',
    },
    generateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8B5CF6',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
        gap: 8,
    },
    generateButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    saltContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.6)',
    },
    saltLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 12,
    },
    saltValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(248, 250, 252, 0.8)',
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(203, 213, 225, 0.5)',
    },
    saltValue: {
        flex: 1,
        fontSize: 14,
        color: '#1E293B',
        fontWeight: '600',
        fontFamily: 'monospace',
    },
    copyButton: {
        padding: 8,
        borderRadius: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        marginLeft: 8,
    },
    confirmationCard: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    confirmationTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 12,
    },
    confirmationRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    confirmationLabel: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
    },
    confirmationValue: {
        fontSize: 14,
        color: '#10B981',
        fontWeight: '600',
        fontFamily: 'monospace',
    },
    completeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#10B981',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
        gap: 8,
    },
    completeButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
});

export default Web3SaltGenerator; 