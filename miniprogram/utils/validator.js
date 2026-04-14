const isValidStockCode = (code) => {
  return /^(sh|sz|bj)\d{6}$/i.test(code);
};

const isValidFundCode = (code) => {
  return /^\d{6}$/.test(code);
};

const isValidGoldCode = (code) => {
  return /^(au9999|au100g|etf\d{6})$/i.test(code);
};

const isValidAssetCode = (assetType, code) => {
  switch (assetType) {
    case 'stock':
      return isValidStockCode(code);
    case 'fund':
      return isValidFundCode(code);
    case 'gold':
      return isValidGoldCode(code);
    default:
      return false;
  }
};

const isValidPrice = (price) => {
  const num = parseFloat(price);
  return !isNaN(num) && num > 0;
};

const isValidShares = (shares) => {
  const num = parseFloat(shares);
  return !isNaN(num) && num > 0;
};

const isValidAmount = (amount) => {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0;
};

const isValidExpectedReturn = (rate) => {
  if (!rate || rate === '') return true; // 可选字段
  const num = parseFloat(rate);
  return !isNaN(num) && num >= -100 && num <= 100;
};

const isValidDate = (date) => {
  if (!date) return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(date)) return false;
  const d = new Date(date);
  return d instanceof Date && !isNaN(d);
};

const validateHoldingForm = (formData) => {
  const errors = [];

  if (!formData.assetType || !['stock', 'fund', 'gold'].includes(formData.assetType)) {
    errors.push('请选择资产类型');
  }

  // 黄金类型不强制要求资产代码和资产名称
  if (formData.assetType !== 'gold') {
    if (!formData.assetCode) {
      errors.push('请输入资产代码');
    } else if (!isValidAssetCode(formData.assetType, formData.assetCode)) {
      if (formData.assetType === 'fund') {
        errors.push('基金代码格式不正确，应为6位数字');
      } else if (formData.assetType === 'stock') {
        errors.push('股票代码格式不正确，需包含市场前缀如sh/sz/bj');
      } else {
        errors.push('资产代码格式不正确');
      }
    }

    if (!formData.assetName) {
      errors.push('请输入资产名称');
    }
  }

  if (!formData.shares || !isValidShares(formData.shares)) {
    errors.push('请输入正确的持有份额');
  }

  if (!formData.costPrice || !isValidPrice(formData.costPrice)) {
    errors.push('请输入正确的成本价');
  }

  // 基金特有字段验证
  if (formData.assetType === 'fund') {
    if (formData.purchaseDate && !isValidDate(formData.purchaseDate)) {
      errors.push('购买日期格式不正确');
    }

    if (formData.purchaseAmount && !isValidAmount(formData.purchaseAmount)) {
      errors.push('购买金额必须大于0');
    }

    if (!isValidExpectedReturn(formData.expectedReturn)) {
      errors.push('预期收益率必须在-100%到100%之间');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

const validateAccountForm = (formData) => {
  const errors = [];

  if (!formData.name || formData.name.trim().length === 0) {
    errors.push('请输入账户名称');
  }

  if (!formData.broker || formData.broker.trim().length === 0) {
    errors.push('请输入券商名称');
  }

  if (!formData.accountCode || formData.accountCode.trim().length === 0) {
    errors.push('请输入账户代码');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

module.exports = {
  isValidStockCode,
  isValidFundCode,
  isValidGoldCode,
  isValidAssetCode,
  isValidPrice,
  isValidShares,
  isValidAmount,
  isValidExpectedReturn,
  isValidDate,
  validateHoldingForm,
  validateAccountForm
};
