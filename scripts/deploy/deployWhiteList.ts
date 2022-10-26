import { ethers, network } from "hardhat";
import { ContractType, setAddress, getAddress } from "../../utils/addressTracking";
import { generateMerkleTree } from "../../utils/whitelist";
import { ALLOWED_PER_PERSON, START_ID, END_ID, PRICE } from "../../constants/whitelist";
import { parseEther } from "ethers/lib/utils";

async function main() {
  const chainId = network.config.chainId;
  if (!chainId) {
    throw "Chain ID is undefined, terminating";
  }
  console.log("Deploying White list contract");
  const WL = await ethers.getContractFactory("CruzoWhiteList");

  const merkleRoot = (await generateMerkleTree()).getHexRoot()

  const tokenAddress = getAddress(chainId)!.wlToken;
  if (!tokenAddress) {
    throw "Token address is undefined, terminating";
  }

  const wl = await WL.deploy(merkleRoot, START_ID, END_ID, tokenAddress, parseEther(PRICE), ALLOWED_PER_PERSON);
  await wl.deployed();

  console.log("White list Contract Deployed");
  console.log("White list Contract Address : ", wl.address);
  

  setAddress(chainId, ContractType.wl, wl.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
