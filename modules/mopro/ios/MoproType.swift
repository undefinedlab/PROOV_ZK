import ExpoModulesCore

struct ExpoG1: Record {
  @Field
  var x: String?

  @Field
  var y: String?

  @Field
  var z: String?
}

struct ExpoG2: Record {
  @Field
  var x: [String]?

  @Field
  var y: [String]?

  @Field
  var z: [String]?
}

struct ExpoProof: Record {
  @Field
  var a: ExpoG1?

  @Field
  var b: ExpoG2?

  @Field
  var c: ExpoG1?

  @Field
  var `protocol`: String?

  @Field
  var curve: String?
}

struct ExpoCircomProofResult: Record {
  @Field
  var inputs: [String]?

  @Field
  var proof: ExpoProof?

}

enum ProofLibOption: Int, Enumerable {
  case arkworks
  case rapidsnark
}

struct ExpoCircomProofLib: Record {
  @Field
  var proofLib: ProofLibOption = .arkworks
}

struct ExpoHalo2ProofResult: Record {
  @Field
  var inputs: Data?

  @Field
  var proof: Data?

}
