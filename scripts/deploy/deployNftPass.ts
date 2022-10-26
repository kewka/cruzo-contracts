import { ContractType } from "../../utils/addressTracking";
import { deployToken } from "../../utils/deployToken";

async function main() {
  await deployToken(
    {
      name: "Cruzo Pass",
      symbol: "CRZP",
      contractURI: "https://cruzo.cards/contract-metadata",
      publiclyMintable: false,
    },
    ContractType.whitelistToken
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
