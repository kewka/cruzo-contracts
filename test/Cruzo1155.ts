import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Cruzo1155 } from "../typechain";
import { Contract } from "ethers";
import { getEvent } from "../utils/getEvent";
import {
  RAW_VAULT_FUNCTION_SIGNATURE,
  RAW_FACTORY_INITIALIZE_SIGNATURE,
} from "../constants/signatures";

const tokenDetails = {
  name: "Cruzo",
  symbol: "CRZ",
  baseOnlyURI: "https://cruzo.io/tokens/{id}.json",
  baseAndIdURI: "https://cruzo.io/tokens",
  altBaseOnlyURI: "https://opensea.io/tokens/{id}.json",
  ipfsHash: "Qme3TrFkt28tLgHR2QXjH1ArfamtpkVsgMc9asdw3LXn7y",
  altBaseAndIdURI: "https:opensea.io/tokens/",
  collectionURI: "https://cruzo.io/collection",
};
const real = (inp: string) => inp + "0".repeat(9);

describe("Testing Cruzo1155 Contract", () => {
  let admin: SignerWithAddress;
  let user1: SignerWithAddress;

  let signers: SignerWithAddress[];

  let market: Contract;
  let beacon: Contract;
  let factory: Contract;
  let token: Contract;
  let token2: Contract;
  const serviceFee = 300;
  const royaltyFee = 500;

  before(async () => {
    signers = await ethers.getSigners();
    admin = signers[0];
    user1 = signers[1];
  });

  beforeEach(async () => {
    const CruzoMarket = await ethers.getContractFactory("CruzoMarket");
    const Cruzo1155 = await ethers.getContractFactory("Cruzo1155");
    const Factory = await ethers.getContractFactory("Cruzo1155Factory");

    market = await upgrades.deployProxy(
      CruzoMarket,
      [serviceFee, RAW_VAULT_FUNCTION_SIGNATURE],
      {
        kind: "uups",
      }
    );
    await market.deployed();

    beacon = await upgrades.deployBeacon(Cruzo1155);
    await beacon.deployed();

    factory = await Factory.deploy(
      beacon.address,
      RAW_FACTORY_INITIALIZE_SIGNATURE,
      tokenDetails.baseOnlyURI,
      market.address
    );
    await factory.deployed();

    const createTokenTx = await factory
      .connect(admin)
      .create(
        tokenDetails.name,
        tokenDetails.symbol,
        tokenDetails.collectionURI,
        true
      );
    const createTokenReceipt = await createTokenTx.wait();
    const createTokenEvent = getEvent(createTokenReceipt, "NewTokenCreated");
    token = await ethers.getContractAt(
      "Cruzo1155",
      createTokenEvent.args?.tokenAddress
    );
  });

  it("Check Contract Data", async () => {
    //expect(await token.marketAddress()).equal(signers[5].address);
    expect(await token.baseURI()).equal(tokenDetails.baseOnlyURI);
    await token.create(
      1,
      1,
      admin.address,
      tokenDetails.ipfsHash,
      [],
      admin.address,
      0
    );
    expect(await token.uri(1)).equal("ipfs://" + tokenDetails.ipfsHash);
  });

  it("Should update baseURI", async () => {
    await token.create(
      1,
      1,
      admin.address,
      tokenDetails.ipfsHash,
      [],
      admin.address,
      0
    );
    expect(await token.baseURI()).equal(tokenDetails.baseOnlyURI);
    await token.setBaseURI(tokenDetails.altBaseOnlyURI);
    expect(await token.baseURI()).eq(tokenDetails.altBaseOnlyURI);
    await token.setURIType(0);
    expect(await token.uri(1)).eq(tokenDetails.altBaseOnlyURI);
  });

  it("Should change URI Type", async () => {
    expect(await token.uriType()).eq(1);
    await token.setURIType(1);
    expect(await token.uriType()).eq(1);
  });

  it("Should return baseURI when URIType is Default", async () => {
    await token.create(
      0,
      1,
      admin.address,
      tokenDetails.ipfsHash,
      [],
      admin.address,
      0
    );
    await token.setURIType(0);
    expect(await token.uri(0)).eq(tokenDetails.baseOnlyURI);
  });

  it("Should return ipfs://tokenURI when URIType is IPFS ", async () => {
    await token.create(
      1,
      1,
      admin.address,
      tokenDetails.ipfsHash,
      [],
      admin.address,
      0
    );
    expect(await token.setURIType(1));
    expect(await token.setTokenURI(1, tokenDetails.ipfsHash));
    expect(await token.uri(1)).eq("ipfs://" + tokenDetails.ipfsHash);
  });

  it("Should return concatenaed basUri+id when URIType is ID and baseURI is set", async () => {
    await token.create(
      0,
      1,
      admin.address,
      tokenDetails.ipfsHash,
      [],
      admin.address,
      0
    );
    expect(await token.setURIType(2));
    expect(await token.uri(0)).eq(tokenDetails.baseOnlyURI + "/" + "0.json");
  });

  it("Should update balance and totalSupply on create", async () => {
    await token.create(1, 1000, admin.address, "", [], admin.address, 0);
    await token.create(2, 1, admin.address, "", [], admin.address, 0);
    expect(await token.balanceOf(admin.address, 1)).equal(1000);
    expect(await token.totalSupply(1)).equal(1000);
    expect(await token.balanceOf(admin.address, 2)).equal(1);
    expect(await token.totalSupply(2)).equal(1);
  });

  it("Should update creator on create()", async () => {
    await token.create(1, 1000, admin.address, "", [], admin.address, 0);
    expect(await token.creators(1)).equal(admin.address);
    await token.create(2, 1000, signers[1].address, "", [], admin.address, 0);
    expect(await token.creators(2)).equal(admin.address);
    await token
      .connect(signers[1])
      .create(3, 1, admin.address, "", [], admin.address, 0);
    expect(await token.creators(3)).equal(signers[1].address);
    await token
      .connect(signers[1])
      .create(4, 1, signers[1].address, "", [], admin.address, 0);
    expect(await token.creators(4)).equal(signers[1].address);
  });

  it("Should puase and unpause", async () => {
    await token.create(1, 1000, admin.address, "", [], admin.address, 0);
    await expect(
      token.safeTransferFrom(admin.address, signers[1].address, 1, 1, [])
    ).not.to.be.reverted;
    await token.pause();
    expect(await token.paused()).equal(true);
    await expect(
      token.safeTransferFrom(admin.address, signers[1].address, 1, 1, [])
    ).to.be.revertedWith("ERC1155CruzoBase: token transfer while paused");
    await token.unpause();
    expect(await token.paused()).equal(false);
    await expect(
      token.safeTransferFrom(admin.address, signers[1].address, 1, 1, [])
    ).not.to.be.reverted;
    expect(await token.balanceOf(signers[1].address, 1)).equal(2);
  });

  it("Should update balance and totalSupply on burn", async () => {
    await token.create(1, 1000, admin.address, "", [], admin.address, 0);
    expect(await token.totalSupply(1)).equal(1000);
    expect(await token.balanceOf(admin.address, 1)).equal(1000);
    await token.burn(admin.address, 1, 1);
    expect(await token.balanceOf(admin.address, 1)).equal(999);
    expect(await token.totalSupply(1)).equal(999);
  });

  it("Should not burn if msg.sender is not approved", async () => {
    await token.create(1, 1000, signers[1].address, "", [], admin.address, 0);
    await expect(token.burn(signers[1].address, 1, 1)).to.revertedWith(
      "ERC1155CruzoBase: caller is not owner nor approved"
    );
  });

  it("Should update balance and totalSupply on burnBatch", async () => {
    await token.create(1, 1000, admin.address, "", [], admin.address, 0);
    await token.create(2, 1000, admin.address, "", [], admin.address, 0);
    await token.burnBatch(admin.address, [1, 2], [2, 2]);
    const batchBal = await token.balanceOfBatch(
      [admin.address, admin.address],
      [1, 2]
    );
    expect(await token.totalSupply(1)).equal(998);
    expect(await token.totalSupply(2)).equal(998);
    expect(batchBal[0]).to.equal(998);
    expect(batchBal[1]).to.equal(998);
  });

  it("Should not create a token twice with the same tokenId", async () => {
    expect(
      await token.create(1, 1000, admin.address, "", [], admin.address, 0)
    );
    await expect(
      token.create(1, 1000, admin.address, "", [], admin.address, 0)
    ).revertedWith("Token is already created");
  });

  it("Should create unmintable token", async () => {
    const createToken2Tx = await factory
      .connect(admin)
      .create(
        tokenDetails.name,
        tokenDetails.symbol,
        tokenDetails.collectionURI,
        false
      );
    const createToken2Receipt = await createToken2Tx.wait();
    const createToken2Event = getEvent(createToken2Receipt, "NewTokenCreated");
    token2 = await ethers.getContractAt(
      "Cruzo1155",
      createToken2Event.args?.tokenAddress
    );
    await token2.create(1, 1000, admin.address, "", [], admin.address, 0);
    await expect(
      token2
        .connect(user1)
        .create(2, 1000, admin.address, "", [], admin.address, 0)
    ).to.be.revertedWith("Cruzo1155: not publicly mintable");
  });
});
