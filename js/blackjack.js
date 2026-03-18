import { getCurrentUser, updateBalance } from './firebase-service.js';

document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn-blackjack');
    const hitBtn = document.getElementById('btn-hit');
    const standBtn = document.getElementById('btn-stand');
    const betInput = document.getElementById('bet-blackjack');
    
    const controlsDiv = document.getElementById('controls-blackjack');
    const tableDiv = document.getElementById('table-blackjack');
    const actionsDiv = document.getElementById('action-btns-blackjack');
    
    const dealerCardsDiv = document.getElementById('dealer-cards');
    const playerCardsDiv = document.getElementById('player-cards');
    const dealerScoreSpan = document.getElementById('dealer-score');
    const playerScoreSpan = document.getElementById('player-score');
    const resultMsg = document.getElementById('result-blackjack');
    const replayBtn = document.getElementById('replay-btn-blackjack');

    if (!startBtn) return; // safety

    const suits = ['♠️', '♥️', '♣️', '♦️'];
    const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

    let deck = [];
    let dealerHand = [];
    let playerHand = [];
    let currentBet = 0;
    let isGameOver = false;

    function createDeck() {
        deck = [];
        for (let s of suits) {
            for (let v of values) {
                deck.push({ suit: s, value: v, isRed: ['♥️','♦️'].includes(s) });
            }
        }
        // Shuffle
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    }

    function getCardValue(valStr) {
        if (['J','Q','K'].includes(valStr)) return 10;
        if (valStr === 'A') return 11;
        return parseInt(valStr);
    }

    function calculateScoreInfo(hand) {
        let score = 0;
        let aces = 0;
        for (let card of hand) {
            score += getCardValue(card.value);
            if (card.value === 'A') aces++;
        }
        while (score > 21 && aces > 0) {
            score -= 10;
            aces--;
        }
        return { score, isSoft: aces > 0 };
    }

    function calculateScore(hand) {
        return calculateScoreInfo(hand).score;
    }

    function renderCard(card, isHidden = false) {
        const div = document.createElement('div');
        div.className = 'playing-card';
        if (isHidden) {
            div.classList.add('hidden-card');
        } else {
            if (card.isRed) div.classList.add('red');
            div.textContent = card.value + card.suit;
        }
        return div;
    }

    function renderHands(hideDealerSecond = false) {
        dealerCardsDiv.innerHTML = '';
        playerCardsDiv.innerHTML = '';
        
        playerHand.forEach(card => playerCardsDiv.appendChild(renderCard(card)));
        
        const pInfo = calculateScoreInfo(playerHand);
        playerScoreSpan.textContent = pInfo.isSoft ? `${pInfo.score - 10} / ${pInfo.score}` : pInfo.score;

        dealerHand.forEach((card, index) => {
            const isHidden = hideDealerSecond && index === 1;
            dealerCardsDiv.appendChild(renderCard(card, isHidden));
        });

        if (hideDealerSecond) {
            const dVal = getCardValue(dealerHand[0].value);
            dealerScoreSpan.textContent = dealerHand[0].value === 'A' ? '1 / 11' : dVal;
        } else {
            const dInfo = calculateScoreInfo(dealerHand);
            dealerScoreSpan.textContent = dInfo.score;
        }
    }

    async function endGame(resultType) {
        isGameOver = true;
        actionsDiv.classList.add('hidden');
        renderHands(false); // Reveal dealer card
        resultMsg.classList.add('show');
        
        let payout = 0;
        
        if (resultType === 'player_blackjack') {
            resultMsg.textContent = `Blackjack ! +${currentBet * 2.5} 💰`;
            resultMsg.classList.add('win');
            payout = currentBet * 2.5;
        } else if (resultType === 'win') {
            resultMsg.textContent = `Gagné ! +${currentBet * 2} 💰`;
            resultMsg.classList.add('win');
            payout = currentBet * 2;
        } else if (resultType === 'push') {
            resultMsg.textContent = `Égalité. Votre mise de ${currentBet} 💰 vous est retournée.`;
            resultMsg.classList.remove('win', 'lose');
            resultMsg.style.color = '#fff';
            payout = currentBet;
        } else { // Lose or Bust
            resultMsg.textContent = `Perdu... -${currentBet} 💰`;
            resultMsg.classList.add('lose');
        }

        if (payout > 0) {
            const finalBal = await updateBalance(payout, false);
            window.updateBalanceUI(finalBal);
        }
        
        // Show start controls again eventually
        setTimeout(() => {
            startBtn.textContent = "Changer la mise";
            controlsDiv.classList.remove('hidden');
            if (replayBtn) replayBtn.classList.remove('hidden');
        }, 1500);
    }

    startBtn.addEventListener('click', async () => {
        if (replayBtn) replayBtn.classList.add('hidden');
        
        const user = getCurrentUser();
        if (!user) return;

        currentBet = parseInt(betInput.value);
        if (isNaN(currentBet) || currentBet <= 0) {
            alert("Mise invalide.");
            return;
        }
        if (currentBet > user.balance) {
            alert("Fonds insuffisants !");
            return;
        }

        const newBal = await updateBalance(-currentBet, true); // Deduct bet immediately
        window.updateBalanceUI(newBal);

        createDeck();
        playerHand = [deck.pop(), deck.pop()];
        dealerHand = [deck.pop(), deck.pop()];
        isGameOver = false;

        controlsDiv.classList.add('hidden');
        tableDiv.classList.remove('hidden');
        actionsDiv.classList.remove('hidden');
        resultMsg.classList.remove('show', 'win', 'lose');
        resultMsg.textContent = "";

        renderHands(true);

        const pScore = calculateScore(playerHand);
        if (pScore === 21) {
            endGame('player_blackjack');
        }
    });

    hitBtn.addEventListener('click', () => {
        if (isGameOver) return;
        playerHand.push(deck.pop());
        renderHands(true);
        
        if (calculateScore(playerHand) > 21) {
            endGame('bust');
        }
    });

    standBtn.addEventListener('click', () => {
        if (isGameOver) return;
        renderHands(false); // reveal dealer card
        
        // Dealer draws until 17
        const drawInterval = setInterval(() => {
            if (calculateScore(dealerHand) < 17) {
                dealerHand.push(deck.pop());
                renderHands(false);
            } else {
                clearInterval(drawInterval);
                finishDealerTurn();
            }
        }, 800);
    });

    function finishDealerTurn() {
        const pScore = calculateScore(playerHand);
        const dScore = calculateScore(dealerHand);

        if (dScore > 21) {
            endGame('win');
        } else if (pScore > dScore) {
            endGame('win');
        } else if (dScore > pScore) {
            endGame('lose');
        } else {
            endGame('push');
        }
    }

    if (replayBtn) {
        replayBtn.addEventListener('click', () => {
            startBtn.click();
        });
    }
});
