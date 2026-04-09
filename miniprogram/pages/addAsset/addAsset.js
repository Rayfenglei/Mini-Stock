const api = require('../../utils/api');
const validator = require('../../utils/validator');
const format = require('../../utils/format');

Page({
  data: {
    accountId: '',
    assetType: 'stock',
    formData: {
      assetName: '',
      assetCode: '',
      shares: '',
      costPrice: ''
    },
    autoFilled: false,
    costAmountDisplay: '0.00'
  },

  onLoad(options) {
    const type = options.type || 'stock';
    this.setData({ 
      accountId: options.accountId || '',
      assetType: type
    });
  },

  onAssetTypeChange(e) {
    this.setData({
      assetType: e.detail.type,
      autoFilled: false,
      formData: { assetName: '', assetCode: '', shares: '', costPrice: '' },
      costAmountDisplay: '0.00'
    });
  },

  onSearch(e) {
    const { keyword, type } = e.detail;
    if (!keyword) return;

    if (type === 'stock') {
      this.searchStock(keyword);
    } else if (type === 'fund') {
      this.searchFund(keyword);
    }
  },

  async searchStock(keyword) {
    try {
      let codeWithPrefix = keyword;
      if (!/^(sh|sz|bj)/i.test(keyword)) {
        const prefix = keyword.startsWith('6') || keyword.startsWith('8') || keyword.startsWith('4') ? 'sh' : 'sz';
        codeWithPrefix = prefix + keyword;
      }
      const result = await api.getStockQuote(codeWithPrefix);
      if (result) {
        const selector = this.selectComponent('#assetSelector');
        selector.updateResults([{
          code: codeWithPrefix,
          name: result.name,
          price: result.currentPrice,
          change: result.changePercent
        }]);
      }
    } catch (error) {
      console.error('搜索股票失败', error);
    }
  },

  async searchFund(keyword) {
    try {
      const result = await api.getFundQuote(keyword);
      if (result) {
        const selector = this.selectComponent('#assetSelector');
        selector.updateResults([{
          code: keyword,
          name: result.name,
          price: result.netValue,
          change: result.estimateRate
        }]);
      }
    } catch (error) {
      console.error('搜索基金失败', error);
    }
  },

  onAssetSelect(e) {
    const { item } = e.detail;
    this.setData({
      'formData.assetName': item.name,
      'formData.assetCode': item.code,
      autoFilled: true
    });
    this.calculateCostAmount();
  },

  onNameInput(e) {
    this.setData({ 'formData.assetName': e.detail.value });
  },

  onCodeInput(e) {
    this.setData({ 'formData.assetCode': e.detail.value });
  },

  onSharesInput(e) {
    this.setData({ 'formData.shares': e.detail.value });
    this.calculateCostAmount();
  },

  onPriceInput(e) {
    this.setData({ 'formData.costPrice': e.detail.value });
    this.calculateCostAmount();
  },

  calculateCostAmount() {
    const { shares, costPrice } = this.data.formData;
    const sharesNum = parseFloat(shares) || 0;
    const priceNum = parseFloat(costPrice) || 0;
    const costAmount = sharesNum * priceNum;
    this.setData({
      costAmountDisplay: format.toThousands(costAmount)
    });
  },

  async submitHolding() {
    const { formData, assetType, accountId } = this.data;
    const validation = validator.validateHoldingForm({ ...formData, assetType });

    if (!validation.valid) {
      wx.showToast({ title: validation.errors[0], icon: 'none' });
      return;
    }

    try {
      wx.showLoading({ title: '添加中...' });
      await api.addHolding({
        accountId,
        assetType,
        assetCode: formData.assetCode,
        assetName: formData.assetName,
        shares: parseFloat(formData.shares),
        costPrice: parseFloat(formData.costPrice)
      });
      wx.hideLoading();
      wx.showToast({ title: '添加成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      wx.hideLoading();
      console.error('添加持仓失败', error);
      wx.showToast({ title: '添加失败', icon: 'none' });
    }
  }
});
