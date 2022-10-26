import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {  Contract } from "ethers";
import { getEvent } from "../utils/getEvent";
import { RAW_FACTORY_INITIALIZE_SIGNATURE } from "../constants/signatures"
import { MerkleTree } from 'merkletreejs'
import { parseEther } from "ethers/lib/utils";

describe("Whitelist", () => {
    let beacon: Contract;
    let factory: Contract;
    let token: Contract;
    let whitelist: Contract;

    let creator: SignerWithAddress;
    let in1: SignerWithAddress;
    let in2: SignerWithAddress;
    let in3: SignerWithAddress;
    let out1: SignerWithAddress;

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

    beforeEach(async () => {
        [creator, in1, in2, in3, out1] = await ethers.getSigners();

        const Cruzo1155 = await ethers.getContractFactory("Cruzo1155");
        const Factory = await ethers.getContractFactory("Cruzo1155Factory");

        beacon = await upgrades.deployBeacon(Cruzo1155);
        await beacon.deployed();

        factory = await Factory.deploy(
            beacon.address,
            RAW_FACTORY_INITIALIZE_SIGNATURE,
            "https://cruzo.market",
            ethers.constants.AddressZero
        );
        await factory.deployed();

        const createTokenTx = await factory
            .connect(creator)
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

    describe("whitelist full process", () => {
        it("Should create merkle root and deploy whitelist", async () => {
            const WhiteList = await ethers.getContractFactory("CruzoWhiteList");
            const supply = ethers.BigNumber.from("1");
            const startId = ethers.BigNumber.from("1");
            const endId = ethers.BigNumber.from("6");
            const allowence = ethers.BigNumber.from("3");
            const price = ethers.utils.parseEther("0.5");
            const ids = [1, 2, 3, 4, 5, 6]
            const amounts = [1, 1, 1, 1, 1, 1]
            const wl = [
                in1.address,
                in2.address,
                in3.address, 
            ]
            const { keccak256 } = ethers.utils
            let leaves = wl.map((addr) => keccak256(addr))
            const merkleTree = new MerkleTree(leaves, keccak256, {sortPairs: true })
            const merkleRootHash = merkleTree.getHexRoot()
            for (let index = 1; index < 10; index++) {
                expect(
                    await token
                        .connect(creator)
                        .create(index, supply, creator.address, "", [], creator.address, 0)
                );
            }
            
            whitelist = await WhiteList.deploy(merkleRootHash, startId, endId, token.address, price, allowence);
            await whitelist.deployed();

            expect(await token.connect(creator).safeBatchTransferFrom(creator.address, whitelist.address, ids, amounts, "0x"))

            expect(await token.balanceOf(whitelist.address, startId)).eq(
                1
            );
            expect(await token.balanceOf(whitelist.address, endId)).eq(
                1
            );

            const proof_in1 = merkleTree.getHexProof(keccak256(in1.address))
            const proof_in2 = merkleTree.getHexProof(keccak256(in2.address))
            const proof_in3 = merkleTree.getHexProof(keccak256(in3.address))
            const proof_out1 = merkleTree.getHexProof(keccak256(out1.address))

            await whitelist.connect(in1).buy(proof_in1, 1, {value : parseEther("0.5")})
            
            expect(await token.balanceOf(in1.address, 1)).eq(
                1
            );
            await whitelist.connect(in1).buy(proof_in1, 2, {value : parseEther("1")})
            expect(await token.balanceOf(in1.address, 2)).eq(
                1
            );
            expect(await token.balanceOf(in1.address, 3)).eq(
                1
            );
            await whitelist.connect(in2).buy(proof_in2, 2, {value : parseEther("1")})
            expect(await token.balanceOf(in2.address, 4)).eq(
                1
            );
            expect(await token.balanceOf(in2.address, 5)).eq(
                1
            );

            await expect(whitelist.connect(out1).buy(proof_out1, 1, {value : parseEther("0.5")})).to.be.revertedWith("Whitelist: invalid proof");
            await expect(whitelist.connect(in1).buy(proof_in1, 1, {value : parseEther("0.5")})).to.be.revertedWith("WhiteList: To much NFT's in one hand");
            await expect(whitelist.connect(in2).buy(proof_in2, 1, {value : parseEther("0.4")})).to.be.revertedWith("Whitelist: incorrect sent value");
            await expect(whitelist.connect(in3).buy(proof_in3, 2, {value : parseEther("1")})).to.be.revertedWith("Whitelist: Not enough supply")

            await expect(whitelist.connect(in2).withdraw(in2.address)).to.be.revertedWith("Ownable: caller is not the owner")
            const balanceBefore = await creator.getBalance()
            await whitelist.connect(creator).withdraw(creator.address)
            expect(await creator.getBalance()).gt(balanceBefore)
        });
    });
});