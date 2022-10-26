import { generateMerkleTree, generateProof } from "../../utils/whitelist";

async function main() {
  const merkleTree = await generateMerkleTree();
  console.log("Merkle Tree : ", merkleTree);
  console.log("Merkle Tree Root : ", merkleTree.getHexRoot());
  console.log(
    "Proof : ",
    await generateProof("0x10bD96741BE46af260Aa9Fa861081D5445B94f04")
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
