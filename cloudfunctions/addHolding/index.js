const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { accountId, assetType, assetCode, assetName, shares, costPrice, purchaseDate, expectedReturn, fundType, purchaseAmount } = event;

  try {
    const costAmount = shares * costPrice;

    const holdingData = {
      assetType,
      assetCode,
      assetName,
      shares,
      costPrice,
      costAmount,
      currentPrice: costPrice,
      marketValue: costAmount,
      todayProfit: 0,
      todayRate: 0,
      profit: 0,
      profitRate: 0,
      _openid: OPENID,
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    };

    if (accountId) {
      holdingData.accountId = accountId;
    }

    // 基金特有字段
    if (assetType === 'fund') {
      if (purchaseDate) {
        holdingData.purchaseDate = purchaseDate;
      }
      if (expectedReturn !== null && expectedReturn !== undefined) {
        holdingData.expectedReturn = expectedReturn;
      }
      if (fundType) {
        holdingData.fundType = fundType;
      }
      if (purchaseAmount !== null && purchaseAmount !== undefined) {
        holdingData.purchaseAmount = purchaseAmount;
      }
    }

    const result = await db.collection('holdings').add({
      data: holdingData
    });

    return {
      code: 0,
      data: result._id
    };
  } catch (err) {
    console.error('添加持仓失败', err);
    return {
      code: -1,
      message: '添加持仓失败'
    };
  }
};
