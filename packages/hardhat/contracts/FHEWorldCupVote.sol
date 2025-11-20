// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHEWorldCupVote
 * @dev Allows encrypted predictions for which nation will win the 2026 World Cup.
 *      The contract never sees plaintext; each participant provides exactly one
 *      encrypted team ID unless they manually reset their selection.
 */
contract FHEWorldCupVote is SepoliaConfig {
    // Internal encrypted predictions
    mapping(address => euint32) private _sealedTeamSelection;

    // Track submission status
    mapping(address => bool) private _submitted;

    /**
     * @notice Submit your encrypted prediction.
     */
    function recordEncryptedGuess(externalEuint32 encryptedInput, bytes calldata validationProof) external {
        require(!_submitted[msg.sender], "You already submitted");

        euint32 processedCipher = FHE.fromExternal(encryptedInput, validationProof);

        _sealedTeamSelection[msg.sender] = processedCipher;
        _submitted[msg.sender] = true;

        // Assign decrypt rights
        FHE.allow(processedCipher, msg.sender);
        FHE.allowThis(processedCipher);
    }

    /**
     * @notice Return true if an address already registered a prediction.
     */
    function isRegistered(address wallet) external view returns (bool) {
        return _submitted[wallet];
    }

    /**
     * @notice Get the encrypted guess of an address.
     */
    function readEncryptedGuess(address wallet) external view returns (euint32) {
        return _sealedTeamSelection[wallet];
    }

    /**
     * @notice Check if this wallet is allowed to submit a new prediction.
     * @dev More flexible than checking only submission status, may expand later.
     */
    function canSubmit(address wallet) external view returns (bool) {
        return !_submitted[wallet];
    }

    /**
     * @notice Re-grant decrypt access to the user for their encrypted guess.
     * @dev Useful if frontend lost local decryption key permissions during session.
     */
    function grantSelfAccessAgain() external {
        require(_submitted[msg.sender], "No prediction exists");

        // Re-assign decrypt rights
        FHE.allow(_sealedTeamSelection[msg.sender], msg.sender);
    }
}
