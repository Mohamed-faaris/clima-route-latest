# Clima_Route Deployment Guide

This README provides a comprehensive overview of the Clima_Route project structure, file explanations, Docker setup, and step-by-step deployment instructions for the AI Model, Front End, and Back End components.

---

## Project Structure Overview

```
Clima_Route/
│
├── Clima_Route.sln                  # Solution file for .NET projects
├── DEPLOYMENT_GUIDE.md              # Additional deployment instructions
├── docker-compose.yml               # Main Docker Compose file
├── docker-compose.dev.yml           # Development Docker Compose file
├── QUICK_LOGIN_REFERENCE.md         # Quick login guide
├── QUICK_START.md                   # Quick start instructions
├── SETUP_GUIDE.md                   # Setup guide
├── USER_CREDENTIALS_AND_SETUP.md    # User credentials and setup info
│
├── _build_test/                     # Build/test artifacts and runtime assets
│   └── ...
│
├── AI_Model/                        # AI model and related files
│   ├── app.py                       # Main entry point for AI model API
│   ├── Dockerfile                   # Dockerfile for AI model service
│   ├── graph_und.py                 # Graph utilities for model
│   ├── main.py                      # Model training/testing script
│   ├── rainfall_model.keras         # Trained Keras model file
│   ├── requirements.txt             # Python dependencies
│   ├── requirements.prod.txt        # Production dependencies
│   ├── Trained_model.py             # Model loading and inference
│   ├── training_log.csv             # Training logs
│   ├── WeatherDataset.csv           # Dataset for training
│   └── env/                         # Python virtual environment
│       └── ...
│
├── aws/                             # AWS deployment resources
│   └── cloudformation.yml           # AWS CloudFormation template
│
├── BACKEND/                         # Backend API and server
│   ├── Dockerfile                   # Dockerfile for backend service
│   ├── package.json                 # Node.js dependencies (if any)
│   ├── README.md                    # Backend-specific documentation
│   └── ClimaRouteAPI/               # .NET Core Web API project
│       ├── appsettings.*.json       # Environment configs
│       ├── ClimaRouteAPI.csproj     # Project file
│       ├── Program.cs               # Main entry point
│       ├── Controllers/             # API controllers
│       ├── Model/                   # Data models
│       └── ...
│
├── climaroute FRONT END/            # Frontend (React + Vite)
│   ├── App.tsx                      # Main React component
│   ├── Dockerfile                   # Dockerfile for frontend service
│   ├── index.html                   # HTML entry point
│   ├── index.tsx                    # React entry point
│   ├── package.json                 # Frontend dependencies
│   ├── tsconfig.json                # TypeScript config
│   ├── vite.config.ts               # Vite config
│   ├── components/                  # React components
│   ├── contexts/                    # React context providers
│   ├── locales/                     # Localization files
│   ├── pages/                       # Page components
│   ├── public/                      # Static assets
│   ├── services/                    # API service utilities
│   └── utils/                       # Utility functions
│
├── scripts/                         # Utility scripts
│   ├── deploy-aws.sh                # AWS deployment script
│   ├── migrate_db.py                # Database migration script
│   └── start-dev.ps1                # PowerShell script for dev startup
```

---

## File & Directory Explanations

### Root Files
- **Clima_Route.sln**: Solution file for managing .NET projects.
- **docker-compose.yml / docker-compose.dev.yml**: Define multi-container Docker applications for production and development.
- **DEPLOYMENT_GUIDE.md, QUICK_START.md, SETUP_GUIDE.md**: Documentation for setup and deployment.

