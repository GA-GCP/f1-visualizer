# 🏎️ F1 Visualizer

> *An enterprise-grade, cloud-native Formula 1 telemetry and historical data visualization platform.*

## 📖 Overview
F1 Visualizer is a comprehensive, full-stack monorepo demonstrating an elite, event-driven cloud architecture. Designed to replicate an authentic "Race Engineer" console, the application ingests, processes, and beautifully visualizes both real-time WebSocket telemetry and massive historical BigQuery datasets.

This project was built with a strict adherence to enterprise best practices, including Zero-Trust security, Test-Driven Development (TDD), and highly modular Infrastructure as Code (IaC).

## 🌟 Highlights & Features


* **Live Race Simulator**: Connects to active session data via STOMP WebSockets, rendering a dynamic, low-latency circuit trace using the HTML5 Canvas API.
* **Historical Data Studio**: Query and replay any past Grand Prix session with a persistent media controller and custom D3.js line charts tracking championship narratives.
* **"Versus" Comparison Engine**: A split-screen analytical dashboard utilizing D3.js Radar and overlapping Bar charts to compare driver and team dominance metrics side-by-side.
* **Minimalist Data Console UI**: Achieves an authentic, IP-safe aesthetic utilizing official team hex colors, driver numbers, and high-fidelity typography.

## 🏗️ Architecture & Tech Stack
* **Frontend:** React 19, TypeScript, Vite, D3.js, MaterialUI, Axios
* **Backend:** Java 25, Spring Boot 4.x, Spring Security (OAuth2/JWT), WebSockets (STOMP)
* **Databases:** GCP BigQuery (Data Warehouse), Firestore (User Profiles), Redis (Pub/Sub Broker)
* **Cloud Infrastructure:** GCP Cloud Run, API-Gateway, Secret Manager, Cloud Load Balancing
* **IaC & CI/CD:** OpenTofu, Terragrunt, GCP Cloud Build, GitHub Advanced Security

## 📂 Repository Structure
This project utilizes a unified monorepo approach to ensure atomic, full-stack commits and streamlined CI/CD execution:

* `/frontend` — The Vite/React Single Page Application.
* `/backend` — The Maven multi-module Spring Boot microservices (`f1v-service-telemetry`, `f1v-service-user`, etc.).
* `/infrastructure` — Reusable OpenTofu modules and environment-specific Terragrunt state files.
* `/.github` — Modular, path-filtered Cloud Build YAML pipelines.

## 🚀 Quick Start (Local Development)
To get the development environment running on your local machine:

1. **Clone the repository:** `git clone https://github.com/yourusername/f1-visualizer.git`
2. **Backend Setup:** Navigate to `/backend` and execute `mvn clean install` (requires JDK 25 and Docker for Testcontainers).
3. **Frontend Setup:** Navigate to `/frontend` and execute `yarn install` followed by `yarn dev`.

## 🤝 Contributing
Please read through our `CONTRIBUTING.md` for details on our code of conduct and the process for submitting Pull Requests. We strictly follow the Conventional Commits specification (e.g., `feat:`, `fix:`, `chore:`).

## ⚖️ Disclaimer & License
*F1 Visualizer is an unofficial, open-source personal project and is not associated in any way with the Formula 1 companies. F1, FORMULA ONE, FORMULA 1, FIA FORMULA ONE WORLD CHAMPIONSHIP, GRAND PRIX and related marks are trade marks of Formula One Licensing B.V.*