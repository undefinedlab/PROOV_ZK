import { NativeModulesProxy, EventEmitter, Subscription } from 'expo-modules-core';

// Import the native module. On web, it will be resolved to Mopro.web.ts
// and on native platforms to Mopro.ts
import MoproModule from './src/MoproModule';
import MoproView from './src/MoproView';
import { ChangeEventPayload, MoproViewProps } from './src/Mopro.types';

// Define the G1 type
export type G1 = {
  x: string;
  y: string;
  z: string;
}

// Define the G2 type
export type G2 = {
  x: string[];
  y: string[];
  z: string[];
}

// Define the ProofCalldata type
export type CircomProof = {
  a: G1;
  b: G2;
  c: G1;
  protocol: string;
  curve: string;
}
// Define the Result type
export type CircomProofResult = {
  proof: CircomProof;
  inputs: string[];
}

export enum ProofLibOption {
  Arkworks,
  Rapidsnark
}

export type CircomProofLib = {
  proofLib: ProofLibOption
}

export type Halo2ProofResult = {
  proof: Uint8Array;
  inputs: Uint8Array;
}

// Get the native constant value.
export const PI = MoproModule.PI;

export function hello(): string {
  return MoproModule.hello();
}

export async function generateCircomProofWeb(wasmPath: string, zkeyPath: string, circuitInputs: { [key: string]: string[] }): Promise<CircomProofResult> {
  return await MoproModule.generateCircomProofWeb(wasmPath, zkeyPath, circuitInputs);
}

export async function generateCircomProof(zkeyPath: string, circuitInputs: string, proofLib: CircomProofLib): Promise<CircomProofResult> {
  return await MoproModule.generateCircomProof(zkeyPath, circuitInputs, proofLib);
}

export async function verifyCircomProof(zkeyPath: string, proofResult: CircomProofResult, proofLib: CircomProofLib): Promise<boolean> {
  return await MoproModule.verifyCircomProof(zkeyPath, proofResult, proofLib);
}

export async function generateHalo2Proof(srsPath: string, pkPath: string, circuitInputs: { [key: string]: string[] }): Promise<Halo2ProofResult> {
  return await MoproModule.generateHalo2Proof(srsPath, pkPath, circuitInputs);
}

export async function verifyHalo2Proof(srsPath: string, vkPath: string, proof: Uint8Array, publicInput: Uint8Array): Promise<boolean> {
  return await MoproModule.verifyHalo2Proof(srsPath, vkPath, proof, publicInput);
}

export async function generateNoirProof(circuitPath: string, srsPath: string | null, inputs: string[]): Promise<Uint8Array> {
  return await MoproModule.generateNoirProof(circuitPath, srsPath, inputs);
}

export async function verifyNoirProof(circuitPath: string, proof: Uint8Array): Promise<boolean> {
  return await MoproModule.verifyNoirProof(circuitPath, proof);
}

export async function setValueAsync(value: string) {
  return await MoproModule.setValueAsync(value);
}

const emitter = new EventEmitter(MoproModule ?? NativeModulesProxy.Mopro);

export function addChangeListener(listener: (event: ChangeEventPayload) => void): Subscription {
  return emitter.addListener<ChangeEventPayload>('onChange', listener);
}

export { MoproView, MoproViewProps, ChangeEventPayload };
