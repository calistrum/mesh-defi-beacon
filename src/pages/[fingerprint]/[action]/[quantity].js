import Head from "next/head";
import { useEffect, useState } from "react";
import { CardanoWallet, useWallet, useRewardAddress } from "@meshsdk/react";
import { useRouter } from 'next/router';
import { createSpotSale, buySpotSale } from '../../../js/p2p_aftermarket';


export default function Home() {
  const router = useRouter();
  //action: list, unlist, buy
  const { fingerprint, action, quantity } = router.query; // Get fingerprint, action, and quantity from the URL query string.
  //console.log('fingerprint', fingerprint);
  //console.log('action', action);
  //console.log('qty', quantity);
  
  var { wallet, connected, connect } = useWallet(); // Added `connect` to manually connect if needed
  const rewardAddress = useRewardAddress(); // Call the hook directly in the component

  const [actionStatus, setActionStatus] = useState(''); // Track the status of the list/unlist/buy actions
  

  const scriptContent = `
    function changeTheme() {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = (currentTheme === 'dark') ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      // Update backgroundBody when theme changes
      const backgroundBody = (newTheme === 'dark') 
        ? 'radial-gradient(54% 99% at 44% -3%, #3b3c4a 0%, #d946ef00 100%), radial-gradient(93% 78% at 117% 19%, #2f2f2f 0%, #14141400 100%), radial-gradient(50% 40% at 83% 40%, #f76eea94 0%, #14141400 100%)'
        : 'radial-gradient(54% 99% at 44% -3%, #e2e3fd 0%, #d946ef00 100%), radial-gradient(93% 78% at 117% 19%, #fdf5d8 0%, #14141400 100%), radial-gradient(50% 40% at 83% 40%, #f76eea94 0%, #14141400 100%)';
      document.documentElement.style.setProperty('--backgroundBody', backgroundBody);
    }

    // Apply theme on page load
    document.addEventListener('DOMContentLoaded', () => {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
      }
    });
  `;


  // Check if the wallet is already connected using a regular Cardano wallet library
  const detectWallet = async () => {
    //console.log("detectWallet... start");
    if (!connected) {
      //console.log("detectWallet... connected=" + connected);
      if (window.cardano) {
        connected = true;
        for (const propName in window.cardano) {
          //console.log("checking " + propName);

          const maybeWalletInstance = window.cardano[propName];
          const isEnabledFunc = maybeWalletInstance.isEnabled;
          //console.log("checking " + propName + " : FUNC " + isEnabledFunc);
          if (isEnabledFunc) {
            const walletName = propName;
            const isEnabled = await isEnabledFunc();
            //console.log("checking " + walletName + " : " + isEnabled);
            if (isEnabled == true) {
              //console.log("connecting " + walletName);
              await connect(walletName);
              connected = true;
              break;
            }
          }
        }
      }
    }
    //console.log("detectWallet... end");
  };

  // nftio interaction
  const listInNftio = async (txHash) => {
    try {
      //console.log('rewardAddress: ', rewardAddress);
      //console.log('about to post: ', fingerprint, txHash, quantity);

      const formData = new URLSearchParams();
      formData.append('wAddr', rewardAddress);
      formData.append('fingerprint', fingerprint);
      formData.append('txHash', txHash);
      formData.append('price', quantity);

      const res = await fetch('https://nftio.io/listToSell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (res.ok) {
        //console.log('Post to Nftio successful');
        window.location.href = "https://nftio.io/asset/" + fingerprint;
      } else {
        console.error('[nftio] Error in post to Nftio:', res.statusText);
      }
    } catch (error) {
      console.error('[nftio] Network error during post to Nftio:', error.message);
    }
  };

  const delFromNftio = async () => {
    try {
      //console.log('about to send GET delFromNftio(): ', fingerprint );

      const url = "https://nftio.io/delFromMk/"+fingerprint;
      const res = await fetch(url, {
        method: 'GET',
      });

      if (res.ok) {
        //console.log('GET request to Nftio successful');
        //window.location.href = "https://nftio.io/asset/" + fingerprint;
      } else {
        console.error('[nftio] Error in GET:', res.statusText);
      }
    } catch (error) {
      console.error('[nftio] Network error during GET:', error.message);
    }
  };

  const getTxHashFromNftio = async () => {
    try {
      //console.log('about to send getTxHashFromNftio(): ', fingerprint);

      const url = "https://nftio.io/getTxFromMk/"+fingerprint;
      const res = await fetch(url, {
        method: 'GET',
      });

      if (res.ok) {
        const txHash = await res.text();
        //console.log('GET Tx from Nftio successful: ', txHash);
        return txHash;
      } else {
        console.error('[nftio] Error in GET Tx:', res.statusText);
      }
    } catch (error) {
      console.error('[nftio] Network error during GET Tx:', error.message);
    }
  };

  // action handlers

  const listAssetHandler = async (fingerprint, quantity) => {
    try {
      if (!wallet) {
        console.error("[nftio] Wallet is not connected");
        setActionStatus("Wallet is not connected");
        return;
      }else{
        const networkId = await wallet.getNetworkId();
        const networkName = networkId === 0 ? "Testnet" : networkId === 1 ? "Mainnet" : "Unknown";
        console.log("listAssetHandler, networkName is:", networkName);
        console.log("listAssetHandler, wallet is:", wallet);        
      }


      const assets = await wallet.getAssets();
      const asset = assets.find((asset) => asset.fingerprint === fingerprint);

      if (!asset) {
        console.error("[nftio] Asset with fingerprint not found");
        setActionStatus("Asset with fingerprint not found");
        return;
      }

      //const assetUnit = asset.unit;
      const quantityAsNumber = quantity ? Number(quantity) * 1000000 : null; // Convert quantity to lovelaces if provided

      if (!quantityAsNumber) {
        console.error("[nftio] Quantity is required for listing an asset");
        return;
      }

      const paymentAddress = await wallet.getChangeAddress(); // Get the wallet's payment address
      const deposit = 5000000; // fixed deposit amount in lovelaces
      const price = [{ policyId: "lovelace", assetName: asset.assetName, quantity: quantityAsNumber }];

      const txHash = await createSpotSale(wallet, [asset], paymentAddress, deposit, price);
      console.log("Asset listed with txHash: ", txHash);

      listInNftio(txHash); // Post to Nftio after listing
      setActionStatus("ok"); // Clear any previous error messages
    } catch (error) {
      const errorMessage = error?.message || "An unknown error occurred during the listing process.";
      console.error("[nftio] Error listing asset: ", error);
      setActionStatus(errorMessage); // Set the error message
    }
  };

  const unlistAssetHandler = async (fingerprint) =>
  {
    //console.log('unlistAssetHandler: ', fingerprint);

    if (!wallet) {
      console.error("[nftio] Wallet is not connected");
      setActionStatus("Wallet is not connected");
      return;
    }

    //console.log('wallet is: ', wallet);

    try
    {
      const txHash = await getTxHashFromNftio(fingerprint);
      //console.log("unlisting: ", txHash);

      // const utxo = await contract.getUtxoByTxHash(txHash);
      // if (!utxo) {
      //   console.error("[nftio] UTxO not found for transaction hash:", txHash);
      //   setActionStatus("UTxO not found for transaction hash:", txHash);
      //   return;
      // }
      console.log('About to unlist asset: ', txHash);
      // const tx = await contract.delistAsset(utxo);
      // const signedTx = await wallet.signTx(tx);
      // const txHashOut = await wallet.submitTx(signedTx);
      //console.log("Asset unlisted with txHash: ", txHash);
      delFromNftio(); // Send GET request to Nftio and redirect
      setActionStatus("ok");      
    }
    catch (error)
    {
      console.error("[nftio] Error unlisting asset: ", error);
      const errorMessage = error?.message || "An unknown error occurred during the unlisting process.";
      setActionStatus(errorMessage); // Set the error message
    }
  };

  const buyAssetHandler = async (fingerprint) => {
    try {
      if (!wallet) {
        console.error("[nftio] Wallet is not connected");
        setActionStatus("Wallet is not connected");
        return;
      }

      const txHash = await getTxHashFromNftio(fingerprint);
      //const utxo = await contract.getUtxoByTxHash(txHash);
      const utxo=''; // Placeholder for UTxO, replace with actual UTxO retrieval logic

      if (!utxo) {
        console.error("[nftio] UTxO not found for transaction hash:", txHash);
        setActionStatus(`UTxO not found for transaction hash: ${txHash}`);
        return;
      }

      const sellerAddress = utxo.address; // Seller's address from the UTxO
      const paymentAmount = utxo.assets.find((asset) => asset.unit === "lovelace").quantity; // Payment amount in lovelaces
      const buyerAddress = await wallet.getChangeAddress(); // Buyer's address

      const txHashOut = await buySpotSale(wallet, utxo, sellerAddress, paymentAmount, buyerAddress);
      console.log("Asset bought with txHash: ", txHashOut);

      delFromNftio(); // Send GET request to Nftio and redirect
      setActionStatus("ok"); // Clear any previous error messages
    } catch (error) {
      const errorMessage = error?.message || "An unknown error occurred during the buy process.";
      console.error("[nftio] Error buying asset: ", error);
      setActionStatus(errorMessage); // Set the error message
    }
  };



  // Check for existing wallet connection on page load
  useEffect(() => {
    detectWallet();
  }, [connected, wallet]);


  return (
    
    <div className="is-fullheight">
      <Head>
        <title>NFTI/O Marketplace</title>
        <meta name="description" content="NFTI/O" />
        <script
        dangerouslySetInnerHTML={{
          __html: scriptContent,
        }}
      />
      </Head>
      <nav className="navbar has-shadow">
        <div className="container">
          <div className="navbar-brand">
            <a className="navbar-item" href="https://nftio.io" aria-label="NFT Explorer & P2P Exchange">
              <span className="title is-size-3" style={{ color: '#3e8ed0' }}>NFTI/O</span>
            </a>
            <a className="navbar-item" href="https://nftio.io" aria-label="NFT Explorer & P2P Exchange">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 6 25 10" fill="none" stroke="#3e8ed0"
                strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" height="45">
                <path d="M2 12h5l2-3.5L11 12h7" />
                <path d="M22 12h-5l-2 3.5L13 12H6" />
              </svg>
            </a>
            <div className="navbar-item is-hidden-mobile" href="https://nftio.io" aria-label="NFT Explorer & P2P Exchange">
              <span className="title is-size-5" style={{ color: '#3e8ed0' }}>Explorer & P2P Exchange</span>
            </div>
            <div className="navbar-burger burger" data-target="navMenu"
              onClick={() => {
                document.querySelector('.navbar-menu').classList.toggle('is-active');
                document.querySelector('.navbar-burger').classList.toggle('is-active');
              }}>
              <span></span><span></span><span></span>
            </div>
          </div>
          <div className="navbar-menu" id="navMenu">
            <div className="navbar-end">
              <div className="navbar-item button is-outlined">
                <a style={{ color: '#3e8ed0' }} onClick={() => changeTheme('dark')}>Theme</a>
              </div>
              <div className="navbar-item button is-outlined" >
                <a style={{ color: '#3e8ed0' }} href="https://nftio.io/market">
                Market
                </a>
				      </div>
              <div className="navbar-item button is-outlined">
                  <a style={{ color: '#3e8ed0' }} href="https://nftio.io/wallet">
                  Wallet
                  </a>
              </div>
            </div>
          </div>
        </div>
        
      </nav>

      {connected ? (
        
        <main className="section">
          {(
              action === "list" ? <ListingPanel fingerprint={fingerprint} quantity={quantity} listAssetHandler={listAssetHandler} actionStatus={actionStatus} />          
            : action === "unlist" ? <UnlistingPanel fingerprint={fingerprint} unlistAssetHandler={unlistAssetHandler} actionStatus={actionStatus} />
            : action === "buy" ? <BuyingPanel fingerprint={fingerprint} quantity={quantity} buyAssetHandler={buyAssetHandler} actionStatus={actionStatus} />                  
            : <p>No fingerprint or action type provided</p>
          )}
        </main>
      ) : (
        <CardanoWallet />
      )}

      
    </div>
  );
}


