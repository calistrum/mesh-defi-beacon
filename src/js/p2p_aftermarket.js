// Import required MeshJS components
import { 
    BlockfrostProvider,
    MeshTxBuilder,
    bytesToHex,
    hexToBytes,
    stringToHex
} from '@meshsdk/core';

import {PlutusData,PlutusList,ConstrPlutusData,
    addrBech32ToPlutusDataHex, 
    scriptHashToBech32,
    CardanoSDKUtil,
    Address,
    buildBaseAddress,
} from '@meshsdk/core-cst';

import crypto from 'crypto';

const blockchainProvider = new BlockfrostProvider('preprodYGEhAAzZKRY21n2a98ED6oBZteeXco8p');

console.log('plutusData:', PlutusData); // Log the PlutusData object
// ===============================
// CONSTANTS
// ===============================

// Prefixes
const BEACON_POLICY_PREFIX = "00";  // Prefix for PolicyBeacon


// Script Hashes and References
const SCRIPT_HASHES = {
    PROXY: 'bdceb595b8754726b3efe3ab0f81c76cbda1a0a0d3653bb8fad89bb2',                  // Proxy script hash
    AFTERMARKET: 'e07ee8979776692ce3477b0c0d53b4c650ef6ccad75c2596da22847c',            // Aftermarket script hash
    AFTERMARKET_OBSERVER: '3e5528d9a7610aa5459a7deed9d3c1c2ee8b0310fae6642df4c37213',   // Aftermarket observer script hash
    BEACON: 'bdceb595b8754726b3efe3ab0f81c76cbda1a0a0d3653bb8fad89bb2'                  // Beacon script hash
};

// Script References
const SCRIPT_REFS = {
    TESTNET: {
      PROXY: {
        txHash: "6c402050892c8cb0e3e54f803d7ae292d6f5f90745b7f76722f7c303c7085d50",
        outputIndex: 0,
        size: 8131  // proxyScriptSize equivalent
      },
      BEACON: {
        txHash: "6c402050892c8cb0e3e54f803d7ae292d6f5f90745b7f76722f7c303c7085d50",
        outputIndex: 0,
        size: 8166  // beaconScriptSize equivalent
      },
      AFTERMARKET: {
        txHash: "e95a73a1e03afdf74b86d10e504b64285f7afdfab7f7021a41054ae4b377ca9f",
        outputIndex: 0,
        size: 4306  // aftermarketScriptSize equivalent
      },
      AFTERMARKET_OBSERVER: {
        txHash: "b6b5bd23fa762b2630dc9dedc10d0bac61d6ffa3617f451df8a8ee31a83c441f",
        outputIndex: 0,
        size: 9892  // aftermarketObserverScriptSize equivalent
      }
    },
    MAINNET: {
      // Add mainnet script references when available
    }
};

// Currency Symbols
const CURRENCY_SYMBOLS = {
    BEACON: 'bdceb595b8754726b3efe3ab0f81c76cbda1a0a0d3653bb8fad89bb2', // Beacon currency symbol
};

// Beacon Names
const BEACON_NAMES = {
    SPOT: 'Spot',
    AUCTION: 'Auction',
    BID: 'Bid'
};

// ===============================
// Helper Functions for Initialization
// ===============================
/**
 * Hashes a Uint8Array using SHA-256 with Node.js crypto module.
 * @param {Uint8Array} data The byte array to hash.
 * @returns {Uint8Array} The SHA-256 hash as a Uint8Array.
 */
function sha256Node(data) {
    // Node.js crypto works well with Buffers
    const bufferData = Buffer.from(data);
    const hash = crypto.createHash('sha256');
    hash.update(bufferData);
    // Return as a Buffer first, then convert to Uint8Array if needed
    const hashBuffer = hash.digest();
    return new Uint8Array(hashBuffer.buffer, hashBuffer.byteOffset, hashBuffer.byteLength);
}

/**
 * Get the script hash for a specific script type.
 * @param {string} scriptType - The type of the script (e.g., 'PROXY', 'AFTERMARKET').
 * @returns {string} - The script hash.
 */
function getScriptHash(scriptType) {
    if (!SCRIPT_HASHES[scriptType]) {
        throw new Error(`Script hash for ${scriptType} is not initialized.`);
    }
    return SCRIPT_HASHES[scriptType];
}

