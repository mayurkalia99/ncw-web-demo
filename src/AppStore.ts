import { create } from "zustand";
import {
  ConsoleLogger,
  FireblocksNCW,
  IEventsHandler,
  IKeyDescriptor,
  IMessagesHandler,
  TEvent,
  TMPCAlgorithm,
} from "@fireblocks/ncw-js-sdk";
import { ApiService, IAssetAddress, IAssetBalance, ITransactionData, IWalletAsset } from "./services/ApiService";
import { IAppState } from "./IAppState";
import { generateDeviceId, getOrCreateDeviceId, storeDeviceId } from "./deviceId";
import { PasswordEncryptedLocalStorage } from "./services/PasswordEncryptedLocalStorage";
import { randomPassPhrase } from "./services/randomPassPhrase";
import { ENV_CONFIG } from "./env_config";

const rememberBackupPassphrase = (passphrase: string) => {
  localStorage.setItem("DEMO_APP:backup-passphrase", passphrase);
};

const getBackupPassphrase = (): string | null => {
  return localStorage.getItem("DEMO_APP:backup-passphrase") ?? null;
};

export type TAsyncActionStatus = "not_started" | "started" | "success" | "failed";
export type TFireblocksNCWStatus = "sdk_not_ready" | "initializing_sdk" | "sdk_available" | "sdk_initialization_failed";