function ListingPanel({ fingerprint, quantity, listAssetHandler, actionStatus }) {
  return (
    <div className="panel container box is-fullwidth is-fullheight is-info">
      <p className="panel-heading mb-4">Please confirm the listing by signing with your wallet:</p>
      <div className="columns is-mobile is-flex is-align-items-start">
        
        <div className="column is-3-desktop is-3-tablet is-half-mobile">
          <div className="card is-shady">
            <div className="box">
              <figure className="image is-square">
                <img src={`https://cdn.nftio.io/cdn/${fingerprint}.webp`} loading="lazy" style={{ borderRadius: "6px"}} />
              </figure>
            </div>
          </div>          
        </div>

        <div className="column is-half-mobile">
        <p>
        <span className="has-text-info is-size-5">Fees: 0.5% with a minimum of 1₳.</span>
          </p>
          <p>
          <span className="is-size-6">
          By listing the asset for sale, you will place it in the <a target='_blank' href='https://meshjs.dev/smart-contracts/marketplace'>MeshJs open-source marketplace smart contract</a>.
            When someone purchases it, the funds will be automatically sent to your wallet.
          </span>
          </p>
          <br />

          <p style={{ wordWrap: 'break-word' }}>
            NFT:&nbsp;&nbsp;&nbsp;
            <a style={{ color: "#3e8ed0" }} href={`https://nftio.io/asset/${fingerprint}`} target="_blank" rel="noopener noreferrer">{fingerprint}</a>
          </p>          
          <p>
            Price: ₳{quantity}
          </p>
          <p>
            Extra: ₳&#8771;2&nbsp; 
            <br />
            <span className="has-text-info is-size-7">
             Variable amount. To be returned when the NFT is purchased or unlisted.
             </span>
          </p>
          <br />
          
          {actionStatus === "" // no error, show the button
            ? <button type="button" className="button is-info" onClick={()=>listAssetHandler(fingerprint, quantity)}>List for Sale</button>
            : actionStatus === "ok" ? <div className="notification is-info is-light">Listing successful, your asset is deployed in the smart contract</div>
            : // errors
            <div>
              <div className="notification is-danger is-light">                
                Error: {actionStatus}
              </div>
              <div className="buttons are-small">
                You can <a className="button is-info" href="">Retry</a> the operation or go <a className="button is-warning" href={`https://nftio.io/asset/${fingerprint}`}>Back</a> to the asset details
              </div>    
            </div>
          }

        </div>
      </div>
    </div>
  );
}

