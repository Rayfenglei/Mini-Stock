const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { holdingId, type, shares, price, fee, tradeDate } = event;
  
  try {
    const amount = shares * price;
    const total = amount + (fee || 0);
    
    const result = await db.collection('transactions').add({
      data: {
        holdingId,
        type,
        shares,
        price,
        fee: fee || 0,
        amount,
        total,
        tradeDate: tradeDate || db.serverDate(),
        createTime: db.serverDate()
      }
    });
    
    return {
      code: 0,
      data: result._id
    };
  } catch (err) {
    console.error('添加交易记录失败', err);
    return {
      code: -1,
      message: '添加交易记录失败'
    };
  }
};
