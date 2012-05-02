Ext.define('BurnChartApp', {
    extend:'Rally.app.App',
    mixins: {
        messageable: 'Rally.Messageable'
    },
    layout: {
        type: 'hbox',
        align: 'stretch'
    },
    appName:'Burn Chart',
    cls:'burnchart',

    launch: function () {
        this.chartQuery = {
            find:{
                _Type:'HierarchicalRequirement',
                Children:null,
                _ItemHierarchy: 12231
            }
        };

        this.chartConfigBuilder = Ext.create('Rally.app.analytics.BurnChartBuilder');

    },

    initComponent: function() {
        this.callParent(arguments);
        //need this typeStore for the tree to determine portfolio hierarchy
        this.typeStore = Ext.create('Rally.data.WsapiDataStore', {
            model: 'Type',
            fetch: ['Name', 'OrdinalValue'],
            autoLoad: true,
            sorters: [
                {
                    property: 'OrdinalValue',
                    direction: 'DESC'
                }
            ],
            listeners: {
                //now that the store is loaded, create and add the tree
                load: this._addPiTree,
                scope: this
            }
        });

    },

    _addPiTree: function(typeStore) {
        var piTree = Ext.create('BurnChartApp.BurnChartTree', {
            id: 'rallytree1',
            width: 400,
            height: '100%',
            topLevelModel: 'PortfolioItem',
            topLevelStoreConfig: {
                listeners: {
                    beforeload: function(store) {
                        this.getEl().mask('Loading...');
                    },
                    load: function(store, records) {
                        if (records.length > 0) {
                            this.add({
                                id: 'chartCmp',
                                xtype: 'component',
                                flex: 1,
                                html: '<div>Choose a Portfolio Item from the list to see its burn chart.</div>'
                            })
                        }
                        this.getEl().unmask();
                    },
                    scope: this
                }
            },
            listeners: {
                rowclicked: this._refreshChart,
                scope: this
            },
            typeStore: typeStore
        });
        piTree.scope = piTree;
        
        this.add(piTree);
    },

    _afterChartConfigBuilt: function (success, chartConfig) {
        this._removeChartComponent();
        if (success) {
            this.add({
                id: 'chartCmp',
                xtype: 'highchart',
                flex: 1,
                chartConfig: chartConfig
            });
        } else {
            var formattedId = this.selectedRowRecord.get('FormattedID');
            this.add({
                id: 'chartCmp',
                xtype: 'component',
                html: '<div>No user story data found for ' + formattedId + ' starting from: ' + this.startTime + '</div>'
            });
        }
    },

    _removeChartComponent: function() {
        var chartCmp = this.down('#chartCmp');
        if (chartCmp) {
            this.remove(chartCmp);
        }
    },

    _refreshChart: function(treeRowRecord, itemId, title, startDate, endDate) {
        this.selectedRowRecord = treeRowRecord;
        this.chartQuery.find._ItemHierarchy = itemId;
        this.down('#chartCmp').getEl().mask('Loading...');
        this.chartConfigBuilder.build(this.chartQuery, title, startDate, endDate, Ext.bind(this._afterChartConfigBuilt, this));
    }
});
