Ext.namespace('BurnChartApp');
Ext.define('BurnChartApp.BurnChartTree', {
    extend: 'Rally.ui.tree.Tree',
    initComponent: function() {
        this.callParent(arguments);
        this.addEvents('rowclicked');
        this.on('add', this._onTreeRowAdd, this);

    },
    childModelTypeForRecordFn: this.getChildModelTypeForRecordFn,
    parentAttributeForChildRecordFn: this.getParentAttributeForChildRecordFn,
    canExpandFn: this.getCanExpandFn,
    //override
    drawEmptyMsg: function() {
        if (Ext.getCmp('chartCmp')) {
            Ext.getCmp('chartCmp').destroy();
        }
        this.add({
            xtype: 'component',
            html: '<div class="emptyChartMsg"> No Portfolio Items within the currently scoped project(s).</div>'
        });
    },

    _isRecordBottomPortfolioLevel: function(record) {
        if (record.get('_type') === 'portfolioitem') {
            var lowestLevelType = this.typeStore.findRecord('OrdinalValue', 1);
            return record.get('PortfolioItemType')._ref == lowestLevelType.get('_ref');
        }
    },

    getChildModelTypeForRecordFn: function() {
        return function(record) {
            return (this._isRecordBottomPortfolioLevel(record) || record.get('_type') == 'hierarchicalrequirement') ? 'UserStory' : 'PortfolioItem'
        };
    },

    getParentAttributeForChildRecordFn: function() {
        return function(record){
            return this._isRecordBottomPortfolioLevel(record) ? 'PortfolioItem' : 'Parent'
        };
    },

    getCanExpandFn: function(){
        return function(record) {
            return record.get('Children') && record.get('Children').length > 0 || record.get('UserStories') && record.get('UserStories').length > 0;
        }
    },

    _onTreeRowAdd: function(tree, treeRow) {
        treeRow.on('afterrender', this._afterTreeRowRendered, this);
    },

    _afterTreeRowRendered: function(treeRow) {
        treeRow.getEl().on('click', this._onTreeRowClick, this, {stopEvent: true});
    },

    _onTreeRowClick: function(event, treeRowTextEl) {
        var prevSelectedItem = Ext.DomQuery.selectNode('.treeItem.selected');
        if (prevSelectedItem) {
            Ext.fly(prevSelectedItem).removeCls('selected');
        }
        var treeItemDom = Ext.get(treeRowTextEl).findParentNode('.treeItem');
        Ext.fly(treeItemDom).addCls('selected');
        var treeRowRecord = Ext.getCmp(treeItemDom.id).getRecord();
        var itemId = treeRowRecord.get('ObjectID');
        var title = treeRowRecord.get('FormattedID') + ' - ' + treeRowRecord.get('Name');
        var startDateObj = treeRowRecord.get('ActualStartDate');
        startDateObj = startDateObj ? startDateObj : treeRowRecord.get('PlannedStartDate');
        //if all else fails, use creation date as a start date. that always exists.
        startDateObj = startDateObj ? startDateObj : treeRowRecord.get('CreationDate');
        var startYear = this._addZeroToDateIfNeeded(startDateObj.getUTCFullYear());
        var startMonth = this._addZeroToDateIfNeeded(startDateObj.getUTCMonth() + 1);
        var startDay = this._addZeroToDateIfNeeded(startDateObj.getUTCDate());

        var startDate = startYear + "-" + startMonth + "-" + startDay + "T00:00:00Z";
        var endDateObj = treeRowRecord.get('PlannedEndDate');
        var endDate;
        if (endDateObj) {
            var endYear = endDateObj.getUTCFullYear();
            var endMonth = this._addZeroToDateIfNeeded(endDateObj.getUTCMonth() + 1);
            var endDay = this._addZeroToDateIfNeeded(endDateObj.getUTCDate());

            endDate = endYear + "-" + endMonth + "-" + endDay + "T00:00:00Z";
            console.log("endDate = " + endDate);
        }
        else {
            console.log("Planned End Date does not exist!");
        }
        this.fireEvent('rowclicked', treeRowRecord, itemId, title, startDate, endDate);
    },

    _addZeroToDateIfNeeded: function(dateValue) {
        if (dateValue.toString().length < 2) {
            dateValue = "0" + dateValue;
        }
        return dateValue;
    }
});