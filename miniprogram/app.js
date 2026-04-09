App({
  globalData: {
    userInfo: null,
    currentAccountId: null,
    openid: null
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloudbase-0gsb7a4j8162f595',
        traceUser: true
      });
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
