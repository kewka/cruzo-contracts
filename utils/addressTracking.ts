import fs from "fs";

export enum ContractType {
  beacon = "beacon",
  market = "market",
  factory = "factory",
  token = "token",
  vault = "vault",
  wl = "whitelist",
  wl_token = "wlToken"
}

type AddressTrackingEntry = {
  [key in ContractType]?: string;
};

type AddressTrackingMap = Map<string, AddressTrackingEntry>;

const addressMappingFileName = process.env.ADDRESS_MAPPING_FILENAME || "";

export const getAddress = (
  chainId: number
): AddressTrackingEntry | undefined => {
  try {
    const addressMapping = getMapping(addressMappingFileName);
    return addressMapping.get(chainId.toString());
  } catch (e) {
    console.warn("Could not retrieve contract address");
  }
};

export const setAddress = (
  chainId: number,
  contract: ContractType,
  address: string
): void => {
  if (!chainId || !contract || !address) {
    throw new Error(
      `Missing one of mandatory arguments: [${chainId}, ${contract}, ${address}]`
    );
  }
  try {
    const addressMapping = getMapping(addressMappingFileName);
    const networkEntry = addressMapping.get(chainId.toString()) || {};
    networkEntry[contract] = address;
    addressMapping.set(chainId.toString(), networkEntry);
    setMapping(addressMappingFileName, addressMapping);
  } catch (e) {
    console.warn("Could not update contract address");
    console.log(e);
  }
};

const getMapping = (fileName: string): AddressTrackingMap => {
  const jsonContent = fs.readFileSync(fileName, {
    encoding: "utf8",
  });
  return new Map(Object.entries(JSON.parse(jsonContent)));
};

const setMapping = (fileName: string, mapping: AddressTrackingMap) => {
  fs.writeFileSync(
    fileName,
    JSON.stringify(Object.fromEntries(mapping), null, 2)
  );
};
