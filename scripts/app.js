// scripts/app.js
class NFTMintDApp {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contract = null;
        this.userAddress = null;

        // 合约信息 - 替换为你的实际合约地址和ABI
        this.contractAddress = "0x6B2069D4417A7e3b4F7Ba2651669313333504a9D";
        this.contractABI = [/* 你的合约ABI - 需要从编译结果中获取 */];

        this.init();
    }

    async init() {
        // 绑定事件监听器
        this.bindEvents();

        // 检查是否已经连接了钱包
        if (await this.isWalletConnected()) {
            await this.connectWallet();
        }
    }

    bindEvents() {
        // 连接钱包按钮
        document.getElementById('connectWalletBtn').addEventListener('click', () => {
            this.connectWallet();
        });

        // 铸造按钮
        document.getElementById('mintBtn').addEventListener('click', () => {
            this.mintNFT();
        });

        // 监听账户变化
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length > 0) {
                    this.handleAccountsChanged(accounts);
                } else {
                    this.handleDisconnect();
                }
            });

            // 监听网络变化
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
                this.showMessage('请安装MetaMask以使用此DApp', 'error');
                return;
            }

            // 请求账户访问
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            this.userAddress = accounts[0];
            await this.initializeEthers();
            await this.updateUI();
            this.showMessage('钱包连接成功!', 'success');

        } catch (error) {
            console.error('连接钱包失败:', error);
            this.showMessage('连接钱包失败: ' + error.message, 'error');
        }
    }

    async initializeEthers() {
        // 初始化provider和signer
        this.provider = new ethers.BrowserProvider(window.ethereum);
        this.signer = await this.provider.getSigner();

        // 创建合约实例
        this.contract = new ethers.Contract(
            this.contractAddress,
            this.contractABI,
            this.signer
        );

        // 检查网络
        await this.checkNetwork();
    }

    async checkNetwork() {
        const network = await this.provider.getNetwork();
        const sepoliaChainId = 11155111n;

        if (network.chainId !== sepoliaChainId) {
            this.showMessage('请切换到Sepolia测试网络', 'error');
            return false;
        }
        return true;
    }

    async updateUI() {
        // 更新钱包信息
        document.getElementById('connectWalletBtn').classList.add('hidden');
        document.getElementById('walletInfo').classList.remove('hidden');

        const shortAddress = `${this.userAddress.slice(0, 6)}...${this.userAddress.slice(-4)}`;
        document.getElementById('walletAddress').textContent = `地址: ${shortAddress}`;

        // 更新铸造信息
        await this.updateMintInfo();

        // 启用铸造按钮
        document.getElementById('mintBtn').disabled = false;
        document.getElementById('mintBtn').textContent = '铸造冒险者 (0.001 ETH)';

        // 加载用户的NFT
        await this.loadUserNFTs();
    }

    async updateMintInfo() {
        try {
            const totalSupply = await this.contract.totalSupply();
            const maxSupply = await this.contract.MAX_SUPPLY();
            const mintPrice = await this.contract.MINT_PRICE();

            document.getElementById('mintedCount').textContent = totalSupply.toString();
            document.getElementById('totalSupply').textContent = maxSupply.toString();
            document.getElementById('mintPrice').textContent = `${ethers.formatEther(mintPrice)} ETH`;

        } catch (error) {
            console.error('更新铸造信息失败:', error);
        }
    }

    async mintNFT() {
        try {
            const mintPrice = await this.contract.MINT_PRICE();

            // 更新按钮状态
            const mintBtn = document.getElementById('mintBtn');
            mintBtn.disabled = true;
            mintBtn.textContent = '铸造中...';

            this.showMessage('交易已提交，等待确认...', 'pending');

            // 执行铸造
            const tx = await this.contract.mint({
                value: mintPrice
            });

            this.showMessage(`交易已发送: ${tx.hash}`, 'pending');

            // 等待交易确认
            const receipt = await tx.wait();

            this.showMessage('铸造成功! NFT已发送到你的钱包', 'success');

            // 更新UI
            await this.updateMintInfo();
            await this.loadUserNFTs();

            // 重置按钮
            mintBtn.disabled = false;
            mintBtn.textContent = '铸造冒险者 (0.001 ETH)';

        } catch (error) {
            console.error('铸造失败:', error);

            let errorMessage = '铸造失败';
            if (error.message.includes('user rejected')) {
                errorMessage = '用户拒绝了交易';
            } else if (error.message.includes('insufficient funds')) {
                errorMessage = '余额不足';
            } else if (error.message.includes('Max supply reached')) {
                errorMessage = '已达到最大供应量';
            }

            this.showMessage(errorMessage, 'error');

            // 重置按钮
            document.getElementById('mintBtn').disabled = false;
            document.getElementById('mintBtn').textContent = '铸造冒险者 (0.001 ETH)';
        }
    }

    async loadUserNFTs() {
        try {
            // 获取用户拥有的所有NFT tokenId
            const userNFTs = await this.contract.getUserNFTs(this.userAddress);

            const adventurersList = document.getElementById('adventurersList');
            adventurersList.innerHTML = '';

            if (userNFTs.length === 0) {
                adventurersList.innerHTML = '<p>你还没有任何冒险者NFT</p>';
                document.querySelector('.my-adventurers').classList.remove('hidden');
                return;
            }

            // 为每个NFT创建卡片
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

        // 5秒后自动隐藏成功消息
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

// 获取合约ABI的简化版本（实际开发中应该使用完整的ABI）
async function getContractABI() {
    // 这里应该是从编译结果或ABI文件加载完整的ABI
    // 为了示例，我们提供一个简化的ABI结构
    return [
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
        "event AdventurerMinted(uint256 tokenId, address owner, uint8 rarity, string class)"
    ];
}

// 页面加载完成后初始化DApp
window.addEventListener('load', async () => {
    // 在实际项目中，应该从文件或编译结果加载完整的ABI
    window.nftDApp = new NFTMintDApp();
});
