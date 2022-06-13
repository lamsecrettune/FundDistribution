import {expect} from 'chai';
import {utils} from 'ethers';
import {ethers, waffle} from 'hardhat';
import {deploy, evm_revert, evm_snapshot} from './helpers/hardhat-helpers';
import {FundDistribution, ERC20} from '../typechain';
import {constants} from 'ethers';

describe('FundDistribution', () => {
  const [admin] = waffle.provider.getWallets();
  let globalSnapshotId;
  let snapshotId;
  let FundDistribution: FundDistribution;
  let TokenA: ERC20;
  let TokenB: ERC20;
  let owner, addr1, addr2, addr3;

  before(async () => {
    globalSnapshotId = await evm_snapshot();
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    FundDistribution = await deploy<FundDistribution>('FundDistribution', [owner.address]);
    TokenA = await deploy<ERC20>('ERC20', [100000000, 'TokenA', 'TA', 18]);
    TokenB = await deploy<ERC20>('ERC20', [100000000, 'TokenB', 'TB', 18]);
    snapshotId = await evm_snapshot();
  });

  async function revertSnapshot() {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  }

  beforeEach(async () => {
    await revertSnapshot();
  });

  describe('transfer fund to contract', () => {
    it('should transfer ether to contract', async () => {
      await addr1.sendTransaction({
        to: FundDistribution.address,
        value: ethers.utils.parseEther('1'),
      });
      const balance = await FundDistribution.balance();
      expect(balance).to.equal(ethers.utils.parseEther('1'));
    });
    it('should transfer tokens to contract', async () => {
      await TokenA.transfer(FundDistribution.address, 50);
      await TokenB.transfer(FundDistribution.address, 60);
      await FundDistribution.addToken(TokenA.address);
      await FundDistribution.addToken(TokenB.address);
      const balanceA = await TokenA.balanceOf(FundDistribution.address);
      const balanceB = await TokenB.balanceOf(FundDistribution.address);
      expect(balanceA).to.equal(50);
      expect(balanceB).to.equal(60);
    });
    it('addToken revert with address 0x0', async () => {
      await expect(FundDistribution.addToken(constants.AddressZero)).to.be.revertedWith('Invalid address');
    });
    it('addToken revert if amount is zero', async () => {
      await expect(FundDistribution.addToken(TokenA.address)).to.be.revertedWith('Amount is zero');
    });
    it('receiveToken works', async () => {
      await TokenA.approve(FundDistribution.address, 50);
      await TokenB.approve(FundDistribution.address, 60);
      await FundDistribution.receiveToken(TokenA.address, owner.address);
      await FundDistribution.receiveToken(TokenB.address, owner.address);
      const balanceA = await TokenA.balanceOf(FundDistribution.address);
      const balanceB = await TokenB.balanceOf(FundDistribution.address);
      expect(balanceA).to.equal(50);
      expect(balanceB).to.equal(60);
    });
    it('reverted by token amount is zero', async () => {
      await expect(FundDistribution.receiveToken(TokenA.address, owner.address)).to.be.revertedWith(
        'Token amount is zero'
      );
    });
  });
  describe('allowance is set', () => {
    beforeEach(async () => {
      await TokenA.transfer(FundDistribution.address, 50);
      await TokenB.transfer(FundDistribution.address, 60);
      await FundDistribution.addToken(TokenA.address);
      await FundDistribution.addToken(TokenB.address);
    });
    it('should set ether allowance', async () => {
      await FundDistribution.setEthAllowance(addr1.address, ethers.utils.parseEther('50'));
      const allowance = await FundDistribution.ethAllowance(addr1.address);
      expect(allowance).to.equal(ethers.utils.parseEther('50'));
    });
    it('should set token allowance', async () => {
      await FundDistribution.setTokenAllowance(addr1.address, TokenA.address, 50);
      const allowance = await FundDistribution.tokenAllowance(addr1.address, TokenA.address);
      expect(allowance).to.equal(50);
    });
    it('should revert as invalid token address', async () => {
      await expect(FundDistribution.setTokenAllowance(TokenA.address, addr1.address, 50)).to.be.revertedWith(
        'Token is not added'
      );
    });
    it('should revert if not owner', async () => {
      await expect(
        FundDistribution.connect(addr1).setTokenAllowance(addr1.address, TokenA.address, 50)
      ).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(
        FundDistribution.connect(addr1).setEthAllowance(addr1.address, ethers.utils.parseEther('50'))
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });
  describe('claimFunds', () => {
    beforeEach(async () => {
      await TokenA.transfer(FundDistribution.address, 50);
      await TokenB.transfer(FundDistribution.address, 60);
      await FundDistribution.addToken(TokenA.address);
      await FundDistribution.addToken(TokenB.address);
      await owner.sendTransaction({
        to: FundDistribution.address,
        value: ethers.utils.parseEther('1'),
      });
    });
    it('should claim fund', async () => {
      const beforeEthBalance = await addr2.getBalance();
      const beforeTokenABalance = await TokenA.balanceOf(addr2.address);
      const beforeTokenBBalance = await TokenB.balanceOf(addr2.address);
      await FundDistribution.setEthAllowance(addr2.address, 50);
      await FundDistribution.setTokenAllowance(addr2.address, TokenA.address, 20);
      await FundDistribution.setTokenAllowance(addr2.address, TokenB.address, 30);
      await FundDistribution.sendFundTo(addr2.address);
      const afterEthBalance = await addr2.getBalance();
      const afterTokenABalance = await TokenA.balanceOf(addr2.address);
      const afterTokenBBalance = await TokenB.balanceOf(addr2.address);
      expect(afterEthBalance).to.equal(beforeEthBalance.add(50));
      expect(afterTokenABalance).to.equal(beforeTokenABalance.add(20));
      expect(afterTokenBBalance).to.equal(beforeTokenBBalance.add(30));
    });
    it('should claim fund to self', async () => {
      const beforeEthBalance = await addr2.getBalance();
      const beforeTokenABalance = await TokenA.balanceOf(addr2.address);
      const beforeTokenBBalance = await TokenB.balanceOf(addr2.address);
      await FundDistribution.setEthAllowance(addr2.address, 50);
      await FundDistribution.setTokenAllowance(addr2.address, TokenA.address, 20);
      await FundDistribution.setTokenAllowance(addr2.address, TokenB.address, 30);
      const tx = await FundDistribution.connect(addr2).claimFund();
      const receipt = await tx.wait();
      const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      const afterEthBalance = await addr2.getBalance();
      const afterTokenABalance = await TokenA.balanceOf(addr2.address);
      const afterTokenBBalance = await TokenB.balanceOf(addr2.address);
      expect(afterEthBalance).to.equal(beforeEthBalance.add(50).sub(gasSpent));
      expect(afterTokenABalance).to.equal(beforeTokenABalance.add(20));
      expect(afterTokenBBalance).to.equal(beforeTokenBBalance.add(30));
    });
    it('claim fund with allowance exceed balance', async () => {
      const beforeEthBalance = await addr2.getBalance();
      const beforeTokenABalance = await TokenA.balanceOf(addr2.address);
      const beforeTokenBBalance = await TokenB.balanceOf(addr2.address);
      await FundDistribution.setEthAllowance(addr2.address, ethers.utils.parseEther('2'));
      await FundDistribution.setTokenAllowance(addr2.address, TokenA.address, 100);
      await FundDistribution.setTokenAllowance(addr2.address, TokenB.address, 100);
      await FundDistribution.sendFundTo(addr2.address);
      const afterEthBalance = await addr2.getBalance();
      const afterTokenABalance = await TokenA.balanceOf(addr2.address);
      const afterTokenBBalance = await TokenB.balanceOf(addr2.address);
      expect(afterEthBalance).to.equal(beforeEthBalance.add(ethers.utils.parseEther('1')));
      expect(afterTokenABalance).to.equal(beforeTokenABalance.add(50));
      expect(afterTokenBBalance).to.equal(beforeTokenBBalance.add(60));
      expect(await FundDistribution.ethAllowance(addr2.address)).to.equal(ethers.utils.parseEther('1'));
      expect(await FundDistribution.tokenAllowance(addr2.address, TokenA.address)).to.equal(50);
      expect(await FundDistribution.tokenAllowance(addr2.address, TokenB.address)).to.equal(40);
    });
    it('claim fund to self with allowance exceed balance', async () => {
      const beforeEthBalance = await addr2.getBalance();
      const beforeTokenABalance = await TokenA.balanceOf(addr2.address);
      const beforeTokenBBalance = await TokenB.balanceOf(addr2.address);
      await FundDistribution.setEthAllowance(addr2.address, ethers.utils.parseEther('2'));
      await FundDistribution.setTokenAllowance(addr2.address, TokenA.address, 100);
      await FundDistribution.setTokenAllowance(addr2.address, TokenB.address, 100);
      const tx = await FundDistribution.connect(addr2).claimFund();
      const receipt = await tx.wait();
      const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice);
      const afterEthBalance = await addr2.getBalance();
      const afterTokenABalance = await TokenA.balanceOf(addr2.address);
      const afterTokenBBalance = await TokenB.balanceOf(addr2.address);
      expect(afterEthBalance).to.equal(beforeEthBalance.add(ethers.utils.parseEther('1')).sub(gasSpent));
      expect(afterTokenABalance).to.equal(beforeTokenABalance.add(50));
      expect(afterTokenBBalance).to.equal(beforeTokenBBalance.add(60));
      expect(await FundDistribution.ethAllowance(addr2.address)).to.equal(ethers.utils.parseEther('1'));
      expect(await FundDistribution.tokenAllowance(addr2.address, TokenA.address)).to.equal(50);
      expect(await FundDistribution.tokenAllowance(addr2.address, TokenB.address)).to.equal(40);
    });
    it('claim Ether', async () => {
      await FundDistribution.setEthAllowance(addr2.address, 50);
      expect(await FundDistribution.sendEthTo(addr2.address)).to.changeEtherBalance(addr2, 50);
    });
    it('claim Ether to self', async () => {
      await FundDistribution.setEthAllowance(addr2.address, 50);
      expect(await FundDistribution.sendEthTo(addr2.address)).to.changeEtherBalance(addr2, 50);
    });
    it('claim Ether revert with zero allowance', async () => {
      await expect(FundDistribution.sendEthTo(addr2.address)).to.be.revertedWith('Allowance is zero');
    });
    it('claim Ether revert with zero balance', async () => {
      await FundDistribution.setEthAllowance(addr2.address, ethers.utils.parseEther('1'));
      await FundDistribution.setEthAllowance(addr3.address, ethers.utils.parseEther('1'));
      await FundDistribution.sendEthTo(addr2.address);
      await expect(FundDistribution.sendEthTo(addr3.address)).to.be.revertedWith('Balance is zero');
    });
    it('claim token', async () => {
      await FundDistribution.setTokenAllowance(addr2.address, TokenA.address, 50);
      await FundDistribution.setTokenAllowance(addr2.address, TokenB.address, 60);
      await FundDistribution.sendTokenTo(addr2.address, TokenA.address);
      expect(await TokenA.balanceOf(addr2.address)).to.equal(50);
      await expect(FundDistribution.sendTokenTo(TokenB.address, addr2.address)).to.be.revertedWith(
        'Allowance is zero'
      );
    });
  });
  describe('test emit events', () => {
    beforeEach(async () => {
      await TokenA.transfer(FundDistribution.address, 50);
      await TokenB.transfer(FundDistribution.address, 60);
      await FundDistribution.addToken(TokenA.address);
      await FundDistribution.addToken(TokenB.address);
      await owner.sendTransaction({
        to: FundDistribution.address,
        value: ethers.utils.parseEther('1'),
      });
    });
    it('should emit event when set ether allowance', async () => {
      expect(await FundDistribution.setEthAllowance(addr1.address, 50))
        .to.emit(FundDistribution, 'EthAllowanceIsSet')
        .withArgs(addr1.address, 50);
    });
  });
});
