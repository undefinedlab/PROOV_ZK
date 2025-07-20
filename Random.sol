// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {CadenceRandomConsumer} from "@onflow/flow-sol-utils/src/random/CadenceRandomConsumer.sol";

contract RandomnessNTF is CadenceRandomConsumer {
    
    // Events
    event RandomNumberGenerated(uint64 randomNumber, uint64 min, uint64 max);
    event RandomItemSelected(string item, uint256 index);
    
    // Custom errors
    error EmptyItemArray();
    
    /**
     * @dev Generates a random number within a specified range
     * @param min The minimum value (inclusive)
     * @param max The maximum value (inclusive)
     * @return A random uint64 number between min and max
     */
    function getRandomNumber(uint64 min, uint64 max) 
        public 
        view 
        returns (uint64) 
    {
        return _getRevertibleRandomInRange(min, max);
    }
    
    /**
     * @dev Selects a random item from an array of strings
     * @param items The array of items to select from
     * @return memory The randomly selected item
     */
    function selectRandomItem(string[] calldata items) 
        public 
        view 
        returns (string memory) 
    {
        if (items.length == 0) {
            revert EmptyItemArray();
        }
        
        uint64 randomIndex = getRandomNumber(0, uint64(items.length - 1));
        return items[randomIndex];
    }
}