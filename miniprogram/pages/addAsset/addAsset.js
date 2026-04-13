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
      costPrice: '',
      purchaseDate: '',
      expectedReturn: '',
      fundType: '',
      purchaseAmount: ''
    },
    autoFilled: false,
    costAmountDisplay: '0.00',
    fundTypes: ['股票型', '债券型', '混合型', '指数型', '货币型', 'QDII', 'FOF'],
    fundTypeIndex: -1,
    minDate: new Date(2000, 0, 1).getTime(),
    maxDate: new Date().getTime()
  },

  onLoad(options) {
    const type = options.type || 'stock';
    const today = format.formatDate(new Date(), 'YYYY-MM-DD');
    this.setData({
      accountId: options.accountId || '',
      assetType: type,
      'formData.purchaseDate': today
    });
  },

  onAssetTypeChange(e) {
    const type = e.detail.type;
    const today = format.formatDate(new Date(), 'YYYY-MM-DD');
    this.setData({
      assetType: type,
      autoFilled: false,
      formData: {
        assetName: '',
        assetCode: '',
        shares: '',
        costPrice: '',
        purchaseDate: today,
        expectedReturn: '',
        fundType: '',
        purchaseAmount: ''
      },
      costAmountDisplay: '0.00',
      fundTypeIndex: -1
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
      if (result && result.code === 0) {
        const selector = this.selectComponent('#assetSelector');
        selector.updateResults([{
          code: codeWithPrefix,
          name: result.data.name,
          price: result.data.currentPrice,
          change: result.data.changePercent
        }]);
      }
    } catch (error) {
      console.error('搜索股票失败', error);
    }
  },

  async searchFund(keyword) {
    try {
      const result = await api.getFundQuote(keyword);
      if (result && result.code === 0) {
        const selector = this.selectComponent('#assetSelector');
        selector.updateResults([{
          code: keyword,
          name: result.data.name,
          price: result.data.netValue,
          change: result.data.estimateRate
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
      'formData.costPrice': item.price ? item.price.toString() : '',
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

  onPurchaseAmountInput(e) {
    const amount = e.detail.value;
    this.setData({ 'formData.purchaseAmount': amount });
    // 如果输入了购买金额和成本价，自动计算份额
    const { costPrice } = this.data.formData;
    if (amount && costPrice && parseFloat(costPrice) > 0) {
      const shares = (parseFloat(amount) / parseFloat(costPrice)).toFixed(2);
      this.setData({ 'formData.shares': shares });
      this.calculateCostAmount();
    }
  },

  onPurchaseDateChange(e) {
    this.setData({ 'formData.purchaseDate': e.detail.value });
  },

  onExpectedReturnInput(e) {
    this.setData({ 'formData.expectedReturn': e.detail.value });
  },

  onFundTypeChange(e) {
    const index = parseInt(e.detail.value);
    const fundType = this.data.fundTypes[index];
    this.setData({
      fundTypeIndex: index,
      'formData.fundType': fundType
    });
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

      const submitData = {
        accountId,
        assetType,
        assetCode: formData.assetCode,
        assetName: formData.assetName,
        shares: parseFloat(formData.shares),
        costPrice: parseFloat(formData.costPrice)
      };

      // 基金特有字段
      if (assetType === 'fund') {
        submitData.purchaseDate = formData.purchaseDate;
        submitData.expectedReturn = formData.expectedReturn ? parseFloat(formData.expectedReturn) : null;
        submitData.fundType = formData.fundType || null;
        submitData.purchaseAmount = formData.purchaseAmount ? parseFloat(formData.purchaseAmount) : null;
      }

      await api.addHolding(submitData);
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
