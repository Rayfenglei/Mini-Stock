const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { holdingId, accountId, type, shares, price, fee, tradeDate } = event;

  try {
    // 1. 获取当前持仓信息
    const holdingResult = await db.collection('holdings')
      .where({ _id: holdingId, _openid: OPENID })
      .get();

    if (holdingResult.data.length === 0) {
      return { code: -1, message: '持仓不存在或无权限' };
    }

    const holding = holdingResult.data[0];
    const amount = shares * price;
    const total = amount + (fee || 0);

    // 2. 添加交易记录
    const transactionResult = await db.collection('transactions').add({
      data: {
        holdingId,
        accountId: accountId || holding.accountId,
        assetType: holding.assetType,
        assetCode: holding.assetCode,
        assetName: holding.assetName,
        type,
        shares,
        price,
        fee: fee || 0,
        amount,
        total,
        tradeDate: tradeDate || db.serverDate(),
        _openid: OPENID,
        createTime: db.serverDate()
      }
    });

    // 3. 更新持仓数据
    let newShares = holding.shares;
    let newCostPrice = holding.costPrice;
    let newCostAmount = holding.costAmount;

    if (type === 'buy') {
      // 买入：增加份额，重新计算成本价（加权平均）
      const totalShares = holding.shares + shares;
      const totalCost = holding.costAmount + amount;
      newShares = totalShares;
      newCostPrice = totalCost / totalShares;
      newCostAmount = totalCost;
    } else if (type === 'sell') {
      // 卖出：减少份额
      newShares = holding.shares - shares;
      // 成本价保持不变，成本金额相应减少
      newCostAmount = newShares * holding.costPrice;

      // 如果份额为0，可以选择删除持仓或保留记录
      if (newShares <= 0) {
        newShares = 0;
        newCostAmount = 0;
        newCostPrice = 0;
      }
    }

    // 更新持仓
    await db.collection('holdings').doc(holdingId).update({
      data: {
        shares: newShares,
        costPrice: newCostPrice,
        costAmount: newCostAmount,
        updateTime: db.serverDate()
      }
    });

    return {
      code: 0,
      data: {
        transactionId: transactionResult._id,
        newShares,
        newCostPrice,
        newCostAmount
      }
    };
  } catch (err) {
    console.error('添加交易记录失败', err);
    return {
      code: -1,
      message: '添加交易记录失败'
    };
  }
};
