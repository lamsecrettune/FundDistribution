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

  receive() external payable {}

  function addToken(address token) external returns (bool) {
    require(token != address(0));
    tokens.push(token);
    curTokens[token] = true;
    require(IERC20(token).balanceOf(address(this)) > 0);
    emit TokenIsAdded(token);
    return true;
  }

  function receiveToken(address token, address sender) external returns (bool) {
    if (!curTokens[token]) {
      tokens.push(token);
      curTokens[token] = true;
    }
    IERC20 tokenContract = IERC20(token);
    uint256 amount = tokenContract.allowance(sender, address(this));
    require(amount > 0);
    bool res = tokenContract.transferFrom(sender, address(this), amount);
    emit TokenIsAdded(token);
    return res;
  }

  function setEthAllowance(address to, uint256 amount) external onlyOwner returns (bool) {
    ethAllowance[to] = amount;
    emit EthAllowanceIsSet(to, amount);
    return true;
  }

  function setTokenAllowance(
    address to,
    address token,
    uint256 amount
  ) external onlyOwner returns (bool) {
    tokenAllowance[to][token] = amount;
    emit TokenAllowanceIsSet(to, token, amount);
    return true;
  }

  function claimFund() external payable returns (bool) {
    if (ethAllowance[msg.sender] > 0) {
      uint256 amount = ethAllowance[msg.sender];
      ethAllowance[msg.sender] = 0;
      payable(msg.sender).transfer(_min(address(this).balance, amount));
    }
    for (uint256 i = 0; i < tokens.length; ++i) {
      _transferToken(msg.sender, tokens[i]);
    }
    emit FundIsClaimed(msg.sender);
    return true;
  }

  function sendFundTo(address to) external payable returns (bool) {
    if (ethAllowance[to] > 0) {
      uint256 amount = ethAllowance[to];
      ethAllowance[to] = 0;
      payable(to).transfer(_min(address(this).balance, amount));
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
      return
        tokenContract.transfer(
          to,
          _min(tokenAllowance[to][token], tokenContract.balanceOf(address(this)))
        );
    }
    return false;
  }

  function _min(uint256 a, uint256 b) internal pure returns (uint256) {
    return a >= b ? b : a;
  }
}
