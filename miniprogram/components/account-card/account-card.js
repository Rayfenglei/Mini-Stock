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
        totalAmountDisplay: Number(newData.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
        todayProfitDisplay: Number(newData.todayProfit || 0).toFixed(3),
        todayRateDisplay: Number(newData.todayRate || 0).toFixed(3)
      });
    },

    onCardTap() {
      this.triggerEvent('tap', { id: this.data.data._id });
    }
  }
});
