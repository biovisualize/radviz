var radvizComponent = function() {
    var config = {
        el: null,
        size: 400,
        margin: 50,
        colorScale: d3.scale.ordinal().range(['skyblue', 'orange', 'lime']),
        colorAccessor: null,
        dimensions: [],
        drawLinks: true,
        zoomFactor: 1,
        dotRadius: 6,
        useRepulsion: false,
        useTooltip: true,
        tooltipFormatter: function(d) {
            return d;
        }
    };

    var events = d3.dispatch('panelEnter', 'panelLeave', 'dotEnter', 'dotLeave');

    var force = d3.layout.force()
        .chargeDistance(0)
        .charge(-60)
        .friction(0.5);

    var render = function(data) {
        data = addNormalizedValues(data);
        var normalizeSuffix = '_normalized';
        var dimensionNamesNormalized = config.dimensions.map(function(d) {
            return d + normalizeSuffix;
        });
        var thetaScale = d3.scale.linear().domain([0, dimensionNamesNormalized.length]).range([0, Math.PI * 2]);

        var chartRadius = config.size / 2 - config.margin;
        var nodeCount = data.length;
        var panelSize = config.size - config.margin * 2;

        var dimensionNodes = config.dimensions.map(function(d, i) {
            var angle = thetaScale(i);
            var x = chartRadius + Math.cos(angle) * chartRadius * config.zoomFactor;
            var y = chartRadius + Math.sin(angle) * chartRadius * config.zoomFactor;
            return {
                index: nodeCount + i,
                x: x,
                y: y,
                fixed: true,
                name: d
            };
        });

        var linksData = [];
        data.forEach(function(d, i) {
            dimensionNamesNormalized.forEach(function(dB, iB) {
                linksData.push({
                    source: i,
                    target: nodeCount + iB,
                    value: d[dB]
                });
            });
        });

        force.size([panelSize, panelSize])
            .linkStrength(function(d) {
                return d.value;
            })
            .nodes(data.concat(dimensionNodes))
            .links(linksData)
            .start();

        // Basic structure
        var svg = d3.select(config.el)
            .append('svg')
            .attr({
                width: config.size,
                height: config.size
            });

        svg.append('rect')
            .classed('bg', true)
            .attr({
                width: config.size,
                height: config.size
            });

        var root = svg.append('g')
            .attr({
                transform: 'translate(' + [config.margin, config.margin] + ')'
            });

        var panel = root.append('circle')
            .classed('panel', true)
            .attr({
                r: chartRadius,
                cx: chartRadius,
                cy: chartRadius
            });

        if(config.useRepulsion) {
            root.on('mouseenter', function(d) {
                force.chargeDistance(80).alpha(0.2);
                events.panelEnter();
            });
            root.on('mouseleave', function(d) {
                force.chargeDistance(0).resume();
                events.panelLeave();
            });
        }

        // Links
        if(config.drawLinks) {
            var links = root.selectAll('.link')
                .data(linksData)
                .enter().append('line')
                .classed('link', true);
        }

        // Nodes
        var nodes = root.selectAll('circle.dot')
            .data(data)
            .enter().append('circle')
            .classed('dot', true)
            .attr({
                r: config.dotRadius,
                fill: function(d) {
                    return config.colorScale(config.colorAccessor(d));
                }
            })
            .on('mouseenter', function(d) {
                if(config.useTooltip) {
                    var mouse = d3.mouse(config.el);
                    tooltip.setText(config.tooltipFormatter(d)).setPosition(mouse[0], mouse[1]).show();
                }
                events.dotEnter(d);
                this.classList.add('active');
            })
            .on('mouseout', function(d) {
                if(config.useTooltip) {
                    tooltip.hide();
                }
                events.dotLeave(d);
                this.classList.remove('active');
            });

        // Labels
        var labelNodes = root.selectAll('circle.label-node')
            .data(dimensionNodes)
            .enter().append('circle')
            .classed('label-node', true)
            .attr({
                cx: function(d) {
                    return d.x;
                },
                cy: function(d) {
                    return d.y;
                },
                r: 4
            });

        var labels = root.selectAll('text.label')
            .data(dimensionNodes)
            .enter().append('text')
            .classed('label', true)
            .attr({
                x: function(d) {
                    return d.x;
                },
                y: function(d) {
                    return d.y;
                },
                'text-anchor': function(d) {
                    if(d.x > (panelSize * 0.4) && d.x < (panelSize * 0.6)) {
                        return 'middle';
                    } else {
                        return(d.x > panelSize / 2) ? 'start' : 'end';
                    }
                },
                'dominant-baseline': function(d) {
                    return(d.y > panelSize * 0.6) ? 'hanging' : 'auto';
                },
                dx: function(d) {
                    return(d.x > panelSize / 2) ? '6px' : '-6px';
                },
                dy: function(d) {
                    return(d.y > panelSize * 0.6) ? '6px' : '-6px';
                }
            })
            .text(function(d) {
                return d.name;
            });

        // Update force
        force.on('tick', function() {
            if(config.drawLinks) {
                links.attr({
                    x1: function(d) {
                        return d.source.x;
                    },
                    y1: function(d) {
                        return d.source.y;
                    },
                    x2: function(d) {
                        return d.target.x;
                    },
                    y2: function(d) {
                        return d.target.y;
                    }
                });
            }

            nodes.attr({
                cx: function(d) {
                    return d.x;
                },
                cy: function(d) {
                    return d.y;
                }
            });
        });

        var tooltipContainer = d3.select(config.el)
            .append('div')
            .attr({
                class: 'radviz-tooltip'
            });
        var tooltip = tooltipComponent(tooltipContainer.node());

        return this;
    };

    var setConfig = function(_config) {
        config = utils.mergeAll(config, _config);
        return this;
    };

    var addNormalizedValues = function(data) {
        data.forEach(function(d) {
            config.dimensions.forEach(function(dimension) {
                d[dimension] = +d[dimension];
            });
        });

        var normalizationScales = {};
        config.dimensions.forEach(function(dimension) {
            normalizationScales[dimension] = d3.scale.linear().domain(d3.extent(data.map(function(d, i) {
                return d[dimension];
            }))).range([0, 1]);
        });

        data.forEach(function(d) {
            config.dimensions.forEach(function(dimension) {
                d[dimension + '_normalized'] = normalizationScales[dimension](d[dimension]);
            });
        });

        return data;
    };

    var exports = {
        config: setConfig,
        render: render
    };

    d3.rebind(exports, events, 'on');

    return exports;
};