/**
 * Get the currency symbol for a specific type.
 * @param {string} symbolType - The type of the currency symbol (e.g., 'BEACON').
 * @returns {string} - The currency symbol.
 */
export function getCurrencySymbol(symbolType) {
    if (!CURRENCY_SYMBOLS[symbolType]) {
        throw new Error(`Currency symbol for ${symbolType} is not initialized.`);
    }
    return CURRENCY_SYMBOLS[symbolType];
}

/**
 * Get a script reference
 * @param {string} network - 'testnet' or 'mainnet'
 * @param {string} scriptHash - The script hash
 * @returns {object} - The UTxO reference and script size
 */
const getScriptRef = (network, scriptHash) => {
    console.log('getScriptRef() Network value:', network); // Log the network value

    const networkRefs = network.toLowerCase() === 'testnet' ? 
      SCRIPT_REFS.TESTNET : SCRIPT_REFS.MAINNET;
    
    let ref;
    if (scriptHash === SCRIPT_HASHES.PROXY) {
      ref = networkRefs.PROXY;
    } else if (scriptHash === SCRIPT_HASHES.BEACON) {
      ref = networkRefs.BEACON;
    } else if (scriptHash === SCRIPT_HASHES.AFTERMARKET) {
      ref = networkRefs.AFTERMARKET;
    } else if (scriptHash === SCRIPT_HASHES.AFTERMARKET_OBSERVER) {
      ref = networkRefs.AFTERMARKET_OBSERVER;
    } else {
      throw new Error(`Unknown script hash: ${scriptHash}`);
    }
    
    return {
      utxo: {
        txHash: ref.txHash,
        outputIndex: ref.outputIndex
      },
      size: ref.size
    };
};

/**
 * Generate a policy beacon from a policy ID.
 * @param {string} policyId - The policy ID.
 * @returns {string} - The generated policy beacon.
 */
export function genPolicyBeaconName(policyId) {
    // Convert "00" to byte array and concatenate with the policyId
    const prefixBytes = hexToBytes(BEACON_POLICY_PREFIX);
    const policyIdBytes = hexToBytes(policyId);
    const combined = Buffer.concat([Buffer.from(prefixBytes), Buffer.from(policyIdBytes)]);
    //const combined = concatBytes(prefixBytes, policyIdBytes);
    
    // Apply SHA-256 hash (equivalent to PlutusTx.sha2_256)
    //const hashed = sha256Hash(combined);
    const hashed = sha256Node(combined);
    
    // Convert hash to hex string for token name
    const tokenName = bytesToHex(hashed);
    
    return tokenName;
}

// ===============================
// Datums Classes
// ===============================

/**
 * The datum for a Spot UTxO sale for NFTs.
 */
class SpotDatum {
    constructor({
        beaconId,
        aftermarketObserverHash,
        nftPolicyId,
        nftNames,
        paymentAddress,
        saleDeposit,
        salePrice
    }) {
        // Basic validation (optional but recommended)
        if (!beaconId || !aftermarketObserverHash || !nftPolicyId || !nftNames || !paymentAddress || saleDeposit == null || salePrice == null) {
            throw new Error("Missing required fields for SpotDatum");
        }
        if (!Array.isArray(nftNames)) {
             throw new Error("nftNames must be an array");
        }

        this.beaconId = beaconId; // string (hex)
        this.aftermarketObserverHash = aftermarketObserverHash; // string (hex)
        this.nftPolicyId = nftPolicyId; // string (hex)
        this.nftNames = nftNames; // string[] (hex)
        this.paymentAddress = paymentAddress; // string (bech32) or Address object
        this.saleDeposit = saleDeposit; // number | bigint
        this.salePrice = salePrice; // number | bigint (or complex type depending on contract)

        console.log("SpotDatum constructed with:", {
             beaconId, aftermarketObserverHash, nftPolicyId, nftNames, paymentAddress, saleDeposit, salePrice
        });
    }

