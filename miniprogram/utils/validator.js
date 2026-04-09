const isValidStockCode = (code) => {
  return /^(sh|sz|bj)\d{6}$/i.test(code);
};

const isValidFundCode = (code) => {
  return /^(sh|sz)\d{6}$/i.test(code);
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

const validateHoldingForm = (formData) => {
  const errors = [];

  if (!formData.assetType || !['stock', 'fund', 'gold'].includes(formData.assetType)) {
    errors.push('请选择资产类型');
  }

  if (!formData.assetCode) {
    errors.push('请输入资产代码');
  } else if (!isValidAssetCode(formData.assetType, formData.assetCode)) {
    errors.push('资产代码格式不正确');
  }

  if (!formData.assetName) {
    errors.push('请输入资产名称');
  }

  if (!formData.shares || !isValidShares(formData.shares)) {
    errors.push('请输入正确的持有份额');
  }

  if (!formData.costPrice || !isValidPrice(formData.costPrice)) {
    errors.push('请输入正确的成本价');
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
  validateHoldingForm,
  validateAccountForm
};
