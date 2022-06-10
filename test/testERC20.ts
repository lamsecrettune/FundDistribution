import {expect} from 'chai';
import {utils} from 'ethers';
import {ethers, waffle} from 'hardhat';
import {deploy, evm_revert, evm_snapshot} from './helpers/hardhat-helpers';
import {ERC20} from '../typechain';
import {constants} from 'ethers';

describe('ERC20', () => {
  const [admin] = waffle.provider.getWallets();
  let globalSnapshotId;
  let snapshotId;
  let ERC20: ERC20;
  let owner, addr1, addr2, addr3;

  before(async () => {
    globalSnapshotId = await evm_snapshot();
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    ERC20 = await deploy<ERC20>('ERC20', [100, 'Test Token', 'TST', 18]);
    await ERC20.connect(addr1).mint(addr1.address, 100);
    await ERC20.connect(addr2).mint(addr2.address, 100);
    await ERC20.connect(addr3).mint(addr3.address, 100);
    snapshotId = await evm_snapshot();
  });

  async function revertSnapshot() {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  }

  beforeEach(async () => {
    await revertSnapshot();
  });

  describe('name', () => {
    it('returns the name of the token', async () => {
      expect(await ERC20.name()).to.equal('Test Token');
    });
  });
  describe('symbol', () => {
    it('returns the symbol of the token', async () => {
      expect(await ERC20.symbol()).to.equal('TST');
    });
  });
  describe('decimals', () => {
    it('returns the decimals of the token', async () => {
      expect(await ERC20.decimals()).to.equal(18);
    });
  });

  describe('balance', () => {
    it('balance 1 is 100', async () => {
      expect(await ERC20.balanceOf(addr1.address)).to.be.eq(100);
    });
    it('total supply is 400', async () => {
      let totalSupply = await ERC20.totalSupply();
      expect(totalSupply).to.be.eq(400);
    });
  });

  describe('mint', () => {
    it('owner mint', async () => {
      let ownerToken = await ERC20.balanceOf(owner.address);
      expect(ownerToken).to.be.eq(100);
    });
    it('addr1 mint', async () => {
      let addr1Token = await ERC20.balanceOf(addr1.address);
      expect(addr1Token).to.be.eq(100);
    });
    it('mint failed by invalid address', async () => {
      await expect(ERC20.connect(addr1).mint(constants.AddressZero, 100)).to.be.revertedWith('Invalid recipient');
    });
  });
  describe('transfer', () => {
    it('transfer emit Transfer event', async () => {
      expect(await ERC20.connect(addr1).transfer(addr2.address, 50))
        .to.emit(ERC20, 'Transfer')
        .withArgs(addr1.address, addr2.address, 50);
    });
    it('transfer zero amount emit Transfer event', async () => {
      expect(await ERC20.connect(addr1).transfer(addr2.address, 0))
        .to.emit(ERC20, 'Transfer')
        .withArgs(addr1.address, addr2.address, 0);
    });
    it('recipient balance increase', async () => {
      await ERC20.transfer(addr1.address, 50);
      let addr1Token = await ERC20.balanceOf(addr1.address);
      expect(addr1Token).to.be.eq(150);
    });
    it('sender balance decrease', async () => {
      await ERC20.transfer(addr1.address, 50);
      let ownerToken = await ERC20.balanceOf(owner.address);
      expect(ownerToken).to.be.eq(50);
    });
    it('transfer with amount 0, recipient balance', async () => {
      await ERC20.transfer(addr1.address, 0);
      let addr1Token = await ERC20.balanceOf(addr1.address);
      expect(addr1Token).to.be.eq(100);
    });
    it('transfer with amount 0, sender balance', async () => {
      await ERC20.transfer(addr1.address, 0);
      let ownerToken = await ERC20.balanceOf(owner.address);
      expect(ownerToken).to.be.eq(100);
    });
    it('transfer to self', async () => {
      await ERC20.transfer(owner.address, 50);
      let ownerToken = await ERC20.balanceOf(owner.address);
      expect(ownerToken).to.be.eq(100);
    });
    it('transfer fail by not enough balance', async () => {
      await expect(ERC20.transfer(addr1.address, 200)).to.be.revertedWith('Not enough balance');
    });
    it('transfer fail by invalid recipient', async () => {
      await expect(ERC20.transfer(constants.AddressZero, 50)).to.be.revertedWith('Invalid recipient');
    });
  });

  describe('approve allowance', () => {
    it('approve', async () => {
      await ERC20.approve(addr1.address, 50);
      let allowance = await ERC20.allowance(owner.address, addr1.address);
      expect(allowance).to.be.eq(50);
    });
    it('approve amount greater than balance', async () => {
      await ERC20.approve(addr1.address, 200);
      let allowance = await ERC20.allowance(owner.address, addr1.address);
      expect(allowance).to.be.eq(200);
    });
    it('emit Approval event', async () => {
      let result = await ERC20.connect(addr1).approve(addr2.address, 50);
      expect(result).to.emit(ERC20, 'Approval').withArgs(addr1.address, addr2.address, 50);
    });
    it('emit approve to zero', async () => {
      let result = await ERC20.connect(addr1).approve(addr2.address, 0);
      expect(result).to.emit(ERC20, 'Approval').withArgs(addr1.address, addr2.address, 0);
    });
    it('approve self', async () => {
      await ERC20.connect(addr1).approve(addr1.address, 50);
      let allowance = await ERC20.allowance(addr1.address, addr1.address);
      expect(allowance).to.be.eq(50);
    });
    it('approve fail by invalid spender', async () => {
      await expect(ERC20.approve(constants.AddressZero, 50)).to.be.revertedWith('Invalid spender');
    });
  });
  describe('transferFrom', () => {
    it('transferFrom', async () => {
      await ERC20.approve(addr1.address, 100);
      await ERC20.connect(addr1).transferFrom(owner.address, addr2.address, 50);
      let addr2Token = await ERC20.balanceOf(addr2.address);
      let ownerToken = await ERC20.balanceOf(owner.address);
      let addr1Allowance = await ERC20.allowance(owner.address, addr1.address);
      expect(addr1Allowance).to.be.eq(50);
      expect(ownerToken).to.be.eq(50);
      expect(addr2Token).to.be.eq(150);
    });
    // it('transferFrom with infinite allowance', async () => {
    //   await ERC20.approve(addr1.address, constants.MaxUint256);
    //   await ERC20.connect(addr1).transferFrom(owner.address, addr2.address, 50);
    //   let addr1Allowance = await ERC20.allowance(owner.address, addr1.address);
    //   expect(addr1Allowance).to.be.eq(constants.MaxUint256);
    // });
    it('transferFrom with amount 0', async () => {
      await ERC20.approve(addr1.address, 50);
      await ERC20.connect(addr1).transferFrom(owner.address, addr2.address, 0);
      let addr2Token = await ERC20.balanceOf(addr2.address);
      expect(addr2Token).to.be.eq(100);
    });
    it('transferFrom with amount 0, owner balance', async () => {
      await ERC20.approve(addr1.address, 50);
      await ERC20.connect(addr1).transferFrom(owner.address, addr2.address, 0);
      let ownerToken = await ERC20.balanceOf(owner.address);
      expect(ownerToken).to.be.eq(100);
    });
    it('transfer to owner', async () => {
      await ERC20.approve(addr1.address, 50);
      await ERC20.connect(addr1).transferFrom(owner.address, owner.address, 50);
      let ownerToken = await ERC20.balanceOf(owner.address);
      expect(ownerToken).to.be.eq(100);
    });
    it('transferFrom fail by not enough allowance', async () => {
      await ERC20.approve(addr1.address, 50);
      await expect(ERC20.connect(addr1).transferFrom(owner.address, addr1.address, 200)).to.be.revertedWith(
        'Not enough allowance'
      );
    });
    it('transferFrom fail by not enough balance', async () => {
      await ERC20.approve(addr1.address, 200);
      await expect(ERC20.connect(addr1).transferFrom(owner.address, addr1.address, 200)).to.be.revertedWith(
        'Not enough balance'
      );
    });
    it('transferFrom fail by invalid recipient', async () => {
      await expect(ERC20.transferFrom(owner.address, constants.AddressZero, 50)).to.be.revertedWith('Invalid to');
    });
    it('transferFrom fail by invalid sender', async () => {
      await expect(ERC20.transferFrom(constants.AddressZero, addr1.address, 50)).to.be.revertedWith('Invalid from');
    });
    it('transferFrom emit Transfer event', async () => {
      await ERC20.approve(addr1.address, 50);
      let result = await ERC20.connect(addr1).transferFrom(owner.address, addr2.address, 50);
      expect(result).to.emit(ERC20, 'Transfer').withArgs(owner.address, addr2.address, 50);
    });
    it('transferFrom emit Transfer event with zero amount', async () => {
      await ERC20.approve(addr1.address, 50);
      let result = await ERC20.connect(addr1).transferFrom(owner.address, addr2.address, 0);
      expect(result).to.emit(ERC20, 'Transfer').withArgs(owner.address, addr2.address, 0);
    });
  });
  describe('burn', () => {
    it('burn', async () => {
      await ERC20.connect(addr1).burn(50);
      let addr1Token = await ERC20.balanceOf(addr1.address);
      expect(addr1Token).to.be.eq(50);
    });
    it('burn fail by not enough balance', async () => {
      await expect(ERC20.connect(addr1).burn(200)).to.be.revertedWith('Not enough balance');
    });
  });
});
