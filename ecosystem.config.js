module.exports = {
  apps: [
    {
      name: 'crypto-dashboard',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/opt/crypto-trading-dashboard',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'crypto-ws-server',
      script: 'node_modules/.bin/tsx',
      args: 'server/index.ts',
      cwd: '/opt/crypto-trading-dashboard',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
