// cook mango twist then skin sort option civil have still rather guilt

const test = require("blue-tape");
const p = require("util").promisify;

const {
  ACCT_0_PRIVKEY,
  ACCT_0_ADDR,
  ACCT_1_PRIVKEY,
  ACCT_1_ADDR,
  ACCT_2_PRIVKEY,
  ACCT_2_ADDR
} = require("./constants.js");

const {
  filterLogs,
  takeSnapshot,
  revertSnapshot,
  solSha3,
  sign,
  reDraw,
  mineBlocks,
  createChannel,
  updateState,
  startSettlingPeriod
} = require("./utils.js");

module.exports = async (test, instance) => {
  test("reDraw happy path", async t => {
    const snapshot = await takeSnapshot();

    const channelId =
      "0x1000000000000000000000000000000000000000000000000000000000000000";

    // create channel with 6, 6 (both parties have 12 to start)
    await createChannel(instance, channelId, 6, 6, 2);

    t.equal((await instance.balanceOf.call(ACCT_0_ADDR)).c[0], 6);
    t.equal((await instance.balanceOf.call(ACCT_1_ADDR)).c[0], 6);

    // update channel to 5, 7, then 5, 1, effectively withdrawing 6 for address1,
    // bringing address1's balance to 12
    await reDraw(instance, channelId, 1, 5, 7, 5, 1);

    t.equal((await instance.balanceOf.call(ACCT_0_ADDR)).c[0], 6);
    t.equal((await instance.balanceOf.call(ACCT_1_ADDR)).c[0], 12);

    t.deepEqual(
      JSON.parse(JSON.stringify(await instance.channels(channelId))),
      [
        channelId,
        ACCT_0_ADDR,
        ACCT_1_ADDR,
        "6",
        "5",
        "1",
        "1",
        "2",
        false,
        "0",
        false
      ]
    );

    await revertSnapshot(snapshot);
  });

  test("reDraw oldBalance higher than total", async t => {
    const snapshot = await takeSnapshot();

    const channelId =
      "0x1000000000000000000000000000000000000000000000000000000000000000";

    await createChannel(instance, channelId, 6, 6, 2);

    await t.shouldFail(reDraw(instance, channelId, 1, 5, 50, 5, 1));

    await reDraw(instance, channelId, 1, 5, 7, 5, 1);

    await revertSnapshot(snapshot);
  });

  test("reDraw newBalance unaffordable", async t => {
    const snapshot = await takeSnapshot();

    const channelId =
      "0x1000000000000000000000000000000000000000000000000000000000000000";

    await createChannel(instance, channelId, 6, 6, 2);

    await t.shouldFail(reDraw(instance, channelId, 1, 5, 7, 5, 100));

    await reDraw(instance, channelId, 1, 5, 7, 5, 1);

    await revertSnapshot(snapshot);
  });

  test("reDraw old sequence number", async t => {
    const snapshot = await takeSnapshot();

    const channelId =
      "0x1000000000000000000000000000000000000000000000000000000000000000";

    await createChannel(instance, channelId, 6, 6, 2);

    await updateState(instance, channelId, 3, 5, 7);

    await t.shouldFail(reDraw(instance, channelId, 1, 5, 7, 5, 1));

    await reDraw(instance, channelId, 4, 5, 7, 5, 1);

    await revertSnapshot(snapshot);
  });

  test("reDraw expired tx", async t => {
    const snapshot = await takeSnapshot();

    const channelId =
      "0x1000000000000000000000000000000000000000000000000000000000000000";

    await createChannel(instance, channelId, 6, 6, 2);

    await t.shouldFail(
      reDraw(
        instance,
        channelId,
        1,
        5,
        7,
        5,
        1,
        web3.eth.getBlock("latest").number
      )
    );

    await reDraw(instance, channelId, 1, 5, 7, 5, 1);

    await revertSnapshot(snapshot);
  });

  test("reDraw nonexistant channel", async t => {
    const snapshot = await takeSnapshot();

    const channelId =
      "0x1000000000000000000000000000000000000000000000000000000000000000";

    await t.shouldFail(reDraw(instance, channelId, 1, 5, 7, 5, 1));

    await createChannel(instance, channelId, 6, 6, 2);

    await reDraw(instance, channelId, 1, 5, 7, 5, 1);

    await revertSnapshot(snapshot);
  });

  //   test("updateState nonexistant channel", async t => {
  //     const snapshot = await takeSnapshot();

  //     const channelId =
  //       "0x1000000000000000000000000000000000000000000000000000000000000000";

  //     await createChannel(instance, channelId, 6, 6, 2);

  //     await updateState(
  //       instance,
  //       "0x1000000000000000000000000000000000000000000000000000000000000000",
  //       1,
  //       5,
  //       7
  //     );

  //     await t.shouldFail(
  //       updateState(
  //         instance,
  //         "0x2000000000000000000000000000000000000000000000000000000000000000",
  //         1,
  //         5,
  //         7
  //       )
  //     );

  //     await revertSnapshot(snapshot);
  //   });

  //   test("channel closed before updateState", async t => {
  //     const snapshot = await takeSnapshot();
  //     const channelId =
  //       "0x1000000000000000000000000000000000000000000000000000000000000000";

  //     await createChannel(instance, channelId, 6, 6, 2);
  //     await startSettlingPeriod(instance, channelId);
  //     await updateState(instance, channelId, 1, 5, 7);
  //     await mineBlocks(5);

  //     await t.shouldFail(updateState(instance, channelId, 2, 5, 7));

  //     await revertSnapshot(snapshot);
  //   });

  //   test("updateState low seq #", async t => {
  //     const snapshot = await takeSnapshot();
  //     const channelId =
  //       "0x1000000000000000000000000000000000000000000000000000000000000000";

  //     await createChannel(instance, channelId, 6, 6, 2);
  //     await updateState(instance, channelId, 3, 5, 7);

  //     await t.shouldFail(updateState(instance, channelId, 2, 5, 7));

  //     await revertSnapshot(snapshot);
  //   });

  //   test("updateState bad fingerprint (string)", async t => {
  //     const snapshot = await takeSnapshot();

  //     const channelId =
  //       "0x1000000000000000000000000000000000000000000000000000000000000000";

  //     await createChannel(instance, channelId, 6, 6, 2);
  //     await updateState(instance, channelId, 1, 5, 7);

  //     const fingerprint = solSha3("updateState derp", channelId, 2, 5, 7);

  //     const signature0 = sign(fingerprint, new Buffer(ACCT_0_PRIVKEY, "hex"));
  //     const signature1 = sign(fingerprint, new Buffer(ACCT_1_PRIVKEY, "hex"));

  //     await t.shouldFail(
  //       instance.updateState(channelId, 2, 5, 7, signature0, signature1)
  //     );

  //     await revertSnapshot(snapshot);
  //   });

  //   test("updateState wrong private key", async t => {
  //     const snapshot = await takeSnapshot();

  //     const channelId =
  //       "0x1000000000000000000000000000000000000000000000000000000000000000";

  //     await createChannel(instance, channelId, 6, 6, 2);

  //     const fingerprint = solSha3("updateState", channelId, 1, 5, 7);

  //     const signature0 = sign(fingerprint, new Buffer(ACCT_0_PRIVKEY, "hex"));
  //     const signature1 = sign(fingerprint, new Buffer(ACCT_2_PRIVKEY, "hex"));

  //     await t.shouldFail(
  //       instance.updateState(channelId, 1, 5, 7, signature0, signature1)
  //     );

  //     await revertSnapshot(snapshot);
  //   });

  //   test("updateStateWithBounty happy path", async t => {
  //     const snapshot = await takeSnapshot();

  //     const channelId =
  //       "0x1000000000000000000000000000000000000000000000000000000000000000";

  //     const sequenceNumber = 1;

  //     const balance0 = 5;
  //     const balance1 = 7;

  //     await createChannel(instance, channelId, 6, 6, 2);

  //     await startSettlingPeriod(instance, channelId);

  //     const updateStateFingerprint = solSha3(
  //       "updateState",
  //       channelId,
  //       sequenceNumber,
  //       balance0,
  //       balance1
  //     );

  //     const signature0 = sign(
  //       updateStateFingerprint,
  //       new Buffer(ACCT_0_PRIVKEY, "hex")
  //     );
  //     const signature1 = sign(
  //       updateStateFingerprint,
  //       new Buffer(ACCT_1_PRIVKEY, "hex")
  //     );

  //     const bountyFingerprint = solSha3(
  //       "updateStateWithBounty",
  //       channelId,
  //       sequenceNumber,
  //       balance0,
  //       balance1,
  //       signature0,
  //       signature1,
  //       2
  //     );

  //     const bountySignature = sign(
  //       bountyFingerprint,
  //       new Buffer(ACCT_0_PRIVKEY, "hex")
  //     );

  //     await instance.updateStateWithBounty(
  //       channelId,
  //       sequenceNumber,
  //       balance0,
  //       balance1,
  //       signature0,
  //       signature1,
  //       2,
  //       bountySignature,
  //       { from: ACCT_2_ADDR }
  //     );

  //     t.equal((await instance.balanceOf.call(ACCT_2_ADDR)).toString(), "2");

  //     const channel = JSON.parse(
  //       JSON.stringify(await instance.channels(channelId))
  //     );

  //     t.deepEqual(channel, [
  //       channelId,
  //       ACCT_0_ADDR,
  //       ACCT_1_ADDR,
  //       "12",
  //       "5",
  //       "7",
  //       "1",
  //       "2",
  //       true,
  //       channel[9],
  //       false
  //     ]);

  //     await revertSnapshot(snapshot);
  //   });

  //   test("updateStateWithBounty settlingPeriod not started", async t => {
  //     const snapshot = await takeSnapshot();

  //     const channelId =
  //       "0x1000000000000000000000000000000000000000000000000000000000000000";

  //     const sequenceNumber = 1;

  //     const balance0 = 5;
  //     const balance1 = 7;

  //     await createChannel(instance, channelId, 6, 6, 2);

  //     const updateStateFingerprint = solSha3(
  //       "updateState",
  //       channelId,
  //       sequenceNumber,
  //       balance0,
  //       balance1
  //     );

  //     const signature0 = sign(
  //       updateStateFingerprint,
  //       new Buffer(ACCT_0_PRIVKEY, "hex")
  //     );
  //     const signature1 = sign(
  //       updateStateFingerprint,
  //       new Buffer(ACCT_1_PRIVKEY, "hex")
  //     );

  //     const bountyFingerprint = solSha3(
  //       "updateStateWithBounty",
  //       channelId,
  //       sequenceNumber,
  //       balance0,
  //       balance1,
  //       signature0,
  //       signature1,
  //       2
  //     );

  //     const bountySignature = sign(
  //       bountyFingerprint,
  //       new Buffer(ACCT_0_PRIVKEY, "hex")
  //     );

  //     await t.shouldFail(
  //       instance.updateStateWithBounty(
  //         channelId,
  //         sequenceNumber,
  //         balance0,
  //         balance1,
  //         signature0,
  //         signature1,
  //         2,
  //         bountySignature,
  //         { from: ACCT_2_ADDR }
  //       )
  //     );

  //     await startSettlingPeriod(instance, channelId);

  //     await instance.updateStateWithBounty(
  //       channelId,
  //       sequenceNumber,
  //       balance0,
  //       balance1,
  //       signature0,
  //       signature1,
  //       2,
  //       bountySignature,
  //       { from: ACCT_2_ADDR }
  //     );

  //     await revertSnapshot(snapshot);
  //   });

  //   test("updateStateWithBounty bad sig", async t => {
  //     const snapshot = await takeSnapshot();

  //     const channelId =
  //       "0x1000000000000000000000000000000000000000000000000000000000000000";

  //     const sequenceNumber = 1;

  //     const balance0 = 5;
  //     const balance1 = 7;

  //     await createChannel(instance, channelId, 6, 6, 2);

  //     await startSettlingPeriod(instance, channelId);

  //     const updateStateFingerprint = solSha3(
  //       "updateState",
  //       channelId,
  //       sequenceNumber,
  //       balance0,
  //       balance1
  //     );

  //     const signature0 = sign(
  //       updateStateFingerprint,
  //       new Buffer(ACCT_0_PRIVKEY, "hex")
  //     );
  //     const signature1 = sign(
  //       updateStateFingerprint,
  //       new Buffer(ACCT_1_PRIVKEY, "hex")
  //     );

  //     const bountyFingerprint = solSha3(
  //       "updateStateWithBounty",
  //       channelId,
  //       sequenceNumber,
  //       balance0,
  //       balance1,
  //       signature0,
  //       signature1,
  //       2
  //     );

  //     const bountySignature = sign(
  //       bountyFingerprint,
  //       new Buffer(ACCT_0_PRIVKEY, "hex")
  //     );

  //     const badBountyFingerprint = solSha3(
  //       "updateStateWithBounty derp",
  //       channelId,
  //       sequenceNumber,
  //       balance0,
  //       balance1,
  //       signature0,
  //       signature1,
  //       2
  //     );

  //     const badBountySignature = sign(
  //       badBountyFingerprint,
  //       new Buffer(ACCT_0_PRIVKEY, "hex")
  //     );

  //     await t.shouldFail(
  //       instance.updateStateWithBounty(
  //         channelId,
  //         sequenceNumber,
  //         balance0,
  //         balance1,
  //         signature0,
  //         signature1,
  //         2,
  //         badBountySignature,
  //         { from: ACCT_2_ADDR }
  //       )
  //     );

  //     // await instance.updateStateWithBounty(
  //     //   channelId,
  //     //   sequenceNumber,
  //     //   balance0,
  //     //   balance1,
  //     //   signature0,
  //     //   signature1,
  //     //   2,
  //     //   bountySignature,
  //     //   { from: ACCT_2_ADDR }
  //     // );

  //     await revertSnapshot(snapshot);
  //   });
};