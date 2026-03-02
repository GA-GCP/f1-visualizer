import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Box, Paper, Typography } from '@mui/material';
import type { LapDataRecord } from '../types/telemetry';

interface LapTimeChartProps {
    data: LapDataRecord[];
    title?: string;
    driverColorMap?: Record<number, string>;
}

const FALLBACK_COLORS = ['#e10600', '#00D2BE', '#0600EF', '#FF8700', '#006F62', '#2B4562', '#B6BABD', '#C92D4B', '#5E8FAA', '#27F4D2'];
const ASPECT_RATIO = 2; // width:height = 2:1

const LapTimeChart: React.FC<LapTimeChartProps> = ({ data, title, driverColorMap }) => {
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

        const width = containerWidth;
        const height = Math.round(width / ASPECT_RATIO);
        const margin = { top: 20, right: 120, bottom: 50, left: 60 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        if (innerWidth <= 0 || innerHeight <= 0) return;

        const svg = d3.select(svgRef.current)
            .attr("width", width)
            .attr("height", height)
            .style("background", "#1e1e1e")
            .style("overflow", "visible")
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Group data by driver
        const grouped = d3.group(data.filter(d => d.lapDuration), d => d.driverNumber);
        const driverNumbers = Array.from(grouped.keys());

        // Assign colors per driver
        const getColor = (driverNum: number, idx: number): string => {
            if (driverColorMap?.[driverNum]) return `#${driverColorMap[driverNum]}`;
            return FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
        };

        // Scales
        const x = d3.scaleLinear()
            .domain(d3.extent(data, d => d.lapNumber) as [number, number])
            .range([0, innerWidth]);

        const validDurations = data.filter(d => d.lapDuration).map(d => d.lapDuration!);
        const y = d3.scaleLinear()
            .domain([d3.min(validDurations)! - 2, d3.max(validDurations)! + 2])
            .range([innerHeight, 0]);

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
            const color = getColor(driverNum, idx);

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
            g.append("rect").attr("width", 12).attr("height", 12).attr("fill", getColor(driverNum, idx));
            g.append("text").attr("x", 16).attr("y", 10).text(`#${driverNum}`).attr("fill", "#ccc").attr("font-size", "11px");
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
            .on("mouseenter", (event: MouseEvent, d: LapDataRecord) => {
                const driverIdx = driverNumbers.indexOf(d.driverNumber);
                const color = getColor(d.driverNumber, driverIdx);
                tooltip
                    .style("opacity", 1)
                    .html(`<strong style="color:${color}">#${d.driverNumber}</strong> Lap ${d.lapNumber}<br/>${d.lapDuration!.toFixed(3)}s`);
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

    }, [data, driverColorMap, containerWidth]);

    return (
        <Paper sx={{ p: 3, bgcolor: '#1e1e1e', color: 'white' }}>
            <Typography variant="h6" color="primary" gutterBottom>
                {title ?? 'LAP TIME PROGRESSION'}
            </Typography>
            <Box ref={containerRef} sx={{ width: '100%', position: 'relative' }}>
                <svg ref={svgRef} />
            </Box>
        </Paper>
    );
};

export default LapTimeChart;