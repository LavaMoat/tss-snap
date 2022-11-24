const ethers = require('ethers');
const { utils } = ethers;

async function fundAccount(privateKey, to, amount) {
  const provider = new ethers.providers.JsonRpcProvider();
  const wallet = new ethers.Wallet(privateKey, provider);
  //const balance = await provider.getBalance(to);
  //const nonce = await provider.getTransactionCount(to);
  //const value = utils.parseUnits(amount);
  const tx = {
    to,
    value: utils.parseEther(amount)
  };
  const result = await wallet.sendTransaction(tx);
  console.log(result);
}

// Private key from Ganache, usually at index zero
const from = "0xD928Bb02420d5b4E50AdFD3ca9567d60C6590550";
const privateKey = "0xf64abc91d673bcf100c3cf2bc42507df566d36a18189ae41c377c55ee26a44fd";

// Address we want to fund - the MPC address
const to = "0xb718129ecadb1ada84c88db9127cd1764fa77ef8";

// Send 1 ETH
fundAccount(privateKey, to, "1.0");
