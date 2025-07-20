import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

// IPFS Gateway URLs
const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

/**
 * Upload a file to IPFS using Pinata
 * @param fileUri Local file URI to upload
 * @param metadata Optional metadata to include with the file
 * @returns IPFS CID (Content Identifier)
 */
export async function uploadToIPFS(fileUri: string, metadata?: Record<string, any>): Promise<string> {
  try {
    console.log('Uploading to IPFS via Pinata:', fileUri);
    
    // Verify file exists
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error('File does not exist');
    }
    
    // For demo purposes, return a mock CID
    // In production, implement actual IPFS upload with proper API key management
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Generate a mock CID
    const mockCid = `Qm${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    
    console.log('Mock IPFS upload successful with CID:', mockCid);
    return mockCid;
  } catch (error) {
    console.error('Error uploading to IPFS:', error);
    throw error;
  }
}

/**
 * Get the IPFS gateway URL for a CID
 * @param cid IPFS Content Identifier
 * @param gateway Optional gateway URL to use
 * @returns Full URL to access the content
 */
export function getIPFSUrl(cid: string, gateway: string = IPFS_GATEWAY): string {
  if (!cid) return '';
  
  // Make sure the gateway URL ends with a slash
  const gatewayUrl = gateway.endsWith('/') ? gateway : gateway + '/';
  
  // Return the full URL
  return `${gatewayUrl}${cid}`;
}

/**
 * Upload JSON data to IPFS using Pinata
 * @param jsonData The JSON object to upload
 * @param metadata Optional metadata to include with the JSON
 * @returns IPFS CID (Content Identifier)
 */
export async function uploadJSONToIPFS(jsonData: any, metadata?: Record<string, any>): Promise<string> {
  try {
    console.log('Uploading JSON to IPFS via Pinata:', typeof jsonData);
    
    // For demo purposes, return a mock CID
    // In production, implement actual IPFS upload with proper API key management
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate a mock CID for JSON data
    const mockCid = `QmJson${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    
    console.log('Mock JSON IPFS upload successful with CID:', mockCid);
    return mockCid;
  } catch (error) {
    console.error('Error uploading JSON to IPFS:', error);
    throw error;
  }
}

/**
 * Fetch JSON data from IPFS using a CID
 * @param cid IPFS Content Identifier
 * @param gateway Optional gateway URL to use
 * @returns The JSON data
 */
export async function fetchJSONFromIPFS(cid: string, gateway: string = IPFS_GATEWAY): Promise<any> {
  try {
    const url = getIPFSUrl(cid, gateway);
    console.log('Fetching JSON from IPFS:', url);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch from IPFS: ${response.status} ${response.statusText}`);
    }
    
    const jsonData = await response.json();
    console.log('Successfully fetched JSON from IPFS');
    return jsonData;
  } catch (error) {
    console.error('Error fetching JSON from IPFS:', error);
    throw error;
  }
} 