### AI_Model/
- **app.py**: Main Flask/FastAPI app serving the AI model API.
- **main.py**: Used for training/testing the AI model.
- **Trained_model.py**: Loads and runs inference using the trained model.
- **rainfall_model.keras**: Saved Keras model file.
- **requirements.txt / requirements.prod.txt**: Python dependencies for development/production.
- **Dockerfile**: Builds the AI model service image.
- **env/**: Python virtual environment (not used in Docker builds).

### BACKEND/
- **Dockerfile**: Builds the backend API service image.
- **ClimaRouteAPI/**: .NET Core Web API project.
  - **Program.cs**: Main entry point for the API.
  - **Controllers/**: Contains API endpoint logic.
  - **Model/**: Data models for the API.
  - **appsettings.*.json**: Configuration files for different environments.

### climaroute FRONT END/
- **App.tsx, index.tsx, index.html**: Main React/Vite app entry points.
- **Dockerfile**: Builds the frontend service image.
- **components/**: UI components.
- **contexts/**: React context providers for state management.
- **pages/**: Page-level components.
- **services/**: API service utilities.
- **utils/**: Utility functions.

### aws/
- **cloudformation.yml**: Infrastructure as code for AWS deployment.

### scripts/
- **deploy-aws.sh**: Shell script for deploying to AWS.
- **migrate_db.py**: Python script for database migration.
- **start-dev.ps1**: PowerShell script to start development environment.

---

## Docker Setup & File Locations

- **AI_Model/Dockerfile**: Builds the AI model API container. Installs Python dependencies, copies model files, exposes the API port.
- **BACKEND/Dockerfile**: Builds the backend API container. Uses .NET SDK/runtime, copies API files, exposes the API port.
- **climaroute FRONT END/Dockerfile**: Builds the frontend container. Uses Node.js, installs dependencies, builds static files, serves via nginx or similar.
- **docker-compose.yml**: Orchestrates all containers (AI model, backend, frontend) and defines their connections, networks, and environment variables.

---

## How Components Connect

- **Frontend** communicates with **Backend API** via HTTP requests (e.g., REST endpoints).
- **Backend API** may call the **AI Model API** for predictions (e.g., weather, routing).
- **AI Model API** serves predictions via its own HTTP endpoints.
- All services are containerized and networked via Docker Compose.

---

## Deployment Steps (A-Z)

1. **Clone the Repository**
   ```sh
   git clone <repo-url>
   cd Clima_Route
   ```

2. **Build and Run with Docker Compose**
   - Ensure Docker is installed.
   - Run:
     ```sh
     docker compose up --build
     ```
   - This will build and start all services (AI Model, Backend, Frontend).

3. **Accessing Services**
   - **Frontend**: http://localhost:3000 (or configured port)
   - **Backend API**: http://localhost:5000 (or configured port)
   - **AI Model API**: http://localhost:8000 (or configured port)

4. **Environment Configuration**
   - Edit `appsettings.*.json` in `BACKEND/ClimaRouteAPI/` for backend settings.
   - Edit `.env` or config files in `AI_Model/` as needed.
   - Frontend configs are in `climaroute FRONT END/` (e.g., environment variables).

5. **AWS Deployment**
   - Use `aws/cloudformation.yml` and `scripts/deploy-aws.sh` for cloud deployment.
   - Follow instructions in `DEPLOYMENT_GUIDE.md` for details.

---

## Main Entry Points
- **AI Model**: `AI_Model/app.py` (API server)
- **Backend**: `BACKEND/ClimaRouteAPI/Program.cs` (API server)
- **Frontend**: `climaroute FRONT END/index.tsx` and `App.tsx` (React app)

---

## Additional Notes
- **Database**: Migration handled by `scripts/migrate_db.py`.
- **Credentials**: See `USER_CREDENTIALS_AND_SETUP.md` for setup.
- **Logs**: Training logs in `AI_Model/training_log.csv`.
- **Static Assets**: Frontend static files in `climaroute FRONT END/public/`.

---

## Troubleshooting
- Check container logs with `docker compose logs`.
- Ensure ports are not blocked or in use.
- For development, use `docker-compose.dev.yml`.

---

## Contact & Documentation
- See individual `README.md` files in each major folder for more details.
- For quick setup, refer to `QUICK_START.md` and `SETUP_GUIDE.md`.

---

This README covers all necessary information for deploying, running, and understanding the Clima_Route project from A-Z. For further details, consult the provided documentation files.

Program Types and Connections
AI_Model/
app.py: Python Flask or FastAPI web server. Exposes REST API endpoints for AI predictions. Loads the trained model and handles HTTP requests from the backend.
main.py: Python script for training and evaluating the AI model. Handles data loading, model training, and saving the trained model to rainfall_model.keras.
Trained_model.py: Loads the saved Keras model and runs inference. Used by app.py for predictions.
graph_und.py: Contains graph algorithms/utilities, likely for route calculations or network analysis.
rainfall_model.keras: Trained Keras model file.
requirements.txt / requirements.prod.txt: Python package lists for development/production.
Dockerfile: Builds the AI model API container. Installs Python, copies code, installs dependencies, exposes port 8000, runs app.py.
BACKEND/
Dockerfile: Builds the backend API container. Uses .NET SDK to build and publish the API, then runs it with the .NET runtime. Exposes port 5000.
ClimaRouteAPI/: .NET Core Web API project.
Program.cs: C# main entry point, configures and starts the web server.
Controllers/: C# classes defining REST API endpoints (weather, routing, user management).
Model/: C# data models for API and controllers.
appsettings.*.json: JSON config files for different environments.
climaroute FRONT END/
App.tsx, index.tsx, index.html: TypeScript/React files. index.tsx renders the app, App.tsx is the root component, index.html is the HTML template.
Dockerfile: Builds and serves the frontend app. Installs Node.js dependencies, builds static files, serves with nginx, exposes port 3000.
components/: React UI elements.
contexts/: React Context API for global state (auth, notifications).
pages/: React components for different routes/pages.
services/: TypeScript files for API calls (e.g., apiservice.ts).
utils/: Utility functions (translation, voice alerts).
How Components Connect
Frontend (React app) communicates with Backend API (.NET Core) via HTTP REST endpoints for user actions, data retrieval, and updates.
Backend API processes requests, manages data, and calls the AI Model API (Python Flask/FastAPI) for predictions (weather, routing) via HTTP requests.
AI Model API receives requests from the backend, loads the trained model, and returns predictions/results.
All services are containerized and networked via Docker Compose, which defines how containers communicate and share environment variables.
Dockerfile Code Summary
AI_Model/Dockerfile: Uses python:3.x, sets working directory, copies code, installs dependencies, exposes port 8000, runs app.py.
BACKEND/Dockerfile: Uses .NET SDK for build, .NET ASP.NET runtime for execution, exposes port 5000, runs ClimaRouteAPI.dll.
climaroute FRONT END/Dockerfile: Uses Node.js for build, nginx for serving, exposes port 3000, serves static files.
