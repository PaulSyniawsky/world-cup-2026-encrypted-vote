# ⚽ FHE World Cup 2026 Voting

A **privacy-preserving decentralized application (dApp)** for making **encrypted predictions** on the winner of the 2026 FIFA World Cup. All user selections are **fully encrypted using FHEVM**, ensuring nobody—including the contract—can see your choices in plaintext.  

---

## 📝 Features

- 🔒 **Encrypted Predictions** – Users submit predictions fully encrypted; only they can decrypt their selections.  
- 🏆 **Tournament Journey** – Track your predicted journey from Round of 16 to the Final.  
- 🌐 **Web3 Wallet Integration** – Connect using Ethereum-compatible wallets via **RainbowKit + Wagmi**.  
- 🎛 **Interactive UI** – Select winners for each match with an intuitive interface.  
- ⏱ **Match Schedule** – See the scheduled match times for each round.  
- 💾 **Persisted Votes** – Once submitted, predictions are stored on-chain encrypted.  

---

## 📌 How it Works

1. Connect your wallet using the **RainbowKit Connect Button**.  
2. Navigate through each round of the World Cup:  
   - Round of 16 → Quarter-Finals → Semi-Finals → Final.  
3. Click on your predicted winner for each match.  
4. After selecting winners for the round, click **Next Round**.  
5. Once you reach the Final, submit your **Champion prediction**.  
6. Your journey is stored **encrypted** on-chain. Only you can decrypt it later.  

---

## 🏗 Tech Stack

- **React + TypeScript** – Frontend framework  
- **Tailwind CSS** – Styling  
- **Framer Motion** – Animations  
- **FHEVM SDK** – Fully Homomorphic Encryption for Ethereum  
- **RainbowKit + Wagmi** – Wallet connection  
- **ClipLoader** – Loading indicators  
- **React Icons** – UI icons  

---

## 📋 Prerequinextjss

Before you begin, ensure you have:

- **Node.js** (v18 or higher)
- **pnpm** package manager
- **MetaMask** browser extension
- **Git** for cloning the repository

## 🛠️ Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd world-cup-2026-encrypted-vote

# Initialize submodules (includes fhevm-hardhat-template)
git submodule update --init --recursive

# Install dependencies
pnpm install
```

### 2. Environment Configuration

Set up your Hardhat environment variables by following the [FHEVM documentation](https://docs.zama.ai/protocol/solidity-guides/getting-started/setup#set-up-the-hardhat-configuration-variables-optional):

- `MNEMONIC`: Your wallet mnemonic phrase
- `INFURA_API_KEY`: Your Infura API key for Sepolia

### 3. Start Development Environment

**Option A: Local Development (Recommended for testing)**

```bash
# Terminal 1: Start local Hardhat node
pnpm chain
# RPC URL: http://127.0.0.1:8545 | Chain ID: 31337

# Terminal 2: Deploy contracts to localhost
pnpm deploy:localhost

# Terminal 3: Start the frontend
pnpm start
```

**Option B: Sepolia Testnet**

```bash
# Deploy to Sepolia testnet
pnpm deploy:sepolia

# Start the frontend
pnpm start
```

### 4. Connect MetaMask

1. Open [http://localhost:3000](http://localhost:3000) in your browser
2. Click "Connect Wallet" and select MetaMask
3. If using localhost, add the Hardhat network to MetaMask:
   - **Network Name**: Hardhat Local
   - **RPC URL**: `http://127.0.0.1:8545`
   - **Chain ID**: `31337`
   - **Currency Symbol**: `ETH`

### ⚠️ Sepolia Production note

- In production, `NEXT_PUBLIC_ALCHEMY_API_KEY` must be set (see `packages/nextjs/scaffold.config.ts`). The app throws if missing.
- Ensure `packages/nextjs/contracts/deployedContracts.ts` points to your live contract addresses.
- Optional: set `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` for better WalletConnect reliability.
- Optional: add per-chain RPCs via `rpcOverrides` in `packages/nextjs/scaffold.config.ts`.

## 🔧 Troubleshooting

### Common MetaMask + Hardhat Issues

When developing with MetaMask and Hardhat, you may encounter these common issues:

#### ❌ Nonce Mismatch Error

**Problem**: MetaMask tracks transaction nonces, but when you restart Hardhat, the node resets while MetaMask doesn't update its tracking.

**Solution**:
1. Open MetaMask extension
2. Select the Hardhat network
3. Go to **Settings** → **Advanced**
4. Click **"Clear Activity Tab"** (red button)
5. This resets MetaMask's nonce tracking

#### ❌ Cached View Function Results

**Problem**: MetaMask caches smart contract view function results. After restarting Hardhat, you may see outdated data.

**Solution**:
1. **Restart your entire browser** (not just refresh the page)
2. MetaMask's cache is stored in extension memory and requires a full browser restart to clear

> 💡 **Pro Tip**: Always restart your browser after restarting Hardhat to avoid cache issues.

For more details, see the [MetaMask development guide](https://docs.metamask.io/wallet/how-to/run-devnet/).

## 📁 Project Structure

This template uses a monorepo structure with three main packages:

```
world-cup-2026-encrypted-vote/
├── packages/
│   ├── fhevm-hardhat-template/    # Smart contracts & deployment
│   ├── fhevm-sdk/                 # FHEVM SDK package
│   └── nextjs/                      # React frontend application
└── scripts/                       # Build and deployment scripts
```

### Key Components

#### 🔗 FHEVM Integration (`packages/nextjs/hooks`)
- **`useFHEWorldCupHook.tsx`**: Example hook demonstrating FHEVM contract interaction
- Essential hooks for FHEVM-enabled smart contract communication
- Easily copyable to any FHEVM + React project

#### 🎣 Wallet Management (`packages/nextjs/hooks/helper/`)
- MetaMask wallet provider hooks
- Compatible with EIP-6963 standard
- Easily adaptable for other wallet providers

#### 🔧 Flexibility
- Replace `ethers.js` with `Wagmi` or other React-friendly libraries
- Modular architecture for easy customization
- Support for multiple wallet providers

## 📚 Additional Resources

### Official Documentation
- [FHEVM Documentation](https://docs.zama.ai/protocol/solidity-guides/) - Complete FHEVM guide
- [FHEVM Hardhat Guide](https://docs.zama.ai/protocol/solidity-guides/development-guide/hardhat) - Hardhat integration
- [Relayer SDK Documentation](https://docs.zama.ai/protocol/relayer-sdk-guides/) - SDK reference
- [Environment Setup](https://docs.zama.ai/protocol/solidity-guides/getting-started/setup#set-up-the-hardhat-configuration-variables-optional) - MNEMONIC & API keys

### Development Tools
- [MetaMask + Hardhat Setup](https://docs.metamask.io/wallet/how-to/run-devnet/) - Local development
- [React Documentation](https://reactjs.org/) - React framework guide

### Community & Support
- [FHEVM Discord](https://discord.com/invite/zama) - Community support
- [GitHub Issues](https://github.com/zama-ai/fhevm-react-template/issues) - Bug reports & feature requests

## 📄 License

This project is licensed under the **BSD-3-Clause-Clear License**. See the [LICENSE](LICENSE) file for details.
