// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TwoPlayerGame {
    address public owner;
    uint256 public platformFeePercent = 5; // 5% platform fee
    address public player1;
    address public player2;
    uint256 public entryAmount; // Amount entered by Player 1
    bool public gameStarted;
    uint256 public totalStaked; // Total staked amount in the contract
    uint256 public gameStartTime;
    uint256 public gameTimeout = 1 hours; // Timeout to reset game

    address public markedWinner;
    bool public isMarkedWinner;

    event PlayerRegistered(address indexed player, uint256 amount);
    event WinnerDeclared(address indexed winner, uint256 amount);
    event WinnerAuthorizationGranted(address indexed player);
    event GameReset();

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this");
        _;
    }

    modifier onlyWhenGameNotStarted() {
        require(!gameStarted, "Game already started");
        _;
    }

    modifier onlyWhenGameStarted() {
        require(gameStarted, "Game not started yet");
        _;
    }

    modifier onlyPlayer() {
        require(msg.sender == player1 || msg.sender == player2, "Not a registered player");
        _;
    }

    // Register players
    function register() public payable onlyWhenGameNotStarted {
        require(msg.value > 0 && msg.value < 10 ether, "Amount must be between 0 and 10 ETH");

        if (player1 == address(0)) {
            player1 = msg.sender;
            entryAmount = msg.value;
            totalStaked += msg.value;
            emit PlayerRegistered(msg.sender, msg.value);
        } else if (player2 == address(0)) {
            require(msg.value == entryAmount, "Player 2 must match Player 1's entry");
            player2 = msg.sender;
            totalStaked += msg.value;
            gameStarted = true;
            gameStartTime = block.timestamp;
            emit PlayerRegistered(msg.sender, msg.value);
        } else {
            revert("Game is full");
        }
    }

    // Player marks themselves as potential winner
    function markMeAsWinner() public onlyPlayer onlyWhenGameStarted {
        markedWinner = msg.sender;
        isMarkedWinner = true;
        emit WinnerAuthorizationGranted(msg.sender);
    }

    // Declare winner — only owner or marked player can call
    function declareWinner() public onlyWhenGameStarted {
        address winner;

        if (msg.sender == owner) {
            require(markedWinner != address(0), "No marked winner set");
            winner = markedWinner;
        } else if (msg.sender == markedWinner && isMarkedWinner) {
            winner = msg.sender;
        } else {
            revert("Not authorized to declare winner");
        }

        require(winner == player1 || winner == player2, "Invalid winner address");

        uint256 platformFee = (totalStaked * platformFeePercent) / 100;
        uint256 winnerAmount = totalStaked - platformFee;

        payable(owner).transfer(platformFee);
        payable(winner).transfer(winnerAmount);

        emit WinnerDeclared(winner, winnerAmount);
        resetGame();
    }

    // Internal function to reset game state
    function resetGame() internal {
        player1 = address(0);
        player2 = address(0);
        entryAmount = 0;
        gameStarted = false;
        gameStartTime = 0;
        totalStaked = 0;
        markedWinner = address(0);
        isMarkedWinner = false;

        emit GameReset();
    }

    // Force reset game if no winner declared in time
    function forceResetGame() public onlyOwner {
        require(gameStarted, "Game has not started");
        require(block.timestamp >= gameStartTime + gameTimeout, "Timeout not reached");

        if (player1 != address(0)) {
            payable(player1).transfer(entryAmount);
        }
        if (player2 != address(0)) {
            payable(player2).transfer(entryAmount);
        }

        resetGame();
    }

    receive() external payable {}
    fallback() external payable {}
}
 