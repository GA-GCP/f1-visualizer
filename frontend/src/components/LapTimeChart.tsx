import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Box, Paper, Typography } from '@mui/material';
import type { LapDataRecord } from '../types/telemetry';

interface LapTimeChartProps {
    data: LapDataRecord[];
}

const LapTimeChart: React.FC<LapTimeChartProps> = ({ data }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!data || data.length === 0 || !svgRef.current) return;

        // Clear previous render
        d3.select(svgRef.current).selectAll("*").remove();

        // Dimensions
        const width = 800;
        const height = 400;
        const margin = { top: 20, right: 30, bottom: 40, left: 50 };

        const svg = d3.select(svgRef.current)
            .attr("width", width)
            .attr("height", height)
            .style("background", "#1e1e1e")
            .style("overflow", "visible")
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Scales
        const x = d3.scaleLinear()
            .domain(d3.extent(data, d => d.lapNumber) as [number, number])
            .range([0, width - margin.left - margin.right]);

        const y = d3.scaleLinear()
            .domain([
                d3.min(data, d => d.lapDuration!)! - 2,
                d3.max(data, d => d.lapDuration!)! + 2
            ])
            .range([height - margin.top - margin.bottom, 0]);

        // Axes
        svg.append("g")
            .attr("transform", `translate(0,${height - margin.top - margin.bottom})`)
            .call(d3.axisBottom(x).ticks(10))
            .attr("color", "#888");

        svg.append("g")
            .call(d3.axisLeft(y))
            .attr("color", "#888");

        // Line Generator
        const line = d3.line<LapDataRecord>()
            .x(d => x(d.lapNumber))
            .y(d => y(d.lapDuration!))
            .curve(d3.curveMonotoneX); // Smooth curves

        // Draw Line
        svg.append("path")
            .datum(data.filter(d => d.lapDuration)) // Filter out nulls
            .attr("fill", "none")
            .attr("stroke", "#e10600")
            .attr("stroke-width", 2.5)
            .attr("d", line);

        // Add Points
        svg.selectAll("circle")
            .data(data.filter(d => d.lapDuration))
            .enter()
            .append("circle")
            .attr("cx", d => x(d.lapNumber))
            .attr("cy", d => y(d.lapDuration!))
            .attr("r", 4)
            .attr("fill", "#e10600")
            .attr("stroke", "#121212")
            .attr("stroke-width", 2);

    }, [data]);

    return (
        <Paper sx={{ p: 3, bgcolor: '#1e1e1e', color: 'white' }}>
            <Typography variant="h6" color="primary" gutterBottom>
                LAP TIME PROGRESSION (SESSION 9165)
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <svg ref={svgRef} />
            </Box>
        </Paper>
    );
};

export default LapTimeChart;