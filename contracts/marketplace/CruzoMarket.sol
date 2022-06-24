//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract CruzoMarket is ERC1155Holder, Ownable, ReentrancyGuard {
    event TradeOpened(
        address tokenAddress,
        uint256 tokenId,
        address seller,
        uint256 amount,
        uint256 price
    );

    event TradeExecuted(
        address tokenAddress,
        uint256 tokenId,
        address seller,
        address buyer,
        address recipient,
        uint256 amount
    );

    event TradeClosed(address tokenAddress, uint256 tokenId, address seller);

    event TradePriceChanged(
        address tokenAddress,
        uint256 tokenId,
        address seller,
        uint256 price
    );

    event WithdrawalCompleted(address beneficiaryAddress, uint256 _amount);

    struct Trade {
        uint256 amount;
        uint256 price;
    }

    // tokenAddress => tokenId => seller => trade
    mapping(address => mapping(uint256 => mapping(address => Trade)))
        public trades;

    // Service fee percentage in basis point (100bp = 1%)
    uint16 public serviceFee;

    constructor(uint16 _serviceFee) {
        setServiceFee(_serviceFee);
    }

    function openTrade(
        address _tokenAddress,
        uint256 _tokenId,
        uint256 _amount,
        uint256 _price
    ) external nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        require(
            trades[_tokenAddress][_tokenId][msg.sender].amount == 0,
            "Trade is already open"
        );
        IERC1155(_tokenAddress).safeTransferFrom(
            msg.sender,
            address(this),
            _tokenId,
            _amount,
            ""
        );
        trades[_tokenAddress][_tokenId][msg.sender] = Trade({
            amount: _amount,
            price: _price
        });
        emit TradeOpened(_tokenAddress, _tokenId, msg.sender, _amount, _price);
    }

    function executeTrade(
        address _tokenAddress,
        uint256 _tokenId,
        address _seller,
        address _recipient,
        uint256 _amount
    ) external payable nonReentrant {
        require(
            msg.sender != _seller,
            "Trade cannot be executed by the seller"
        );
        Trade storage trade = trades[_tokenAddress][_tokenId][_seller];
        require(_amount > 0, "Amount must be greater than 0");
        require(trade.amount >= _amount, "Not enough items in trade");
        require(
            msg.value == trade.price * _amount,
            "Ether value sent is incorrect"
        );
        trade.amount -= _amount;
        IERC1155(_tokenAddress).safeTransferFrom(
            address(this),
            _recipient,
            _tokenId,
            _amount,
            ""
        );
        Address.sendValue(
            payable(_seller),
            (msg.value * (10000 - uint256(serviceFee))) / 10000
        );
        emit TradeExecuted(
            _tokenAddress,
            _tokenId,
            _seller,
            msg.sender,
            _recipient,
            _amount
        );
    }

    function closeTrade(address _tokenAddress, uint256 _tokenId)
        external
        nonReentrant
    {
        Trade memory trade = trades[_tokenAddress][_tokenId][msg.sender];
        require(trade.amount > 0, "Trade is not open");
        IERC1155(_tokenAddress).safeTransferFrom(
            address(this),
            msg.sender,
            _tokenId,
            trade.amount,
            ""
        );
        delete trades[_tokenAddress][_tokenId][msg.sender];
        emit TradeClosed(_tokenAddress, _tokenId, msg.sender);
    }

    function setServiceFee(uint16 _serviceFee) public onlyOwner {
        require(
            _serviceFee <= 10000,
            "Service fee can not exceed 10,000 basis points"
        );
        serviceFee = _serviceFee;
    }

    function withdraw(address _beneficiaryAddress, uint256 _amount)
        public
        onlyOwner
    {
        Address.sendValue(payable(_beneficiaryAddress), _amount);
        emit WithdrawalCompleted(_beneficiaryAddress, _amount);
    }

    function changePrice(
        address _tokenAddress,
        uint256 _tokenId,
        uint256 _newPrice
    ) external nonReentrant {
        Trade storage trade = trades[_tokenAddress][_tokenId][msg.sender];
        require(trade.amount > 0, "Trade is not open");
        trade.price = _newPrice;
        emit TradePriceChanged(_tokenAddress, _tokenId, msg.sender, _newPrice);
    }
}
