const api = require('../../utils/api');

Page({
  data: {
    holdingId: '',
    formData: {
      shares: '',
      costPrice: '',
      costAmount: ''
    },
    errorMessage: ''
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ holdingId: options.id });
      this.loadHoldingData(options.id);
    }
  },

  async loadHoldingData(id) {
    try {
      wx.showLoading({ title: '加载中...' });
      const holdingResult = await api.getHoldingById(id);
      const holding = holdingResult.data;
      
      this.setData({
        formData: {
          shares: holding.shares || '',
          costPrice: holding.costPrice || '',
          costAmount: holding.costAmount || ''
        }
      });
    } catch (error) {
      console.error('加载持仓数据失败', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onSharesChange(e) {
    const shares = parseFloat(e.detail.value) || 0;
    const costPrice = parseFloat(this.data.formData.costPrice) || 0;
    const costAmount = shares * costPrice;
    
    this.setData({
      formData: {
        ...this.data.formData,
        shares: shares,
        costAmount: costAmount.toFixed(2)
      },
      errorMessage: ''
    });
  },

  onCostPriceChange(e) {
    const costPrice = parseFloat(e.detail.value) || 0;
    const shares = parseFloat(this.data.formData.shares) || 0;
    const costAmount = shares * costPrice;
    
    this.setData({
      formData: {
        ...this.data.formData,
        costPrice: costPrice,
        costAmount: costAmount.toFixed(2)
      },
      errorMessage: ''
    });
  },

  validateForm() {
    const { shares, costPrice } = this.data.formData;
    
    if (!shares || shares <= 0) {
      this.setData({ errorMessage: '持仓数量必须大于0' });
      return false;
    }
    
    if (!costPrice || costPrice <= 0) {
      this.setData({ errorMessage: '持仓价格必须大于0' });
      return false;
    }
    
    return true;
  },

  async onSave() {
    if (!this.validateForm()) {
      return;
    }
    
    try {
      wx.showLoading({ title: '保存中...' });
      
      const { shares, costPrice, costAmount } = this.data.formData;
      
      await api.updateHolding(this.data.holdingId, {
        shares: parseFloat(shares),
        costPrice: parseFloat(costPrice),
        costAmount: parseFloat(costAmount)
      });
      
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      console.error('保存失败', error);
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  onCancel() {
    wx.navigateBack();
  }
});