import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import Web3 from "web3";
import { ethers } from "ethers";
import "../src/App.css";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "./contractConfig";

// Connect to your socket server
const socket = io("http://localhost:4000");

function App() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [playerNumber, setPlayerNumber] = useState(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [gameReady, setGameReady] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(false); // New state for Play button
  const [cards, setCards] = useState([]);
  const [scores, setScores] = useState([0, 0]);
  const [turn, setTurn] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [contract, setContract] = useState(null);
  const [readyToFinalize, setReadyToFinalize] = useState(false);


  useEffect(() => {
    const initializeContract = async () => {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contractInstance = new ethers.Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          signer
        );
        setContract(contractInstance);
      } else {
        alert("MetaMask not detected. Please install MetaMask!");
      }
    };

    initializeContract();

    // Socket event listeners
    socket.on("player-info", (number) => setPlayerNumber(number));
    socket.on("wallet-connected", (wallets) => {
      if (walletAddress && wallets.includes(walletAddress)) {
        alert("This wallet is already connected. Choose a different one.");
      }
    });
    socket.on("show-play-button", () => {
      console.log("Play button should be shown.");
      setShowPlayButton(true); // Update your state to show the play button
    });
    socket.on("start-game", ({ cards, turn }) => {
      setCards(cards);
      setTurn(turn);
      setGameReady(true);
    });
    socket.on("update-board", (updatedCards) => setCards(updatedCards));
    socket.on("update-scores", (updatedScores) => setScores(updatedScores));
    socket.on("change-turn", (nextTurn) => setTurn(nextTurn));
    socket.on("game-over", ({ finalScores, winner }) => {
      setScores(finalScores || [0, 0]);
      setWinner(winner);
      setGameOver(true);
    });
    socket.on("player-left", () => alert("Other player left the game."));
  }, [walletAddress]);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        if (accounts[0] === walletAddress) {
          alert("This wallet is already connected.");
        } else {
          setWalletAddress(accounts[0]);
          socket.emit("connect-wallet", accounts[0]);
        }
      } catch (err) {
        console.error("Wallet connection failed:", err);
      }
    } else {
      alert("MetaMask not detected. Please install MetaMask!");
    }
  };

  const register = async () => {
    if (!stakeAmount || isNaN(stakeAmount) || stakeAmount <= 0) {
      alert("Enter a valid staking amount.");
      return;
    }
    try {
      if (contract) {
        const tx = await contract.register({
          value: ethers.parseEther(stakeAmount),
        });
        await tx.wait();
        setShowPlayButton(true); // Show the Play button after registration
        socket.emit("register", { stakeAmount });
      } else {
        alert("Contract not initialized.");
      }
    } catch (error) {
      console.error("Error registering player:", error);
    }
  };

  const handlePlay = () => {
    socket.emit("start-game", { stakeAmount });
    setGameReady(true);
  };

 const claimWinnings = async () => {
  try {
    if (contract) {
      const tx = await contract.markMeAsWinner();
      await tx.wait();
      alert("Press Finalize Game to receive your winnings!");
      setReadyToFinalize(true); // show finalize button
    } else {
      alert("Contract not initialized.");
    }
  } catch (error) {
    console.error("Error claiming winnings:", error);
  }
};

const finalizeGame = async () => {
  try {
    if (contract) {
      const tx = await contract.declareWinner();
      await tx.wait();
      alert("Winnings successfully transferred!");
    } else {
      alert("Contract not initialized.");
    }
  } catch (error) {
    console.error("Error finalizing game:", error);
    alert("Could not finalize game. Make sure you're authorized.");
  }
};

  const handleCardClick = (id) => {
    if (turn === playerNumber) {
      socket.emit("flip-card", id);
    }
  };

  return (
    <div className="App">
      <h1>Memory Card Game</h1>
      {!gameReady ? (
        <div>
          {walletAddress ? (
            <p>Connected Wallet: {walletAddress}</p>
          ) : (
            <button onClick={connectWallet}>Connect Wallet</button>
          )}
          {walletAddress && !showPlayButton && (
            <>
              <input
                type="number"
                placeholder="Enter Stake Amount"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
              />
              <button onClick={register}>Register</button>
            </>
          )}
          {showPlayButton && <button onClick={handlePlay}>Play</button>}
        </div>
      ) : gameOver ? (
        <div>
          <h2>Game Over!</h2>
      
          {winner === 0 ? (
            <p>It's a draw! No one wins the stake.</p>
          ) : Number(winner) === Number(playerNumber) ? (
            <>
              <p>Congratulations! You won the game 🎉</p>
              <button onClick={claimWinnings} className="claim-button">
                Claim Winnings
              </button>
              {readyToFinalize && (
                <button onClick={finalizeGame} className="finalize-button">
                  Finalize Game
                </button>
              )}
            </>
          ) : (
            <p>Better luck next time!</p>
          )}
        </div>
      ) : (
        <>
          <p>Current Turn: Player {turn}</p>
          <div className="board">
            {cards.map((card) => (
              <div
                key={card.id}
                className={`card ${card.flipped ? "flipped" : ""} ${
                  card.matched ? "matched" : ""
                }`}
                onClick={() => handleCardClick(card.id)}
              >
                {card.flipped || card.matched ? (
                  <p>{card.name}</p>
                ) : (
                  "?"
                )}
              </div>
            ))}
          </div>
          <div className="scores">
            <p>Player 1 Score: {scores[0]}</p>
            <p>Player 2 Score: {scores[1]}</p>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
