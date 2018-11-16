// cook mango twist then skin sort option civil have still rather guilt

const test = require("blue-tape");
const p = require("util").promisify;

const {
  ACCT_0_PRIVKEY,
  ACCT_1_PRIVKEY,
  ACCT_0_ADDR,
  ACCT_1_ADDR,
  ACCT_2_PRIVKEY,
  ACCT_2_ADDR
} = require("./constants.js");

const {
  createChannel,
  updateState,
  startSettlingPeriod,
  mineBlocks,
  solSha3,
  sign,
  takeSnapshot,
  revertSnapshot
} = require("./utils.js");

module.exports = async (test, instance) => {
  test("newChannel happy path", async t => {
    const snapshot = await takeSnapshot();
    const channelId =
      "0x1000000000000000000000000000000000000000000000000000000000000000";

    await createChannel(instance, channelId, 6, 6, 2);

    t.equal((await instance.balanceOf.call(ACCT_0_ADDR)).c[0], 6);
    t.equal((await instance.balanceOf.call(ACCT_1_ADDR)).c[0], 6);

    t.deepEqual(
      JSON.parse(JSON.stringify(await instance.channels(channelId))),
      [
        "0x1000000000000000000000000000000000000000000000000000000000000000",
        ACCT_0_ADDR,
        ACCT_1_ADDR,
        "12",
        "6",
        "6",
        "0",
        "2",
        false,
        "0",
        false
      ]
    );
    await revertSnapshot(snapshot);
  });

  test("newChannel expired", async t => {
    const snapshot = await takeSnapshot();
    const channelId =
      "0x1000000000000000000000000000000000000000000000000000000000000000";

    await t.shouldFail(createChannel(instance, channelId, 6, 6, 2, 0));
    await createChannel(instance, channelId, 6, 6, 2);

    await revertSnapshot(snapshot);
  });

  test("newChannel channel already exists between nodes", async t => {
    const snapshot = await takeSnapshot();
    const channelId =
      "0x1000000000000000000000000000000000000000000000000000000000000000";
    const channelId2 =
      "0x2000000000000000000000000000000000000000000000000000000000000000";
    const channelId3 =
      "0x3000000000000000000000000000000000000000000000000000000000000000";

    await createChannel(instance, channelId, 6, 6, 2);
    await t.shouldFail(createChannel(instance, channelId2, 6, 6, 2));

    await updateState(instance, channelId, 1, 5, 7);
    await startSettlingPeriod(instance, channelId);
    await mineBlocks(5);

    await instance.closeChannel(channelId);

    await createChannel(instance, channelId3, 6, 6, 2);

    await revertSnapshot(snapshot);
  });

  test("newChannel bad sig", async t => {
    const snapshot = await takeSnapshot();
    const channelId =
      "0x1000000000000000000000000000000000000000000000000000000000000000";

    await instance.depositToAddress.sendTransaction(ACCT_0_ADDR, { value: 12 });
    await instance.depositToAddress.sendTransaction(ACCT_1_ADDR, { value: 12 });

    const expiration = web3.eth.getBlock("latest").number + 5;

    const fingerprint = solSha3(
      "newChannel derp",
      channelId,
      ACCT_0_ADDR,
      ACCT_1_ADDR,
      6,
      6,
      expiration,
      2
    );

    const signature0 = sign(fingerprint, new Buffer(ACCT_0_PRIVKEY, "hex"));
    const signature1 = sign(fingerprint, new Buffer(ACCT_1_PRIVKEY, "hex"));

    await t.shouldFail(
      instance.newChannel(
        channelId,
        ACCT_0_ADDR,
        ACCT_1_ADDR,
        6,
        6,
        expiration,
        2,
        signature0,
        signature1
      )
    );

    await revertSnapshot(snapshot);
  });

  test("newChannel bad amount", async t => {
    const snapshot = await takeSnapshot();
    const channelId =
      "0x1000000000000000000000000000000000000000000000000000000000000000";

    await t.shouldFail(createChannel(instance, channelId, 6, 130, 2));
    await revertSnapshot(snapshot);
  });

  test("newChannel already exists", async t => {
    const snapshot = await takeSnapshot();
    const channelId =
      "0x1000000000000000000000000000000000000000000000000000000000000000";

    await createChannel(instance, channelId, 6, 6, 2);

    await t.shouldFail(createChannel(instance, channelId, 6, 6, 2));
    await revertSnapshot(snapshot);
  });

  test("newChannel wrong private key", async t => {
    const snapshot = await takeSnapshot();
    const channelId =
      "0x1000000000000000000000000000000000000000000000000000000000000000";

    await instance.depositToAddress.sendTransaction(ACCT_0_ADDR, { value: 12 });
    await instance.depositToAddress.sendTransaction(ACCT_1_ADDR, { value: 12 });

    const expiration = web3.eth.getBlock("latest").number + 5;

    const fingerprint = solSha3(
      "newChannel",
      channelId,
      ACCT_0_ADDR,
      ACCT_1_ADDR,
      6,
      6,
      expiration,
      2
    );

    const signature0 = sign(fingerprint, new Buffer(ACCT_0_PRIVKEY, "hex"));
    const signature1 = sign(fingerprint, new Buffer(ACCT_2_PRIVKEY, "hex"));

    await t.shouldFail(
      instance.newChannel(
        channelId,
        ACCT_0_ADDR,
        ACCT_1_ADDR,
        6,
        6,
        expiration,
        2,
        signature0,
        signature1
      )
    );
    await revertSnapshot(snapshot);
  });

  test("newChannel wrong public key", async t => {
    const snapshot = await takeSnapshot();
    const channelId =
      "0x1000000000000000000000000000000000000000000000000000000000000000";

    await instance.depositToAddress.sendTransaction(ACCT_0_ADDR, { value: 12 });
    await instance.depositToAddress.sendTransaction(ACCT_1_ADDR, { value: 12 });

    const expiration = web3.eth.getBlock("latest").number + 5;

    const fingerprint = solSha3(
      "newChannel",
      channelId,
      ACCT_0_ADDR,
      ACCT_1_ADDR,
      6,
      6,
      expiration,
      2
    );

    const signature0 = sign(fingerprint, new Buffer(ACCT_0_PRIVKEY, "hex"));
    const signature1 = sign(fingerprint, new Buffer(ACCT_1_PRIVKEY, "hex"));

    await t.shouldFail(
      instance.newChannel(
        channelId,
        ACCT_0_ADDR,
        ACCT_2_ADDR,
        6,
        6,
        expiration,
        2,
        signature0,
        signature1
      )
    );

    await instance.newChannel(
      channelId,
      ACCT_0_ADDR,
      ACCT_1_ADDR,
      6,
      6,
      expiration,
      2,
      signature0,
      signature1
    );

    await revertSnapshot(snapshot);
  });
};
