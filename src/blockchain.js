/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message` 
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *  
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
     async initializeChain() {
        if( this.height === -1){
            let block = new BlockClass.Block({data: 'Genesis Block'});
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
     getChainHeight() {
        return new Promise((resolve, reject) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block 
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to 
     * create the `block hash` and push the block into the chain array. Don't for get 
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention 
     * that this method is a private method. 
     */
    _addBlock(block) {
        let self = this;

        return new Promise(async (resolve, reject) => {

            let valid = await self.validateChain()

            if(!valid) {
                reject(Error("Block chain not valid"));
            }

            // add time and height to the new block
            block.time = new Date().getTime().toString().slice(0,-3);
            block.height = self.chain.length;
            
            // create new hash for the new block
            let newHash = SHA256(JSON.stringify(block)).toString();

            if(newHash) {
                block.hash = newHash;

                // get prevous block hash
                if(self.chain.length > 0) {
                    block.previousBlockHash = self._getLatestBlock().hash;
                }

                // add to the chain
                this.chain.push(block);
                this.height = this.chain.length;

                // all good
                resolve(block);
            } 
            else {
                reject(Error("Failed to add new block:"));
            }
        });
    }

    _getLatestBlock() {
        const blockCount = this.chain.length;

        if (blockCount > 0) {
            return this.chain[blockCount-1];
        }
        return null;
    }

    getAllBlocks() {
        let self = this;

        return new Promise((resolve) => {
            resolve(self.chain);
        });
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address 
     */
    requestMessageOwnershipVerification(address) {
        return new Promise((resolve) => {
            // create time stamp text in seconds
            const timeText = new Date().getTime().toString().slice(0,-3);
            // merge wallet address
            const message = address + ":" + timeText +  ":starRegistry";
            resolve(message)
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address 
     * @param {*} message 
     * @param {*} signature 
     * @param {*} star 
     */
    submitStar(address, message, signature, star) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            // get time text from the message, in seconds
            const messageTime = parseInt(message.split(':')[1]);
            // current timestamp in seconds
            let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));

            // check if the message created within 5 minutes
            if (currentTime >= (messageTime + 5*60)) {
                reject(Error("Message Expired"));
            }

            try {
                // validate with bitcoin service
                // this may throws errors
                const isValid = bitcoinMessage.verify(message, address, signature)
                if(isValid == false) {
                    reject(Error("Failed message validation."));
                }
                
                // create a new block and add to the chain
                const block = new BlockClass.Block({owner: address, star: star });
                let newBlock = await self._addBlock(block)

                // all good
                resolve(newBlock);

            } catch(error) {
                reject(error);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash 
     */
    getBlockByHash(hash) {
        let self = this;
        return new Promise((resolve, reject) => {
            // find the blcok by the hash
            const result = self.chain.filter(block => block.hash === hash);
            resolve(result);
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object 
     * with the height equal to the parameter `height`
     * @param {*} height 
     */
    getBlockByHeight(height) {

        let self = this;
        return new Promise((resolve, reject) => {
            // find the block by index
            let block = self.chain.find(p => p.height === height);
            if(block){
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain 
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address 
     */
    async getStarsByWalletAddress (address) {
        let self = this;
        let stars = [];
        return new Promise((resolve, reject) => {
            var star = {};

            // loop through all blocks
            self.chain.forEach ( oneBlock => {
                try {
                    // decoded version of the current block data
                    let decodedBody = oneBlock.getBData();
                    // compare the wallet address
                    if(decodedBody.owner === address) {
                        stars.push(decodedBody);
                    }
                } catch(error) {
                    reject(error);
                }
            });
            resolve(stars);
        });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
        let self = this;
        let errorLog = [];

        return new Promise(async (resolve, reject) => {

            if(self.chain.length === 0) {
                resolve(true);
            }
            else if(self.chain.length === 1) {
                if(!self.chain[0].validate()) {
                    errorLog.push("Block 0 validation failed.");
                }
            }
            else {
                // loop through all the blocks
                for (let i = 1; i < self.chain.length; i++) { 
                    let previousBlock = self.chain[i-1];
                    let currentBlock = self.chain[i];

                    // validate the current block
                    if(!currentBlock.validate()) {
                        errorLog.push("Block " + i.toString() +  " validation failed.");
                    }
                    // compare with the previous block hash
                    if(currentBlock.previousBlockHash !== previousBlock.hash) {
                        errorLog.push("Block " + i.toString() + " previous hash invalid!");
                    }
                }
            }
            // no errors
            if(errorLog.length == 0) {
                resolve(true);
            } 
            // at least one error
            else {
                reject(errorLog);
            }
        });
    }

}

module.exports.Blockchain = Blockchain;   