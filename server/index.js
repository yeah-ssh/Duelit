const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

let players = [];
let wallets = [];
let cards = [];
let currentTurn = null;

function shuffle(array) {
  console.log("Shuffling cards...");
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function initializeCards() {
  console.log("Initializing cards...");
  return shuffle([
    { id: 1, name: "A", flipped: false, matched: false },
    { id: 2, name: "A", flipped: false, matched: false },
    { id: 3, name: "B", flipped: false, matched: false },
    { id: 4, name: "B", flipped: false, matched: false },
    { id: 5, name: "C", flipped: false, matched: false },
    { id: 6, name: "C", flipped: false, matched: false },
    { id: 7, name: "D", flipped: false, matched: false },
    { id: 8, name: "D", flipped: false, matched: false },
    { id: 9, name: "E", flipped: false, matched: false },
    { id: 10, name: "E", flipped: false, matched: false },
    { id: 11, name: "F", flipped: false, matched: false },
    { id: 12, name: "F", flipped: false, matched: false },
  ]);
}

io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Handle wallet connection
  socket.on("connect-wallet", (walletAddress) => {
    console.log(`Wallet connection request received from ${walletAddress}`);
    if (wallets.includes(walletAddress)) {
      console.log("Wallet already connected.");
      socket.emit("wallet-connected", wallets);
    } else if (players.length < 2) {
      console.log(`New player joined with wallet: ${walletAddress}`);
      players.push({ id: socket.id, wallet: walletAddress, score: 0, registered: false });
      wallets.push(walletAddress);
      socket.emit("player-info", players.length);
    } else {
      console.log("Game is full, rejecting connection.");
      socket.emit("game-full");
      socket.disconnect();
    }
  });

  // Handle player registration with stake amount
  socket.on("register", ({ stakeAmount }) => {
    console.log(`Player ${socket.id} registering with stake amount: ${stakeAmount}`);
    const player = players.find((p) => p.id === socket.id);
    if (player) {
      player.registered = true;
      player.stakeAmount = stakeAmount;

      // Check if both players are registered
      const allRegistered = players.length === 2 && players.every((p) => p.registered);
      if (allRegistered) {
        console.log("Both players registered. Ready to start the game.");
        io.emit("show-play-button"); // Notify clients to display the Play button
      }
    }
  });

  // Start the game
  socket.on("start-game", () => {
    console.log("Start game request received.");
    if (players.length === 2 && players.every((p) => p.registered)) {
      console.log("Both players are ready. Starting the game...");
      cards = initializeCards();
      currentTurn = 1;
      io.emit("start-game", { cards, turn: currentTurn });
    } else {
      console.log("Not all players are ready.");
      socket.emit("not-ready");
    }
  });

  // Handle card flipping
  socket.on("flip-card", (cardId) => {
    console.log(`Player ${socket.id} flipped card with ID: ${cardId}`);
    const card = cards.find((c) => c.id === cardId);
    if (card && !card.flipped && !card.matched) {
      card.flipped = true;
      io.emit("update-board", cards);

      const flippedCards = cards.filter((c) => c.flipped && !c.matched);
      if (flippedCards.length === 2) {
        const [first, second] = flippedCards;
        if (first.name === second.name) {
          console.log("Cards match!");
          first.matched = true; 
          second.matched = true; 
          players[currentTurn - 1].score += 1;
          io.emit("update-scores", players.map((p) => p.score));
        } else {
          console.log("Cards don't match. Flipping them back...");
          setTimeout(() => {
            first.flipped = false;
            second.flipped = false;
            io.emit("update-board", cards);
            currentTurn = currentTurn === 1 ? 2 : 1;
            io.emit("change-turn", currentTurn);
            
          }, 1000);
        }
       
      }
    }

    // Check for game over
    if (cards.every((c) => c.matched)) {
      console.log("Game over!");
      const winner =
        players[0].score > players[1].score
          ? 1
          : players[1].score > players[0].score
          ? 2
          : 0;
      io.emit("game-over", {
        finalScores: players.map((p) => p.score),
        winner,
      });
    }
  });

  // Handle player disconnection
  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
    const playerIndex = players.findIndex((p) => p.id === socket.id);
    if (playerIndex !== -1) {
      players.splice(playerIndex, 1);
      wallets.splice(playerIndex, 1);
      if (players.length < 2) {
        console.log("Not enough players, game reset.");
        cards = [];
        currentTurn = null;
        io.emit("player-left");
      }
    }
  });
});

// Start the server
server.listen(4000, () => {
  console.log("Server running on http://localhost:4000");
});
