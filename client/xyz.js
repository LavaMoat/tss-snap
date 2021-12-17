// const secp256k1 = require('secp256k1')
const util = require("ethereumjs-util");

// secp256k1.ecdsaVerify(sigObj.signature, 'hello world', pubKey)

const sigObj = {
  r: "9269546768ee97fdcfede9f9db143f73a942a093e5eee3a400637b997c8dc584",
  s: "26358533f4a3244fc17a67500322bbaf50ffcdf691ec9aa635afbc77da958858",
  v: 1,
};

const msgHash = Buffer.from(
  "35a0acc238f6db52c770d9f85a57eb594879cad404143dc571aed338513f9604",
  "hex"
);
const sig = Buffer.concat([
  Buffer.from(sigObj.r, "hex"),
  Buffer.from(sigObj.s, "hex"),
]);
// const publicKey = Buffer.from(secp256k1.ecdsaRecover(sig, sigObj.v, msgHash, false)).slice(1)

const publicKey2 = util.ecrecover(
  msgHash,
  27 + sigObj.v,
  Buffer.from(sigObj.r, "hex"),
  Buffer.from(sigObj.s, "hex")
);

// console.log('public:', publicKey.toString('hex'))
console.log("public:", publicKey2.toString("hex"));
console.log("address:", util.pubToAddress(publicKey2).toString("hex"));
