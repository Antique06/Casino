import { getCurrentUser, updateBalance, isFirebaseInitialized, db } from './firebase-service.js';

document.addEventListener('DOMContentLoaded', () => {
    const mpPlayBtns = document.querySelectorAll('.play-mp-btn');
    const interfaceMp = document.getElementById('interface-multiplayer');
    const lobbyList = document.getElementById('lobby-rooms-list');
    const createRoomBtn = document.getElementById('btn-create-room');
    const createRoomBet = document.getElementById('create-room-bet');
    
    const viewLobby = document.getElementById('mp-view-lobby');
    const viewRoom = document.getElementById('mp-view-room');
    
    const roomStatusMsg = document.getElementById('room-status-msg');
    const roomBetSpan = document.getElementById('room-bet-span');
    
    const communityCardsDiv = document.getElementById('community-cards');
    const player1Box = document.getElementById('room-p1-box');
    const player2Box = document.getElementById('room-p2-box');
    const p1Name = document.getElementById('p1-name');
    const p2Name = document.getElementById('p2-name');
    const p1CardsDiv = document.getElementById('p1-cards');
    const p2CardsDiv = document.getElementById('p2-cards');
    const p1HandName = document.getElementById('p1-hand-name');
    const p2HandName = document.getElementById('p2-hand-name');
    
    const leaveRoomBtn = document.getElementById('btn-leave-room');

    let currentRoomId = null;
    let unsubscribeLobby = null;
    let unsubscribeRoom = null;

    if (!interfaceMp) return;

    // ----- POKER EVALUATOR -----
    function createDeck() {
        const suits = ['♠️', '♥️', '♣️', '♦️'];
        const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
        
        function getValNum(v) {
            if (['J','Q','K'].includes(v)) return ['J','Q','K'].indexOf(v) + 11;
            if (v === 'A') return 14;
            return parseInt(v);
        }

        let deck = [];
        for (let s of suits) {
            for (let v of values) {
                deck.push({ suit: s, value: v, val: getValNum(v), isRed: ['♥️','♦️'].includes(s) });
            }
        }
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    function evaluatePokerHand(all7Cards) {
        let cards = [...all7Cards].sort((a,b) => b.val - a.val);

        const suitsCount = { '♠️':[], '♥️':[], '♣️':[], '♦️':[] };
        const valMap = {};
        cards.forEach(c => {
            suitsCount[c.suit].push(c);
            if(!valMap[c.val]) valMap[c.val] = [];
            valMap[c.val].push(c);
        });

        const counts = Object.values(valMap).sort((a,b) => b.length - a.length || b[0].val - a[0].val);
        
        let flushCards = Object.values(suitsCount).find(arr => arr.length >= 5);
        if (flushCards) flushCards = flushCards.slice(0, 5);

        function getStraightHigh(cardArray) {
            let uniqueVals = [...new Set(cardArray.map(c => c.val))].sort((a,b)=>b-a);
            if (uniqueVals.includes(14)) uniqueVals.push(1); // Ace can be low
            for (let i=0; i<=uniqueVals.length-5; i++) {
                if (uniqueVals[i] - uniqueVals[i+4] === 4) return uniqueVals[i]; // Found straight
            }
            if (uniqueVals.join(',').includes('14,5,4,3,2')) return 5; // A-2-3-4-5 straight
            return 0;
        }

        let isFlush = !!flushCards;
        let straightHigh = getStraightHigh(cards);
        let straightFlushHigh = isFlush ? getStraightHigh(flushCards) : 0;

        function calcScore(rank, tieBreakerVals) {
            let s = rank * 1000000;
            for(let i=0; i<5; i++) {
                s += (tieBreakerVals[i] || 0) * Math.pow(15, 4-i);
            }
            return s;
        }

        if (straightFlushHigh > 0) return { handName: straightFlushHigh === 14 ? "Quinte Flush Royale" : "Quinte Flush", score: calcScore(9, [straightFlushHigh]) };
        if (counts[0].length === 4) return { handName: "Carré", score: calcScore(8, [counts[0][0].val, counts[1][0].val]) };
        if (counts[0].length === 3 && counts.length > 1 && counts[1].length >= 2) return { handName: "Full House", score: calcScore(7, [counts[0][0].val, counts[1][0].val]) };
        if (isFlush) return { handName: "Couleur", score: calcScore(6, flushCards.map(c=>c.val)) };
        if (straightHigh > 0) return { handName: "Suite", score: calcScore(5, [straightHigh]) };
        if (counts[0].length === 3) return { handName: "Brelan", score: calcScore(4, [counts[0][0].val, counts[1][0].val, counts[2][0].val]) };
        if (counts[0].length === 2 && counts[1].length === 2) return { handName: "Double Paire", score: calcScore(3, [counts[0][0].val, counts[1][0].val, counts[2][0].val]) };
        if (counts[0].length === 2) return { handName: "Paire", score: calcScore(2, [counts[0][0].val, counts[1][0].val, counts[2][0].val, counts[3][0].val]) };
        return { handName: "Carte Haute", score: calcScore(1, [counts[0][0].val, counts[1][0].val, counts[2][0].val, counts[3][0].val, counts[4][0].val]) };
    }

    function renderCard(card, isHidden = false) {
        const div = document.createElement('div');
        div.className = 'playing-card';
        // Poker sizes can be custom
        div.style.width = '60px';
        div.style.height = '85px';
        div.style.fontSize = '18px';
        
        if (isHidden || !card) {
            div.classList.add('hidden-card');
        } else {
            if (card.isRed) div.classList.add('red');
            div.textContent = card.value + card.suit;
        }
        return div;
    }

    // ----- UI LOGIC -----
    mpPlayBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (!isFirebaseInitialized) {
                alert("Le mode multijoueur est hors ligne car la connexion Firebase n'est pas initialisée.");
                return;
            }
            document.querySelector('.games-grid').classList.add('hidden');
            interfaceMp.classList.remove('hidden');
            showLobby();
        });
    });

    leaveRoomBtn.addEventListener('click', async () => {
        if (currentRoomId) {
            if (unsubscribeRoom) { unsubscribeRoom(); unsubscribeRoom = null; }
            
            const { doc, deleteDoc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            const roomRef = doc(db, "rooms", currentRoomId);
            const rSnap = await getDoc(roomRef);
            if (rSnap.exists()) {
                const rData = rSnap.data();
                if (rData.state === 'waiting' && rData.creator.id === getCurrentUser().id) {
                    await deleteDoc(roomRef);
                    const newBal = await updateBalance(rData.bet, false);
                    window.updateBalanceUI(newBal);
                }
            }
            currentRoomId = null;
        }
        showLobby();
        leaveRoomBtn.textContent = "Annuler la recherche"; 
    });

    async function showLobby() {
        viewLobby.classList.remove('hidden');
        viewRoom.classList.add('hidden');
        if (unsubscribeRoom) { unsubscribeRoom(); unsubscribeRoom = null; }
        listenToLobbies();
    }

    async function listenToLobbies() {
        if (unsubscribeLobby) unsubscribeLobby();
        
        const { collection, query, where, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const q = query(collection(db, "rooms"), where("state", "==", "waiting"));
        
        unsubscribeLobby = onSnapshot(q, (snapshot) => {
            lobbyList.innerHTML = '';
            if (snapshot.empty) {
                lobbyList.innerHTML = '<li>Aucun salon en attente. Créez-en un !</li>';
                return;
            }
            
            snapshot.forEach(docSnap => {
                const room = docSnap.data();
                const roomId = docSnap.id;
                const li = document.createElement('li');
                li.className = 'lobby-item';
                li.innerHTML = `
                    <div class="lobby-info">
                        <strong>${room.creator.username}</strong>
                        <span>Mise : ${room.bet} 💰</span>
                    </div>
                    <button class="btn-primary btn-join" data-id="${roomId}" data-bet="${room.bet}">Rejoindre</button>
                `;
                lobbyList.appendChild(li);
            });

            document.querySelectorAll('.btn-join').forEach(btn => {
                btn.addEventListener('click', (e) => joinRoom(e.target.dataset.id, parseInt(e.target.dataset.bet)));
            });
        });
    }

    createRoomBtn.addEventListener('click', async () => {
        const user = getCurrentUser();
        const betAmount = parseInt(createRoomBet.value);
        if (isNaN(betAmount) || betAmount < 10) { alert("Mise invalide (min 10)."); return; }
        if (user.balance < betAmount) { alert("Fonds insuffisants !"); return; }

        const newBal = await updateBalance(-betAmount, true);
        window.updateBalanceUI(newBal);

        const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        
        try {
            const docRef = await addDoc(collection(db, "rooms"), {
                creator: { id: user.id, username: user.username },
                bet: betAmount,
                state: 'waiting',
                joiner: null,
                createdAt: Date.now()
            });
            enterRoomView(docRef.id, user, null, betAmount);
        } catch (e) {
            console.error(e);
            alert("Erreur réseau.");
            await updateBalance(betAmount, false);
            window.updateBalanceUI(user.balance);
        }
    });

    async function joinRoom(roomId, roomBet) {
        const user = getCurrentUser();
        if (user.balance < roomBet) { alert("Fonds insuffisants !"); return; }

        const newBal = await updateBalance(-roomBet, true);
        window.updateBalanceUI(newBal);

        const { doc, updateDoc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const roomRef = doc(db, "rooms", roomId);
        
        try {
            const snap = await getDoc(roomRef);
            if (!snap.exists() || snap.data().state !== 'waiting') throw new Error("Salon indisponible.");
            
            await updateDoc(roomRef, {
                state: 'playing',
                joiner: { id: user.id, username: user.username }
            });
            enterRoomView(roomId, snap.data().creator, user, roomBet);
        } catch (e) {
            console.error(e);
            alert(e.message || "Erreur de connexion au salon.");
            await updateBalance(roomBet, false);
            window.updateBalanceUI(user.balance);
        }
    }

    async function enterRoomView(roomId, creatorObj, joinerObj, bet) {
        if (unsubscribeLobby) unsubscribeLobby();
        currentRoomId = roomId;
        viewLobby.classList.add('hidden');
        viewRoom.classList.remove('hidden');
        roomStatusMsg.className = "room-status";
        
        roomBetSpan.textContent = bet;
        p1Name.textContent = creatorObj.username;
        player1Box.classList.remove('winner', 'loser');
        p1HandName.textContent = '-';
        
        if (joinerObj) p2Name.textContent = joinerObj.username;
        else p2Name.textContent = "En attente...";
        
        p2HandName.textContent = '-';
        player2Box.classList.remove('winner', 'loser');
        leaveRoomBtn.classList.remove('hidden');

        // Reset cards UI
        communityCardsDiv.innerHTML = '';
        p1CardsDiv.innerHTML = '';
        p2CardsDiv.innerHTML = '';
        for(let i=0; i<5; i++) communityCardsDiv.appendChild(renderCard(null, true));
        for(let i=0; i<2; i++) { p1CardsDiv.appendChild(renderCard(null, true)); p2CardsDiv.appendChild(renderCard(null, true)); }

        const { doc, onSnapshot, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        
        unsubscribeRoom = onSnapshot(doc(db, "rooms", roomId), async (snapshot) => {
            if (!snapshot.exists()) {
                if (roomStatusMsg.dataset.ended !== 'true') {
                    alert("Le salon a été fermé.");
                    showLobby();
                }
                return;
            }
            
            const data = snapshot.data();
            
            if (data.state === 'waiting') {
                roomStatusMsg.textContent = "En attente d'un adversaire...";
                roomStatusMsg.dataset.ended = 'false';
            } 
            else if (data.state === 'playing') {
                leaveRoomBtn.classList.add('hidden');
                p2Name.textContent = data.joiner.username;
                roomStatusMsg.textContent = "Distribution des cartes en cours ! 🃏";
                
                // Creator logic
                const user = getCurrentUser();
                if (user.id === data.creator.id) {
                    setTimeout(async () => {
                        let deck = createDeck();
                        const p1Hole = [deck.pop(), deck.pop()];
                        const p2Hole = [deck.pop(), deck.pop()];
                        const board = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];

                        const p1Eval = evaluatePokerHand([...p1Hole, ...board]);
                        const p2Eval = evaluatePokerHand([...p2Hole, ...board]);
                        
                        let winner = 'tie';
                        if (p1Eval.score > p2Eval.score) winner = 'creator';
                        else if (p2Eval.score > p1Eval.score) winner = 'joiner';

                        await updateDoc(doc(db, "rooms", roomId), {
                            state: 'finished',
                            p1Hole, p2Hole, board,
                            p1HandName: p1Eval.handName,
                            p2HandName: p2Eval.handName,
                            winner
                        });
                    }, 1000); 
                }
            } 
            else if (data.state === 'finished') {
                roomStatusMsg.dataset.ended = 'true';
                
                // Animate showing cards
                animateCardsReveal(data, () => {
                    const user = getCurrentUser();
                    let isWinner = false;
                    
                    if (data.winner === 'creator') {
                        player1Box.classList.add('winner');
                        player2Box.classList.add('loser');
                        if (user.id === data.creator.id) isWinner = true;
                    } else if (data.winner === 'joiner') {
                        player2Box.classList.add('winner');
                        player1Box.classList.add('loser');
                        if (user.id === data.joiner.id) isWinner = true;
                    } else {
                        if (user.id === data.creator.id || user.id === data.joiner.id) {
                            roomStatusMsg.textContent = `Égalité ! Remboursement.`;
                            roomStatusMsg.className = "room-status win";
                            updateBalance(data.bet, false).then(b => window.updateBalanceUI(b));
                            
                            setTimeout(() => { leaveRoomBtn.textContent = "Retour au Lobby"; leaveRoomBtn.classList.remove('hidden'); }, 1000);
                            return; 
                        }
                    }
                    
                    if (isWinner) {
                        roomStatusMsg.textContent = `Vous avez gagné ! +${data.bet * 2} 💰`;
                        roomStatusMsg.className = "room-status win";
                        updateBalance(data.bet * 2, false).then(b => window.updateBalanceUI(b));
                    } else {
                        roomStatusMsg.textContent = `Vous avez perdu...`;
                        roomStatusMsg.className = "room-status lose";
                    }
                    
                    setTimeout(() => {
                        leaveRoomBtn.textContent = "Retour au Lobby";
                        leaveRoomBtn.classList.remove('hidden');
                    }, 1000);
                });
            }
        });
    }

    function animateCardsReveal(data, callback) {
        communityCardsDiv.innerHTML = '';
        data.board.forEach(card => communityCardsDiv.appendChild(renderCard(card)));

        setTimeout(() => {
            p1CardsDiv.innerHTML = '';
            data.p1Hole.forEach(card => p1CardsDiv.appendChild(renderCard(card)));
            p1HandName.textContent = data.p1HandName;

            p2CardsDiv.innerHTML = '';
            data.p2Hole.forEach(card => p2CardsDiv.appendChild(renderCard(card)));
            p2HandName.textContent = data.p2HandName;

            callback();
        }, 800);
    }
});
