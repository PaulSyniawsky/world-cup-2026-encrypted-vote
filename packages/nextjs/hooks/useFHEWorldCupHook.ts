"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDeployedContractInfo } from "./helper";
import { useWagmiEthers } from "./wagmi/useWagmiEthers";
import { FhevmInstance } from "@fhevm-sdk";
import {
  buildParamsFromAbi,
  getEncryptionMethod,
  useFHEDecrypt,
  useFHEEncryption,
  useInMemoryStorage,
} from "@fhevm-sdk";
import { ethers } from "ethers";
import { useReadContract } from "wagmi";
import type { Contract } from "~~/utils/helper/contract";
import type { AllowedChainIds } from "~~/utils/helper/networks";

export const useFHEWorldCupHook = (props: {
  instance: FhevmInstance | undefined;
  initialChains?: Readonly<Record<number, string>>;
}) => {
  const { instance, initialChains } = props;
  const { storage: decryptionStorage } = useInMemoryStorage();
  const { chainId, accounts, isConnected, ethersSigner, ethersReadonlyProvider } = useWagmiEthers(initialChains);

  const activeChain = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;

  const { data: contractInfo } = useDeployedContractInfo({
    contractName: "FHEWorldCupVote",
    chainId: activeChain,
  });

  type WorldCupContractInfo = Contract<"FHEWorldCupVote"> & { chainId?: number };

  const [statusMsg, setStatusMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const hasContract = Boolean(contractInfo?.address && contractInfo?.abi);
  const hasSigner = Boolean(ethersSigner);
  const hasProvider = Boolean(ethersReadonlyProvider);

  const contractInstance = (mode: "read" | "write") => {
    if (!hasContract) return undefined;
    const providerOrSigner = mode === "read" ? ethersReadonlyProvider : ethersSigner;
    if (!providerOrSigner) return undefined;
    return new ethers.Contract(contractInfo!.address, (contractInfo as WorldCupContractInfo).abi, providerOrSigner);
  };

  const {
    data: encryptedHandle,
    refetch: reloadEncryptedHandle,
    isFetching: isReloading,
  } = useReadContract({
    address: hasContract ? (contractInfo!.address as `0x${string}`) : undefined,
    abi: hasContract ? ((contractInfo as WorldCupContractInfo).abi as any) : undefined,
    functionName: "readEncryptedGuess" as const,
    args: [accounts ? accounts[0] : ""],
    query: { enabled: hasContract && hasProvider, refetchOnWindowFocus: false },
  });

  const voteHandle = useMemo(() => encryptedHandle as string | undefined, [encryptedHandle]);

  const alreadyVoted = useMemo(() => {
    if (!voteHandle) return false;
    return ![ethers.ZeroHash, "0x", "0x0"].includes(voteHandle);
  }, [voteHandle]);

  const decryptRequests = useMemo(() => {
    if (!voteHandle || !hasContract || voteHandle === ethers.ZeroHash) return undefined;
    return [{ handle: voteHandle, contractAddress: contractInfo!.address }] as const;
  }, [voteHandle, hasContract, contractInfo?.address]);

  const {
    canDecrypt,
    decrypt,
    isDecrypting,
    message: decryptMsg,
    results,
  } = useFHEDecrypt({
    instance,
    ethersSigner: ethersSigner as any,
    fhevmDecryptionSignatureStorage: decryptionStorage,
    chainId,
    requests: decryptRequests,
  });

  useEffect(() => {
    if (decryptMsg) setStatusMsg(decryptMsg);
  }, [decryptMsg]);

  const clearedVote = useMemo(() => {
    if (!voteHandle) return undefined;
    if (voteHandle === ethers.ZeroHash) return { handle: voteHandle, clear: BigInt(0) } as const;
    const clearValue = results[voteHandle];
    return typeof clearValue === "undefined" ? undefined : ({ handle: voteHandle, clear: clearValue } as const);
  }, [voteHandle, results]);

  const decrypted = useMemo(() => {
    console.log(results)
    if (!voteHandle) return false;
    const val = results?.[voteHandle];
    return typeof val !== "undefined" && BigInt(val) !== BigInt(0);
  }, [voteHandle, results]);

  const decryptMyPrediction = decrypt;

  const { encryptWith } = useFHEEncryption({
    instance,
    ethersSigner: ethersSigner as any,
    contractAddress: contractInfo?.address,
  });

  const readyToVote = useMemo(
    () => hasContract && instance && hasSigner && !loading && !alreadyVoted,
    [hasContract, instance, hasSigner, loading, alreadyVoted],
  );

  const getEncryptionMethodForFn = (fnName: "recordEncryptedGuess") => {
    const fnAbi = contractInfo?.abi.find(item => item.type === "function" && item.name === fnName);
    if (!fnAbi) return { method: undefined as string | undefined, error: `No ABI for ${fnName}` };
    if (!fnAbi.inputs || fnAbi.inputs.length === 0)
      return { method: undefined as string | undefined, error: `No inputs in ${fnName}` };
    return { method: getEncryptionMethod(fnAbi.inputs[0].internalType), error: undefined };
  };

  const submitPrediction = useCallback(
    async (selectedTeam: string) => {
      if (!readyToVote || loading) return;
      setLoading(true);
      try {
        // --- chuyển list các ID thành 1 số duy nhất dạng 123456...
        const journeyNumber = Number(selectedTeam);

        const { method, error } = getEncryptionMethodForFn("recordEncryptedGuess");
        if (!method) throw new Error(error ?? "Encryption method missing");

        const encrypted = await encryptWith(builder => (builder as any)[method](journeyNumber));
        if (!encrypted) throw new Error("Encryption failed");

        const writer = contractInstance("write");
        if (!writer) throw new Error("Contract or signer unavailable");

        const params = buildParamsFromAbi(encrypted, [...contractInfo!.abi] as any[], "recordEncryptedGuess");
        const tx = await writer.recordEncryptedGuess(...params, { gasLimit: 300_000 });
        setStatusMsg("Transaction sent, waiting confirmation...");
        await tx.wait();

        setStatusMsg("✅ Prediction recorded!");
        await reloadEncryptedHandle();
      } catch (err) {
        setStatusMsg(`submitPrediction failed: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    },
    [readyToVote, loading, encryptWith, contractInstance, reloadEncryptedHandle, contractInfo?.abi],
  );

  useEffect(() => {
    setStatusMsg("");
  }, [accounts, chainId]);

  return {
    contractAddress: contractInfo?.address,
    canDecrypt,
    readyToVote,
    decryptMyPrediction,
    submitPrediction,
    reloadEncryptedHandle,
    decrypted,
    statusMsg,
    clear: clearedVote?.clear,
    handle: voteHandle,
    isDecrypting,
    isReloading,
    loading,
    alreadyVoted,
    chainId,
    accounts,
    isConnected,
    ethersSigner,
  };
};
