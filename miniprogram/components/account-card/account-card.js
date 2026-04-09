Component({
  properties: {
    data: {
      type: Object,
      value: {},
      observer: 'onDataChange'
    }
  },

  data: {
    totalAmountDisplay: '0.00',
    todayProfitDisplay: '0.00',
    todayRateDisplay: '0.00'
  },

  methods: {
    onDataChange(newData) {
      this.setData({
        totalAmountDisplay: Number(newData.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        todayProfitDisplay: Number(newData.todayProfit || 0).toFixed(2),
        todayRateDisplay: Number(newData.todayRate || 0).toFixed(2)
      });
    },

    onCardTap() {
      this.triggerEvent('tap', { id: this.data.data._id });
    }
  }
});
