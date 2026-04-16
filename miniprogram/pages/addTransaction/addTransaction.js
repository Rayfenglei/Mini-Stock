const api = require('../../utils/api');

Page({
  data: {
    holdingId: '',
    accountId: '',
    formData: {
      type: 'buy',
      shares: '',
      price: '',
      amount: ''
    },
    errorMessage: ''
  },

  onLoad(options) {
    if (options.holdingId) {
      this.setData({ holdingId: options.holdingId });
    }
    if (options.accountId) {
      this.setData({ accountId: options.accountId });
    }
  },

  onTypeChange(e) {
    this.setData({
      formData: {
        ...this.data.formData,
        type: e.detail.value
      },
      errorMessage: ''
    });
  },

  onSharesChange(e) {
    const shares = parseFloat(e.detail.value) || 0;
    const price = parseFloat(this.data.formData.price) || 0;
    const amount = shares * price;
    
    this.setData({
      formData: {
        ...this.data.formData,
        shares: shares,
        amount: amount.toFixed(2)
      },
      errorMessage: ''
    });
  },

  onPriceChange(e) {
    const price = parseFloat(e.detail.value) || 0;
    const shares = parseFloat(this.data.formData.shares) || 0;
    const amount = shares * price;
    
    this.setData({
      formData: {
        ...this.data.formData,
        price: price,
        amount: amount.toFixed(2)
      },
      errorMessage: ''
    });
  },

  validateForm() {
    const { type, shares, price } = this.data.formData;
    
    if (!type) {
      this.setData({ errorMessage: '请选择交易类型' });
      return false;
    }
    
    if (!shares || shares <= 0) {
      this.setData({ errorMessage: '交易数量必须大于0' });
      return false;
    }
    
    if (!price || price <= 0) {
      this.setData({ errorMessage: '交易价格必须大于0' });
      return false;
    }
    
    return true;
  },

  async onSubmit() {
    if (!this.validateForm()) {
      return;
    }
    
    try {
      wx.showLoading({ title: '提交中...' });
      
      const { type, shares, price, amount } = this.data.formData;
      
      await api.addTransaction({
        holdingId: this.data.holdingId,
        accountId: this.data.accountId,
        type: type,
        shares: parseFloat(shares),
        price: parseFloat(price),
        amount: parseFloat(amount),
        tradeDate: new Date().toISOString()
      });
      
      wx.hideLoading();

      // 设置全局标记，通知主页面需要刷新数据
      const app = getApp();
      if (app) {
        app.globalData.needRefreshHoldings = true;
        app.globalData.lastTransactionTime = Date.now();
        console.log('交易成功，设置刷新标记');
      }

      wx.showToast({ title: '提交成功', icon: 'success' });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      console.error('提交失败', error);
      wx.hideLoading();
      wx.showToast({ title: '提交失败', icon: 'none' });
    }
  },

  onCancel() {
    wx.navigateBack();
  }
});