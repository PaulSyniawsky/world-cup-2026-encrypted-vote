import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FHEWorldCupVote, FHEWorldCupVote__factory } from "../types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { FhevmType } from "@fhevm/hardhat-plugin";

interface TestUsers {
  deployer: HardhatEthersSigner;
  player1: HardhatEthersSigner;
  player2: HardhatEthersSigner;
}

describe("FHEWorldCupVote Contract", function () {
  let contract: FHEWorldCupVote;
  let contractAddress: string;
  let users: TestUsers;

  async function deployContractFixture() {
    const factory = (await ethers.getContractFactory("FHEWorldCupVote")) as FHEWorldCupVote__factory;
    const instance = (await factory.deploy()) as FHEWorldCupVote;
    return { instance, address: await instance.getAddress() };
  }

  before(async () => {
    const signers = await ethers.getSigners();
    users = { deployer: signers[0], player1: signers[1], player2: signers[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("Skipping tests: require mock FHEVM environment");
      this.skip();
    }

    ({ instance: contract, address: contractAddress } = await deployContractFixture());
  });

  // ================= Basic Registration Checks =================
  it("initially marks all addresses as unregistered", async () => {
    expect(await contract.isRegistered(users.player1.address)).to.eq(false);
    expect(await contract.isRegistered(users.player2.address)).to.eq(false);
    expect(await contract.canSubmit(users.player1.address)).to.eq(true);
  });

  it("allows a user to submit an encrypted prediction", async () => {
    const prediction = 7; // Team ID
    const cipher = await fhevm.createEncryptedInput(contractAddress, users.player1.address).add32(prediction).encrypt();

    await (await contract.connect(users.player1).recordEncryptedGuess(cipher.handles[0], cipher.inputProof)).wait();

    expect(await contract.isRegistered(users.player1.address)).to.eq(true);
    expect(await contract.canSubmit(users.player1.address)).to.eq(false);

    const decrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await contract.readEncryptedGuess(users.player1.address),
      contractAddress,
      users.player1,
    );
    expect(decrypted).to.eq(prediction);
  });

  it("prevents duplicate submissions from the same wallet", async () => {
    const firstChoice = 3;
    const firstEncrypted = await fhevm
      .createEncryptedInput(contractAddress, users.player2.address)
      .add32(firstChoice)
      .encrypt();

    await (
      await contract.connect(users.player2).recordEncryptedGuess(firstEncrypted.handles[0], firstEncrypted.inputProof)
    ).wait();

    const secondChoice = 5;
    const secondEncrypted = await fhevm
      .createEncryptedInput(contractAddress, users.player2.address)
      .add32(secondChoice)
      .encrypt();

    await expect(
      contract.connect(users.player2).recordEncryptedGuess(secondEncrypted.handles[0], secondEncrypted.inputProof),
    ).to.be.revertedWith("You already submitted");
  });

  // ================= Multi-user Interaction =================
  it("supports multiple participants independently", async () => {
    const player1Choice = 1;
    const player2Choice = 8;

    const enc1 = await fhevm
      .createEncryptedInput(contractAddress, users.player1.address)
      .add32(player1Choice)
      .encrypt();
    const enc2 = await fhevm
      .createEncryptedInput(contractAddress, users.player2.address)
      .add32(player2Choice)
      .encrypt();

    await (await contract.connect(users.player1).recordEncryptedGuess(enc1.handles[0], enc1.inputProof)).wait();
    await (await contract.connect(users.player2).recordEncryptedGuess(enc2.handles[0], enc2.inputProof)).wait();

    const dec1 = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await contract.readEncryptedGuess(users.player1.address),
      contractAddress,
      users.player1,
    );
    const dec2 = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await contract.readEncryptedGuess(users.player2.address),
      contractAddress,
      users.player2,
    );

    expect(dec1).to.eq(player1Choice);
    expect(dec2).to.eq(player2Choice);
  });

  it("handles unusual team IDs gracefully", async () => {
    const weirdChoice = 99;
    const encrypted = await fhevm
      .createEncryptedInput(contractAddress, users.player2.address)
      .add32(weirdChoice)
      .encrypt();

    await (
      await contract.connect(users.player2).recordEncryptedGuess(encrypted.handles[0], encrypted.inputProof)
    ).wait();

    const decrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      await contract.readEncryptedGuess(users.player2.address),
      contractAddress,
      users.player2,
    );
    expect(decrypted).to.eq(weirdChoice);
  });

  it("allows multiple users to submit consecutively without interference", async () => {
    const choices = [2, 6, 11];
    const participants = [users.deployer, users.player1, users.player2];

    for (let i = 0; i < participants.length; i++) {
      const enc = await fhevm
        .createEncryptedInput(contractAddress, participants[i].address)
        .add32(choices[i])
        .encrypt();
      await (await contract.connect(participants[i]).recordEncryptedGuess(enc.handles[0], enc.inputProof)).wait();
    }

    for (let i = 0; i < participants.length; i++) {
      expect(await contract.isRegistered(participants[i].address)).to.eq(true);
      const decrypted = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        await contract.readEncryptedGuess(participants[i].address),
        contractAddress,
        participants[i],
      );
      expect(decrypted).to.eq(choices[i]);
    }
  });
});
