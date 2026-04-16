const api = require('../../utils/api');
const validator = require('../../utils/validator');
const format = require('../../utils/format');
const cache = require('../../utils/cache');

Page({
  data: {
    accountId: '',
    assetType: 'stock',
    // 基金表单数据（简化版）
    fundForm: {
      code: '',
      name: '',
      amount: '',
      holdingValue: '',
      netValue: '',
      shares: ''
    },
    // 股票/黄金表单数据
    formData: {
      assetName: '',
      assetCode: '',
      shares: '',
      costPrice: ''
    },
    // 股票代码输入（纯数字，不含前缀）
    stockInputCode: '',
    autoFilled: false,
    costAmountDisplay: '0.00',
    // 计算结果显示
    showCalcResult: false,
    calcShares: '',
    calcNetValue: '',
    // 加载状态
    loading: false,
    loadingText: '',
    // 错误提示
    errorMsg: '',
    showError: false
  },

  onLoad(options) {
    const type = options.type || 'stock';
    this.setData({
      accountId: options.accountId || '',
      assetType: type,
      autoFilled: false
    });
  },

  onAssetTypeChange(e) {
    const type = e.detail.type;
    this.setData({
      assetType: type,
      autoFilled: false,
      stockInputCode: '',
      formData: { assetName: '', assetCode: '', shares: '', costPrice: '' },
      fundForm: {
        code: '',
        name: '',
        amount: '',
        holdingValue: '',
        netValue: '',
        shares: ''
      },
      costAmountDisplay: '0.00',
      showCalcResult: false,
      calcShares: '',
      calcNetValue: '',
      errorMsg: '',
      showError: false
    });
  },

  // ========== 基金功能 ==========

  // 基金代码输入
  onFundCodeInput(e) {
    const code = e.detail.value;
    this.setData({ 'fundForm.code': code });
    if (code.length === 6) {
      this.queryFundName(code);
    }
  },

  // 投资金额输入（可选）
  onFundAmountInput(e) {
    this.setData({
      'fundForm.amount': e.detail.value,
      showCalcResult: false
    });
  },

  // 持仓份额输入
  onFundSharesInput(e) {
    this.setData({
      'fundForm.shares': e.detail.value,
      showCalcResult: false
    });
  },

  // 查询基金名称
  async queryFundName(code) {
    try {
      const result = await api.getFundQuote(code);
      if (result && result.code === 0) {
        this.setData({
          'fundForm.name': result.data.name
        });
      }
    } catch (error) {
      console.error('查询基金名称失败', error);
    }
  },

  // 计算持仓价值 - 根据持仓份额和当天净值计算
  async calculateFundShares() {
    const { code, shares } = this.data.fundForm;

    // 验证输入
    if (!this.validateFundForm()) return;

    this.setData({
      loading: true,
      loadingText: '正在查询净值...',
      errorMsg: '',
      showError: false
    });

    try {
      // 获取基金当天净值
      const result = await api.getFundQuote(code);

      this.setData({ loading: false });

      if (result.code !== 0) {
        this.setData({
          errorMsg: result.message || '获取基金净值失败',
          showError: true
        });
        return;
      }

      const netValue = result.data.netValue;
      const fundName = result.data.name;
      const sharesNum = parseFloat(shares);

      // 计算持仓价值：份额 × 净值
      const holdingValue = sharesNum * netValue;

      this.setData({
        'fundForm.name': fundName,
        'fundForm.netValue': netValue.toFixed(4),
        'fundForm.holdingValue': holdingValue.toFixed(3),
        showCalcResult: true,
        calcShares: sharesNum.toFixed(3),
        calcNetValue: netValue.toFixed(4),
        calcHoldingValue: holdingValue.toFixed(3)
      });

      wx.showModal({
        title: '持仓价值计算成功',
        content: `基金：${fundName}\n持仓份额：${sharesNum.toFixed(3)} 份\n当日净值：¥${netValue.toFixed(4)}\n持仓价值：¥${holdingValue.toFixed(3)}`,
        showCancel: false
      });

    } catch (error) {
      this.setData({ loading: false });
      console.error('计算持仓价值失败', error);
      this.setData({
        errorMsg: '计算失败，请重试',
        showError: true
      });
    }
  },

  // 提交基金持仓
  async submitFundHolding() {
    const { code, name, amount, netValue, shares } = this.data.fundForm;

    if (!this.validateFundForm(true)) return;

    try {
      wx.showLoading({ title: '添加中...' });

      const today = format.formatDate(new Date(), 'YYYY-MM-DD');

      await api.addHolding({
        accountId: this.data.accountId,
        assetType: 'fund',
        assetCode: code,
        assetName: name,
        shares: parseFloat(shares),
        costPrice: parseFloat(netValue),
        purchaseDate: today,
        purchaseAmount: amount ? parseFloat(amount) : null
      });

      // 清除基金持仓缓存，确保主页能显示最新数据
      cache.removeCache(cache.generateCacheKey('holdings', { type: 'fund' }));
      // 同时清除总资产缓存
      cache.removeCache(cache.generateCacheKey('holdings', { type: '' }));

      wx.hideLoading();
      wx.showToast({ title: '添加成功', icon: 'success' });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      wx.hideLoading();
      console.error('添加基金持仓失败', error);
      wx.showToast({ title: '添加失败', icon: 'none' });
    }
  },

  // ========== 表单验证 ==========

  validateFundForm(isSubmit = false) {
    const form = this.data.fundForm;
    const errors = [];

    if (!form.code || !/^\d{6}$/.test(form.code)) {
      errors.push('请输入正确的6位基金代码');
    }

    const sharesNum = parseFloat(form.shares);
    if (!form.shares || isNaN(sharesNum) || sharesNum <= 0) {
      errors.push('请输入有效的持仓份额');
    }

    if (isSubmit && (!form.netValue || !form.holdingValue)) {
      errors.push('请先计算持仓价值');
    }

    if (errors.length > 0) {
      this.setData({
        errorMsg: errors[0],
        showError: true
      });
      return false;
    }

    return true;
  },

  // 关闭错误提示
  onCloseError() {
    this.setData({ showError: false });
  },

  // ========== 股票/黄金功能（原有功能）==========

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
    const { item, type } = e.detail;
    if (type === 'gold') {
      this.setData({
        'formData.assetName': item.name,
        'formData.assetCode': item.code,
        autoFilled: true
      });
    } else {
      this.setData({
        'formData.assetName': item.name,
        'formData.assetCode': item.code,
        'formData.costPrice': item.price ? item.price.toString() : '',
        autoFilled: true
      });
      this.calculateCostAmount();
    }
  },

  onNameInput(e) {
    this.setData({ 'formData.assetName': e.detail.value });
  },

  onCodeInput(e) {
    this.setData({ 'formData.assetCode': e.detail.value });
  },

  // 股票代码输入（简化版，类似基金）
  onStockCodeInput(e) {
    const code = e.detail.value;
    this.setData({ stockInputCode: code });
    if (code.length === 6) {
      this.queryStockName(code);
    }
  },

  // 查询股票名称
  async queryStockName(code) {
    try {
      // 自动添加市场前缀
      // 6/8/4开头 -> sh(沪市), 0/3开头 -> sz(深市), 5开头可能是sh(沪市ETF)或sz(深市ETF)
      let codeWithPrefix = code;
      if (!/^(sh|sz|bj)/i.test(code)) {
        let prefix = 'sz';
        if (code.startsWith('6') || code.startsWith('8') || code.startsWith('4')) {
          prefix = 'sh';
        } else if (code.startsWith('5')) {
          // 5开头通常是沪市ETF
          prefix = 'sh';
        }
        codeWithPrefix = prefix + code;
      }

      wx.showLoading({ title: '查询中...' });
      const result = await api.getStockQuote(codeWithPrefix);
      wx.hideLoading();

      if (result && result.code === 0) {
        // 处理可能的编码问题
        let name = result.data.name;
        // 如果名称包含乱码字符，尝试修复
        if (name && name.includes('')) {
          console.warn('股票名称包含乱码:', name);
        }
        this.setData({
          'formData.assetName': name,
          'formData.assetCode': codeWithPrefix
        });
      } else {
        wx.showToast({ title: result?.message || '查询失败', icon: 'none' });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('查询股票名称失败', error);
      wx.showToast({ title: '查询失败', icon: 'none' });
    }
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

      // 黄金类型设置默认值
      const submitData = {
        accountId,
        assetType,
        assetCode: assetType === 'gold' ? 'gold' : formData.assetCode,
        assetName: assetType === 'gold' ? '黄金' : formData.assetName,
        shares: parseFloat(formData.shares),
        costPrice: parseFloat(formData.costPrice)
      };

      await api.addHolding(submitData);

      // 清除持仓相关缓存，确保主页能显示最新数据
      const cacheKey = cache.generateCacheKey('holdings', { type: assetType });
      cache.removeCache(cacheKey);
      // 同时清除总资产缓存
      cache.removeCache(cache.generateCacheKey('holdings', { type: '' }));

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
