const leftPad = require("left-pad");
const p = require("util").promisify;
const ethUtils = require("ethereumjs-util");
const BN = require("bn.js");

const {
  ACCT_0_PRIVKEY,
  ACCT_0_ADDR,
  ACCT_1_PRIVKEY,
  ACCT_1_ADDR
} = require("./constants.js");

module.exports = {
  sleep,
  takeSnapshot,
  revertSnapshot,
  solSha3,
  sign,
  ecrecover,
  filterLogs,
  mineBlocks,
  createChannel,
  updateState,
  startSettlingPeriod,
  toSolUint256,
  toSolInt256,
  closeChannel,
  reDraw
};

function sleep(time) {
  return new Promise(resolve => {
    setTimeout(resolve, time);
  });
}

let snapshotInc = 0;

async function takeSnapshot() {
  const id = ++snapshotInc;
  let res = await p(web3.currentProvider.sendAsync.bind(web3.currentProvider))({
    jsonrpc: "2.0",
    method: "evm_snapshot",
    id
  });
  // console.log("took snapshot with id: ", id, " result: ", res.result);
  return res.result;
}

async function revertSnapshot(snapshotId) {
  const id = snapshotInc;
  await p(web3.currentProvider.sendAsync.bind(web3.currentProvider))({
    jsonrpc: "2.0",
    method: "evm_revert",
    params: [snapshotId],
    id
  });
  // console.log("restored snapshot with id: ", id, " snapshotId: ", snapshotId);
}

async function mineBlock() {
  await p(web3.currentProvider.sendAsync.bind(web3.currentProvider))({
    jsonrpc: "2.0",
    method: "evm_mine",
    id: new Date().getTime()
  });
}

async function mineBlocks(count) {
  let i = 0;
  while (i < count) {
    await mineBlock();
    i++;
  }
}

function toSolUint256(num) {
  return leftPad(num.toString(16), 64, 0);
}

function toSolInt256(num) {
  return new BN(num).toTwos(256).toString(16, 64);
}

function solSha3(...args) {
  args = args.map(arg => {
    if (typeof arg === "string") {
      if (arg.substring(0, 2) === "0x") {
        return arg.slice(2);
      } else {
        return web3.toHex(arg).slice(2);
      }
    }

    if (typeof arg === "number") {
      return leftPad(arg.toString(16), 64, 0);
    }
  });

  args = args.join("");

  return web3.sha3(args, { encoding: "hex" });
}

function sign(msgHash, privKey) {
  if (typeof msgHash === "string" && msgHash.slice(0, 2) === "0x") {
    msgHash = Buffer.alloc(32, msgHash.slice(2), "hex");
  }
  const sig = ethUtils.ecsign(msgHash, privKey);
  return `0x${sig.r.toString("hex")}${sig.s.toString("hex")}${sig.v.toString(
    16
  )}`;
}

function ecrecover(msg, sig) {
  const r = ethUtils.toBuffer(sig.slice(0, 66));
  const s = ethUtils.toBuffer("0x" + sig.slice(66, 130));
  const v = 27 + parseInt(sig.slice(130, 132));
  const m = ethUtils.toBuffer(msg);
  const pub = ethUtils.ecrecover(m, v, r, s);
  return "0x" + ethUtils.pubToAddress(pub).toString("hex");
}

function filterLogs(logs) {
  return logs.map(log => [log.event, log.args]);
}

async function createChannel(
  instance,
  channelId,
  balance0,
  balance1,
  settlingPeriod,
  string = "newChannel",
  expiration = web3.eth.getBlock("latest").number + 5
) {
  await instance.depositToAddress.sendTransaction(ACCT_0_ADDR, { value: 12 });
  await instance.depositToAddress.sendTransaction(ACCT_1_ADDR, { value: 12 });

  const fingerprint = solSha3(
    string,
    instance.contract.address,
    channelId,
    ACCT_0_ADDR,
    ACCT_1_ADDR,
    balance0,
    balance1,
    expiration,
    settlingPeriod
  );

  const signature0 = sign(fingerprint, new Buffer(ACCT_0_PRIVKEY, "hex"));
  const signature1 = sign(fingerprint, new Buffer(ACCT_1_PRIVKEY, "hex"));

  return instance.newChannel(
    channelId,
    ACCT_0_ADDR,
    ACCT_1_ADDR,
    balance0,
    balance1,
    expiration,
    settlingPeriod,
    signature0,
    signature1
  );
}

async function updateState(
  instance,
  channelId,
  sequenceNumber,
  balance0,
  balance1
) {
  const fingerprint = solSha3(
    "updateState",
    instance.contract.address,
    channelId,
    sequenceNumber,
    balance0,
    balance1
  );

  const signature0 = sign(fingerprint, new Buffer(ACCT_0_PRIVKEY, "hex"));
  const signature1 = sign(fingerprint, new Buffer(ACCT_1_PRIVKEY, "hex"));

  await instance.updateState(
    channelId,
    sequenceNumber,
    balance0,
    balance1,
    signature0,
    signature1
  );
}

async function startSettlingPeriod(instance, channelId) {
  const startSettlingPeriodFingerprint = solSha3(
    "startSettlingPeriod",
    instance.contract.address,
    channelId
  );

  return instance.startSettlingPeriod(
    channelId,
    sign(startSettlingPeriodFingerprint, new Buffer(ACCT_0_PRIVKEY, "hex"))
  );
}

async function closeChannel(instance, channelId, balance0 = 5, balance1 = 7) {
  await createChannel(instance, channelId, 6, 6, 2);
  await updateState(instance, channelId, 1, balance0, balance1);
  await startSettlingPeriod(instance, channelId);
  await mineBlocks(5);
  await instance.closeChannel(channelId);
}

async function reDraw(
  instance,
  channelId,
  sequenceNumber,
  oldBalance0,
  oldBalance1,
  newBalance0,
  newBalance1,
  expiration = web3.eth.getBlock("latest").number + 5
) {
  const fingerprint = solSha3(
    "reDraw",
    instance.contract.address,
    channelId,
    sequenceNumber,
    oldBalance0,
    oldBalance1,
    newBalance0,
    newBalance1,
    expiration
  );

  const signature0 = sign(fingerprint, new Buffer(ACCT_0_PRIVKEY, "hex"));
  const signature1 = sign(fingerprint, new Buffer(ACCT_1_PRIVKEY, "hex"));

  return instance.reDraw(
    channelId,
    sequenceNumber,
    oldBalance0,
    oldBalance1,
    newBalance0,
    newBalance1,
    expiration,
    signature0,
    signature1
  );
}
