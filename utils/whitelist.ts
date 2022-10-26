import { ethers } from "hardhat";
import { MerkleTree } from "merkletreejs";
import fs from "fs";
import { keccak256 } from "ethers/lib/utils";

export const wlAddressesFilename =
  process.env.WHITELIST_ADDRESSES_FILENAME || "";
export const merkleTreeFilename = process.env.MERKLE_TREE_FILENAME || "";

async function getWLAddresses(fileName: string) {
  const jsonContent = fs.readFileSync(fileName, {
    encoding: "utf8",
  });

  return JSON.parse(jsonContent);
}

export async function generateMerkleTree() {
  const wl = await getWLAddresses(wlAddressesFilename);
  if(wl.len() == 0){
    throw "Length of white list is zero, terminating";
  }
  const { keccak256 } = ethers.utils;
  let leaves = wl.map((addr: string) => keccak256(addr));
  return new MerkleTree(leaves, keccak256, { sortPairs: true });
}

export async function generateProof(address: string) {
  const merkleTree = await generateMerkleTree();
  return merkleTree.getHexProof(keccak256(address));
}
