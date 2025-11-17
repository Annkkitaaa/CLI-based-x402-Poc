# x402 Payment Protocol - CLI PoC

A command-line interface proof-of-concept demonstrating the [x402 payment protocol](https://github.com/coinbase/x402) developed by Coinbase. This project shows how HTTP 402 "Payment Required" can enable seamless micropayments for API access using stablecoins on the Base Sepolia testnet.

## What is x402?

x402 is an open payment protocol that enables instant, automatic stablecoin payments directly over HTTP. It uses the HTTP 402 "Payment Required" status code to request payment for resources. Key features:

- **Micropayments**: Support for payments as low as $0.001
- **Zero fees**: No transaction fees for merchants or customers
- **Chain agnostic**: Works with multiple blockchains
- **Simple integration**: Built on standard HTTP protocol

## Project Structure

```
CLI-based-x402-Poc/
├── src/
│   ├── types.ts           # x402 protocol type definitions
│   ├── facilitator.ts     # Payment verification and settlement
│   ├── server.ts          # Resource server requiring payments
│   ├── client.ts          # CLI client for making paid requests
│   └── generate-wallet.ts # Utility to generate test wallets
├── package.json
├── tsconfig.json
└── README.md
```

## How It Works

### Payment Flow

1. **Initial Request**: Client requests a protected resource
2. **402 Response**: Server responds with "402 Payment Required" and payment requirements
3. **Payment Creation**: Client creates a signed payment authorization (EIP-712)
4. **Paid Request**: Client resubmits request with `X-PAYMENT` header
5. **Verification**: Server verifies and settles the payment
6. **Resource Access**: Server returns the protected resource

### Architecture

```
┌─────────┐                ┌─────────────┐              ┌──────────────┐
│ Client  │───── GET ─────>│   Server    │              │ Facilitator  │
│         │                 │  (402)      │              │   Service    │
└─────────┘                 └─────────────┘              └──────────────┘
     │                            │                             │
     │   Payment Requirements     │                             │
     │<───────────────────────────│                             │
     │                            │                             │
     │   Sign Payment (EIP-712)   │                             │
     │────────┐                   │                             │
     │        │                   │                             │
     │<───────┘                   │                             │
     │                            │                             │
     │   GET + X-PAYMENT Header   │                             │
     │───────────────────────────>│                             │
     │                            │                             │
     │                            │   Verify Payment            │
     │                            │────────────────────────────>│
     │                            │                             │
     │                            │   Settle Payment (on-chain) │
     │                            │────────────────────────────>│
     │                            │                             │
     │                            │   Settlement Result         │
     │                            │<────────────────────────────│
     │                            │                             │
     │   Protected Resource       │                             │
     │<───────────────────────────│                             │
     │                            │                             │
```

## Setup

### Prerequisites

- Node.js 18+ and npm
- Basic understanding of blockchain/crypto wallets

### Installation

1. **Clone and install dependencies**:
   ```bash
   npm install
   ```

2. **Generate a test wallet**:
   ```bash
   npm run generate-wallet
   ```

   This will output a new wallet address and private key. **Save these for testing!**

3. **Get testnet USDC**:
   - Visit [Circle's Testnet Faucet](https://faucet.circle.com/)
   - Select "Base Sepolia" network
   - Enter your wallet address
   - Request testnet USDC (you'll get 10 USDC for testing)

4. **Configure environment**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your private key:
   ```
   PRIVATE_KEY=your_private_key_from_step_2
   ```

## Usage

### Start the Server

In one terminal, start the x402 resource server:

```bash
npm run dev:server
```

You should see:
```
╔════════════════════════════════════════════════════════════╗
║           x402 Resource Server - Running                  ║
╠════════════════════════════════════════════════════════════╣
║  Port:              3402                                   ║
║  Network:           Base Sepolia (Testnet)                ║
║  ...                                                       ║
╚════════════════════════════════════════════════════════════╝
```

### Test Public Endpoint (No Payment)

```bash
npm run dev:client test-public
```

This accesses a free endpoint to verify the server is running.

### Make a Paid Request

In another terminal, make a paid request to a protected endpoint:

```bash
npm run dev:client request --endpoint /premium-data --key YOUR_PRIVATE_KEY
```

Or use the shorter endpoint that costs less:

```bash
npm run dev:client request --endpoint /api-call --key YOUR_PRIVATE_KEY
```

### View Available Endpoints

```bash
npm run dev:client info
```

## Available Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `/public` | FREE | Public endpoint, no payment required |
| `/premium-data` | 1.0 USDC | Premium market data and insights |
| `/api-call` | 0.1 USDC | Generic API call example |

## Example Output

When you make a successful paid request, you'll see:

```
╔════════════════════════════════════════════════════════════╗
║              x402 Payment Flow - Starting                 ║
╚════════════════════════════════════════════════════════════╝

[1/5] Wallet initialized
      Address: 0x1234...5678

[2/5] Making initial request to /premium-data
      Status: 402 Payment Required ✓

[3/5] Payment requirement received:
      Scheme: exact
      Network: base-sepolia
      Amount: 1.000000 USDC
      Recipient: 0x742d...0bEb
      Timeout: 300s

[4/5] Creating payment authorization...

[5/5] Submitting request with payment...

╔════════════════════════════════════════════════════════════╗
║              ✓ Payment Successful!                        ║
╚════════════════════════════════════════════════════════════╝

Response Data:
{
  "message": "Payment successful! Here is your premium data.",
  "data": {
    "secret": "This is valuable premium content!",
    ...
  },
  "payment": {
    "txHash": "0xabc123...",
    "network": "base-sepolia"
  }
}
```

## Technical Details

### Payment Scheme: EIP-3009

This PoC uses the `exact` payment scheme with EIP-3009 (transferWithAuthorization). This allows gasless transfers where:

1. User signs an authorization message (EIP-712)
2. Server or facilitator submits the transaction
3. User doesn't need ETH for gas fees

### Signature Format (EIP-712)

```typescript
{
  domain: {
    name: "USD Coin",
    version: "2",
    chainId: 84532,  // Base Sepolia
    verifyingContract: "0x036CbD..."  // USDC contract
  },
  types: {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" }
    ]
  }
}
```

### X-PAYMENT Header Format

The payment is sent as a base64-encoded JSON object:

```json
{
  "x402Version": 1,
  "scheme": "exact",
  "network": "base-sepolia",
  "payload": {
    "from": "0x...",
    "to": "0x...",
    "value": "1000000",
    "validAfter": 1234567890,
    "validBefore": 1234568190,
    "nonce": "0x...",
    "signature": "0x..."
  }
}
```

## Development

### Build

Compile TypeScript to JavaScript:

```bash
npm run build
```

### Run Production Build

```bash
npm run server    # Start server
npm run client    # Run client
```

## Security Notes

**Important**: This is a PoC for educational purposes:

- Uses Base Sepolia testnet only
- Never use test wallets with real funds
- Private keys are stored in `.env` (never commit this file)
- Facilitator is simplified (production would use Coinbase's facilitator)
- No actual on-chain settlement in this demo (simulated)

## Limitations

This PoC demonstrates the protocol but has some simplifications:

1. **Simulated Settlement**: Transactions are not actually sent to the blockchain
2. **In-Memory Storage**: Nonces and state are not persisted
3. **No Rate Limiting**: Production servers would need this
4. **Basic Error Handling**: Simplified for demonstration
5. **Mock Facilitator**: Real implementation would use Coinbase's facilitator API

## Learn More

- [x402 GitHub Repository](https://github.com/coinbase/x402)
- [x402 Documentation](https://docs.cdp.coinbase.com/x402/welcome)
- [x402 Official Website](https://www.x402.org/)
- [EIP-3009 Specification](https://eips.ethereum.org/EIPS/eip-3009)
- [EIP-712 Specification](https://eips.ethereum.org/EIPS/eip-712)

## Troubleshooting

### "Insufficient funds" error

Make sure you've:
1. Generated a wallet with `npm run generate-wallet`
2. Got testnet USDC from the faucet
3. Used the correct private key in your command

### Server not responding

Check that:
1. Server is running (`npm run dev:server`)
2. Server is on the correct port (3402)
3. No firewall blocking localhost connections

### Payment verification failed

Ensure:
1. Your wallet has testnet USDC
2. You're using the correct network (Base Sepolia)
3. Payment hasn't expired (default 5 minutes)

## Contributing

This is a learning project! Feel free to:
- Experiment with different payment amounts
- Add new protected endpoints
- Implement real blockchain settlement
- Add support for other chains/tokens

## License

MIT

---

Built with [x402](https://github.com/coinbase/x402) by Coinbase
