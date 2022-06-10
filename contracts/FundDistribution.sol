// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC20.sol";
import "./IFundDistribution.sol";
import "./BoringOwnable.sol";

contract FundDistribution is IFundDistribution, BoringOwnable {
  mapping(address => uint256) public ethAllowance;
  mapping(address => bool) public curTokens;
  mapping(address => mapping(address => uint256)) public tokenAllowance;
  address[] public tokens;

  constructor(address _owner) public {
    owner = _owner;
  }

  receive() external payable override {}

  function addToken(address token) external override returns (bool) {
    require(token != address(0), "Invalid token");
    tokens.push(token);
    curTokens[token] = true;
    require(IERC20(token).balanceOf(address(this)) > 0, "Amount is zero");
    emit TokenIsAdded(token);
    return true;
  }

  function receiveToken(address token, address sender) external override returns (bool) {
    if (!curTokens[token]) {
      tokens.push(token);
      curTokens[token] = true;
    }
    IERC20 tokenContract = IERC20(token);
    uint256 amount = tokenContract.allowance(sender, address(this));
    require(amount > 0, "Token amount is zero");
    bool res = tokenContract.transferFrom(sender, address(this), amount);
    emit TokenIsAdded(token);
    return res;
  }

  function setEthAllowance(address to, uint256 amount) external override onlyOwner returns (bool) {
    ethAllowance[to] = amount;
    emit EthAllowanceIsSet(to, amount);
    return true;
  }

  function setTokenAllowance(
    address to,
    address token,
    uint256 amount
  ) external override onlyOwner returns (bool) {
    require(curTokens[token], "Token is not added");
    tokenAllowance[to][token] = amount;
    emit TokenAllowanceIsSet(to, token, amount);
    return true;
  }

  function claimFund() external payable override returns (bool) {
    if (ethAllowance[msg.sender] > 0) {
      uint256 amount = _min(address(this).balance, ethAllowance[msg.sender]);
      ethAllowance[msg.sender] -= amount;
      payable(msg.sender).transfer(amount);
    }
    for (uint256 i = 0; i < tokens.length; ++i) {
      _transferToken(msg.sender, tokens[i]);
    }
    emit FundIsClaimed(msg.sender);
    return true;
  }

  function sendFundTo(address to) external payable override returns (bool) {
    if (ethAllowance[to] > 0) {
      uint256 amount = _min(address(this).balance, ethAllowance[to]);
      ethAllowance[to] -= amount;
      payable(to).transfer(amount);
    }
    for (uint256 i = 0; i < tokens.length; ++i) {
      _transferToken(to, tokens[i]);
    }
    emit FundIsClaimed(to);
    return true;
  }

  function _transferToken(address to, address token) internal returns (bool) {
    if (tokenAllowance[to][token] > 0) {
      IERC20 tokenContract = IERC20(token);
      uint256 amount = _min(tokenAllowance[to][token], tokenContract.balanceOf(address(this)));
      tokenAllowance[to][token] -= amount;
      return tokenContract.transfer(to, amount);
    }
    return false;
  }

  function _min(uint256 a, uint256 b) internal pure returns (uint256) {
    return a >= b ? b : a;
  }

  function balance() external view returns (uint256) {
    return address(this).balance;
  }
}
