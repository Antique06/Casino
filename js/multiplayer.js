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
    const potSpan = document.getElementById('mp-pot');
    
    // UI Local Mappings
    const oppName = document.getElementById('opp-name');
    const oppCards = document.getElementById('opp-cards');
    const oppBet = document.getElementById('opp-current-bet');
    const oppHandName = document.getElementById('opp-hand-name');
    const oppBox = document.getElementById('room-opp-box');

    const selfName = document.getElementById('self-name');
    const selfCards = document.getElementById('self-cards');
    const selfBet = document.getElementById('self-current-bet');
    const selfHandName = document.getElementById('self-hand-name');
    const selfBox = document.getElementById('room-self-box');

    const communityCardsDiv = document.getElementById('community-cards');
    
    const pokerActionsDiv = document.getElementById('poker-actions');
    const btnFold = document.getElementById('btn-poker-fold');
    const btnCheck = document.getElementById('btn-poker-check');
    const btnCall = document.getElementById('btn-poker-call');
    const spanCallAmt = document.getElementById('call-amount');
    const btnRaise = document.getElementById('btn-poker-raise');
    const inputRaise = document.getElementById('raise-amount');
    
    const leaveRoomBtn = document.getElementById('btn-leave-room');

    let currentRoomId = null;
    let unsubscribeLobby = null;
    let unsubscribeRoom = null;
    let myRole = null; // 'p1' or 'p2'
    let oppRole = null;
    
    // Track local document state
    let roomState = null;

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
        if (!all7Cards || all7Cards.length < 5) return { handName: "-", score: 0 };
        let cards = [...all7Cards].filter(c => c).sort((a,b) => b.val - a.val);

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
            if (uniqueVals.includes(14)) uniqueVals.push(1); 
            for (let i=0; i<=uniqueVals.length-5; i++) {
                if (uniqueVals[i] - uniqueVals[i+4] === 4) return uniqueVals[i];
            }
            if (uniqueVals.join(',').includes('14,5,4,3,2')) return 5;
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
        div.style.width = '50px';
        div.style.height = '75px';
        div.style.fontSize = '16px';
        div.style.padding = '0';
        
        if (isHidden || !card) {
            div.classList.add('hidden-card');
        } else {
            if (card.isRed) div.classList.add('red');
            div.textContent = card.value + card.suit;
        }
        return div;
    }

    // ----- UI ENTRY -----
    mpPlayBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (!isFirebaseInitialized) {
                alert("Le mode multijoueur est hors ligne car Firebase n'est pas initialisé.");
                return;
            }
            document.querySelector('.games-grid').classList.add('hidden');
            interfaceMp.classList.remove('hidden');
            showLobby();
        });
    });

    leaveRoomBtn.addEventListener('click', async () => {
        if (currentRoomId) {
            const { doc, deleteDoc, getDoc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            const roomRef = doc(db, "rooms", currentRoomId);
            const rSnap = await getDoc(roomRef);
            if (rSnap.exists()) {
                const rData = rSnap.data();
                if (rData.state === 'waiting' && rData.creator.id === getCurrentUser().id) {
                    await deleteDoc(roomRef); // Cancel room
                    await updateBalance(rData.bet, false);
                } else if (rData.state === 'playing') {
                    // Forfeit
                    await updateDoc(roomRef, {
                        state: 'finished',
                        winMode: 'fold',
                        winner: oppRole
                    });
                }
            }
            if (unsubscribeRoom) { unsubscribeRoom(); unsubscribeRoom = null; }
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

    // ----- LOBBY -----
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
                        <span>Ante (Mise Initiale) : ${room.bet} 💰</span>
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
        const betAmount = parseInt(createRoomBet.value); // This is the Ante
        if (isNaN(betAmount) || betAmount < 10) { alert("Ante invalide (min 10)."); return; }
        if (user.balance < betAmount) { alert("Fonds insuffisants !"); return; }

        await updateBalance(-betAmount, true); // Pay Ante
        window.updateBalanceUI(user.balance);

        const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        
        try {
            const docRef = await addDoc(collection(db, "rooms"), {
                creator: { id: user.id, username: user.username },
                joiner: null,
                bet: betAmount, // Base ante
                state: 'waiting', 
                stage: '',
                turn: '',
                pot: betAmount,
                currentBet: 0,
                p1Bet: 0, p2Bet: 0,
                p1Acted: false, p2Acted: false,
                board: [], p1Hole: [], p2Hole: [], deck: [],
                winner: null, winMode: null,
                createdAt: Date.now()
            });
            enterRoomView(docRef.id, 'p1', user, null);
        } catch (e) {
            console.error(e);
            alert("Erreur création salon.");
            await updateBalance(betAmount, false);
            window.updateBalanceUI(user.balance);
        }
    });

    async function joinRoom(roomId, roomBet) {
        const user = getCurrentUser();
        if (user.balance < roomBet) { alert("Fonds insuffisants !"); return; }

        await updateBalance(-roomBet, true); // Pay Ante
        window.updateBalanceUI(user.balance);

        const { doc, updateDoc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const roomRef = doc(db, "rooms", roomId);
        
        try {
            const snap = await getDoc(roomRef);
            if (!snap.exists() || snap.data().state !== 'waiting') throw new Error("Salon indisponible.");
            
            // Joiner triggers the dealer!
            const deck = createDeck();
            const p1Hole = [deck.pop(), deck.pop()];
            const p2Hole = [deck.pop(), deck.pop()];

            await updateDoc(roomRef, {
                state: 'playing',
                stage: 'pre-flop',
                joiner: { id: user.id, username: user.username },
                pot: snap.data().pot + roomBet,
                deck: deck,
                p1Hole: p1Hole,
                p2Hole: p2Hole,
                turn: 'p1' // P1 acts first pre-flop for simplicity
            });
            enterRoomView(roomId, 'p2', snap.data().creator, user);
        } catch (e) {
            console.error(e);
            alert(e.message || "Erreur jonction.");
            await updateBalance(roomBet, false);
            window.updateBalanceUI(user.balance);
        }
    }

    async function enterRoomView(roomId, role, p1Data, p2Data) {
        if (unsubscribeLobby) unsubscribeLobby();
        currentRoomId = roomId;
        myRole = role;
        oppRole = role === 'p1' ? 'p2' : 'p1';
        
        viewLobby.classList.add('hidden');
        viewRoom.classList.remove('hidden');
        roomStatusMsg.className = "room-status";
        
        const myData = role === 'p1' ? p1Data : p2Data;
        const oppDataObj = role === 'p1' ? p2Data : p1Data;

        selfName.textContent = myData.username;
        if (oppDataObj) oppName.textContent = oppDataObj.username;
        else oppName.textContent = "Recherche d'un adversaire...";
        
        resetUI();

        const { doc, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        
        unsubscribeRoom = onSnapshot(doc(db, "rooms", roomId), async (snapshot) => {
            if (!snapshot.exists()) {
                if (roomStatusMsg.dataset.ended !== 'true') { alert("Salon fermé."); showLobby(); }
                return;
            }
            
            roomState = snapshot.data();
            renderState();
        });
    }

    function resetUI() {
        potSpan.textContent = '0';
        selfBet.textContent = '0';
        oppBet.textContent = '0';
        selfCards.innerHTML = '';
        oppCards.innerHTML = '';
        communityCardsDiv.innerHTML = '';
        for(let i=0; i<5; i++) communityCardsDiv.appendChild(renderCard(null, true));
        selfCards.appendChild(renderCard(null, true)); selfCards.appendChild(renderCard(null, true));
        oppCards.appendChild(renderCard(null, true)); oppCards.appendChild(renderCard(null, true));
        selfHandName.textContent = '-';
        oppHandName.textContent = '-';
        pokerActionsDiv.classList.add('hidden');
        selfBox.classList.remove('winner', 'loser');
        oppBox.classList.remove('winner', 'loser');
        leaveRoomBtn.classList.remove('hidden');
        leaveRoomBtn.textContent = "Déclarer Forfait";
    }

    function renderState() {
        if (!roomState) return;
        
        if (roomState.state === 'waiting') {
            roomStatusMsg.textContent = "En attente...";
            leaveRoomBtn.textContent = "Annuler le salon";
            return;
        }

        if (roomState.state === 'playing') {
            // Update names if joined
            if (myRole === 'p1') oppName.textContent = roomState.joiner.username;
            else oppName.textContent = roomState.creator.username;

            potSpan.textContent = roomState.pot;
            selfBet.textContent = roomState[`${myRole}Bet`];
            oppBet.textContent = roomState[`${oppRole}Bet`];

            // Render Board
            communityCardsDiv.innerHTML = '';
            for(let i=0; i<5; i++) {
                if (roomState.board[i]) communityCardsDiv.appendChild(renderCard(roomState.board[i]));
                else communityCardsDiv.appendChild(renderCard(null, true));
            }

            // Render Hole Cards
            selfCards.innerHTML = '';
            const myHole = roomState[`${myRole}Hole`];
            myHole.forEach(c => selfCards.appendChild(renderCard(c)));
            
            oppCards.innerHTML = ''; // Opponent cards remain hidden during play
            oppCards.appendChild(renderCard(null, true));
            oppCards.appendChild(renderCard(null, true));

            // Eval partial hand
            const myBest = evaluatePokerHand([...myHole, ...roomState.board]);
            selfHandName.textContent = myBest.handName;

            // Turn Handling
            if (roomState.turn === myRole) {
                pokerActionsDiv.classList.remove('hidden');
                roomStatusMsg.textContent = "À VOUS DE JOUER";
                roomStatusMsg.style.color = "#00ff88";
                
                const neededToCall = roomState.currentBet - roomState[`${myRole}Bet`];
                let maxP1Total = (roomState.p1Bet || 0) + (roomState.p1Balance || 0);
                let maxP2Total = (roomState.p2Bet || 0) + (roomState.p2Balance || 0);
                let absoluteMaxBet = Math.min(maxP1Total, maxP2Total);
                
                let maxRaiseAmount = absoluteMaxBet - roomState.currentBet;

                if (maxRaiseAmount <= 0) {
                    btnRaise.style.opacity = '0.5';
                    btnRaise.style.pointerEvents = 'none';
                    inputRaise.disabled = true;
                } else {
                    btnRaise.style.opacity = '1';
                    btnRaise.style.pointerEvents = 'auto';
                    inputRaise.disabled = false;
                    inputRaise.max = maxRaiseAmount;
                    if (parseInt(inputRaise.value) > maxRaiseAmount) inputRaise.value = maxRaiseAmount;
                }

                if (neededToCall > 0) {
                    btnCheck.classList.add('hidden');
                    btnCall.classList.remove('hidden');
                    spanCallAmt.textContent = `(${neededToCall} 💰)`;
                } else {
                    btnCheck.classList.remove('hidden');
                    btnCall.classList.add('hidden');
                }
            } else {
                pokerActionsDiv.classList.add('hidden');
                roomStatusMsg.textContent = "L'adversaire réfléchit...";
                roomStatusMsg.style.color = "var(--text)";
            }
        } 
        else if (roomState.state === 'finished') {
            if (roomStatusMsg.dataset.ended === 'true') return;
            roomStatusMsg.dataset.ended = 'true';
            pokerActionsDiv.classList.add('hidden');
            potSpan.textContent = roomState.pot;

            // Reveal Opponent
            oppCards.innerHTML = '';
            const oHole = roomState[`${oppRole}Hole`];
            if (oHole && roomState.winMode !== 'fold') {
                oHole.forEach(c => oppCards.appendChild(renderCard(c)));
                const oppBest = evaluatePokerHand([...oHole, ...roomState.board]);
                oppHandName.textContent = oppBest.handName;
            }

            const isWinner = roomState.winner === myRole;
            const isTie = roomState.winner === 'tie';

            if (isWinner) {
                selfBox.classList.add('winner');
                oppBox.classList.add('loser');
                if (roomState.winMode === 'fold') roomStatusMsg.textContent = `Adversaire couché. Victoire ! +${roomState.pot} 💰`;
                else roomStatusMsg.textContent = `Vous Gagnez ! +${roomState.pot} 💰`;
                roomStatusMsg.className = "room-status win";
                
                // Payout exactly once!
                if (!roomState.payoutDoneByWinner) {
                    updateBalance(roomState.pot, false).then(b => window.updateBalanceUI(b));
                    // We don't bother setting payoutDoneByWinner in Firestore to avoid extra writes,
                    // we just rely on dataset.ended locally! That prevents double payouts locally.
                }
            } else if (isTie) {
                selfBox.classList.add('winner');
                oppBox.classList.add('winner');
                roomStatusMsg.textContent = `Égalité ! Pot partagé (+${roomState.pot/2} 💰)`;
                updateBalance(Math.floor(roomState.pot/2), false).then(b => window.updateBalanceUI(b));
            } else {
                selfBox.classList.add('loser');
                oppBox.classList.add('winner');
                roomStatusMsg.textContent = `Vous avez perdu la main.`;
                roomStatusMsg.className = "room-status lose";
            }

            setTimeout(() => {
                leaveRoomBtn.textContent = "Retour au Lobby";
            }, 1000);
        }
    }

    // ----- ACTIONS -----
    async function processAction(actionInfo) {
        if (!roomState || roomState.turn !== myRole) return;
        pokerActionsDiv.classList.add('hidden'); // Disable fast clicks
        const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const roomRef = doc(db, "rooms", currentRoomId);
        
        let updates = {
            [`${myRole}Acted`]: true
        };

        const myBetProp = `${myRole}Bet`;
        const oppActedProp = `${oppRole}Acted`;
        let myCurrentBet = roomState[myBetProp];
        let newPot = roomState.pot;
        let newCurrentBet = roomState.currentBet;
        let newTurn = oppRole;

        const user = getCurrentUser();

        if (actionInfo.type === 'fold') {
            await updateDoc(roomRef, {
                state: 'finished',
                winMode: 'fold',
                winner: oppRole,
                turn: ''
            });
            return;
        }

        if (actionInfo.type === 'call') {
            const needed = newCurrentBet - myCurrentBet;
            if (user.balance < needed) { alert("Fonds insuffisants !"); return; }
            await updateBalance(-needed, true); window.updateBalanceUI(user.balance);
            myCurrentBet += needed;
            newPot += needed;
            updates[`${myRole}Balance`] = user.balance;
        }

        if (actionInfo.type === 'raise') {
            const neededToCall = newCurrentBet - myCurrentBet;
            
            const maxP1Total = (roomState.p1Bet || 0) + (roomState.p1Balance || 0);
            const maxP2Total = (roomState.p2Bet || 0) + (roomState.p2Balance || 0);
            const absoluteMaxBet = Math.min(maxP1Total, maxP2Total);
            const maxRaiseAllowed = absoluteMaxBet - newCurrentBet;
            
            let requestedRaise = actionInfo.amount;
            if (requestedRaise > maxRaiseAllowed) requestedRaise = maxRaiseAllowed;
            
            if (requestedRaise <= 0) return;

            const totalToPay = neededToCall + requestedRaise;
            if (user.balance < totalToPay) { alert("Fonds insuffisants !"); return; }
            await updateBalance(-totalToPay, true); window.updateBalanceUI(user.balance);
            
            myCurrentBet += totalToPay;
            newPot += totalToPay;
            newCurrentBet = myCurrentBet;
            updates[`${oppRole}Acted`] = false; 
            updates[`${myRole}Balance`] = user.balance;
        }

        updates[myBetProp] = myCurrentBet;
        updates.pot = newPot;
        updates.currentBet = newCurrentBet;
        updates.turn = newTurn;

        // CHECK IF ROUND OVER (Both acted, and myBet == currentBet)
        // Since I'm processing check/call, myBet equals currentBet now.
        // We only advance if the opponent also acted!
        let oppHasActed = roomState[oppActedProp];
        if (actionInfo.type === 'raise') oppHasActed = false; // just forced them to un-act

        if (oppHasActed && updates[myBetProp] === updates.currentBet) {
            // ADVANCE ROUND
            let nextStage = '';
            let deck = [...roomState.deck];
            let board = [...roomState.board];

            if (roomState.stage === 'pre-flop') {
                nextStage = 'flop';
                board.push(deck.pop(), deck.pop(), deck.pop());
            } else if (roomState.stage === 'flop') {
                nextStage = 'turn';
                board.push(deck.pop());
            } else if (roomState.stage === 'turn') {
                nextStage = 'river';
                board.push(deck.pop());
            } else if (roomState.stage === 'river') {
                nextStage = 'showdown';
            }

            if (nextStage === 'showdown') {
                // Evaluate Hand Showdown
                const p1h = evaluatePokerHand([...roomState.p1Hole, ...board]);
                const p2h = evaluatePokerHand([...roomState.p2Hole, ...board]);
                let winner = 'tie';
                if (p1h.score > p2h.score) winner = 'p1';
                else if (p2h.score > p1h.score) winner = 'p2';

                await updateDoc(roomRef, {
                    ...updates,
                    state: 'finished',
                    winMode: 'showdown',
                    winner: winner,
                    turn: ''
                });
                return;
            } else {
                // Standard advance
                updates.stage = nextStage;
                updates.board = board;
                updates.deck = deck;
                updates.currentBet = 0;
                updates.p1Bet = 0;
                updates.p2Bet = 0;
                updates.p1Acted = false;
                updates.p2Acted = false;
                updates.turn = 'p1'; // P1 acts first post-flop
            }
        }

        await updateDoc(roomRef, updates);
    }

    btnFold.addEventListener('click', () => processAction({ type: 'fold' }));
    btnCheck.addEventListener('click', () => processAction({ type: 'check' }));
    btnCall.addEventListener('click', () => processAction({ type: 'call' }));
    btnRaise.addEventListener('click', () => {
        const amt = parseInt(inputRaise.value);
        if (amt >= 10) processAction({ type: 'raise', amount: amt });
        else alert("Relance invalide");
    });
});
