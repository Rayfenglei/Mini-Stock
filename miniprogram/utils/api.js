const callFunction = (name, data) => {
  return wx.cloud.callFunction({
    name,
    data
  }).then(res => res.result);
};

module.exports = {
  getAccounts: () => callFunction('getAccounts'),
  getAccountById: (id) => callFunction('getAccountById', { id }),
  createAccount: (data) => callFunction('createAccount', data),
  updateAccount: (id, data) => callFunction('updateAccount', { id, ...data }),
  deleteAccount: (id) => callFunction('deleteAccount', { id }),

  getHoldings: (accountId, refresh = false) =>
    callFunction('getHoldings', { accountId, refresh }),
  getHoldingById: (id) => callFunction('getHoldingById', { id }),
  addHolding: (data) => callFunction('addHolding', data),
  updateHolding: (id, data) => callFunction('updateHolding', { id, ...data }),
  deleteHolding: (id) => callFunction('deleteHolding', { id }),

  getTransactions: (accountId) =>
    callFunction('getTransactions', { accountId }),
  getTransactionsByHolding: (holdingId) =>
    callFunction('getTransactionsByHolding', { holdingId }),
  addTransaction: (data) => callFunction('addTransaction', data),

  getStockQuote: (code) => callFunction('getStockQuote', { code }),
  getFundQuote: (code) => callFunction('getFundQuote', { code }),
  getGoldQuote: (code) => callFunction('getGoldQuote', { code }),

  getBatchQuotes: (codes) => callFunction('getBatchQuotes', { codes }),

  httpRequest: (url, method = 'GET') =>
    callFunction('httpRequest', { url, method })
};
