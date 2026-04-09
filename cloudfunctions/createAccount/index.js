const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { name, broker, accountCode } = event;
  
  try {
    const result = await db.collection('accounts').add({
      data: {
        name,
        broker,
        accountCode,
        totalAmount: 0,
        todayProfit: 0,
        todayRate: 0,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });
    
    return {
      code: 0,
      data: result._id
    };
  } catch (err) {
    console.error('创建账户失败', err);
    return {
      code: -1,
      message: '创建账户失败'
    };
  }
};
