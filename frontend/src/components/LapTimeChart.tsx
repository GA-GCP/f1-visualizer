import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Box, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import type { LapDataRecord } from '../types/telemetry';
import {
    getDriverColor,
    computeInnerDimensions,
    createLapChartScales,
    groupByDriver,
    LAP_CHART_MARGIN,
} from '../utils/chartScales';

interface LapTimeChartProps {
    data: LapDataRecord[];
    title?: string;
    driverColorMap?: Record<number, string>;
    driverLabelMap?: Record<number, string>;
}

const LapTimeChart: React.FC<LapTimeChartProps> = ({ data, title, driverColorMap, driverLabelMap }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(800);

    // Observe container resize
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver((entries) => {
            const { width } = entries[0].contentRect;
            if (width > 0) setContainerWidth(width);
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!data || data.length === 0 || !svgRef.current) return;

        // Clear previous render
        d3.select(svgRef.current).selectAll("*").remove();

        const { width, height, innerWidth, innerHeight } = computeInnerDimensions(containerWidth);

        if (innerWidth <= 0 || innerHeight <= 0) return;

        const svg = d3.select(svgRef.current)
            .attr("width", width)
            .attr("height", height)
            .style("background", "#1e1e1e")
            .style("overflow", "visible")
            .append("g")
            .attr("transform", `translate(${LAP_CHART_MARGIN.left},${LAP_CHART_MARGIN.top})`);

        // Group data by driver
        const grouped = groupByDriver(data);
        const driverNumbers = Array.from(grouped.keys());

        // Scales
        const validDurations = data.filter(d => d.lapDuration != null && d.lapDuration > 0).map(d => d.lapDuration!);
        if (validDurations.length === 0) return;

        const { xScale: x, yScale: y } = createLapChartScales(data, innerWidth, innerHeight);

        // Axes (adaptive tick count based on available width)
        svg.append("g")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(x).ticks(Math.max(3, Math.floor(innerWidth / 80))))
            .attr("color", "#888");

        svg.append("g")
            .call(d3.axisLeft(y))
            .attr("color", "#888");

        // Axis labels
        svg.append("text")
            .attr("x", innerWidth / 2)
            .attr("y", innerHeight + 40)
            .attr("text-anchor", "middle")
            .attr("fill", "#666")
            .attr("font-size", "12px")
            .text("LAP NUMBER");

        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -innerHeight / 2)
            .attr("y", -45)
            .attr("text-anchor", "middle")
            .attr("fill", "#666")
            .attr("font-size", "12px")
            .text("LAP DURATION (s)");

        // Line Generator
        const line = d3.line<LapDataRecord>()
            .x(d => x(d.lapNumber))
            .y(d => y(d.lapDuration!))
            .curve(d3.curveMonotoneX);

        // Draw a line per driver
        driverNumbers.forEach((driverNum, idx) => {
            const driverLaps = grouped.get(driverNum)!;
            const color = getDriverColor(driverNum, idx, driverColorMap);

            svg.append("path")
                .datum(driverLaps)
                .attr("fill", "none")
                .attr("stroke", color)
                .attr("stroke-width", 2)
                .attr("d", line);
        });

        // Legend
        const legend = svg.append("g")
            .attr("transform", `translate(${innerWidth + 10}, 0)`);

        driverNumbers.forEach((driverNum, idx) => {
            const g = legend.append("g")
                .attr("transform", `translate(0, ${idx * 18})`);
            const label = driverLabelMap?.[driverNum] ?? `#${driverNum}`;
            g.append("rect").attr("width", 12).attr("height", 12).attr("fill", getDriverColor(driverNum, idx, driverColorMap));
            g.append("text").attr("x", 16).attr("y", 10).text(label).attr("fill", "#ccc").attr("font-size", "11px");
        });

        // Tooltip
        const tooltip = d3.select(containerRef.current)
            .append("div")
            .style("position", "absolute")
            .style("pointer-events", "none")
            .style("background", "rgba(0,0,0,0.85)")
            .style("color", "#fff")
            .style("padding", "6px 10px")
            .style("border-radius", "4px")
            .style("font-size", "12px")
            .style("border", "1px solid rgba(255,255,255,0.2)")
            .style("opacity", 0);

        // Invisible hover circles for each data point
        const allPoints = data.filter(d => d.lapDuration);
        svg.selectAll(".hover-dot")
            .data(allPoints)
            .enter()
            .append("circle")
            .attr("cx", d => x(d.lapNumber))
            .attr("cy", d => y(d.lapDuration!))
            .attr("r", 6)
            .attr("fill", "transparent")
            .attr("cursor", "crosshair")
            .on("mouseenter", (_event: MouseEvent, d: LapDataRecord) => {
                const driverIdx = driverNumbers.indexOf(d.driverNumber);
                const color = getDriverColor(d.driverNumber, driverIdx, driverColorMap);
                const driverLabel = driverLabelMap?.[d.driverNumber] ?? `#${d.driverNumber}`;
                tooltip
                    .style("opacity", 1)
                    .html(`<strong style="color:${color}">${driverLabel}</strong> Lap ${d.lapNumber}<br/>${d.lapDuration!.toFixed(3)}s`);
            })
            .on("mousemove", (event: MouseEvent) => {
                const [mx, my] = d3.pointer(event, containerRef.current);
                tooltip.style("left", `${mx + 12}px`).style("top", `${my - 10}px`);
            })
            .on("mouseleave", () => {
                tooltip.style("opacity", 0);
            });

        // Cleanup tooltip on unmount/redraw
        return () => { tooltip.remove(); };

    }, [data, driverColorMap, driverLabelMap, containerWidth]);

    const headingId = 'lap-time-chart-title';

    return (
        <Paper sx={{ p: 3, bgcolor: '#1e1e1e', color: 'white' }}>
            <Typography id={headingId} variant="h6" component="h2" color="primary" gutterBottom>
                {title ?? 'LAP TIME PROGRESSION'}
            </Typography>
            <Box ref={containerRef} sx={{ width: '100%', position: 'relative' }}>
                {/* The chart is mouse-only and carried no name, so it was
                    invisible to assistive technology. */}
                <svg ref={svgRef} role="img" aria-labelledby={headingId} />
            </Box>

            {/* The same data as a table, so the chart is not the only way to
                read it. Collapsed by default; still reachable by keyboard and
                announced by a screen reader. */}
            {data.length > 0 && (
                <Box component="details" sx={{ mt: 2 }}>
                    <Box component="summary" sx={{ cursor: 'pointer', color: 'text.secondary', fontSize: '0.75rem' }}>
                        View lap times as a table
                    </Box>
                    <TableContainer sx={{ maxHeight: 320, mt: 1 }}>
                        <Table size="small" stickyHeader aria-labelledby={headingId}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Driver</TableCell>
                                    <TableCell align="right">Lap</TableCell>
                                    <TableCell align="right">Time (s)</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {data.filter(lap => typeof lap.lapDuration === 'number').map(lap => (
                                    <TableRow key={`${lap.driverNumber}-${lap.lapNumber}`}>
                                        <TableCell>{driverLabelMap?.[lap.driverNumber] ?? lap.driverNumber}</TableCell>
                                        <TableCell align="right">{lap.lapNumber}</TableCell>
                                        <TableCell align="right">{lap.lapDuration!.toFixed(3)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            )}
        </Paper>
    );
};

export default LapTimeChart;