    /**
     * Convert to Plutus data
     */
    toPlutusData() {
        try {
            // 1. Convert primitive fields
            const beaconIdBytes = PlutusData.newBytes(Buffer.from(this.beaconId, "hex"));
            //const beaconIdBytes = Buffer.from(this.beaconId, "hex");
            const observerHashBytes = PlutusData.newBytes(Buffer.from(this.aftermarketObserverHash, "hex"));
            const nftPolicyIdBytes = PlutusData.newBytes(Buffer.from(this.nftPolicyId, "hex"));
            const saleDepositInt = PlutusData.newInteger(BigInt(this.saleDeposit));

            // 2. Convert list of names
            const nftNamesList = new PlutusList();
            this.nftNames.forEach(name => {
                const nameBytes = PlutusData.newBytes(Buffer.from(name, "hex"));
                // *** ADD THIS CHECK ***
                if (!nameBytes || typeof nameBytes.toCbor !== 'function') {
                    console.error(`!!! Invalid PlutusData created for NFT name "${name}":`, nameBytes);
                    throw new Error(`Invalid PlutusData created for NFT name: ${name}`);
                }
                nftNamesList.add(nameBytes);
            });
            
            // Also check the result of PlutusData.newList
            const nftNamesPlutus = PlutusData.newList(nftNamesList);
            if (!nftNamesPlutus || typeof nftNamesPlutus.toCbor !== 'function') {
                console.error("!!! Invalid PlutusData object created for NFT names list wrapper:", nftNamesPlutus);
                throw new Error("Failed to create valid PlutusData list wrapper for NFT names.");
            }
            // 3. Convert complex fields using helpers
            // const paymentAddressPlutus = addressToPlutusData(this.paymentAddress);
            // const paymentAddressObj = addrBech32ToPlutusDataObj(this.paymentAddress);
            // const paymentAddressPlutus = new PlutusList(); // Uses the helper
            // paymentAddressObj.fields.forEach(field => {
            //     const fieldBytes = PlutusData.newBytes(Buffer.from(field.fields[0].bytes, "hex"));
            //     // *** ENSURE THIS CHECK IS ACTIVE ***
            //     if (!fieldBytes || typeof fieldBytes.toCbor !== 'function') {
            //         console.error(`!!! Field "${field}" is not a valid PlutusData object (lacks .toCbor):`, fieldBytes);
            //         throw new Error(`Invalid PlutusData field created for payment address: ${field}`);
            //     }
            //     paymentAddressPlutus.add(fieldBytes);
            // });
            const paymentAddressPlutusHex = addrBech32ToPlutusDataHex(this.paymentAddress); // Convert to hex string
            const paymentAddressPlutus = PlutusData.fromCbor(CardanoSDKUtil.HexBlob(paymentAddressPlutusHex)); // Convert hex string to PlutusData
            const salePricePlutus = pricesToPlutusData(this.salePrice); // Uses the helper
            //const salePricePlutus = toPlutusData([0,this.salePrice]); // Uses the helper
            
            // 4. Construct the final PlutusData object
             // Create an array containing the PlutusData representations of all fields IN ORDER
            const fieldsBytes = [
                beaconIdBytes,
                observerHashBytes,
                nftPolicyIdBytes,
                nftNamesPlutus,
                paymentAddressPlutus,
                saleDepositInt,
                salePricePlutus
            ];

            // Create the PlutusList for the fields by iterating through the array
            const plutusFieldsList = new PlutusList();
            fieldsBytes.forEach((field, index) => {
                // *** ENSURE THIS CHECK IS ACTIVE ***
                if (!field || typeof field.toCbor !== 'function') {
                     console.error(`!!! Field at index ${index} is not a valid PlutusData object (lacks .toCbor):`, field);
                     // Log the kind if possible to help identify it
                     if (field && typeof field.kind === 'function') {
                         console.error(`    Field kind: ${field.kind()}`);
                     }
                     throw new Error(`Invalid PlutusData field created at index ${index}`);
                }
                // Optional: Log successful check
                // console.log(`Field at index ${index} is valid PlutusData with kind: ${field.kind()}`);
                plutusFieldsList.add(field);
            });
            

            // Create the ConstrPlutusData using the constructor index (0)
            // and the PlutusList containing the field data.
            // Most Mesh/CSL versions expect the index and the list directly here.
            const constrPlutusData = PlutusData.newConstrPlutusData(
                new ConstrPlutusData(
                BigInt(0), // Constructor index for your SpotDatum type
                 plutusFieldsList)
            );
            //  // You might want to log constrPlutusData.to_cbor() or similar for debugging
            //console.log("CBOR:", constrPlutusData.to_cbor());

            return constrPlutusData;
            

        } catch (error) {
            console.error("Error in SpotDatum.toPlutusData:", error);
            // Optionally re-throw or return null/undefined depending on error handling strategy
            throw error;
        }
    }   /**
     * Convert from Plutus data
     */
    static fromPlutusData(data) {
        if (data.index !== 0) throw new Error('Invalid SpotDatum data');
        
        return new SpotDatum({
            beaconId: data.fields[0].bytes,
            aftermarketObserverHash: data.fields[1].bytes,
            nftPolicyId: data.fields[2].bytes,
            nftNames: data.fields[3].list.map(item => item.bytes),
            paymentAddress: plutusDataToAddress(data.fields[4]),
            saleDeposit: data.fields[5].int,
            salePrice: plutusDataToPrices(data.fields[6])
        });
    }
}



