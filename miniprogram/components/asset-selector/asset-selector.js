Component({
  properties: {
    placeholder: { type: String, value: '搜索资产' },
    value: { type: String, value: '' },
    assetType: { type: String, value: 'stock' }
  },

  data: {
    currentType: 'stock',
    searchKeyword: '',
    searchResults: [],
    goldOptions: [
      { code: 'au9999', name: 'AU99.99', type: '现货黄金', price: '568.00', unit: 'g' },
      { code: 'au100g', name: 'AU100g', type: '现货黄金', price: '565.00', unit: 'g' },
      { code: 'etf518880', name: '黄金ETF', type: 'ETF', price: '5.68', unit: '份' }
    ]
  },

  observers: {
    assetType: function(val) {
      this.setData({ currentType: val });
    }
  },

  methods: {
    onTypeChange(e) {
      const type = e.currentTarget.dataset.type;
      this.setData({ 
        currentType: type,
        searchKeyword: '',
        searchResults: []
      });
      this.triggerEvent('change', { type });
    },

    onSearchInput(e) {
      this.setData({ searchKeyword: e.detail.value });
    },

    onSearch() {
      const { searchKeyword, currentType } = this.data;
      if (!searchKeyword) return;
      this.triggerEvent('search', { keyword: searchKeyword, type: currentType });
    },

    onSelect(e) {
      const item = e.currentTarget.dataset.item;
      this.triggerEvent('select', { item, type: this.data.currentType });
    },

    updateResults(results) {
      this.setData({ searchResults: results });
    }
  }
});
