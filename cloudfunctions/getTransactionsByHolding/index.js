const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { holdingId } = event;

  try {
    // 先验证持仓权限
    const holdingResult = await db.collection('holdings')
      .where({ _id: holdingId, _openid: OPENID })
      .get();

    if (holdingResult.data.length === 0) {
      return { code: -1, message: '持仓不存在或无权限' };
    }

    // 查询交易记录（兼容有openid和没有openid的情况）
    const result = await db.collection('transactions')
      .where({
        holdingId,
        $or: [
          { _openid: OPENID },
          { _openid: _.exists(false) }
        ]
      })
      .orderBy('tradeDate', 'desc')
      .get();

    return {
      code: 0,
      data: result.data
    };
  } catch (err) {
    console.error('获取交易记录失败', err);
    return {
      code: -1,
      message: '获取交易记录失败'
    };
  }
};