// ===============================
// Redeemer Classes
// ===============================

/**
 * Beacons Redeemer for the beacon minting script
 */
class BeaconsRedeemer {
    static CreateCloseOrUpdateMarketUTxOs() {
        const plutusEmptyList = new PlutusList();
        return PlutusData.newConstrPlutusData(
            new ConstrPlutusData(
            BigInt(0), plutusEmptyList
        ));
    }
    
}

// ===============================
// Helper Functions
// ===============================

/**
 * Create a spot datum from components
 */
function createSpotDatum(nfts, paymentAddress, deposit, price) {
    if (!nfts || nfts.length === 0) {
        throw new Error('NFTs array cannot be empty');
    }

    const nftPolicyId = nfts[0].policyId;
    const nftNames = nfts.map(nft => nft.assetName);

    return new SpotDatum({
        beaconId: getCurrencySymbol('BEACON'),
        aftermarketObserverHash: getScriptHash('AFTERMARKET_OBSERVER'),
        nftPolicyId: nftPolicyId,
        nftNames: nftNames,
        paymentAddress: paymentAddress,
        saleDeposit: BigInt(deposit),
        salePrice: price.map(asset => ({
            alternative:0, //for PlutusData constructor
            currencySymbol: asset.policyId,
            tokenName: asset.assetName,
            amount: BigInt(asset.quantity)
        }))
    });
}


// ===============================
// Protocol Address Functions
// ===============================
/**
 * Generate a seller address for a stake credential
 * @param {string} networkName - 'testnet' or 'mainnet'
 * @param {string} rewardAddress - The seller's reward address (Bech32 format)
 * @returns {string} - The generated smart contract address (Bech32 format)
 */
function genSellerAddress(networkName, rewardAddress) {
    const scriptHash = getScriptHash('AFTERMARKET'); // Get the AFTERMARKET script hash

    // Convert network to networkId (0 for testnet, 1 for mainnet)
    const networkId = networkName.toLowerCase() === 'testnet' ? 0 : 1;
  
    // Extract the staking key hash from the reward address
    const stakingAddress = Address.fromBech32(rewardAddress);
    const stakeKeyHash = stakingAddress.asReward().getPaymentCredential().hash;
    // Create a Base Address with the script hash as the payment credential
    //const paymentCredential = StakeCredential.from_scripthash(Buffer.from(scriptHash, 'hex'));

    const baseAddress = buildBaseAddress(networkId, scriptHash,stakeKeyHash);

    // Return the Bech32-encoded address
    return baseAddress.toAddress().toBech32();
}


// ===============================
// Utility Functions for PlutusData
// ===============================

/**
 * Convert a Prices structure to PlutusData
 */
