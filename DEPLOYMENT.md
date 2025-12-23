# Production deployment (VM)

Target: run on your VM as user `deploy`, repo in `/home/niv/status`, served at `https://index.nivmizz7.fr`, managed by PM2, auto-updated on `prod` branch pushes.

## 1) VM prerequisites (run as root once)

Install Node.js 18+ and PM2 globally (example using NodeSource):

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

Create the deploy user if needed:

```bash
sudo adduser deploy
```

## 2) Clone the repo (as deploy)

```bash
su - deploy
git clone <YOUR_REPO_URL> /home/niv/status
cd /home/niv/status
git checkout prod
npm ci
pm2 start ecosystem.config.js --only tarkovtracker-status
pm2 save
```

Enable PM2 to start on boot:

```bash
pm2 startup systemd -u deploy --hp /home/deploy
```

Then run the command it prints.

## 3) Reverse proxy (example with Nginx)

```nginx
server {
  server_name index.nivmizz7.fr;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Reload Nginx after adding the site and HTTPS certificate.

## 4) GitHub Actions deploy (prod branch)

Add these repository secrets:

- `DEPLOY_HOST`: VM hostname or IP
- `DEPLOY_USER`: `deploy`
- `DEPLOY_SSH_KEY`: private key that matches the VM authorized key
- `DEPLOY_PORT`: optional (default 22)

On the VM, add the public key to `/home/deploy/.ssh/authorized_keys`.

On every push to `prod`, the workflow pulls the repo, runs `npm ci`, and reloads PM2.

## 5) Manual update (fallback)

```bash
cd /home/niv/status
git pull --ff-only origin prod
npm ci
pm2 startOrReload ecosystem.config.js --only tarkovtracker-status
pm2 save
```
