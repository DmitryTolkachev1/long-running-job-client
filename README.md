# LongRunninJobClient

This application is a SPA with integration of [long-running-jobs-simulation](https://github.com/DmitryTolkachev1/long-running-job-simulation)

## Built with
- [Angular](https://angular.dev/)
- [Angular CLI](https://github.com/angular/angular-cli)
- [Bootstrap](https://getbootstrap.com/)

## Getting started

### Prerequisites

- [Angular 21.1.3](https://angular.dev/)  
- [Git](https://git-scm.com/)  
- IDE: [VS Code](https://code.visualstudio.com/) + [Angular CLI](https://github.com/angular/angular-cli)

### Installation

1. **Clone** the repository:  
   ```bash
   git clone https://github.com/DmitryTolkachev1/long-running-job-client.git
   cd long-running-job-client
2. **Checkout** the `master` branch:
   ```bash
   git switch master
3. **Install** dependencies:
    ```bash
    npm install
4. **Configure** your environment: [environment.ts](src\environments\environment.ts)
5. **Run** the application:
    ```bash
    npm run start


### Local run using Docker/Podman

1. **Build image**:
    - For Docker:
    ```bash
    cd long-running-job-client
    docker build -t job-client:latest .
    ```
    - For Podman:
    ```bash
    cd long-running-job-client
    podman build -t job-client:latest .
2. **Start** a container:
    - For Docker:
    ```bash
    docker run -p 9000:80 job-client:latest
    ```
    - For Podman:
    ```bash
    podman run -p 9000:80 job-client:latest
3. **Visit** http://localhost:9000


## Contributing

1. **Branch off**:
   - Features: git checkout -b feature/<branch-name>
   - Bugs: git checkout -b bug/<branch-name>
   - Tests: git checkout -b test/<branch-name>
3. **Implement & commit** your changes. Commit prefixes: [`feat:`, `fix:`, `test:`]
4. **Cover** new logic with unit tests.
5. **Push** to your branch.
6. **Open** a Pull Request, filling out the template.
7. **Request** a code review.
8. **Squash-merge** once approved.
