/**
 * Simplified Facilitator Implementation
 * In production, this would be a separate service handling blockchain transactions
 * For this PoC, we simulate the verification and settlement process
 */

import { ethers } from 'ethers';
import type {
  PaymentPayload,
  PaymentRequirement,
  VerifyResponse,
  SettleResponse,
  SupportedScheme,
  EIP3009Payload,
} from './types.js';

export class SimpleFacilitator {
  private usedNonces: Set<string> = new Set();

  /**
   * Get supported payment schemes
   */
  getSupported(): SupportedScheme[] {
    return [
      {
        scheme: 'exact',
        network: 'base-sepolia',
      },
    ];
  }

  /**
   * Verify a payment without settling it on-chain
   */
  async verify(
    paymentHeader: string,
    paymentRequirements: PaymentRequirement
  ): Promise<VerifyResponse> {
    try {
      // Decode the base64 payment header
      const paymentPayloadJson = Buffer.from(paymentHeader, 'base64').toString('utf-8');
      const paymentPayload: PaymentPayload = JSON.parse(paymentPayloadJson);

      // Check version
      if (paymentPayload.x402Version !== 1) {
        return {
          isValid: false,
          invalidReason: 'Unsupported x402 version',
        };
      }

      // Check scheme and network match
      if (
        paymentPayload.scheme !== paymentRequirements.scheme ||
        paymentPayload.network !== paymentRequirements.network
      ) {
        return {
          isValid: false,
          invalidReason: 'Scheme or network mismatch',
        };
      }

      // For 'exact' scheme with EIP-3009
      if (paymentPayload.scheme === 'exact') {
        const eip3009Payload = paymentPayload.payload as EIP3009Payload;

        // Verify nonce hasn't been used
        if (this.usedNonces.has(eip3009Payload.nonce)) {
          return {
            isValid: false,
            invalidReason: 'Nonce already used',
          };
        }

        // Verify amount
        if (eip3009Payload.value !== paymentRequirements.maxAmountRequired) {
          return {
            isValid: false,
            invalidReason: 'Payment amount mismatch',
          };
        }

        // Verify recipient
        if (eip3009Payload.to.toLowerCase() !== paymentRequirements.payTo.toLowerCase()) {
          return {
            isValid: false,
            invalidReason: 'Payment recipient mismatch',
          };
        }

        // Verify timing
        const now = Math.floor(Date.now() / 1000);
        if (eip3009Payload.validBefore < now) {
          return {
            isValid: false,
            invalidReason: 'Payment expired',
          };
        }

        // Verify signature using EIP-712
        const isValidSignature = await this.verifyEIP3009Signature(
          eip3009Payload,
          paymentRequirements
        );

        if (!isValidSignature) {
          return {
            isValid: false,
            invalidReason: 'Invalid signature',
          };
        }

        return {
          isValid: true,
          invalidReason: null,
        };
      }

      return {
        isValid: false,
        invalidReason: 'Unsupported payment scheme',
      };
    } catch (error) {
      console.error('Verification error:', error);
      return {
        isValid: false,
        invalidReason: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Settle a payment on-chain (simulated for PoC)
   */
  async settle(
    paymentHeader: string,
    paymentRequirements: PaymentRequirement
  ): Promise<SettleResponse> {
    // First verify the payment
    const verification = await this.verify(paymentHeader, paymentRequirements);

    if (!verification.isValid) {
      return {
        success: false,
        error: verification.invalidReason || 'Payment verification failed',
      };
    }

    try {
      // Decode payment
      const paymentPayloadJson = Buffer.from(paymentHeader, 'base64').toString('utf-8');
      const paymentPayload: PaymentPayload = JSON.parse(paymentPayloadJson);
      const eip3009Payload = paymentPayload.payload as EIP3009Payload;

      // Mark nonce as used
      this.usedNonces.add(eip3009Payload.nonce);

      // In a real implementation, this would submit the transaction to the blockchain
      // For this PoC, we simulate it with a fake transaction hash
      const fakeTxHash = `0x${Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('')}`;

      console.log(`[Facilitator] Simulated settlement on ${paymentPayload.network}`);
      console.log(`[Facilitator] Transaction hash: ${fakeTxHash}`);
      console.log(`[Facilitator] Amount: ${eip3009Payload.value} (smallest unit)`);
      console.log(`[Facilitator] From: ${eip3009Payload.from}`);
      console.log(`[Facilitator] To: ${eip3009Payload.to}`);

      return {
        success: true,
        txHash: fakeTxHash,
        networkId: paymentPayload.network,
      };
    } catch (error) {
      return {
        success: false,
        error: `Settlement failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Verify EIP-3009 signature (EIP-712 typed data signature)
   */
  private async verifyEIP3009Signature(
    payload: EIP3009Payload,
    requirements: PaymentRequirement
  ): Promise<boolean> {
    try {
      // Construct EIP-712 domain
      const domain = {
        name: requirements.extra?.name || 'USD Coin',
        version: requirements.extra?.version || '2',
        chainId: this.getChainId(requirements.network),
        verifyingContract: requirements.asset,
      };

      // Define EIP-3009 types
      const types = {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      };

      // Construct the message
      const message = {
        from: payload.from,
        to: payload.to,
        value: payload.value,
        validAfter: payload.validAfter,
        validBefore: payload.validBefore,
        nonce: payload.nonce,
      };

      // Verify signature
      const recoveredAddress = ethers.verifyTypedData(
        domain,
        types,
        message,
        payload.signature
      );

      return recoveredAddress.toLowerCase() === payload.from.toLowerCase();
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Get chain ID for a given network
   */
  private getChainId(network: string): number {
    const chainIds: Record<string, number> = {
      'base-sepolia': 84532,
      'base': 8453,
      'ethereum': 1,
      'sepolia': 11155111,
    };
    return chainIds[network] || 1;
  }
}
