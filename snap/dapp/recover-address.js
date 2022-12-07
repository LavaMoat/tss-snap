const ethers = require('ethers');

const recoveredAddress = ethers.utils.recoverAddress(`0x528126c413caba80aa0c408585732a9873275c4c0c698b48717b000724054d99`, {
  r: `0xf0b2cbed3b5d5ec7cc268f34531ede605ede0b390d286de8f5a9ae892d3a2676`,
  s: `0x6a6008d6f3149952d37b3196f1b51f1f3001f3fdbf489f2558b81e86862afaf6`,
  v: 1,
});

console.log({recoveredAddress});
