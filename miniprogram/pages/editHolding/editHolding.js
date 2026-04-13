const api = require('../../utils/api');
const format = require('../../utils/format');

Page({
  data: {
    holdingId: '',
    assetType: '',
    formData: {
      shares: '',
      costPrice: '',
      costAmount: '',
      purchaseDate: '',
      expectedReturn: '',
      fundType: '',
      purchaseAmount: ''
    },
    fundTypes: ['股票型', '债券型', '混合型', '指数型', '货币型', 'QDII', 'FOF'],
    fundTypeIndex: -1,
    errorMessage: '',
    isFund: false
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

      const isFund = holding.assetType === 'fund';
      let fundTypeIndex = -1;
      if (isFund && holding.fundType) {
        fundTypeIndex = this.data.fundTypes.indexOf(holding.fundType);
      }

      this.setData({
        assetType: holding.assetType,
        isFund: isFund,
        fundTypeIndex: fundTypeIndex,
        formData: {
          shares: holding.shares || '',
          costPrice: holding.costPrice || '',
          costAmount: holding.costAmount || '',
          purchaseDate: holding.purchaseDate || format.formatDate(new Date(), 'YYYY-MM-DD'),
          expectedReturn: holding.expectedReturn || '',
          fundType: holding.fundType || '',
          purchaseAmount: holding.purchaseAmount || ''
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
    const shares = e.detail.value;
    const costPrice = parseFloat(this.data.formData.costPrice) || 0;
    const sharesNum = parseFloat(shares) || 0;
    const costAmount = sharesNum * costPrice;

    this.setData({
      'formData.shares': shares,
      'formData.costAmount': costAmount.toFixed(2),
      errorMessage: ''
    });
  },

  onCostPriceChange(e) {
    const costPrice = e.detail.value;
    const shares = parseFloat(this.data.formData.shares) || 0;
    const priceNum = parseFloat(costPrice) || 0;
    const costAmount = shares * priceNum;

    this.setData({
      'formData.costPrice': costPrice,
      'formData.costAmount': costAmount.toFixed(2),
      errorMessage: ''
    });
  },

  onPurchaseAmountChange(e) {
    const amount = e.detail.value;
    this.setData({
      'formData.purchaseAmount': amount,
      errorMessage: ''
    });

    // 如果输入了购买金额和成本价，自动计算份额
    const costPrice = parseFloat(this.data.formData.costPrice) || 0;
    const amountNum = parseFloat(amount) || 0;
    if (costPrice > 0 && amountNum > 0) {
      const shares = (amountNum / costPrice).toFixed(2);
      const costAmount = amountNum;
      this.setData({
        'formData.shares': shares,
        'formData.costAmount': costAmount.toFixed(2)
      });
    }
  },

  onPurchaseDateChange(e) {
    this.setData({
      'formData.purchaseDate': e.detail.value,
      errorMessage: ''
    });
  },

  onExpectedReturnChange(e) {
    this.setData({
      'formData.expectedReturn': e.detail.value,
      errorMessage: ''
    });
  },

  onFundTypeChange(e) {
    const index = parseInt(e.detail.value);
    const fundType = this.data.fundTypes[index];
    this.setData({
      fundTypeIndex: index,
      'formData.fundType': fundType,
      errorMessage: ''
    });
  },

  validateForm() {
    const { shares, costPrice, expectedReturn } = this.data.formData;

    if (!shares || parseFloat(shares) <= 0) {
      this.setData({ errorMessage: '持仓数量必须大于0' });
      return false;
    }

    if (!costPrice || parseFloat(costPrice) <= 0) {
      this.setData({ errorMessage: '持仓价格必须大于0' });
      return false;
    }

    // 基金特有字段验证
    if (this.data.isFund) {
      if (expectedReturn) {
        const rate = parseFloat(expectedReturn);
        if (rate < -100 || rate > 100) {
          this.setData({ errorMessage: '预期收益率必须在-100%到100%之间' });
          return false;
        }
      }
    }

    return true;
  },

  async onSave() {
    if (!this.validateForm()) {
      return;
    }

    try {
      wx.showLoading({ title: '保存中...' });

      const { shares, costPrice, purchaseDate, expectedReturn, fundType, purchaseAmount } = this.data.formData;
      const costAmount = parseFloat(shares) * parseFloat(costPrice);

      const updateData = {
        shares: parseFloat(shares),
        costPrice: parseFloat(costPrice),
        costAmount: costAmount
      };

      // 基金特有字段
      if (this.data.isFund) {
        updateData.purchaseDate = purchaseDate;
        updateData.expectedReturn = expectedReturn ? parseFloat(expectedReturn) : null;
        updateData.fundType = fundType || null;
        updateData.purchaseAmount = purchaseAmount ? parseFloat(purchaseAmount) : null;
      }

      await api.updateHolding(this.data.holdingId, updateData);

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