function pricesToPlutusData(prices) { // prices should be an array: [{ currencySymbol: "hex", tokenName: "string", amount: number|bigint }, ...]
    if (!Array.isArray(prices)) {
        throw new Error("pricesToPlutusData: Input must be an array.");
    }

    // 1. Create the PlutusList to hold the individual price structures
    const priceList = new PlutusList(); // Use Mesh/CSL constructor

    // 2. Iterate through the input prices and build the inner ConstrPlutusData for each
    prices.forEach((price, index) => {
        try {
            // Prepare inner fields for one price: [Bytes, Bytes, Integer]
            const currencySymbolBytes = PlutusData.newBytes(Buffer.from(price.currencySymbol, "hex"));
            // Use default UTF-8 for token name unless hex is explicitly required by contract
            const tokenNameBytes = PlutusData.newBytes(Buffer.from(price.tokenName));
            const amountInt = PlutusData.newInteger(BigInt(price.amount));

            // --- Optional: Add validation checks for each PlutusData element ---
            if (!currencySymbolBytes || typeof currencySymbolBytes.toCbor !== 'function') throw new Error(`Invalid currencySymbolBytes at index ${index}`);
            if (!tokenNameBytes || typeof tokenNameBytes.toCbor !== 'function') throw new Error(`Invalid tokenNameBytes at index ${index}`);
            if (!amountInt || typeof amountInt.toCbor !== 'function') throw new Error(`Invalid amountInt at index ${index}`);
            // --- End validation ---

            const innerFields = new PlutusList();
            innerFields.add(currencySymbolBytes);
            innerFields.add(tokenNameBytes);
            innerFields.add(amountInt);

            // Create the inner ConstrPlutusData for this price (Constr 0 [Bytes, Bytes, Integer])
            const innerPriceData = PlutusData.newConstrPlutusData(
                new ConstrPlutusData(
                BigInt(0), // Use BigInt literal 0n
                innerFields
            ));
            // --- Optional: Validation ---
             if (!innerPriceData || typeof innerPriceData.toCbor !== 'function') throw new Error(`Invalid innerPriceData at index ${index}`);
            // --- End validation ---


            // Add the valid inner price structure to the main list
            priceList.add(innerPriceData);

        } catch (error) {
            console.error(`Error processing price at index ${index}:`, price);
            throw new Error(`Failed to process price at index ${index}: ${error.message}`);
        }
    });

    const finalPricesPlutusData = PlutusData.newConstrPlutusData(
        new ConstrPlutusData(
            BigInt(0),
        priceList // Pass the PlutusList containing the PlutusData list wrapper
    ));

     // --- Optional: Final Validation ---
     if (!finalPricesPlutusData || typeof finalPricesPlutusData.toCbor !== 'function') {
          console.error("!!! pricesToPlutusData: Final PlutusData object is invalid:", finalPricesPlutusData);
          throw new Error("pricesToPlutusData failed to create a valid final PlutusData object.");
     }
     // console.log("pricesToPlutusData: Successfully created final PlutusData:", finalPlutusData);
     // --- End Validation ---

    return finalPricesPlutusData;
}

/**
 * Convert PlutusData to a Prices structure
 */
function plutusDataToPrices(data) {
    if (data.index !== 0 || !data.fields[0].list) {
        throw new Error('Invalid Prices data');
    }

    return data.fields[0].list.map(item => ({
        currencySymbol: item.fields[0].bytes,
        tokenName: item.fields[1].bytes,
        amount: item.fields[2].int
    }));
}


/**
 * Convert PlutusData to an Address
 */
function plutusDataToAddress(data) {
    if (data.index !== 0) {
        throw new Error('Invalid Address data');
    }

    const paymentCredential = plutusDataToCredential(data.fields[0]);

    let stakeCredential = null;
    if (data.fields[1].index === 1) {
        stakeCredential = plutusDataToCredential(data.fields[1].fields[0].fields[0]);
    }

    return {
        paymentCredential,
        stakeCredential
    };
}



/**
 * Convert PlutusData to a Credential
 */
function plutusDataToCredential(data) {
    if (data.index === 0) {
        return {
            type: 'pubkey',
            hash: data.fields[0].bytes
        };
    } else if (data.index === 1) {
        return {
            type: 'script',
            hash: data.fields[0].bytes
        };
    }
    throw new Error('Invalid Credential data');
}


// ===============================
// Transaction Building Functions
// ===============================

/**
 * Create a Spot UTxO for selling NFTs
 */
