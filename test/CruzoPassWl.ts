import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";
import { RAW_FACTORY_INITIALIZE_SIGNATURE } from "../constants/signatures";
import { Cruzo1155, CruzoPassWl } from "../typechain";

describe("CruzoPassWl", () => {
  const MAX_PER_ACCOUNT = 3;
  const REWARDS = 20;
  const ALLOCATION = 180;
  const MAX_SUPPLY = REWARDS + ALLOCATION;
  const uris = [...Array(MAX_SUPPLY)].map((_, i) => `uri_${i + 1}`);
  const price = ethers.utils.parseEther("0.5");

  let owner: SignerWithAddress;
  let signer: SignerWithAddress;
  let rewardsAccount: SignerWithAddress;

  let passWl: CruzoPassWl;
  let token: Cruzo1155;

  async function sign(address: string): Promise<string> {
    return await signer.signMessage(
      ethers.utils.arrayify(ethers.utils.hexZeroPad(address, 32))
    );
  }

  async function createMember() {
    const member = ethers.Wallet.createRandom().connect(ethers.provider);
    await ethers.provider.send("hardhat_setBalance", [
      member.address,
      "0x" + parseEther("10000").toBigInt().toString(16),
    ]);
    return member;
  }

  beforeEach(async () => {
    [owner, signer, rewardsAccount] = await ethers.getSigners();

    const Cruzo1155 = await ethers.getContractFactory("Cruzo1155");
    const Factory = await ethers.getContractFactory("Cruzo1155Factory");

    const beacon = await upgrades.deployBeacon(Cruzo1155);
    await beacon.deployed();

    const factory = await Factory.deploy(
      beacon.address,
      RAW_FACTORY_INITIALIZE_SIGNATURE,
      "https://cruzo.market",
      ethers.constants.AddressZero
    );
    await factory.deployed();

    const CruzoPassWl = await ethers.getContractFactory("CruzoPassWl");

    passWl = await CruzoPassWl.deploy(
      factory.address,
      signer.address,
      rewardsAccount.address,
      uris as any,
      price
    );

    await passWl.deployed();
    token = Cruzo1155.attach(await passWl.tokenAddress());
  });

  it("Should create a new Cruzo1155", async () => {
    expect(await passWl.tokenAddress()).eq(token.address);
    expect(await token.owner()).eq(passWl.address);
  });

  it("Should get MAX_PER_ACCOUNT", async () => {
    expect(await passWl.MAX_PER_ACCOUNT()).eq(MAX_PER_ACCOUNT);
  });

  it("Should get REWARDS", async () => {
    expect(await passWl.REWARDS()).eq(REWARDS);
  });

  it("Should get ALLOCATION", async () => {
    expect(await passWl.ALLOCATION()).eq(ALLOCATION);
  });

  it("Should get MAX_SUPPLY", async () => {
    expect(await passWl.MAX_SUPPLY()).eq(MAX_SUPPLY);
  });

  it("Should get signerAddress", async () => {
    expect(await passWl.signerAddress()).eq(signer.address);
  });

  it("Should get price", async () => {
    expect(await passWl.price()).eq(price);
  });

  it("Should get owner", async () => {
    expect(await passWl.owner()).eq(owner.address);
  });

  it("Should mint 20 tokens to rewards account", async () => {
    for (let i = 0; i < REWARDS; i++) {
      const tokenId = i + 1;
      expect(await token.balanceOf(rewardsAccount.address, tokenId)).eq(1);
      expect(await token.uri(tokenId)).eq("ipfs://" + uris[i]);
    }
    expect(await passWl.tokenId()).eq(REWARDS);
  });

  it("Should buy 1 token", async () => {
    const member = await createMember();
    const tokenId = REWARDS + 1;
    const signature = await sign(member.address);

    expect(await ethers.provider.getBalance(passWl.address)).eq(0);
    expect(await token.balanceOf(member.address, tokenId)).eq(0);

    await expect(
      passWl.connect(member).buy(1, signature, {
        value: price,
      })
    )
      .emit(passWl, "Mint")
      .withArgs(member.address, tokenId);

    expect(await passWl.tokenId()).eq(tokenId);
    expect(await ethers.provider.getBalance(passWl.address)).eq(price);
    expect(await token.balanceOf(member.address, tokenId)).eq(1);
  });

  it("Should buy all allocated tokens", async () => {
    const MAX_SUPPLY = await passWl.MAX_SUPPLY();
    const MAX_PER_ACCOUNT = await passWl.MAX_PER_ACCOUNT();
    let tokenId = await passWl.tokenId();

    expect(await ethers.provider.getBalance(passWl.address)).eq(0);

    while (tokenId.lt(MAX_SUPPLY)) {
      const member = await createMember();

      const amount = Math.min(
        MAX_PER_ACCOUNT.toNumber(),
        MAX_SUPPLY.sub(tokenId).toNumber()
      );

      expect(
        await passWl.connect(member).buy(amount, await sign(member.address), {
          value: price.mul(amount),
        })
      );

      for (let i = 0; i < amount; i++) {
        tokenId = tokenId.add(1);
        expect(await token.balanceOf(member.address, tokenId)).eq(1);
        expect(await token.uri(tokenId)).eq(
          "ipfs://" + uris[tokenId.sub(1).toNumber()]
        );
      }
    }

    expect(await passWl.tokenId()).eq(MAX_SUPPLY);

    expect(await ethers.provider.getBalance(passWl.address)).eq(
      price.mul(ALLOCATION)
    );

    // reverts here
    const member = await createMember();
    await expect(
      passWl.connect(member).buy(1, await sign(member.address), {
        value: price,
      })
    ).revertedWith("Whitelist: not enough supply");
  });

  it("Should revert when the signature is invalid", async () => {
    const member = await createMember();
    const signature = await signer.signMessage("invalid message");

    await expect(
      passWl.connect(member).buy(1, signature, {
        value: price,
      })
    ).revertedWith("Whitelist: invalid signature");
  });

  it("Should revert when the value is incorrect", async () => {
    const member = await createMember();
    const signature = await sign(member.address);

    await expect(passWl.connect(member).buy(1, signature)).revertedWith(
      "Whitelist: incorrect value sent"
    );
  });

  it("Should revert when the amount exceeds MAX_PER_ACCOUNT", async () => {
    const member = await createMember();
    const signature = await sign(member.address);

    const MAX_PER_ACCOUNT = await passWl.MAX_PER_ACCOUNT();

    expect(
      await passWl.connect(member).buy(MAX_PER_ACCOUNT, signature, {
        value: MAX_PER_ACCOUNT.mul(price),
      })
    );

    expect(await passWl.allocation(member.address)).eq(MAX_PER_ACCOUNT);

    await expect(
      passWl.connect(member).buy(1, signature, {
        value: price,
      })
    ).revertedWith("Whitelist: too many NFT passes in one hand");
  });

  it("Should withdraw", async () => {
    expect(await ethers.provider.getBalance(passWl.address)).eq(0);

    const wei = "10000000000000";
    await ethers.provider.send("hardhat_setBalance", [
      passWl.address,
      "0x" + BigInt(wei).toString(16),
    ]);

    expect(await ethers.provider.getBalance(passWl.address)).eq(wei);

    const to = ethers.Wallet.createRandom();
    expect(await ethers.provider.getBalance(to.address)).eq(0);
    expect(await passWl.withdraw(to.address));
    expect(await ethers.provider.getBalance(passWl.address)).eq(0);
    expect(await ethers.provider.getBalance(to.address)).eq(wei);

    // reverts here
    const member = await createMember();
    await expect(passWl.connect(member).withdraw(member.address)).revertedWith(
      "Ownable: caller is not the owner"
    );
  });
});
