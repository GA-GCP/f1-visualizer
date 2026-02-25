import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type {DriverProfile} from '@/data/mockDrivers.ts';

interface RadarChartProps {
    driverA: DriverProfile;
    driverB: DriverProfile;
}

const RadarChart: React.FC<RadarChartProps> = ({ driverA, driverB }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current) return;

        // Clear previous
        d3.select(svgRef.current).selectAll("*").remove();

        const width = 500;
        const height = 500;
        const radius = Math.min(width, height) / 2 - 60;
        const levels = 5;

        const features = ['speed', 'consistency', 'aggression', 'tireMgmt', 'experience'] as const;
        const angleSlice = (Math.PI * 2) / features.length;

        const svg = d3.select(svgRef.current)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .append("g")
            .attr("transform", `translate(${width / 2},${height / 2})`);

        // 1. Draw Grid (Web)
        const rScale = d3.scaleLinear().range([0, radius]).domain([0, 100]);

        for (let j = 0; j < levels; j++) {
            const levelFactor = radius * ((j + 1) / levels);
            svg.selectAll(".levels")
                .data(features)
                .enter()
                .append("line")
                // FIX: Replaced unused 'd' with '_'
                .attr("x1", (_, i) => levelFactor * (1 - 1 * Math.sin(i * angleSlice)))
                .attr("y1", (_, i) => levelFactor * (1 - 1 * Math.cos(i * angleSlice)))
                .attr("x2", (_, i) => levelFactor * (1 - 1 * Math.sin((i + 1) * angleSlice)))
                .attr("y2", (_, i) => levelFactor * (1 - 1 * Math.cos((i + 1) * angleSlice)))
                .style("stroke", "#333")
                .style("stroke-width", "1px");
        }

        // 2. Draw Axes & Labels
        const axis = svg.selectAll(".axis")
            .data(features)
            .enter()
            .append("g")
            .attr("class", "axis");

        axis.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            // FIX: Replaced unused 'd' with '_'
            .attr("x2", (_, i) => rScale(100) * Math.cos(angleSlice * i - Math.PI / 2))
            .attr("y2", (_, i) => rScale(100) * Math.sin(angleSlice * i - Math.PI / 2))
            .attr("class", "line")
            .style("stroke", "#444")
            .style("stroke-width", "2px");

        axis.append("text")
            .attr("class", "legend")
            .style("font-size", "12px")
            .style("fill", "#888")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            // FIX: Replaced unused 'd' with '_'
            .attr("x", (_, i) => rScale(115) * Math.cos(angleSlice * i - Math.PI / 2))
            .attr("y", (_, i) => rScale(115) * Math.sin(angleSlice * i - Math.PI / 2))
            .text(d => d.toUpperCase());

        // 3. Draw Data Blobs
        const drawDriver = (driver: DriverProfile) => {
            const coordinates = features.map((feature, i) => {
                const value = driver.stats[feature];
                const x = rScale(value) * Math.cos(angleSlice * i - Math.PI / 2);
                const y = rScale(value) * Math.sin(angleSlice * i - Math.PI / 2);
                return { x, y };
            });

            // Close the loop
            coordinates.push(coordinates[0]);

            const line = d3.line<{x:number, y:number}>()
                .x(d => d.x)
                .y(d => d.y);

            svg.append("path")
                .datum(coordinates)
                .attr("d", line)
                .style("stroke-width", 3)
                .style("stroke", driver.teamColor)
                .style("fill", driver.teamColor)
                .style("fill-opacity", 0.3);
        };

        drawDriver(driverA);
        drawDriver(driverB);

    }, [driverA, driverB]);

    return <svg ref={svgRef} style={{ width: '100%', height: 'auto', maxHeight: '500px' }} />;
};

export default RadarChart;