function UnlistingPanel({ fingerprint, unlistAssetHandler, actionStatus }) {
  return (
    <div className="panel container box is-fullwidth is-fullheight">
      <p className="panel-heading mb-4">Please confirm the unlisting by signing with your wallet:</p>
      <div className="columns is-mobile is-flex is-align-items-start">
        
        <div className="column is-3-desktop is-3-tablet is-half-mobile">
          <div className="card is-shady">
            <div className="box">
              <figure className="image is-square">
                <img src={`https://cdn.nftio.io/cdn/${fingerprint}.webp`} loading="lazy" style={{ borderRadius: "6px"}} />
              </figure>
            </div>
          </div>          
        </div>

        <div className="column is-half-mobile">
        <p>
        <span className="has-text-info is-size-5">Fees: 0.5% with a minimum of 1₳.</span>
          </p>
          <p>
          <span className="is-size-6">
          By unlisting the asset, you will remove it from the <a target='_blank' href='https://meshjs.dev/smart-contracts/marketplace'>MeshJs open-source marketplace smart contract</a> 
            and return it to your wallet.
          </span>
          </p>
          <br />

          <p style={{ wordWrap: 'break-word' }}>
            Asset:&nbsp;
            <a style={{ color: "#3e8ed0" }} href={`https://nftio.io/asset/${fingerprint}`} target="_blank" rel="noopener noreferrer">{fingerprint}</a>
          </p>          
          <br />
          
          {actionStatus === "" // no error, show the button
            ? <button type="button" className="button is-primary" onClick={()=>unlistAssetHandler(fingerprint)}>Unlist</button>
            : actionStatus === "ok" ? <div className="notification is-info is-light">Unlisting successful</div>
            : // errors
            <div>
              <div className="notification is-danger is-light">                
                Error: {actionStatus}
              </div>
              <div className="buttons are-small">
                You can <a className="button is-info" href="">Retry</a> the operation or go <a className="button is-warning" href={`https://nftio.io/asset/${fingerprint}`}>Back</a> to the asset page
              </div>    
            </div>
          }

        </div>
      </div>
    </div>
  );
}

