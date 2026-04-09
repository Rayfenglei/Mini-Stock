const app = getApp();
const api = require('../../utils/api');

Page({
  data: {
    currentAccount: {},
    todayProfit: 0,
    todayRate: 0,
    totalProfit: 0,
    totalProfitRate: 0,
    totalAmount: 0,
    costAmount: 0,
    holdings: [],
    sortAsc: false,
    sortBy: 'marketValue'
  },

  onLoad(options) {
    const accountId = options.id || '';
    if (accountId) {
      this.loadAccountData(accountId);
    } else {
      this.loadDefaultAccount();
    }
  },

  onPullDownRefresh() {
    this.refreshData();
  },

  onShow() {
    this.refreshData();
  },

  async loadDefaultAccount() {
    try {
      const accounts = await api.getAccounts();
      if (accounts.length > 0) {
        this.loadAccountData(accounts[0]._id);
      } else {
        wx.redirectTo({ url: '/pages/index/index' });
      }
    } catch (error) {
      console.error('加载账户失败', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async loadAccountData(accountId) {
    wx.showLoading({ title: '加载中...' });
    
    try {
      const [account, holdings] = await Promise.all([
        api.getAccountById(accountId),
        api.getHoldings(accountId)
      ]);

      this.setData({ currentAccount: account });
      this.calculateTotalData(holdings);
      this.setData({ holdings });
      
      wx.setStorageSync('currentAccountId', accountId);
      app.globalData.currentAccountId = accountId;
    } catch (error) {
      console.error('加载数据失败', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      wx.stopPullDownRefresh();
    }
  },

  calculateTotalData(holdings) {
    let todayProfit = 0;
    let totalProfit = 0;
    let totalAmount = 0;
    let costAmount = 0;

    holdings.forEach(item => {
      todayProfit += item.todayProfit || 0;
      totalProfit += item.profit || 0;
      totalAmount += item.marketValue || 0;
      costAmount += item.costAmount || 0;
    });

    const totalProfitRate = costAmount > 0 
      ? (totalProfit / costAmount) * 100 
      : 0;
    
    const todayRate = totalAmount > 0 
      ? (todayProfit / totalAmount) * 100 
      : 0;

    this.setData({
      todayProfit,
      todayRate,
      totalProfit,
      totalProfitRate,
      totalAmount,
      costAmount
    });
  },

  async refreshData() {
    const accountId = this.data.currentAccount._id;
    if (accountId) {
      await this.loadAccountData(accountId);
    }
  },

  toggleSort() {
    const { holdings, sortAsc } = this.data;
    const newSortAsc = !sortAsc;
    
    const sorted = [...holdings].sort((a, b) => {
      return newSortAsc 
        ? a.marketValue - b.marketValue 
        : b.marketValue - a.marketValue;
    });

    this.setData({
      holdings: sorted,
      sortAsc: newSortAsc
    });
  },

  async showAccountPicker() {
    try {
      const accounts = await api.getAccounts();
      const accountNames = accounts.map(a => 
        `${a.name} | ${a.broker} ${a.accountCode}`
      );

      wx.showActionSheet({
        itemList: accountNames,
        success: (res) => {
          this.loadAccountData(accounts[res.tapIndex]._id);
        }
      });
    } catch (error) {
      wx.showToast({ title: '获取账户失败', icon: 'none' });
    }
  },

  editAccount() {
    const { currentAccount } = this.data;
    wx.navigateTo({
      url: `/pages/editAccount/editAccount?id=${currentAccount._id}`
    });
  },

  onHoldingTap(e) {
    const { id } = e.detail;
    wx.navigateTo({
      url: `/pages/holdingDetail/holdingDetail?id=${id}`
    });
  },

  goToAddAsset() {
    const { currentAccount } = this.data;
    wx.navigateTo({
      url: `/pages/addAsset/addAsset?accountId=${currentAccount._id}`
    });
  }
});
