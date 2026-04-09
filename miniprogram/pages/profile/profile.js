const app = getApp();

Page({
  data: {
    userInfo: {}
  },

  onLoad() {
    this.loadUserInfo();
  },

  loadUserInfo() {
    const userInfo = app.globalData.userInfo;
    if (userInfo) {
      this.setData({
        userInfo: {
          nickName: userInfo.nickName || '微信用户',
          displayId: userInfo.openid ? userInfo.openid.substring(0, 8) + '****' : '未登录'
        }
      });
    } else {
      wx.cloud.callFunction({
        name: 'login'
      }).then(res => {
        app.globalData.userInfo = res.result;
        this.setData({
          userInfo: {
            nickName: '微信用户',
            displayId: res.result.openid ? res.result.openid.substring(0, 8) + '****' : '未登录'
          }
        });
      }).catch(err => {
        console.error('获取用户信息失败', err);
      });
    }
  },

  goToAccounts() {
    wx.navigateTo({ url: '/pages/index/index' });
  },

  goToTransactions() {
    wx.navigateTo({ url: '/pages/transaction/transaction' });
  },

  goToReminders() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  goToAnalysis() {
    wx.switchTab({ url: '/pages/analysis/analysis' });
  },

  goToProfitStats() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  goToExport() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  goToRefreshSettings() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  goToColorSettings() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  goToAbout() {
    wx.showModal({
      title: '关于股票资产管家',
      content: '版本：1.0.0\n股票资产管家是一款专为个人投资者设计的微信小程序，提供股票、基金、黄金等多品类资产的实时监控、详细分析和便捷管理功能。',
      showCancel: false
    });
  }
});
