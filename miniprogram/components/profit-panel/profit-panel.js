const format = require('../../utils/format');

Component({
  properties: {
    todayProfit: { type: Number, value: 0 },
    todayRate: { type: Number, value: 0 },
    totalProfit: { type: Number, value: 0 },
    totalProfitRate: { type: Number, value: 0 },
    totalAmount: { type: Number, value: 0 },
    costAmount: { type: Number, value: 0 }
  },

  data: {
    todayProfitDisplay: '0.00',
    todayRateDisplay: '0.00',
    totalProfitDisplay: '0.00',
    totalProfitRateDisplay: '0.00',
    totalAmountDisplay: '0.00',
    costAmountDisplay: '0.00'
  },

  observers: {
    'todayProfit, todayRate, totalProfit, totalProfitRate, totalAmount, costAmount': function() {
      this.updateDisplay();
    }
  },

  methods: {
    updateDisplay() {
      this.setData({
        todayProfitDisplay: format.toFixed(this.data.todayProfit),
        todayRateDisplay: format.toFixed(this.data.todayRate),
        totalProfitDisplay: format.toFixed(this.data.totalProfit),
        totalProfitRateDisplay: format.toFixed(this.data.totalProfitRate),
        totalAmountDisplay: format.toThousands(this.data.totalAmount),
        costAmountDisplay: format.toThousands(this.data.costAmount)
      });
    }
  }
});