export async function createSpotSale(wallet, nfts, paymentAddress, deposit, price) {
    try {
        const networkId = await wallet.getNetworkId();
        const networkName = networkId === 0 ? "Testnet" : networkId === 1 ? "Mainnet" : "Unknown";
        console.log('createSpotSale() Network ID:', networkId);
        console.log('createSpotSale() Network Name:', networkName);

        // 1. Create the spot datum
        // Ensure createSpotDatum returns an object with a method like .toPlutusData()
        // that produces the PlutusData structure Mesh expects.
        const spotDatum = createSpotDatum(nfts, paymentAddress, deposit, price);
        // The value passed to txOutInlineDatumValue should be the actual PlutusData structure/object/string
        const datumValue = spotDatum.toPlutusData(); // Adjust if your function returns something different
        console.log('Spot Datum (PlutusData) to cbor:', datumValue.toCbor());

        
        // 2. Build the transaction using MeshTxBuilder
        const meshTxBuilder = new MeshTxBuilder({
            initiator: wallet,
            fetcher: blockchainProvider, // Ensure provider is configured
            submitter: blockchainProvider, // Ensure provider is configured
            verbose: true // Optional: for debugging
            // signer: wallet, // Initiator usually implies signer
        });
        meshTxBuilder.spendingPlutusScriptV2(); // Ensure this is the correct method for your use case
        console.log('MeshTxBuilder initialized');       

        
        // 3. Prepare assets for the output UTxO
        // Calculate policy ID from the script (Mesh can sometimes do this, or use a helper)
        const beaconPolicyId = getCurrencySymbol('BEACON'); // Ensure this returns the correct Policy ID
        const policyBeaconName = genPolicyBeaconName(nfts[0].policyId); // Ensure names are correctly hex-encoded if needed
        console.log('NFT:', nfts[0].assetName);
        const assets = [
            { unit: 'lovelace', quantity: deposit.toString() },
            ...nfts.map((nft) => ({
                unit: nft.policyId + nft.assetName, // Ensure assetName is hex encoded if needed
                quantity: '1',
            })),
            // Add the newly minted assets to the output
            { unit: beaconPolicyId + policyBeaconName, quantity: '1' },
            { unit: beaconPolicyId + stringToHex(BEACON_NAMES.SPOT), quantity: '1' },
        ];
        console.log('Output Assets:', assets);
        
       

        // 4. Add the Output UTxO with Inline Datum
        const addresses = await wallet.getRewardAddresses();
        const rewardAddress = addresses[0];
        const sellerAddress = genSellerAddress(networkName, rewardAddress); 
        console.log('Seller Address):', sellerAddress);
        meshTxBuilder
            .txOut(sellerAddress, assets)
            .txOutInlineDatumValue(datumValue.toCbor(),"CBOR"); // Pass the PlutusData value here
            //.txOutInlineDatumValue(spotDatum); // Pass the PlutusData value here

        
        // 5. Get the beacon script reference for minting
        // For mintingScript, you need the actual script CBOR, not just the reference UTxO.
        // Let's assume getScriptRef returns an object with { cborHex: '...', scriptHash: '...' }
        
        const beaconScriptDetails = getScriptRef(networkName, SCRIPT_HASHES.BEACON);
        if (!beaconScriptDetails) {
             throw new Error(`Beacon script CBOR Hex not found for ${networkName}`);
        }
        const beaconRedeemerAddress = scriptHashToBech32( SCRIPT_HASHES.BEACON);
        console.log('Beacon Redeemer Address:', beaconRedeemerAddress);
        
        //const beaconRedeemerScript = ForgeScript.withOneSignature(beaconRedeemerAddress);      

        // 6. Add Minting Actions

        meshTxBuilder.mintPlutusScriptV2();
        meshTxBuilder.mint("1", beaconPolicyId, policyBeaconName);
        meshTxBuilder.mintTxInReference(beaconScriptDetails.utxo.txHash, beaconScriptDetails.utxo.outputIndex, beaconScriptDetails.size);
        //meshTxBuilder.mintingScript(beaconRedeemerScript); // Ensure this is the correct method for your use case
        //meshTxBuilder.mintRedeemerValue(beaconRedeemerScript); // Pass the PlutusData value here
        const beaconRedeemer = BeaconsRedeemer.CreateCloseOrUpdateMarketUTxOs();
        meshTxBuilder.mintRedeemerValue(beaconRedeemer.toCbor(),"CBOR"); // Pass the PlutusData value here

        meshTxBuilder.mintPlutusScriptV2();
        meshTxBuilder.mint("1", beaconPolicyId, stringToHex(BEACON_NAMES.SPOT));
        meshTxBuilder.mintTxInReference(beaconScriptDetails.utxo.txHash, beaconScriptDetails.utxo.outputIndex, beaconScriptDetails.size); // Pass the reference UTxO here
        //meshTxBuilder.mintingScript(beaconRedeemerScript); // Ensure this is the correct method for your use case
        meshTxBuilder.mintRedeemerValue(beaconRedeemer.toCbor(),"CBOR"); // Pass the same redeemer


        // 7. Set Change Address (Crucial!)
        const changeAddress = paymentAddress;
        if (!changeAddress) {
            throw new Error("Could not get change address from wallet.");
        }
        meshTxBuilder.changeAddress(changeAddress);
        console.log('Change Address set:', changeAddress);

        // 8. Set Collateral (Often needed for Plutus scripts)
        // Let complete() try to find collateral first. If it fails, you might need to add it explicitly.

        const collateral = await wallet.getCollateral();
        if (!collateral || collateral.length === 0) {
            console.warn("No collateral found in wallet. Transaction might fail if script execution occurs.");
            // For Plutus V2 minting, collateral IS required.
            // Throw error or handle appropriately if collateral is mandatory for your use case.
             throw new Error("Collateral is required for this transaction but none was found.");
        } else {
             // Let complete() handle it implicitly by default.
             // If needed explicitly: meshTxBuilder.collateral(collateral[0].input.txHash, collateral[0].input.outputIndex);
             // Or: meshTxBuilder.txInCollateral(collateral[0].input.txHash, collateral[0].input.outputIndex);
             console.log("Collateral available, letting Mesh handle selection.");
        }
          //set collateral
          meshTxBuilder.txInCollateral(
            collateral[0].input.txHash,
            collateral[0].input.outputIndex,
            collateral[0].output.amount,
            collateral[0].output.address,
          );

        //9. Debugging: Check UTxOs in the wallet
        try {
            const availableUtxos = await wallet.getUtxos();
            //const largestUtxosFirst = await largestFirst(500000,availableUtxos, true);
            console.log(`Available UTxOs for selection (${availableUtxos.length}):`, JSON.stringify(availableUtxos.map(u => ({
                txHash: u.input.txHash,
                outputIndex: u.input.outputIndex,
                amount: u.output.amount
            }))));
            const totalBalance = availableUtxos.reduce((acc, utxo) => {
                utxo.output.amount.forEach(asset => {
                    acc[asset.unit] = (acc[asset.unit] || 0) + parseInt(asset.quantity);
                });
                return acc;
            }, {});
             console.log('Total Wallet Balance from UTxOs:', totalBalance);
             if (!totalBalance.lovelace || totalBalance.lovelace < 5000000) { // Example check for ~5 ADA
                 console.warn("WARNING: Low ADA balance detected in wallet UTxOs. This is likely the cause of the 'Insufficient Balance' error.");
             }
             meshTxBuilder.selectUtxosFrom(availableUtxos); // Select UTxOs for the transaction
        } catch (err) {
            console.error("Error fetching wallet UTxOs for debugging:", err);
        }


        // // 10. Fees
        const estimatedFee = await meshTxBuilder.calculateFee();
        console.log("Estimated Fee (before signing):", estimatedFee);

         // Add extra buffer to the fee
        const extraFeeBuffer = 1000000n; 
        const totalFee = estimatedFee + extraFeeBuffer;
        console.log("Total Fee (with buffer):", totalFee.toString());

        // Set the fee in the transaction builder
        meshTxBuilder.setFee(totalFee.toString()); // Ensure the fee is set as a string



        // 11. Complete, Sign, and Submit using the *wallet* instance
        console.log("Completing transaction...");
        // complete() builds the transaction body, selects inputs, calculates fees, adds collateral if needed/found.
        const unsignedTxCbor = await meshTxBuilder.complete();
        console.log("Transaction completed (unsigned CBOR):", unsignedTxCbor);

        console.log("Signing transaction...");
        // Use the wallet instance to sign the unsigned transaction CBOR
        const signedTxCbor = await wallet.signTx(unsignedTxCbor, true); 
        console.log("Transaction signed (signed CBOR):", signedTxCbor);

        console.log("Submitting transaction...");
        // Use the wallet instance to submit the signed transaction CBOR
        const txHash = await wallet.submitTx(signedTxCbor);
        console.log('Transaction submitted successfully! TxHash:', txHash);

        return txHash;

    } catch (error) {
        // Provide more context in error logs
        console.error('Error creating Spot Sale:');
        if (error instanceof Error) {
            console.error('Message:', error.message);
            // Mesh errors often have an 'info' property with more details
            if (error.info) {
                console.error('Details:', error.info);
            }
            console.error('Stack:', error.stack);
        } else {
            console.error(error);
        }
        throw error; // Re-throw the error for upstream handling
    }
}
