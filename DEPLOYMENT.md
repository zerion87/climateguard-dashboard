# Deployment Guide

This document explains how to deploy the NuernbergKlima application to test and production environments.

## Environments

### Test Environment
- **Branches**: Any branch matching `test-*` or `feature/*`
- **Ports**: 8061 (HTTP), 9444 (HTTPS)
- **Deployment**: Automatic on push to matching branches
- **Access**: http://your-server-ip:8061

### Production Environment
- **Branch**: `main`
- **Ports**: 8060 (HTTP), 9443 (HTTPS)
- **Deployment**: Manual trigger from GitHub Actions
- **Access**: http://your-server-ip:8060

## Deployment Process

### Setting Up a New Feature/Test

1. **Clone the repository** (if you haven't already)
   ```bash
   git clone <repository-url>
   cd climateguard-dashboard
   ```

2. **Create a new feature/test branch**
   ```bash
   # For a test branch
   git checkout -b test-my-feature
   
   # Or for a feature branch
   git checkout -b feature/my-new-feature
   ```

### Deploying to Test Environment

1. Make your changes in your feature/test branch
2. Push changes to trigger automatic deployment:
   ```bash
   git add .
   git commit -m "Description of changes"
   git push -u origin your-branch-name
   ```
3. The test environment will be automatically deployed
4. Test your changes at `http://your-server-ip:8061`

### Manual Test Deployment

You can also manually deploy any branch:
1. Go to GitHub Actions > Test Deployment
2. Click "Run workflow"
3. Optionally specify a branch name
4. Click "Run workflow"

### Promoting to Production

1. After testing, create a Pull Request to `main`
2. Have the PR reviewed and approved
3. Merge the PR into `main`
4. Go to GitHub Actions > Production Deployment
5. Click "Run workflow" to deploy to production
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

- Check the GitHub Actions logs for deployment issues
- To force a rebuild, include `--build` in the docker compose commands
- Make sure the required ports are open on your server
- If you encounter file path issues, verify the Dockerfile's COPY command

## Best Practices

- Always test changes in a feature branch before merging to main
- Use descriptive branch names (e.g., `test-fix-login` or `feature/user-profile`)
- Keep your local repository updated with `git pull --rebase`
- Clean up test branches after they've been merged and deployed
