package expo.modules.mopro

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.Enumerable

class ExpoG1 : Record {
    @Field var x: String?

    @Field var y: String?

    @Field var z: String?

    constructor(_x: String, _y: String, _z: String) {
        x = _x
        y = _y
        z = _z
    }
}

class ExpoG2 : Record {
    @Field var x: List<String>?

    @Field var y: List<String>?

    @Field var z: List<String>?

    constructor(_x: List<String>, _y: List<String>, _z: List<String>) {
        x = _x
        y = _y
        z = _z
    }
}

class ExpoProof : Record {
    @Field var a: ExpoG1?

    @Field var b: ExpoG2?

    @Field var c: ExpoG1?

    @Field var `protocol`: String?

    @Field var curve: String?

    constructor(_a: ExpoG1, _b: ExpoG2, _c: ExpoG1, _protocol: String, _curve: String) {
        a = _a
        b = _b
        c = _c
        `protocol` = _protocol
        curve = _curve
    }
}

class ExpoCircomProofResult : Record {
    @Field var proof: ExpoProof?

    @Field var inputs: List<String>?

    constructor(_proof: ExpoProof, _inputs: List<String>) {
        proof = _proof
        inputs = _inputs
    }
}

enum class ProofLibOption(val value: Int) : Enumerable {
    arkworks(0),
    rapidsnark(1)
  }
  
class ExpoCircomProofLib : Record {
    @Field
    val proofLib: ProofLibOption = ProofLibOption.arkworks
}

class ExpoHalo2ProofResult: Record {
    @Field var proof: ByteArray?

    @Field var inputs: ByteArray?

    constructor(_proof: ByteArray, _inputs: ByteArray) {
        proof = _proof
        inputs = _inputs
    }
}