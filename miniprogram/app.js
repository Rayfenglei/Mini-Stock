App({
  globalData: {
    userInfo: null,
    currentAccountId: null,
    openid: null,
    // 交易刷新标记
    needRefreshHoldings: false,
    lastTransactionTime: 0
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      // 使用动态环境配置，优先从 storage 读取，否则使用默认环境
      const env = wx.getStorageSync('cloudEnv') || 'cloudbase-0gsb7a4j8162f595';
      wx.cloud.init({
        env: env,
        traceUser: true
      });
      console.log('云开发环境初始化:', env);
    }

    this.login();

    const currentAccountId = wx.getStorageSync('currentAccountId');
    if (currentAccountId) {
      this.globalData.currentAccountId = currentAccountId;
    }
  },

  async login() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'login'
      });
      this.globalData.openid = res.result.openid;
      console.log('登录成功，openid:', res.result.openid);
    } catch (err) {
      console.error('登录失败', err);
    }
  },

  onShow() {},

  onHide() {}
});
