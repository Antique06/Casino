import { getCurrentUser, updateBalance } from './firebase-service.js';

document.addEventListener('DOMContentLoaded', () => {
    // There might be multiple play buttons in the games grid for different slot machines
    const slotPlayBtns = document.querySelectorAll('.play-slot-btn');
    const interfaceSlot = document.getElementById('interface-slots');
    const slotBetLabel = document.getElementById('slot-current-bet');
    const spinBtn = document.getElementById('btn-spin-slot');
    const resultMsg = document.getElementById('result-slot');
    
    // Reels
    const reel1 = document.getElementById('reel-1');
    const reel2 = document.getElementById('reel-2');
    const reel3 = document.getElementById('reel-3');

    if (!spinBtn) return;

    let currentBet = 100;
    let isSpinning = false;

    // Symbols mapping by type
    const SYMBOLS = {
        low: ['🍒', '🍋', '🍉'],
        med: ['🔔', '⭐'],
        high: ['💎', '7️⃣']
    };

    // 100% RTP Math
    // 50% lose (0x), 20% pair (1x), 20% triple low (2x), 9% triple med (3x), 1% triple high (13x)
    function rollSlotOutcome() {
        const roll = Math.random();
        if (roll < 0.50) return { type: 'lose', mult: 0 };
        if (roll < 0.70) return { type: 'pair', mult: 1 };
        if (roll < 0.90) return { type: 'low_triple', mult: 2 };
        if (roll < 0.99) return { type: 'med_triple', mult: 3 };
        return { type: 'jackpot', mult: 13 };
    }

    function generateReelsFromOutcome(outcome) {
        let r1, r2, r3;
        const allSymbols = [...SYMBOLS.low, ...SYMBOLS.med, ...SYMBOLS.high];
        
        switch (outcome.type) {
            case 'jackpot':
                r1 = r2 = r3 = SYMBOLS.high[Math.floor(Math.random() * SYMBOLS.high.length)];
                break;
            case 'med_triple':
                r1 = r2 = r3 = SYMBOLS.med[Math.floor(Math.random() * SYMBOLS.med.length)];
                break;
            case 'low_triple':
                r1 = r2 = r3 = SYMBOLS.low[Math.floor(Math.random() * SYMBOLS.low.length)];
                break;
            case 'pair':
                // Two matching, one different
                const pairSym = allSymbols[Math.floor(Math.random() * allSymbols.length)];
                let otherSym = allSymbols[Math.floor(Math.random() * allSymbols.length)];
                while(otherSym === pairSym) otherSym = allSymbols[Math.floor(Math.random() * allSymbols.length)];
                
                const pos = Math.random();
                if (pos < 0.33) { r1 = otherSym; r2 = pairSym; r3 = pairSym; }
                else if (pos < 0.66) { r1 = pairSym; r2 = otherSym; r3 = pairSym; }
                else { r1 = pairSym; r2 = pairSym; r3 = otherSym; }
                break;
            case 'lose':
                // Three different symbols, or a layout that doesn't trigger pair/triple logic
                r1 = allSymbols[Math.floor(Math.random() * allSymbols.length)];
                r2 = allSymbols[Math.floor(Math.random() * allSymbols.length)];
                while(r2 === r1) r2 = allSymbols[Math.floor(Math.random() * allSymbols.length)];
                r3 = allSymbols[Math.floor(Math.random() * allSymbols.length)];
                while(r3 === r1 || r3 === r2) r3 = allSymbols[Math.floor(Math.random() * allSymbols.length)];
                break;
        }
        return [r1, r2, r3];
    }

    // Set up the UI when entering a specific slot machine
    slotPlayBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentBet = parseInt(e.target.dataset.bet);
            slotBetLabel.textContent = currentBet + " 💰";
            
            // Show the interface
            document.querySelector('.games-grid').classList.add('hidden');
            interfaceSlot.classList.remove('hidden');
            resultMsg.textContent = "";
            resultMsg.className = "result-message";
            
            // Reset reels to random
            reel1.textContent = '🎰';
            reel2.textContent = '🎰';
            reel3.textContent = '🎰';
        });
    });

    spinBtn.addEventListener('click', async () => {
        if (isSpinning) return;
        
        const user = getCurrentUser();
        if (!user) return;

        if (currentBet > user.balance) {
            alert("Fonds insuffisants pour cette machine !");
            return;
        }

        isSpinning = true;
        resultMsg.className = "result-message";
        resultMsg.classList.remove('show');

        // Deduct bet immediately
        const newBal = await updateBalance(-currentBet, true);
        window.updateBalanceUI(newBal);

        // Calculate math outcome (RTP 100%)
        const outcome = rollSlotOutcome();
        const finalSymbols = generateReelsFromOutcome(outcome);

        // Spin animation
        startSpinning();

        // Stop reels one by one
        setTimeout(() => stopReel(reel1, finalSymbols[0]), 1000);
        setTimeout(() => stopReel(reel2, finalSymbols[1]), 1500);
        setTimeout(() => stopReel(reel3, finalSymbols[2]), 2000);

        // Final result processing
        setTimeout(async () => {
            isSpinning = false;
            clearInterval(spinInterval);
            
            resultMsg.classList.add('show');
            const payout = currentBet * outcome.mult;
            
            if (outcome.mult === 0) {
                resultMsg.textContent = `Perdu... -${currentBet} 💰`;
                resultMsg.classList.add('lose');
            } else if (outcome.mult === 1) {
                resultMsg.textContent = `Remboursé ! +${payout} 💰`;
                resultMsg.style.color = '#fff';
            } else if (outcome.type === 'jackpot') {
                resultMsg.textContent = `JACKPOT !!! +${payout} 💰`;
                resultMsg.classList.add('win');
                resultMsg.style.textShadow = "0 0 20px #ffd700";
            } else {
                resultMsg.textContent = `Gagné ! +${payout} 💰`;
                resultMsg.classList.add('win');
            }

            if (payout > 0) {
                const finalBal = await updateBalance(payout, false);
                window.updateBalanceUI(finalBal);
            }
        }, 2200);
    });

    let spinInterval;
    function startSpinning() {
        const allSymbols = [...SYMBOLS.low, ...SYMBOLS.med, ...SYMBOLS.high];
        spinInterval = setInterval(() => {
            if (reel1.dataset.spinning !== 'false') reel1.textContent = allSymbols[Math.floor(Math.random() * allSymbols.length)];
            if (reel2.dataset.spinning !== 'false') reel2.textContent = allSymbols[Math.floor(Math.random() * allSymbols.length)];
            if (reel3.dataset.spinning !== 'false') reel3.textContent = allSymbols[Math.floor(Math.random() * allSymbols.length)];
        }, 100);
        
        reel1.dataset.spinning = 'true';
        reel2.dataset.spinning = 'true';
        reel3.dataset.spinning = 'true';
        
        reel1.classList.add('blur');
        reel2.classList.add('blur');
        reel3.classList.add('blur');
    }

    function stopReel(reel, symbol) {
        reel.dataset.spinning = 'false';
        reel.classList.remove('blur');
        reel.textContent = symbol;
    }
});
