//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";

contract CruzoWhitelist is Ownable, ERC1155Holder {
    bytes32 public merkleRoot;
    uint256 public currentId;
    uint256 public endId;
    address public tokenAddress;
    uint256 public price;
    uint256 public allowedPerPerson;

    mapping(address => uint256) allocation;

    event BuyCommitted(address, uint256, uint256[]);

    constructor(
        bytes32 _merkleRootInitHash,
        uint256 _startId,
        uint256 _endId,
        address _tokenAddress,
        uint256 _price,
        uint256 _allowedPerPerson
    ) {
        merkleRoot = _merkleRootInitHash;
        currentId = _startId;
        endId = _endId;
        tokenAddress = _tokenAddress;
        price = _price;
        allowedPerPerson = _allowedPerPerson;
    }

    function setMerkleRoot(bytes32 merkleRootHash) external onlyOwner {
        merkleRoot = merkleRootHash;
    }

    function verifyAddress(bytes32[] calldata _merkleProof)
        private
        view
        returns (bool)
    {
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        return MerkleProof.verify(_merkleProof, merkleRoot, leaf);
    }

    function buy(bytes32[] calldata _merkleProof, uint256 _amount)
        external
        payable
    {
        require(
            _amount + allocation[msg.sender] <= allowedPerPerson,
            "Whitelist: too many NFT passes in one hand"
        );
        require(verifyAddress(_merkleProof), "Whitelist: invalid proof");
        require(
            msg.value == _amount * price,
            "Whitelist: incorrect value sent"
        );
        allocation[msg.sender] += _amount;
        (uint256[] memory ids, uint256[] memory amounts) = getTokenId(_amount);
        IERC1155Upgradeable(tokenAddress).safeBatchTransferFrom(
            address(this),
            msg.sender,
            ids,
            amounts,
            ""
        );
        emit BuyCommitted(msg.sender, _amount, ids);
    }

    function getTokenId(uint256 _amount)
        internal
        returns (uint256[] memory, uint256[] memory)
    {
        uint256[] memory ids = new uint256[](_amount);
        uint256[] memory amounts = new uint256[](_amount);
        require(currentId + _amount <= endId, "Whitelist: not enough supply");

        for (uint256 i = 0; i < _amount; i++) {
            ids[i] = currentId;
            currentId++;
            amounts[i] = 1;
        }
        return (ids, amounts);
    }

    function withdraw(address payable _to) external onlyOwner{
        _to.transfer(address(this).balance);
    }
}
