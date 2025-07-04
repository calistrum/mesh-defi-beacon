import "@meshsdk/react/styles.css";
import Head from "next/head";
import { useEffect, useState } from "react";
import { CardanoWallet, useWallet } from "@meshsdk/react";
import { AssetExtended } from "@meshsdk/common";


export default function Home() {
  const { connected, wallet, connect } = useWallet();
  const [assets, setAssets] = useState<AssetExtended[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const getAssets = async () => {
    if (wallet) {
      setLoading(true);
      const _assets = await wallet.getAssets();
      setAssets(_assets);
      setLoading(false);
    }
  };

  const detectWallet = async () => {
    if (!connected && window.cardano) {
      for (const walletName in window.cardano) {
        const walletInstance: any = window.cardano[walletName];
        if (walletInstance.isEnabled && (await walletInstance.isEnabled())) {
          try {
            const api = await walletInstance.enable();
            let networkId = null;
            if (api.getNetworkId) {
              networkId = await api.getNetworkId();
            }
            console.log(
              `Detected wallet: ${walletName}, networkId: ${networkId !== null ? networkId : "unknown"}`
            );
            // Only connect if preprod/testnet
            if (networkId === 0) {
              await connect(walletName);
              break;
            }
          } catch (e) {
            console.log(`Error enabling wallet ${walletName}:`, e);
          }
        } else {
          console.log(`Wallet ${walletName} is not enabled or does not support isEnabled.`);
        }
      }
    }
  };

  useEffect(() => {
    detectWallet();
  }, [connected, wallet]);

  return (
    <div className="bg-gray-900 w-full text-white text-center">
      <Head>
        <title>Mesh App on Cardano</title>
        <meta name="description" content="A Cardano dApp powered by Mesh" />
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <h1 className="text-6xl font-thin mb-20">
          <a href="https://meshjs.dev/" className="text-sky-600">
            Mesh
          </a>{" "}
          Next.js
        </h1>

        <div className="mb-20">
          <CardanoWallet />
        </div>

        {connected && (
          <>
            <h2 className="text-4xl font-thin mb-4">Beacon Actions</h2>
            <a
              href={`/contract/asset1zqu5xncwpkmn7u9c6q0lntw49m3e845c458229/list/1`}
              className="text-sky-600 block mb-2"
            >
              List via Beacons
            </a>
            <a
              href={`/contract/asset1zqu5xncwpkmn7u9c6q0lntw49m3e845c458229/buy/1`}
              className="text-sky-600 block mb-2"
            >
              Buy via Beacons
            </a>

            {assets ? (
              <ul className="text-6xl font-thin mb-20">
                {assets.map((asset: AssetExtended, index: number) => (
                  <li key={index}>
                    {asset.assetName} - {asset.unit} - {asset.fingerprint}
                    <br />
                    <a
                      href={`/contract/${asset.fingerprint}/list/33`}
                      className="text-sky-600 block mb-2"
                    >
                      List via Beacons
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <button
                type="button"
                onClick={getAssets}
                disabled={loading}
                style={{
                  margin: "8px",
                  backgroundColor: loading ? "orange" : "grey",
                }}
              >
                Get Wallet Assets
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
