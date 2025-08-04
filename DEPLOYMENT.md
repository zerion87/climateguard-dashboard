# Deployment Guide

This document explains how to deploy the NuernbergKlima application to test and production environments.

## Environments

### Test Environment
- **Branch**: `test`
- **Ports**: 8061 (HTTP), 9444 (HTTPS)
- **Deployment**: Automatic on push to `test` branch
- **Access**: http://your-server-ip:8061

### Production Environment
- **Branch**: `main`
- **Ports**: 8060 (HTTP), 9443 (HTTPS)
- **Deployment**: Manual trigger from GitHub Actions
- **Access**: http://your-server-ip:8060

## Deployment Process

### Setting Up the Environments

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd climateguard-dashboard
   ```

2. **Create and switch to test branch**
   ```bash
   git checkout -b test
   git push -u origin test
   ```

### Deploying to Test Environment

1. Make your changes in the `test` branch
2. Push changes to trigger automatic deployment:
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin test
   ```
3. The test environment will be automatically deployed
4. Test your changes at `http://your-server-ip:8061`

### Promoting to Production

1. After testing, create a Pull Request from `test` to `main`
2. Have the PR reviewed and approved
3. Merge the PR into `main`
4. Go to GitHub Actions and manually trigger the "Production Deployment" workflow
5. The production environment will be updated
6. Verify at `http://your-server-ip:8060`

## Local Development

### Test Environment
```bash
docker compose -f docker-compose.test.yml up -d --build
# Access at http://localhost:8061
```

### Production Environment (local testing)
```bash
docker compose -f docker-compose.prod.yml up -d --build
# Access at http://localhost:8060
```

## Troubleshooting

- If a deployment fails, check the GitHub Actions logs
- To force a rebuild, include `--build` in the docker compose commands
- Make sure the required ports are open on your server
