//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../tokens/Cruzo1155.sol";

import "../utils/Cruzo1155Factory.sol";

contract CruzoPassWl is Ownable {
    uint256 public constant MAX_PER_ACCOUNT = 3;
    uint256 public constant REWARDS = 20;
    uint256 public constant ALLOCATION = 180;
    uint256 public constant MAX_SUPPLY = ALLOCATION + REWARDS;

    address public tokenAddress;
    address public signerAddress;
    string[MAX_SUPPLY] private uris;
    uint256 public price;

    uint256 public tokenId;

    mapping(address => uint256) public allocation;

    event Mint(address to, uint256 tokenId);

    constructor(
        address _factoryAddress,
        address _signerAddress,
        address _rewardsAddress,
        string[MAX_SUPPLY] memory _uris,
        uint256 _price
    ) {
        tokenAddress = Cruzo1155Factory(_factoryAddress).create(
            "NFT Pass",
            "PASS",
            "",
            false
        );
        price = _price;
        uris = _uris;
        signerAddress = _signerAddress;

        // Mint rewards
        for (uint256 i = 0; i < REWARDS; i++) {
            _mint(_rewardsAddress);
        }
    }

    function _mint(address _to) internal {
        require(++tokenId <= MAX_SUPPLY, "Whitelist: not enough supply");
        Cruzo1155(tokenAddress).create(
            tokenId,
            1,
            _to,
            uris[tokenId - 1],
            "",
            _to,
            0
        );
        emit Mint(_to, tokenId);
    }

    function buy(uint256 _amount, bytes calldata _signature) external payable {
        require(
            ECDSA.recover(
                ECDSA.toEthSignedMessageHash(
                    bytes32(uint256(uint160(msg.sender)))
                ),
                _signature
            ) == signerAddress,
            "Whitelist: invalid signature"
        );

        require(
            _amount + allocation[msg.sender] <= MAX_PER_ACCOUNT,
            "Whitelist: too many NFT passes in one hand"
        );

        require(
            msg.value == _amount * price,
            "Whitelist: incorrect value sent"
        );

        allocation[msg.sender] += _amount;
        for (uint256 i = 0; i < _amount; i++) {
            _mint(msg.sender);
        }
    }

    function withdraw(address payable _to) external onlyOwner {
        Address.sendValue(_to, address(this).balance);
    }
}
