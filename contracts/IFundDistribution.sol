// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFundDistribution {
  event EthAllowanceIsSet(address to, uint256 amount);
  event TokenAllowanceIsSet(address to, address token, uint256 amount);
  event TokenIsAdded(address token);
  event FundIsClaimed(address to);
  event EthIsClaimed(address to, uint256 amount);
  event TokenIsClaimed(address to, address token, uint256 amount);
  event AllTokensAreClaimed(address to);

  receive() external payable;

  function addToken(address token) external returns (bool);

  function receiveToken(address token, address sender) external returns (bool);

  function setEthAllowance(address to, uint256 amount) external returns (bool);

  function setTokenAllowance(
    address to,
    address token,
    uint256 amount
  ) external returns (bool);

  function claimEth() external payable returns (bool);

  function claimToken(address token) external returns (bool);

  function claimAllTokens() external returns (bool);

  function sendEthTo(address to) external payable returns (bool);

  function sendTokenTo(address to, address token) external returns (bool);

  function sendAllTokensTo(address to) external returns (bool);

  function claimFund() external payable returns (bool);

  function sendFundTo(address to) external payable returns (bool);
}
