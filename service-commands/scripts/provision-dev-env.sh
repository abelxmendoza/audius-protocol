#!/bin/bash
set -x

export NODE_VERSION="v14.18.1"
export PYTHON_VERSION="3.9"
export NVM_VERSION="v0.35.3"
export DOCKER_COMPOSE_VERSION="1.27.4"

sudo apt update
sudo apt-get -y upgrade
sudo apt install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    software-properties-common \
    build-essential \
    python-is-python2 \
    python3-pip \
    git-secrets \
    jq \
    wget \
    libpq-dev \
    neovim \
    net-tools \
    zsh

sudo apt autoremove

# install a faster grep
sudo curl -L https://sift-tool.org/downloads/sift/sift_0.9.0_linux_amd64.tar.gz --output /tmp/sift.tar.gz
(
    cd /tmp
    tar xf /tmp/sift.tar.gz
    sudo mv sift_*/sift /usr/local/bin/sift
    sudo rm sift*
)

# configure ssh timeouts
echo "ClientAliveInterval 600" | sudo tee -a /etc/ssh/sshd_config.d/60-audius.conf
echo "TCPKeepAlive yes" | sudo tee -a /etc/ssh/sshd_config.d/60-audius.conf
echo "ClientAliveCountMax 10" | sudo tee -a /etc/ssh/sshd_config.d/60-audius.conf
sudo /etc/init.d/ssh restart

# allow VSCode to monitor multiple files on remote machines for changes
cat /proc/sys/fs/inotify/max_user_watches
echo "fs.inotify.max_user_watches=524288" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
cat /proc/sys/fs/inotify/max_user_watches

# install postgres
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
RELEASE=$(lsb_release -cs)
echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/postgresql-pgdg.list > /dev/null
sudo apt-get update
sudo apt -y install postgresql-11
dpkg -l | grep postgresql
sudo systemctl disable postgresql # disable auto-start on boot

# python setup
sudo add-apt-repository ppa:deadsnakes/ppa # python3.9 installation
sudo apt install -y "python$PYTHON_VERSION"
pip install wheel

# docker setup
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository 'deb [arch=amd64] https://download.docker.com/linux/ubuntu focal stable'
sudo apt update
sudo apt install -y docker-ce
sudo usermod -aG docker $USER
sudo curl -L "https://github.com/docker/compose/releases/download/$DOCKER_COMPOSE_VERSION/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
# prevent docker logs from eating all memory
sudo sh -c "cat >/etc/docker/daemon.json" <<EOF
{
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    }
}
EOF

sudo chown $USER /etc/hosts

# install nvm and node
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
nvm install $NODE_VERSION

# profile setup
echo "nvm use $NODE_VERSION" >> ~/.profile
echo 'export PROTOCOL_DIR=$HOME/audius-protocol' >> ~/.profile
echo 'export AUDIUS_REMOTE_DEV_HOST=$(curl -sfL -H "Metadata-Flavor: Google" http://metadata/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip)' >> ~/.profile
source ~/.profile
source ~/.bashrc

# silence welcome banner
touch ~/.hushlogin

# audius repos setup
cd $PROTOCOL_DIR/service-commands
npm install
node scripts/hosts.js add
node scripts/setup.js run init-repos up

cd $PROTOCOL_DIR/libs
npm install
npm link

cd $PROTOCOL_DIR/service-commands
npm link @audius/libs
npm link
npm install  # to get around web3?

cd $PROTOCOL_DIR/libs
npm install
npm install

cd $PROTOCOL_DIR/service-commands
npm link

cd $PROTOCOL_DIR/libs
npm install

cd $PROTOCOL_DIR/service-commands
npm link

cd $PROTOCOL_DIR/service-commands
npm link @audius/libs
npm link
# caused web3 issue

cd $PROTOCOL_DIR/libs
npm install
npm link

cd ~
git clone https://github.com/AudiusProject/audius-client.git
cd audius-client
npm link @audius/libs
npm install

cd $PROTOCOL_DIR/mad-dog
npm install
npm link @audius/service-commands
sudo curl -L https://github.com/alexei-led/pumba/releases/download/0.7.8/pumba_linux_amd64 --output /usr/local/bin/pumba
sudo chmod +x /usr/local/bin/pumba
