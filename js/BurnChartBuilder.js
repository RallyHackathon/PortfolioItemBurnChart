(function () {

    Ext.define('Rally.app.analytics.BurnChartBuilder', {
        mixins:{
            componentUpdatable:'Rally.util.ComponentUpdatable'
        },
        build:function (requestedQuery, chartTitle, startDate, endDate, buildFinishedCallback) {
        	this.endTime = endDate;
            this.chartTitle = chartTitle;
            this.buildFinishedCallback = buildFinishedCallback;
            this.startTime = startDate;
            this.query = {
                find:Ext.encode(requestedQuery.find),
                pagesize:10000
            };
            this.requestedFields = Ext.Array.union(['_ValidFrom', '_ValidTo', 'ObjectID', 'ScheduleState'], requestedQuery.fields ? requestedQuery.fields : []);

            this.workspace = Rally.util.Ref.getOidFromRef(Rally.environment.getContext().context.scope.workspace._ref);

            if (this.scheduleStateOidAccepted && this.scheduleStateOidReleased) {
                this._queryAnalyticsApi();
            } else {
                //mark this component that its updating multiple ajax requests. See Rally.util.ComponentUpdatable mixin.
                var acceptedReqName = 'GetAcceptedScheduleStateOid';
                var releasedReqName = 'GetReleasedScheduleStateOid';
                //mark which requests need to be made
                if (!this.scheduleStateOidAccepted) {
                    this.markUpdating(acceptedReqName);
                }
                if (!this.scheduleStateOidReleased) {
                    this.markUpdating(releasedReqName);
                }
                //now make requests
                if (!this.scheduleStateOidAccepted) {
                    this._getScheduleStateOid('Accepted', acceptedReqName);
                }
                if (!this.scheduleStateOidReleased) {
                    this._getScheduleStateOid('Released', releasedReqName);
                }
            }

        },

        _afterAllScheduleStateOidsReturned:function () {
            this._queryAnalyticsApi();
        },

        _queryAnalyticsApi:function () {
            Ext.Ajax.request({
                url:"https://rally1.rallydev.com/analytics/1.27/" + this.workspace + "/artifact/snapshot/query.js?" + Ext.Object.toQueryString(this.query) +
                    "&fields=" + JSON.stringify(this.requestedFields) + "&sort={_ValidFrom:1}",
                method:"GET",
                success:function (response) {
                    this._afterQueryReturned(JSON.parse(response.responseText));
                },
                scope:this
            });
        },

        _getScheduleStateOid:function (state, reqName) {
            var workspace = Rally.util.Ref.getOidFromRef(Rally.environment.getContext().context.scope.workspace._ref);
            var project = Rally.util.Ref.getOidFromRef(Rally.environment.getContext().context.scope.project._ref);
            var analyticsScheduleStateQuery = "find={ScheduleState:'" + state + "'}&fields=['ScheduleState']&pagesize=1";
            Ext.Ajax.request({
                url:"https://rally1.rallydev.com/analytics/1.27/" + workspace + "/artifact/snapshot/query.js?" + analyticsScheduleStateQuery,
                method:"GET",
                success:function (response) {
                    var results = JSON.parse(response.responseText).Results;
                    if (results.length > 0) {
                        this['scheduleStateOid' + state] = results[0].ScheduleState;
                    }
                    this.markUpdated(reqName, this._afterAllScheduleStateOidsReturned, this);
                },
                scope:this
            });
        },

        _afterQueryReturned:function (queryResultsData) {
            if (queryResultsData.TotalResultCount > 0) {
                this._buildChartConfigAndCallback(queryResultsData);
            } else {
                this.buildFinishedCallback(false);
            }
        },

        _buildChartConfigAndCallback: function(queryResultsData) {
            var lumenize = require('./lumenize');
                var contextWorkspaceConfig = Rally.environment.getContext().context.scope.workspace.WorkspaceConfiguration;
                var workspaceConfiguration = {
                    // Need to grab from Rally for this user
                    DateFormat:contextWorkspaceConfig.DateFormat,
                    DateTimeFormat:contextWorkspaceConfig.DateTimeFormat,
                    //TODO: Have context code fetch these values for the workspace config, instead of hardcoding them
                    IterationEstimateUnitName:'Points',
                    // !TODO: Should we use this?
                    ReleaseEstimateUnitName:'Points',
                    TaskUnitName:'Hours',
                    TimeTrackerEnabled:true,
                    TimeZone:'America/Denver',
                    WorkDays:'Sunday,Monday,Tuesday,Wednesday,Thursday,Friday'
                    // They work on Sundays
                };
                
                var acceptedStates = [];
                if( this.scheduleStateOidAccepted ){
                    acceptedStates.push( this.scheduleStateOidAccepted );
                }
                if( this.scheduleStateOidReleased ){
                    acceptedStates.push( this.scheduleStateOidReleased );
                }

                var burnConfig = {
                    workspaceConfiguration:workspaceConfiguration,
                    upSeriesType:'Story Count',
                    // 'Points' or 'Story Count'
                    series:[
                        'up',
                        'scope'
                    ],

                    acceptedStates:acceptedStates,
                    start:this.startTime,
                    end:this.endTime,
                    // Calculated either by inspecting results or via configuration. pastEnd is automatically the last date in results
                    holidays:[
                        {
                            month:12,
                            day:25
                        },
                        {
                            year:2011,
                            month:11,
                            day:26
                        },
                        {
                            year:2011,
                            month:1,
                            day:5
                        }
                    ]
                };

                lumenize.ChartTime.setTZPath("");
                var tscResults = burnCalculator(queryResultsData.Results, burnConfig);

                var categories = tscResults.categories;
                var series = tscResults.series;
                var chartConfiguration = {
                    chart:{
                        defaultSeriesType:'area',
                        zoomType: 'xy'
                    },
                    credits:{
                        enabled:false
                    },
                    title:{
                        text:this.chartTitle
                    },
                    subtitle:{
                        text:''
                    },
                    xAxis:{
                        categories:categories,
                        tickmarkPlacement:'on',
                        tickInterval:Math.floor(categories.length / 13) + 1,
                        // set as a function of the length of categories
                        title:{
                            enabled:false
                        }
                    },
                    yAxis:[
                        {
                            title:{
                                text:'Hours'
                            },
                            labels:{
                                formatter:function () {
                                    return this.value / 1;
                                }
                            },
                            min:0
                        },
                        {
                            title:{
                                text:burnConfig.upSeriesType
                            },
                            opposite:true,
                            labels:{
                                formatter:function () {
                                    return this.value / 1;
                                }
                            },
                            min:0
                        }
                    ],
                    tooltip:{
                        formatter:function () {
                            return '' + this.x + '<br />' + this.series.name + ': ' + this.y;
                        }
                    },
                    plotOptions:{
                        column:{
                            stacking:null,
                            lineColor:'#666666',
                            lineWidth:1,
                            marker:{
                                lineWidth:1,
                                lineColor:'#666666'
                            }
                        }
                    },
                    series:series
                };

                this.buildFinishedCallback(true, chartConfiguration);
        }
    });
})();