const PaymentChannels = artifacts.require("PaymentChannels.sol")
const { throwing, reverting } = require("./helpers/shouldFail.js")
const { ACCT_A, ACCT_B,} = require("./constants.js");

const {
  provider,
  createChannel,
  updateState,
  startSettlingPeriod,
  mineBlocks,
  solSha3,
  sign,
  revertSnapshot,
  takeSnapshot,
} = require("./utils.js");

module.exports = contract("PaymentChannels::newChannel", () => {

  let instance, snapshotId
  before(async () => {
    instance = await PaymentChannels.deployed()
  })

  beforeEach(async () => {
    snapshotId = await takeSnapshot()
  })

  afterEach(async () => {
    await revertSnapshot(snapshotId)
  })

  it("newChannel happy path", async () => {
    const tx = await createChannel(instance, 6, 6, 2);
    assert.equal(tx.logs[0].event, "ChannelOpened");
    const channelId = tx.logs[0].args._channelId;

    assert.equal((await instance.balanceOf(ACCT_A.address)).toNumber(), 6);
    assert.equal((await instance.balanceOf(ACCT_B.address)).toNumber(), 6);

    // This for loop is to remove the extra values of the channels
    // call. New web3v1 returns a JSON object so this just prepares
    // the extra values.
    let channel = await instance.channels(channelId)
    let compare = []
    for(var i = 0; i < (Object.keys(channel).length)/2; i++) {
      // web3 1 returns BN so just converting to string
      if(web3.utils.isBN(channel[i])) {
        channel[i] = channel[i].toString()
      }
      compare.push(channel[i])
    }

    assert.deepEqual(
      compare,
      [ACCT_A.address, ACCT_B.address, "12", "6", "6", "0", "2", false, "0"]
    )
  })

  it("newChannel expired", async () => {
    await reverting(createChannel(instance, 6, 6, 2, 0))
    await createChannel(instance, 6, 6, 2);
  })

  it("newChannel channel already exists between nodes", async () => {
    const tx = await createChannel(instance, 6, 6, 2);
    await reverting(createChannel(instance, 6, 6, 2));
    const channelId = tx.logs[0].args._channelId;

    await updateState(instance, channelId, 1, 5, 7);
    await startSettlingPeriod(instance, channelId);
    await mineBlocks(5);

    await instance.closeChannel(channelId);
    await createChannel(instance, 6, 6, 2);
  })

  it("newChannel bad sig", async () => {
    await instance.depositToAddress(ACCT_A.address, { value: 12 })
    await instance.depositToAddress(ACCT_B.address, { value: 12 })

    const expiration = await provider.getBlockNumber() + 5;

    const badFingerprint = solSha3(
      [
        'string',
        'address',
        'address',
        'address',
        'uint256',
        'uint256',
        'uint256',
        'uint256',
      ],[
        "newChannel derp",
        instance.address,
        ACCT_A.address,
        ACCT_B.address,
        6,
        6,
        expiration,
        2
      ]
    )

    const badSignature0 = sign(badFingerprint, ACCT_A);
    const badSignature1 = sign(badFingerprint, ACCT_B);

    await reverting(
      instance.newChannel(
        ACCT_A.address,
        ACCT_B.address,
        6,
        6,
        expiration,
        2,
        badSignature0,
        badSignature1
      )
    );

    const fingerprint = solSha3(
      [
        'string',
        'address',
        'address',
        'address',
        'uint256',
        'uint256',
        'uint256',
        'uint256',
      ],[
        "newChannel",
        instance.address,
        ACCT_A.address,
        ACCT_B.address,
        6,
        6,
        expiration,
        2
      ]
    )

    const signature0 = sign(fingerprint, ACCT_A);
    const signature1 = sign(fingerprint, ACCT_B);

    await instance.newChannel(
      ACCT_A.address,
      ACCT_B.address,
      6,
      6,
      expiration,
      2,
      signature0,
      signature1
    );
    })

  it("newChannel bad amount", async () => {
    await throwing(createChannel(instance, 6, 130, 2))
  })
  it("newChannel already exists", async () => {
    await createChannel(instance, 6, 6, 2);
    await reverting(createChannel(instance, 6, 6, 2));
  })
});
