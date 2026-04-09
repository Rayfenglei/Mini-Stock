const api = require('../../utils/api');
const format = require('../../utils/format');

Page({
  data: {
    transactions: [],
    groupedTransactions: [],
    accountNames: ['全部账户'],
    accountIndex: 0,
    timeRanges: ['全部时间', '最近7天', '最近30天', '最近3个月'],
    timeIndex: 0,
    accounts: []
  },

  onLoad() {
    this.loadTransactions();
    this.loadAccounts();
  },

  async loadAccounts() {
    try {
      const accounts = await api.getAccounts();
      const names = ['全部账户', ...accounts.map(a => a.name)];
      this.setData({ accounts, accountNames: names });
    } catch (error) {
      console.error('加载账户失败', error);
    }
  },

  async loadTransactions() {
    try {
      const { accountIndex, accounts } = this.data;
      let transactions = [];
      
      if (accountIndex === 0) {
        for (const account of accounts) {
          const txs = await api.getTransactions(account._id);
          transactions = transactions.concat(txs);
        }
      } else {
        transactions = await api.getTransactions(accounts[accountIndex - 1]._id);
      }

      transactions.sort((a, b) => new Date(b.tradeDate) - new Date(a.tradeDate));

      const transactionsWithDisplay = transactions.map(t => ({
        ...t,
        totalDisplay: format.toThousands(t.amount + (t.fee || 0))
      }));

      const grouped = this.groupByDate(transactionsWithDisplay);
      this.setData({ 
        transactions: transactionsWithDisplay,
        groupedTransactions: grouped 
      });
    } catch (error) {
      console.error('加载交易记录失败', error);
    }
  },

  groupByDate(transactions) {
    const groups = {};
    transactions.forEach(t => {
      const date = format.formatDate(t.tradeDate, 'YYYY年MM月');
      if (!groups[date]) {
        groups[date] = { dateGroup: date, transactions: [] };
      }
      groups[date].transactions.push({
        ...t,
        dateDisplay: format.formatDate(t.tradeDate, 'MM月DD日')
      });
    });
    return Object.values(groups);
  },

  onAccountChange(e) {
    this.setData({ accountIndex: e.detail.value }, () => {
      this.loadTransactions();
    });
  },

  onTimeChange(e) {
    this.setData({ timeIndex: e.detail.value }, () => {
      this.loadTransactions();
    });
  },

  goToAddTransaction() {
    wx.navigateTo({ url: '/pages/addTransaction/addTransaction' });
  }
});
