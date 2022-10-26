import { ethers, network } from "hardhat";
import { ContractType, getAddress, setAddress } from "./addressTracking";
import { ContractReceipt } from "ethers";
import { getEvent } from "./getEvent";

interface IDeployTokenParams {
  name: string;
  symbol: string;
  contractURI: string;
  publiclyMintable: boolean;
}

export const deployToken = async (
  initParams: IDeployTokenParams,
  type: ContractType
): Promise<void> => {
  const { name, symbol, contractURI, publiclyMintable } = initParams;
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
  const tx = await factory.create(name, symbol, contractURI, publiclyMintable);
  const receipt: ContractReceipt = await tx.wait();
  const event = getEvent(receipt, "NewTokenCreated");
  const tokenAddress = event.args?.tokenAddress;
  console.log("Token Contract Deployed");
  console.log("Token Contract Address : ", tokenAddress);

  setAddress(chainId, type, tokenAddress);
};