export const useAppStore = create<IAppState>()((set, get) => {
  let apiService: ApiService | null = null;
  let messagesUnsubscriber: (() => void) | null = null;
  let txsUnsubscriber: (() => void) | null = null;

  const updateOrAddTx = (existingTxs: ITransactionData[], newTx: ITransactionData): ITransactionData[] => {
    const index = existingTxs.findIndex((tx) => tx.id === newTx.id);
    if (index === -1) {
      return [...existingTxs, newTx];
    }
    const result = [...existingTxs];
    result[index] = newTx;
    return result.sort((t1, t2) => (t2.lastUpdated ?? 0) - (t1.lastUpdated ?? 0));
  };

  return {
    automateInitialization: ENV_CONFIG.AUTOMATE_INITIALIZATION,
    userId: null,
    walletId: null,
    pendingWeb3Connection: null,
    web3Uri: null,
    web3Connections: [],
    txs: [],
    appStoreInitialized: false,
    fireblocksNCW: null,
    deviceId: getOrCreateDeviceId(),
    loginToDemoAppServerStatus: "not_started",
    assignDeviceStatus: "not_started",
    fireblocksNCWStatus: "sdk_not_ready",
    keysStatus: null,
    passphrase: getBackupPassphrase(),
    addAssetPrompt: null,
    accounts: [],
    initAppStore: (tokenGetter: () => Promise<string>) => {
      try {
        apiService = new ApiService(ENV_CONFIG.BACKEND_BASE_URL, tokenGetter);
        set((state) => ({ ...state, appStoreInitialized: true }));
      } catch (e) {
        console.error(`Failed to initialize ApiService: ${e}`);
        set((state) => ({ ...state, appStoreInitialized: false }));
      }
    },
    disposeAppStore: () => {
      if (apiService) {
        apiService.dispose();
        apiService = null;
        set((state) => ({ ...state, appStoreInitialized: false }));
      }
    },
    assignCurrentDevice: async () => {
      const { deviceId } = get();
      set((state) => ({ ...state, walletId: null, assignDeviceStatus: "started" }));
      if (!apiService) {
        throw new Error("apiService is not initialized");
      }
      try {
        const walletId = await apiService.assignDevice(deviceId);
        set((state) => ({ ...state, walletId, assignDeviceStatus: "success" }));
      } catch (e) {
        set((state) => ({ ...state, walletId: null, assignDeviceStatus: "failed" }));
      }
    },
    generateNewDeviceId: async () => {
      const deviceId = generateDeviceId();
      set((state) => ({ ...state, deviceId, walletId: null, assignDeviceStatus: "not_started" }));
      storeDeviceId(deviceId);
    },
    setDeviceId: (deviceId: string) => {
      storeDeviceId(deviceId);
      set((state) => ({ ...state, deviceId }));
    },
    setPassphrase: (passphrase: string) => {
      rememberBackupPassphrase(passphrase);
      set((state) => ({ ...state, passphrase }));
    },
    regeneratePassphrase: () => {
      const passphrase = randomPassPhrase();
      rememberBackupPassphrase(passphrase);
      set((state) => ({ ...state, passphrase }));
    },
    loginToDemoAppServer: async () => {
      set((state) => ({ ...state, userId: null, loginToDemoAppServerStatus: "started" }));
      if (!apiService) {
        throw new Error("apiService is not initialized");
      }
      try {
        const userId = await apiService.login();
        set((state) => ({ ...state, userId, loginToDemoAppServerStatus: "success" }));
      } catch (e) {
        set((state) => ({ ...state, userId: null, loginToDemoAppServerStatus: "failed" }));
      }
    },
    initFireblocksNCW: async () => {
      if (!apiService) {
        throw new Error("apiService is not initialized");
      }
      set((state) => ({ ...state, fireblocksNCW: null, fireblocksNCWStatus: "initializing_sdk" }));
      try {
        const messagesHandler: IMessagesHandler = {
          handleOutgoingMessage: (message: string) => {
            if (!apiService) {
              throw new Error("apiService is not initialized");
            }
            return apiService.sendMessage(deviceId, message);
          },
        };

        const eventsHandler: IEventsHandler = {
          handleEvent: (event: TEvent) => {
            switch (event.type) {
              case "key_descriptor_changed":
                const keysStatus: Record<TMPCAlgorithm, IKeyDescriptor> =
                  get().keysStatus ?? ({} as Record<TMPCAlgorithm, IKeyDescriptor>);
                keysStatus[event.keyDescriptor.algorithm] = event.keyDescriptor;
                set((state) => ({ ...state, keysStatus }));
                break;

              case "transaction_signature_changed":
                console.log(`Transaction signature status: ${event.transactionSignature.transactionSignatureStatus}`);
                break;
            }
          },
        };

        const { deviceId } = get();
        const secureStorageProvider = new PasswordEncryptedLocalStorage(deviceId, () => {
          const password = prompt("Enter password", "");
          return Promise.resolve(password || "");
        });

        const fireblocksNCW = await FireblocksNCW.initialize({
          env: ENV_CONFIG.NCW_SDK_ENV,
          deviceId,
          messagesHandler,
          eventsHandler,
          secureStorageProvider,
          logger: new ConsoleLogger(),
        });

        const physicalDeviceId = fireblocksNCW.getPhysicalDeviceId();
        messagesUnsubscriber = apiService.listenToMessages(deviceId, physicalDeviceId, (msg) =>
          fireblocksNCW.handleIncomingMessage(msg),
        );
        txsUnsubscriber = apiService.listenToTxs(deviceId, (tx: ITransactionData) => {
          const txs = updateOrAddTx(get().txs, tx);
          set((state) => ({ ...state, txs }));
        });
        const keysStatus = await fireblocksNCW.getKeysStatus();
        set((state) => ({ ...state, keysStatus, fireblocksNCW: fireblocksNCW, fireblocksNCWStatus: "sdk_available" }));
      } catch (e) {
        console.error(e);
        set((state) => ({
          ...state,
          keysStatus: null,
          fireblocksNCW: null,
          fireblocksNCWStatus: "sdk_initialization_failed",
        }));
      }
    },
    createTransaction: async () => {
      if (!apiService) {
        throw new Error("apiService is not initialized");
      }
      const { deviceId } = get();
      const newTxData = await apiService.createTransaction(deviceId);
      const txs = updateOrAddTx(get().txs, newTxData);
      set((state) => ({ ...state, txs }));
    },
    cancelTransaction: async (txId: string) => {
      if (!apiService) {
        throw new Error("apiService is not initialized");
      }
      const { deviceId } = get();
      await apiService.cancelTransaction(deviceId, txId);
      set((state) => {
        const index = state.txs.findIndex((t) => t.id === txId);
        if (index === -1) {
          return state;
        }
        return {
          ...state,
          txs: [
            ...state.txs.slice(0, index),
            { ...state.txs[index], status: "CANCELLING" },
            ...state.txs.slice(index + 1),
          ],
        };
      });
    },
    setWeb3uri: (uri: string | null) => {
      set((state) => ({ ...state, web3Uri: uri }));
    },
    getWeb3Connections: async () => {
      if (!apiService) {
        throw new Error("apiService is not initialized");
      }

      const { deviceId } = get();
      const connections = await apiService.getWeb3Connections(deviceId);
      set((state) => ({ ...state, web3Connections: connections }));
    },
    createWeb3Connection: async (uri: string) => {
      if (!apiService) {
        throw new Error("apiService is not initialized");
      }

      const { deviceId } = get();
      const response = await apiService.createWeb3Connection(deviceId, uri);
      set((state) => ({ ...state, pendingWeb3Connection: response }));
    },
    approveWeb3Connection: async () => {
      if (!apiService) {
        throw new Error("apiService is not initialized");
      }
      const { deviceId, pendingWeb3Connection } = get();
      if (!pendingWeb3Connection) {
        throw new Error("no pending connection");
      }
      await apiService.approveWeb3Connection(deviceId, pendingWeb3Connection.id);
      set((state) => ({ ...state, pendingWeb3Connection: null }));
    },
    denyWeb3Connection: async () => {
      if (!apiService) {
        throw new Error("apiService is not initialized");
      }
      const { deviceId, pendingWeb3Connection } = get();
      if (!pendingWeb3Connection) {
        throw new Error("no pending connection");
      }
      await apiService.denyWeb3Connection(deviceId, pendingWeb3Connection.id);
      set((state) => ({ ...state, pendingWeb3Connection: null }));
    },
    removeWeb3Connection: async (sessionId: string) => {
      if (!apiService) {
        throw new Error("apiService is not initialized");
      }
      const { deviceId } = get();
      await apiService.removeWeb3Connection(deviceId, sessionId);

      set((state) => ({ ...state, web3Connections: state.web3Connections.filter((s) => s.id !== sessionId) }));
    },
    takeover: async () => {
      const { fireblocksNCW } = get();
      if (!fireblocksNCW) {
        throw new Error("fireblocksNCW is not initialized");
      }
      fireblocksNCW.takeover();
    },
    disposeFireblocksNCW: () => {
      const { fireblocksNCW } = get();
      if (!fireblocksNCW) {
        throw new Error("fireblocksNCW is not initialized");
      }
      if (messagesUnsubscriber) {
        messagesUnsubscriber();
        messagesUnsubscriber = null;
      }

      if (txsUnsubscriber) {
        txsUnsubscriber();
        txsUnsubscriber = null;
      }

      fireblocksNCW.dispose();
      set((state) => ({ ...state, fireblocksNCW: null, fireblocksNCWStatus: "sdk_not_ready" }));
    },

    addAsset: async (accountId: number, assetId: string) => {
      if (!apiService) {
        throw new Error("apiService is not initialized");
      }
      const { deviceId } = get();
      await apiService.addAsset(deviceId, accountId, assetId);
      set((state) => ({ ...state, addAssetPrompt: null }));
    },

    setAddAssetPrompt: (asset: string|null) => {
      set((state) => ({ ...state, addAssetPrompt: asset }));
    },
  
    refreshAccounts: async () => {
      if (!apiService) {
        throw new Error("apiService is not initialized");
      }
      const { deviceId, accounts: prevAccounts } = get();
      const allAccounts = await apiService.getAccounts(deviceId);
      const accounts: Array<{
        asset: IWalletAsset,
        balance?: IAssetBalance,
        address?: IAssetAddress,
      }>[] = [];

      for (const account of allAccounts) {
        const allAssets = await apiService.getAssets(deviceId, account.accountId);
        const assets = [];

        for (const asset of allAssets) {
          const prevAsset = (prevAccounts[account.accountId])?.find(a => a.asset.id === asset.id);
          const address = prevAsset?.address ?? await apiService.getAddress(deviceId, account.accountId, asset.id);
          const balance = prevAsset?.balance;
          assets.push({ asset, balance, address });
        }

        accounts.push(assets);
      }

      set((state) => ({ ...state, accounts }));
    },

    refreshBalance: async () => {
      if (!apiService) {
        throw new Error("apiService is not initialized");
      }
      const { deviceId, accounts: prevAccounts } = get();
      const accounts: Array<{
        asset: IWalletAsset,
        balance?: IAssetBalance,
        address?: IAssetAddress,
      }>[] = [];
      
      for (const [id, account] of prevAccounts.entries()) {
        const prevAssets = account.map(a => a.asset);
        const assets = [];

        for (const asset of prevAssets) {
          const prevAsset = (prevAccounts[id])?.find(a => a.asset.id === asset.id);
          const address = prevAsset?.address;
          const balance = await apiService.getBalance(deviceId, id, asset.id);
          assets.push({ asset, balance, address });
        }

        accounts.push(assets);
      }
      set((state) => ({ ...state, accounts }));
    },
  };
});
