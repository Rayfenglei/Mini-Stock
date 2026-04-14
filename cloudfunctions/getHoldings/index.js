const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { accountId, assetType, refresh = false } = event;

  try {
    // 构建查询条件
    let whereCondition = { _openid: OPENID };

    if (accountId) {
      whereCondition.accountId = accountId;
    }

    // 如果指定了资产类型，添加类型筛选
    if (assetType) {
      whereCondition.assetType = assetType;
    }

    const result = await db.collection('holdings')
      .where(whereCondition)
      .orderBy('marketValue', 'desc')
      .get();

    return {
      code: 0,
      data: result.data
    };
  } catch (err) {
    console.error('获取持仓列表失败', err);
    return {
      code: -1,
      message: '获取持仓列表失败'
    };
  }
};
