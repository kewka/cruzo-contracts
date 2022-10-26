import { ethers, network } from "hardhat";
import {
  ContractType,
  setAddress,
  getAddress,
} from "../../utils/addressTracking";
import { generateMerkleTree } from "../../utils/whitelist";
import {
  ALLOWED_PER_PERSON,
  START_ID,
  END_ID,
  PRICE,
} from "../../constants/whitelist";
import { parseEther } from "ethers/lib/utils";

async function main() {
  const chainId = network.config.chainId;
  if (!chainId) {
    throw "Chain ID is undefined, terminating";
  }
  console.log("Deploying Whitelist contract");
  const Whitelist = await ethers.getContractFactory("CruzoWhitelist");
  const merkleTree = await generateMerkleTree();
  const merkleRoot = merkleTree.getHexRoot();

  const tokenAddress = getAddress(chainId)!.whitelistToken;
  if (!tokenAddress) {
    throw "Token address is undefined, terminating";
  }

  console.log("Merkle Tree Generated");
  console.log("Merkle Tree root : ", merkleRoot);
  console.log("Price in ethers : ", parseEther(PRICE));

  const whitelist = await Whitelist.deploy(
    merkleRoot,
    START_ID,
    END_ID,
    tokenAddress,
    parseEther(PRICE),
    ALLOWED_PER_PERSON
  );
  await whitelist.deployed();

  console.log("White list Contract Deployed");
  console.log("White list Contract Address : ", whitelist.address);

  setAddress(chainId, ContractType.whitelist, whitelist.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