function BuyingPanel({ fingerprint, quantity, buyAssetHandler, actionStatus }) {
  return (
    <div className="panel container box is-fullwidth is-fullheight is-info">
      <p className="panel-heading mb-4">Please confirm the purchase by signing with your wallet:</p>
      <div className="columns is-mobile is-flex is-align-items-start">
        
        <div className="column is-3-desktop is-3-tablet is-half-mobile">
          <div className="card is-shady">
            <div className="box">
              <figure className="image is-square">
                <img src={`https://cdn.nftio.io/cdn/${fingerprint}.webp`} loading="lazy" style={{ borderRadius: "6px"}} />
              </figure>
            </div>
          </div>          
        </div>

        <div className="column is-half-mobile">
        <p>
        <span className="has-text-info is-size-5">Fees: 0.5% with a minimum of 1₳.</span>
          </p>
          <p>
          <span className="is-size-6">
          After purchasing this asset, listed in the <a target='_blank' href='https://meshjs.dev/smart-contracts/marketplace'>MeshJs open-source marketplace smart contract</a>, 
            it will be automatically sent to your wallet.
          </span>
          </p>
          <br />

          <p style={{ wordWrap: 'break-word' }}>
            Asset:&nbsp;
            <a style={{ color: "#3e8ed0" }} href={`https://nftio.io/asset/${fingerprint}`} target="_blank" rel="noopener noreferrer">{fingerprint}</a>
          </p>          
          <p>
            Price is set at: ₳{quantity}
          </p>
          <br />
          
          {actionStatus === "" // no error, show the button
            ? <button type="button" className="button is-info" onClick={()=>buyAssetHandler(fingerprint)}>Buy</button>
            : actionStatus === "ok" ? <div className="notification is-info is-light">Buy successful</div>
            : // errors
            <div>
              <div className="notification is-danger is-light">                
                Error: {actionStatus}
              </div>
              <div className="buttons are-small">
                You can <a className="button is-info" href="">Retry</a> the operation or go <a className="button is-warning" href={`https://nftio.io/asset/${fingerprint}`}>Back</a> to the asset page
              </div>    
            </div>
          }

        </div>
      </div>
    </div>
  );
}
