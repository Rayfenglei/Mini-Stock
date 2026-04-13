const api = require('../../utils/api');
const validator = require('../../utils/validator');
const format = require('../../utils/format');

Page({
  data: {
    accountId: '',
    assetType: 'stock',
    // 简化版基金表单数据
    fundForm: {
      code: '',
      name: '',
      date: '',
      amount: '',
      netValue: '',
      shares: ''
    },
    // 手动输入模式表单数据（30天以外）
    manualForm: {
      code: '',
      name: '',
      date: '',
      amount: '',
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
    autoFilled: false,
    costAmountDisplay: '0.00',
    // 日期选择器范围
    minDate: '2000-01-01',
    maxDate: '',
    // 计算结果显示
    showCalcResult: false,
    calcShares: '',
    calcNetValue: '',
    // 加载状态
    loading: false,
    loadingText: '',
    // 添加方式切换
    isWithin30Days: true,  // 是否在30天以内
    daysDiff: 0,           // 日期差值
    // 分页相关
    currentPage: 1,
    totalPages: 1,
    historyList: [],
    // 错误提示
    errorMsg: '',
    showError: false
  },

  onLoad(options) {
    const type = options.type || 'stock';
    const today = format.formatDate(new Date(), 'YYYY-MM-DD');
    this.setData({
      accountId: options.accountId || '',
      assetType: type,
      'fundForm.date': today,
      'manualForm.date': today,
      maxDate: today
    });
  },

  onAssetTypeChange(e) {
    const type = e.detail.type;
    const today = format.formatDate(new Date(), 'YYYY-MM-DD');
    this.setData({
      assetType: type,
      autoFilled: false,
      formData: { assetName: '', assetCode: '', shares: '', costPrice: '' },
      fundForm: {
        code: '',
        name: '',
        date: today,
        amount: '',
        netValue: '',
        shares: ''
      },
      manualForm: {
        code: '',
        name: '',
        date: today,
        amount: '',
        netValue: '',
        shares: ''
      },
      costAmountDisplay: '0.00',
      maxDate: today,
      showCalcResult: false,
      calcShares: '',
      calcNetValue: '',
      isWithin30Days: true,
      daysDiff: 0,
      currentPage: 1,
      totalPages: 1,
      historyList: [],
      errorMsg: '',
      showError: false
    });
  },

  // ========== 日期差值计算 ==========

  calculateDaysDiff(selectedDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);

    const diffTime = today - selected;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  },

  // ========== 场景1：30天以内（自动查询净值） ==========

  // 基金代码输入
  onFundCodeInput(e) {
    const code = e.detail.value;
    this.setData({ 'fundForm.code': code });
    if (code.length === 6) {
      this.queryFundName(code, 'fundForm');
    }
  },

  // 买入日期选择
  onFundDateChange(e) {
    const date = e.detail.value;
    const daysDiff = this.calculateDaysDiff(date);
    const isWithin30Days = daysDiff <= 30;

    this.setData({
      'fundForm.date': date,
      isWithin30Days: isWithin30Days,
      daysDiff: daysDiff,
      showCalcResult: false,
      errorMsg: '',
      showError: false
    });

    // 如果切换到30天以外，同步数据到手动表单
    if (!isWithin30Days) {
      this.setData({
        'manualForm.code': this.data.fundForm.code,
        'manualForm.name': this.data.fundForm.name,
        'manualForm.date': date
      });
    }
  },

  // 投资金额输入
  onFundAmountInput(e) {
    this.setData({
      'fundForm.amount': e.detail.value,
      showCalcResult: false
    });
  },

  // 查询基金名称
  async queryFundName(code, formKey) {
    try {
      const result = await api.getFundQuote(code);
      if (result && result.code === 0) {
        this.setData({
          [`${formKey}.name`]: result.data.name
        });
      }
    } catch (error) {
      console.error('查询基金名称失败', error);
    }
  },

  // 计算份额（30天以内）
  async calculateFundShares() {
    const { code, date, amount } = this.data.fundForm;

    // 验证输入
    if (!this.validateFundForm('fundForm')) return;

    this.setData({
      loading: true,
      loadingText: '正在查询净值...',
      errorMsg: '',
      showError: false
    });

    try {
      // 获取基金历史净值，默认30条/页
      const result = await api.getFundHistory(code, date, 1, 30);

      this.setData({ loading: false });

      if (result.code !== 0) {
        // 如果未找到，但有分页数据，显示历史列表供用户选择
        if (result.data && result.data.history && result.data.history.length > 0) {
          this.setData({
            historyList: result.data.history,
            currentPage: result.data.pagination.currentPage,
            totalPages: result.data.pagination.totalPages,
            errorMsg: result.message,
            showError: true
          });
          return;
        }

        this.setData({
          errorMsg: result.message || '获取基金净值失败',
          showError: true
        });
        return;
      }

      const netValue = result.data.netValue;
      const fundName = result.data.name;
      const amountNum = parseFloat(amount);

      // 计算份额
      const shares = (amountNum / netValue).toFixed(2);

      this.setData({
        'fundForm.name': fundName,
        'fundForm.netValue': netValue.toFixed(4),
        'fundForm.shares': shares,
        showCalcResult: true,
        calcShares: shares,
        calcNetValue: netValue.toFixed(4),
        currentPage: 1,
        totalPages: result.data.pagination.totalPages,
        historyList: result.data.history || []
      });

      wx.showModal({
        title: '份额计算成功',
        content: `基金：${fundName}\n买入日期：${date}\n投资金额：¥${amountNum.toFixed(2)}\n当日净值：¥${netValue.toFixed(4)}\n计算份额：${shares} 份`,
        showCancel: false
      });

    } catch (error) {
      this.setData({ loading: false });
      console.error('计算份额失败', error);
      this.setData({
        errorMsg: '计算失败，请重试',
        showError: true
      });
    }
  },

  // 翻页查询
  async onPageChange(e) {
    const action = e.currentTarget.dataset.action;
    let { currentPage, totalPages } = this.data;

    if (action === 'prev' && currentPage > 1) {
      currentPage--;
    } else if (action === 'next' && currentPage < totalPages) {
      currentPage++;
    } else if (action === 'jump') {
      const page = parseInt(e.detail.value);
      if (page >= 1 && page <= totalPages) {
        currentPage = page;
      }
    }

    const { code, date } = this.data.fundForm;

    this.setData({
      loading: true,
      loadingText: `正在加载第${currentPage}页...`
    });

    try {
      const result = await api.getFundHistory(code, date, currentPage, 30);
      this.setData({ loading: false });

      if (result.code === 0 || (result.data && result.data.history)) {
        this.setData({
          historyList: result.data.history,
          currentPage: currentPage,
          totalPages: result.data.pagination.totalPages
        });

        // 如果找到目标日期，自动填充
        if (result.code === 0 && result.data.netValue) {
          const amountNum = parseFloat(this.data.fundForm.amount);
          const shares = (amountNum / result.data.netValue).toFixed(2);

          this.setData({
            'fundForm.netValue': result.data.netValue.toFixed(4),
            'fundForm.shares': shares,
            showCalcResult: true,
            calcShares: shares,
            calcNetValue: result.data.netValue.toFixed(4)
          });
        }
      }
    } catch (error) {
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 从历史列表选择日期
  onSelectHistoryDate(e) {
    const { date, netvalue } = e.currentTarget.dataset;
    const amountNum = parseFloat(this.data.fundForm.amount);
    const shares = (amountNum / netvalue).toFixed(2);

    this.setData({
      'fundForm.date': date,
      'fundForm.netValue': netvalue.toFixed(4),
      'fundForm.shares': shares,
      showCalcResult: true,
      calcShares: shares,
      calcNetValue: netvalue.toFixed(4),
      errorMsg: '',
      showError: false
    });

    wx.showToast({ title: '已选择该日期净值', icon: 'success' });
  },

  // 提交基金持仓（30天以内）
  async submitFundHolding() {
    const { code, name, date, amount, netValue, shares } = this.data.fundForm;

    if (!this.validateFundForm('fundForm', true)) return;

    try {
      wx.showLoading({ title: '添加中...' });

      await api.addHolding({
        accountId: this.data.accountId,
        assetType: 'fund',
        assetCode: code,
        assetName: name,
        shares: parseFloat(shares),
        costPrice: parseFloat(netValue),
        purchaseDate: date,
        purchaseAmount: parseFloat(amount)
      });

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

  // ========== 场景2：30天以外（手动输入） ==========

  // 手动模式 - 基金代码输入
  onManualCodeInput(e) {
    const code = e.detail.value;
    this.setData({ 'manualForm.code': code });
    if (code.length === 6) {
      this.queryFundName(code, 'manualForm');
    }
  },

  // 手动模式 - 日期选择
  onManualDateChange(e) {
    const date = e.detail.value;
    const daysDiff = this.calculateDaysDiff(date);
    const isWithin30Days = daysDiff <= 30;

    this.setData({
      'manualForm.date': date,
      isWithin30Days: isWithin30Days,
      daysDiff: daysDiff
    });

    // 如果切换到30天以内，同步数据到自动表单
    if (isWithin30Days) {
      this.setData({
        'fundForm.code': this.data.manualForm.code,
        'fundForm.name': this.data.manualForm.name,
        'fundForm.date': date
      });
    }
  },

  // 手动模式 - 投资金额输入
  onManualAmountInput(e) {
    this.setData({ 'manualForm.amount': e.detail.value });
    this.calculateManualShares();
  },

  // 手动模式 - 净值输入
  onManualNetValueInput(e) {
    this.setData({ 'manualForm.netValue': e.detail.value });
    this.calculateManualShares();
  },

  // 手动模式 - 计算份额
  calculateManualShares() {
    const { amount, netValue } = this.data.manualForm;
    const amountNum = parseFloat(amount);
    const netValueNum = parseFloat(netValue);

    if (amountNum > 0 && netValueNum > 0) {
      const shares = (amountNum / netValueNum).toFixed(2);
      this.setData({
        'manualForm.shares': shares,
        showCalcResult: true,
        calcShares: shares,
        calcNetValue: netValueNum.toFixed(4)
      });
    } else {
      this.setData({
        'manualForm.shares': '',
        showCalcResult: false
      });
    }
  },

  // 提交手动模式基金持仓
  async submitManualFundHolding() {
    const { code, name, date, amount, netValue, shares } = this.data.manualForm;

    if (!this.validateManualForm()) return;

    try {
      wx.showLoading({ title: '添加中...' });

      await api.addHolding({
        accountId: this.data.accountId,
        assetType: 'fund',
        assetCode: code,
        assetName: name,
        shares: parseFloat(shares),
        costPrice: parseFloat(netValue),
        purchaseDate: date,
        purchaseAmount: parseFloat(amount)
      });

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

  validateFundForm(formKey, isSubmit = false) {
    const form = this.data[formKey];
    const errors = [];

    if (!form.code || !/^\d{6}$/.test(form.code)) {
      errors.push('请输入正确的6位基金代码');
    }

    if (!form.date) {
      errors.push('请选择买入日期');
    }

    const amountNum = parseFloat(form.amount);
    if (!form.amount || isNaN(amountNum) || amountNum <= 0) {
      errors.push('请输入有效的投资金额');
    }

    if (isSubmit && (!form.netValue || !form.shares)) {
      errors.push('请先计算份额');
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

  validateManualForm() {
    const form = this.data.manualForm;
    const errors = [];

    if (!form.code || !/^\d{6}$/.test(form.code)) {
      errors.push('请输入正确的6位基金代码');
    }

    if (!form.name) {
      errors.push('基金名称不能为空，请检查基金代码');
    }

    if (!form.date) {
      errors.push('请选择买入日期');
    }

    const amountNum = parseFloat(form.amount);
    if (!form.amount || isNaN(amountNum) || amountNum <= 0) {
      errors.push('请输入有效的投资金额（大于0）');
    }

    const netValueNum = parseFloat(form.netValue);
    if (!form.netValue || isNaN(netValueNum) || netValueNum <= 0) {
      errors.push('请输入有效的基金净值（大于0）');
    }

    if (!form.shares) {
      errors.push('请确保投资金额和净值输入正确以计算份额');
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
