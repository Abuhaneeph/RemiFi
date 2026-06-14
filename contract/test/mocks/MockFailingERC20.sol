// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockERC20} from "./MockERC20.sol";

/// @dev Returns false from transfer/transferFrom to exercise RemifiVault.TransferFailed.
contract MockFailingERC20 is MockERC20 {
    bool public failTransfer;
    bool public failTransferFrom;

    constructor(string memory tokenName, string memory tokenSymbol, uint8 tokenDecimals)
        MockERC20(tokenName, tokenSymbol, tokenDecimals)
    {}

    function setFailTransfer(bool value) external {
        failTransfer = value;
    }

    function setFailTransferFrom(bool value) external {
        failTransferFrom = value;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        if (failTransfer) return false;
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        if (failTransferFrom) return false;
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }
}
