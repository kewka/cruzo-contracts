import { ethers, network } from "hardhat";
import {
  ContractType,
  getAddress,
  setAddress,
} from "../../utils/addressTracking";
import { ContractReceipt } from "ethers";
import { getEvent } from "../../utils/getEvent";

async function main() {
  const chainId = network.config.chainId;
  if (!chainId) {
    throw "Chain ID is undefined, terminating";
  }
  const addressEntry = getAddress(chainId);
  if (!addressEntry || !addressEntry.factory) {
    throw "Factory address is undefined, nothing to update, terminating";
  }

  console.log("Deploying Token contract");
  const Factory = await ethers.getContractFactory("Cruzo1155Factory");
  const factory = await Factory.attach(addressEntry.factory);
  const tx = await factory.create(
    "Cruzo",
    "CRZ",
    "https://cruzo.cards/contract-metadata",
    false
  );
  const receipt: ContractReceipt = await tx.wait();
  const event = getEvent(receipt, "NewTokenCreated");
  const tokenAddress = event.args?.tokenAddress;
  console.log("Token Contract Deployed");
  console.log("Token Contract Address : ", tokenAddress);

  setAddress(chainId, ContractType.token, tokenAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
