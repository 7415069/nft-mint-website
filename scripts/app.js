class NFTMintDApp {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.userAddress = null;

        this.contractAddress = "0x6B2069D4417A7e3b4F7Ba2651669313333504a9D";
        this.contractABI = [
            "function name() view returns (string)",
            "function symbol() view returns (string)",
            "function totalSupply() view returns (uint256)",
            "function MAX_SUPPLY() view returns (uint256)",
            "function MINT_PRICE() view returns (uint256)",
            "function mint() payable",
            "function getUserNFTs(address) view returns (uint256[])",
            "function getAdventurerDetails(uint256) view returns (tuple(uint8 level, uint16 strength, uint16 agility, uint16 intelligence, uint8 rarity, string class, string weapon))",
            "function tokenURI(uint256) view returns (string)",
            "function ownerOf(uint256) view returns (address)",
            "function balanceOf(address) view returns (uint256)",
            "event AdventurerMinted(uint256 tokenId, address owner, uint8 rarity, string class)"
        ];

        this.init();
    }

    async init() {
        this.bindEvents();
        if (await this.isWalletConnected()) {
            await this.connectWallet();
        }
    }

    bindEvents() {
        document.getElementById('connectWalletBtn').addEventListener('click', () => {
            this.connectWallet();
        });

        document.getElementById('mintBtn').addEventListener('click', () => {
            this.mintNFT();
        });

        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length > 0) {
                    this.handleAccountsChanged(accounts);
                } else {
                    this.handleDisconnect();
                }
            });

            window.ethereum.on('chainChanged', (chainId) => {
                window.location.reload();
            });
        }
    }

    async isWalletConnected() {
        if (window.ethereum) {
            const accounts = await window.ethereum.request({
                method: 'eth_accounts'
            });
            return accounts.length > 0;
        }
        return false;
    }

    async connectWallet() {
        try {
            if (!window.ethereum) {
                this.showMessage('请安装 MetaMask 钱包扩展程序', 'error');
                return;
            }

            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            this.userAddress = accounts[0];
            await this.initializeEthers();
            await this.updateUI();
            this.showMessage('钱包连接成功!', 'success');

        } catch (error) {
            console.error('连接钱包失败:', error);
            this.showMessage('连接失败: ' + error.message, 'error');
        }
    }

    async initializeEthers() {
        try {
            // 使用 ethers v6 的写法
            this.provider = new ethers.BrowserProvider(window.ethereum);
            this.signer = await this.provider.getSigner();

            // 检查网络
            const network = await this.provider.getNetwork();
            const sepoliaChainId = 11155111n; // v6 中使用 BigInt

            console.log('当前网络:', network);

            if (network.chainId !== sepoliaChainId) {
                this.showMessage('请切换到 Sepolia 测试网络', 'error');
                // 提供切换网络的按钮
                this.addNetworkSwitchButton();
                return false;
            }

            this.contract = new ethers.Contract(
                this.contractAddress,
                this.contractABI,
                this.signer
            );

            console.log('合约实例创建成功');
            return true;
        } catch (error) {
            console.error('初始化 ethers 失败:', error);
            this.showMessage('初始化失败: ' + error.message, 'error');
            return false;
        }
    }

    // 添加网络切换功能
    addNetworkSwitchButton() {
        const switchButton = document.createElement('button');
        switchButton.textContent = '切换到 Sepolia 网络';
        switchButton.className = 'btn-primary';
        switchButton.style.margin = '10px';
        switchButton.onclick = async () => {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0xaa36a7' }], // Sepolia 的 chainId
                });
                location.reload();
            } catch (switchError) {
                // 如果网络不存在，添加网络
                if (switchError.code === 4902) {
                    await this.addSepoliaNetwork();
                }
            }
        };
        document.getElementById('txStatus').appendChild(switchButton);
    }

    async addSepoliaNetwork() {
        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: '0xaa36a7',
                    chainName: 'Sepolia Test Network',
                    nativeCurrency: {
                        name: 'Sepolia Ether',
                        symbol: 'ETH',
                        decimals: 18
                    },
                    rpcUrls: ['https://sepolia.infura.io/v3/'],
                    blockExplorerUrls: ['https://sepolia.etherscan.io']
                }]
            });
        } catch (error) {
            console.error('添加网络失败:', error);
        }
    }

    async updateUI() {
        try {
            document.getElementById('connectWalletBtn').classList.add('hidden');
            document.getElementById('walletInfo').classList.remove('hidden');

            const shortAddress = `${this.userAddress.slice(0, 6)}...${this.userAddress.slice(-4)}`;
            document.getElementById('walletAddress').textContent = `地址: ${shortAddress}`;

            await this.updateMintInfo();

            document.getElementById('mintBtn').disabled = false;
            document.getElementById('mintBtn').textContent = '铸造冒险者 (0.001 ETH)';

            await this.loadUserNFTs();
        } catch (error) {
            console.error('更新UI失败:', error);
        }
    }

    async updateMintInfo() {
        try {
            if (!this.contract) {
                console.error('合约未初始化');
                return;
            }

            const totalSupply = await this.contract.totalSupply();
            const maxSupply = await this.contract.MAX_SUPPLY();
            const mintPrice = await this.contract.MINT_PRICE();

            document.getElementById('mintedCount').textContent = totalSupply.toString();
            document.getElementById('totalSupply').textContent = maxSupply.toString();

            // 使用 v6 的格式转换
            document.getElementById('mintPrice').textContent =
            `${ethers.formatEther(mintPrice)} ETH`;

        } catch (error) {
            console.error('更新铸造信息失败:', error);
        }
    }

    async mintNFT() {
        try {
            if (!this.contract) {
                this.showMessage('合约未初始化', 'error');
                return;
            }

            const mintPrice = await this.contract.MINT_PRICE();

            const mintBtn = document.getElementById('mintBtn');
            mintBtn.disabled = true;
            mintBtn.textContent = '铸造中...';

            this.showMessage('交易已提交，等待确认...', 'pending');

            const tx = await this.contract.mint({
                value: mintPrice
            });

            this.showMessage(`交易已发送: ${tx.hash}`, 'pending');

            const receipt = await tx.wait();

            this.showMessage('铸造成功! NFT已发送到你的钱包', 'success');

            await this.updateMintInfo();
            await this.loadUserNFTs();

            mintBtn.disabled = false;
            mintBtn.textContent = '铸造冒险者 (0.001 ETH)';

        } catch (error) {
            console.error('铸造失败:', error);

            let errorMessage = '铸造失败';
            if (error.message && error.message.includes('user rejected')) {
                errorMessage = '用户拒绝了交易';
            } else if (error.message && error.message.includes('insufficient funds')) {
                errorMessage = '余额不足';
            } else if (error.message && error.message.includes('Max supply reached')) {
                errorMessage = '已达到最大供应量';
            } else if (error.code === 'ACTION_REJECTED') {
                errorMessage = '用户拒绝了交易';
            }

            this.showMessage(errorMessage, 'error');

            document.getElementById('mintBtn').disabled = false;
            document.getElementById('mintBtn').textContent = '铸造冒险者 (0.001 ETH)';
        }
    }

    async loadUserNFTs() {
        try {
            if (!this.contract) {
                console.error('合约未初始化');
                return;
            }

            const userNFTs = await this.contract.getUserNFTs(this.userAddress);

            const adventurersList = document.getElementById('adventurersList');
            adventurersList.innerHTML = '';

            if (userNFTs.length === 0) {
                adventurersList.innerHTML = '<p>你还没有任何冒险者NFT</p>';
                document.querySelector('.my-adventurers').classList.remove('hidden');
                return;
            }

            for (const tokenId of userNFTs) {
                const tokenIdNum = Number(tokenId);
                const stats = await this.contract.getAdventurerDetails(tokenIdNum);
                const tokenURI = await this.contract.tokenURI(tokenIdNum);

                const card = this.createNFTCard(tokenIdNum, stats, tokenURI);
                adventurersList.appendChild(card);
            }

            document.querySelector('.my-adventurers').classList.remove('hidden');

        } catch (error) {
            console.error('加载NFT失败:', error);
        }
    }

    createNFTCard(tokenId, stats, tokenURI) {
        const card = document.createElement('div');
        card.className = 'adventurer-card';

        const rarityClass = this.getRarityClass(Number(stats.rarity));
        const rarityName = this.getRarityName(Number(stats.rarity));

        card.innerHTML = `
        <div class="adventurer-image">
        <span>#${tokenId}</span>
        </div>
        <h4>${stats.class} #${tokenId}</h4>
        <p class="${rarityClass}">${rarityName}</p>
        <div class="attributes">
        <div class="attribute">
        <span>等级:</span>
        <span>${stats.level}</span>
        </div>
        <div class="attribute">
        <span>力量:</span>
        <span>${stats.strength}</span>
        </div>
        <div class="attribute">
        <span>敏捷:</span>
        <span>${stats.agility}</span>
        </div>
        <div class="attribute">
        <span>智力:</span>
        <span>${stats.intelligence}</span>
        </div>
        <div class="attribute">
        <span>武器:</span>
        <span>${stats.weapon}</span>
        </div>
        </div>
        <a href="https://testnets.opensea.io/assets/sepolia/${this.contractAddress}/${tokenId}"
        target="_blank" class="btn-primary" style="margin-top: 10px; display: inline-block;">
        在OpenSea查看
        </a>
        `;

        return card;
    }

    getRarityClass(rarity) {
        const classes = ['rarity-common', 'rarity-rare', 'rarity-epic', 'rarity-legendary'];
        return classes[rarity] || 'rarity-common';
    }

    getRarityName(rarity) {
        const names = ['普通', '稀有', '史诗', '传说'];
        return names[rarity] || '普通';
    }

    showMessage(message, type) {
        const statusEl = document.getElementById('txStatus');
        statusEl.textContent = message;
        statusEl.className = `tx-status ${type}`;
        statusEl.classList.remove('hidden');

        if (type === 'success') {
            setTimeout(() => {
                statusEl.classList.add('hidden');
            }, 5000);
        }
    }

    handleAccountsChanged(accounts) {
        this.userAddress = accounts[0];
        this.updateUI();
    }

    handleDisconnect() {
        document.getElementById('connectWalletBtn').classList.remove('hidden');
        document.getElementById('walletInfo').classList.add('hidden');
        document.getElementById('mintBtn').disabled = true;
        document.getElementById('mintBtn').textContent = '连接钱包后铸造';
        document.querySelector('.my-adventurers').classList.add('hidden');
    }
}

// 调试函数
window.checkMetaMask = function() {
    const debugInfo = document.getElementById('debugInfo');
    if (typeof window.ethereum === 'undefined') {
        debugInfo.innerHTML = '❌ MetaMask 未检测到';
    } else {
        debugInfo.innerHTML = '✅ MetaMask 已检测到';
    }
};

window.checkNetwork = async function() {
    const debugInfo = document.getElementById('debugInfo');
    if (typeof window.ethereum !== 'undefined') {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const network = await provider.getNetwork();
            debugInfo.innerHTML = `当前网络: ${network.name} (ChainID: ${network.chainId})`;
        } catch (error) {
            debugInfo.innerHTML = `网络检查失败: ${error.message}`;
        }
    }
};

// 页面加载完成后初始化DApp
window.addEventListener('load', () => {
    window.nftDApp = new NFTMintDApp();
});
