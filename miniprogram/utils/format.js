const toFixed = (num, digits = 2) => {
  if (num === null || num === undefined) return '0';
  return Number(num).toFixed(digits);
};

const toThousands = (num) => {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const formatDate = (date, format = 'YYYY-MM-DD') => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day);
};

const formatMoney = (num) => {
  return '¥' + toThousands(num);
};

const getAssetTypeInfo = (assetType) => {
  const typeMap = {
    stock: { label: '股', icon: '📈', tagClass: 'asset-tag-stock', color: '#1A73E8' },
    fund: { label: '基', icon: '💰', tagClass: 'asset-tag-fund', color: '#FF9800' },
    gold: { label: '金', icon: '🥇', tagClass: 'asset-tag-gold', color: '#FFD700' }
  };
  return typeMap[assetType] || typeMap.stock;
};

module.exports = {
  toFixed,
  toThousands,
  formatDate,
  formatMoney,
  getAssetTypeInfo
};
